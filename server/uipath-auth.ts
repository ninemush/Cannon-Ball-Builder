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

const TOKEN_REFRESH_BUFFER_MS = 60_000;
const TOKEN_ENDPOINT = "https://cloud.uipath.com/identity_/connect/token";
const DEFAULT_SCOPES = "OR.Default OR.Administration OR.Execution OR.Queues OR.Processes OR.Folders.Read OR.Jobs OR.Triggers AC.Tasks AC.Tasks.Read AC.Tasks.Write AC.Actions TM.Projects TM.TestCases TM.TestSets TM.TestExecutions";

let cachedConfig: UiPathAuthConfig | null = null;
let cachedToken: CachedToken | null = null;
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
  const scopes = map.get("uipath_scopes") || DEFAULT_SCOPES;
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
        scopes: process.env.UIPATH_SCOPES || DEFAULT_SCOPES,
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

async function fetchNewToken(config: UiPathAuthConfig): Promise<CachedToken> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: config.scopes,
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
    console.error(`[UiPath Auth] ${msg} (client: ${maskClientId(config.clientId)})`);
    throw new UiPathAuthError(msg);
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[UiPath Auth] Token request failed (${res.status}) for client ${maskClientId(config.clientId)}`);
    throw new UiPathAuthError(`Authentication failed (${res.status}): ${text.slice(0, 200)}`, res.status);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new UiPathAuthError("Token response missing access_token");
  }

  const expiresIn = data.expires_in || 3600;
  const expiresAt = Date.now() + expiresIn * 1000;

  console.log(`[UiPath Auth] Token acquired for client ${maskClientId(config.clientId)}, expires in ${expiresIn}s`);

  return { accessToken: data.access_token, expiresAt };
}

function isTokenValid(): boolean {
  if (!cachedToken) return false;
  return Date.now() < cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_MS;
}

export function getBaseUrl(config: UiPathAuthConfig): string {
  return `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_`;
}

export function getActionsBaseUrl(config: UiPathAuthConfig): string {
  return `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/actions_`;
}

export function getTestManagerBaseUrl(config: UiPathAuthConfig): string {
  return `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/testmanager_`;
}

export function invalidateToken(): void {
  cachedToken = null;
}

export function invalidateConfig(): void {
  cachedConfig = null;
  configLoadedAt = 0;
}

export async function getConfig(): Promise<UiPathAuthConfig | null> {
  return loadConfig();
}

export async function getToken(): Promise<string> {
  const config = await loadConfig();
  if (!config) {
    throw new UiPathAuthError("UiPath is not configured. Set credentials in Admin > Integrations.");
  }

  if (isTokenValid() && cachedToken) {
    return cachedToken.accessToken;
  }

  cachedToken = await fetchNewToken(config);
  return cachedToken.accessToken;
}

export async function getHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
  const config = await loadConfig();
  if (!config) {
    throw new UiPathAuthError("UiPath is not configured.");
  }

  const token = await getToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (config.folderId) {
    headers["X-UIPATH-OrganizationUnitId"] = config.folderId;
  }

  return headers;
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
  const headers = await getHeaders();
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
    console.log("[UiPath Auth] Got 401, refreshing token and retrying...");
    invalidateToken();
    return makeAuthenticatedRequest(url, options, false);
  }

  return res;
}
