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
  status: "created" | "exists" | "failed";
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
      console.log(`[UiPath Deploy] Queue "${q.name}" -> ${res.status}: ${text.slice(0, 300)}`);

      if (res.ok || res.status === 201) {
        const data = JSON.parse(text);
        results.push({ artifact: "Queue", name: q.name, status: "created", message: `Created (ID: ${data.Id})`, id: data.Id });
      } else if (res.status === 409 || text.includes("already exists")) {
        results.push({ artifact: "Queue", name: q.name, status: "exists", message: "Already exists" });
      } else {
        results.push({ artifact: "Queue", name: q.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
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
        const res = await fetch(`${base}/odata/Assets`, {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify(body),
        });
        const text = await res.text();
        console.log(`[UiPath Deploy] Asset "${a.name}" (Credential) -> ${res.status}: ${text.slice(0, 300)}`);

        if (res.ok || res.status === 201) {
          const data = JSON.parse(text);
          results.push({ artifact: "Asset", name: a.name, status: "created", message: `Created as Credential placeholder (ID: ${data.Id}). UPDATE credentials in Orchestrator > Assets.`, id: data.Id });
        } else if (res.status === 409 || text.includes("already exists")) {
          results.push({ artifact: "Asset", name: a.name, status: "exists", message: "Already exists" });
        } else {
          results.push({ artifact: "Asset", name: a.name, status: "failed", message: `Credential asset creation failed (HTTP ${res.status}): ${text.slice(0, 150)}` });
        }
      } else if (assetType === "integer") {
        body.ValueType = "Integer";
        body.IntValue = parseInt(a.value || "0") || 0;
        const res = await fetch(`${base}/odata/Assets`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
        const text = await res.text();
        console.log(`[UiPath Deploy] Asset "${a.name}" (Integer) -> ${res.status}: ${text.slice(0, 300)}`);
        if (res.ok || res.status === 201) {
          const data = JSON.parse(text);
          results.push({ artifact: "Asset", name: a.name, status: "created", message: `Created with value ${body.IntValue} (ID: ${data.Id})`, id: data.Id });
        } else if (res.status === 409 || text.includes("already exists")) {
          results.push({ artifact: "Asset", name: a.name, status: "exists", message: "Already exists" });
        } else {
          results.push({ artifact: "Asset", name: a.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
        }
      } else if (assetType === "bool" || assetType === "boolean") {
        body.ValueType = "Bool";
        body.BoolValue = a.value === "true" || a.value === "True" || a.value === "1";
        const res = await fetch(`${base}/odata/Assets`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
        const text = await res.text();
        console.log(`[UiPath Deploy] Asset "${a.name}" (Bool) -> ${res.status}: ${text.slice(0, 300)}`);
        if (res.ok || res.status === 201) {
          const data = JSON.parse(text);
          results.push({ artifact: "Asset", name: a.name, status: "created", message: `Created with value ${body.BoolValue} (ID: ${data.Id})`, id: data.Id });
        } else if (res.status === 409 || text.includes("already exists")) {
          results.push({ artifact: "Asset", name: a.name, status: "exists", message: "Already exists" });
        } else {
          results.push({ artifact: "Asset", name: a.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
        }
      } else {
        body.ValueType = "Text";
        body.StringValue = a.value || "";
        const res = await fetch(`${base}/odata/Assets`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
        const text = await res.text();
        console.log(`[UiPath Deploy] Asset "${a.name}" (Text) -> ${res.status}: ${text.slice(0, 300)}`);
        if (res.ok || res.status === 201) {
          const data = JSON.parse(text);
          results.push({ artifact: "Asset", name: a.name, status: "created", message: `Created with value "${(a.value || "").slice(0, 50)}" (ID: ${data.Id})`, id: data.Id });
        } else if (res.status === 409 || text.includes("already exists")) {
          results.push({ artifact: "Asset", name: a.name, status: "exists", message: "Already exists" });
        } else {
          results.push({ artifact: "Asset", name: a.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
        }
      }
    } catch (err: any) {
      results.push({ artifact: "Asset", name: a.name, status: "failed", message: err.message });
    }
  }
  return results;
}

async function provisionMachines(
  base: string, hdrs: Record<string, string>,
  machines: OrchestratorArtifacts["machines"]
): Promise<DeploymentResult[]> {
  if (!machines?.length) return [];
  const results: DeploymentResult[] = [];

  for (const m of machines) {
    try {
      const checkRes = await fetch(
        `${base}/odata/Machines?$filter=Name eq '${odataEscape(m.name)}'&$top=1`,
        { headers: hdrs }
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.value?.length > 0) {
          results.push({ artifact: "Machine", name: m.name, status: "exists", message: `Already exists (ID: ${checkData.value[0].Id})`, id: checkData.value[0].Id });
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
      console.log(`[UiPath Deploy] Machine "${m.name}" -> ${res.status}: ${text.slice(0, 300)}`);

      if (res.ok || res.status === 201) {
        const data = JSON.parse(text);
        results.push({ artifact: "Machine", name: m.name, status: "created", message: `Created (ID: ${data.Id}, Type: Template)`, id: data.Id });
      } else if (res.status === 409 || text.includes("already exists")) {
        results.push({ artifact: "Machine", name: m.name, status: "exists", message: "Already exists" });
      } else {
        results.push({ artifact: "Machine", name: m.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
      }
    } catch (err: any) {
      results.push({ artifact: "Machine", name: m.name, status: "failed", message: err.message });
    }
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
          const data = JSON.parse(text);
          results.push({ artifact: "Storage Bucket", name: b.name, status: "created", message: `Created (ID: ${data.Id}, Provider: ${provider})`, id: data.Id });
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

async function provisionTriggers(
  base: string, hdrs: Record<string, string>,
  triggers: OrchestratorArtifacts["triggers"],
  releaseId: number | null,
  releaseKey: string | null,
  releaseName: string | null,
  queueResults: DeploymentResult[]
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
          Enabled: true,
          ReleaseId: releaseId,
          ReleaseName: releaseName || "",
          QueueDefinitionId: queueId,
          MinNumberOfItems: 1,
          MaxNumberOfItems: 100,
          JobsCount: 1,
          RuntimeType: "Unattended",
          InputArguments: "{}",
        };

        console.log(`[UiPath Deploy] Queue Trigger "${t.name}" payload: ${JSON.stringify(body)}`);

        const res = await fetch(`${base}/odata/QueueTriggers`, {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify(body),
        });
        const text = await res.text();
        console.log(`[UiPath Deploy] Queue Trigger "${t.name}" -> ${res.status}: ${text.slice(0, 500)}`);

        if (res.ok || res.status === 201) {
          const data = JSON.parse(text);
          results.push({ artifact: "Trigger", name: t.name, status: "created", message: `Queue trigger created (ID: ${data.Id}), linked to queue "${t.queueName}"`, id: data.Id });
        } else if (res.status === 409 || text.includes("already exists")) {
          results.push({ artifact: "Trigger", name: t.name, status: "exists", message: "Already exists" });
        } else if (res.status === 405) {
          // Try creating as a ProcessSchedule with queue reference instead
          const schedBody: Record<string, any> = {
            Enabled: true,
            Name: t.name,
            ReleaseId: releaseId,
            ReleaseName: releaseName || "",
            StartProcessCron: "0 */5 * ? * *",
            StartProcessCronDetails: JSON.stringify({ type: 5, minutely: {}, hourly: {}, daily: {}, weekly: { weekdays: [] }, monthly: { weekdays: [] }, advancedCronExpression: "0 */5 * ? * *" }),
            StartProcessCronSummary: `Queue polling for ${t.queueName}`,
            TimeZoneId: "UTC",
            TimeZoneIana: "Etc/UTC",
            StartStrategy: 15,
            RuntimeType: "Unattended",
            InputArguments: JSON.stringify({ QueueName: t.queueName }),
          };
          const schedRes = await fetch(`${base}/odata/ProcessSchedules`, { method: "POST", headers: hdrs, body: JSON.stringify(schedBody) });
          const schedText = await schedRes.text();
          console.log(`[UiPath Deploy] Queue Trigger "${t.name}" fallback to ProcessSchedule -> ${schedRes.status}: ${schedText.slice(0, 300)}`);
          if (schedRes.ok || schedRes.status === 201) {
            const data = JSON.parse(schedText);
            results.push({ artifact: "Trigger", name: t.name, status: "created", message: `Created as scheduled trigger (ID: ${data.Id}) polling queue "${t.queueName}" every 5 min`, id: data.Id });
          } else {
            results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `QueueTriggers API returned 405, ProcessSchedule fallback also failed (${schedRes.status}): ${schedText.slice(0, 150)}` });
          }
        } else {
          results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
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
          Enabled: true,
          Name: t.name,
          ReleaseId: releaseId,
          ReleaseName: releaseName || "",
          ReleaseKey: releaseKey || "",
          StartProcessCron: cron,
          StartProcessCronDetails: cronDetails,
          StartProcessCronSummary: t.description || "Scheduled trigger",
          TimeZoneId: "UTC",
          TimeZoneIana: "Etc/UTC",
          RuntimeType: "Unattended",
          InputArguments: "{}",
        };

        const strategies = [15, 0, { Type: 0 }];
        let created = false;
        for (const strategy of strategies) {
          const body = { ...baseBody, StartStrategy: strategy };
          console.log(`[UiPath Deploy] Time Trigger "${t.name}" trying StartStrategy=${JSON.stringify(strategy)}`);

          const res = await fetch(`${base}/odata/ProcessSchedules`, {
            method: "POST",
            headers: hdrs,
            body: JSON.stringify(body),
          });
          const text = await res.text();
          console.log(`[UiPath Deploy] Time Trigger "${t.name}" -> ${res.status}: ${text.slice(0, 300)}`);

          if (res.ok || res.status === 201) {
            const data = JSON.parse(text);
            results.push({ artifact: "Trigger", name: t.name, status: "created", message: `Time trigger created (ID: ${data.Id}), cron: ${cron}`, id: data.Id });
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
            results.push({ artifact: "Trigger", name: t.name, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
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
          const data = JSON.parse(text);
          results.push({ artifact: "Environment", name: env.name, status: "created", message: `Created (ID: ${data.Id}, Type: ${typeValue})`, id: data.Id });
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

  const cloudTasksBase = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/tasks_`;
  const endpoints = [
    `${base}/odata/TaskCatalogs`,
    `${cloudTasksBase}/api/tasks/v1/task-catalogs`,
  ];

  for (const ac of actionCenter) {
    try {
      for (const checkEndpoint of endpoints) {
        try {
          const filterUrl = checkEndpoint.includes("/odata/")
            ? `${checkEndpoint}?$filter=Name eq '${odataEscape(ac.taskCatalog)}'&$top=1`
            : `${checkEndpoint}?name=${encodeURIComponent(ac.taskCatalog)}&top=1`;
          const checkRes = await fetch(filterUrl, { headers: hdrs });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            const items = checkData.value || checkData.items || checkData;
            if (Array.isArray(items) && items.length > 0) {
              results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "exists", message: `Already exists (ID: ${items[0].Id || items[0].id})`, id: items[0].Id || items[0].id });
              break;
            }
          }
        } catch { /* try next endpoint */ }
      }

      if (results.some(r => r.name === ac.taskCatalog)) continue;

      const body: Record<string, any> = {
        Name: ac.taskCatalog,
        Description: ac.description || "",
      };

      let acCreated = false;
      for (const endpoint of endpoints) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify(body),
        });
        const text = await res.text();
        console.log(`[UiPath Deploy] Action Center "${ac.taskCatalog}" via ${endpoint.includes("tasks_") ? "cloud tasks API" : "odata"} -> ${res.status}: ${text.slice(0, 300)}`);

        if (res.ok || res.status === 201) {
          let data: any;
          try { data = JSON.parse(text); } catch { data = {}; }
          let msg = `Created (ID: ${data.Id || data.id || "N/A"})`;
          if (ac.assignedRole) msg += `. Assign to role: ${ac.assignedRole}`;
          if (ac.sla) msg += `. SLA: ${ac.sla}`;
          if (ac.escalation) msg += `. Escalation: ${ac.escalation}`;
          results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "created", message: msg, id: data.Id || data.id });
          acCreated = true;
          break;
        } else if (res.status === 409 || text.includes("already exists")) {
          results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "exists", message: "Already exists" });
          acCreated = true;
          break;
        } else if (res.status === 404 || res.status === 405) {
          continue;
        } else {
          results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "failed", message: `HTTP ${res.status}: ${text.slice(0, 200)}` });
          acCreated = true;
          break;
        }
      }
      if (!acCreated) {
        results.push({ artifact: "Action Center", name: ac.taskCatalog, status: "failed", message: `All API endpoints returned 404/405 — Action Center may not be enabled for this tenant.` });
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

  const duBase = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/du_`;
  const aiBase = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/aifabric_`;
  const hdrs: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  for (const project of du) {
    try {
      const endpoints = [
        { url: `${duBase}/api/v1/projects`, label: "DU API" },
        { url: `${aiBase}/api/v1/projects`, label: "AI Fabric API" },
      ];

      let created = false;
      for (const ep of endpoints) {
        try {
          const checkRes = await fetch(`${ep.url}?name=${encodeURIComponent(project.name)}&top=10`, { headers: hdrs });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            const items = checkData.value || checkData.items || (Array.isArray(checkData) ? checkData : []);
            const existing = items.find((p: any) => (p.Name || p.name) === project.name);
            if (existing) {
              results.push({ artifact: "Document Understanding", name: project.name, status: "exists", message: `Already exists (ID: ${existing.Id || existing.id}). Doc types: ${project.documentTypes?.join(", ") || "N/A"}`, id: existing.Id || existing.id });
              created = true;
              break;
            }
          }
        } catch { /* try next */ }

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
            let data: any;
            try { data = JSON.parse(text); } catch { data = {}; }
            results.push({ artifact: "Document Understanding", name: project.name, status: "created", message: `Created (ID: ${data.Id || data.id || "N/A"}). Doc types: ${project.documentTypes?.join(", ") || "N/A"}`, id: data.Id || data.id });
            created = true;
            break;
          } else if (res.status === 409 || text.includes("already exists")) {
            results.push({ artifact: "Document Understanding", name: project.name, status: "exists", message: `Already exists. Doc types: ${project.documentTypes?.join(", ") || "N/A"}` });
            created = true;
            break;
          } else if (res.status === 404 || res.status === 405) {
            continue;
          } else {
            results.push({ artifact: "Document Understanding", name: project.name, status: "failed", message: `${ep.label} returned HTTP ${res.status}: ${text.slice(0, 150)}` });
            created = true;
            break;
          }
        } catch { continue; }
      }

      if (!created) {
        results.push({ artifact: "Document Understanding", name: project.name, status: "failed", message: `DU API not available on this tenant. Doc types: ${project.documentTypes?.join(", ") || "N/A"}` });
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
      console.log(`[UiPath Deploy] Test Manager probe ${tmBase} -> ${projRes.status}`);
      if (projRes.ok) {
        activeTmBase = tmBase;
        const projData = await projRes.json();

        if (projData.value?.length > 0) {
          const match = projData.value.find((p: any) =>
            p.Name?.toLowerCase().includes(processName.toLowerCase().replace(/_/g, " ")) ||
            processName.toLowerCase().includes(p.Name?.toLowerCase())
          );
          projectId = match?.Id || projData.value[0].Id;
        }
        break;
      }
    } catch { continue; }
  }

  if (!activeTmBase) {
    return testCases.map(tc => ({
      artifact: "Test Case",
      name: tc.name,
      status: "failed" as const,
      message: `Test Manager API not reachable — tried ${tmBases.length} endpoints. Check tenant has Test Manager enabled.`,
    }));
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
      if (createProjRes.ok || createProjRes.status === 201) {
        const newProj = await createProjRes.json();
        projectId = newProj.Id;
        results.push({ artifact: "Test Project", name: processName, status: "created", message: `Created test project (ID: ${projectId})`, id: projectId! });
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
        const data = JSON.parse(text);
        results.push({ artifact: "Test Case", name: tc.name, status: "created", message: `Created (ID: ${data.Id})${tc.steps?.length ? `, ${tc.steps.length} manual steps` : ""}`, id: data.Id });
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

    const triggerResults = await provisionTriggers(base, hdrs, artifacts.triggers, releaseId, releaseKey, releaseName, queueResults);
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

    let summary = `Deployment complete: ${created} created, ${existed} already existed`;
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

  const grouped: Record<string, DeploymentResult[]> = {};
  for (const r of results) {
    if (!grouped[r.artifact]) grouped[r.artifact] = [];
    grouped[r.artifact].push(r);
  }

  const statusIcon = (s: string) => {
    switch (s) {
      case "created": return "✅";
      case "exists": return "🔵";
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

  const created = results.filter(r => r.status === "created").length;
  const failed = results.filter(r => r.status === "failed").length;

  if (failed > 0) {
    lines.push(`**${failed} item(s) failed** — check permissions and retry from Orchestrator.`);
  }
  if (created > 0 && failed === 0) {
    lines.push("All artifacts provisioned successfully. The automation is fully deployed.");
  }

  return lines.join("\n");
}
