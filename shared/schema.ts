import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("Process SME"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type UserRole = "Process SME" | "CoE" | "Admin";

export const ROLES: UserRole[] = ["Process SME", "CoE", "Admin"];

export const PIPELINE_STAGES = [
  "Idea",
  "Feasibility Assessment",
  "Validated Backlog",
  "Design",
  "Build",
  "Test",
  "Governance / Security Scan",
  "CoE Approval",
  "Deploy",
  "Maintenance",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const ideas = pgTable("ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  owner: text("owner").notNull(),
  ownerEmail: text("owner_email").notNull(),
  stage: text("stage").notNull().default("Idea"),
  tag: text("tag"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type Idea = typeof ideas.$inferSelect;

export const createIdeaSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  owner: z.string().min(1, "Owner is required"),
  ownerEmail: z.string().email(),
  tag: z.string().optional().nullable(),
});

export * from "./models/chat";
export * from "./models/process-map";
export * from "./models/document";
export * from "./models/audit-log";
