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

export type TaxonomyCategory = "service" | "capability" | "product" | "observation" | "infrastructure";

export type TruthfulStatus =
  | "available"
  | "endpoint_failure"
  | "not_provisioned"
  | "auth_scope"
  | "unsupported_external_api"
  | "internal_probe_error"
  | "unknown";

export type ActionOwner = "uipath-admin" | "cannonball" | "user-config" | "not-actionable";

export type RemediationGuidance = {
  reason: string;
  actionOwner: ActionOwner;
  recommendedStep: string;
  technicalEvidence?: string;
};

export type ScopeDefinition = {
  id: string;
  description: string;
};

export type ServiceTaxonomyEntry = {
  flagKey: string;
  serviceResourceType: ServiceResourceType;
  displayName: string;
  category: TaxonomyCategory;
  parentService?: string;
  uiSection: "primary" | "secondary" | "infrastructure" | "observation";
  defaultRemediationTemplate?: Omit<RemediationGuidance, "technicalEvidence">;
  oauthScopeGroups?: Array<{
    groupLabel: string;
    scopes: ScopeDefinition[];
  }>;
};

export type TruthfulServiceStatus = {
  status: TruthfulStatus;
  displayLabel: string;
  confidence: "official" | "inferred" | "deprecated" | "unknown";
  evidence: string;
  remediation?: RemediationGuidance;
  httpStatus?: number;
  category: TaxonomyCategory;
  parentService?: string;
  displayName: string;
  flagKey: string;
};

export type ApiSupportLevel = "documented" | "undocumented" | "none";

export type ProbeStrategy = "own-endpoint" | "parent-api" | "observation" | "none";

export type ProbeConfig = {
  probePath: string;
  tokenResource?: "OR" | "TM" | "DU" | "PM" | "DF" | "PIMS" | "IXP" | "AI";
  useAlternates?: boolean;
  acceptLimitedAuth?: boolean;
};

export type CapabilityTaxonomyEntry = {
  flagKey: string;
  serviceResourceType: ServiceResourceType;
  displayName: string;
  description: string;
  category: "service" | "capability" | "product" | "observation";
  parentService?: string;
  apiSupport: ApiSupportLevel;
  probeStrategy: ProbeStrategy;
  probeConfig?: ProbeConfig;
  customProbeHandler?: string;
  secondaryProbePaths?: string[];
  inferredProbePath?: string;
  urlPathPatterns?: string[];
  scopeFamily?: string;
  minimalScopes?: string[];
  uiSection: "primary" | "secondary" | "infrastructure" | "observation";
  defaultRemediationTemplate?: Omit<RemediationGuidance, "technicalEvidence">;
  oauthScopeGroups?: Array<{
    groupLabel: string;
    scopes: ScopeDefinition[];
  }>;
};

export type OidcScopeFamily = {
  prefix: string;
  scopes: string[];
  mappedServiceResourceType?: ServiceResourceType;
};

export type OidcScopeSnapshot = {
  fetchedAt: string;
  source: string;
  scopeFamilies: Record<string, OidcScopeFamily>;
  rawScopesSupported: string[];
  isStale: boolean;
  staleSince?: string;
};

export const SCOPE_PREFIX_TO_SERVICE: Record<string, ServiceResourceType> = {
  OR: "OR",
  TM: "TM",
  AIC: "AI",
  Du: "DU",
  PM: "IDENTITY",
  DataFabric: "DF",
  DataService: "DF",
  Ixp: "IXP",
  IS: "INTEGRATIONSERVICE",
  PIMS: "PIMS",
  AI: "AI",
};
