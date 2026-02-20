import { users, ideas, auditLogs, type User, type InsertUser, type Idea, type InsertIdea, type AuditLog, type InsertAuditLog } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<Omit<User, "id">>): Promise<User | undefined>;
  getIdea(id: string): Promise<Idea | undefined>;
  getAllIdeas(): Promise<Idea[]>;
  createIdea(idea: InsertIdea): Promise<Idea>;
  getIdeasByOwnerEmail(email: string): Promise<Idea[]>;
  updateIdeaStage(id: string, stage: string): Promise<Idea | undefined>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(ideaId?: string): Promise<AuditLog[]>;
}

export class DatabaseStorage implements IStorage {
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
}

export const storage = new DatabaseStorage();
