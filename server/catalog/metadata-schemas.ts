import { z } from "zod";

export const studioTargetSchema = z.object({
  line: z.string(),
  version: z.string(),
  targetFramework: z.enum(["Windows", "Portable"]),
  projectType: z.enum(["Process", "Library", "TestAutomation"]),
  expressionLanguage: z.enum(["VisualBasic", "CSharp"]),
});

export const packageVersionRangeEntrySchema = z.object({
  min: z.string(),
  max: z.string(),
  preferred: z.string(),
  lastVerifiedAt: z.string().datetime(),
  verificationSource: z.string(),
});

export const generationMetadataSchema = z.object({
  studioTarget: studioTargetSchema,
  packageVersionRanges: z.record(z.string(), packageVersionRangeEntrySchema),
  minimumRequiredPackages: z.array(z.string()),
  lastRefreshedAt: z.string().datetime(),
  lastVerifiedAt: z.string().datetime(),
  sourceVersion: z.string(),
  snapshotVersion: z.string(),
});

export type StudioTarget = z.infer<typeof studioTargetSchema>;
export type PackageVersionRangeEntry = z.infer<typeof packageVersionRangeEntrySchema>;
export type GenerationMetadata = z.infer<typeof generationMetadataSchema>;

export const serviceEndpointEntrySchema = z.object({
  urlTemplate: z.string(),
  alternateUrlTemplates: z.array(z.string()).optional(),
  apiBasePath: z.string(),
  scopes: z.array(z.string()),
  confidence: z.enum(["official", "inferred", "deprecated"]),
  reachabilityStatus: z.enum(["reachable", "limited", "unreachable", "unknown"]),
  lastVerifiedAt: z.string().datetime(),
  verificationSource: z.string(),
  deprecationNotes: z.string().optional(),
});

export type ServiceResourceType = "OR" | "TM" | "DU" | "DF" | "PIMS" | "IXP" | "AI" | "HUB" | "IDENTITY" | "INTEGRATIONSERVICE" | "AUTOMATIONOPS" | "AUTOMATIONSTORE" | "APPS" | "ASSISTANT" | "AGENTS" | "AUTOPILOT" | "REINFER";

export const serviceEndpointsSchema = z.object({
  endpoints: z.record(z.string(), serviceEndpointEntrySchema),
  tokenEndpoint: z.string().url(),
  lastRefreshedAt: z.string().datetime(),
  lastVerifiedAt: z.string().datetime(),
  snapshotVersion: z.string(),
});

export type ServiceEndpointEntry = z.infer<typeof serviceEndpointEntrySchema>;
export type ServiceEndpoints = z.infer<typeof serviceEndpointsSchema>;
