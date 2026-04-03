import { users, ideas, auditLogs, uipathGenerationRuns, type User, type InsertUser, type Idea, type InsertIdea, type AuditLog, type InsertAuditLog, type UipathGenerationRun, type InsertUipathGenerationRun } from "@shared/schema";
import { appSettings } from "@shared/schema";
import type { GenerationRunStatus } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, sql, gte, lte, count, or, ilike } from "drizzle-orm";

export interface IStorage {
  getAppSetting(key: string): Promise<string | undefined>;
  setAppSetting(key: string, value: string): Promise<void>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<Omit<User, "id">>): Promise<User | undefined>;
  getIdea(id: string): Promise<Idea | undefined>;
  getAllIdeas(): Promise<Idea[]>;
  createIdea(idea: InsertIdea): Promise<Idea>;
  deleteIdea(id: string): Promise<boolean>;
  getIdeasByOwnerEmail(email: string): Promise<Idea[]>;
  updateIdeaStage(id: string, stage: string): Promise<Idea | undefined>;
  updateIdea(id: string, updates: Partial<Pick<Idea, "title" | "description" | "tag" | "automationType" | "automationTypeRationale" | "feasibilityComplexity" | "feasibilityEffortEstimate" | "agentConfig">>): Promise<Idea | undefined>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(ideaId?: string): Promise<AuditLog[]>;
  createGenerationRun(run: InsertUipathGenerationRun): Promise<UipathGenerationRun>;
  getGenerationRun(runId: string): Promise<UipathGenerationRun | undefined>;
  getLatestGenerationRunForIdea(ideaId: string): Promise<UipathGenerationRun | undefined>;
  updateGenerationRunStatus(runId: string, status: GenerationRunStatus | string, currentPhase?: string): Promise<UipathGenerationRun | undefined>;
  updateGenerationRunPhaseProgress(runId: string, phaseProgress: string): Promise<UipathGenerationRun | undefined>;
  updateGenerationRunSpecSnapshot(runId: string, specSnapshot: unknown): Promise<UipathGenerationRun | undefined>;
  completeGenerationRun(runId: string, updates: { status: string; outcomeReport?: string; dhgContent?: string; generationMode?: string }): Promise<UipathGenerationRun | undefined>;
  failGenerationRun(runId: string, errorMessage: string): Promise<UipathGenerationRun | undefined>;
  updateGenerationRunStageLog(runId: string, stageLog: unknown): Promise<UipathGenerationRun | undefined>;
  failOrphanedRuns(): Promise<UipathGenerationRun[]>;
  getGenerationRunsForIdea(ideaId: string): Promise<UipathGenerationRun[]>;
  listGenerationRuns(options: { offset?: number; limit?: number; status?: string; ideaId?: string; fromDate?: Date; toDate?: Date; search?: string }): Promise<{ runs: (UipathGenerationRun & { ideaTitle?: string })[]; total: number }>;
}

export class DatabaseStorage implements IStorage {
  async getAppSetting(key: string): Promise<string | undefined> {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return row?.value;
  }

  async setAppSetting(key: string, value: string): Promise<void> {
    const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    if (existing) {
      await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({ key, value });
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getIdea(id: string): Promise<Idea | undefined> {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
    return idea;
  }

  async getAllIdeas(): Promise<Idea[]> {
    return db.select().from(ideas).orderBy(desc(ideas.createdAt));
  }

  async createIdea(insertIdea: InsertIdea): Promise<Idea> {
    const [idea] = await db.insert(ideas).values(insertIdea).returning();
    return idea;
  }

  async deleteIdea(id: string): Promise<boolean> {
    const [deleted] = await db.delete(ideas).where(eq(ideas.id, id)).returning();
    return !!deleted;
  }

  async getIdeasByOwnerEmail(email: string): Promise<Idea[]> {
    return db.select().from(ideas).where(eq(ideas.ownerEmail, email)).orderBy(desc(ideas.createdAt));
  }

  async updateIdeaStage(id: string, stage: string): Promise<Idea | undefined> {
    const [updated] = await db
      .update(ideas)
      .set({ stage, updatedAt: new Date() })
      .where(eq(ideas.id, id))
      .returning();
    return updated;
  }

  async updateIdea(id: string, updates: Partial<Pick<Idea, "title" | "description" | "tag" | "automationType" | "automationTypeRationale" | "feasibilityComplexity" | "feasibilityEffortEstimate" | "agentConfig">>): Promise<Idea | undefined> {
    const [updated] = await db
      .update(ideas)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(ideas.id, id))
      .returning();
    return updated;
  }

  async updateUser(id: string, updates: Partial<Omit<User, "id">>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [entry] = await db.insert(auditLogs).values(log).returning();
    return entry;
  }

  async getAuditLogs(ideaId?: string): Promise<AuditLog[]> {
    if (ideaId) {
      return db.select().from(auditLogs).where(eq(auditLogs.ideaId, ideaId)).orderBy(desc(auditLogs.createdAt));
    }
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
  }

  async createGenerationRun(run: InsertUipathGenerationRun): Promise<UipathGenerationRun> {
    const [created] = await db.insert(uipathGenerationRuns).values(run).returning();
    return created;
  }

  async getGenerationRun(runId: string): Promise<UipathGenerationRun | undefined> {
    const [run] = await db.select().from(uipathGenerationRuns).where(eq(uipathGenerationRuns.runId, runId));
    return run;
  }

  async getLatestGenerationRunForIdea(ideaId: string): Promise<UipathGenerationRun | undefined> {
    const [run] = await db.select().from(uipathGenerationRuns)
      .where(eq(uipathGenerationRuns.ideaId, ideaId))
      .orderBy(desc(uipathGenerationRuns.createdAt))
      .limit(1);
    return run;
  }

  async getGenerationRunsForIdea(ideaId: string): Promise<UipathGenerationRun[]> {
    return db.select().from(uipathGenerationRuns)
      .where(eq(uipathGenerationRuns.ideaId, ideaId))
      .orderBy(uipathGenerationRuns.createdAt);
  }

  async updateGenerationRunStatus(runId: string, status: GenerationRunStatus | string, currentPhase?: string): Promise<UipathGenerationRun | undefined> {
    const updates: Record<string, any> = { status, updatedAt: new Date() };
    if (currentPhase !== undefined) updates.currentPhase = currentPhase;
    const [updated] = await db.update(uipathGenerationRuns)
      .set(updates)
      .where(
        and(
          eq(uipathGenerationRuns.runId, runId),
          isNull(uipathGenerationRuns.completedAt),
        )
      )
      .returning();
    return updated;
  }

  async updateGenerationRunPhaseProgress(runId: string, phaseProgress: string): Promise<UipathGenerationRun | undefined> {
    const [updated] = await db.update(uipathGenerationRuns)
      .set({ phaseProgress, updatedAt: new Date() })
      .where(eq(uipathGenerationRuns.runId, runId))
      .returning();
    return updated;
  }

  async updateGenerationRunSpecSnapshot(runId: string, specSnapshot: unknown): Promise<UipathGenerationRun | undefined> {
    const [updated] = await db
      .update(uipathGenerationRuns)
      .set({ specSnapshot, updatedAt: new Date() })
      .where(eq(uipathGenerationRuns.runId, runId))
      .returning();
    return updated;
  }

  async completeGenerationRun(runId: string, updates: { status: string; outcomeReport?: string; dhgContent?: string; generationMode?: string }): Promise<UipathGenerationRun | undefined> {
    const [updated] = await db.update(uipathGenerationRuns)
      .set({ ...updates, updatedAt: new Date(), completedAt: new Date() })
      .where(eq(uipathGenerationRuns.runId, runId))
      .returning();
    return updated;
  }

  async failGenerationRun(runId: string, errorMessage: string): Promise<UipathGenerationRun | undefined> {
    const [updated] = await db.update(uipathGenerationRuns)
      .set({ status: "failed", errorMessage, updatedAt: new Date(), completedAt: new Date() })
      .where(eq(uipathGenerationRuns.runId, runId))
      .returning();
    return updated;
  }

  async updateGenerationRunStageLog(runId: string, stageLog: unknown): Promise<UipathGenerationRun | undefined> {
    const [updated] = await db.update(uipathGenerationRuns)
      .set({ stageLog, updatedAt: new Date() })
      .where(eq(uipathGenerationRuns.runId, runId))
      .returning();
    return updated;
  }

  async failOrphanedRuns(): Promise<UipathGenerationRun[]> {
    const orphaned = await db.update(uipathGenerationRuns)
      .set({
        status: "failed",
        errorMessage: "orphaned_after_restart",
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(
        and(
          eq(uipathGenerationRuns.status, "running"),
          isNull(uipathGenerationRuns.completedAt),
        )
      )
      .returning();
    return orphaned;
  }

  async listGenerationRuns(options: { offset?: number; limit?: number; status?: string; ideaId?: string; fromDate?: Date; toDate?: Date; search?: string }): Promise<{ runs: (UipathGenerationRun & { ideaTitle?: string })[]; total: number }> {
    const conditions = [];
    if (options.status) conditions.push(eq(uipathGenerationRuns.status, options.status));
    if (options.ideaId) conditions.push(eq(uipathGenerationRuns.ideaId, options.ideaId));
    if (options.fromDate) conditions.push(gte(uipathGenerationRuns.createdAt, options.fromDate));
    if (options.toDate) conditions.push(lte(uipathGenerationRuns.createdAt, options.toDate));
    if (options.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(or(ilike(ideas.title, searchPattern), ilike(uipathGenerationRuns.runId, searchPattern)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total: totalCount }] = await db.select({ total: count() }).from(uipathGenerationRuns).leftJoin(ideas, eq(uipathGenerationRuns.ideaId, ideas.id)).where(whereClause);

    const rows = await db
      .select({
        run: uipathGenerationRuns,
        ideaTitle: ideas.title,
      })
      .from(uipathGenerationRuns)
      .leftJoin(ideas, eq(uipathGenerationRuns.ideaId, ideas.id))
      .where(whereClause)
      .orderBy(desc(uipathGenerationRuns.createdAt))
      .limit(options.limit ?? 25)
      .offset(options.offset ?? 0);

    const runs = rows.map(r => ({ ...r.run, ideaTitle: r.ideaTitle ?? undefined }));
    return { runs, total: totalCount };
  }
}

export const storage = new DatabaseStorage();
