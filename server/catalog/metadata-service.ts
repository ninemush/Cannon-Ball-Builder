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
} from "./metadata-schemas";
import { loadStudioProfile, type StudioProfile, type PackageVersionRange } from "./studio-profile";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
