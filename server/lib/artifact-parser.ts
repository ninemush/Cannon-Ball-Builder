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
  const existingDeploySpec = /## (?:8|9)[\.\s].*(?:Orchestrator|Deployment)/i;

  if (existingDeploySpec.test(content)) {
    return content.replace(/## (?:8|9)[\.\s].*(?:Orchestrator|Deployment)[\s\S]*$/, deploySpecContent.trim());
  }

  return content.trimEnd() + "\n\n" + deploySpecContent.trim();
}

export async function ensureArtifactBlock(content: string, extraContext?: string): Promise<string> {
  if (hasCanonicalFence(content)) {
    const parsed = parseArtifactBlockAsObject(content);
    if (parsed) {
      return content;
    }
  }

  if (extraContext) {
    const contextBlock = parseArtifactBlock(extraContext);
    if (contextBlock) {
      console.log("[SDD] Found artifact block in extra context, inserting...");
      return insertArtifactBlock(content, contextBlock);
    }
  }

  const inlineBlock = parseArtifactBlock(content);
  if (inlineBlock) {
    console.log("[SDD] Found artifact data in non-canonical format, canonicalizing...");
    return insertArtifactBlock(content, inlineBlock);
  }

  console.log("[SDD] Artifact block missing, running LLM extraction...");
  const sourceText = extraContext
    ? (content + "\n\n" + extraContext).slice(0, 8000)
    : content.slice(0, 8000);

  try {
    const extractionResponse = await getLLM().create({
      maxTokens: 2048,
      system: "You are a UiPath automation consultant. Extract the Orchestrator artifact definitions from the document and output ONLY a fenced JSON block. Output nothing else.",
      messages: [{
        role: "user",
        content: `From this document, extract ALL Orchestrator and platform artifacts and output them as a single fenced block:

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
${sourceText}`
      }],
    });

    const extractedBlock = parseArtifactBlock(extractionResponse.text);
    if (extractedBlock) {
      console.log("[SDD] LLM extraction succeeded");
      return insertArtifactBlock(content, extractedBlock);
    }
    console.warn("[SDD] LLM extraction failed to produce valid artifact block");
  } catch (err: any) {
    console.error("[SDD] LLM extraction error:", err?.message);
  }

  return content;
}
