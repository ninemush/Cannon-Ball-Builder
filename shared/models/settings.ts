import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAppSettingSchema = createInsertSchema(appSettings).omit({ id: true, updatedAt: true });
export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
export type AppSetting = typeof appSettings.$inferSelect;

export const uipathConnections = pgTable("uipath_connections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  orgName: text("org_name").notNull(),
  tenantName: text("tenant_name").notNull(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  scopes: text("scopes").notNull().default("OR.Default OR.Administration"),
  folderId: text("folder_id"),
  folderName: text("folder_name"),
  automationHubToken: text("automation_hub_token"),
  isActive: boolean("is_active").notNull().default(false),
  lastTestedAt: timestamp("last_tested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUipathConnectionSchema = createInsertSchema(uipathConnections).omit({
  id: true,
  isActive: true,
  lastTestedAt: true,
  createdAt: true,
});
export type InsertUipathConnection = z.infer<typeof insertUipathConnectionSchema>;
export type UipathConnection = typeof uipathConnections.$inferSelect;
