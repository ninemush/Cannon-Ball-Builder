import { db } from "./db";
import { deploymentManifests } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { OrchestratorArtifacts } from "./uipath-deploy";
import type { DeploymentResult } from "@shared/models/deployment";

export type ManifestEntry = {
  artifactType: string;
  artifactName: string;
  orchestratorId: string | null;
};

export type ReconciliationAction = {
  artifactType: string;
  newName: string;
  resolvedName: string;
  action: "matched" | "new" | "removed";
  previousName?: string;
  similarity?: number;
};

export type ReconciliationResult = {
  reconciledArtifacts: OrchestratorArtifacts;
  actions: ReconciliationAction[];
};

function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_\s]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function computeSimilarity(a: string, b: string): number {
  const na = normalizeForComparison(a);
  const nb = normalizeForComparison(b);

  if (na === nb) return 1.0;

  if (na.includes(nb) || nb.includes(na)) {
    const longer = Math.max(na.length, nb.length);
    const shorter = Math.min(na.length, nb.length);
    return shorter / longer;
  }

  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(na, nb);
  return 1 - dist / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

const SIMILARITY_THRESHOLD = 0.75;

function getArtifactTypeName(key: string): string {
  const map: Record<string, string> = {
    queues: "Queue",
    assets: "Asset",
    machines: "Machine",
    triggers: "Trigger",
    storageBuckets: "Storage Bucket",
    environments: "Environment",
    robotAccounts: "Robot Account",
    actionCenter: "Action Center",
    documentUnderstanding: "Document Understanding",
    testCases: "Test Case",
    testDataQueues: "Test Data Queue",
    requirements: "Requirement",
    testSets: "Test Set",
    agents: "Agent",
    knowledgeBases: "Knowledge Base",
    promptTemplates: "Prompt Template",
  };
  return map[key] || key;
}

function getNameField(artifactType: string, item: any): string {
  if (artifactType === "actionCenter") return item.taskCatalog || "";
  return item.name || "";
}

function setNameField(artifactType: string, item: any, name: string): any {
  const clone = { ...item };
  if (artifactType === "actionCenter") {
    clone.taskCatalog = name;
  } else {
    clone.name = name;
  }
  return clone;
}

let tableVerified = false;

async function ensureTable(): Promise<boolean> {
  if (tableVerified) return true;
  try {
    await db.execute(
      sql`CREATE TABLE IF NOT EXISTS deployment_manifests (
        id SERIAL PRIMARY KEY,
        idea_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        artifact_name TEXT NOT NULL,
        orchestrator_id TEXT,
        deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`
    );
    await db.execute(
      sql`ALTER TABLE deployment_manifests
          ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL`
    );
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_manifest_idea_type_name
          ON deployment_manifests (idea_id, artifact_type, artifact_name)`
    );
    tableVerified = true;
    return true;
  } catch (err: any) {
    console.warn(`[Artifact Reconciliation] Failed to ensure deployment_manifests table: ${err.message}`);
    return false;
  }
}

export async function getPreviousManifest(ideaId: string): Promise<ManifestEntry[]> {
  const ready = await ensureTable();
  if (!ready) return [];
  try {
    const rows = await db
      .select()
      .from(deploymentManifests)
      .where(eq(deploymentManifests.ideaId, ideaId));
    return rows.map((r) => ({
      artifactType: r.artifactType,
      artifactName: r.artifactName,
      orchestratorId: r.orchestratorId,
    }));
  } catch (err: any) {
    console.warn(`[Artifact Reconciliation] Failed to read manifest: ${err.message}`);
    return [];
  }
}

export async function saveManifest(
  ideaId: string,
  results: DeploymentResult[],
  removedArtifactNames?: Array<{ artifactType: string; artifactName: string }>
): Promise<void> {
  const ready = await ensureTable();
  if (!ready) return;

  const persistableStatuses = new Set(["created", "updated", "exists", "in_package"]);
  const excludedArtifactCategories = new Set([
    "Infrastructure", "Runtime Check", "Deployment Manifest",
    "Test Project", "Requirement Link",
  ]);

  const successfulResults = results.filter(
    (r) =>
      !excludedArtifactCategories.has(r.artifact) &&
      persistableStatuses.has(r.status)
  );

  const existingRows = await db
    .select()
    .from(deploymentManifests)
    .where(eq(deploymentManifests.ideaId, ideaId));

  const newSuccessfulByTypeAndName = new Set(
    successfulResults.map((r) => `${r.artifact}::${r.name}`)
  );

  const removedSet = new Set(
    (removedArtifactNames || []).map((r) => `${r.artifactType}::${r.artifactName}`)
  );

  const failedByTypeAndName = new Set(
    results
      .filter(
        (r) =>
          !excludedArtifactCategories.has(r.artifact) &&
          !persistableStatuses.has(r.status)
      )
      .map((r) => `${r.artifact}::${r.name}`)
  );

  const retainedEntries = existingRows.filter((row) => {
    const key = `${row.artifactType}::${row.artifactName}`;
    if (newSuccessfulByTypeAndName.has(key)) return false;
    if (removedSet.has(key)) return true;
    if (failedByTypeAndName.has(key)) return true;
    const hasSuccessfulReplacement = successfulResults.some(
      (r) => r.artifact === row.artifactType
    );
    if (hasSuccessfulReplacement) {
      const hasFailed = results.some(
        (r) =>
          r.artifact === row.artifactType &&
          !persistableStatuses.has(r.status) &&
          r.name === row.artifactName
      );
      return hasFailed;
    }
    return true;
  });

  const newValues = successfulResults.map((r) => ({
    ideaId,
    artifactType: r.artifact,
    artifactName: r.name,
    orchestratorId: r.id != null ? String(r.id) : null,
  }));

  const retainedValues = retainedEntries.map((r) => ({
    ideaId: r.ideaId,
    artifactType: r.artifactType,
    artifactName: r.artifactName,
    orchestratorId: r.orchestratorId,
  }));

  const allValues = [...newValues, ...retainedValues];

  await db.transaction(async (tx) => {
    await tx
      .delete(deploymentManifests)
      .where(eq(deploymentManifests.ideaId, ideaId));
    if (allValues.length > 0) {
      await tx.insert(deploymentManifests).values(allValues);
    }
  });
}

export function reconcileArtifacts(
  newArtifacts: OrchestratorArtifacts,
  previousManifest: ManifestEntry[]
): ReconciliationResult {
  const actions: ReconciliationAction[] = [];
  const reconciled: OrchestratorArtifacts = {};

  if (previousManifest.length === 0) {
    const allKeys = Object.keys(newArtifacts) as (keyof OrchestratorArtifacts)[];
    for (const key of allKeys) {
      const items = newArtifacts[key] as any[] | undefined;
      if (!items?.length) continue;
      (reconciled as any)[key] = items;
      const typeName = getArtifactTypeName(key);
      for (const item of items) {
        actions.push({
          artifactType: typeName,
          newName: getNameField(key, item),
          resolvedName: getNameField(key, item),
          action: "new",
        });
      }
    }
    return { reconciledArtifacts: reconciled, actions };
  }

  const artifactKeys = Object.keys(newArtifacts) as (keyof OrchestratorArtifacts)[];

  for (const key of artifactKeys) {
    const items = newArtifacts[key] as any[] | undefined;
    const typeName = getArtifactTypeName(key);
    const prevOfType = previousManifest.filter((m) => m.artifactType === typeName);

    if (!items?.length) {
      for (const prev of prevOfType) {
        actions.push({
          artifactType: typeName,
          newName: "",
          resolvedName: prev.artifactName,
          action: "removed",
          previousName: prev.artifactName,
        });
      }
      continue;
    }

    if (prevOfType.length === 0) {
      (reconciled as any)[key] = items;
      for (const item of items) {
        actions.push({
          artifactType: typeName,
          newName: getNameField(key, item),
          resolvedName: getNameField(key, item),
          action: "new",
        });
      }
      continue;
    }

    const usedPrevIndices = new Set<number>();
    const reconciledItems: any[] = [];

    for (const item of items) {
      const newName = getNameField(key, item);

      const exactIdx = prevOfType.findIndex(
        (p, i) => !usedPrevIndices.has(i) && p.artifactName === newName
      );
      if (exactIdx >= 0) {
        usedPrevIndices.add(exactIdx);
        reconciledItems.push(item);
        actions.push({
          artifactType: typeName,
          newName,
          resolvedName: newName,
          action: "matched",
        });
        continue;
      }

      let bestIdx = -1;
      let bestSim = 0;
      for (let i = 0; i < prevOfType.length; i++) {
        if (usedPrevIndices.has(i)) continue;
        const sim = computeSimilarity(newName, prevOfType[i].artifactName);
        if (sim > bestSim) {
          bestSim = sim;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0 && bestSim >= SIMILARITY_THRESHOLD) {
        usedPrevIndices.add(bestIdx);
        const resolvedName = prevOfType[bestIdx].artifactName;
        reconciledItems.push(setNameField(key, item, resolvedName));
        actions.push({
          artifactType: typeName,
          newName,
          resolvedName,
          action: "matched",
          previousName: resolvedName,
          similarity: Math.round(bestSim * 100),
        });
      } else {
        reconciledItems.push(item);
        actions.push({
          artifactType: typeName,
          newName,
          resolvedName: newName,
          action: "new",
        });
      }
    }

    (reconciled as any)[key] = reconciledItems;

    for (let i = 0; i < prevOfType.length; i++) {
      if (!usedPrevIndices.has(i)) {
        actions.push({
          artifactType: typeName,
          newName: "",
          resolvedName: prevOfType[i].artifactName,
          action: "removed",
          previousName: prevOfType[i].artifactName,
        });
      }
    }
  }

  const processedTypes = new Set(
    artifactKeys.map((k) => getArtifactTypeName(k))
  );
  for (const prev of previousManifest) {
    if (!processedTypes.has(prev.artifactType)) {
      actions.push({
        artifactType: prev.artifactType,
        newName: "",
        resolvedName: prev.artifactName,
        action: "removed",
        previousName: prev.artifactName,
      });
    }
  }

  return { reconciledArtifacts: reconciled, actions };
}

export function formatReconciliationSummary(actions: ReconciliationAction[]): string {
  if (actions.length === 0) return "";

  const lines: string[] = ["**Artifact Reconciliation:**"];

  const matched = actions.filter((a) => a.action === "matched");
  const newItems = actions.filter((a) => a.action === "new");
  const removed = actions.filter((a) => a.action === "removed");

  const renamed = matched.filter((a) => a.previousName && a.previousName !== a.newName);
  const unchanged = matched.filter((a) => !a.previousName || a.previousName === a.newName);

  if (unchanged.length > 0) {
    lines.push(`- ${unchanged.length} artifact(s) matched to existing deployment`);
  }
  if (renamed.length > 0) {
    lines.push(`- ${renamed.length} artifact(s) matched by similarity (name drift corrected):`);
    for (const r of renamed) {
      lines.push(`  - ${r.artifactType}: "${r.newName}" → kept as "${r.resolvedName}" (${r.similarity}% similar)`);
    }
  }
  if (newItems.length > 0) {
    lines.push(`- ${newItems.length} new artifact(s) to create`);
  }
  if (removed.length > 0) {
    lines.push(`- ${removed.length} previously deployed artifact(s) no longer in SDD (not deleted from Orchestrator):`);
    for (const r of removed) {
      lines.push(`  - ${r.artifactType}: "${r.previousName}"`);
    }
  }

  return lines.join("\n");
}
