import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { storage } from "./storage";
import { seedDemoUsers, seedDemoIdeas } from "./seed";
import { loginSchema, createIdeaSchema, ROLES, type UserRole } from "@shared/schema";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerProcessMapRoutes } from "./process-map-routes";
import { registerDocumentRoutes } from "./document-routes";
import { registerUiPathRoutes } from "./uipath-routes";
import { registerFileUploadRoutes } from "./file-upload";
import { evaluateTransition } from "./stage-transition";

declare module "express-session" {
  interface SessionData {
    userId: string;
    activeRole: UserRole;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgStore = connectPgSimple(session);

  const pgStore = new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    errorLog: (err: Error) => {
      console.error("[Session Store]", err.message);
    },
  });

  const sessionMiddleware = session({
    store: pgStore,
    secret: process.env.SESSION_SECRET || "cannonball-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  });

  app.use((req, res, next) => {
    sessionMiddleware(req, res, (err) => {
      if (err) {
        console.error("[Session]", err.message);
        if (req.path.startsWith("/api/")) {
          return res.status(500).json({ message: "Session error" });
        }
        return next();
      }
      next();
    });
  });

  await seedDemoUsers();
  await seedDemoIdeas();

  registerChatRoutes(app);
  registerProcessMapRoutes(app);
  registerDocumentRoutes(app);
  registerUiPathRoutes(app);
  registerFileUploadRoutes(app);

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "User not found" });
    }
    const { password, ...safeUser } = user;
    return res.json({
      user: safeUser,
      activeRole: req.session.activeRole || user.role,
    });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid email or password format" });
    }
    const { email, password } = parsed.data;
    const user = await storage.getUserByEmail(email);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    req.session.userId = user.id;
    req.session.activeRole = user.role as UserRole;
    const { password: _, ...safeUser } = user;
    return res.json({
      user: safeUser,
      activeRole: user.role,
    });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out" });
    });
  });

  app.post("/api/auth/switch-role", (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { role } = req.body;
    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    req.session.activeRole = role;
    return res.json({ activeRole: role });
  });

  app.get("/api/ideas", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const allIdeas = await storage.getAllIdeas();
    return res.json(allIdeas);
  });

  app.get("/api/ideas/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const idea = await storage.getIdea(req.params.id as string);
    if (!idea) {
      return res.status(404).json({ message: "Idea not found" });
    }
    return res.json(idea);
  });

  app.post("/api/ideas/check-similar", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }
    const allIdeas = await storage.getAllIdeas();
    const titleWords = (title as string).toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    const descWords = ((description as string) || "").toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    const inputWords = Array.from(new Set([...titleWords, ...descWords]));

    const similar = allIdeas
      .map((idea) => {
        const ideaTitle = idea.title.toLowerCase();
        const ideaDesc = (idea.description || "").toLowerCase();
        const ideaWords = Array.from(new Set([
          ...ideaTitle.split(/\s+/).filter(w => w.length > 2),
          ...ideaDesc.split(/\s+/).filter(w => w.length > 2),
        ]));
        const overlap = inputWords.filter(w => ideaWords.includes(w));
        const score = inputWords.length > 0 ? overlap.length / inputWords.length : 0;
        return { idea, score };
      })
      .filter(({ score }) => score >= 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ idea, score }) => ({
        id: idea.id,
        title: idea.title,
        description: idea.description,
        stage: idea.stage,
        owner: idea.owner,
        score: Math.round(score * 100),
      }));

    return res.json({ similar });
  });

  app.get("/api/ideas/:id/stage-history", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const logs = await storage.getAuditLogs(req.params.id as string);
    const transitions = logs
      .filter(l => l.action === "stage_transition" && l.toStage)
      .map(l => ({
        stage: l.toStage!,
        timestamp: l.createdAt,
      }));
    return res.json({ transitions });
  });

  app.post("/api/ideas", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const parsed = createIdeaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid idea data", errors: parsed.error.flatten() });
    }
    const idea = await storage.createIdea({
      ...parsed.data,
      stage: "Idea",
      tag: parsed.data.tag || null,
    });
    return res.status(201).json(idea);
  });

  app.patch("/api/ideas/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const idea = await storage.getIdea(req.params.id as string);
    if (!idea) return res.status(404).json({ message: "Idea not found" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    if (idea.ownerEmail !== user.email && user.role !== "Admin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    const { title, description, tag } = req.body;
    const updates: Record<string, string> = {};
    if (title && typeof title === "string") updates.title = title.trim();
    if (description && typeof description === "string") updates.description = description.trim();
    if (tag !== undefined) updates.tag = tag;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }
    const updated = await storage.updateIdea(idea.id, updates);
    return res.json(updated);
  });

  app.delete("/api/ideas/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const dbUser = await storage.getUser(req.session.userId);
    const effectiveRole = req.session.activeRole || dbUser?.role;
    if (!dbUser || effectiveRole !== "Admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const ideaId = req.params.id as string;
    const idea = await storage.getIdea(ideaId);
    if (!idea) {
      return res.status(404).json({ message: "Idea not found" });
    }
    await storage.createAuditLog({
      ideaId,
      userId: req.session.userId,
      userName: dbUser.displayName || "Unknown",
      userRole: req.session.activeRole || dbUser.role,
      action: "idea_deleted",
      fromStage: idea.stage,
      toStage: null,
      details: `Deleted idea "${idea.title}" (owned by ${idea.owner})`,
    });
    const deleted = await storage.deleteIdea(ideaId);
    if (!deleted) {
      return res.status(500).json({ message: "Failed to delete idea" });
    }
    return res.json({ success: true, message: "Idea deleted" });
  });

  app.post("/api/ideas/:id/evaluate-transition", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    const result = await evaluateTransition(
      req.params.id as string,
      req.session.userId,
      user?.displayName || "Unknown",
      req.session.activeRole || "Process SME"
    );
    return res.json(result);
  });

  app.post("/api/ideas/:id/advance-stage", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { stage } = req.body;
    if (!stage) {
      return res.status(400).json({ message: "Stage is required" });
    }
    const ideaId = req.params.id as string;
    const idea = await storage.getIdea(ideaId);
    if (!idea) {
      return res.status(404).json({ message: "Idea not found" });
    }
    const user = await storage.getUser(req.session.userId);
    const updated = await storage.updateIdeaStage(ideaId, stage);
    await storage.createAuditLog({
      ideaId,
      userId: req.session.userId,
      userName: user?.displayName || "Unknown",
      userRole: req.session.activeRole || "Process SME",
      action: "manual_stage_advance",
      fromStage: idea.stage,
      toStage: stage,
      details: req.body.reason || "Manual advancement",
    });
    return res.json(updated);
  });

  app.get("/api/audit-logs", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const ideaId = req.query.ideaId as string | undefined;
    const logs = await storage.getAuditLogs(ideaId);
    return res.json(logs);
  });

  app.get("/api/users", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const allUsers = await storage.getAllUsers();
    const safeUsers = allUsers.map(({ password, ...u }) => u);
    return res.json(safeUsers);
  });

  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const activeRole = req.session.activeRole;
    if (activeRole !== "Admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { role, displayName } = req.body;
    const updates: any = {};
    if (role) updates.role = role;
    if (displayName) updates.displayName = displayName;
    const updated = await storage.updateUser(req.params.id as string, updates);
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }
    const { password, ...safeUser } = updated;
    await storage.createAuditLog({
      ideaId: null,
      userId: req.session.userId,
      userName: (await storage.getUser(req.session.userId))?.displayName || "Unknown",
      userRole: activeRole,
      action: "user_updated",
      fromStage: null,
      toStage: null,
      details: `Updated user ${safeUser.email}: ${JSON.stringify(updates)}`,
    });
    return res.json(safeUser);
  });

  return httpServer;
}
