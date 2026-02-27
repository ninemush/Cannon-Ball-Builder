import { pgTable, serial, text, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const pipelineJobs = pgTable("pipeline_jobs", {
  id: serial("id").primaryKey(),
  ideaId: text("idea_id").notNull(),
  jobId: text("job_id").notNull().unique(),
  status: text("status").notNull().default("running"),
  currentStage: integer("current_stage").default(1),
  failedStage: text("failed_stage"),
  intent: text("intent"),
  agentName: text("agent_name"),
  processLink: text("process_link"),
  errorMessage: text("error_message"),
  stages: text("stages"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPipelineJobSchema = createInsertSchema(pipelineJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PipelineJob = typeof pipelineJobs.$inferSelect;
export type InsertPipelineJob = z.infer<typeof insertPipelineJobSchema>;

export const provisioningLog = pgTable("provisioning_log", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull(),
  processName: text("process_name"),
  decision: text("decision"),
  robotsDelta: integer("robots_delta"),
  reasoning: text("reasoning"),
  confidence: real("confidence"),
  executedAt: timestamp("executed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertProvisioningLogSchema = createInsertSchema(provisioningLog).omit({
  id: true,
  executedAt: true,
});
export type ProvisioningLogEntry = typeof provisioningLog.$inferSelect;
export type InsertProvisioningLog = z.infer<typeof insertProvisioningLogSchema>;

export const actionTasks = pgTable("action_tasks", {
  id: serial("id").primaryKey(),
  orchestratorTaskId: text("orchestrator_task_id").unique(),
  ideaId: text("idea_id"),
  status: text("status").default("pending"),
  routing: text("routing"),
  aiResolved: boolean("ai_resolved").default(false),
  resolutionReasoning: text("resolution_reasoning"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertActionTaskSchema = createInsertSchema(actionTasks).omit({
  id: true,
  createdAt: true,
});
export type ActionTask = typeof actionTasks.$inferSelect;
export type InsertActionTask = z.infer<typeof insertActionTaskSchema>;

export const testResults = pgTable("test_results", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull(),
  testSetId: text("test_set_id"),
  passed: integer("passed").default(0),
  failed: integer("failed").default(0),
  reportMarkdown: text("report_markdown"),
  aiDecision: text("ai_decision"),
  aiReasoning: text("ai_reasoning"),
  executedAt: timestamp("executed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTestResultSchema = createInsertSchema(testResults).omit({
  id: true,
  executedAt: true,
});
export type TestResult = typeof testResults.$inferSelect;
export type InsertTestResult = z.infer<typeof insertTestResultSchema>;
