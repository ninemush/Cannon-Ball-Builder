import { db } from "./db";
import { appSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export class UiPathAuthError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "UiPathAuthError";
  }
}

export type UiPathAuthConfig = {
  orgName: string;
  tenantName: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  folderId?: string;
  folderName?: string;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

export type ResourceType = "OR" | "TM" | "DU" | "PM" | "DF";

const TOKEN_REFRESH_BUFFER_MS = 60_000;
const TOKEN_ENDPOINT = "https://cloud.uipath.com/identity_/connect/token";

const RESOURCE_SCOPES: Record<ResourceType, string> = {
  OR: [
    "OR.Default", "OR.Administration", "OR.Execution",
    "OR.Queues", "OR.Queues.Read", "OR.Queues.Write",
    "OR.Processes", "OR.Folders", "OR.Folders.Read",
    "OR.Jobs", "OR.Jobs.Read", "OR.Jobs.Write",
    "OR.Triggers", "OR.Triggers.Read", "OR.Triggers.Write",
    "OR.Robots", "OR.Robots.Read", "OR.Machines",
    "OR.Assets", "OR.Assets.Read", "OR.Assets.Write",
    "OR.TestSets", "OR.TestSets.Read", "OR.TestSets.Write",
    "OR.TestSetExecutions", "OR.TestSetExecutions.Read", "OR.TestSetExecutions.Write",
    "OR.TestDataQueues", "OR.TestDataQueues.Read",
    "OR.Tasks", "OR.Tasks.Read", "OR.Tasks.Write",
  ].join(" "),
  TM: [
    "TM.TestCases", "TM.TestCases.Read", "TM.TestCases.Write",
    "TM.TestSets", "TM.TestSets.Read", "TM.TestSets.Write",
    "TM.TestExecutions", "TM.TestExecutions.Read", "TM.TestExecutions.Write",
    "TM.Requirements", "TM.Requirements.Read", "TM.Requirements.Write",
    "TM.Projects", "TM.Projects.Read", "TM.Projects.Write", "TM.Users.Read",
  ].join(" "),
  DU: "Du.DocumentManager.Document",
  PM: [
    "PM.Security", "PM.AuthSetting", "PM.OAuthApp",
    "PM.RobotAccount", "PM.RobotAccount.Read", "PM.RobotAccount.Write",
  ].join(" "),
  DF: [
    "DataFabric.Schema.Read", "DataFabric.Data.Read", "DataFabric.Data.Write",
  ].join(" "),
};

export const DEFAULT_SCOPES = RESOURCE_SCOPES.OR;

function resolveOrScopes(stored: string | undefined, defaults: string): string {
  if (!stored) return defaults;
  const orOnly = stored.split(/\s+/).filter(s => s.startsWith("OR."));
  return orOnly.length > 0 ? orOnly.join(" ") : defaults;
}

let cachedConfig: UiPathAuthConfig | null = null;
const tokenCache: Partial<Record<ResourceType, CachedToken>> = {};
let configLoadedAt = 0;
const CONFIG_TTL_MS = 30_000;

function maskClientId(clientId: string): string {
  if (clientId.length <= 6) return clientId;
  return clientId.slice(0, 6) + "..." + "*".repeat(4);
}

async function loadConfig(): Promise<UiPathAuthConfig | null> {
  const now = Date.now();
  if (cachedConfig && now - configLoadedAt < CONFIG_TTL_MS) {
    return cachedConfig;
  }

  const all = await db.select().from(appSettings);
  const map = new Map(all.map((r) => [r.key, r.value]));

  const orgName = map.get("uipath_org_name");
  const tenantName = map.get("uipath_tenant_name");
  const clientId = map.get("uipath_client_id");
  const clientSecret = map.get("uipath_client_secret");
  const storedScopes = map.get("uipath_scopes");
  const scopes = resolveOrScopes(storedScopes, RESOURCE_SCOPES.OR);
  const folderId = map.get("uipath_folder_id") || undefined;
  const folderName = map.get("uipath_folder_name") || undefined;

  if (!orgName || !tenantName || !clientId || !clientSecret) {
    const envClientId = process.env.UIPATH_CLIENT_ID;
    const envClientSecret = process.env.UIPATH_CLIENT_SECRET;
    const envOrgName = process.env.UIPATH_ORGANIZATION_ID;
    const envTenantName = process.env.UIPATH_TENANT_NAME;
    const envFolderId = process.env.UIPATH_FOLDER_ID;

    if (envClientId && envClientSecret && envOrgName && envTenantName) {
      cachedConfig = {
        orgName: envOrgName,
        tenantName: envTenantName,
        clientId: envClientId,
        clientSecret: envClientSecret,
        scopes: resolveOrScopes(process.env.UIPATH_SCOPES, RESOURCE_SCOPES.OR),
        folderId: envFolderId,
      };
      configLoadedAt = now;
      return cachedConfig;
    }
    cachedConfig = null;
    return null;
  }

  cachedConfig = { orgName, tenantName, clientId, clientSecret, scopes, folderId, folderName };
  configLoadedAt = now;
  return cachedConfig;
}

async function fetchNewToken(config: UiPathAuthConfig, resource: ResourceType): Promise<CachedToken> {
  const requestedScopes = resource === "OR" ? config.scopes : RESOURCE_SCOPES[resource];
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: requestedScopes,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    const msg = err.name === "AbortError"
      ? "Token request timed out after 15s"
      : `Token request failed: ${err.message}`;
    console.error(`[UiPath Auth] ${msg} (${resource} token, client: ${maskClientId(config.clientId)})`);
    throw new UiPathAuthError(msg);
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[UiPath Auth] ${resource} token request failed (${res.status}) for client ${maskClientId(config.clientId)}`);
    throw new UiPathAuthError(`${resource} authentication failed (${res.status}): ${text.slice(0, 200)}`, res.status);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new UiPathAuthError(`${resource} token response missing access_token`);
  }

  const expiresIn = data.expires_in || 3600;
  const expiresAt = Date.now() + expiresIn * 1000;

  console.log(`[UiPath Auth] ${resource} token acquired for client ${maskClientId(config.clientId)}, expires in ${expiresIn}s`);

  try {
    const jwtParts = data.access_token.split(".");
    if (jwtParts.length === 3) {
      const payload = JSON.parse(Buffer.from(jwtParts[1], "base64url").toString("utf8"));
      const tokenScopes: string[] = typeof payload.scope === "string"
        ? payload.scope.split(" ")
        : Array.isArray(payload.scope) ? payload.scope : [];
      const scopeCounts = new Map<string, number>();
      for (const s of tokenScopes) {
        const prefix = s.split(".")[0];
        scopeCounts.set(prefix, (scopeCounts.get(prefix) || 0) + 1);
      }
      const summary = Array.from(scopeCounts.entries()).map(([k, v]) => `${k}=${v}`).join(", ");
      console.log(`[UiPath Auth] ${resource} token scopes: ${summary}`);
    }
  } catch (decodeErr: any) {
    console.log(`[UiPath Auth] Could not decode JWT payload: ${decodeErr.message}`);
  }

  return { accessToken: data.access_token, expiresAt };
}

function isTokenValid(token: CachedToken | null): boolean {
  if (!token) return false;
  return Date.now() < token.expiresAt - TOKEN_REFRESH_BUFFER_MS;
}

async function getResourceToken(resource: ResourceType): Promise<string> {
  const config = await loadConfig();
  if (!config) {
    throw new UiPathAuthError("UiPath is not configured. Set credentials in Admin > Integrations.");
  }

  const cached = tokenCache[resource];
  if (isTokenValid(cached ?? null) && cached) {
    return cached.accessToken;
  }

  tokenCache[resource] = await fetchNewToken(config, resource);
  return tokenCache[resource]!.accessToken;
}

async function getResourceHeaders(resource: ResourceType, extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  const config = await loadConfig();
  if (!config) {
    throw new UiPathAuthError("UiPath is not configured.");
  }

  const token = await getResourceToken(resource);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (resource === "OR" && config.folderId) {
    headers["X-UIPATH-OrganizationUnitId"] = config.folderId;
  }

  return headers;
}

export function getBaseUrl(config: UiPathAuthConfig): string {
  return `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_`;
}

export function getTestManagerBaseUrl(config: UiPathAuthConfig): string {
  return `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/testmanager_`;
}

export function getDuBaseUrl(config: UiPathAuthConfig): string {
  return `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/du_`;
}

export function getDataServiceBaseUrl(config: UiPathAuthConfig): string {
  return `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/dataservice_`;
}

export function getCloudBaseUrl(config: UiPathAuthConfig): string {
  return `https://cloud.uipath.com/${config.orgName}/${config.tenantName}`;
}

export function invalidateToken(): void {
  tokenCache.OR = undefined;
}

export function invalidateTmToken(): void {
  tokenCache.TM = undefined;
}

export function invalidateResourceToken(resource: ResourceType): void {
  tokenCache[resource] = undefined;
}

export function invalidateAllTokens(): void {
  for (const key of Object.keys(tokenCache) as ResourceType[]) {
    tokenCache[key] = undefined;
  }
}

export function invalidateConfig(): void {
  cachedConfig = null;
  configLoadedAt = 0;
}

export async function getConfig(): Promise<UiPathAuthConfig | null> {
  return loadConfig();
}

export async function getToken(): Promise<string> {
  return getResourceToken("OR");
}

export async function getTmToken(): Promise<string> {
  return getResourceToken("TM");
}

export async function getDuToken(): Promise<string> {
  return getResourceToken("DU");
}

export async function getPmToken(): Promise<string> {
  return getResourceToken("PM");
}

export async function getDfToken(): Promise<string> {
  return getResourceToken("DF");
}

export async function getHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  return getResourceHeaders("OR", extraHeaders);
}

export async function getTmHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  return getResourceHeaders("TM", extraHeaders);
}

export async function getDuHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  return getResourceHeaders("DU", extraHeaders);
}

export async function getPmHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  return getResourceHeaders("PM", extraHeaders);
}

export async function getDfHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  return getResourceHeaders("DF", extraHeaders);
}

export function getResourceScopes(): Record<ResourceType, string> {
  return { ...RESOURCE_SCOPES };
}

export async function tryAcquireResourceToken(resource: ResourceType): Promise<{ ok: boolean; scopes: string[]; error?: string }> {
  try {
    const token = await getResourceToken(resource);
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      const scopes: string[] = typeof payload.scope === "string"
        ? payload.scope.split(" ")
        : Array.isArray(payload.scope) ? payload.scope : [];
      return { ok: true, scopes };
    }
    return { ok: true, scopes: [] };
  } catch (err: any) {
    return { ok: false, scopes: [], error: err.message };
  }
}

function detectResourceType(url: string): ResourceType {
  if (url.includes("/testmanager_/") || url.includes("/tmapi_/")) return "TM";
  if (url.includes("/du_/") || url.includes("/documentunderstanding_/")) return "DU";
  if (url.includes("/dataservice_/") || url.includes("/datafabric_/")) return "DF";
  if (url.includes("/identity_/api/") && !url.includes("/connect/")) return "PM";
  return "OR";
}

export async function healthCheck(): Promise<{ ok: boolean; message: string; latencyMs: number; tenantName?: string; folderName?: string }> {
  const start = Date.now();

  const config = await loadConfig();
  if (!config) {
    return { ok: false, message: "UiPath is not configured", latencyMs: Date.now() - start };
  }

  try {
    const token = await getToken();
    const baseUrl = getBaseUrl(config);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${baseUrl}/odata/Folders?$top=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - start;

    if (res.ok) {
      return {
        ok: true,
        message: `Connected to ${config.tenantName}`,
        latencyMs,
        tenantName: config.tenantName,
        folderName: config.folderName,
      };
    }

    const text = await res.text().catch(() => "");
    return {
      ok: false,
      message: `Orchestrator returned ${res.status}: ${text.slice(0, 100)}`,
      latencyMs,
      tenantName: config.tenantName,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const msg = err.name === "AbortError"
      ? "Connection timed out"
      : err instanceof UiPathAuthError
        ? err.message
        : `Connection failed: ${err.message}`;
    return { ok: false, message: msg, latencyMs };
  }
}

export async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<Response> {
  const resource = detectResourceType(url);
  const headers = await getResourceHeaders(resource);
  const mergedHeaders = { ...headers, ...(options.headers as Record<string, string> || {}) };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: mergedHeaders,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
  clearTimeout(timeoutId);

  if (res.status === 401 && retryOn401) {
    console.log(`[UiPath Auth] Got 401 on ${resource} request, refreshing token and retrying...`);
    invalidateResourceToken(resource);
    return makeAuthenticatedRequest(url, options, false);
  }

  return res;
}
