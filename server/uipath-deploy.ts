import { getUiPathConfig, type UiPathConfig } from "./uipath-integration";
import Anthropic from "@anthropic-ai/sdk";

function odataEscape(value: string): string {
  return value.replace(/'/g, "''");
}

export type OrchestratorArtifacts = {
  queues?: Array<{ name: string; description?: string; maxRetries?: number; uniqueReference?: boolean }>;
  assets?: Array<{ name: string; type: string; value?: string; description?: string }>;
  machines?: Array<{ name: string; type?: string; slots?: number; description?: string }>;
  triggers?: Array<{ name: string; type: string; queueName?: string; cron?: string; description?: string }>;
  storageBuckets?: Array<{ name: string; description?: string }>;
  environments?: Array<{ name: string; type?: string; description?: string }>;
  actionCenter?: Array<{ taskCatalog: string; assignedRole?: string; sla?: string; escalation?: string; description?: string }>;
  documentUnderstanding?: Array<{ name: string; documentTypes: string[]; description?: string }>;
  testCases?: Array<{ name: string; description?: string; steps?: Array<{ action: string; expected: string }> }>;
};

export type DeploymentResult = {
  artifact: string;
  name: string;
  status: "created" | "exists" | "failed" | "skipped";
  message: string;
  id?: number;
};

export function parseArtifactsFromSDD(sddContent: string): OrchestratorArtifacts | null {
  const exactMatch = sddContent.match(/```orchestrator_artifacts\s*\n([\s\S]*?)\n```/);
  if (exactMatch) {
    try {
      return JSON.parse(exactMatch[1].trim());
    } catch (e) {
      console.warn("[parseArtifacts] orchestrator_artifacts fence found but JSON parse failed:", (e as Error).message);
    }
  }

  const jsonFenceMatch = sddContent.match(/```json\s*\n([\s\S]*?)\n```/g);
  if (jsonFenceMatch) {
    for (const fence of jsonFenceMatch) {
      const inner = fence.replace(/```json\s*\n/, "").replace(/\n```$/, "").trim();
      try {
        const parsed = JSON.parse(inner);
        if (parsed.queues || parsed.assets || parsed.machines || parsed.triggers) {
          console.log("[parseArtifacts] Found artifacts in json fence block");
          return parsed;
        }
      } catch { /* not the right block */ }
    }
  }

  const rawMatch = sddContent.match(/\{\s*"queues"\s*:\s*\[[\s\S]*?\}\s*\]\s*\}/);
  if (rawMatch) {
    try {
      const braceStart = rawMatch.index!;
      let depth = 0;
      let end = braceStart;
      for (let i = braceStart; i < sddContent.length; i++) {
        if (sddContent[i] === "{") depth++;
        if (sddContent[i] === "}") depth--;
        if (depth === 0) { end = i + 1; break; }
      }
      const jsonStr = sddContent.slice(braceStart, end);
      const parsed = JSON.parse(jsonStr);
      if (parsed.queues || parsed.assets || parsed.machines || parsed.triggers) {
        console.log("[parseArtifacts] Found artifacts in raw JSON");
        return parsed;
      }
    } catch { /* not valid JSON */ }
  }

  return null;
}

export async function extractArtifactsWithLLM(sddContent: string): Promise<OrchestratorArtifacts | null> {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    console.log("[UiPath Deploy] Extracting artifacts from SDD using LLM...");
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: "You are a UiPath automation consultant. Extract Orchestrator artifact definitions from the SDD and output ONLY valid JSON. No other text, no markdown formatting, no code fences — just the raw JSON object.",
      messages: [{
        role: "user",
        content: `Extract ALL UiPath Orchestrator and platform artifacts from this Solution Design Document. Output a single JSON object with these keys: queues, assets, machines, triggers, storageBuckets, environments, actionCenter, documentUnderstanding, testCases. Include every artifact mentioned or implied. For credential assets use value "". For text/integer/bool assets provide sensible defaults. IMPORTANT: All triggers (Queue and Time) MUST be included — never treat them as manual steps. Generate test cases that cover the key automation scenarios described in the SDD.

Expected JSON shape:
{"queues":[{"name":"...","description":"...","maxRetries":3,"uniqueReference":true}],"assets":[{"name":"...","type":"Text|Integer|Bool|Credential","value":"...","description":"..."}],"machines":[{"name":"...","type":"Unattended|Attended|Development","slots":1,"description":"..."}],"triggers":[{"name":"...","type":"Queue|Time","queueName":"...","cron":"...","description":"..."}],"storageBuckets":[{"name":"...","description":"..."}],"environments":[{"name":"...","type":"Production|Development|Testing","description":"..."}],"actionCenter":[{"taskCatalog":"...","assignedRole":"...","sla":"...","escalation":"...","description":"..."}],"documentUnderstanding":[{"name":"ProjectName","documentTypes":["Invoice","Receipt"],"description":"..."}],"testCases":[{"name":"Test case name","description":"What this tests","steps":[{"action":"Step action","expected":"Expected result"}]}]}

SDD content:
${sddContent.slice(0, 12000)}`
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock?.text?.trim() || "";

    let jsonStr = text;
    const fencedMatch = text.match(/```(?:json|orchestrator_artifacts)?\s*\n?([\s\S]*?)\n?```/);
    if (fencedMatch) {
      jsonStr = fencedMatch[1].trim();
    }

    const raw = JSON.parse(jsonStr);

    const validated: OrchestratorArtifacts = {};
    if (Array.isArray(raw.queues)) {
      validated.queues = raw.queues.filter((q: any) => typeof q?.name === "string" && q.name.length > 0);
    }
    if (Array.isArray(raw.assets)) {
      validated.assets = raw.assets.filter((a: any) => typeof a?.name === "string" && a.name.length > 0 && typeof a?.type === "string");
    }
    if (Array.isArray(raw.machines)) {
      validated.machines = raw.machines.filter((m: any) => typeof m?.name === "string" && m.name.length > 0);
    }
    if (Array.isArray(raw.triggers)) {
      validated.triggers = raw.triggers.filter((t: any) => typeof t?.name === "string" && t.name.length > 0 && typeof t?.type === "string");
    }
    if (Array.isArray(raw.storageBuckets)) {
      validated.storageBuckets = raw.storageBuckets.filter((b: any) => typeof b?.name === "string" && b.name.length > 0);
    }
    if (Array.isArray(raw.environments)) {
      validated.environments = raw.environments.filter((e: any) => typeof e?.name === "string" && e.name.length > 0);
    }
    if (Array.isArray(raw.actionCenter)) {
      validated.actionCenter = raw.actionCenter.filter((a: any) => typeof a?.taskCatalog === "string" && a.taskCatalog.length > 0);
    }
    if (Array.isArray(raw.documentUnderstanding)) {
      validated.documentUnderstanding = raw.documentUnderstanding.filter((d: any) => typeof d?.name === "string" && d.name.length > 0);
    }
    if (Array.isArray(raw.testCases)) {
      validated.testCases = raw.testCases.filter((t: any) => typeof t?.name === "string" && t.name.length > 0);
    }

    const hasContent = (validated.queues?.length || 0) + (validated.assets?.length || 0) +
      (validated.triggers?.length || 0) + (validated.machines?.length || 0) +
      (validated.storageBuckets?.length || 0) + (validated.environments?.length || 0) + (validated.actionCenter?.length || 0) +
      (validated.documentUnderstanding?.length || 0) + (validated.testCases?.length || 0);

    if (hasContent > 0) {
      console.log(`[UiPath Deploy] LLM extracted ${hasContent} validated artifacts (queues:${validated.queues?.length||0}, assets:${validated.assets?.length||0}, machines:${validated.machines?.length||0}, triggers:${validated.triggers?.length||0}, buckets:${validated.storageBuckets?.length||0}, actionCenter:${validated.actionCenter?.length||0}, DU:${validated.documentUnderstanding?.length||0}, testCases:${validated.testCases?.length||0})`);
      return validated;
    }
    console.warn("[UiPath Deploy] LLM returned JSON but no valid artifacts after validation. Raw keys:", Object.keys(raw));
    return null;
  } catch (err: any) {
    console.error("[UiPath Deploy] LLM artifact extraction failed:", err?.message, "| Raw text start:", (err?.rawText || "").slice(0, 200));
    return null;
  }
}

async function getAccessToken(config: UiPathConfig): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: config.scopes,
  });
  const res = await fetch("https://cloud.uipath.com/identity_/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Auth failed (${res.status})`);
  const data = await res.json();
  return data.access_token;
}

function orchBase(config: UiPathConfig): string {
  return `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_`;
}

function headers(config: UiPathConfig, token: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (config.folderId) h["X-UIPATH-OrganizationUnitId"] = config.folderId;
  return h;
}

function parseOrchestratorResponse(text: string): { data: any; error: string | null } {
  try {
    const data = JSON.parse(text);
    if (data.errorCode || data.ErrorCode) {
      return { data, error: `${data.errorCode || data.ErrorCode}: ${data.message || data.Message || data.ErrorMessage || "Unknown error"}` };
    }
    if (data.error) {
      return { data, error: typeof data.error === "string" ? data.error : JSON.stringify(data.error) };
    }
    if (data.Response?.ErrorCode || data.Response?.errorCode) {
      const r = data.Response;
      return { data, error: `${r.ErrorCode || r.errorCode}: ${r.Message || r.message || "Nested error"}` };
    }
    if (data["odata.error"]) {
      const oe = data["odata.error"];
      return { data, error: `${oe.code || "ODataError"}: ${oe.message?.value || oe.message || "Unknown OData error"}` };
    }
    if (data.message && !data.Id && !data.id && !data.Key && !data.value) {
      if (typeof data.message === "string" && (data.message.toLowerCase().includes("error") || data.message.toLowerCase().includes("fail") || data.message.toLowerCase().includes("invalid") || data.message.toLowerCase().includes("not found"))) {
        return { data, error: data.message };
      }
    }
    return { data, error: null };
  } catch {
    return { data: null, error: `Invalid JSON response: ${text.slice(0, 200)}` };
  }
}

/**
 * Validates a service probe response to ensure the service is genuinely available.
 * Returns true only if the response body is valid JSON with an expected structure.
 * Catches false positives from UiPath cloud gateway returning 200 for unregistered services.
 */
function isGenuineServiceResponse(responseText: string): { genuine: boolean; reason?: string } {
  if (!responseText || responseText.trim().length === 0) {
    return { genuine: false, reason: "Empty response body" };
  }
  const trimmed = responseText.trim();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML") || trimmed.startsWith("<head")) {
    return { genuine: false, reason: "HTML response — gateway or error page, not a real service" };
  }
  try {
    const data = JSON.parse(trimmed);
    if (data.errorCode || data.ErrorCode) {
      return { genuine: false, reason: `Error in response: ${data.errorCode || data.ErrorCode}: ${data.message || data.Message || ""}` };
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
      return { genuine: false, reason: "Empty JSON object — service may not be available" };
    }
    return { genuine: true };
  } catch {
    return { genuine: false, reason: `Non-JSON response: ${trimmed.slice(0, 100)}` };
  }
}

/**
 * Validates that a creation response actually represents a successfully created resource.
 * Checks for valid ID, hidden error codes, and ensures the response isn't a gateway artifact.
 */
function validateCreationResponse(responseText: string): { valid: boolean; data: any; error?: string } {
  try {
    const data = JSON.parse(responseText);
    if (data.errorCode || data.ErrorCode) {
      return { valid: false, data, error: `Hidden error: ${data.errorCode || data.ErrorCode}: ${data.message || data.Message || ""}` };
    }
    if (data["odata.error"]) {
      return { valid: false, data, error: `OData error in 200 response: ${data["odata.error"].message?.value || ""}` };
    }
    if (data.Response?.ErrorCode || data.Response?.errorCode) {
      const r = data.Response;
      return { valid: false, data, error: `Nested error: ${r.ErrorCode || r.errorCode}: ${r.Message || r.message || ""}` };
    }
    if (data.error && typeof data.error === "string") {
      return { valid: false, data, error: data.error };
    }
    if (data.error && typeof data.error === "object") {
      return { valid: false, data, error: JSON.stringify(data.error).slice(0, 200) };
    }
    if (typeof data.message === "string" && (data.message.includes("not onboarded") || data.message.includes("not available"))) {
      return { valid: false, data, error: data.message };
    }
    if (!data.Id && !data.id && !data.Name && !data.name && !data.Key) {
      return { valid: false, data, error: "Response missing expected fields (Id, Name, Key) — creation may not have succeeded" };
    }
    return { valid: true, data };
  } catch {
    return { valid: false, data: null, error: `Non-JSON creation response: ${responseText.slice(0, 200)}` };
  }
}

async function verifyArtifactExists(
  base: string, hdrs: Record<string, string>,
  endpoint: string, filterField: string, name: string, label: string,
  createdId?: number | null
): Promise<{ exists: boolean; id?: number; detail?: string }> {
  try {
    if (createdId) {
      const directUrl = `${base}/odata/${endpoint}(${createdId})`;
      const directRes = await fetch(directUrl, { headers: hdrs });
      if (directRes.ok) {
        const directData = await directRes.json();
        if (directData && (directData.Id || directData.id)) {
          console.log(`[UiPath Deploy] ${label} "${name}" verified by ID ${createdId}`);
          return { exists: true, id: directData.Id || directData.id };
        }
      }
    }

    const url = `${base}/odata/${endpoint}?$filter=${filterField} eq '${odataEscape(name)}'&$top=1`;
    const res = await fetch(url, { headers: hdrs });
    if (!res.ok) {
      return { exists: false, detail: `Verification GET returned ${res.status}` };
    }
    const data = await res.json();
    const items = data.value || [];
    if (items.length > 0) {
      const item = items[0];
      console.log(`[UiPath Deploy] ${label} "${name}" verified by name filter (ID: ${item.Id || item.id})`);
      return { exists: true, id: item.Id || item.id };
    }
    return { exists: false, detail: `${label} "${name}" not found after creation — API may have silently rejected it` };
  } catch (err: any) {
    return { exists: false, detail: `Verification failed: ${err.message}` };
  }
}

async function verifyFolderAndRelease(
  base: string, hdrs: Record<string, string>,
  releaseId: number | null, folderId: string | undefined
): Promise<{ valid: boolean; releaseKey?: string; releaseName?: string; message?: string }> {
  if (folderId) {
    try {
      const folderRes = await fetch(`${base}/odata/Folders?$filter=Id eq ${folderId}&$top=1`, { headers: hdrs });
      if (folderRes.ok) {
        const folderData = await folderRes.json();
        if (!folderData.value?.length) {
          console.warn(`[UiPath Deploy] Folder ID ${folderId} not found via Folders API — may still work via OrganizationUnitId header`);
        } else {
          console.log(`[UiPath Deploy] Folder verified: ${folderData.value[0].DisplayName} (ID: ${folderId})`);
        }
      }
    } catch { /* non-blocking */ }
  }

  if (releaseId) {
    try {
      const relRes = await fetch(`${base}/odata/Releases(${releaseId})`, { headers: hdrs });
      if (relRes.ok) {
        const relData = await relRes.json();
        console.log(`[UiPath Deploy] Release verified: ${relData.Name} (ID: ${releaseId}, Key: ${relData.Key})`);
        return { valid: true, releaseKey: relData.Key, releaseName: relData.Name };
      } else {
        const text = await relRes.text();
        console.error(`[UiPath Deploy] Release ${releaseId} verification failed: ${relRes.status} — ${text.slice(0, 200)}`);
        return { valid: false, message: `Release ID ${releaseId} not accessible (HTTP ${relRes.status}). Triggers require a valid process release.` };
      }
    } catch (err: any) {
      return { valid: false, message: `Release verification error: ${err.message}` };
    }
  }

  return { valid: true };
}

async function provisionQueues(
  base: string, hdrs: Record<string, string>,
  queues: OrchestratorArtifacts["queues"]
): Promise<DeploymentResult[]> {
  if (!queues?.length) return [];
  const results: DeploymentResult[] = [];

  for (const q of queues) {
    try {
      const checkRes = await fetch(
        `${base}/odata/QueueDefinitions?$filter=Name eq '${odataEscape(q.name)}'&$top=1`,
        { headers: hdrs }
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.value?.length > 0) {
          results.push({ artifact: "Queue", name: q.name, status: "exists", message: `Already exists (ID: ${checkData.value[0].Id})`, id: checkData.value[0].Id });
          continue;
        }
      }

      const body: Record<string, any> = {
        Name: q.name,
        Description: q.description || "",
        MaxNumberOfRetries: q.maxRetries ?? 3,
        AcceptAutomaticallyRetry: true,
        EnforceUniqueReference: q.uniqueReference ?? false,
      };

      const res = await fetch(`${base}/odata/QueueDefinitions`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify(body),
      });
      const text = await res.text();
      console.log(`[UiPath Deploy] Queue "${q.name}" -> ${res.status}: ${text.slice(0, 500)}`);

      if (res.ok || res.status === 201) {
        const parsed = parseOrchestratorResponse(text);
        if (parsed.error) {
          results.push({ artifact: "Queue", name: q.name, status: "failed", message: `API returned ${res.status} but body contains error: ${parsed.error}` });
          continue;
        }
        const verify = await verifyArtifactExists(base, hdrs, "QueueDefinitions", "Name", q.name, "Queue");
        if (verify.exists) {
          results.push({ artifact: "Queue", name: q.name, status: "created", message: `Created and verified (ID: ${verify.id})`, id: verify.id });
        } else {
          results.push({ artifact: "Queue", name: q.name, status: "failed", message: `API returned ${res.status} but verification failed. ${verify.detail || ""}` });
        }
      } else if (res.status === 409 || text.includes("already exists")) {
        results.push({ artifact: "Queue", name: q.name, status: "exists", message: "Already exists" });
      } else {
        results.push({ artifact: "Queue", name: q.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 300)}` });
      }
    } catch (err: any) {
      results.push({ artifact: "Queue", name: q.name, status: "failed", message: err.message });
    }
  }
  return results;
}

async function provisionAssets(
  base: string, hdrs: Record<string, string>,
  assets: OrchestratorArtifacts["assets"]
): Promise<DeploymentResult[]> {
  if (!assets?.length) return [];
  const results: DeploymentResult[] = [];

  for (const a of assets) {
    try {
      const checkRes = await fetch(
        `${base}/odata/Assets?$filter=Name eq '${odataEscape(a.name)}'&$top=1`,
        { headers: hdrs }
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.value?.length > 0) {
          results.push({ artifact: "Asset", name: a.name, status: "exists", message: `Already exists (ID: ${checkData.value[0].Id})`, id: checkData.value[0].Id });
          continue;
        }
      }

      const assetType = (a.type || "Text").toLowerCase();
      const body: Record<string, any> = {
        Name: a.name,
        ValueScope: "Global",
        Description: a.description || "",
      };

      if (assetType === "credential") {
        body.ValueType = "Credential";
        body.CredentialUsername = a.value || "REPLACE_ME";
        body.CredentialPassword = "REPLACE_ME";
      } else if (assetType === "integer") {
        body.ValueType = "Integer";
        body.IntValue = parseInt(a.value || "0") || 0;
      } else if (assetType === "bool" || assetType === "boolean") {
        body.ValueType = "Bool";
        body.BoolValue = a.value === "true" || a.value === "True" || a.value === "1";
      } else {
        body.ValueType = "Text";
        body.StringValue = a.value || "";
      }

      const res = await fetch(`${base}/odata/Assets`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const text = await res.text();
      console.log(`[UiPath Deploy] Asset "${a.name}" (${body.ValueType}) -> ${res.status}: ${text.slice(0, 500)}`);

      if (res.ok || res.status === 201) {
        const parsed = parseOrchestratorResponse(text);
        if (parsed.error) {
          results.push({ artifact: "Asset", name: a.name, status: "failed", message: `API returned ${res.status} but body contains error: ${parsed.error}` });
          continue;
        }
        const verify = await verifyArtifactExists(base, hdrs, "Assets", "Name", a.name, "Asset");
        if (verify.exists) {
          const extra = assetType === "credential" ? ". UPDATE credentials in Orchestrator > Assets." : "";
          results.push({ artifact: "Asset", name: a.name, status: "created", message: `Created and verified (ID: ${verify.id}, Type: ${body.ValueType})${extra}`, id: verify.id });
        } else {
          results.push({ artifact: "Asset", name: a.name, status: "failed", message: `API returned ${res.status} but verification failed. ${verify.detail || ""}` });
        }
      } else if (res.status === 409 || text.includes("already exists")) {
        results.push({ artifact: "Asset", name: a.name, status: "exists", message: "Already exists" });
      } else {
        results.push({ artifact: "Asset", name: a.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 300)}` });
      }
    } catch (err: any) {
      results.push({ artifact: "Asset", name: a.name, status: "failed", message: err.message });
    }
  }
  return results;
}

async function assignMachineToFolder(
  base: string, hdrs: Record<string, string>, machineId: number
): Promise<{ success: boolean; message: string }> {
  const folderId = hdrs["X-UIPATH-OrganizationUnitId"];
  if (!folderId) return { success: false, message: "No folder ID configured — machine not assigned to folder" };

  try {
    const res = await fetch(`${base}/odata/Folders(${folderId})/UiPath.Server.Configuration.OData.AssignMachines`, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify({ machineIds: [machineId] }),
    });
    if (res.ok || res.status === 204) {
      return { success: true, message: `Assigned to folder ${folderId}` };
    }
    const text = await res.text();
    if (text.includes("already") || res.status === 409) {
      return { success: true, message: `Already assigned to folder ${folderId}` };
    }
    return { success: false, message: `Folder assignment failed (HTTP ${res.status}): ${text.slice(0, 200)}` };
  } catch (err: any) {
    return { success: false, message: `Folder assignment error: ${err.message}` };
  }
}

async function provisionMachines(
  base: string, hdrs: Record<string, string>,
  machines: OrchestratorArtifacts["machines"]
): Promise<DeploymentResult[]> {
  if (!machines?.length) return [];
  const results: DeploymentResult[] = [];

  for (const m of machines) {
    try {
      let machineId: number | null = null;

      const checkRes = await fetch(
        `${base}/odata/Machines?$filter=Name eq '${odataEscape(m.name)}'&$top=1`,
        { headers: hdrs }
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.value?.length > 0) {
          machineId = checkData.value[0].Id;
          const folderAssign = await assignMachineToFolder(base, hdrs, machineId!);
          results.push({ artifact: "Machine", name: m.name, status: "exists", message: `Already exists (ID: ${machineId}). ${folderAssign.message}`, id: machineId ?? undefined });
          continue;
        }
      }

      const machineType = (m.type || "Unattended").toLowerCase();
      const body: Record<string, any> = {
        Name: m.name,
        Description: m.description || "",
        Type: "Template",
      };

      if (machineType.includes("unattended")) {
        body.UnattendedSlots = m.slots || 1;
      } else if (machineType.includes("attended")) {
        body.NonProductionSlots = 0;
      } else if (machineType.includes("development")) {
        body.NonProductionSlots = m.slots || 1;
      }

      const res = await fetch(`${base}/odata/Machines`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify(body),
      });
      const text = await res.text();
      console.log(`[UiPath Deploy] Machine "${m.name}" -> ${res.status}: ${text.slice(0, 500)}`);

      if (res.ok || res.status === 201) {
        const parsed = parseOrchestratorResponse(text);
        if (parsed.error) {
          results.push({ artifact: "Machine", name: m.name, status: "failed", message: `API returned ${res.status} but body contains error: ${parsed.error}` });
          continue;
        }
        const verify = await verifyArtifactExists(base, hdrs, "Machines", "Name", m.name, "Machine");
        if (verify.exists) {
          machineId = verify.id ? Number(verify.id) : null;
          let folderMsg = "";
          if (machineId) {
            const folderAssign = await assignMachineToFolder(base, hdrs, machineId);
            folderMsg = ` ${folderAssign.message}`;
          }
          results.push({ artifact: "Machine", name: m.name, status: "created", message: `Created and verified (ID: ${verify.id}, Type: Template).${folderMsg}`, id: verify.id });
        } else {
          results.push({ artifact: "Machine", name: m.name, status: "failed", message: `API returned ${res.status} but verification failed. ${verify.detail || ""}` });
        }
      } else if (res.status === 409 || text.includes("already exists")) {
        results.push({ artifact: "Machine", name: m.name, status: "exists", message: "Already exists" });
      } else {
        results.push({ artifact: "Machine", name: m.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 300)}` });
      }
    } catch (err: any) {
      results.push({ artifact: "Machine", name: m.name, status: "failed", message: err.message });
    }
  }

  const hasRobots = results.some(r => (r.status === "created" || r.status === "exists") && r.id);
  if (hasRobots) {
    results.push({
      artifact: "Robot Account",
      name: "Robot Account Check",
      status: "failed",
      message: "WARNING: Machine templates were provisioned, but robot accounts must be manually created in UiPath Orchestrator (Tenant > Robots > Add Standard Robot). Without robot accounts connected to these machine templates, scheduled triggers and unattended jobs will NOT execute. Go to Orchestrator > Tenant > Robots, create a robot account, and assign it to the machine template.",
    });
  }

  return results;
}

async function provisionStorageBuckets(
  base: string, hdrs: Record<string, string>,
  buckets: OrchestratorArtifacts["storageBuckets"]
): Promise<DeploymentResult[]> {
  if (!buckets?.length) return [];
  const results: DeploymentResult[] = [];

  for (const b of buckets) {
    try {
      const checkRes = await fetch(
        `${base}/odata/Buckets?$filter=Name eq '${odataEscape(b.name)}'&$top=1`,
        { headers: hdrs }
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.value?.length > 0) {
          results.push({ artifact: "Storage Bucket", name: b.name, status: "exists", message: `Already exists (ID: ${checkData.value[0].Id})`, id: checkData.value[0].Id });
          continue;
        }
      }

      const providers = ["Orchestrator", "Minio", "FileSystem"];
      let bucketCreated = false;

      for (const provider of providers) {
        const body = {
          Name: b.name,
          Description: b.description || "",
          Provider: provider,
        };

        const res = await fetch(`${base}/odata/Buckets`, {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify(body),
        });
        const text = await res.text();
        console.log(`[UiPath Deploy] Bucket "${b.name}" (Provider=${provider}) -> ${res.status}: ${text.slice(0, 300)}`);

        if (res.ok || res.status === 201) {
          const parsed = parseOrchestratorResponse(text);
          if (parsed.error) {
            results.push({ artifact: "Storage Bucket", name: b.name, status: "failed", message: `API returned ${res.status} but body contains error: ${parsed.error}` });
            bucketCreated = true;
            break;
          }
          const verify = await verifyArtifactExists(base, hdrs, "Buckets", "Name", b.name, "Storage Bucket");
          if (verify.exists) {
            results.push({ artifact: "Storage Bucket", name: b.name, status: "created", message: `Created and verified (ID: ${verify.id}, Provider: ${provider})`, id: verify.id });
          } else {
            results.push({ artifact: "Storage Bucket", name: b.name, status: "failed", message: `API returned ${res.status} but verification failed. ${verify.detail || ""}` });
          }
          bucketCreated = true;
          break;
        } else if (res.status === 409 || text.includes("already exists")) {
          results.push({ artifact: "Storage Bucket", name: b.name, status: "exists", message: "Already exists" });
          bucketCreated = true;
          break;
        } else if (text.includes("Provider") || text.includes("provider")) {
          continue;
        } else {
          results.push({ artifact: "Storage Bucket", name: b.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
          bucketCreated = true;
          break;
        }
      }
      if (!bucketCreated) {
        results.push({ artifact: "Storage Bucket", name: b.name, status: "failed", message: `All provider types rejected. Check API permissions for Storage Buckets.` });
      }
    } catch (err: any) {
      results.push({ artifact: "Storage Bucket", name: b.name, status: "failed", message: err.message });
    }
  }
  return results;
}

type RuntimeDetectionResult = {
  runtimeType: string;
  verified: boolean;
  hasUnattendedSlots: boolean;
  availableTypes: string[];
  warning?: string;
};

async function detectAvailableRuntimeType(base: string, hdrs: Record<string, string>): Promise<RuntimeDetectionResult> {
  const result: RuntimeDetectionResult = {
    runtimeType: "Unattended",
    verified: false,
    hasUnattendedSlots: false,
    availableTypes: [],
  };

  try {
    const machRes = await fetch(`${base}/odata/Machines?$top=50&$select=Id,Name,Type,UnattendedSlots,NonProductionSlots,TestAutomationSlots,HeadlessSlots`, { headers: hdrs });
    if (machRes.ok) {
      const machData = await machRes.json();
      const machines = machData.value || [];
      if (machines.length > 0) {
        const hasUnattended = machines.some((m: any) => (m.UnattendedSlots || 0) > 0);
        const hasNonProd = machines.some((m: any) => (m.NonProductionSlots || 0) > 0);
        const hasTestAuto = machines.some((m: any) => (m.TestAutomationSlots || 0) > 0);
        const hasHeadless = machines.some((m: any) => (m.HeadlessSlots || 0) > 0);

        result.hasUnattendedSlots = hasUnattended;
        if (hasUnattended) result.availableTypes.push("Unattended");
        if (hasNonProd) result.availableTypes.push("NonProduction");
        if (hasTestAuto) result.availableTypes.push("TestAutomation");
        if (hasHeadless) result.availableTypes.push("Headless");

        if (hasUnattended) {
          result.runtimeType = "Unattended";
          result.verified = true;
          console.log(`[UiPath Deploy] Runtime detection: Found ${machines.length} machine template(s) with Unattended slots`);
          return result;
        }
        if (hasNonProd) {
          result.runtimeType = "NonProduction";
          result.verified = true;
          console.log(`[UiPath Deploy] Runtime detection: No Unattended slots, using NonProduction`);
          return result;
        }

        console.warn(`[UiPath Deploy] Runtime detection: ${machines.length} machine template(s) found but NONE have Unattended or NonProduction slots`);
        result.warning = `${machines.length} machine template(s) found in folder but none have Unattended runtime slots configured. Triggers will fail until an Unattended runtime is assigned to a machine template in this folder.`;
      } else {
        console.warn(`[UiPath Deploy] Runtime detection: No machine templates found in folder`);
        result.warning = "No machine templates found in this folder. Triggers require at least one machine template with Unattended runtime slots.";
      }
    }
  } catch (err: any) {
    console.warn(`[UiPath Deploy] Machine template check failed: ${err.message}`);
  }

  try {
    const sessRes = await fetch(`${base}/odata/Sessions?$top=10&$select=RuntimeType,MachineId,MachineName`, { headers: hdrs });
    if (sessRes.ok) {
      const sessData = await sessRes.json();
      if (sessData.value?.length > 0) {
        const types = sessData.value.map((s: any) => s.RuntimeType).filter(Boolean);
        const uniqueTypes = Array.from(new Set(types as string[]));
        result.availableTypes = Array.from(new Set([...result.availableTypes, ...uniqueTypes]));

        if (types.includes("Unattended")) {
          result.runtimeType = "Unattended";
          result.verified = true;
          result.hasUnattendedSlots = true;
          result.warning = undefined;
          console.log(`[UiPath Deploy] Runtime detection: Found active Unattended session(s)`);
          return result;
        }
        if (types.includes("Production")) {
          result.runtimeType = "Production";
          result.verified = true;
          result.warning = undefined;
          return result;
        }
        if (uniqueTypes.length > 0) {
          result.runtimeType = uniqueTypes[0];
          result.verified = true;
          if (!result.warning) {
            result.warning = `No Unattended sessions found. Using "${uniqueTypes[0]}" runtime. Triggers may fail if this runtime type cannot execute scheduled jobs.`;
          }
          return result;
        }
      }
    }
  } catch { /* ignore */ }

  try {
    const robotRes = await fetch(`${base}/odata/Robots?$top=10&$select=Type,MachineName`, { headers: hdrs });
    if (robotRes.ok) {
      const robotData = await robotRes.json();
      if (robotData.value?.length > 0) {
        const types = robotData.value.map((r: any) => r.Type).filter(Boolean);
        const uniqueTypes = Array.from(new Set(types as string[]));
        result.availableTypes = Array.from(new Set([...result.availableTypes, ...uniqueTypes]));

        if (types.includes("Unattended")) {
          result.runtimeType = "Unattended";
          result.verified = true;
          result.hasUnattendedSlots = true;
          result.warning = undefined;
          return result;
        }
        if (uniqueTypes.length > 0) {
          result.runtimeType = uniqueTypes[0];
          result.verified = true;
          if (!result.warning) {
            result.warning = `No Unattended robots found. Using "${uniqueTypes[0]}" runtime.`;
          }
          return result;
        }
      }
    }
  } catch { /* ignore */ }

  if (!result.verified) {
    result.warning = result.warning || "Could not detect any runtime types in this folder. No machine templates, active sessions, or robots were found. Triggers will be created DISABLED — enable them after configuring an Unattended runtime in Orchestrator > Folder > Machine Templates.";
  }

  return result;
}

async function provisionTriggers(
  base: string, hdrs: Record<string, string>,
  triggers: OrchestratorArtifacts["triggers"],
  releaseId: number | null,
  releaseKey: string | null,
  releaseName: string | null,
  queueResults: DeploymentResult[],
  precomputedRuntime?: RuntimeDetectionResult
): Promise<DeploymentResult[]> {
  if (!triggers?.length) return [];
  if (!releaseId) {
    return triggers.map(t => ({
      artifact: "Trigger",
      name: t.name,
      status: "failed" as const,
      message: "No valid Process (Release) found — trigger requires a release to be linked to. Retry deployment after process creation succeeds.",
    }));
  }

  const runtimeDetection = precomputedRuntime || await detectAvailableRuntimeType(base, hdrs);
  const runtimeType = runtimeDetection.runtimeType;
  const createDisabled = !runtimeDetection.verified || !runtimeDetection.hasUnattendedSlots;
  console.log(`[UiPath Deploy] Using RuntimeType: ${runtimeType}, verified: ${runtimeDetection.verified}, hasUnattendedSlots: ${runtimeDetection.hasUnattendedSlots}, createDisabled: ${createDisabled}`);
  if (runtimeDetection.warning) {
    console.warn(`[UiPath Deploy] Runtime warning: ${runtimeDetection.warning}`);
  }

  const results: DeploymentResult[] = [];

  for (const t of triggers) {
    try {
      const triggerType = (t.type || "Time").toLowerCase();

      if (triggerType === "queue") {
        const checkRes = await fetch(
          `${base}/odata/QueueTriggers?$filter=Name eq '${odataEscape(t.name)}'&$top=1`,
          { headers: hdrs }
        );
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.value?.length > 0) {
            results.push({ artifact: "Trigger", name: t.name, status: "exists", message: `Already exists (ID: ${checkData.value[0].Id})`, id: checkData.value[0].Id });
            continue;
          }
        }

        let queueId: number | null = null;
        const qr = queueResults.find(q => q.name === t.queueName);
        if (qr?.id) {
          queueId = qr.id;
        } else if (t.queueName) {
          const qRes = await fetch(
            `${base}/odata/QueueDefinitions?$filter=Name eq '${odataEscape(t.queueName || '')}'&$top=1`,
            { headers: hdrs }
          );
          if (qRes.ok) {
            const qData = await qRes.json();
            if (qData.value?.length > 0) queueId = qData.value[0].Id;
          }
        }

        if (!queueId) {
          results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `Queue "${t.queueName}" not found in Orchestrator. Ensure queue was created successfully before trigger can be linked.` });
          continue;
        }

        const body: Record<string, any> = {
          Name: t.name,
          Enabled: !createDisabled,
          ReleaseId: releaseId,
          ReleaseName: releaseName || "",
          QueueDefinitionId: queueId,
          MinNumberOfItems: 1,
          MaxNumberOfItems: 100,
          JobsCount: 1,
          RuntimeType: runtimeType,
          InputArguments: "{}",
        };

        console.log(`[UiPath Deploy] Queue Trigger "${t.name}" payload: ${JSON.stringify(body)}`);

        const res = await fetch(`${base}/odata/QueueTriggers`, {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify(body),
        });
        const text = await res.text();
        console.log(`[UiPath Deploy] Queue Trigger "${t.name}" -> ${res.status}: ${text}`);

        if (res.ok || res.status === 201) {
          const parsed = parseOrchestratorResponse(text);
          if (parsed.error) {
            results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `API returned ${res.status} but body contains error: ${parsed.error}` });
            continue;
          }
          const returnedId = parsed.data?.Id || parsed.data?.id;
          const verify = await verifyArtifactExists(base, hdrs, "QueueTriggers", "Name", t.name, "Queue Trigger", returnedId);
          if (verify.exists) {
            const disabledNote = createDisabled ? ` [CREATED DISABLED — ${runtimeDetection.warning || "No Unattended runtime verified"}. Enable in Orchestrator after configuring runtimes.]` : "";
            results.push({ artifact: "Trigger", name: t.name, status: "created", message: `Queue trigger created and verified (ID: ${verify.id}), linked to queue "${t.queueName}"${disabledNote}`, id: verify.id });
          } else {
            results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `API returned ${res.status} with ID ${returnedId} but verification failed — trigger not found in Orchestrator. ${verify.detail || ""}. Response: ${text.slice(0, 300)}` });
          }
        } else if (res.status === 409 || text.includes("already exists")) {
          results.push({ artifact: "Trigger", name: t.name, status: "exists", message: "Already exists" });
        } else if (res.status === 405) {
          const schedBody: Record<string, any> = {
            Enabled: !createDisabled,
            Name: t.name,
            ReleaseId: releaseId,
            ReleaseName: releaseName || "",
            StartProcessCron: "0 */5 * ? * *",
            StartProcessCronDetails: JSON.stringify({ type: 5, minutely: {}, hourly: {}, daily: {}, weekly: { weekdays: [] }, monthly: { weekdays: [] }, advancedCronExpression: "0 */5 * ? * *" }),
            StartProcessCronSummary: `Queue polling for ${t.queueName}`,
            TimeZoneId: "UTC",
            TimeZoneIana: "Etc/UTC",
            StartStrategy: 15,
            RuntimeType: runtimeType,
            InputArguments: JSON.stringify({ QueueName: t.queueName }),
          };
          const schedRes = await fetch(`${base}/odata/ProcessSchedules`, { method: "POST", headers: hdrs, body: JSON.stringify(schedBody) });
          const schedText = await schedRes.text();
          console.log(`[UiPath Deploy] Queue Trigger "${t.name}" fallback to ProcessSchedule -> ${schedRes.status}: ${schedText}`);
          if (schedRes.ok || schedRes.status === 201) {
            const parsed = parseOrchestratorResponse(schedText);
            if (parsed.error) {
              results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `ProcessSchedule fallback API returned ${schedRes.status} but body contains error: ${parsed.error}` });
              continue;
            }
            const schedReturnedId = parsed.data?.Id || parsed.data?.id;
            const verify = await verifyArtifactExists(base, hdrs, "ProcessSchedules", "Name", t.name, "Scheduled Trigger", schedReturnedId);
            if (verify.exists) {
              const disabledNote = createDisabled ? ` [CREATED DISABLED — ${runtimeDetection.warning || "No Unattended runtime verified"}. Enable after configuring runtimes.]` : "";
              results.push({ artifact: "Trigger", name: t.name, status: "created", message: `Created as scheduled trigger and verified (ID: ${verify.id}) polling queue "${t.queueName}" every 5 min${disabledNote}`, id: verify.id });
            } else {
              results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `ProcessSchedule fallback returned ${schedRes.status} but verification failed — trigger not found. ${verify.detail || ""}` });
            }
          } else {
            results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `QueueTriggers API returned 405, ProcessSchedule fallback also failed (${schedRes.status}): ${schedText.slice(0, 300)}` });
          }
        } else {
          results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 300)}` });
        }
      } else {
        const checkRes = await fetch(
          `${base}/odata/ProcessSchedules?$filter=Name eq '${odataEscape(t.name)}'&$top=1`,
          { headers: hdrs }
        );
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.value?.length > 0) {
            results.push({ artifact: "Trigger", name: t.name, status: "exists", message: `Already exists (ID: ${checkData.value[0].Id})`, id: checkData.value[0].Id });
            continue;
          }
        }

        const cron = t.cron || "0 0 9 ? * MON-FRI *";
        const cronDetails = JSON.stringify({
          type: 5,
          minutely: {},
          hourly: {},
          daily: {},
          weekly: { weekdays: [] },
          monthly: { weekdays: [] },
          advancedCronExpression: cron,
        });

        const baseBody: Record<string, any> = {
          Enabled: !createDisabled,
          Name: t.name,
          ReleaseId: releaseId,
          ReleaseName: releaseName || "",
          ReleaseKey: releaseKey || "",
          StartProcessCron: cron,
          StartProcessCronDetails: cronDetails,
          StartProcessCronSummary: t.description || "Scheduled trigger",
          TimeZoneId: "UTC",
          TimeZoneIana: "Etc/UTC",
          RuntimeType: runtimeType,
          InputArguments: "{}",
        };

        const strategies = [15, 0, { Type: 0 }];
        let created = false;
        for (const strategy of strategies) {
          const body = { ...baseBody, StartStrategy: strategy };
          console.log(`[UiPath Deploy] Time Trigger "${t.name}" trying StartStrategy=${JSON.stringify(strategy)}, payload: ${JSON.stringify(body)}`);

          const res = await fetch(`${base}/odata/ProcessSchedules`, {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify(body),
          });
          const text = await res.text();
          console.log(`[UiPath Deploy] Time Trigger "${t.name}" -> ${res.status}: ${text}`);

          if (res.ok || res.status === 201) {
            const parsed = parseOrchestratorResponse(text);
            if (parsed.error) {
              results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `API returned ${res.status} but body contains error: ${parsed.error}` });
              created = true;
              break;
            }
            const timeReturnedId = parsed.data?.Id || parsed.data?.id;
            const verify = await verifyArtifactExists(base, hdrs, "ProcessSchedules", "Name", t.name, "Time Trigger", timeReturnedId);
            if (verify.exists) {
              const disabledNote = createDisabled ? ` [CREATED DISABLED — ${runtimeDetection.warning || "No Unattended runtime verified"}. Enable in Orchestrator after configuring runtimes.]` : "";
              results.push({ artifact: "Trigger", name: t.name, status: "created", message: `Time trigger created and verified (ID: ${verify.id}), cron: ${cron}${disabledNote}`, id: verify.id });
            } else {
              results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `API returned ${res.status} with ID ${timeReturnedId} but verification failed — trigger not found in Orchestrator. ${verify.detail || ""}. Response: ${text.slice(0, 300)}` });
            }
            created = true;
            break;
          } else if (res.status === 405) {
            results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `ProcessSchedules API returned 405 — scheduled triggers endpoint not available on this Orchestrator version. Cron: ${cron}` });
            created = true;
            break;
          } else if (res.status === 409 || text.includes("already exists")) {
            results.push({ artifact: "Trigger", name: t.name, status: "exists", message: "Already exists" });
            created = true;
            break;
          } else if (text.includes("StartStrategy")) {
            continue;
          } else {
            results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 300)}` });
            created = true;
            break;
          }
        }
        if (!created) {
          results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `All StartStrategy formats rejected (tried 15, 0, {Type:0}). Check Orchestrator API version compatibility. Cron: ${cron}` });
        }
      }
    } catch (err: any) {
      results.push({ artifact: "Trigger", name: t.name, status: "failed", message: err.message });
    }
  }
  return results;
}

async function provisionEnvironments(
  base: string, hdrs: Record<string, string>,
  environments: OrchestratorArtifacts["environments"]
): Promise<DeploymentResult[]> {
  if (!environments?.length) return [];
  const results: DeploymentResult[] = [];

  for (const env of environments) {
    try {
      const checkRes = await fetch(
        `${base}/odata/Environments?$filter=Name eq '${odataEscape(env.name)}'&$top=1`,
        { headers: hdrs }
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.value?.length > 0) {
          results.push({ artifact: "Environment", name: env.name, status: "exists", message: `Already exists (ID: ${checkData.value[0].Id})`, id: checkData.value[0].Id });
          continue;
        }
      }

      const envType = (env.type || "Production").toLowerCase();
      let typeValue = "Prod";
      if (envType.includes("dev")) typeValue = "Dev";
      else if (envType.includes("test")) typeValue = "Test";

      const bodyVariants = [
        { Name: env.name, Description: env.description || "", Type: typeValue },
        { Name: env.name, Description: env.description || "" },
      ];

      let envCreated = false;
      for (const body of bodyVariants) {
        const res = await fetch(`${base}/odata/Environments`, {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify(body),
        });
        const text = await res.text();
        console.log(`[UiPath Deploy] Environment "${env.name}" (body keys: ${Object.keys(body).join(",")}) -> ${res.status}: ${text.slice(0, 300)}`);

        if (res.ok || res.status === 201) {
          const parsed = parseOrchestratorResponse(text);
          if (parsed.error) {
            results.push({ artifact: "Environment", name: env.name, status: "failed", message: `API returned ${res.status} but body contains error: ${parsed.error}` });
            envCreated = true;
            break;
          }
          const verify = await verifyArtifactExists(base, hdrs, "Environments", "Name", env.name, "Environment");
          if (verify.exists) {
            results.push({ artifact: "Environment", name: env.name, status: "created", message: `Created and verified (ID: ${verify.id}, Type: ${typeValue})`, id: verify.id });
          } else {
            results.push({ artifact: "Environment", name: env.name, status: "failed", message: `API returned ${res.status} but verification failed. ${verify.detail || ""}` });
          }
          envCreated = true;
          break;
        } else if (res.status === 409 || text.includes("already exists")) {
          results.push({ artifact: "Environment", name: env.name, status: "exists", message: "Already exists" });
          envCreated = true;
          break;
        } else if (text.includes("Type") && body.Type) {
          continue;
        } else {
          results.push({ artifact: "Environment", name: env.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
          envCreated = true;
          break;
        }
      }
      if (!envCreated) {
        results.push({ artifact: "Environment", name: env.name, status: "failed", message: `All body formats rejected by Environments API. Check API version.` });
      }
    } catch (err: any) {
      results.push({ artifact: "Environment", name: env.name, status: "failed", message: err.message });
    }
  }
  return results;
}

async function provisionActionCenter(
  base: string, hdrs: Record<string, string>,
  actionCenter: OrchestratorArtifacts["actionCenter"],
  config: UiPathConfig
): Promise<DeploymentResult[]> {
  if (!actionCenter?.length) return [];
  const results: DeploymentResult[] = [];

  const cloudBase = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}`;
  const endpoints = [
    { url: `${base}/odata/TaskCatalogs`, label: "Orchestrator OData", isOdata: true },
    { url: `${cloudBase}/actions_/api/v1/task-catalogs`, label: "Actions API v1", isOdata: false },
    { url: `${cloudBase}/tasks_/api/tasks/v1/task-catalogs`, label: "Tasks API v1", isOdata: false },
    { url: `${cloudBase}/maestro_/api/v1/task-catalogs`, label: "Maestro API", isOdata: false },
  ];

  let serviceAvailable = false;
  let activeAcEndpoint: typeof endpoints[0] | null = null;
  for (const ep of endpoints) {
    try {
      const probeUrl = ep.isOdata ? `${ep.url}?$top=1` : `${ep.url}?top=1`;
      const probeRes = await fetch(probeUrl, { headers: hdrs });
      const probeText = await probeRes.text();
      console.log(`[UiPath Deploy] Action Center probe ${ep.label} -> ${probeRes.status}: ${probeText.slice(0, 200)}`);

      if (probeRes.ok) {
        const genuineCheck = isGenuineServiceResponse(probeText);
        if (!genuineCheck.genuine) {
          console.log(`[UiPath Deploy] Action Center probe ${ep.label} returned 200 but not genuine: ${genuineCheck.reason}`);
          continue;
        }
        serviceAvailable = true;
        activeAcEndpoint = ep;
        break;
      }
      if (probeRes.status === 400) {
        if (probeText.includes("ServiceType is not onboarded") || probeText.includes("not onboarded")) {
          continue;
        }
        serviceAvailable = true;
        activeAcEndpoint = ep;
        break;
      }
      if (probeRes.status === 401 || probeRes.status === 403) {
        serviceAvailable = true;
        activeAcEndpoint = ep;
        break;
      }
    } catch { continue; }
  }

  if (!serviceAvailable) {
    return actionCenter.map(ac => ({
      artifact: "Action Center",
      name: ac.taskCatalog,
      status: "skipped" as const,
      message: "Action Center API not available on this tenant. Enable it in Admin > Tenant > Services, then assign it to the target folder.",
    }));
  }

  const tryEndpoints = activeAcEndpoint ? [activeAcEndpoint, ...endpoints.filter(e => e !== activeAcEndpoint)] : endpoints;

  for (const ac of actionCenter) {
    try {
      let found = false;
      for (const ep of tryEndpoints) {
        try {
          const filterUrl = ep.isOdata
            ? `${ep.url}?$filter=Name eq '${odataEscape(ac.taskCatalog)}'&$top=1`
            : `${ep.url}?name=${encodeURIComponent(ac.taskCatalog)}&top=1`;
          const checkRes = await fetch(filterUrl, { headers: hdrs });
          if (checkRes.ok) {
            const checkText = await checkRes.text();
            const genuineCheck = isGenuineServiceResponse(checkText);
            if (!genuineCheck.genuine) continue;
            const checkData = JSON.parse(checkText);
            const items = checkData.value || checkData.items || (Array.isArray(checkData) ? checkData : []);
            if (items.length > 0) {
              results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "exists", message: `Already exists (ID: ${items[0].Id || items[0].id})`, id: items[0].Id || items[0].id });
              found = true;
              break;
            }
          }
        } catch { continue; }
      }
      if (found) continue;

      const body: Record<string, any> = { Name: ac.taskCatalog, Description: ac.description || "" };
      let acCreated = false;
      for (const ep of tryEndpoints) {
        try {
          const res = await fetch(ep.url, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
          const text = await res.text();
          console.log(`[UiPath Deploy] Action Center "${ac.taskCatalog}" via ${ep.label} -> ${res.status}: ${text.slice(0, 300)}`);

          if (res.ok || res.status === 201) {
            const creation = validateCreationResponse(text);
            if (!creation.valid) {
              console.warn(`[UiPath Deploy] Action Center "${ac.taskCatalog}" got ${res.status} but body invalid: ${creation.error}`);
              results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "failed", message: `API returned ${res.status} but response invalid: ${creation.error}` });
              acCreated = true;
              break;
            }
            const createdId = creation.data?.Id || creation.data?.id;

            let verified = false;
            if (createdId) {
              try {
                const filterUrl = ep.isOdata
                  ? `${ep.url}?$filter=Name eq '${odataEscape(ac.taskCatalog)}'&$top=1`
                  : `${ep.url}?name=${encodeURIComponent(ac.taskCatalog)}&top=1`;
                const verifyRes = await fetch(filterUrl, { headers: hdrs });
                if (verifyRes.ok) {
                  const verifyText = await verifyRes.text();
                  const verifyCheck = isGenuineServiceResponse(verifyText);
                  if (verifyCheck.genuine) {
                    const verifyData = JSON.parse(verifyText);
                    const items = verifyData.value || verifyData.items || (Array.isArray(verifyData) ? verifyData : []);
                    if (items.length > 0) {
                      verified = true;
                    }
                  }
                }
              } catch { /* verification failed */ }
            }

            if (verified) {
              let msg = `Created and verified (ID: ${createdId})`;
              if (ac.assignedRole) msg += `. Assign to role: ${ac.assignedRole}`;
              if (ac.sla) msg += `. SLA: ${ac.sla}`;
              results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "created", message: msg, id: createdId });
            } else {
              results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "failed", message: `API returned ${res.status} but post-creation verification failed — catalog may not actually exist` });
            }
            acCreated = true;
            break;
          } else if (res.status === 409 || text.includes("already exists")) {
            results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "exists", message: "Already exists" });
            acCreated = true;
            break;
          } else if (res.status === 404 || res.status === 405) {
            continue;
          } else if (res.status === 400 && text.includes("not onboarded")) {
            continue;
          } else {
            results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
            acCreated = true;
            break;
          }
        } catch { continue; }
      }
      if (!acCreated) {
        results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "skipped", message: `Action Center API endpoints not responding. The service may need to be enabled for this folder in Orchestrator settings.` });
      }
    } catch (err: any) {
      results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "failed", message: `API error: ${err.message}` });
    }
  }
  return results;
}

async function provisionDocUnderstanding(
  config: UiPathConfig,
  token: string,
  du: OrchestratorArtifacts["documentUnderstanding"]
): Promise<DeploymentResult[]> {
  if (!du?.length) return [];
  const results: DeploymentResult[] = [];

  const cloudBase = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}`;
  const hdrs: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const endpoints = [
    { url: `${cloudBase}/du_/api/framework/projects`, label: "DU Framework API" },
    { url: `${cloudBase}/du_/api/v1/projects`, label: "DU API v1" },
    { url: `${cloudBase}/aifabric_/ai-deployer/v1/projects`, label: "AI Center Deployer" },
    { url: `${cloudBase}/aifabric_/api/v1/projects`, label: "AI Fabric API" },
  ];

  let serviceAvailable = false;
  let activeEndpoint: typeof endpoints[0] | null = null;
  for (const ep of endpoints) {
    try {
      const probeRes = await fetch(`${ep.url}?$top=1`, { headers: hdrs });
      const probeText = await probeRes.text();
      console.log(`[UiPath Deploy] DU probe ${ep.label} -> ${probeRes.status}: ${probeText.slice(0, 200)}`);

      if (probeRes.ok) {
        const genuineCheck = isGenuineServiceResponse(probeText);
        if (!genuineCheck.genuine) {
          console.log(`[UiPath Deploy] DU probe ${ep.label} returned 200 but not genuine: ${genuineCheck.reason}`);
          continue;
        }
        serviceAvailable = true;
        activeEndpoint = ep;
        break;
      }
      if (probeRes.status === 401 || probeRes.status === 403) {
        serviceAvailable = true;
        activeEndpoint = ep;
        break;
      }
    } catch { continue; }
  }

  if (!serviceAvailable) {
    return du.map(project => ({
      artifact: "Document Understanding",
      name: project.name,
      status: "skipped" as const,
      message: `DU API not reachable. Document types needed: ${project.documentTypes?.join(", ") || "N/A"}. Create the DU project manually in Document Understanding service.`,
    }));
  }

  for (const project of du) {
    try {
      let found = false;
      if (activeEndpoint) {
        try {
          const checkRes = await fetch(`${activeEndpoint.url}?$top=50`, { headers: hdrs });
          if (checkRes.ok) {
            const checkText = await checkRes.text();
            const genuineCheck = isGenuineServiceResponse(checkText);
            if (genuineCheck.genuine) {
              const checkData = JSON.parse(checkText);
              const items = checkData.value || checkData.items || (Array.isArray(checkData) ? checkData : []);
              const existing = items.find((p: any) => (p.Name || p.name) === project.name);
              if (existing) {
                results.push({ artifact: "Document Understanding", name: project.name, status: "exists", message: `Already exists (ID: ${existing.Id || existing.id}). Doc types: ${project.documentTypes?.join(", ") || "N/A"}`, id: existing.Id || existing.id });
                found = true;
              }
            }
          }
        } catch { /* continue to create */ }
      }
      if (found) continue;

      let created = false;
      const tryEndpoints = activeEndpoint ? [activeEndpoint, ...endpoints.filter(e => e !== activeEndpoint)] : endpoints;
      for (const ep of tryEndpoints) {
        try {
          const body = {
            Name: project.name,
            Description: project.description || `Document Understanding project for ${project.name}`,
            DocumentTypes: project.documentTypes || [],
          };
          const res = await fetch(ep.url, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
          const text = await res.text();
          console.log(`[UiPath Deploy] DU project "${project.name}" via ${ep.label} -> ${res.status}: ${text.slice(0, 300)}`);

          if (res.ok || res.status === 201) {
            const creation = validateCreationResponse(text);
            if (!creation.valid) {
              console.warn(`[UiPath Deploy] DU "${project.name}" got ${res.status} but body invalid: ${creation.error}`);
              results.push({ artifact: "Document Understanding", name: project.name, status: "failed", message: `API returned ${res.status} but response invalid: ${creation.error}` });
              created = true;
              break;
            }
            const createdId = creation.data?.Id || creation.data?.id;

            let verified = false;
            try {
              const verifyRes = await fetch(`${ep.url}?$top=50`, { headers: hdrs });
              if (verifyRes.ok) {
                const verifyText = await verifyRes.text();
                const verifyCheck = isGenuineServiceResponse(verifyText);
                if (verifyCheck.genuine) {
                  const verifyData = JSON.parse(verifyText);
                  const items = verifyData.value || verifyData.items || (Array.isArray(verifyData) ? verifyData : []);
                  const match = items.find((p: any) => (p.Name || p.name) === project.name || (p.Id || p.id) === createdId);
                  if (match) {
                    verified = true;
                  }
                }
              }
            } catch { /* verification failed */ }

            if (verified) {
              results.push({ artifact: "Document Understanding", name: project.name, status: "created", message: `Created and verified via ${ep.label} (ID: ${createdId}). Doc types: ${project.documentTypes?.join(", ") || "N/A"}`, id: createdId });
            } else {
              results.push({ artifact: "Document Understanding", name: project.name, status: "failed", message: `API returned ${res.status} but post-creation verification failed — DU project may not actually exist. Doc types needed: ${project.documentTypes?.join(", ") || "N/A"}` });
            }
            created = true;
            break;
          } else if (res.status === 409 || text.includes("already exists")) {
            results.push({ artifact: "Document Understanding", name: project.name, status: "exists", message: `Already exists. Doc types: ${project.documentTypes?.join(", ") || "N/A"}` });
            created = true;
            break;
          } else if (res.status === 404 || res.status === 405) {
            continue;
          } else {
            results.push({ artifact: "Document Understanding", name: project.name, status: "skipped", message: `${ep.label} returned HTTP ${res.status}. Doc types needed: ${project.documentTypes?.join(", ") || "N/A"}. Create the DU project manually.` });
            created = true;
            break;
          }
        } catch { continue; }
      }

      if (!created) {
        results.push({ artifact: "Document Understanding", name: project.name, status: "skipped", message: `Could not create DU project via API. Doc types needed: ${project.documentTypes?.join(", ") || "N/A"}. Create manually in Document Understanding service.` });
      }
    } catch (err: any) {
      results.push({ artifact: "Document Understanding", name: project.name, status: "failed", message: `API error: ${err.message}` });
    }
  }
  return results;
}

async function provisionTestCases(
  config: UiPathConfig,
  token: string,
  testCases: OrchestratorArtifacts["testCases"],
  processName: string
): Promise<DeploymentResult[]> {
  if (!testCases?.length) return [];
  const results: DeploymentResult[] = [];

  const tmBases = [
    `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/testmanager_`,
    `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/tmapi_`,
  ];
  const hdrs: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  let activeTmBase: string | null = null;
  let projectId: number | null = null;

  for (const tmBase of tmBases) {
    try {
      const projRes = await fetch(`${tmBase}/api/v2/projects?$top=10`, { headers: hdrs });
      const probeText = await projRes.text();
      console.log(`[UiPath Deploy] Test Manager probe ${tmBase} -> ${projRes.status}: ${probeText.slice(0, 200)}`);

      if (projRes.ok) {
        const genuineCheck = isGenuineServiceResponse(probeText);
        if (!genuineCheck.genuine) {
          console.log(`[UiPath Deploy] Test Manager probe returned 200 but is not genuine: ${genuineCheck.reason}`);
          continue;
        }

        activeTmBase = tmBase;
        try {
          const projData = JSON.parse(probeText);
          if (projData.value?.length > 0) {
            const match = projData.value.find((p: any) =>
              p.Name?.toLowerCase().includes(processName.toLowerCase().replace(/_/g, " ")) ||
              processName.toLowerCase().includes(p.Name?.toLowerCase())
            );
            projectId = match?.Id || projData.value[0].Id;
          }
        } catch { /* valid service but empty/unparseable list — continue to create project */ }
        break;
      }
    } catch { continue; }
  }

  if (!activeTmBase) {
    return [{
      artifact: "Test Case",
      name: `${testCases.length} test case(s)`,
      status: "skipped" as const,
      message: `Test Manager not available on this tenant. ${testCases.length} test cases were defined but cannot be provisioned. Test Manager requires an Enterprise license.`,
    }];
  }

  if (!projectId) {
    try {
      const createProjRes = await fetch(`${activeTmBase}/api/v2/projects`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          Name: processName.replace(/_/g, " "),
          Description: `Test project for ${processName}`,
        }),
      });
      const createText = await createProjRes.text();
      if (createProjRes.ok || createProjRes.status === 201) {
        const creation = validateCreationResponse(createText);
        if (creation.valid && creation.data?.Id) {
          projectId = creation.data.Id;
          results.push({ artifact: "Test Project", name: processName, status: "created", message: `Created test project (ID: ${projectId})`, id: projectId! });
        } else {
          console.warn(`[UiPath Deploy] Test project creation returned ${createProjRes.status} but validation failed: ${creation.error}`);
        }
      }
    } catch { /* fall through */ }
  }

  if (!projectId) {
    return [
      ...results,
      ...testCases.map(tc => ({
        artifact: "Test Case",
        name: tc.name,
        status: "failed" as const,
        message: `Could not find or create test project in Test Manager. Check API permissions.`,
      })),
    ];
  }

  for (const tc of testCases) {
    try {
      const body: Record<string, any> = {
        Name: tc.name,
        Description: tc.description || "",
        ProjectId: projectId,
      };

      if (tc.steps?.length) {
        body.ManualSteps = tc.steps.map((s, idx) => ({
          StepDescription: s.action,
          ExpectedResult: s.expected,
          Order: idx + 1,
        }));
      }

      const res = await fetch(`${activeTmBase}/api/v2/projects/${projectId}/testcases`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify(body),
      });
      const text = await res.text();
      console.log(`[UiPath Deploy] Test Case "${tc.name}" -> ${res.status}: ${text.slice(0, 300)}`);

      if (res.ok || res.status === 201) {
        const creation = validateCreationResponse(text);
        if (!creation.valid) {
          console.warn(`[UiPath Deploy] Test Case "${tc.name}" got ${res.status} but body validation failed: ${creation.error}`);
          results.push({ artifact: "Test Case", name: tc.name, status: "failed", message: `API returned ${res.status} but response invalid: ${creation.error}` });
          continue;
        }
        const createdId = creation.data?.Id || creation.data?.id;

        let verified = false;
        if (createdId) {
          try {
            const verifyRes = await fetch(`${activeTmBase}/api/v2/projects/${projectId}/testcases/${createdId}`, { headers: hdrs });
            if (verifyRes.ok) {
              const verifyText = await verifyRes.text();
              const verifyCheck = isGenuineServiceResponse(verifyText);
              if (verifyCheck.genuine) {
                verified = true;
              } else {
                console.warn(`[UiPath Deploy] Test Case "${tc.name}" verify returned 200 but not genuine: ${verifyCheck.reason}`);
              }
            }
          } catch { /* verification failed */ }
        }

        if (verified) {
          results.push({ artifact: "Test Case", name: tc.name, status: "created", message: `Created and verified (ID: ${createdId})${tc.steps?.length ? `, ${tc.steps.length} manual steps` : ""}`, id: createdId });
        } else {
          try {
            const listRes = await fetch(`${activeTmBase}/api/v2/projects/${projectId}/testcases?$filter=Name eq '${odataEscape(tc.name)}'&$top=1`, { headers: hdrs });
            if (listRes.ok) {
              const listText = await listRes.text();
              const listCheck = isGenuineServiceResponse(listText);
              if (listCheck.genuine) {
                const listData = JSON.parse(listText);
                const items = listData.value || listData.items || (Array.isArray(listData) ? listData : []);
                if (items.length > 0) {
                  results.push({ artifact: "Test Case", name: tc.name, status: "created", message: `Created and verified by name (ID: ${items[0].Id || items[0].id})${tc.steps?.length ? `, ${tc.steps.length} manual steps` : ""}`, id: items[0].Id || items[0].id });
                  verified = true;
                }
              }
            }
          } catch { /* fallback verification failed */ }

          if (!verified) {
            results.push({ artifact: "Test Case", name: tc.name, status: "failed", message: `API returned ${res.status} but post-creation verification failed — test case may not actually exist` });
          }
        }
      } else if (res.status === 409 || text.includes("already exists")) {
        results.push({ artifact: "Test Case", name: tc.name, status: "exists", message: "Already exists" });
      } else {
        results.push({ artifact: "Test Case", name: tc.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
      }
    } catch (err: any) {
      results.push({ artifact: "Test Case", name: tc.name, status: "failed", message: err.message });
    }
  }

  return results;
}

export async function deployAllArtifacts(
  artifacts: OrchestratorArtifacts,
  releaseId: number | null,
  releaseKey: string | null,
  releaseName: string | null = null
): Promise<{ results: DeploymentResult[]; summary: string }> {
  const config = await getUiPathConfig();
  if (!config) {
    return { results: [], summary: "UiPath is not configured." };
  }

  const allResults: DeploymentResult[] = [];

  try {
    const token = await getAccessToken(config);
    const base = orchBase(config);
    const hdrs = headers(config, token);

    console.log(`[UiPath Deploy] Starting full deployment...`);

    const validation = await verifyFolderAndRelease(base, hdrs, releaseId, config.folderId);
    if (!validation.valid) {
      console.error(`[UiPath Deploy] Pre-deployment validation failed: ${validation.message}`);
      return { results: [], summary: `Pre-deployment validation failed: ${validation.message}` };
    }
    if (validation.releaseKey) releaseKey = validation.releaseKey;
    if (validation.releaseName) releaseName = validation.releaseName;

    const queueResults = await provisionQueues(base, hdrs, artifacts.queues);
    allResults.push(...queueResults);

    const bucketResults = await provisionStorageBuckets(base, hdrs, artifacts.storageBuckets);
    allResults.push(...bucketResults);

    const assetResults = await provisionAssets(base, hdrs, artifacts.assets);
    allResults.push(...assetResults);

    const machineResults = await provisionMachines(base, hdrs, artifacts.machines);
    allResults.push(...machineResults);

    const envResults = await provisionEnvironments(base, hdrs, artifacts.environments);
    allResults.push(...envResults);

    const runtimeCheck = await detectAvailableRuntimeType(base, hdrs);
    if (runtimeCheck.warning && (artifacts.triggers?.length || 0) > 0) {
      allResults.push({
        artifact: "Runtime Check",
        name: "Unattended Runtime",
        status: runtimeCheck.verified && runtimeCheck.hasUnattendedSlots ? "exists" : "failed",
        message: runtimeCheck.warning || (runtimeCheck.verified ? `Runtime type "${runtimeCheck.runtimeType}" verified` : "No runtimes detected"),
      });
    }

    const triggerResults = await provisionTriggers(base, hdrs, artifacts.triggers, releaseId, releaseKey, releaseName, queueResults, runtimeCheck);
    allResults.push(...triggerResults);

    const actionCenterResults = await provisionActionCenter(base, hdrs, artifacts.actionCenter, config);
    allResults.push(...actionCenterResults);

    const duResults = await provisionDocUnderstanding(config, token, artifacts.documentUnderstanding);
    allResults.push(...duResults);

    const testResults = await provisionTestCases(config, token, artifacts.testCases, releaseName || "Automation");
    allResults.push(...testResults);

    const created = allResults.filter(r => r.status === "created").length;
    const existed = allResults.filter(r => r.status === "exists").length;
    const failed = allResults.filter(r => r.status === "failed").length;
    const skipped = allResults.filter(r => r.status === "skipped").length;

    let summary = `Deployment complete: ${created} created, ${existed} already existed`;
    if (skipped > 0) summary += `, ${skipped} skipped (service unavailable)`;
    if (failed > 0) summary += `, ${failed} failed`;

    console.log(`[UiPath Deploy] ${summary}`);
    return { results: allResults, summary };
  } catch (err: any) {
    console.error(`[UiPath Deploy] Fatal error:`, err.message);
    return { results: allResults, summary: `Deployment failed: ${err.message}` };
  }
}

export function formatDeploymentReport(results: DeploymentResult[]): string {
  if (results.length === 0) return "";

  const lines: string[] = ["\n---\n**Orchestrator Deployment Report**\n"];

  const runtimeChecks = results.filter(r => r.artifact === "Runtime Check");
  const deployResults = results.filter(r => r.artifact !== "Runtime Check");

  if (runtimeChecks.length > 0) {
    for (const rc of runtimeChecks) {
      if (rc.status === "failed") {
        lines.push(`⚠️ **Runtime Configuration Issue:** ${rc.message}`);
        lines.push(`> Triggers have been created in a DISABLED state to prevent Orchestrator errors. To fix:`);
        lines.push(`> 1. Go to Orchestrator > your folder > Machine Templates`);
        lines.push(`> 2. Assign an Unattended runtime to a machine template`);
        lines.push(`> 3. Enable the triggers in Orchestrator > Triggers`);
        lines.push("");
      }
    }
  }

  const grouped: Record<string, DeploymentResult[]> = {};
  for (const r of deployResults) {
    if (!grouped[r.artifact]) grouped[r.artifact] = [];
    grouped[r.artifact].push(r);
  }

  const statusIcon = (s: string) => {
    switch (s) {
      case "created": return "✅";
      case "exists": return "🔵";
      case "skipped": return "⚠️";
      case "failed": return "❌";
      default: return "•";
    }
  };

  for (const [artifact, items] of Object.entries(grouped)) {
    lines.push(`**${artifact}s:**`);
    for (const item of items) {
      lines.push(`${statusIcon(item.status)} ${item.name} — ${item.message}`);
    }
    lines.push("");
  }

  const created = deployResults.filter(r => r.status === "created").length;
  const failed = deployResults.filter(r => r.status === "failed").length;
  const skipped = deployResults.filter(r => r.status === "skipped").length;
  const hasRuntimeIssue = runtimeChecks.some(r => r.status === "failed");

  if (failed > 0) {
    lines.push(`**${failed} item(s) failed** — check permissions and retry from Orchestrator.`);
  }
  if (skipped > 0) {
    lines.push(`**${skipped} item(s) skipped** — these services are not available on your tenant or require manual setup.`);
  }
  if (hasRuntimeIssue) {
    lines.push("**Action Required:** Configure an Unattended runtime in your Orchestrator folder before enabling triggers.");
  }
  if (created > 0 && failed === 0 && skipped === 0 && !hasRuntimeIssue) {
    lines.push("All artifacts provisioned successfully. The automation is fully deployed.");
  } else if (created > 0 && failed === 0 && skipped > 0 && !hasRuntimeIssue) {
    lines.push("Core artifacts provisioned successfully. Skipped items require manual setup or are not available on your tenant.");
  }

  return lines.join("\n");
}
