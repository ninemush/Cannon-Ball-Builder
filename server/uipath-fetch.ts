import { sleep } from "./lib/utils";

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30000;

export interface UiPathFetchOptions extends RequestInit {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  label?: string;
}

export interface UiPathFetchResult {
  ok: boolean;
  status: number;
  text: string;
  data: any;
  error: string | null;
  retries: number;
}

function extractError(status: number, text: string): string | null {
  if (!text || text.trim().length === 0) {
    return status >= 400 ? `HTTP ${status}: Empty response` : null;
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML") || trimmed.startsWith("<head")) {
    return `HTTP ${status}: HTML response (gateway or error page)`;
  }

  try {
    const data = JSON.parse(trimmed);

    if (data.errorCode || data.ErrorCode) {
      return `${data.errorCode || data.ErrorCode}: ${data.message || data.Message || data.ErrorMessage || "Unknown error"}`;
    }
    if (data["odata.error"]) {
      const oe = data["odata.error"];
      return `${oe.code || "ODataError"}: ${oe.message?.value || oe.message || "Unknown OData error"}`;
    }
    if (data.Response?.ErrorCode || data.Response?.errorCode) {
      const r = data.Response;
      return `${r.ErrorCode || r.errorCode}: ${r.Message || r.message || "Nested error"}`;
    }
    if (data.error && typeof data.error === "string") {
      return data.error;
    }
    if (data.error && typeof data.error === "object") {
      return JSON.stringify(data.error).slice(0, 200);
    }
    if (data.errorMessage) {
      return data.errorMessage;
    }
    if (typeof data.message === "string" && status >= 400) {
      return data.message;
    }
    if (typeof data.message === "string" && (
      data.message.toLowerCase().includes("not onboarded") ||
      data.message.toLowerCase().includes("not available") ||
      data.message.toLowerCase().includes("error") ||
      data.message.toLowerCase().includes("fail") ||
      data.message.toLowerCase().includes("invalid") ||
      data.message.toLowerCase().includes("not found")
    )) {
      if (!data.Id && !data.id && !data.Key && !data.value) {
        return data.message;
      }
    }

    if (status >= 400) {
      const clean = text.replace(/[{}"\\]/g, "").replace(/traceId:[^,]+,?/gi, "").replace(/errorCode:\d+,?/gi, "").trim();
      return `HTTP ${status}: ${clean.length > 150 ? clean.slice(0, 150) + "..." : clean || "Request failed"}`;
    }

    return null;
  } catch {
    if (status >= 400) {
      const clean = text.slice(0, 200).replace(/\s+/g, " ").trim();
      return `HTTP ${status}: ${clean || "Request failed"}`;
    }
    return null;
  }
}

function parseResponseData(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function uipathFetch(
  url: string,
  options: UiPathFetchOptions = {}
): Promise<UiPathFetchResult> {
  const {
    maxRetries = MAX_RETRIES,
    baseDelayMs = BASE_DELAY_MS,
    timeoutMs = REQUEST_TIMEOUT_MS,
    label = "",
    ...fetchOptions
  } = options;

  const logPrefix = label ? `[UiPath ${label}]` : "[UiPath]";
  let lastResult: UiPathFetchResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await response.text();
      const data = parseResponseData(text);
      const error = response.ok ? extractError(response.status, text) : extractError(response.status, text);

      lastResult = {
        ok: response.ok && !error,
        status: response.status,
        text,
        data,
        error,
        retries: attempt,
      };

      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxRetries) {
        let delayMs = baseDelayMs * Math.pow(2, attempt);

        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          if (retryAfter) {
            const retryMs = parseInt(retryAfter, 10) * 1000;
            if (!isNaN(retryMs) && retryMs > 0 && retryMs < 60000) {
              delayMs = retryMs;
            }
          }
        }

        console.log(`${logPrefix} ${response.status} on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delayMs}ms...`);
        await sleep(delayMs);
        continue;
      }

      return lastResult;
    } catch (err: any) {
      const isTimeout = err.name === "AbortError";
      const errorMsg = isTimeout ? `Request timed out after ${timeoutMs}ms` : err.message;

      lastResult = {
        ok: false,
        status: 0,
        text: "",
        data: null,
        error: errorMsg,
        retries: attempt,
      };

      if (attempt < maxRetries && !isTimeout) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(`${logPrefix} Network error on attempt ${attempt + 1}/${maxRetries + 1}: ${errorMsg}, retrying in ${delayMs}ms...`);
        await sleep(delayMs);
        continue;
      }

      return lastResult;
    }
  }

  return lastResult || {
    ok: false,
    status: 0,
    text: "",
    data: null,
    error: "Max retries exhausted",
    retries: maxRetries,
  };
}

export function isGenuineApiResponse(text: string): { genuine: boolean; reason?: string } {
  if (!text || text.trim().length === 0) {
    return { genuine: false, reason: "Empty response body" };
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML") || trimmed.startsWith("<head")) {
    return { genuine: false, reason: "HTML response — gateway or error page, not a real service" };
  }
  try {
    const data = JSON.parse(trimmed);
    if (data.errorCode || data.ErrorCode) {
      return { genuine: false, reason: `Error: ${data.errorCode || data.ErrorCode}: ${data.message || data.Message || ""}` };
    }
    if (data["odata.error"]) {
      return { genuine: false, reason: `OData error: ${data["odata.error"].message?.value || data["odata.error"].code || ""}` };
    }
    if (typeof data.message === "string" && (data.message.includes("not onboarded") || data.message.includes("ServiceType"))) {
      return { genuine: false, reason: `Service not onboarded: ${data.message}` };
    }
    if (data.error && typeof data.error === "string") {
      return { genuine: false, reason: `Error: ${data.error}` };
    }
    if (data.error && typeof data.error === "object") {
      return { genuine: false, reason: `Error object: ${JSON.stringify(data.error).slice(0, 200)}` };
    }
    if (Array.isArray(data.value) || Array.isArray(data.items) || Array.isArray(data) || data.Id || data.id || data.totalCount !== undefined || data["@odata.count"] !== undefined) {
      return { genuine: true };
    }
    if (typeof data === "object" && Object.keys(data).length === 0) {
      return { genuine: false, reason: "Empty JSON object" };
    }
    return { genuine: true };
  } catch {
    return { genuine: false, reason: `Non-JSON response: ${trimmed.slice(0, 100)}` };
  }
}

export function isValidCreation(text: string): { valid: boolean; data: any; error?: string } {
  const trimmed = text?.trim();
  if (!trimmed) {
    return { valid: false, data: null, error: "Empty response body" };
  }
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML") || trimmed.startsWith("<head")) {
    return { valid: false, data: null, error: "HTML response — likely a redirect to login page, not a valid API response" };
  }
  try {
    const data = JSON.parse(trimmed);
    if (data.errorCode || data.ErrorCode) {
      const code = data.errorCode || data.ErrorCode;
      const msg = data.message || data.Message || data.ErrorMessage || "Unknown error";
      return { valid: false, data, error: `${code}: ${msg}` };
    }
    if (data["odata.error"]) {
      return { valid: false, data, error: `OData error: ${data["odata.error"].message?.value || ""}` };
    }
    if (data.Response?.ErrorCode || data.Response?.errorCode) {
      const r = data.Response;
      return { valid: false, data, error: `Nested error: ${r.ErrorCode || r.errorCode}: ${r.Message || r.message || ""}` };
    }
    if (data.error && typeof data.error === "string") {
      return { valid: false, data, error: data.error };
    }
    if (data.error && typeof data.error === "object") {
      const errorStr = JSON.stringify(data.error).slice(0, 200);
      const itemNotFound = data.error.code === "itemNotFound" || data.error.code === "ItemNotFound";
      if (itemNotFound) {
        return { valid: false, data, error: `itemNotFound: ${data.error.message || data.error.innerError?.message || errorStr}` };
      }
      return { valid: false, data, error: errorStr };
    }
    if (typeof data.message === "string" && (data.message.includes("not onboarded") || data.message.includes("not available"))) {
      return { valid: false, data, error: data.message };
    }
    if (typeof data.code === "string" && data.code.toLowerCase() === "itemnotfound") {
      return { valid: false, data, error: `itemNotFound: ${data.message || "Unknown error"}` };
    }
    if (!data.Id && !data.id && !data.Name && !data.name && !data.Key) {
      return { valid: false, data, error: "Response missing expected fields (Id, Name, Key)" };
    }
    return { valid: true, data };
  } catch {
    return { valid: false, data: null, error: `Non-JSON response: ${text.slice(0, 200)}` };
  }
}
