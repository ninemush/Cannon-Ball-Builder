import { pgTable, serial, text, timestamp, varchar, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { ideas } from "../schema";

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  ideaId: varchar("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("draft"),
  content: text("content").notNull(),
  snapshotJson: text("snapshot_json").notNull().default("{}"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export const documentApprovals = pgTable("document_approvals", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  ideaId: varchar("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(),
  userId: varchar("user_id").notNull(),
  userRole: text("user_role").notNull(),
  userName: text("user_name").notNull(),
  approvedAt: timestamp("approved_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDocumentApprovalSchema = createInsertSchema(documentApprovals).omit({
  id: true,
  approvedAt: true,
});
export type DocumentApproval = typeof documentApprovals.$inferSelect;
export type InsertDocumentApproval = z.infer<typeof insertDocumentApprovalSchema>;
