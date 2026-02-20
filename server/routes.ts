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

  app.use(
    session({
      store: new PgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "cannonball-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  await seedDemoUsers();
  await seedDemoIdeas();

  registerChatRoutes(app);
  registerProcessMapRoutes(app);
  registerDocumentRoutes(app);

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
    const idea = await storage.getIdea(req.params.id);
    if (!idea) {
      return res.status(404).json({ message: "Idea not found" });
    }
    return res.json(idea);
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

  return httpServer;
}
