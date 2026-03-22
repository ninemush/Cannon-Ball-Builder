import { db } from "./db";
import { appSettings, uipathConnections } from "@shared/schema";
import { eq } from "drizzle-orm";
import { metadataService, TOKEN_RESOURCE_TO_SERVICE } from "./catalog/metadata-service";
import type { ServiceResourceType } from "./catalog/metadata-schemas";

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

export type ResourceType = "OR" | "TM" | "DU" | "PM" | "DF" | "PIMS" | "IXP" | "AI";

const TOKEN_REFRESH_BUFFER_MS = 60_000;

function getTokenEndpoint(): string {
  return metadataService.getTokenEndpoint();
}

function getResourceScopesFromMetadata(resource: ResourceType): string {
  const serviceType = (TOKEN_RESOURCE_TO_SERVICE[resource] || resource) as ServiceResourceType;
  return metadataService.getScopesForServiceString(serviceType);
}

export function getDefaultOrScopes(): string {
  return getResourceScopesFromMetadata("OR");
}

let cachedConfig: UiPathAuthConfig | null = null;
const tokenCache: Partial<Record<ResourceType, CachedToken>> = {};
let configLoadedAt = 0;
const CONFIG_TTL_MS = 30_000;

export function getConfigLoadedAt(): number {
  return configLoadedAt;
}

function maskClientId(clientId: string): string {
  if (clientId.length <= 6) return clientId;
  return clientId.slice(0, 6) + "..." + "*".repeat(4);
}

async function loadConfig(): Promise<UiPathAuthConfig | null> {
  const now = Date.now();
  if (cachedConfig && now - configLoadedAt < CONFIG_TTL_MS) {
    return cachedConfig;
  }

  const activeRows = await db.select().from(uipathConnections).where(eq(uipathConnections.isActive, true));
  if (activeRows.length > 0) {
    const row = activeRows[0];
    let scopes = (row.scopes && row.scopes.trim()) ? row.scopes.trim() : "";
    if (!scopes) {
      const settingsRows = await db.select().from(appSettings).where(eq(appSettings.key, "uipath_scopes"));
      if (settingsRows.length > 0 && settingsRows[0].value && settingsRows[0].value.trim()) {
        scopes = settingsRows[0].value.trim();
      } else {
        scopes = getDefaultOrScopes();
      }
    }
    cachedConfig = {
      orgName: row.orgName,
      tenantName: row.tenantName,
      clientId: row.clientId,
      clientSecret: row.clientSecret,
      scopes,
      folderId: row.folderId || undefined,
      folderName: row.folderName || undefined,
    };
    configLoadedAt = now;
    return cachedConfig;
  }

  const all = await db.select().from(appSettings);
  const map = new Map(all.map((r) => [r.key, r.value]));

  const orgName = map.get("uipath_org_name");
  const tenantName = map.get("uipath_tenant_name");
  const clientId = map.get("uipath_client_id");
  const clientSecret = map.get("uipath_client_secret");
  const savedScopes = map.get("uipath_scopes");
  const scopes = (savedScopes && savedScopes.trim()) ? savedScopes.trim() : getDefaultOrScopes();
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
        scopes: getDefaultOrScopes(),
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
  const requestedScopes = resource === "OR" ? config.scopes : getResourceScopesFromMetadata(resource);
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
    res = await fetch(getTokenEndpoint(), {
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

  if (resource !== "OR") {
    const serviceType = (TOKEN_RESOURCE_TO_SERVICE[resource] || resource) as ServiceResourceType;
    if (!metadataService.hasOidcScopeFamily(serviceType)) {
      throw new UiPathAuthError(`No OIDC scope family for ${resource} — dedicated token acquisition is not available`);
    }
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
  return metadataService.getServiceUrl("OR", config);
}

export function getTestManagerBaseUrl(config: UiPathAuthConfig): string {
  return metadataService.getServiceUrl("TM", config);
}

export function getDuBaseUrl(config: UiPathAuthConfig): string {
  return metadataService.getServiceUrl("DU", config);
}

export function getDataServiceBaseUrl(config: UiPathAuthConfig): string {
  return metadataService.getServiceUrl("DF", config);
}

export function getCloudBaseUrl(config: UiPathAuthConfig): string {
  return metadataService.getCloudBaseUrl(config);
}

export function getServiceUrl(resourceType: ServiceResourceType, config: UiPathAuthConfig): string {
  return metadataService.getServiceUrl(resourceType, config);
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

export async function getIxpToken(): Promise<string> {
  return getResourceToken("IXP");
}

export async function getIxpHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  return getResourceHeaders("IXP", extraHeaders);
}

export async function getAiToken(): Promise<string> {
  return getResourceToken("AI");
}

export async function getAiHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  return getResourceHeaders("AI", extraHeaders);
}

export async function getMaestroToken(): Promise<string> {
  return getResourceToken("PIMS");
}

export async function getMaestroHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  return getResourceHeaders("PIMS", extraHeaders);
}

export function getMaestroBaseUrl(config: UiPathAuthConfig): string {
  return metadataService.getServiceUrl("PIMS", config);
}

export function getResourceScopes(): Record<ResourceType, string> {
  const resourceTypes: ResourceType[] = ["OR", "TM", "DU", "PM", "DF", "PIMS", "IXP", "AI"];
  const result = Object.fromEntries(
    resourceTypes.map(rt => [rt, getResourceScopesFromMetadata(rt)])
  ) as Record<ResourceType, string>;
  return result;
}

export async function getAccessToken(config: { clientId: string; clientSecret: string; scopes: string }): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: config.scopes,
  });

  const tokenUrl = getTokenEndpoint();
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new UiPathAuthError(`UiPath auth failed (${res.status}): ${text}`, res.status);
  }

  const data = await res.json();
  return data.access_token;
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
  const { metadataService } = require("./catalog/metadata-service");
  const detected = metadataService.detectResourceTypeFromUrl(url);
  const resourceTypeMap: Record<string, ResourceType> = {
    TM: "TM", DU: "DU", DF: "DF", PM: "PM",
    IXP: "IXP", AI: "AI", PIMS: "PIMS",
  };
  return resourceTypeMap[detected] || "OR";
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
