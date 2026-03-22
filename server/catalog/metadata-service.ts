import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  generationMetadataSchema,
  serviceEndpointsSchema,
  type GenerationMetadata,
  type ServiceEndpoints,
  type StudioTarget,
  type PackageVersionRangeEntry,
  type ServiceEndpointEntry,
  type ServiceResourceType,
  type ServiceTaxonomyEntry,
  type TaxonomyCategory,
  type TruthfulStatus,
  type RemediationGuidance,
  type TruthfulServiceStatus,
} from "./metadata-schemas";
import { loadStudioProfile, type StudioProfile, type PackageVersionRange } from "./studio-profile";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const TRUTHFUL_STATUS_LABELS: Record<TruthfulStatus, string> = {
  available: "Available",
  endpoint_failure: "Unavailable (Not Reachable)",
  not_provisioned: "Unavailable (Service Not Provisioned)",
  auth_scope: "Unavailable (Authorization/Scope)",
  unsupported_external_api: "Unavailable (No External App API)",
  internal_probe_error: "Error (Probe Failed)",
  unknown: "Unknown (Not Verified)",
};

const FALLBACK_SERVICE_TAXONOMY: ServiceTaxonomyEntry[] = [
  {
    flagKey: "orchestrator", serviceResourceType: "OR", displayName: "Orchestrator",
    category: "service", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Core Orchestrator service is not accessible.", actionOwner: "user-config", recommendedStep: "Verify connection credentials and ensure the External Application has OR.Default scope." },
    oauthScopeGroups: [
      { groupLabel: "Orchestrator — Core", scopes: [
        { id: "OR.Default", description: "General Orchestrator access" },
        { id: "OR.Administration", description: "Administration" },
        { id: "OR.Folders", description: "Full folder access" },
        { id: "OR.Folders.Read", description: "Read folders" },
        { id: "OR.Execution", description: "Full execution access" },
      ]},
      { groupLabel: "Orchestrator — Jobs & Robots", scopes: [
        { id: "OR.Jobs", description: "Full job access" },
        { id: "OR.Jobs.Read", description: "Read jobs" },
        { id: "OR.Jobs.Write", description: "Write jobs" },
        { id: "OR.Robots", description: "Full robot access" },
        { id: "OR.Robots.Read", description: "Read robots" },
        { id: "OR.Machines", description: "Full machine access" },
      ]},
      { groupLabel: "Orchestrator — Queues & Assets", scopes: [
        { id: "OR.Queues", description: "Full queue access" },
        { id: "OR.Queues.Read", description: "Read queues" },
        { id: "OR.Queues.Write", description: "Write queues" },
        { id: "OR.Assets", description: "Full asset access" },
        { id: "OR.Assets.Read", description: "Read assets" },
        { id: "OR.Assets.Write", description: "Write assets" },
      ]},
      { groupLabel: "Orchestrator — Action Center & Storage", scopes: [
        { id: "OR.Tasks", description: "Full task access (Action Center)" },
        { id: "OR.Tasks.Read", description: "Read tasks" },
        { id: "OR.Tasks.Write", description: "Write tasks" },
        { id: "OR.Buckets", description: "Full storage bucket access" },
        { id: "OR.Buckets.Read", description: "Read storage buckets" },
        { id: "OR.Buckets.Write", description: "Write storage buckets" },
        { id: "OR.Triggers", description: "Full trigger access" },
        { id: "OR.Triggers.Read", description: "Read triggers" },
        { id: "OR.Triggers.Write", description: "Write triggers" },
      ]},
      { groupLabel: "Orchestrator — Advanced", scopes: [
        { id: "OR.Administration.Read", description: "Read administration data" },
        { id: "OR.Administration.Write", description: "Write administration data" },
        { id: "OR.Folders.Write", description: "Write folders" },
        { id: "OR.Execution.Read", description: "Read executions" },
        { id: "OR.Execution.Write", description: "Write executions" },
        { id: "OR.Robots.Write", description: "Write robots" },
        { id: "OR.Machines.Read", description: "Read machines" },
        { id: "OR.Machines.Write", description: "Write machines" },
        { id: "OR.Hypervisor", description: "Full hypervisor access" },
        { id: "OR.Hypervisor.Read", description: "Read hypervisor" },
        { id: "OR.Hypervisor.Write", description: "Write hypervisor" },
        { id: "OR.Settings", description: "Full settings access" },
        { id: "OR.Settings.Read", description: "Read settings" },
        { id: "OR.Settings.Write", description: "Write settings" },
        { id: "OR.Users", description: "Full user access" },
        { id: "OR.Users.Read", description: "Read users" },
        { id: "OR.Users.Write", description: "Write users" },
        { id: "OR.License", description: "Full license access" },
        { id: "OR.License.Read", description: "Read licenses" },
        { id: "OR.License.Write", description: "Write licenses" },
        { id: "OR.Monitoring", description: "Full monitoring access" },
        { id: "OR.Monitoring.Read", description: "Read monitoring" },
        { id: "OR.Monitoring.Write", description: "Write monitoring" },
        { id: "OR.Analytics", description: "Full analytics access" },
        { id: "OR.Analytics.Read", description: "Read analytics" },
        { id: "OR.Analytics.Write", description: "Write analytics" },
        { id: "OR.Audit", description: "Full audit access" },
        { id: "OR.Audit.Read", description: "Read audit logs" },
        { id: "OR.Audit.Write", description: "Write audit logs" },
        { id: "OR.Webhooks", description: "Full webhook access" },
        { id: "OR.Webhooks.Read", description: "Read webhooks" },
        { id: "OR.Webhooks.Write", description: "Write webhooks" },
        { id: "OR.ML", description: "Full ML access" },
        { id: "OR.ML.Read", description: "Read ML models" },
        { id: "OR.ML.Write", description: "Write ML models" },
        { id: "OR.BackgroundTasks", description: "Full background task access" },
        { id: "OR.BackgroundTasks.Read", description: "Read background tasks" },
        { id: "OR.BackgroundTasks.Write", description: "Write background tasks" },
        { id: "OR.TestSets", description: "Full test set access" },
        { id: "OR.TestSets.Read", description: "Read test sets" },
        { id: "OR.TestSets.Write", description: "Write test sets" },
        { id: "OR.TestSetExecutions", description: "Full test execution access" },
        { id: "OR.TestSetExecutions.Read", description: "Read test executions" },
        { id: "OR.TestSetExecutions.Write", description: "Write test executions" },
        { id: "OR.TestSetSchedules", description: "Full test schedule access" },
        { id: "OR.TestSetSchedules.Read", description: "Read test schedules" },
        { id: "OR.TestSetSchedules.Write", description: "Write test schedules" },
        { id: "OR.TestDataQueues", description: "Full test data queue access" },
        { id: "OR.TestDataQueues.Read", description: "Read test data queues" },
        { id: "OR.TestDataQueues.Write", description: "Write test data queues" },
        { id: "OR.AutomationSolutions.Access", description: "Automation Solutions access" },
      ]},
    ],
  },
  {
    flagKey: "actionCenter", serviceResourceType: "OR", displayName: "Action Center",
    category: "capability", parentService: "orchestrator", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Action Center is not enabled on this tenant.", actionOwner: "uipath-admin", recommendedStep: "Enable Action Center in UiPath Automation Cloud admin settings." },
  },
  {
    flagKey: "storageBuckets", serviceResourceType: "OR", displayName: "Storage Buckets",
    category: "capability", parentService: "orchestrator", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Storage Buckets feature is not accessible.", actionOwner: "uipath-admin", recommendedStep: "Create at least one Storage Bucket in Orchestrator." },
  },
  {
    flagKey: "environments", serviceResourceType: "OR", displayName: "Environments",
    category: "capability", parentService: "orchestrator", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Environments feature is not accessible.", actionOwner: "uipath-admin", recommendedStep: "Configure runtime environments in Orchestrator." },
  },
  {
    flagKey: "triggers", serviceResourceType: "OR", displayName: "Triggers",
    category: "capability", parentService: "orchestrator", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Triggers feature is not accessible.", actionOwner: "uipath-admin", recommendedStep: "Ensure queue triggers or process schedules are configured in Orchestrator." },
  },
  {
    flagKey: "testManager", serviceResourceType: "TM", displayName: "Test Manager",
    category: "service", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Test Manager is not available.", actionOwner: "uipath-admin", recommendedStep: "Add the TestManager resource with TM.* scopes to your External Application in UiPath Admin." },
    oauthScopeGroups: [
      { groupLabel: "Test Manager", scopes: [
        { id: "TM.TestCases", description: "Full test case access" },
        { id: "TM.TestCases.Read", description: "Read test cases" },
        { id: "TM.TestCases.Write", description: "Write test cases" },
        { id: "TM.TestSets", description: "Full test set access" },
        { id: "TM.TestSets.Read", description: "Read test sets" },
        { id: "TM.TestSets.Write", description: "Write test sets" },
        { id: "TM.TestExecutions", description: "Full test execution access" },
        { id: "TM.TestExecutions.Read", description: "Read test executions" },
        { id: "TM.Requirements", description: "Full requirements access" },
        { id: "TM.Projects", description: "Full project access" },
        { id: "TM.Projects.Read", description: "Read projects" },
        { id: "TM.Users.Read", description: "Read users" },
      ]},
    ],
  },
  {
    flagKey: "documentUnderstanding", serviceResourceType: "DU", displayName: "Document Understanding",
    category: "service", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Document Understanding is not available.", actionOwner: "uipath-admin", recommendedStep: "Add the UiPath.DocumentUnderstanding resource with Du.* scopes to your External Application." },
    oauthScopeGroups: [
      { groupLabel: "Document Understanding", scopes: [
        { id: "Du.Classification.Api", description: "Document classification" },
        { id: "Du.Digitization.Api", description: "Document digitization (OCR)" },
        { id: "Du.Extraction.Api", description: "Document data extraction" },
        { id: "Du.Validation.Api", description: "Document validation" },
        { id: "Du.DocumentManager.Document", description: "Document manager access" },
        { id: "Du.DataDeletion.Api", description: "Data deletion" },
      ]},
    ],
  },
  {
    flagKey: "generativeExtraction", serviceResourceType: "IXP", displayName: "Generative Extraction",
    category: "capability", parentService: "documentUnderstanding", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Generative Extraction is not available.", actionOwner: "uipath-admin", recommendedStep: "Enable IXP on your tenant and add the Ixp.ExternalService resource with Ixp.ApiAccess scope." },
  },
  {
    flagKey: "communicationsMining", serviceResourceType: "REINFER", displayName: "Communications Mining",
    category: "capability", parentService: "documentUnderstanding", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Communications Mining is not available.", actionOwner: "uipath-admin", recommendedStep: "Enable Communications Mining on your tenant and add the Ixp.ExternalService resource with Ixp.ApiAccess scope." },
  },
  {
    flagKey: "dataService", serviceResourceType: "DF", displayName: "Data Service",
    category: "service", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Data Service is not available.", actionOwner: "uipath-admin", recommendedStep: "Add the DataFabricOpenApi resource with DataFabric.* scopes to your External Application." },
    oauthScopeGroups: [
      { groupLabel: "Data Service", scopes: [
        { id: "DataFabric.Schema.Read", description: "Read data schemas" },
        { id: "DataFabric.Data.Read", description: "Read data entities" },
        { id: "DataFabric.Data.Write", description: "Write data entities" },
      ]},
    ],
  },
  {
    flagKey: "maestro", serviceResourceType: "PIMS", displayName: "Maestro",
    category: "service", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Maestro is not available.", actionOwner: "uipath-admin", recommendedStep: "Enable Maestro on your tenant and add the PIMS resource with PIMS.* scopes." },
    oauthScopeGroups: [
      { groupLabel: "Maestro", scopes: [
        { id: "PIMS.Default", description: "General Maestro access" },
        { id: "PIMS.Read", description: "Read Maestro data" },
        { id: "PIMS.Write", description: "Write Maestro data" },
        { id: "PIMS.Process", description: "Full process access" },
        { id: "PIMS.Process.Read", description: "Read processes" },
        { id: "PIMS.Process.Write", description: "Write processes" },
        { id: "PIMS.Execution", description: "Full execution access" },
        { id: "PIMS.Execution.Read", description: "Read executions" },
      ]},
    ],
  },
  {
    flagKey: "aiCenter", serviceResourceType: "AI", displayName: "AI Center",
    category: "service", uiSection: "primary",
    defaultRemediationTemplate: { reason: "AI Center is not available.", actionOwner: "uipath-admin", recommendedStep: "Add the UiPath.AICenter resource with AI.Deployer.Read scope to your External Application in UiPath Admin." },
    oauthScopeGroups: [
      { groupLabel: "AI Center", scopes: [
        { id: "AI.Deployer.Read", description: "Read AI deployments and skills" },
        { id: "AI.Deployer.Write", description: "Write AI deployments and skills" },
        { id: "AI.Trainer.Read", description: "Read AI training pipelines" },
        { id: "AI.Trainer.Write", description: "Write AI training pipelines" },
        { id: "AI.Helper.Read", description: "Read AI helper data" },
      ]},
    ],
  },
  {
    flagKey: "agents", serviceResourceType: "AGENTS", displayName: "Agents",
    category: "service", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Agents service is not available.", actionOwner: "uipath-admin", recommendedStep: "Enable Agent Builder in UiPath Automation Cloud and add the ConversationalAgents resource to your External Application." },
  },
  {
    flagKey: "autopilot", serviceResourceType: "AUTOPILOT", displayName: "Autopilot",
    category: "capability", parentService: "agents", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Autopilot capability is not available.", actionOwner: "uipath-admin", recommendedStep: "Enable Autopilot in Agent Builder settings." },
  },
  {
    flagKey: "automationHub", serviceResourceType: "HUB", displayName: "Automation Hub",
    category: "service", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Automation Hub is not available.", actionOwner: "uipath-admin", recommendedStep: "Enable Automation Hub on your tenant. Note: Automation Hub uses its own OAuth token, separate from the External Application." },
  },
  {
    flagKey: "integrationService", serviceResourceType: "INTEGRATIONSERVICE", displayName: "Integration Service",
    category: "service", uiSection: "primary",
    defaultRemediationTemplate: { reason: "Integration Service does not support External Application OAuth access. The probe endpoint (/api/Connections) requires session-based authentication that External Applications cannot provide.", actionOwner: "not-actionable", recommendedStep: "Integration Service connectors are discovered opportunistically but cannot be managed via External Application OAuth. No user action is available." },
  },
  {
    flagKey: "automationOps", serviceResourceType: "AUTOMATIONOPS", displayName: "Automation Ops",
    category: "service", uiSection: "secondary",
    defaultRemediationTemplate: { reason: "Automation Ops is not available. The probe endpoint (/api/v1/policies) returned a non-success response.", actionOwner: "uipath-admin", recommendedStep: "Enable Automation Ops on your tenant. Governance policies are accessed via Platform Management token (PM.* scopes). Ensure the External Application has PM.Security and PM.AuthSetting scopes." },
  },
  {
    flagKey: "automationStore", serviceResourceType: "AUTOMATIONSTORE", displayName: "Automation Store",
    category: "service", uiSection: "secondary",
    defaultRemediationTemplate: { reason: "Automation Store does not have a documented External Application API. The probe endpoint (/api/v1/) is not accessible with External Application tokens.", actionOwner: "not-actionable", recommendedStep: "Automation Store does not support External Application API access. No user action is available." },
  },
  {
    flagKey: "apps", serviceResourceType: "APPS", displayName: "Apps",
    category: "service", uiSection: "secondary",
    defaultRemediationTemplate: { reason: "UiPath Apps does not have a documented External Application API. The probe endpoint (/api/v1/apps) is not accessible with External Application tokens.", actionOwner: "not-actionable", recommendedStep: "UiPath Apps does not support External Application API access. No user action is available." },
  },
  {
    flagKey: "assistant", serviceResourceType: "ASSISTANT", displayName: "Assistant",
    category: "service", uiSection: "secondary",
    defaultRemediationTemplate: { reason: "UiPath Assistant is a desktop client without a documented cloud API for External Applications.", actionOwner: "not-actionable", recommendedStep: "UiPath Assistant is primarily a desktop application. No External Application API is available." },
  },
  {
    flagKey: "platformManagement", serviceResourceType: "IDENTITY", displayName: "Platform Management",
    category: "infrastructure", uiSection: "infrastructure",
    defaultRemediationTemplate: { reason: "Platform Management is not accessible.", actionOwner: "user-config", recommendedStep: "Add the PlatformManagement resource with PM.* scopes to your External Application." },
    oauthScopeGroups: [
      { groupLabel: "Platform Management", scopes: [
        { id: "PM.Security", description: "Security settings" },
        { id: "PM.AuthSetting", description: "Auth settings" },
        { id: "PM.OAuthApp", description: "OAuth application management" },
        { id: "PM.RobotAccount", description: "Robot account access" },
        { id: "PM.RobotAccount.Read", description: "Read robot accounts" },
        { id: "PM.RobotAccount.Write", description: "Write robot accounts" },
      ]},
    ],
  },
  {
    flagKey: "ixp", serviceResourceType: "IXP", displayName: "IXP Platform",
    category: "infrastructure", uiSection: "infrastructure",
    defaultRemediationTemplate: { reason: "IXP platform is not accessible.", actionOwner: "uipath-admin", recommendedStep: "Add the Ixp.ExternalService resource with Ixp.ApiAccess scope." },
    oauthScopeGroups: [
      { groupLabel: "IXP / Communications Mining", scopes: [
        { id: "Ixp.ApiAccess", description: "IXP API access (Generative Extraction, Communications Mining)" },
      ]},
    ],
  },
  {
    flagKey: "attendedRobots", serviceResourceType: "OR", displayName: "Attended Robots",
    category: "observation", uiSection: "observation",
  },
  {
    flagKey: "studioProjects", serviceResourceType: "OR", displayName: "Studio Projects",
    category: "observation", uiSection: "observation",
  },
  {
    flagKey: "hasUnattendedSlots", serviceResourceType: "OR", displayName: "Unattended Slots",
    category: "observation", uiSection: "observation",
  },
];

class MetadataService {
  private generationMetadata: GenerationMetadata | null = null;
  private serviceEndpoints: ServiceEndpoints | null = null;
  private legacyProfile: StudioProfile | null = null;
  private generationLoaded = false;
  private integrationLoaded = false;
  private activityCatalogLoaded = false;
  private activityCatalogPath: string | null = null;
  private activityCatalogData: any = null;
  private loadError: string | null = null;
  private lastGenRefreshSuccess: string | null = null;
  private lastGenRefreshFailure: string | null = null;
  private lastIntRefreshSuccess: string | null = null;
  private lastIntRefreshFailure: string | null = null;

  load(): void {
    this.loadGeneration();
    this.loadIntegration();
    this.loadActivityCatalogMetadata();
    this.checkFreshness();
    this.logStatus();
  }

  private loadGeneration(): void {
    const genPath = join(process.cwd(), "catalog", "generation-metadata.json");

    if (existsSync(genPath)) {
      try {
        const raw = readFileSync(genPath, "utf-8");
        const parsed = JSON.parse(raw);
        const result = generationMetadataSchema.safeParse(parsed);

        if (result.success) {
          this.generationMetadata = result.data;
          this.generationLoaded = true;
          console.log(`[MetadataService] Loaded generation-metadata.json: Studio ${result.data.studioTarget.version}, ${Object.keys(result.data.packageVersionRanges).length} packages`);
          return;
        } else {
          const errors = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
          console.warn(`[MetadataService] generation-metadata.json validation failed: ${errors} — falling back to studio-profile.json`);
        }
      } catch (err: any) {
        console.warn(`[MetadataService] Failed to load generation-metadata.json: ${err.message} — falling back to studio-profile.json`);
      }
    }

    this.legacyProfile = loadStudioProfile();
    if (this.legacyProfile) {
      this.generationLoaded = true;
      console.log(`[MetadataService] Using legacy studio-profile.json: Studio ${this.legacyProfile.studioVersion}`);
    }
  }

  private loadIntegration(): void {
    const epPath = join(process.cwd(), "catalog", "service-endpoints.json");

    if (existsSync(epPath)) {
      try {
        const raw = readFileSync(epPath, "utf-8");
        const parsed = JSON.parse(raw);
        const result = serviceEndpointsSchema.safeParse(parsed);

        if (result.success) {
          this.serviceEndpoints = result.data;
          this.integrationLoaded = true;
          console.log(`[MetadataService] Loaded service-endpoints.json: ${Object.keys(result.data.endpoints).length} endpoints`);
          return;
        } else {
          const errors = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
          console.warn(`[MetadataService] service-endpoints.json validation failed: ${errors} — using hardcoded fallbacks`);
        }
      } catch (err: any) {
        console.warn(`[MetadataService] Failed to load service-endpoints.json: ${err.message} — using hardcoded fallbacks`);
      }
    }

    this.integrationLoaded = false;
  }

  private loadActivityCatalogMetadata(): void {
    const catalogPath = join(process.cwd(), "catalog", "activity-catalog.json");
    if (existsSync(catalogPath)) {
      this.activityCatalogPath = catalogPath;
      try {
        const raw = readFileSync(catalogPath, "utf-8");
        this.activityCatalogData = JSON.parse(raw);
        this.activityCatalogLoaded = true;
      } catch (err: any) {
        console.warn(`[MetadataService] Failed to parse activity-catalog.json: ${err.message}`);
        this.activityCatalogData = null;
        this.activityCatalogLoaded = false;
      }
    } else {
      console.warn("[MetadataService] activity-catalog.json not found — activity catalog will be unavailable");
      this.activityCatalogLoaded = false;
    }
  }

  getActivityCatalogPath(): string | null {
    return this.activityCatalogPath;
  }

  getActivityCatalogData(): any {
    return this.activityCatalogData;
  }

  isActivityCatalogAvailable(): boolean {
    return this.activityCatalogLoaded;
  }

  reloadActivityCatalog(): void {
    this.activityCatalogData = null;
    this.activityCatalogLoaded = false;
    this.activityCatalogPath = null;
    this.loadActivityCatalogMetadata();
  }

  reload(family: "generation" | "integration" | "both"): void {
    if (family === "generation" || family === "both") {
      this.generationMetadata = null;
      this.legacyProfile = null;
      this.generationLoaded = false;
      this.loadGeneration();
    }
    if (family === "integration" || family === "both") {
      this.serviceEndpoints = null;
      this.integrationLoaded = false;
      this.loadIntegration();
    }
    this.logStatus();
  }

  private checkFreshness(): void {
    const now = Date.now();

    if (this.generationMetadata) {
      const age = now - new Date(this.generationMetadata.lastRefreshedAt).getTime();
      if (age > THIRTY_DAYS_MS) {
        console.error(`[MetadataService] ERROR: generation-metadata.json is ${Math.floor(age / (24 * 60 * 60 * 1000))} days old (>30 days). Metadata may be severely outdated.`);
      } else if (age > SEVEN_DAYS_MS) {
        console.warn(`[MetadataService] WARNING: generation-metadata.json is ${Math.floor(age / (24 * 60 * 60 * 1000))} days old (>7 days). Consider refreshing.`);
      }
    }

    if (this.serviceEndpoints) {
      const age = now - new Date(this.serviceEndpoints.lastRefreshedAt).getTime();
      if (age > THIRTY_DAYS_MS) {
        console.error(`[MetadataService] ERROR: service-endpoints.json is ${Math.floor(age / (24 * 60 * 60 * 1000))} days old (>30 days). Endpoints may be severely outdated.`);
      } else if (age > SEVEN_DAYS_MS) {
        console.warn(`[MetadataService] WARNING: service-endpoints.json is ${Math.floor(age / (24 * 60 * 60 * 1000))} days old (>7 days). Consider refreshing.`);
      }
    }
  }

  private logStatus(): void {
    const target = this.getStudioTarget();
    if (target) {
      console.log(`[MetadataService] Studio target: ${target.version} (${target.targetFramework}/${target.expressionLanguage})`);
    }
    const pkgCount = this.generationMetadata
      ? Object.keys(this.generationMetadata.packageVersionRanges).length
      : (this.legacyProfile ? Object.keys(this.legacyProfile.allowedPackageVersionRanges).length : 0);
    const epCount = this.serviceEndpoints ? Object.keys(this.serviceEndpoints.endpoints).length : 0;
    console.log(`[MetadataService] Status: ${pkgCount} package ranges, ${epCount} service endpoints, activity catalog: ${this.activityCatalogLoaded ? "available" : "not found"}`);
  }

  getStudioTarget(): StudioTarget | null {
    if (this.generationMetadata) {
      return this.generationMetadata.studioTarget;
    }
    if (this.legacyProfile) {
      return {
        line: this.legacyProfile.studioLine,
        version: this.legacyProfile.studioVersion,
        targetFramework: this.legacyProfile.targetFramework,
        projectType: this.legacyProfile.projectType,
        expressionLanguage: this.legacyProfile.expressionLanguage,
      };
    }
    return null;
  }

  getStudioProfile(): StudioProfile | null {
    if (this.generationMetadata) {
      const ranges: Record<string, PackageVersionRange> = {};
      for (const [pkg, entry] of Object.entries(this.generationMetadata.packageVersionRanges)) {
        ranges[pkg] = { min: entry.min, max: entry.max, preferred: entry.preferred };
      }
      return {
        studioLine: this.generationMetadata.studioTarget.line,
        studioVersion: this.generationMetadata.studioTarget.version,
        targetFramework: this.generationMetadata.studioTarget.targetFramework,
        projectType: this.generationMetadata.studioTarget.projectType,
        expressionLanguage: this.generationMetadata.studioTarget.expressionLanguage,
        allowedPackageVersionRanges: ranges,
        minimumRequiredPackages: this.generationMetadata.minimumRequiredPackages,
      };
    }
    return this.legacyProfile;
  }

  getPackageVersionRange(pkgName: string): PackageVersionRangeEntry | null {
    if (this.generationMetadata) {
      return this.generationMetadata.packageVersionRanges[pkgName] || null;
    }
    if (this.legacyProfile) {
      const range = this.legacyProfile.allowedPackageVersionRanges[pkgName];
      if (range) {
        return {
          ...range,
          lastVerifiedAt: "unknown",
          verificationSource: "legacy-profile",
        };
      }
    }
    return null;
  }

  getPreferredVersion(pkgName: string): string | null {
    const range = this.getPackageVersionRange(pkgName);
    return range?.preferred || null;
  }

  private resolvedServiceUrls: Partial<Record<ServiceResourceType, string>> = {};
  private inMemoryReachability: Partial<Record<ServiceResourceType, "reachable" | "limited" | "unreachable" | "unknown">> = {};

  getServiceUrl(resourceType: ServiceResourceType, config: { orgName: string; tenantName: string }): string {
    const resolved = this.resolvedServiceUrls[resourceType];
    if (resolved) {
      return resolved
        .replace("{orgName}", config.orgName)
        .replace("{tenantName}", config.tenantName);
    }
    if (this.serviceEndpoints?.endpoints[resourceType]) {
      const entry = this.serviceEndpoints.endpoints[resourceType];
      return entry.urlTemplate
        .replace("{orgName}", config.orgName)
        .replace("{tenantName}", config.tenantName);
    }
    return this.getHardcodedServiceUrl(resourceType, config);
  }

  getServiceUrlAlternates(resourceType: ServiceResourceType, config: { orgName: string; tenantName: string }): string[] {
    const primary = this.getServiceUrl(resourceType, config);
    const urls = [primary];
    if (this.serviceEndpoints?.endpoints[resourceType]) {
      const entry = this.serviceEndpoints.endpoints[resourceType];
      if (entry.alternateUrlTemplates) {
        for (const alt of entry.alternateUrlTemplates) {
          const resolved = alt
            .replace("{orgName}", config.orgName)
            .replace("{tenantName}", config.tenantName);
          if (!urls.includes(resolved)) {
            urls.push(resolved);
          }
        }
      }
    }
    return urls;
  }

  setResolvedServiceUrl(resourceType: ServiceResourceType, url: string): void {
    this.resolvedServiceUrls[resourceType] = url;
  }

  updateServiceReachability(resourceType: ServiceResourceType, status: "reachable" | "limited" | "unreachable" | "unknown"): void {
    this.inMemoryReachability[resourceType] = status;
  }

  private getHardcodedServiceUrl(resourceType: ServiceResourceType, config: { orgName: string; tenantName: string }): string {
    const base = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}`;
    const map: Record<string, string> = {
      OR: `${base}/orchestrator_`,
      TM: `${base}/testmanager_`,
      DU: `${base}/du_`,
      DF: `${base}/dataservice_`,
      PIMS: `${base}/maestro_`,
      IXP: `${base}/ixp_`,
      AI: `${base}/aifabric_`,
      HUB: `${base}/automationhub_`,
      IDENTITY: `https://cloud.uipath.com/identity_`,
      INTEGRATIONSERVICE: `${base}/integrationservice_`,
      AUTOMATIONOPS: `${base}/automationops_`,
      AUTOMATIONSTORE: `${base}/automationstore_`,
      APPS: `${base}/apps_`,
      ASSISTANT: `${base}/assistant_`,
      AGENTS: `${base}/agentstudio_`,
      AUTOPILOT: `${base}/autopilot_`,
      REINFER: `${base}/reinfer_`,
    };
    return map[resourceType] || `${base}/${resourceType.toLowerCase()}_`;
  }

  getServiceScopes(resourceType: ServiceResourceType): string[] {
    if (this.serviceEndpoints?.endpoints[resourceType]) {
      return this.serviceEndpoints.endpoints[resourceType].scopes;
    }
    return [];
  }

  getServiceScopesString(resourceType: ServiceResourceType): string {
    return this.getServiceScopes(resourceType).join(" ");
  }

  getServiceConfidence(resourceType: ServiceResourceType): "official" | "inferred" | "deprecated" | "unknown" {
    if (this.serviceEndpoints?.endpoints[resourceType]) {
      return this.serviceEndpoints.endpoints[resourceType].confidence;
    }
    return "unknown";
  }

  getServiceReachability(resourceType: ServiceResourceType): "reachable" | "limited" | "unreachable" | "unknown" {
    const inMem = this.inMemoryReachability[resourceType];
    if (inMem) return inMem;
    if (this.serviceEndpoints?.endpoints[resourceType]) {
      return this.serviceEndpoints.endpoints[resourceType].reachabilityStatus;
    }
    return "unknown";
  }

  clearReachability(): void {
    this.inMemoryReachability = {};
    this.resolvedServiceUrls = {};
  }

  private resolvedTaxonomy(): ServiceTaxonomyEntry[] {
    if (this.serviceEndpoints?.taxonomy && this.serviceEndpoints.taxonomy.length > 0) {
      return this.serviceEndpoints.taxonomy as ServiceTaxonomyEntry[];
    }
    return FALLBACK_SERVICE_TAXONOMY;
  }

  getServiceTaxonomy(): ServiceTaxonomyEntry[] {
    return this.resolvedTaxonomy();
  }

  getTaxonomyEntry(flagKey: string): ServiceTaxonomyEntry | null {
    return this.resolvedTaxonomy().find(e => e.flagKey === flagKey) || null;
  }

  getTaxonomyByCategory(category: TaxonomyCategory): ServiceTaxonomyEntry[] {
    return this.resolvedTaxonomy().filter(e => e.category === category);
  }

  getTaxonomyHierarchy(): {
    services: ServiceTaxonomyEntry[];
    capabilities: (ServiceTaxonomyEntry & { parentEntry?: ServiceTaxonomyEntry })[];
    observations: ServiceTaxonomyEntry[];
    infrastructure: ServiceTaxonomyEntry[];
  } {
    const taxonomy = this.resolvedTaxonomy();
    const services = taxonomy.filter(e => e.category === "service");
    const capabilities = taxonomy.filter(e => e.category === "capability").map(cap => ({
      ...cap,
      parentEntry: taxonomy.find(s => s.flagKey === cap.parentService),
    }));
    const observations = taxonomy.filter(e => e.category === "observation");
    const infrastructure = taxonomy.filter(e => e.category === "infrastructure");
    return { services, capabilities, observations, infrastructure };
  }

  getFlagToServiceType(): Record<string, ServiceResourceType> {
    const map: Record<string, ServiceResourceType> = {};
    for (const entry of this.resolvedTaxonomy()) {
      map[entry.flagKey] = entry.serviceResourceType;
    }
    return map;
  }

  getDisplayName(flagKey: string): string {
    const entry = this.getTaxonomyEntry(flagKey);
    return entry?.displayName || flagKey;
  }

  getTruthfulStatusLabel(status: TruthfulStatus): string {
    return TRUTHFUL_STATUS_LABELS[status] || status;
  }

  deriveTruthfulStatus(
    flagKey: string,
    isAvailable: boolean,
    httpStatus?: number | null,
    probeError?: string | null,
  ): TruthfulStatus {
    const entry = this.getTaxonomyEntry(flagKey);
    if (!entry) return "unknown";

    const confidence = this.getServiceConfidence(entry.serviceResourceType);

    if (isAvailable) return "available";

    if (!isAvailable) {
      const unsupportedExternalApiServices = new Set([
        "integrationService", "automationStore", "apps", "assistant",
      ]);
      if (unsupportedExternalApiServices.has(flagKey)) {
        return "unsupported_external_api";
      }

      if (httpStatus === 401 || httpStatus === 403) return "auth_scope";
      if (httpStatus === 404) return "not_provisioned";
      if (httpStatus && httpStatus >= 500) return "endpoint_failure";

      if (probeError) {
        if (probeError.includes("not provisioned") || probeError.includes("missing scopes")) {
          return "not_provisioned";
        }
        return "internal_probe_error";
      }

      if (httpStatus === null || httpStatus === undefined) {
        if (confidence === "inferred") return "unknown";
        return "endpoint_failure";
      }
      return "unknown";
    }

    return "unknown";
  }

  buildRemediationGuidance(
    flagKey: string,
    status: TruthfulStatus,
    httpStatus?: number | null,
    endpoint?: string,
    errorMessage?: string,
  ): RemediationGuidance | undefined {
    if (status === "available") return undefined;

    const entry = this.getTaxonomyEntry(flagKey);
    if (!entry) return undefined;

    const template = entry.defaultRemediationTemplate;
    const evidence: string[] = [];
    if (httpStatus) evidence.push(`HTTP ${httpStatus}`);
    if (endpoint) evidence.push(`Endpoint: ${endpoint}`);
    if (errorMessage) evidence.push(errorMessage);

    if (template) {
      return {
        ...template,
        technicalEvidence: evidence.length > 0 ? evidence.join(" | ") : undefined,
      };
    }

    const defaultReasons: Record<TruthfulStatus, string> = {
      available: "",
      endpoint_failure: "Service endpoint could not be reached. This may be temporary.",
      not_provisioned: "This service is not enabled on your tenant.",
      auth_scope: "Your app credentials don't have permission for this service.",
      unsupported_external_api: "This service does not support External Application API access.",
      internal_probe_error: "An internal error occurred while probing this service.",
      unknown: "This service hasn't been verified yet.",
    };

    return {
      reason: defaultReasons[status] || "Service status could not be determined.",
      actionOwner: "not-actionable",
      recommendedStep: "Run a connection test to check availability.",
      technicalEvidence: evidence.length > 0 ? evidence.join(" | ") : undefined,
    };
  }

  getTokenEndpoint(): string {
    if (this.serviceEndpoints) {
      return this.serviceEndpoints.tokenEndpoint;
    }
    return "https://cloud.uipath.com/identity_/connect/token";
  }

  getCloudBaseUrl(config: { orgName: string; tenantName: string }): string {
    return `https://cloud.uipath.com/${config.orgName}/${config.tenantName}`;
  }

  getStatus(): {
    generation: {
      loaded: boolean;
      source: "generation-metadata" | "legacy-profile" | "none";
      studioTarget: StudioTarget | null;
      packageCount: number;
      lastRefreshedAt: string | null;
      lastVerifiedAt: string | null;
      stalenessLevel: "fresh" | "stale" | "critical" | "unknown";
      lastRefreshSuccessAt: string | null;
      lastRefreshFailureAt: string | null;
      packages: Record<string, { preferred: string; min: string; max: string; lastVerifiedAt: string; verificationSource: string }>;
    };
    integration: {
      loaded: boolean;
      endpointCount: number;
      lastRefreshedAt: string | null;
      lastVerifiedAt: string | null;
      stalenessLevel: "fresh" | "stale" | "critical" | "unknown";
      lastRefreshSuccessAt: string | null;
      lastRefreshFailureAt: string | null;
      endpoints: Record<string, { confidence: string; reachabilityStatus: string; lastVerifiedAt: string }>;
    };
  } {
    const now = Date.now();

    let genStaleness: "fresh" | "stale" | "critical" | "unknown" = "unknown";
    let genLastRefreshed: string | null = null;
    let genLastVerified: string | null = null;
    let genSource: "generation-metadata" | "legacy-profile" | "none" = "none";

    if (this.generationMetadata) {
      genSource = "generation-metadata";
      genLastRefreshed = this.generationMetadata.lastRefreshedAt;
      genLastVerified = this.generationMetadata.lastVerifiedAt;
      const age = now - new Date(genLastRefreshed).getTime();
      genStaleness = age > THIRTY_DAYS_MS ? "critical" : age > SEVEN_DAYS_MS ? "stale" : "fresh";
    } else if (this.legacyProfile) {
      genSource = "legacy-profile";
    }

    let intStaleness: "fresh" | "stale" | "critical" | "unknown" = "unknown";
    let intLastRefreshed: string | null = null;
    let intLastVerified: string | null = null;
    const endpointDetails: Record<string, { confidence: string; reachabilityStatus: string; lastVerifiedAt: string }> = {};

    if (this.serviceEndpoints) {
      intLastRefreshed = this.serviceEndpoints.lastRefreshedAt;
      intLastVerified = this.serviceEndpoints.lastVerifiedAt;
      const age = now - new Date(intLastRefreshed).getTime();
      intStaleness = age > THIRTY_DAYS_MS ? "critical" : age > SEVEN_DAYS_MS ? "stale" : "fresh";
      for (const [key, ep] of Object.entries(this.serviceEndpoints.endpoints)) {
        endpointDetails[key] = {
          confidence: ep.confidence,
          reachabilityStatus: ep.reachabilityStatus,
          lastVerifiedAt: ep.lastVerifiedAt,
        };
      }
    }

    const packageDetails: Record<string, { preferred: string; min: string; max: string; lastVerifiedAt: string; verificationSource: string }> = {};
    if (this.generationMetadata) {
      for (const [pkg, entry] of Object.entries(this.generationMetadata.packageVersionRanges)) {
        packageDetails[pkg] = {
          preferred: entry.preferred,
          min: entry.min,
          max: entry.max,
          lastVerifiedAt: entry.lastVerifiedAt,
          verificationSource: entry.verificationSource,
        };
      }
    }

    return {
      generation: {
        loaded: this.generationLoaded,
        source: genSource,
        studioTarget: this.getStudioTarget(),
        packageCount: this.generationMetadata
          ? Object.keys(this.generationMetadata.packageVersionRanges).length
          : (this.legacyProfile ? Object.keys(this.legacyProfile.allowedPackageVersionRanges).length : 0),
        lastRefreshedAt: genLastRefreshed,
        lastVerifiedAt: genLastVerified,
        stalenessLevel: genStaleness,
        lastRefreshSuccessAt: this.lastGenRefreshSuccess,
        lastRefreshFailureAt: this.lastGenRefreshFailure,
        packages: packageDetails,
      },
      integration: {
        loaded: this.integrationLoaded,
        endpointCount: this.serviceEndpoints ? Object.keys(this.serviceEndpoints.endpoints).length : 0,
        lastRefreshedAt: intLastRefreshed,
        lastVerifiedAt: intLastVerified,
        stalenessLevel: intStaleness,
        lastRefreshSuccessAt: this.lastIntRefreshSuccess,
        lastRefreshFailureAt: this.lastIntRefreshFailure,
        endpoints: endpointDetails,
      },
    };
  }

  isGenerationLoaded(): boolean {
    return this.generationLoaded;
  }

  isIntegrationLoaded(): boolean {
    return this.integrationLoaded;
  }

  recordRefreshResult(family: "generation" | "integration", success: boolean): void {
    const now = new Date().toISOString();
    if (family === "generation") {
      if (success) this.lastGenRefreshSuccess = now;
      else this.lastGenRefreshFailure = now;
    } else {
      if (success) this.lastIntRefreshSuccess = now;
      else this.lastIntRefreshFailure = now;
    }
  }

  getGenerationMetadataRaw(): GenerationMetadata | null {
    return this.generationMetadata;
  }

  getServiceEndpointsRaw(): ServiceEndpoints | null {
    return this.serviceEndpoints;
  }
}

export const metadataService = new MetadataService();
