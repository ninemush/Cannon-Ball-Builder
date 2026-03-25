import { trySanitizeAndParseJson } from "./json-utils";
import { getLLM } from "./llm";

const ARTIFACT_KEYS = [
  "queues", "assets", "machines", "triggers", "storageBuckets",
  "environments", "actionCenter", "documentUnderstanding",
  "communicationsMining", "requirements", "testCases", "testSets",
  "agents", "knowledgeBases", "promptTemplates", "maestroProcesses",
  "dataFabricEntities", "apps", "robotAccounts", "testDataQueues",
] as const;

const RAW_JSON_KEY_PATTERN = ARTIFACT_KEYS.join("|");

const REQUIRED_FIELDS_BY_TYPE: Record<string, string[]> = {
  queues: ["name"],
  assets: ["name", "type"],
  machines: ["name"],
  triggers: ["name", "type"],
  storageBuckets: ["name"],
  environments: ["name"],
  actionCenter: ["taskCatalog"],
  documentUnderstanding: ["name"],
  communicationsMining: ["name"],
  requirements: ["name"],
  testCases: ["name"],
  testSets: ["name"],
  agents: ["name"],
  knowledgeBases: ["name"],
  promptTemplates: ["name"],
  maestroProcesses: ["name"],
  dataFabricEntities: ["name"],
  apps: ["name"],
  robotAccounts: ["name"],
  testDataQueues: ["name"],
};

export type ArtifactValidationFailure = "missing_fence" | "invalid_json" | "not_object" | "empty_object" | "malformed_entries";

export type ArtifactValidationTier = "valid" | "valid_with_warnings" | "invalid";

const DEFAULTABLE_FIELDS: Record<string, string[]> = {
  assets: ["type"],
  triggers: ["type"],
  actionCenter: ["taskCatalog"],
};

export interface ArtifactValidationResult {
  tier: ArtifactValidationTier;
  valid: boolean;
  failure?: ArtifactValidationFailure;
  details?: string;
  warnings?: string[];
  nonEmptyArrays?: string[];
  malformedEntries?: Array<{ key: string; index: number; missingFields: string[] }>;
}

export function validateArtifactBlock(text: string): ArtifactValidationResult {
  const fenceMatch = text.match(/```orchestrator_artifacts\s*\n([\s\S]*?)\n```/);
  if (!fenceMatch) {
    const hasAnyJson = parseArtifactBlock(text);
    if (hasAnyJson) {
      return { tier: "invalid", valid: false, failure: "missing_fence", details: "Artifact data found but not in canonical fence format" };
    }
    return { tier: "invalid", valid: false, failure: "missing_fence", details: "No orchestrator_artifacts fence block found" };
  }

  const parsed = trySanitizeAndParseJson(fenceMatch[1].trim());
  if (parsed === null) {
    return { tier: "invalid", valid: false, failure: "invalid_json", details: "Content inside fence is not valid JSON" };
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    return { tier: "invalid", valid: false, failure: "not_object", details: "Parsed JSON is not an object" };
  }

  const knownKeySet = new Set<string>(ARTIFACT_KEYS as readonly string[]);
  const nonEmptyArrays: string[] = [];
  const malformedEntries: Array<{ key: string; index: number; missingFields: string[] }> = [];

  for (const key of Object.keys(parsed)) {
    if (!knownKeySet.has(key)) continue;
    const val = parsed[key];
    if (!Array.isArray(val)) {
      return { tier: "invalid", valid: false, failure: "malformed_entries", details: `Artifact key "${key}" is not an array (got ${typeof val})` };
    }
    if (val.length === 0) continue;
    nonEmptyArrays.push(key);

    const requiredFields = REQUIRED_FIELDS_BY_TYPE[key];
    if (!requiredFields) continue;

    for (let i = 0; i < val.length; i++) {
      const entry = val[i];
      if (!entry || typeof entry !== "object") {
        malformedEntries.push({ key, index: i, missingFields: requiredFields });
        continue;
      }
      const missing = requiredFields.filter(f => entry[f] === undefined || entry[f] === null);
      if (missing.length > 0) {
        malformedEntries.push({ key, index: i, missingFields: missing });
      }
    }
  }

  if (nonEmptyArrays.length === 0) {
    return { tier: "invalid", valid: false, failure: "empty_object", details: "No recognized artifact arrays with entries found (expected at least one of: " + ARTIFACT_KEYS.join(", ") + ")" };
  }

  if (malformedEntries.length > 0) {
    const hardFailEntries = malformedEntries.filter(e => {
      const defaultable = DEFAULTABLE_FIELDS[e.key] || [];
      const nonDefaultable = e.missingFields.filter(f => !defaultable.includes(f));
      return nonDefaultable.length > 0;
    });

    const warningEntries = malformedEntries.filter(e => {
      const defaultable = DEFAULTABLE_FIELDS[e.key] || [];
      return e.missingFields.every(f => defaultable.includes(f) || f === "name");
    });

    if (hardFailEntries.length > 0 && warningEntries.length === 0) {
      const summary = hardFailEntries.map(e => `${e.key}[${e.index}] missing: ${e.missingFields.join(", ")}`).join("; ");
      return { tier: "invalid", valid: false, failure: "malformed_entries", details: summary, nonEmptyArrays, malformedEntries: hardFailEntries };
    }

    const warnings: string[] = malformedEntries.map(e => {
      const defaultable = DEFAULTABLE_FIELDS[e.key] || [];
      const warnFields = e.missingFields.filter(f => defaultable.includes(f) || f === "name");
      if (warnFields.length > 0) {
        return `${e.key}[${e.index}] missing defaultable field(s): ${warnFields.join(", ")}`;
      }
      return null;
    }).filter((w): w is string => w !== null);

    if (hardFailEntries.length > 0) {
      const summary = hardFailEntries.map(e => `${e.key}[${e.index}] missing: ${e.missingFields.join(", ")}`).join("; ");
      return { tier: "invalid", valid: false, failure: "malformed_entries", details: summary, warnings, nonEmptyArrays, malformedEntries };
    }

    return { tier: "valid_with_warnings", valid: true, warnings, nonEmptyArrays, malformedEntries };
  }

  return { tier: "valid", valid: true, nonEmptyArrays };
}

function looksLikeArtifacts(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  return ARTIFACT_KEYS.some((key) => Array.isArray(obj[key]));
}

function hasCanonicalFence(text: string): boolean {
  return /```orchestrator_artifacts\s*\n[\s\S]*?\n```/.test(text);
}

export function parseArtifactBlock(text: string): string | null {
  const exactMatch = text.match(/```orchestrator_artifacts\s*\n([\s\S]*?)\n```/);
  if (exactMatch) {
    const parsed = trySanitizeAndParseJson(exactMatch[1].trim());
    if (parsed && looksLikeArtifacts(parsed)) {
      return "```orchestrator_artifacts\n" + JSON.stringify(parsed, null, 2) + "\n```";
    }
  }

  const jsonFenceMatches = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/g);
  if (jsonFenceMatches) {
    for (const fence of jsonFenceMatches) {
      const inner = fence.replace(/```(?:json)?\s*\n/, "").replace(/\n```$/, "").trim();
      const parsed = trySanitizeAndParseJson(inner);
      if (parsed && looksLikeArtifacts(parsed)) {
        return "```orchestrator_artifacts\n" + JSON.stringify(parsed, null, 2) + "\n```";
      }
    }
  }

  const rawKeyRegex = new RegExp(`\\{\\s*"(?:${RAW_JSON_KEY_PATTERN})"\\s*:\\s*\\[`);
  const rawMatch = text.match(rawKeyRegex);
  if (rawMatch && rawMatch.index !== undefined) {
    const braceStart = rawMatch.index;
    let depth = 0;
    let end = braceStart;
    for (let i = braceStart; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") depth--;
      if (depth === 0) { end = i + 1; break; }
    }
    const jsonStr = text.slice(braceStart, end);
    const parsed = trySanitizeAndParseJson(jsonStr);
    if (parsed && looksLikeArtifacts(parsed)) {
      return "```orchestrator_artifacts\n" + JSON.stringify(parsed, null, 2) + "\n```";
    }
  }

  return null;
}

export function parseArtifactBlockAsObject(text: string): Record<string, any> | null {
  const block = parseArtifactBlock(text);
  if (!block) return null;

  const inner = block.replace(/```orchestrator_artifacts\s*\n/, "").replace(/\n```$/, "").trim();
  return trySanitizeAndParseJson(inner);
}

export function insertArtifactBlock(content: string, artifactBlock: string): string {
  const deploySpecContent = `## 9. Orchestrator & Platform Deployment Specification\n\n${artifactBlock}`;
  const existingDeploySpec = /#{2,3} (?:8|9)[\.\s].*(?:Orchestrator|Deployment)/i;

  if (existingDeploySpec.test(content)) {
    return content.replace(/#{2,3} (?:8|9)[\.\s].*(?:Orchestrator|Deployment)[\s\S]*$/, deploySpecContent.trim());
  }

  return content.trimEnd() + "\n\n" + deploySpecContent.trim();
}

export interface EnsureArtifactBlockResult {
  content: string;
  artifactsValid: boolean;
  artifactWarnings: string[];
  validationResult: ArtifactValidationResult;
}

function buildEnsureResult(content: string, validation: ArtifactValidationResult): EnsureArtifactBlockResult {
  return {
    content,
    artifactsValid: validation.valid,
    artifactWarnings: validation.warnings || [],
    validationResult: validation,
  };
}

export async function ensureArtifactBlock(content: string, extraContext?: string): Promise<EnsureArtifactBlockResult> {
  if (hasCanonicalFence(content)) {
    const parsed = parseArtifactBlockAsObject(content);
    if (parsed) {
      const validation = validateArtifactBlock(content);
      return buildEnsureResult(content, validation);
    }
  }

  if (extraContext) {
    const contextBlock = parseArtifactBlock(extraContext);
    if (contextBlock) {
      console.log("[SDD] Found artifact block in extra context, inserting...");
      const result = insertArtifactBlock(content, contextBlock);
      const validation = validateArtifactBlock(result);
      return buildEnsureResult(result, validation);
    }
  }

  const inlineBlock = parseArtifactBlock(content);
  if (inlineBlock) {
    console.log("[SDD] Found artifact data in non-canonical format, canonicalizing...");
    const result = insertArtifactBlock(content, inlineBlock);
    const validation = validateArtifactBlock(result);
    return buildEnsureResult(result, validation);
  }

  console.log("[SDD] Artifact block missing, running LLM extraction...");
  const sourceText = extraContext
    ? (content + "\n\n" + extraContext).slice(0, 24000)
    : content.slice(0, 24000);

  const MAX_EXTRACTION_ATTEMPTS = 1;
  for (let attempt = 0; attempt < MAX_EXTRACTION_ATTEMPTS; attempt++) {
    try {
      const systemPrompt = "You are a UiPath automation consultant. Extract the Orchestrator artifact definitions from the document and output ONLY a fenced JSON block. Start your response with ```orchestrator_artifacts immediately. Output nothing else — no prose, no explanation before or after the block.";

      const userPrompt = `From this document, extract ALL Orchestrator and platform artifacts and output them as a single fenced block:

\`\`\`orchestrator_artifacts
{
  "queues": [{ "name": "QueueName", "description": "Purpose", "maxRetries": 3, "uniqueReference": true }],
  "assets": [{ "name": "AssetName", "type": "Text|Integer|Bool|Credential", "value": "default or empty", "description": "Purpose" }],
  "machines": [{ "name": "TemplateName", "type": "Unattended|Attended|Development|Serverless", "slots": 1, "description": "Purpose" }],
  "triggers": [{ "name": "TriggerName", "type": "Queue|Time", "queueName": "if queue trigger", "cron": "if time trigger", "description": "Purpose" }],
  "storageBuckets": [{ "name": "BucketName", "description": "Purpose" }],
  "environments": [{ "name": "EnvironmentName", "type": "Production|Development|Testing", "description": "Purpose" }],
  "actionCenter": [{ "taskCatalog": "CatalogName", "assignedRole": "Role", "sla": "24 hours", "escalation": "description", "description": "Purpose" }],
  "documentUnderstanding": [{ "name": "ProjectName", "documentTypes": ["Invoice"], "extractionApproach": "classic_du|generative|hybrid", "description": "Purpose" }],
  "communicationsMining": [{ "name": "StreamName", "sourceType": "email|chat|ticket", "description": "Purpose" }],
  "requirements": [{ "name": "REQ-001: Name", "description": "Requirement", "source": "PDD Section X" }],
  "testCases": [{ "name": "TC001 - Name", "description": "What this tests", "steps": [{ "action": "Step", "expected": "Result" }] }],
  "testSets": [{ "name": "Test Set Name", "description": "Purpose", "testCaseNames": ["TC001 - Name"] }]
}
\`\`\`

Document:
${sourceText}`;

      console.log(`[SDD] LLM extraction attempt ${attempt + 1}/${MAX_EXTRACTION_ATTEMPTS}...`);
      const extractionResponse = await getLLM().create({
        maxTokens: 3072,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const extractedBlock = parseArtifactBlock(extractionResponse.text);
      if (extractedBlock) {
        console.log(`[SDD] LLM extraction succeeded on attempt ${attempt + 1}`);
        const result = insertArtifactBlock(content, extractedBlock);
        const validation = validateArtifactBlock(result);
        return buildEnsureResult(result, validation);
      }
      console.warn(`[SDD] LLM extraction attempt ${attempt + 1} failed to produce valid artifact block`);
    } catch (err: any) {
      console.error(`[SDD] LLM extraction attempt ${attempt + 1} error:`, err?.message);
    }
  }

  console.error("[SDD] Artifact extraction failed — document saved without valid artifact block");
  const validation = validateArtifactBlock(content);
  return buildEnsureResult(content, validation);
}
