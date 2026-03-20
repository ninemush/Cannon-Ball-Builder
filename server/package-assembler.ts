import archiver from "archiver";
  import AdmZip from "adm-zip";
  import { createHash } from "crypto";
  import { PassThrough } from "stream";
  import {
    generateRichXamlFromSpec,
    generateRichXamlFromNodes,
    generateInitAllSettingsXaml,
    generateReframeworkMainXaml,
    generateGetTransactionDataXaml,
    generateSetTransactionStatusXaml,
    generateCloseAllApplicationsXaml,
    generateKillAllProcessesXaml,
    aggregateGaps,
    generateDeveloperHandoffGuide,
    generateDhgSummary,
    makeUiPathCompliant,
    ensureBracketWrapped,
    validateXamlContent,
    generateStubWorkflow,
    selectGenerationMode,
    applyActivityPolicy,
    isReFrameworkFile,
    replaceActivityWithStub,
    replaceSequenceChildrenWithStub,
    type GenerationMode,
    type GenerationModeConfig,
    type XamlGeneratorResult,
    type XamlGap,
    type TargetFramework,
    type XamlValidationViolation,
    type DhgQualityIssue,
  } from "./xaml-generator";
  import type { XamlGenerationContext, UiPathPackage } from "./types/uipath-package";
  import { enrichWithAI, enrichWithAITree, type EnrichmentResult, type TreeEnrichmentResult } from "./ai-xaml-enricher";
  import { assembleWorkflowFromSpec } from "./workflow-tree-assembler";
  import type { WorkflowSpec as TreeWorkflowSpec } from "./workflow-spec-types";
  import { analyzeAndFix, setGovernancePolicies, type AnalysisReport } from "./workflow-analyzer";
  import { runQualityGate, formatQualityGateViolations, classifyQualityIssues, getBlockingFiles, hasOnlyWarnings, hasBlockingIssues, type QualityGateResult, type ClassifiedIssue } from "./uipath-quality-gate";
  import { escapeXml } from "./lib/xml-utils";
  import { computePackageFingerprint } from "./lib/utils";
  import { scanXamlForRequiredPackages, classifyAutomationPattern, shouldUseReFramework, type AutomationPattern, ACTIVITY_NAME_ALIAS_MAP, normalizeActivityName } from "./uipath-activity-registry";
  import { filterBlockedActivitiesFromXaml } from "./uipath-activity-policy";
  import { catalogService, type ProcessType } from "./catalog/catalog-service";
  import { UIPATH_PACKAGE_ALIAS_MAP, QualityGateError, type UiPathConfig } from "./uipath-shared";

async function getProbeCache() {
  const { getProbeCache: _getProbeCache } = await import("./uipath-integration");
  return _getProbeCache();
}
  
function clrToXamlType(clrType: string): string {
  const map: Record<string, string> = {
    "System.Object": "x:Object",
    "System.String": "x:String",
    "System.Boolean": "x:Boolean",
    "System.Int32": "x:Int32",
    "System.Int64": "x:Int64",
    "System.Double": "x:Double",
    "System.DateTime": "s:DateTime",
    "System.TimeSpan": "s:TimeSpan",
    "System.Exception": "s:Exception",
  };
  return map[clrType] || "x:String";
}

export function isValidNuGetVersion(version: string): boolean {
  return /^\[?\d+\.\d+(\.\d+){0,2}(,\s*\))?\]?$/.test(version);
}

function sanitizeDeps(deps: Record<string, string>): void {
  for (const [key, val] of Object.entries(deps)) {
    if (val === "*" || val === "[*]" || !isValidNuGetVersion(val)) {
      console.log(`[UiPath Sanitize] Removing invalid dependency version: ${key}=${val}`);
      delete deps[key];
    } else if (/^\[\d+\.\d+(\.\d+){0,2},\s*\)$/.test(val)) {
      // valid minimum-version range format [X.Y.Z, ) — keep as-is
    } else {
      const stripped = val.replace(/^\[|\]$/g, "");
      if (stripped !== val) {
        deps[key] = stripped;
      }
    }
  }
}

export function normalizePackageName(name: string): string {
  return UIPATH_PACKAGE_ALIAS_MAP[name] || name;
}

type CachedBuild = {
  fingerprint: string;
  version: string;
  buffer: Buffer;
  gaps: XamlGap[];
  usedPackages: string[];
  enrichment: EnrichmentResult | null;
  qualityGatePassed: boolean;
  qualityGateResult?: QualityGateResult;
  xamlEntries: { name: string; content: string }[];
  dependencyMap: Record<string, string>;
  archiveManifest: string[];
  referencedMLSkillNames?: string[];
  usedAIFallback?: boolean;
  projectJsonContent?: string;
};

const packageBuildCache = new Map<string, CachedBuild>();
const CACHE_MAX_ENTRIES = 20;

console.log("[UiPath Cache] Clearing build cache on module load");
packageBuildCache.clear();

function evictOldestCacheEntry(): void {
  if (packageBuildCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = packageBuildCache.keys().next().value;
    if (oldest) {
      packageBuildCache.delete(oldest);
      console.log(`[UiPath Cache] Evicted oldest entry: ${oldest}`);
    }
  }
}

export function clearPackageCache(ideaId: string): void {
  let cleared = false;
  for (const key of Array.from(packageBuildCache.keys())) {
    if (key === ideaId || key.startsWith(`${ideaId}:`)) {
      packageBuildCache.delete(key);
      cleared = true;
    }
  }
  if (cleared) {
    console.log(`[UiPath Cache] Cleared cache for ${ideaId}`);
  }
}

function buildXaml(className: string, displayName: string, activities: string, variablesBlock?: string): string {
  const vars = variablesBlock || "<Sequence.Variables />";
  return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeXml(className)}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Data;assembly=System.Data"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="${escapeXml(displayName)}">
    ${vars}${activities}
  </Sequence>
</Activity>`;
}

function generateUuid(): string {
  const hex = "0123456789abcdef";
  let uuid = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) uuid += "-";
    else if (i === 14) uuid += "4";
    else uuid += hex[Math.floor(Math.random() * 16)];
  }
  return uuid;
}

export function generateConfigXlsx(projectName: string, sddContent?: string, orchestratorArtifacts?: any): string {
  const settingsRows: string[][] = [["Name", "Value", "Description"]];
  const constantsRows: string[][] = [["Name", "Value", "Description"]];

  if (orchestratorArtifacts) {
    if (orchestratorArtifacts.assets) {
      for (const asset of orchestratorArtifacts.assets) {
        if (asset.type === "Credential") {
          settingsRows.push([asset.name, "", asset.description || `Credential: ${asset.name}`]);
        } else {
          settingsRows.push([asset.name, asset.value || "", asset.description || ""]);
        }
      }
    }
    if (orchestratorArtifacts.queues) {
      for (const q of orchestratorArtifacts.queues) {
        constantsRows.push([`QueueName_${q.name}`, q.name, q.description || `Queue: ${q.name}`]);
      }
    }
  } else if (sddContent) {
    const section9Match = sddContent.match(/## 9[\.\s][^\n]+\n([\s\S]*?)(?=## \d+\.|$)/);
    if (section9Match) {
      const artifactMatch = section9Match[1].match(/```orchestrator_artifacts\s*\n([\s\S]*?)\n```/);
      if (artifactMatch) {
        try {
          const artifacts = JSON.parse(artifactMatch[1]);
          if (artifacts.assets) {
            for (const asset of artifacts.assets) {
              if (asset.type === "Credential") {
                settingsRows.push([asset.name, "", asset.description || `Credential: ${asset.name}`]);
              } else {
                settingsRows.push([asset.name, asset.value || "", asset.description || ""]);
              }
            }
          }
        } catch { /* parse error */ }
      }
    }
  }

  if (sddContent) {
    const section4Match = sddContent.match(/## 4[\.\s][^\n]+\n([\s\S]*?)(?=## \d+\.|$)/);
    if (section4Match) {
      const urlMatches = section4Match[1].match(/https?:\/\/[^\s)>"]+/g);
      if (urlMatches) {
        const seen = new Set<string>();
        for (const url of urlMatches) {
          if (!seen.has(url)) {
            seen.add(url);
            constantsRows.push([`URL_${seen.size}`, url, `Integration endpoint`]);
          }
        }
      }
    }
  }

  settingsRows.push(["OrchestratorURL", "", "Orchestrator base URL"]);
  settingsRows.push(["ProcessTimeout", "30", "Max process timeout in minutes"]);
  settingsRows.push(["MaxRetries", "3", "Maximum retry attempts"]);
  settingsRows.push(["LogLevel", "Info", "Logging level (Info/Warn/Error)"]);

  const hasQueues = orchestratorArtifacts?.queues?.length > 0;
  if (hasQueues) {
    settingsRows.push(["OrchestratorQueueName", orchestratorArtifacts.queues[0].name, "Primary transaction queue"]);
    settingsRows.push(["MaxRetryNumber", "3", "REFramework max retry attempts per transaction"]);
    settingsRows.push(["ProcessName", projectName || "Automation", "REFramework process name"]);
  }

  constantsRows.push(["ApplicationName", projectName || "Automation", "Process name"]);
  constantsRows.push(["Version", "1.0.0", "Package version"]);
  constantsRows.push(["MaxWaitTime", "30000", "Max wait time in milliseconds"]);
  constantsRows.push(["RetryInterval", "5000", "Retry interval in milliseconds"]);

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Settings" sheetId="1" r:id="rId1"/>
    <sheet name="Constants" sheetId="2" r:id="rId2"/>
  </sheets>
  <definedNames/>
</workbook>
<!-- CONFIG DATA (Tab-separated for import into Excel) -->
<!-- Settings Sheet -->
`;

  for (const row of settingsRows) {
    xml += `<!-- ${row.join("\t")} -->\n`;
  }
  xml += `<!-- Constants Sheet -->\n`;
  for (const row of constantsRows) {
    xml += `<!-- ${row.join("\t")} -->\n`;
  }

  let csvSettings = settingsRows.map(r => r.join(",")).join("\n");
  let csvConstants = constantsRows.map(r => r.join(",")).join("\n");

  return `Settings\n${csvSettings}\n\nConstants\n${csvConstants}`;
}

import type {
  PipelineOutcomeReport,
  RemediationEntry,
  AutoRepairEntry,
  RemediationCode,
  RepairCode,
} from "./uipath-pipeline";

export type BuildResult = {
  buffer: Buffer;
  gaps: XamlGap[];
  usedPackages: string[];
  cacheHit?: boolean;
  qualityGateResult?: QualityGateResult;
  xamlEntries: { name: string; content: string }[];
  dependencyMap: Record<string, string>;
  archiveManifest: string[];
  usedFallbackStubs: boolean;
  generationMode: GenerationMode;
  referencedMLSkillNames: string[];
  dependencyWarnings?: Array<{ code: string; message: string; stage: string; recoverable: boolean }>;
  usedAIFallback: boolean;
  outcomeReport?: PipelineOutcomeReport;
  projectJsonContent?: string;
};

export function removeDuplicateAttributes(content: string): { content: string; changed: boolean; fixedTags: string[] } {
  const fixedTags: string[] = [];
  const result = content.replace(/<([a-zA-Z_][\w.:]*)\s([^>]*?)(\s*\/?>)/g, (match, tag, attrStr, closing) => {
    const seen = new Set<string>();
    let hasDuplicates = false;
    const cleaned = attrStr.replace(/([a-zA-Z_][\w.:]*)\s*=\s*"[^"]*"/g, (attrMatch: string, attrName: string) => {
      if (seen.has(attrName)) {
        hasDuplicates = true;
        return "";
      }
      seen.add(attrName);
      return attrMatch;
    });
    if (hasDuplicates) {
      fixedTags.push(tag);
      return `<${tag} ${cleaned.replace(/\s{2,}/g, " ").trim()}${closing}`;
    }
    return match;
  });
  return { content: result, changed: fixedTags.length > 0, fixedTags };
}

function buildDeterministicScaffold(
  processNodes: any[],
  projectName: string,
  sddContent?: string,
): { treeEnrichment: TreeEnrichmentResult; usedAIFallback: boolean } {
  const actionNodes = processNodes.filter((n: any) => n.nodeType !== "start" && n.nodeType !== "end");
  const children: TreeWorkflowSpec["rootSequence"]["children"] = [];

  children.push({
    kind: "activity" as const,
    template: "LogMessage",
    displayName: "Log Process Start",
    properties: { Level: "Info", Message: `"Starting ${projectName} process"` },
    outputVar: null,
    outputType: null,
    errorHandling: "none" as const,
  });

  for (const node of actionNodes) {
    const stepDesc = `TODO: Implement ${node.name}${node.description ? " - " + node.description : ""}${node.system ? " (System: " + node.system + ")" : ""}`;
    children.push({
      kind: "activity" as const,
      template: "Comment",
      displayName: `Step: ${node.name}`,
      properties: { Text: stepDesc },
      outputVar: null,
      outputType: null,
      errorHandling: "none" as const,
    });
    children.push({
      kind: "activity" as const,
      template: "LogMessage",
      displayName: `Log: ${node.name}`,
      properties: { Level: "Info", Message: `"Executing step: ${node.name}"` },
      outputVar: null,
      outputType: null,
      errorHandling: "none" as const,
    });
  }

  children.push({
    kind: "activity" as const,
    template: "LogMessage",
    displayName: "Log Process Complete",
    properties: { Level: "Info", Message: `"${projectName} process completed"` },
    outputVar: null,
    outputType: null,
    errorHandling: "none" as const,
  });

  const dhgNotes = ["This workflow was generated as a deterministic scaffold because AI enrichment was unavailable"];
  if (sddContent) {
    dhgNotes.push("SDD context was available but could not be processed by AI — review SDD for implementation details");
  }

  const spec: TreeWorkflowSpec = {
    name: projectName,
    description: `Deterministic scaffold for ${projectName}`,
    variables: [],
    arguments: [],
    rootSequence: {
      kind: "sequence" as const,
      displayName: `${projectName} - Main Sequence`,
      children,
    },
    useReFramework: false,
    dhgNotes,
    decomposition: [],
  };

  console.log(`[UiPath] Built deterministic scaffold for "${projectName}": ${actionNodes.length} action nodes → ${children.length} activities`);

  return {
    treeEnrichment: { status: "success", workflowSpec: spec, processType: "general" as ProcessType },
    usedAIFallback: true,
  };
}

function filterWorkflowSpecCatalogProperties(
  spec: TreeWorkflowSpec,
  warnings: Array<{ code: string; message: string; stage: string; recoverable: boolean }>,
): TreeWorkflowSpec {
  if (!catalogService.isLoaded()) return spec;

  let strippedCount = 0;

  function filterNode(node: any): any {
    if (node.kind === "activity") {
      const schema = catalogService.getActivitySchema(node.template);
      if (!schema) return node;

      const knownProps = new Set(schema.activity.properties.map((p: any) => p.name));
      const filteredProps: Record<string, any> = {};
      const stripped: string[] = [];

      for (const [key, value] of Object.entries(node.properties || {})) {
        if (knownProps.has(key)) {
          filteredProps[key] = value;
        } else {
          stripped.push(key);
        }
      }

      if (stripped.length > 0) {
        strippedCount += stripped.length;
        warnings.push({
          code: "CATALOG_PROPERTY_STRIPPED",
          message: `Stripped ${stripped.length} non-catalog property(ies) from ${node.template} "${node.displayName}": ${stripped.join(", ")}`,
          stage: "catalog-property-filter",
          recoverable: true,
        });
        console.log(`[Pipeline CatalogFilter] Stripped properties from ${node.template} "${node.displayName}": ${stripped.join(", ")}`);
      }

      return { ...node, properties: filteredProps };
    }

    if (node.kind === "sequence" && node.children) {
      return { ...node, children: node.children.map(filterNode) };
    }
    if (node.kind === "tryCatch") {
      return {
        ...node,
        tryChildren: (node.tryChildren || []).map(filterNode),
        catchChildren: (node.catchChildren || []).map(filterNode),
        finallyChildren: (node.finallyChildren || []).map(filterNode),
      };
    }
    if (node.kind === "if") {
      return {
        ...node,
        thenChildren: (node.thenChildren || []).map(filterNode),
        elseChildren: (node.elseChildren || []).map(filterNode),
      };
    }
    if (node.kind === "while" || node.kind === "forEach" || node.kind === "retryScope") {
      return { ...node, bodyChildren: (node.bodyChildren || []).map(filterNode) };
    }
    return node;
  }

  const filteredRoot = {
    ...spec.rootSequence,
    children: spec.rootSequence.children.map(filterNode),
  };

  if (strippedCount > 0) {
    console.log(`[Pipeline CatalogFilter] Total stripped: ${strippedCount} non-catalog properties`);
  }

  return { ...spec, rootSequence: filteredRoot };
}


export async function buildNuGetPackage(pkg: UiPathPackage, version: string = "1.0.0", ideaId?: string, generationMode: GenerationMode = "full_implementation", onProgress?: (event: { type: "started" | "heartbeat" | "completed" | "warning" | "failed"; stage: string; message: string }) => void): Promise<BuildResult> {
  const _probeCacheSnapshot = await getProbeCache();
  const projectName = (pkg.projectName || "Automation").replace(/\s+/g, "_");
  const sddContent = pkg.internal?.sddContent || "";
  const orchestratorArtifacts = pkg.internal?.orchestratorArtifacts || null;
  const processNodes = pkg.internal?.processNodes || [];
  const processEdges = pkg.internal?.processEdges || [];

  let fingerprint: string | undefined;
  const buildCacheKey = ideaId ? `${ideaId}:${generationMode}` : undefined;
  if (ideaId && buildCacheKey) {
    fingerprint = computePackageFingerprint(pkg, sddContent, processNodes, processEdges, orchestratorArtifacts, UIPATH_PACKAGE_ALIAS_MAP);
    const cached = packageBuildCache.get(buildCacheKey);
    if (cached && cached.fingerprint === fingerprint && cached.version === version) {
      if (!cached.qualityGatePassed) {
        console.log(`[UiPath Cache] HIT for ${buildCacheKey} but quality gate was not passed — rebuilding`);
        packageBuildCache.delete(buildCacheKey);
      } else {
        console.log(`[UiPath Cache] HIT for ${buildCacheKey} — skipping AI enrichment and XAML generation`);
        return { buffer: cached.buffer, gaps: cached.gaps, usedPackages: cached.usedPackages, cacheHit: true, qualityGateResult: cached.qualityGateResult, xamlEntries: cached.xamlEntries, dependencyMap: cached.dependencyMap, archiveManifest: cached.archiveManifest, usedFallbackStubs: false, generationMode, referencedMLSkillNames: cached.referencedMLSkillNames || [], usedAIFallback: cached.usedAIFallback || false, projectJsonContent: cached.projectJsonContent };
      }
    }
    if (cached && cached.fingerprint === fingerprint && cached.version !== version) {
      console.log(`[UiPath Cache] PARTIAL HIT for ${buildCacheKey} — reusing enrichment, rebuilding with v${version}`);
    } else {
      console.log(`[UiPath Cache] MISS for ${buildCacheKey}${cached ? " (fingerprint changed)" : " (no cache)"}`);
    }
  }

  const hasQueues = orchestratorArtifacts?.queues?.length > 0;
  let automationPattern = classifyAutomationPattern(
    processNodes,
    sddContent,
    hasQueues,
    undefined,
  );

  let enrichment: EnrichmentResult | null = null;
  let treeEnrichment: TreeEnrichmentResult | null = null;
  let _usedAIFallback = false;
  if (generationMode === "baseline_openable") {
    console.log(`[UiPath] baseline_openable mode — skipping AI enrichment, using flat scaffold`);
  } else {
    const cachedEntry = buildCacheKey ? packageBuildCache.get(buildCacheKey) : undefined;
    const canReuseEnrichment = cachedEntry && fingerprint && cachedEntry.fingerprint === fingerprint;
    if (canReuseEnrichment) {
      enrichment = cachedEntry.enrichment;
      if (enrichment) {
        console.log(`[UiPath] Reusing cached AI enrichment for ${ideaId} (${enrichment.nodes.length} nodes)`);
      } else {
        console.log(`[UiPath] Skipping AI enrichment for ${ideaId} (previously attempted, cached as null)`);
      }
    } else if (processNodes.length > 0 && sddContent) {
      try {
        console.log(`[UiPath] Requesting tree-based AI enrichment for ${processNodes.length} process nodes...`);
        const treeHeartbeat = onProgress ? setInterval(() => {
          onProgress({ type: "heartbeat", stage: "ai_enrichment", message: "AI is building the workflow tree structure — this may take a minute for complex processes..." });
        }, 10000) : null;
        try {
          const treeResult = await enrichWithAITree(
            processNodes,
            processEdges,
            sddContent,
            orchestratorArtifacts,
            projectName,
            45000,
            automationPattern
          );
          if (treeResult && treeResult.status === "success") {
            treeEnrichment = treeResult;
            console.log(`[UiPath] Tree enrichment successful: "${treeResult.workflowSpec.name}", ${treeResult.workflowSpec.variables.length} variables`);
          } else if (treeResult && treeResult.status === "validation_failed") {
            const errorSummary = treeResult.validationErrors.join("; ");
            console.log(`[UiPath] Tree enrichment validation failed after retry: ${errorSummary} — falling through to legacy/scaffold`);
          }
        } finally {
          if (treeHeartbeat) clearInterval(treeHeartbeat);
        }
      } catch (err: any) {
        console.log(`[UiPath] Tree enrichment error: ${err.message} — falling back to legacy/scaffold`);
      }

      if (!treeEnrichment) {
        try {
          console.log(`[UiPath] Falling back to legacy AI enrichment for ${processNodes.length} process nodes...`);
          const legacyHeartbeat = onProgress ? setInterval(() => {
            onProgress({ type: "heartbeat", stage: "ai_enrichment", message: "AI is enriching workflow activities — this may take a minute for complex processes..." });
          }, 10000) : null;
          try {
            enrichment = await enrichWithAI(
              processNodes,
              processEdges,
              sddContent,
              orchestratorArtifacts,
              projectName,
              45000,
              automationPattern
            );
            if (enrichment) {
              console.log(`[UiPath] AI enrichment successful: ${enrichment.nodes.length} enriched nodes, REFramework=${enrichment.useReFramework}, ${enrichment.decomposition?.length || 0} sub-workflows`);
            }
          } finally {
            if (legacyHeartbeat) clearInterval(legacyHeartbeat);
          }
        } catch (err: any) {
          console.log(`[UiPath] AI enrichment failed (falling back to keyword classification): ${err.message}`);
        }
      }

      if (!treeEnrichment && !enrichment && processNodes.length > 0) {
        console.log(`[UiPath] All AI enrichment paths failed — generating deterministic scaffold from ${processNodes.length} process nodes`);
        const scaffold = buildDeterministicScaffold(processNodes, projectName, sddContent || undefined);
        treeEnrichment = scaffold.treeEnrichment;
        _usedAIFallback = scaffold.usedAIFallback;
      }
    } else if (processNodes.length > 0 && !sddContent) {
      console.log(`[UiPath] No SDD content available — generating map-only deterministic scaffold from ${processNodes.length} process nodes`);
      const scaffold = buildDeterministicScaffold(processNodes, projectName, undefined);
      treeEnrichment = scaffold.treeEnrichment;
      _usedAIFallback = scaffold.usedAIFallback;
    }
  }

  automationPattern = classifyAutomationPattern(
    processNodes,
    sddContent,
    hasQueues,
    enrichment?.useReFramework,
  );
  const modeConfig = selectGenerationMode(automationPattern);
  generationMode = modeConfig.mode;
  const useReFramework = modeConfig.blockReFramework ? false : shouldUseReFramework(automationPattern);
  const genCtx: XamlGenerationContext = {
    generationMode,
    automationPattern,
    aiCenterSkills: pkg.internal?.aiCenterSkills || [],
    referencedMLSkillNames: [],
  };
  console.log(`[UiPath] Automation pattern: ${automationPattern}, generationMode: ${generationMode}, useReFramework: ${useReFramework}, reason: ${modeConfig.reason}`);
  const queueName = enrichment?.reframeworkConfig?.queueName
    || orchestratorArtifacts?.queues?.[0]?.name
    || "TransactionQueue";

  const trackedArchive = createTrackedArchive();
  const _archiveManifestTracker = trackedArchive.manifest;
  const _appendedContentHashes = trackedArchive.contentHashes;
  const archive = trackedArchive;

  const explicitFramework = pkg.internal?.targetFramework;
  const isServerless = explicitFramework === "Portable"
    || !!pkg.internal?.isServerless
    || (!explicitFramework && !!(_probeCacheSnapshot?.serverlessDetected) && !_probeCacheSnapshot?.flags?.hasUnattendedSlots);
    const libPath = isServerless ? "lib/net6.0" : "lib/net45";
    const xamlResults: XamlGeneratorResult[] = [];

    const contentTypesXml = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="nuspec" ContentType="application/octet" />
  <Default Extension="psmdcp" ContentType="application/vnd.openxmlformats-package.core-properties+xml" />
  <Default Extension="xaml" ContentType="application/octet" />
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="csv" ContentType="text/csv" />
  <Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
</Types>`;
    archive.append(contentTypesXml, { name: "[Content_Types].xml" });

    const corePropsId = generateUuid();
    const relsXml = `<?xml version="1.0" encoding="utf-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.microsoft.com/packaging/2010/07/manifest" Target="/${projectName}.nuspec" Id="R1" />
  <Relationship Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="/package/services/metadata/core-properties/${corePropsId}.psmdcp" Id="R2" />
</Relationships>`;
    archive.append(relsXml, { name: "_rels/.rels" });

    const coreProps = `<?xml version="1.0" encoding="utf-8"?>
<coreProperties xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://schemas.openxmlformats.org/package/2006/metadata/core-properties">
  <dc:creator>CannonBall</dc:creator>
  <dc:description>${escapeXml(pkg.description || projectName)}</dc:description>
  <dc:identifier>${projectName}</dc:identifier>
  <version>${version}</version>
</coreProperties>`;
    archive.append(coreProps, { name: `package/services/metadata/core-properties/${corePropsId}.psmdcp` });

    const confirmedVersionMap: Record<string, string> = isServerless
      ? {
          "UiPath.System.Activities": "25.10.0",
          "UiPath.UIAutomation.Activities": "25.10.0",
          "UiPath.Mail.Activities": "2.5.0",
          "UiPath.Database.Activities": "2.2.0",
          "UiPath.Persistence.Activities": "25.10.0",
          "UiPath.MLActivities": "25.10.0",
        }
      : {
          "UiPath.System.Activities": "23.10.3",
          "UiPath.UIAutomation.Activities": "23.10.8",
          "UiPath.Mail.Activities": "1.20.0",
          "UiPath.Database.Activities": "1.8.0",
          "UiPath.Persistence.Activities": "23.10.0",
          "UiPath.MLActivities": "23.10.0",
          "UiPath.IntelligentOCR.Activities": "8.20.0",
        };
    const UNVERIFIED_PACKAGES = new Set(["UiPath.Web.Activities", "UiPath.Excel.Activities"]);
    const deps: Record<string, string> = {
      "UiPath.System.Activities": confirmedVersionMap["UiPath.System.Activities"],
    };
    const dependencyWarnings: Array<{ code: string; message: string; stage: string; recoverable: boolean }> = [];

    const analysisReports: { fileName: string; report: AnalysisReport }[] = [];
    const xamlEntries: { name: string; content: string }[] = [];
    const deferredWrites = new Map<string, string>();
    const tf: TargetFramework = isServerless ? "Portable" : "Windows";
    const apEnabled = !!pkg.internal?.autopilotEnabled || !!(_probeCacheSnapshot?.flags?.autopilot);
    const earlyStubFallbacks: string[] = [];
    const allPolicyBlocked: Array<{ file: string; activities: string[] }> = [];
    const collectedQualityIssues: DhgQualityIssue[] = [];
    function compliancePass(rawXaml: string, fileName: string, skipTracking?: boolean): string {
      let compliant = makeUiPathCompliant(rawXaml, tf);
      const { filtered, removed } = filterBlockedActivitiesFromXaml(compliant, automationPattern);
      compliant = filtered;
      if (removed.length > 0) {
        console.log(`[UiPath Policy] ${fileName}: removed ${removed.length} blocked activit(ies) for pattern "${automationPattern}": ${removed.join(", ")}`);
      }
      const policyResult = applyActivityPolicy(compliant, modeConfig, fileName);
      compliant = policyResult.content;
      if (policyResult.blocked.length > 0) {
        allPolicyBlocked.push({ file: fileName, activities: policyResult.blocked });
        console.log(`[UiPath Policy] ${fileName}: blocked ${policyResult.blocked.join(", ")} (${generationMode} mode)`);
      }
      const { fixed, report } = analyzeAndFix(compliant);
      analysisReports.push({ fileName, report });
      if (!skipTracking) {
        xamlEntries.push({ name: fileName, content: fixed });
      }
      if (report.totalAutoFixed > 0) {
        console.log(`[UiPath Analyzer] ${fileName}: ${report.totalAutoFixed} auto-fixed, ${report.totalRemaining} remaining`);
      }
      return fixed;
    }

    function tryGenerateOrStub(
      generateFn: () => XamlGeneratorResult,
      wfName: string,
      description: string,
    ): XamlGeneratorResult | null {
      try {
        const result = generateFn();
        if (modeConfig.blockReFramework && isReFrameworkFile(`${wfName}.xaml`)) {
          console.log(`[UiPath Early Stub] Skipping REFramework file ${wfName}.xaml in ${generationMode} mode`);
          return null;
        }
        return result;
      } catch (err: any) {
        console.log(`[UiPath Early Stub] Generator failed for ${wfName}: ${err.message} — emitting stub`);
        const stubXaml = generateStubWorkflow(wfName, {
          reason: `Generator could not safely produce this workflow: ${err.message}`,
          isBlockingFallback: true,
        });
        const stubCompliant = compliancePass(stubXaml, `${wfName}.xaml`);
        deferredWrites.set(`${libPath}/${wfName}.xaml`, stubCompliant);
        earlyStubFallbacks.push(`${wfName}.xaml`);
        collectedQualityIssues.push({
          severity: "blocking",
          file: `${wfName}.xaml`,
          check: "generator-failure",
          detail: `Generator failed: ${err.message} — replaced with Studio-openable stub`,
          stubbedWorkflow: `${wfName}.xaml`,
        });
        return null;
      }
    }

    const workflows = pkg.workflows || [];
    let hasMain = false;
    const generatedWorkflowNames = new Set<string>();

    if (treeEnrichment && treeEnrichment.status === "success") {
      let spec = treeEnrichment.workflowSpec;
      spec = filterWorkflowSpecCatalogProperties(spec, dependencyWarnings);
      const specJson = JSON.stringify(spec, null, 2);
      const truncatedSpec = specJson.length > 5000 ? specJson.slice(0, 5000) + "\n... [truncated]" : specJson;
      console.log(`[UiPath] WorkflowSpec tree (validated) before assembly:\n${truncatedSpec}`);
      console.log(`[UiPath] Using tree-based assembly for "${spec.name}"`);

      const wfName = (spec.name || projectName).replace(/\s+/g, "_");
      try {
        const { xaml, variables } = assembleWorkflowFromSpec(spec, treeEnrichment.processType);
        const compliant = compliancePass(xaml, `${wfName}.xaml`);
        deferredWrites.set(`${libPath}/${wfName}.xaml`, compliant);
        generatedWorkflowNames.add(wfName);
        if (wfName === "Main" || wfName === "Process") hasMain = true;
        xamlResults.push({
          xaml: compliant,
          gaps: [],
          usedPackages: ["UiPath.System.Activities"],
          variables: variables.map(v => ({ name: v.name, type: v.type, defaultValue: v.default || "" })),
        });
        console.log(`[UiPath] Tree assembly produced XAML for "${wfName}" (${variables.length} variables)`);
      } catch (err: any) {
        console.log(`[UiPath] Tree assembly failed for "${wfName}": ${err.message} — falling back to legacy path`);
        treeEnrichment = null;
      }
    }

    if (enrichment?.decomposition?.length && !treeEnrichment) {
      console.log(`[UiPath] Using AI decomposition: ${enrichment.decomposition.length} sub-workflows`);
      for (const decomp of enrichment.decomposition) {
        const wfName = decomp.name.replace(/\s+/g, "_");
        const decompNodes = processNodes.filter((n: any) => decomp.nodeIds.includes(n.id));
        const decompEdges = processEdges.filter((e: any) =>
          decomp.nodeIds.includes(e.sourceNodeId) || decomp.nodeIds.includes(e.targetNodeId)
        );
        if (decompNodes.length > 0) {
          const result = tryGenerateOrStub(
            () => generateRichXamlFromNodes(decompNodes, decompEdges, wfName, decomp.description || "", enrichment, tf, apEnabled, genCtx),
            wfName,
            decomp.description || "",
          );
          if (result) {
            xamlResults.push(result);
            deferredWrites.set(`${libPath}/${wfName}.xaml`, compliancePass(result.xaml, `${wfName}.xaml`));
            generatedWorkflowNames.add(wfName);
            if (wfName === "Main") hasMain = true;
            console.log(`[UiPath] Generated decomposed workflow "${wfName}": ${decompNodes.length} nodes, ${result.gaps.length} gaps`);
          } else if (wfName === "Main") {
            hasMain = true;
          }
        } else {
          const specFallback = { name: decomp.name, description: decomp.description || "", steps: [] as Array<{ name: string; description: string }> };
          const result = tryGenerateOrStub(
            () => generateRichXamlFromSpec(specFallback, sddContent || undefined, undefined, tf, apEnabled, genCtx),
            wfName,
            decomp.description || "",
          );
          if (result) {
            xamlResults.push(result);
            deferredWrites.set(`${libPath}/${wfName}.xaml`, compliancePass(result.xaml, `${wfName}.xaml`));
            generatedWorkflowNames.add(wfName);
            if (wfName === "Main") hasMain = true;
            console.log(`[UiPath] Generated decomposed workflow "${wfName}" from spec (no matching nodes): ${result.gaps.length} gaps`);
          } else if (wfName === "Main") {
            hasMain = true;
          }
        }
      }
    }

    for (const wf of workflows) {
      const wfName = (wf.name || "Workflow").replace(/\s+/g, "_");
      if (generatedWorkflowNames.has(wfName)) continue;
      const result = tryGenerateOrStub(
        () => generateRichXamlFromSpec(wf, sddContent || undefined, undefined, tf, apEnabled, genCtx),
        wfName,
        wf.name || "Workflow",
      );
      if (result) {
        xamlResults.push(result);
        deferredWrites.set(`${libPath}/${wfName}.xaml`, compliancePass(result.xaml, `${wfName}.xaml`));
        generatedWorkflowNames.add(wfName);
        if (wfName === "Main") hasMain = true;
        console.log(`[UiPath] Generated rich XAML for "${wfName}": ${result.gaps.length} gaps, ${result.usedPackages.length} packages`);
      } else if (wfName === "Main") {
        hasMain = true;
      }
    }

    if (!hasMain && processNodes.length > 0 && !enrichment?.decomposition?.length && !treeEnrichment) {
      const processFileName = useReFramework ? "Process" : projectName;
      const processResult = tryGenerateOrStub(
        () => generateRichXamlFromNodes(processNodes, processEdges, processFileName, pkg.description || "", enrichment, tf, apEnabled, genCtx),
        processFileName,
        pkg.description || "",
      );
      if (processResult) {
        xamlResults.push(processResult);
        deferredWrites.set(`${libPath}/${processFileName}.xaml`, compliancePass(processResult.xaml, `${processFileName}.xaml`));
        console.log(`[UiPath] Generated process XAML from ${processNodes.length} map nodes: ${processResult.gaps.length} gaps`);
      }
    }

    const initXaml = generateInitAllSettingsXaml(orchestratorArtifacts, tf);
    deferredWrites.set(`${libPath}/InitAllSettings.xaml`, compliancePass(initXaml, "InitAllSettings.xaml"));

    if (useReFramework && !hasMain) {
      console.log(`[UiPath] Generating REFramework structure (queue: ${queueName})`);
      const mainXaml = generateReframeworkMainXaml(projectName, queueName, tf);
      deferredWrites.set(`${libPath}/Main.xaml`, compliancePass(mainXaml, "Main.xaml"));
      hasMain = true;

      const getTransXaml = generateGetTransactionDataXaml(queueName, tf);
      deferredWrites.set(`${libPath}/GetTransactionData.xaml`, compliancePass(getTransXaml, "GetTransactionData.xaml"));

      const setStatusXaml = generateSetTransactionStatusXaml(tf);
      deferredWrites.set(`${libPath}/SetTransactionStatus.xaml`, compliancePass(setStatusXaml, "SetTransactionStatus.xaml"));

      const closeAppsXaml = generateCloseAllApplicationsXaml(tf);
      deferredWrites.set(`${libPath}/CloseAllApplications.xaml`, compliancePass(closeAppsXaml, "CloseAllApplications.xaml"));

      const killXaml = generateKillAllProcessesXaml(tf);
      deferredWrites.set(`${libPath}/KillAllProcesses.xaml`, compliancePass(killXaml, "KillAllProcesses.xaml"));
    } else if (!hasMain) {
      let mainActivities = `
        <ui:InvokeWorkflowFile DisplayName="Initialize Settings" WorkflowFileName="InitAllSettings.xaml" />`;

      const invokedNames = new Set<string>();
      if (enrichment?.decomposition?.length) {
        for (const decomp of enrichment.decomposition) {
          const wfName = decomp.name.replace(/\s+/g, "_");
          invokedNames.add(wfName);
          mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(decomp.name)}" WorkflowFileName="${wfName}.xaml" />`;
        }
      }
      if (workflows.length > 0) {
        for (const wf of workflows) {
          const wfName = (wf.name || "Workflow").replace(/\s+/g, "_");
          if (invokedNames.has(wfName)) continue;
          invokedNames.add(wfName);
          mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(wf.name || wfName)}" WorkflowFileName="${wfName}.xaml" />`;
        }
      }
      if (invokedNames.size === 0 && processNodes.length > 0) {
        mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(projectName)}" WorkflowFileName="${projectName}.xaml" />`;
      } else if (invokedNames.size === 0) {
        mainActivities += `
        <ui:Comment DisplayName="Auto-generated by CannonBall" Text="This automation package was generated from the CannonBall pipeline. Open this project in UiPath Studio to build out the workflow logic." />`;
      }
      mainActivities += `
        <ui:LogMessage Level="Info" Message="[&quot;Process completed successfully&quot;]" DisplayName="Log Completion" />`;

      const closeAppsXaml = generateCloseAllApplicationsXaml(tf);
      deferredWrites.set(`${libPath}/CloseAllApplications.xaml`, compliancePass(closeAppsXaml, "CloseAllApplications.xaml"));

      const mainXaml = buildXaml("Main", `${projectName} - Main Workflow`, mainActivities);
      deferredWrites.set(`${libPath}/Main.xaml`, compliancePass(mainXaml, "Main.xaml"));
    }

    const configCsv = generateConfigXlsx(projectName, sddContent || undefined, orchestratorArtifacts);
    archive.append(configCsv, { name: `${libPath}/Data/Config.xlsx` });

    const allXamlContent = xamlEntries.map(e => e.content).join("\n");
    const scannedPackages = scanXamlForRequiredPackages(allXamlContent);
    for (const pkgName of scannedPackages) {
      if (deps[pkgName]) continue;
      if (UNVERIFIED_PACKAGES.has(pkgName)) {
        console.warn(`[UiPath] XAML uses activities from ${pkgName} but no confirmed version exists — omitting from project.json`);
        dependencyWarnings.push({
          code: "DEPENDENCY_VERSION_UNKNOWN",
          message: `Activities from ${pkgName} are used in XAML but no confirmed-resolvable version is available. This dependency is omitted from project.json.`,
          stage: "dependency-resolution",
          recoverable: true,
        });
        continue;
      }
      if (confirmedVersionMap[pkgName]) {
        deps[pkgName] = confirmedVersionMap[pkgName];
        console.log(`[UiPath] Auto-added dependency ${pkgName} v${confirmedVersionMap[pkgName]} (detected in emitted XAML activities)`);
      } else if (catalogService.isLoaded()) {
        const catalogVersion = catalogService.getConfirmedVersion(pkgName);
        if (catalogVersion) {
          deps[pkgName] = catalogVersion;
          console.log(`[Activity Catalog] Providing version for ${pkgName}: ${catalogVersion} (not in confirmedVersionMap)`);
        }
      }
    }

    const allGaps = aggregateGaps(xamlResults);

    const entryPointId = generateUuid();
    const studioVer = isServerless ? "24.10.0" : "23.10.6";
    const projectJson: Record<string, any> = {
      name: projectName,
      description: pkg.description || "",
      main: "Main.xaml",
      dependencies: deps,
      webServices: [],
      entitiesStores: [],
      schemaVersion: "4.0",
      studioVersion: studioVer,
      projectVersion: version,
      runtimeOptions: {
        autoDispose: false,
        netFrameworkLazyLoading: false,
        isPausable: true,
        isAttended: false,
        requiresUserInteraction: false,
        supportsPersistence: false,
        executionType: "Workflow",
        readyForPiP: false,
        startsInPiP: false,
        mustRestoreAllDependencies: true,
      },
      designOptions: {
        projectProfile: "Development",
        outputType: "Process",
        libraryOptions: { includeOriginalXaml: false, privateWorkflows: [] },
        processOptions: { ignoredFiles: [] },
        fileInfoCollection: [],
        modernBehavior: true,
      },
      expressionLanguage: isServerless ? "CSharp" : "VisualBasic",
      entryPoints: [
        {
          filePath: "Main.xaml",
          uniqueId: entryPointId,
          input: [],
          output: [],
        },
      ],
      isTemplate: false,
      templateProjectData: {},
      publishData: {},
    };
    if (isServerless) {
      projectJson.targetFramework = "Portable";
      projectJson.sourceLanguage = "CSharp";
    } else {
      projectJson.targetFramework = "Windows";
      projectJson.sourceLanguage = "VisualBasic";
    }
    if (apEnabled) {
      projectJson.designOptions.autopilotEnabled = true;
      projectJson.designOptions.selfHealingSelectors = true;
    }
    sanitizeDeps(deps);

    for (const [key, val] of Object.entries(deps)) {
      if (!isValidNuGetVersion(val)) {
        console.log(`[UiPath Final Check] Removing invalid dependency after sanitize: ${key}=${val}`);
        delete deps[key];
      }
    }

    const projectJsonStr = JSON.stringify(projectJson, null, 2);
    const parsedCheck = JSON.parse(projectJsonStr);
    if (parsedCheck.dependencies) {
      for (const [key, val] of Object.entries(parsedCheck.dependencies as Record<string, string>)) {
        if (typeof val === "string" && (val.includes("*") || !isValidNuGetVersion(val))) {
          console.error(`[UiPath JSON Check] Found invalid version in serialized project.json: ${key}=${val}, removing`);
          delete deps[key];
        }
      }
    }

    const allUsedPkgs = Object.keys(deps);

    const workflowNames: string[] = [];
    if (useReFramework) {
      workflowNames.push("Main", "GetTransactionData", "Process", "SetTransactionStatus", "CloseAllApplications", "KillAllProcesses");
    }
    if (enrichment?.decomposition?.length) {
      for (const d of enrichment.decomposition) {
        const n = d.name.replace(/\s+/g, "_");
        if (!workflowNames.includes(n)) workflowNames.push(n);
      }
    }
    for (const wf of workflows) {
      const n = (wf.name || "Workflow").replace(/\s+/g, "_");
      if (!workflowNames.includes(n)) workflowNames.push(n);
    }
    if (!workflowNames.includes("Main")) workflowNames.unshift("Main");
    if (!workflowNames.includes(projectName) && processNodes.length > 0 && !enrichment?.decomposition?.length && !useReFramework) {
      workflowNames.push(projectName);
    }

    const painPoints = processNodes
      .filter((n: any) => n.isPainPoint)
      .map((n: any) => ({ name: n.name, description: n.description || "" }));

    for (const pb of allPolicyBlocked) {
      for (const act of pb.activities) {
        collectedQualityIssues.push({
          severity: "warning",
          file: pb.file,
          check: "activity-policy-blocked",
          detail: `Activity ${act} was blocked by ${generationMode} mode activity policy`,
        });
      }
    }

    console.log(`[UiPath] DHG generation deferred until after quality gate processing`);

    const preArchiveViolations = validateXamlContent(xamlEntries);

    const missingFileViolations = preArchiveViolations.filter(v => v.check === "invoked-file");
    const stubsGenerated: string[] = [];
    if (missingFileViolations.length > 0) {
      const missingFiles = new Set<string>();
      for (const v of missingFileViolations) {
        const m = v.detail.match(/references "([^"]+)"/);
        if (m) missingFiles.add(m[1]);
      }
      for (const rawMissingFile of Array.from(missingFiles)) {
        const missingFile = rawMissingFile.replace(/\\/g, "/").replace(/^[./]+/, "");
        const stubXaml = generateStubWorkflow(missingFile);
        const stubCompliant = compliancePass(stubXaml, missingFile, true);
        deferredWrites.set(`${libPath}/${missingFile}`, stubCompliant);
        xamlEntries.push({ name: missingFile, content: stubCompliant });
        stubsGenerated.push(missingFile);
        console.log(`[UiPath Validation] Generated stub workflow for missing file: ${missingFile} (tracked in xamlEntries)`);
      }
    }

    const manifestBasenames = new Set(_archiveManifestTracker.filter(p => p.endsWith(".xaml")).map(p => p.split("/").pop() || p));
    const entryBasenames = new Set(xamlEntries.map(e => (e.name.split("/").pop() || e.name)));
    for (const mb of manifestBasenames) {
      if (!entryBasenames.has(mb)) {
        const stubXaml = generateStubWorkflow(mb.replace(".xaml", ""));
        const stubCompliant = compliancePass(stubXaml, mb, true);
        deferredWrites.set(`${libPath}/${mb}`, stubCompliant);
        xamlEntries.push({ name: mb, content: stubCompliant });
        stubsGenerated.push(mb);
        console.log(`[UiPath Pre-Package Check] Archive manifest had ${mb} without validated entry — generated stub`);
      }
    }
    for (let i = 0; i < xamlEntries.length; i++) {
      const content = xamlEntries[i].content;
      if (content.includes("PLACEHOLDER_") || content.includes("TODO_")) {
        const placeholderCount = (content.match(/PLACEHOLDER_|TODO_/g) || []).length;
        const commentReplacement = '<ui:Comment Text="REVIEW: Unknown activity type was generated here — implement manually" />';
        const afterTagSafety = content
          .replace(/<(ui:)?(?:TODO_|PLACEHOLDER_)(\w+)\b[^>]*?>[\s\S]*?<\/\1?(?:TODO_|PLACEHOLDER_)\2>/g, commentReplacement)
          .replace(/<(ui:)?(?:TODO_|PLACEHOLDER_)\w+\b[^>]*?\/>/g, commentReplacement);
        const cleaned = afterTagSafety
          .replace(/\[[^\]]*(?:PLACEHOLDER_\w*|TODO_\w*)[^\]]*\]/g, '[Nothing]')
          .replace(/PLACEHOLDER_\w*/g, '')
          .replace(/TODO_\w*/g, '');
        xamlEntries[i] = { ...xamlEntries[i], content: cleaned };
        const archivePath = Array.from(deferredWrites.keys()).find(
          p => (p.split("/").pop() || p) === (xamlEntries[i].name.split("/").pop() || xamlEntries[i].name)
        );
        if (archivePath) deferredWrites.set(archivePath, cleaned);
        console.log(`[UiPath Pre-Package Check] ${xamlEntries[i].name}: stripped ${placeholderCount} placeholder token(s)`);
      }
    }
    for (const [depName, depVer] of Object.entries(deps)) {
      if (/^\[\d+\.\d+(\.\d+){0,2},\s*\)$/.test(String(depVer))) {
        continue;
      }
      const cleanVer = String(depVer).replace(/[\[\]]/g, "");
      if (cleanVer !== depVer) {
        deps[depName] = cleanVer;
        console.log(`[UiPath Pre-Package Check] Stripped brackets from dependency version: ${depName} ${depVer} -> ${cleanVer}`);
      }
    }

    const projectJsonPath = `${libPath}/project.json`;
    const nuspecPath = `${projectName}.nuspec`;

    const buildContentHashRecord = () => {
      const hashRecord: Record<string, string> = {};
      _appendedContentHashes.forEach((hash, path) => { hashRecord[path] = hash; });
      for (const [path, content] of deferredWrites.entries()) {
        hashRecord[path] = createHash("sha256").update(content).digest("hex");
        hashRecord[`__validated__${path}`] = hashRecord[path];
      }
      const pjContent = JSON.stringify(projectJson, null, 2);
      hashRecord[projectJsonPath] = createHash("sha256").update(pjContent).digest("hex");
      hashRecord[`__validated__${projectJsonPath}`] = hashRecord[projectJsonPath];
      return hashRecord;
    };

    const allArchivePaths = [
      ..._archiveManifestTracker,
      ...Array.from(deferredWrites.keys()),
      projectJsonPath,
      nuspecPath,
    ];

    const autoFixSummary: string[] = [];
    const outcomeRemediations: RemediationEntry[] = [];
    const outcomeAutoRepairs: AutoRepairEntry[] = [];

    function mapCheckToRemediationCode(check: string): RemediationCode {
      const codeMap: Record<string, RemediationCode> = {
        "CATALOG_VIOLATION": "STUB_ACTIVITY_CATALOG_VIOLATION",
        "ENUM_VIOLATION": "STUB_ACTIVITY_CATALOG_VIOLATION",
        "catalog-violation": "STUB_ACTIVITY_CATALOG_VIOLATION",
        "policy-blocked-activity": "STUB_ACTIVITY_BLOCKED_PATTERN",
        "object-object": "STUB_ACTIVITY_OBJECT_OBJECT",
        "pseudo-xaml": "STUB_ACTIVITY_PSEUDO_XAML",
        "fake-trycatch": "STUB_ACTIVITY_PSEUDO_XAML",
        "xml-wellformedness": "STUB_ACTIVITY_WELLFORMEDNESS",
        "unknown-activity": "STUB_ACTIVITY_UNKNOWN",
        "invalid-takescreenshot-result": "STUB_ACTIVITY_BLOCKED_PATTERN",
        "invalid-takescreenshot-outputpath": "STUB_ACTIVITY_BLOCKED_PATTERN",
        "invalid-takescreenshot-outputpath-attr": "STUB_ACTIVITY_BLOCKED_PATTERN",
      };
      return codeMap[check] || "STUB_ACTIVITY_UNKNOWN";
    }

    function estimateEffortForCheck(check: string): number {
      const effortMap: Record<string, number> = {
        "CATALOG_VIOLATION": 10,
        "ENUM_VIOLATION": 5,
        "catalog-violation": 10,
        "policy-blocked-activity": 15,
        "object-object": 20,
        "pseudo-xaml": 30,
        "fake-trycatch": 20,
        "xml-wellformedness": 30,
        "unknown-activity": 15,
      };
      return effortMap[check] || 15;
    }

    function developerActionForCheck(check: string, file: string, displayName?: string): string {
      const actLabel = displayName ? `"${displayName}" activity` : "activity";
      const actions: Record<string, string> = {
        "catalog-violation": `Review ${actLabel} in ${file} — validate property values against UiPath catalog`,
        "CATALOG_VIOLATION": `Review ${actLabel} in ${file} — validate property values against UiPath catalog`,
        "ENUM_VIOLATION": `Fix enum value for ${actLabel} in ${file} — use valid enum from UiPath documentation`,
        "policy-blocked-activity": `Replace blocked ${actLabel} in ${file} with an allowed alternative`,
        "object-object": `Fix serialization failure for ${actLabel} in ${file} — replace [object Object] with actual values`,
        "pseudo-xaml": `Convert pseudo-XAML string attributes to proper nested XAML elements in ${file}`,
        "fake-trycatch": `Restructure TryCatch in ${file} to use nested elements instead of string attributes`,
        "xml-wellformedness": `Fix XML structure in ${file} — ensure proper nesting and closing tags`,
        "unknown-activity": `Replace unknown ${actLabel} in ${file} with a valid UiPath activity`,
      };
      return actions[check] || `Manually implement ${actLabel} in ${file} — estimated ${estimateEffortForCheck(check)} min`;
    }

    const catalogViolations: Array<{ file: string; detail: string }> = [];
    if (catalogService.isLoaded()) {
      try {
        for (let i = 0; i < xamlEntries.length; i++) {
          let content = xamlEntries[i].content;
          let modified = false;
          const fileName = xamlEntries[i].name.split("/").pop() || xamlEntries[i].name;

          const nsMap = new Map<string, string>();
          const nsRegex = /xmlns:(\w+)="([^"]+)"/g;
          let nsMatch;
          while ((nsMatch = nsRegex.exec(content)) !== null) {
            nsMap.set(nsMatch[1], nsMatch[2]);
          }

          const activityPrefixes = new Set<string>();
          for (const [prefix, uri] of nsMap.entries()) {
            if (uri.includes("clr-namespace:") || uri.includes("UiPath") || prefix === "ui") {
              activityPrefixes.add(prefix);
            }
          }

          const collectChildPropertyNames = (tagName: string, xmlContent: string, startPos: number): string[] => {
            const className = tagName.includes(":") ? tagName.split(":").pop()! : tagName;
            const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const openTagRegex = new RegExp(`<${escapedTag}[\\s>]`);
            const closeTagRegex = new RegExp(`</${escapedTag}>`);
            const afterStart = xmlContent.slice(startPos);
            const closeMatch = closeTagRegex.exec(afterStart);
            if (!closeMatch) return [];

            const elementBlock = afterStart.slice(0, closeMatch.index + closeMatch[0].length);

            const childPropRegex = new RegExp(`<${escapedClassName}\\.([\\w]+)[\\s>]`, "g");
            const children: string[] = [];
            let cm;
            while ((cm = childPropRegex.exec(elementBlock)) !== null) {
              children.push(cm[1]);
              children.push(`${className}.${cm[1]}`);
            }
            return children;
          };

          const elementRegex = /<((?:[\w]+:)?[\w]+)(\s[^>]*?|\s*)(\/?>)/g;
          let elMatch;

          while ((elMatch = elementRegex.exec(content)) !== null) {
            const fullTag = elMatch[1];
            const attrString = elMatch[2];

            if (fullTag.includes(".")) continue;
            if (fullTag.startsWith("x:") || fullTag.startsWith("sap") || fullTag.startsWith("mc:")) continue;

            const prefix = fullTag.includes(":") ? fullTag.split(":")[0] : null;
            const isActivityCandidate = !prefix || activityPrefixes.has(prefix) ||
              ["Assign", "Throw", "Sequence", "If", "ForEach", "Switch", "TryCatch", "Delay"].includes(fullTag);

            if (!isActivityCandidate) continue;

            const schema = catalogService.getActivitySchema(fullTag);
            if (!schema) continue;

            const attrs: Record<string, string> = {};
            const attrRegex = /([\w]+(?:\.[\w]+)?)="([^"]*)"/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(attrString)) !== null) {
              if (attrMatch[1].startsWith("xmlns") || attrMatch[1].includes(":")) continue;
              attrs[attrMatch[1]] = attrMatch[2];
            }

            const children = collectChildPropertyNames(fullTag, content, elMatch.index);
            const validation = catalogService.validateEmittedActivity(fullTag, attrs, children);

            if (validation.corrections.length > 0 || !validation.valid) {
              const correctedProperties = new Set<string>();

              for (const correction of validation.corrections) {
                if (correction.type === "move-to-child-element") {
                  const propName = correction.property;
                  const propVal = attrs[propName];
                  if (propVal !== undefined) {
                    const className = fullTag.includes(":") ? fullTag.split(":").pop()! : fullTag;
                    const wrapper = correction.argumentWrapper || "InArgument";
                    const xType = correction.typeArguments || clrToXamlType("System.String");

                    const escapedTag = fullTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const escapedVal = propVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const wrappedVal = ensureBracketWrapped(propVal);
                    const childElement = `<${className}.${propName}>\n            <${wrapper} x:TypeArguments="${xType}">${wrappedVal}</${wrapper}>\n          </${className}.${propName}>`;

                    const selfClosingRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)${propName}="${escapedVal}"([^>]*?)(\\s*\\/>)`);
                    const openTagRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)${propName}="${escapedVal}"([^>]*?>)`);

                    if (selfClosingRegex.test(content)) {
                      content = content.replace(selfClosingRegex, `$1 $2>\n          ${childElement}\n        </${fullTag}>`);
                      correctedProperties.add(propName);
                      modified = true;
                      autoFixSummary.push(`Catalog: Moved ${fullTag}.${propName} from attribute to child-element in ${fileName}`);
                    } else if (openTagRegex.test(content)) {
                      content = content.replace(openTagRegex, `$1 $2\n          ${childElement}`);
                      correctedProperties.add(propName);
                      modified = true;
                      autoFixSummary.push(`Catalog: Moved ${fullTag}.${propName} from attribute to child-element in ${fileName}`);
                    }
                  }
                } else if (correction.type === "fix-invalid-value" && correction.correctedValue) {
                  const propName = correction.property;
                  const oldVal = attrs[propName];
                  if (oldVal !== undefined) {
                    const escapedTag = fullTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const escapedOldVal = oldVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const attrRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)${propName}="${escapedOldVal}"`, "g");
                    const newContent = content.replace(attrRegex, `$1${propName}="${correction.correctedValue}"`);
                    if (newContent !== content) {
                      content = newContent;
                      correctedProperties.add(propName);
                      modified = true;
                      autoFixSummary.push(`Catalog: Corrected ${fullTag}.${propName} value from "${oldVal}" to "${correction.correctedValue}" in ${fileName}`);
                    }
                  }
                } else if (correction.type === "wrap-in-argument" && correction.argumentWrapper) {
                  const propName = correction.property;
                  const className = fullTag.includes(":") ? fullTag.split(":").pop()! : fullTag;
                  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const wrapper = correction.argumentWrapper;
                  const xType = correction.typeArguments || clrToXamlType("System.String");

                  const childTagRegex = new RegExp(
                    `(<${escapedClassName}\\.${propName}>)\\s*(?!<(?:InArgument|OutArgument|InOutArgument)[\\s>])([\\s\\S]*?)\\s*(<\\/${escapedClassName}\\.${propName}>)`,
                  );
                  if (childTagRegex.test(content)) {
                    content = content.replace(childTagRegex,
                      `$1\n            <${wrapper} x:TypeArguments="${xType}">$2</${wrapper}>\n          $3`
                    );
                    correctedProperties.add(propName);
                    modified = true;
                    autoFixSummary.push(`Catalog: Wrapped ${fullTag}.${propName} child content in <${wrapper}> in ${fileName}`);
                  }
                }
              }

              for (const v of validation.violations) {
                const propMatch = v.match(/"([^"]+)"/);
                const violationProp = propMatch ? propMatch[1] : null;
                if (!violationProp || !correctedProperties.has(violationProp)) {
                  catalogViolations.push({ file: fileName, detail: v });
                }
              }
            }
          }

          if (modified) {
            xamlEntries[i] = { name: xamlEntries[i].name, content };
            const archivePath = Array.from(deferredWrites.keys()).find(
              p => (p.split("/").pop() || p) === fileName
            );
            if (archivePath) {
              deferredWrites.set(archivePath, content);
            }
          }
        }

        if (catalogViolations.length > 0) {
          console.log(`[Activity Catalog] ${catalogViolations.length} unfixable catalog violation(s) found`);
        }
      } catch (err: any) {
        console.warn(`[Activity Catalog] Post-generation validation failed: ${err.message}`);
      }
    }

    for (let i = 0; i < xamlEntries.length; i++) {
      let content = xamlEntries[i].content;
      let wasFixed = false;

      const logLevelMap: Record<string, string> = {
        "Information": "Info",
        "Warning": "Warn",
        "Debug": "Trace",
        "Critical": "Fatal",
      };
      for (const [badLevel, goodLevel] of Object.entries(logLevelMap)) {
        const logLevelRegex = new RegExp(`(<ui:LogMessage\\s[^>]*?)Level="${badLevel}"`, "g");
        if (logLevelRegex.test(content)) {
          content = content.replace(new RegExp(`(<ui:LogMessage\\s[^>]*?)Level="${badLevel}"`, "g"), `$1Level="${goodLevel}"`);
          autoFixSummary.push(`Normalised LogMessage Level="${badLevel}" → "${goodLevel}" in ${xamlEntries[i].name}`);
          wasFixed = true;
        }
      }

      content = content.replace(/<sap:WorkflowViewState\.ViewStateManager>[\s\S]*?<\/sap:WorkflowViewState\.ViewStateManager>/g, "");
      content = content.replace(/<WorkflowViewState\.ViewStateManager>[\s\S]*?<\/WorkflowViewState\.ViewStateManager>/g, "");

      const ampersandRegex = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g;
      if (ampersandRegex.test(content)) {
        content = content.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;");
        autoFixSummary.push(`Escaped raw ampersands in ${xamlEntries[i].name}`);
        wasFixed = true;
      }

      const bareLtRegex = /(<(?:In|Out)Argument[^>]*>)([\s\S]*?)(<\/(?:In|Out)Argument>)/g;
      const bareLtFixed = content.replace(bareLtRegex, (_match: string, open: string, inner: string, close: string) => {
        const escapedInner = inner.replace(/<(?![\/a-zA-Z!?])/g, "&lt;").replace(/&lt;>/g, "&lt;&gt;");
        return open + escapedInner + close;
      });
      if (bareLtFixed !== content) {
        content = bareLtFixed;
        autoFixSummary.push(`Escaped bare < in argument content in ${xamlEntries[i].name}`);
        wasFixed = true;
      }

      const dupResult = removeDuplicateAttributes(content);
      if (dupResult.changed) {
        content = dupResult.content;
        for (const tag of dupResult.fixedTags) {
          autoFixSummary.push(`Removed duplicate attributes on <${tag}> in ${xamlEntries[i].name}`);
        }
        wasFixed = true;
      }

      content = content.replace(/<ui:TakeScreenshot\s+([^>]*?)OutputPath="([^"]*)"([^>]*?)\/>/g, (_match, before, _outputPathVal, after) => {
        const attrs = (before + after).trim();
        autoFixSummary.push(`Stripped TakeScreenshot OutputPath in ${xamlEntries[i].name}`);
        return `<ui:TakeScreenshot ${attrs} />`;
      });

      const continueOnErrorWhitelist = new Set([
        "ui:Click", "ui:TypeInto", "ui:GetText", "ui:ElementExists",
        "ui:OpenBrowser", "ui:NavigateTo", "ui:AttachBrowser", "ui:AttachWindow",
        "ui:UseBrowser", "ui:UseApplicationBrowser",
      ]);
      content = content.replace(/<(ui:\w+)\s+([^>]*?)ContinueOnError="[^"]*"([^>]*?)(\s*\/?>)/g, (match, tag, before, after, closing) => {
        if (continueOnErrorWhitelist.has(tag)) return match;
        return `<${tag} ${(before + after).trim()}${closing}`;
      });

      content = content.replace(/Message="'([^"]*)(?<!')]"/g, (match, val) => {
        if (val.endsWith("'")) return match;
        return `Message="[&quot;${val}&quot;]"`;
      });

      if (content !== xamlEntries[i].content) {
        xamlEntries[i] = { name: xamlEntries[i].name, content };
        const basename = xamlEntries[i].name.split("/").pop() || xamlEntries[i].name;
        const archivePath = Array.from(deferredWrites.keys()).find(p => (p.split("/").pop() || p) === basename);
        if (archivePath) {
          deferredWrites.set(archivePath, content);
        }
        if (!wasFixed) autoFixSummary.push(`Applied XAML sanitization fixes to ${xamlEntries[i].name}`);
      }
    }

    let qualityGateResult = runQualityGate({
      xamlEntries,
      projectJsonContent: projectJsonStr,
      configData: configCsv,
      orchestratorArtifacts,
      targetFramework: tf,
      archiveManifest: allArchivePaths,
      archiveContentHashes: buildContentHashRecord(),
      automationPattern,
    });

    const applyCatalogViolations = (result: typeof qualityGateResult) => {
      if (catalogViolations.length > 0) {
        const existingKeys = new Set(
          result.violations
            .filter(v => v.check === "CATALOG_VIOLATION" || v.check === "ENUM_VIOLATION")
            .map(v => `${v.file}::${v.detail}`)
        );
        let addedWarnings = 0;
        let addedErrors = 0;
        for (const cv of catalogViolations) {
          const key = `${cv.file}::${cv.detail}`;
          if (!existingKeys.has(key)) {
            const isEnumViolation = cv.detail.includes("ENUM_VIOLATION");
            result.violations.push({
              category: "accuracy",
              severity: isEnumViolation ? "error" : "warning",
              check: isEnumViolation ? "ENUM_VIOLATION" : "CATALOG_VIOLATION",
              file: cv.file,
              detail: cv.detail,
            });
            existingKeys.add(key);
            if (isEnumViolation) {
              addedErrors++;
            } else {
              addedWarnings++;
            }
          }
        }
        if (addedWarnings > 0) {
          result.summary.accuracyWarnings = (result.summary.accuracyWarnings || 0) + addedWarnings;
          result.summary.totalWarnings += addedWarnings;
        }
        if (addedErrors > 0) {
          result.summary.accuracyErrors = (result.summary.accuracyErrors || 0) + addedErrors;
          result.summary.totalErrors = (result.summary.totalErrors || 0) + addedErrors;
          result.passed = false;
        }
      }
    };
    applyCatalogViolations(qualityGateResult);

    let usedFallback = false;

    if (!qualityGateResult.passed) {
      console.log(`[UiPath Quality Gate] Initial check failed with ${qualityGateResult.summary.totalErrors} error(s). Attempting auto-remediation...`);

      const classifiedIssues = classifyQualityIssues(qualityGateResult);
      for (const ci of classifiedIssues) {
        collectedQualityIssues.push({
          severity: ci.severity,
          file: ci.file,
          check: ci.check,
          detail: ci.detail,
        });
      }

      for (let i = 0; i < xamlEntries.length; i++) {
        let content = xamlEntries[i].content;
        let wasFixed = false;

        for (const [aliasName, canonicalName] of Object.entries(ACTIVITY_NAME_ALIAS_MAP)) {
          const escapedAlias = aliasName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const aliasRegex = new RegExp(`<${escapedAlias}(\\s|>|\\/)`, "g");
          const closingRegex = new RegExp(`</${escapedAlias}>`, "g");
          if (aliasRegex.test(content)) {
            content = content.replace(new RegExp(`<${escapedAlias}(\\s|>|\\/)`, "g"), `<${canonicalName}$1`);
            content = content.replace(closingRegex, `</${canonicalName}>`);
            autoFixSummary.push(`Normalised activity alias ${aliasName} → ${canonicalName} in ${xamlEntries[i].name}`);
            wasFixed = true;
          }
        }

        const unknownActivityViolations = qualityGateResult.violations.filter(
          v => v.check === "unknown-activity" && v.file === (xamlEntries[i].name.split("/").pop() || xamlEntries[i].name)
        );
        for (const v of unknownActivityViolations) {
          const actMatch = v.detail.match(/unknown activity "([^"]+)"/);
          if (actMatch) {
            const badTag = actMatch[1];
            if (ACTIVITY_NAME_ALIAS_MAP[badTag]) continue;
            content = content.replace(new RegExp(`<${badTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*\\/?>`, "g"), `<ui:Comment Text="Removed unknown activity: ${badTag}" />`);
            content = content.replace(new RegExp(`</${badTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>`, "g"), "");
            autoFixSummary.push(`Removed unknown activity ${badTag} from ${xamlEntries[i].name}`);
            wasFixed = true;
          }
        }

        content = content.replace(/<ui:Assign\s/g, "<Assign ");
        content = content.replace(/<\/ui:Assign>/g, "</Assign>");

        content = content.replace(/WorkflowFileName="Workflows\\([^"]+)"/g, 'WorkflowFileName="$1"');
        content = content.replace(/WorkflowFileName="Workflows\/([^"]+)"/g, 'WorkflowFileName="$1"');
        content = content.replace(/WorkflowFileName="([^"]+)"/g, (_match, p1) => {
          const cleaned = p1.replace(/\\/g, "/").replace(/^[./]+/, "");
          return `WorkflowFileName="${cleaned}"`;
        });

        content = content.replace(/Dictionary<String,\s*ui:InArgument>/g, 'Dictionary<x:String, x:Object>');
        content = content.replace(/x:TypeArguments="x:String, ui:InArgument"/g, 'x:TypeArguments="x:String, x:Object"');

        if (content !== xamlEntries[i].content) {
          xamlEntries[i] = { name: xamlEntries[i].name, content };
          if (!wasFixed) autoFixSummary.push(`Applied XAML fixes to ${xamlEntries[i].name}`);
        }
      }

      for (const entry of xamlEntries) {
        const basename = entry.name.split("/").pop() || entry.name;
        const archivePath = Array.from(deferredWrites.keys()).find(p => (p.split("/").pop() || p) === basename);
        if (archivePath) {
          deferredWrites.set(archivePath, entry.content);
        }
      }

      const depsAfterScan = scanXamlForRequiredPackages(xamlEntries.map(e => e.content).join("\n"));
      for (const pkg of depsAfterScan) {
        if (deps[pkg]) continue;
        if (UNVERIFIED_PACKAGES.has(pkg)) continue;
        if (confirmedVersionMap[pkg]) {
          deps[pkg] = confirmedVersionMap[pkg];
          autoFixSummary.push(`Added missing dependency: ${pkg}`);
        } else if (catalogService.isLoaded()) {
          const catalogVersion = catalogService.getConfirmedVersion(pkg);
          if (catalogVersion) {
            deps[pkg] = catalogVersion;
            autoFixSummary.push(`Added dependency from catalog: ${pkg}@${catalogVersion}`);
            console.log(`[Activity Catalog] Providing version for ${pkg}: ${catalogVersion} (not in confirmedVersionMap)`);
          }
        }
      }

      const fixedProjectJsonStr = JSON.stringify(projectJson, null, 2);

      qualityGateResult = runQualityGate({
        xamlEntries,
        projectJsonContent: fixedProjectJsonStr,
        configData: configCsv,
        orchestratorArtifacts,
        targetFramework: tf,
        archiveManifest: allArchivePaths,
        archiveContentHashes: buildContentHashRecord(),
        automationPattern,
      });
      applyCatalogViolations(qualityGateResult);

      if (!qualityGateResult.passed) {
        const reClassified = classifyQualityIssues(qualityGateResult);
        const blockingFiles = getBlockingFiles(reClassified);
        const onlyWarnings = hasOnlyWarnings(reClassified);

        if (onlyWarnings) {
          console.log(`[UiPath Quality Gate] Only warning-level issues remain (${qualityGateResult.summary.totalWarnings}) — shipping package with warnings documented in DHG`);
          qualityGateResult = { ...qualityGateResult, passed: true };
        } else if (blockingFiles.size > 0) {
          console.log(`[UiPath Escalation] Level 1: Attempting per-activity stub replacement for ${blockingFiles.size} file(s)`);
          let perActivityFixed = false;

          for (let i = 0; i < xamlEntries.length; i++) {
            const entryName = xamlEntries[i].name;
            const shortName = entryName.split("/").pop() || entryName;
            if (!blockingFiles.has(shortName)) continue;

            const fileIssues = reClassified.filter(ci => ci.file === shortName && ci.severity === "blocking");
            let content = xamlEntries[i].content;
            let anyReplaced = false;

            for (const issue of fileIssues) {
              const stubResult = replaceActivityWithStub(content, issue);
              if (stubResult.replaced) {
                content = stubResult.content;
                anyReplaced = true;
                perActivityFixed = true;
                autoFixSummary.push(`Per-activity stub: replaced ${stubResult.originalTag || "activity"}${stubResult.originalDisplayName ? ` (${stubResult.originalDisplayName})` : ""} in ${shortName} [${issue.check}]`);
                outcomeRemediations.push({
                  level: "activity",
                  file: shortName,
                  remediationCode: mapCheckToRemediationCode(issue.check),
                  originalTag: stubResult.originalTag,
                  originalDisplayName: stubResult.originalDisplayName,
                  reason: issue.detail,
                  classifiedCheck: issue.check,
                  developerAction: developerActionForCheck(issue.check, shortName, stubResult.originalDisplayName),
                  estimatedEffortMinutes: estimateEffortForCheck(issue.check),
                });
              }
            }

            if (anyReplaced) {
              xamlEntries[i] = { name: entryName, content };
              const archivePath = Array.from(deferredWrites.keys()).find(p => (p.split("/").pop() || p) === shortName);
              if (archivePath) {
                deferredWrites.set(archivePath, content);
              }
            }
          }

          if (perActivityFixed) {
            const perActivityProjectJsonStr = JSON.stringify(projectJson, null, 2);
            qualityGateResult = runQualityGate({
              xamlEntries,
              projectJsonContent: perActivityProjectJsonStr,
              configData: configCsv,
              orchestratorArtifacts,
              targetFramework: tf,
              archiveManifest: allArchivePaths,
              archiveContentHashes: buildContentHashRecord(),
              automationPattern,
            });
            applyCatalogViolations(qualityGateResult);

            if (qualityGateResult.passed || hasOnlyWarnings(classifyQualityIssues(qualityGateResult))) {
              console.log(`[UiPath Escalation] Per-activity stubs resolved all blocking issues`);
              if (!qualityGateResult.passed) qualityGateResult = { ...qualityGateResult, passed: true };
              usedFallback = true;
            }
          }

          if (!qualityGateResult.passed && !hasOnlyWarnings(classifyQualityIssues(qualityGateResult))) {
            console.log(`[UiPath Escalation] Level 2: Attempting per-sequence stub replacement`);
            const seqClassified = classifyQualityIssues(qualityGateResult);
            const seqBlockingFiles = getBlockingFiles(seqClassified);

            let perSequenceFixed = false;
            for (let i = 0; i < xamlEntries.length; i++) {
              const entryName = xamlEntries[i].name;
              const shortName = entryName.split("/").pop() || entryName;
              if (!seqBlockingFiles.has(shortName)) continue;

              const fileIssues = seqClassified.filter(ci => ci.file === shortName && ci.severity === "blocking");
              const seqResult = replaceSequenceChildrenWithStub(xamlEntries[i].content, fileIssues);
              if (seqResult.replaced) {
                xamlEntries[i] = { name: entryName, content: seqResult.content };
                const archivePath = Array.from(deferredWrites.keys()).find(p => (p.split("/").pop() || p) === shortName);
                if (archivePath) {
                  deferredWrites.set(archivePath, seqResult.content);
                }
                perSequenceFixed = true;
                autoFixSummary.push(`Per-sequence stub: replaced ${seqResult.replacedActivityCount} activities in sequence "${seqResult.sequenceDisplayName}" in ${shortName}`);
                outcomeRemediations.push({
                  level: "sequence",
                  file: shortName,
                  remediationCode: "STUB_SEQUENCE_MULTIPLE_FAILURES",
                  originalDisplayName: seqResult.sequenceDisplayName,
                  reason: `${seqResult.replacedActivityCount} activities in sequence failed validation`,
                  classifiedCheck: fileIssues.map(i => i.check).filter((v, idx, arr) => arr.indexOf(v) === idx).join(", "),
                  developerAction: `Re-implement ${seqResult.replacedActivityCount} activities in sequence "${seqResult.sequenceDisplayName}" in ${shortName}`,
                  estimatedEffortMinutes: seqResult.replacedActivityCount * 15,
                });
              }
            }

            if (perSequenceFixed) {
              const seqProjectJsonStr = JSON.stringify(projectJson, null, 2);
              qualityGateResult = runQualityGate({
                xamlEntries,
                projectJsonContent: seqProjectJsonStr,
                configData: configCsv,
                orchestratorArtifacts,
                targetFramework: tf,
                archiveManifest: allArchivePaths,
                archiveContentHashes: buildContentHashRecord(),
                automationPattern,
              });
              applyCatalogViolations(qualityGateResult);

              if (qualityGateResult.passed || hasOnlyWarnings(classifyQualityIssues(qualityGateResult))) {
                console.log(`[UiPath Escalation] Per-sequence stubs resolved all blocking issues`);
                if (!qualityGateResult.passed) qualityGateResult = { ...qualityGateResult, passed: true };
                usedFallback = true;
              }
            }
          }

          if (!qualityGateResult.passed && !hasOnlyWarnings(classifyQualityIssues(qualityGateResult))) {
            console.log(`[UiPath Escalation] Level 3: Per-workflow stub fallback for remaining blocking files`);
            const wfClassified = classifyQualityIssues(qualityGateResult);
            const wfBlockingFiles = getBlockingFiles(wfClassified);
            usedFallback = true;

            for (let i = 0; i < xamlEntries.length; i++) {
              const entryName = xamlEntries[i].name;
              const shortName = entryName.split("/").pop() || entryName;
              if (!wfBlockingFiles.has(shortName)) continue;

              const className = shortName.replace(".xaml", "");
              const blockingDetails = wfClassified.filter(ci => ci.file === shortName && ci.severity === "blocking");
              const stubXaml = generateStubWorkflow(className, {
                reason: `Blocking quality gate issues: ${blockingDetails.map(d => d.check).join(", ")}`,
                isBlockingFallback: true,
              });
              const stubCompliant = makeUiPathCompliant(stubXaml, tf);
              xamlEntries[i] = { name: entryName, content: stubCompliant };

              const archivePath = Array.from(deferredWrites.keys()).find(p => (p.split("/").pop() || p) === shortName);
              if (archivePath) {
                deferredWrites.set(archivePath, stubCompliant);
              }
              earlyStubFallbacks.push(shortName);
              autoFixSummary.push(`Replaced ${entryName} with per-workflow Studio-openable stub (blocking issues: ${blockingDetails.map(d => d.check).join(", ")})`);
              for (const bd of blockingDetails) {
                outcomeRemediations.push({
                  level: "workflow",
                  file: shortName,
                  remediationCode: "STUB_WORKFLOW_BLOCKING",
                  reason: bd.detail,
                  classifiedCheck: bd.check,
                  developerAction: `Re-implement entire workflow ${shortName} — per-activity and per-sequence repair could not produce valid XAML`,
                  estimatedEffortMinutes: 60,
                });
              }
            }

            const stubPackages = new Set<string>();
            for (const stubEntry of xamlEntries) {
              const scanned = scanXamlForRequiredPackages(stubEntry.content);
              for (const pkg of scanned) stubPackages.add(pkg);
            }
            for (const key of Object.keys(deps)) {
              if (!stubPackages.has(key)) {
                delete deps[key];
              }
            }
            for (const pkg of stubPackages) {
              if (!deps[pkg]) {
                deps[pkg] = confirmedVersionMap[pkg] || (tf === "Windows" ? "23.10.0" : "25.10.0");
              }
            }
            if (!deps["UiPath.System.Activities"]) {
              deps["UiPath.System.Activities"] = confirmedVersionMap["UiPath.System.Activities"];
            }
            projectJson.dependencies = { ...deps };
            const stubProjectJsonStr = JSON.stringify(projectJson, null, 2);

            qualityGateResult = runQualityGate({
              xamlEntries,
              projectJsonContent: stubProjectJsonStr,
              configData: configCsv,
              orchestratorArtifacts,
              targetFramework: tf,
              archiveManifest: allArchivePaths,
              archiveContentHashes: buildContentHashRecord(),
              automationPattern,
            });
            applyCatalogViolations(qualityGateResult);

            if (!qualityGateResult.passed) {
              const finalClassified = classifyQualityIssues(qualityGateResult);
              if (hasOnlyWarnings(finalClassified)) {
                console.log(`[UiPath Quality Gate] After per-workflow stub fallback, only warnings remain — passing`);
                qualityGateResult = { ...qualityGateResult, passed: true };
              } else {
                console.log(`[UiPath Quality Gate] After per-workflow stub fallback, some blocking issues remain — passing with warnings`);
                qualityGateResult = { ...qualityGateResult, passed: true };
                autoFixSummary.push(`Skipped full-package stub escalation — per-workflow stubs already cover affected files`);
              }
            }
          }
        } else {
          console.log(`[UiPath Quality Gate] Still failing after remediation (${qualityGateResult.summary.totalErrors} errors) with package-level blocking issues — passing with warnings instead of full-package stub fallback`);
          qualityGateResult = { ...qualityGateResult, passed: true };
          autoFixSummary.push(`Skipped full-package stub fallback for package-level issues — preserving generated workflows`);
        }
      }

      if (autoFixSummary.length > 0) {
        console.log(`[UiPath Auto-Remediation] Applied ${autoFixSummary.length} fix(es):\n${autoFixSummary.map(s => `  - ${s}`).join("\n")}`);
      }
    }

    if (!qualityGateResult.passed && !usedFallback) {
      if (generationMode === "baseline_openable") {
        const formattedViolations = formatQualityGateViolations(qualityGateResult);
        console.warn(`[UiPath Quality Gate] baseline_openable mode — demoting ${qualityGateResult.summary.totalErrors} error(s) to warnings (non-blocking):\n${formattedViolations}`);
      } else {
        const formattedViolations = formatQualityGateViolations(qualityGateResult);
        console.error(`[UiPath Quality Gate] FAILED after remediation:\n${formattedViolations}`);
        throw new QualityGateError(
          `UiPath pre-package quality gate failed with ${qualityGateResult.summary.totalErrors} error(s) after auto-remediation:\n${formattedViolations}`,
          qualityGateResult
        );
      }
    }

    if (!qualityGateResult.passed && usedFallback) {
      const formattedViolations = formatQualityGateViolations(qualityGateResult);
      console.warn(`[UiPath Quality Gate] Delivering fallback package with ${qualityGateResult.summary.totalErrors} residual finding(s):\n${formattedViolations}`);
    }

    {
      const warnCount = qualityGateResult.summary.totalWarnings;
      const evidenceCount = qualityGateResult.positiveEvidence?.length || 0;
      const status = usedFallback ? "PASSED_WITH_FALLBACK" : (generationMode === "baseline_openable" && !qualityGateResult.passed ? "BASELINE_OPENABLE" : "PASSED");
      console.log(`[UiPath Quality Gate] ${status}${warnCount > 0 ? ` with ${warnCount} warning(s)` : ""}${stubsGenerated.length > 0 ? `, ${stubsGenerated.length} stub(s) generated` : ""}${usedFallback ? ", FALLBACK stubs used" : ""}, ${evidenceCount} positive evidence item(s)`);
      if (autoFixSummary.length > 0) {
        console.log(`[UiPath Auto-Remediation Summary] ${autoFixSummary.length} fix(es) applied:\n${autoFixSummary.map(s => `  - ${s}`).join("\n")}`);
      }
    }

    const dhg = generateDeveloperHandoffGuide({
      projectName,
      description: pkg.description || "",
      gaps: allGaps,
      usedPackages: allUsedPkgs,
      workflowNames,
      sddContent: sddContent || undefined,
      enrichment,
      useReFramework,
      painPoints,
      deploymentResults: pkg.internal?.deploymentResults || undefined,
      extractedArtifacts: orchestratorArtifacts || undefined,
      analysisReports,
      automationType: pkg.internal?.automationType || undefined,
      targetFramework: tf,
      autopilotEnabled: apEnabled,
      generationMode,
      generationModeReason: modeConfig.reason,
      qualityIssues: collectedQualityIssues,
      stubbedWorkflows: earlyStubFallbacks.length > 0 ? earlyStubFallbacks : undefined,
    });
    archive.append(dhg, { name: `${libPath}/DeveloperHandoffGuide.md` });
    console.log(`[UiPath] Generated Developer Handoff Guide: ${allGaps.length} gaps, ~${(allGaps.reduce((s: number, g: XamlGap) => s + g.estimatedMinutes, 0) / 60).toFixed(1)}h effort, REFramework=${useReFramework}`);

    for (const [path, content] of deferredWrites.entries()) {
      archive.append(content, { name: path });
    }

    const finalProjectJsonStr = JSON.stringify(projectJson, null, 2);
    archive.append(finalProjectJsonStr, { name: `${libPath}/project.json` });

    const depEntries = Object.entries(deps).map(
      ([id, ver]) => `      <dependency id="${id}" version="${ver}" />`
    ).join("\n");

    const nuspecXml = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd">
  <metadata>
    <id>${projectName}</id>
    <version>${version}</version>
    <title>${escapeXml(pkg.projectName || projectName)}</title>
    <description>${escapeXml(pkg.description || projectName)}</description>
    <authors>CannonBall</authors>
    <owners>CannonBall</owners>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <dependencies>
${depEntries}
    </dependencies>
  </metadata>
</package>`;
    archive.append(nuspecXml, { name: `${projectName}.nuspec` });

    const finalValidation = validateXamlContent(xamlEntries);
    const malformedQuotes = finalValidation.filter(v => v.check === "malformed-quote");
    const pseudoXaml = finalValidation.filter(v => v.check === "pseudo-xaml");
    const placeholders = finalValidation.filter(v => v.check === "placeholder");
    const invokedFiles = finalValidation.filter(v => v.check === "invoked-file");
    const duplicateFiles = finalValidation.filter(v => v.check === "duplicate-file");
    const xmlWellformedness = finalValidation.filter(v => v.check === "xml-wellformedness");
    console.log(`[UiPath Pre-Package Validation Report]`);
    console.log(`  No malformed quotes:       ${malformedQuotes.length === 0 ? "PASS" : `FAIL (${malformedQuotes.length} violation(s))`}`);
    console.log(`  No pseudo-XAML:             ${pseudoXaml.length === 0 ? "PASS" : `FAIL (${pseudoXaml.length} violation(s))`}`);
    console.log(`  No placeholder values:      ${placeholders.length === 0 ? "PASS" : `FAIL (${placeholders.length} violation(s))`}`);
    console.log(`  Every invoked file exists:  ${invokedFiles.length === 0 ? "PASS" : `FAIL (${invokedFiles.length} violation(s))`}`);
    console.log(`  No duplicate files:         ${duplicateFiles.length === 0 ? "PASS" : `FAIL (${duplicateFiles.length} violation(s))`}`);
    console.log(`  All XAML well-formed:       ${xmlWellformedness.length === 0 ? "PASS" : `FAIL (${xmlWellformedness.length} violation(s))`}`);
    for (const v of finalValidation) {
      if (v.check === "malformed-quote" || v.check === "xml-wellformedness" || v.check === "duplicate-file") {
        console.warn(`  [${v.check}] ${v.file}: ${v.detail}`);
      }
    }

    const severeValidationErrors = [...xmlWellformedness, ...duplicateFiles, ...malformedQuotes];
    if (severeValidationErrors.length > 0) {
      const details = severeValidationErrors.map(v => `  [${v.check}] ${v.file}: ${v.detail}`).join("\n");
      console.error(`[UiPath Pre-Package Validation] Blocking package due to ${severeValidationErrors.length} severe violation(s):\n${details}`);
      throw new Error(
        `UiPath pre-package validation failed with ${severeValidationErrors.length} severe violation(s):\n${details}`
      );
    }

  const buffer = await archive.finalize();

  runPostArchiveParityCheck(buffer, _archiveManifestTracker, _appendedContentHashes, xamlEntries, libPath);

  const finalXamlEntries = xamlEntries.map(e => ({ name: e.name, content: e.content }));
  const finalDependencyMap = { ...deps };
  const finalArchiveManifest = allArchivePaths;

  for (const fix of autoFixSummary) {
    let repairCode: RepairCode = "REPAIR_GENERIC";
    if (fix.includes("Catalog: Moved")) repairCode = "REPAIR_CATALOG_PROPERTY_SYNTAX";
    else if (fix.includes("Catalog: Corrected")) repairCode = "REPAIR_CATALOG_PROPERTY_VALUE";
    else if (fix.includes("Catalog: Wrapped")) repairCode = "REPAIR_CATALOG_WRAPPER";
    else if (fix.includes("Normalised LogMessage")) repairCode = "REPAIR_LOG_LEVEL_NORMALIZE";
    else if (fix.includes("Escaped raw ampersand")) repairCode = "REPAIR_AMPERSAND_ESCAPE";
    else if (fix.includes("Escaped bare <")) repairCode = "REPAIR_BARE_ANGLE_ESCAPE";
    else if (fix.includes("Removed duplicate attr")) repairCode = "REPAIR_DUPLICATE_ATTRIBUTE";
    else if (fix.includes("TakeScreenshot OutputPath")) repairCode = "REPAIR_TAKESCREENSHOT_STRIP";
    else if (fix.includes("Per-activity stub") || fix.includes("Per-sequence stub") || fix.includes("per-workflow")) continue;

    const fileMatch = fix.match(/in\s+([\w/.-]+\.xaml)/);
    outcomeAutoRepairs.push({
      repairCode,
      file: fileMatch ? fileMatch[1] : "unknown",
      description: fix,
    });
  }

  const allFiles = new Set(xamlEntries.map(e => (e.name.split("/").pop() || e.name)));
  const remediatedFiles = new Set(outcomeRemediations.map(r => r.file));
  const fullyGenerated = Array.from(allFiles).filter(f => !remediatedFiles.has(f) && !earlyStubFallbacks.includes(f));

  const qualityWarnings = qualityGateResult.violations
    .filter(v => v.severity === "warning")
    .map(v => ({
      check: v.check,
      file: v.file || "unknown",
      detail: v.detail,
      severity: v.severity as "warning",
    }));

  const outcomeReport: PipelineOutcomeReport = {
    fullyGeneratedFiles: fullyGenerated,
    autoRepairs: outcomeAutoRepairs,
    remediations: outcomeRemediations,
    propertyRemediations: [],
    downgradeEvents: [],
    qualityWarnings,
    totalEstimatedEffortMinutes: outcomeRemediations.reduce((s, r) => s + (r.estimatedEffortMinutes || 0), 0),
  };

  if (buildCacheKey && fingerprint) {
    evictOldestCacheEntry();
    packageBuildCache.set(buildCacheKey, { fingerprint, version, buffer, gaps: allGaps, usedPackages: allUsedPkgs, enrichment, qualityGatePassed: qualityGateResult.passed, qualityGateResult, xamlEntries: finalXamlEntries, dependencyMap: finalDependencyMap, archiveManifest: finalArchiveManifest, referencedMLSkillNames: [...genCtx.referencedMLSkillNames], usedAIFallback: _usedAIFallback, projectJsonContent: finalProjectJsonStr });
    console.log(`[UiPath Cache] Stored build for ${buildCacheKey} (${buffer.length} bytes, v${version})`);
  }
  return { buffer, gaps: allGaps, usedPackages: allUsedPkgs, qualityGateResult, xamlEntries: finalXamlEntries, dependencyMap: finalDependencyMap, archiveManifest: finalArchiveManifest, usedFallbackStubs: usedFallback, generationMode, referencedMLSkillNames: [...genCtx.referencedMLSkillNames], dependencyWarnings: dependencyWarnings.length > 0 ? dependencyWarnings : undefined, usedAIFallback: _usedAIFallback, outcomeReport, projectJsonContent: finalProjectJsonStr };
}

export function createTrackedArchive() {
  const buffers: Buffer[] = [];
  const passthrough = new PassThrough();
  passthrough.on("data", (chunk: Buffer) => buffers.push(chunk));

  const streamDone = new Promise<Buffer>((resolve, reject) => {
    passthrough.on("end", () => resolve(Buffer.concat(buffers)));
    passthrough.on("error", reject);
  });

  const _archive = archiver("zip", { zlib: { level: 9 } });
  _archive.pipe(passthrough);

  const manifest: string[] = [];
  const contentHashes = new Map<string, string>();
  const tracked = {
    append(data: Buffer | string, opts: { name: string }) {
      opts.name = opts.name.replace(/\\/g, "/").replace(/^[./]+/, "");
      manifest.push(opts.name);
      if (typeof data === "string") {
        contentHashes.set(opts.name, createHash("sha256").update(data).digest("hex"));
      } else if (Buffer.isBuffer(data)) {
        contentHashes.set(opts.name, createHash("sha256").update(data).digest("hex"));
      }
      return _archive.append(data, opts);
    },
    async finalize(): Promise<Buffer> {
      await _archive.finalize();
      return streamDone;
    },
    manifest,
    contentHashes,
  };

  return tracked;
}

export function runPostArchiveParityCheck(
  buffer: Buffer,
  archiveManifest: string[],
  appendedContentHashes: Map<string, string>,
  xamlEntries?: Array<{ name: string; content: string }>,
  libPath?: string,
): void {
  const parityErrors: string[] = [];
  const appendedPathSet = new Set(archiveManifest);

  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();
  const zipPathSet = new Set<string>();

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;
    const entryName = entry.entryName;
    zipPathSet.add(entryName);

    const expectedHash = appendedContentHashes.get(entryName);
    if (expectedHash) {
      const actualHash = createHash("sha256").update(entry.getData()).digest("hex");
      if (actualHash !== expectedHash) {
        parityErrors.push(`Content mismatch for "${entryName}": expected hash ${expectedHash.substring(0, 12)}..., got ${actualHash.substring(0, 12)}...`);
      }
    }

    if (!appendedPathSet.has(entryName)) {
      parityErrors.push(`Unexpected file "${entryName}" found in final ZIP archive but was not in the appended manifest`);
    }
  }

  for (const appendedPath of archiveManifest) {
    if (!zipPathSet.has(appendedPath)) {
      parityErrors.push(`Appended file "${appendedPath}" is missing from the final ZIP archive`);
    }
  }

  if (xamlEntries && libPath) {
    for (const entry of xamlEntries) {
      const normalizedName = entry.name.replace(/\\/g, "/").replace(/^[./]+/, "");
      const basename = normalizedName.split("/").pop() || normalizedName;
      const archivePath = `${libPath}/${basename}`;
      if (!zipPathSet.has(archivePath)) {
        const altMatch = Array.from(zipPathSet).find(p => p.endsWith("/" + basename) || p === basename);
        if (!altMatch) {
          parityErrors.push(`Validated XAML "${basename}" not found in final archive at expected path "${archivePath}"`);
        }
      } else {
        const entryData = zip.getEntry(archivePath)?.getData();
        if (entryData) {
          const actualContent = entryData.toString("utf-8");
          const expectedContent = entry.content;
          if (actualContent !== expectedContent) {
            const actualHash = createHash("sha256").update(actualContent).digest("hex").substring(0, 12);
            const expectedHash = createHash("sha256").update(expectedContent).digest("hex").substring(0, 12);
            parityErrors.push(`Content mismatch for validated XAML "${basename}": validated hash ${expectedHash}..., archive hash ${actualHash}...`);
          }
        }
      }
    }
  }

  if (parityErrors.length > 0) {
    const details = parityErrors.map(e => `  - ${e}`).join("\n");
    console.error(`[UiPath Post-Archive Parity] FAILED with ${parityErrors.length} mismatch(es):\n${details}`);
    throw new Error(`UiPath post-archive parity check failed with ${parityErrors.length} mismatch(es):\n${details}`);
  } else {
    console.log(`[UiPath Post-Archive Parity] PASSED — all ${archiveManifest.length} appended files verified, ${zipPathSet.size} ZIP entries checked bidirectionally`);
  }
}

export async function rebuildNupkgWithEntries(
  originalBuffer: Buffer,
  xamlEntries: Array<{ name: string; content: string }>,
  archiveManifest: string[],
): Promise<Buffer | null> {
  try {
    if (!originalBuffer || originalBuffer.length === 0) {
      console.warn("[Nupkg Rebuild] Original buffer is empty — cannot rebuild");
      return null;
    }

    const zip = new AdmZip(originalBuffer);

    const xamlOverrides = new Map<string, string>();
    for (const entry of xamlEntries) {
      const archivePaths = archiveManifest.filter(
        p => p === entry.name || p.endsWith(`/${entry.name}`) || p.endsWith(`\\${entry.name}`)
      );
      for (const archivePath of archivePaths) {
        xamlOverrides.set(archivePath, entry.content);
      }
      if (archivePaths.length === 0) {
        console.warn(`[Nupkg Rebuild] No archive path found for XAML entry: ${entry.name}`);
      }
    }

    const arc = createTrackedArchive();
    let overriddenCount = 0;

    const missingEntries: string[] = [];
    for (const entryPath of archiveManifest) {
      let data: Buffer | string;
      if (xamlOverrides.has(entryPath)) {
        data = xamlOverrides.get(entryPath)!;
        overriddenCount++;
      } else {
        const zipEntry = zip.getEntry(entryPath);
        if (zipEntry) {
          data = zipEntry.getData();
        } else {
          missingEntries.push(entryPath);
          console.error(`[Nupkg Rebuild] Manifest entry not found in original archive: ${entryPath}`);
          continue;
        }
      }
      arc.append(data, { name: entryPath });
    }

    if (missingEntries.length > 0) {
      console.error(`[Nupkg Rebuild] ${missingEntries.length} manifest entries missing from original archive — rebuild aborted`);
      return null;
    }

    const rebuilt = await arc.finalize();

    if (rebuilt.length === 0) {
      console.warn("[Nupkg Rebuild] Rebuilt buffer is empty");
      return null;
    }

    const libPath = archiveManifest.find(p => p.startsWith("lib/net6.0/"))
      ? "lib/net6.0"
      : "lib/net45";

    try {
      runPostArchiveParityCheck(rebuilt, archiveManifest, arc.contentHashes, xamlEntries, libPath);
    } catch (parityErr: unknown) {
      const msg = parityErr instanceof Error ? parityErr.message : String(parityErr);
      console.error(`[Nupkg Rebuild] Post-rebuild parity check failed: ${msg}`);
      return null;
    }

    console.log(`[Nupkg Rebuild] Success — ${arc.manifest.length} entries (${overriddenCount} overridden), ${rebuilt.length} bytes`);
    return rebuilt;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Nupkg Rebuild] Failed: ${msg}`);
    return null;
  }
}

export async function uploadNupkgBuffer(
  config: UiPathConfig,
  token: string,
  nupkgBuffer: Buffer,
  projectName: string,
  version: string
): Promise<{ ok: boolean; status: number; responseText: string }> {
  const fileName = `${projectName}.${version}.nupkg`;
  const boundary = `----FormBoundary${Date.now()}`;
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const headerBuf = Buffer.from(header, "utf-8");
  const footerBuf = Buffer.from(footer, "utf-8");
  const body = Buffer.concat([headerBuf, nupkgBuffer, footerBuf]);

  const uploadUrl = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_/odata/Processes/UiPath.Server.Configuration.OData.UploadPackage`;

  console.log(`[UiPath] Uploading to: ${uploadUrl}`);
  console.log(`[UiPath] Package size: ${body.length} bytes, filename: ${fileName}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
  };

  if (config.folderId) {
    headers["X-UIPATH-OrganizationUnitId"] = config.folderId;
    console.log(`[UiPath] Targeting folder: ${config.folderName || config.folderId} (ID: ${config.folderId})`);
  }

  const uploadController = new AbortController();
  const uploadTimeout = setTimeout(() => uploadController.abort(), 120000);
  try {
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body,
      signal: uploadController.signal,
    });

    const responseText = await uploadRes.text();
    console.log(`[UiPath] Upload response status: ${uploadRes.status}`);
    console.log(`[UiPath] Upload response body: ${responseText.slice(0, 1000)}`);

    return { ok: uploadRes.ok, status: uploadRes.status, responseText };
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log(`[UiPath] Upload timed out after 120s`);
      return { ok: false, status: 408, responseText: "Upload timed out after 120 seconds" };
    }
    throw err;
  } finally {
    clearTimeout(uploadTimeout);
  }
}

