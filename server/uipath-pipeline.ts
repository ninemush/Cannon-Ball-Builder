import { createHash } from "crypto";
import { storage } from "./storage";
import { documentStorage } from "./document-storage";
import { processMapStorage } from "./process-map-storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import {
  buildNuGetPackage,
  QualityGateError,
  getAICenterSkills,
  type BuildResult,
  type GenerationMode,
} from "./uipath-integration";
import {
  generateDeveloperHandoffGuide,
  makeUiPathCompliant,
  type XamlGap,
} from "./xaml-generator";
import type { UiPathPackage, UiPathPackageSpec, UiPathPackageInternal } from "./types/uipath-package";
import { analyzeAndFix, type AnalysisReport } from "./workflow-analyzer";
import type { QualityGateResult } from "./uipath-quality-gate";
import { calculateTemplateCompliance } from "./catalog/xaml-template-builder";

export type { GenerationMode };

export type PackageStatus = "BUILDING" | "READY" | "READY_WITH_WARNINGS" | "FAILED";

export interface PipelineWarning {
  code: string;
  message: string;
  stage: string;
  recoverable: boolean;
}

export interface PipelineResult {
  packageBuffer: Buffer;
  gaps: XamlGap[];
  usedPackages: string[];
  qualityGateResult?: QualityGateResult;
  dhgContent: string;
  cacheHit?: boolean;
  projectName: string;
  xamlEntries: { name: string; content: string }[];
  dependencyMap: Record<string, string>;
  archiveManifest: string[];
  qualityGateBlocking: boolean;
  qualityGateWarnings: string[];
  generationMode: GenerationMode;
  usedFallbackStubs: boolean;
  referencedMLSkillNames: string[];
  warnings: PipelineWarning[];
  status: PackageStatus;
  templateComplianceScore?: number;
}

export interface DhgResult {
  dhgContent: string;
  projectName: string;
  analysisReports: Array<{ fileName: string; report: AnalysisReport }>;
}

export interface IdeaContext {
  idea: NonNullable<Awaited<ReturnType<typeof storage.getIdea>>>;
  sdd: Awaited<ReturnType<typeof documentStorage.getLatestDocument>>;
  pdd: Awaited<ReturnType<typeof documentStorage.getLatestDocument>>;
  mapNodes: any[];
  processEdges: any[];
}

type CachedPipelineResult = PipelineResult & { fingerprint: string };

const pipelineCache = new Map<string, CachedPipelineResult>();
const PIPELINE_CACHE_MAX = 20;

function evictOldestPipelineCacheEntry(): void {
  if (pipelineCache.size >= PIPELINE_CACHE_MAX) {
    const oldest = pipelineCache.keys().next().value;
    if (oldest) {
      pipelineCache.delete(oldest);
      console.log(`[Pipeline Cache] Evicted oldest entry: ${oldest}`);
    }
  }
}

function computeFingerprint(pkg: UiPathPackageSpec, sddContent: string, nodes: any[], edges: any[]): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(pkg));
  hash.update(sddContent);
  hash.update(JSON.stringify(nodes.map((n: any) => ({ id: n.id, name: n.name, type: n.nodeType, description: n.description, system: n.system }))));
  hash.update(JSON.stringify(edges.map((e: any) => ({ source: e.sourceNodeId, target: e.targetNodeId, label: e.label }))));
  return hash.digest("hex").slice(0, 16);
}

async function loadIdeaContext(ideaId: string): Promise<IdeaContext> {
  const idea = await storage.getIdea(ideaId);
  if (!idea) throw new Error("Idea not found");

  const sdd = await documentStorage.getLatestDocument(ideaId, "SDD");
  const pdd = await documentStorage.getLatestDocument(ideaId, "PDD");
  const toBeNodes = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
  const asIsNodes = await processMapStorage.getNodesByIdeaId(ideaId, "as-is");
  const mapNodes = toBeNodes.length > 0 ? toBeNodes : asIsNodes;
  const mapVariant = toBeNodes.length > 0 ? "to-be" : "as-is";

  let processEdges: any[] = [];
  if (mapNodes.length > 0) {
    processEdges = await processMapStorage.getEdgesByIdeaId(ideaId, mapVariant as "to-be" | "as-is");
  }

  return { idea, sdd, pdd, mapNodes, processEdges };
}

async function extractOrchestratorArtifacts(sddContent: string | undefined, warnings: PipelineWarning[]): Promise<any | null> {
  if (!sddContent) return null;
  try {
    const { parseArtifactsFromSDD, extractArtifactsWithLLM } = await import("./uipath-deploy");
    let artifacts = parseArtifactsFromSDD(sddContent);
    if (!artifacts) artifacts = await extractArtifactsWithLLM(sddContent);
    return artifacts || null;
  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    console.warn(`[Pipeline] Artifact extraction failed: ${msg}`);
    warnings.push({
      code: "ARTIFACT_EXTRACTION_FAILED",
      message: `Orchestrator artifact extraction failed: ${msg}`,
      stage: "artifact-extraction",
      recoverable: true,
    });
    return null;
  }
}

function enrichPackageWithContext(
  pkg: UiPathPackageSpec,
  context: IdeaContext,
  orchestratorArtifacts: any | null,
  aiCenterSkills?: any[],
): UiPathPackage {
  const internal: UiPathPackage["internal"] = {};
  if (context.sdd?.content) internal.sddContent = context.sdd.content;
  if (context.idea.automationType) internal.automationType = context.idea.automationType as UiPathPackageInternal["automationType"];
  if (context.mapNodes.length > 0) {
    internal.processNodes = context.mapNodes;
    internal.processEdges = context.processEdges;
  }
  if (orchestratorArtifacts) internal.orchestratorArtifacts = orchestratorArtifacts;
  if (aiCenterSkills) internal.aiCenterSkills = aiCenterSkills;
  return { ...pkg, internal };
}

export function computeVersion(): string {
  const now = new Date();
  const patch = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return `1.0.${patch}`;
}

export function findUiPathMessage(messages: any[]): any | null {
  return [...messages].reverse().find((m: any) =>
    (m.role === "assistant" || m.role === "system") && m.content.startsWith("[UIPATH:")
  ) || null;
}

export function parseUiPathPackage(uipathMsg: any): UiPathPackage {
  let jsonStr = uipathMsg.content.slice(8);
  if (jsonStr.endsWith("]")) jsonStr = jsonStr.slice(0, -1);
  const braceEnd = jsonStr.lastIndexOf("}");
  if (braceEnd !== -1) jsonStr = jsonStr.slice(0, braceEnd + 1);
  const parsed = JSON.parse(jsonStr);
  if (!parsed.internal) parsed.internal = {};
  return parsed as UiPathPackage;
}

function buildDhgFromBuildResult(
  pkg: UiPathPackage,
  ctx: IdeaContext,
  buildResult: BuildResult,
): DhgResult {
  const sddContent = ctx.sdd?.content || "";
  const workflows = pkg.workflows || [];

  const wfNames = workflows.map((wf: any) => (wf.name || "Workflow").replace(/\s+/g, "_"));

  const analysisReports: Array<{ fileName: string; report: AnalysisReport }> = [];
  for (const entry of buildResult.xamlEntries) {
    const { report } = analyzeAndFix(entry.content);
    analysisReports.push({ fileName: entry.name, report });
  }

  const enrichment = pkg.internal?.enrichment || null;
  const useReFramework = enrichment?.useReFramework ?? pkg.internal?.useReFramework ?? false;
  const painPoints = (pkg.internal?.painPoints || []).map((p: any) => ({
    name: p.name || "",
    description: p.description || "",
  }));

  const extractedArtifacts = pkg.internal?.extractedArtifacts || undefined;

  const dhgContent = generateDeveloperHandoffGuide({
    projectName: pkg.projectName || ctx.idea.title.replace(/\s+/g, "_"),
    description: pkg.description || ctx.idea.description,
    gaps: buildResult.gaps,
    usedPackages: buildResult.usedPackages,
    workflowNames: wfNames.length > 0 ? wfNames : buildResult.xamlEntries.map(e => e.name.replace(".xaml", "")),
    sddContent: sddContent || undefined,
    enrichment,
    useReFramework,
    painPoints,
    extractedArtifacts,
    automationType: ctx.idea.automationType as "rpa" | "agent" | "hybrid" || undefined,
    analysisReports,
  });

  return {
    dhgContent,
    projectName: pkg.projectName || ctx.idea.title,
    analysisReports,
  };
}

export async function generateUiPathPackage(
  ideaId: string,
  pkg: UiPathPackageSpec,
  options?: {
    version?: string;
    generationMode?: GenerationMode;
    onProgress?: (message: string) => void;
    preloadedContext?: IdeaContext;
  },
): Promise<PipelineResult> {
  const ver = options?.version || computeVersion();
  const mode: GenerationMode = options?.generationMode || "full_implementation";
  const pipelineWarnings: PipelineWarning[] = [];

  const ctx = options?.preloadedContext || await loadIdeaContext(ideaId);
  const artifacts = await extractOrchestratorArtifacts(ctx.sdd?.content, pipelineWarnings);

  const fp = computeFingerprint(pkg, ctx.sdd?.content || "", ctx.mapNodes, ctx.processEdges);
  const cacheKey = `${ideaId}:${mode}`;
  const cached = pipelineCache.get(cacheKey);
  if (cached && cached.fingerprint === fp) {
    console.log(`[Pipeline] Serving cached result for ${ideaId} (mode=${mode}, fingerprint ${fp})`);
    return cached;
  }

  if (options?.onProgress) options.onProgress(mode === "baseline_openable" ? "Generating baseline Studio-openable package..." : "AI-enriching XAML workflows...");

  let aiSkills: any[] = [];
  try {
    const aiResult = await getAICenterSkills();
    if (aiResult.available) aiSkills = aiResult.skills;
  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    console.warn(`[Pipeline] AI Center skills fetch failed: ${msg}`);
    pipelineWarnings.push({
      code: "AI_CENTER_SKILLS_UNAVAILABLE",
      message: `AI Center skills could not be fetched: ${msg}`,
      stage: "ai-center",
      recoverable: true,
    });
  }

  const enriched = enrichPackageWithContext(pkg, ctx, artifacts, aiSkills);

  const buildResult = await buildNuGetPackage(enriched, ver, ideaId, mode);

  if (buildResult.dependencyWarnings) {
    pipelineWarnings.push(...buildResult.dependencyWarnings);
  }

  const dhgResult = buildDhgFromBuildResult(enriched, ctx, buildResult);

  const qgResult = buildResult.qualityGateResult;
  const qualityGateBlocking = mode === "baseline_openable"
    ? false
    : (qgResult ? !qgResult.passed : false);
  const qualityGateWarnings = qgResult
    ? qgResult.violations
        .filter((v: any) => v.severity === "warning" || (mode === "baseline_openable" && v.severity === "error"))
        .map((v: any) => v.detail)
    : [];

  const hasNupkg = buildResult.buffer && buildResult.buffer.length > 0;
  const status: PackageStatus = !hasNupkg
    ? "FAILED"
    : pipelineWarnings.length > 0
      ? "READY_WITH_WARNINGS"
      : "READY";

  let templateComplianceScore: number | undefined;
  try {
    if (buildResult.xamlEntries.length > 0) {
      let totalScore = 0;
      let count = 0;
      for (const entry of buildResult.xamlEntries) {
        const compliance = calculateTemplateCompliance(entry.content);
        totalScore += compliance.score;
        count++;
        if (compliance.violations.length > 0) {
          console.log(`[Pipeline] Template compliance for ${entry.name}: ${compliance.score} (${compliance.compliantActivities}/${compliance.totalActivities} compliant, ${compliance.violations.length} violations)`);
        }
      }
      templateComplianceScore = count > 0 ? Math.round((totalScore / count) * 100) / 100 : 1.0;
      console.log(`[Pipeline] Overall templateComplianceScore: ${templateComplianceScore}`);
    }
  } catch (err: any) {
    console.warn(`[Pipeline] Template compliance calculation failed: ${err.message}`);
  }

  const result: PipelineResult = {
    packageBuffer: buildResult.buffer,
    gaps: buildResult.gaps,
    usedPackages: buildResult.usedPackages,
    qualityGateResult: buildResult.qualityGateResult,
    cacheHit: buildResult.cacheHit,
    dhgContent: dhgResult.dhgContent,
    projectName: dhgResult.projectName,
    xamlEntries: buildResult.xamlEntries,
    dependencyMap: buildResult.dependencyMap,
    archiveManifest: buildResult.archiveManifest,
    qualityGateBlocking,
    qualityGateWarnings,
    generationMode: mode,
    usedFallbackStubs: buildResult.usedFallbackStubs,
    referencedMLSkillNames: buildResult.referencedMLSkillNames || [],
    warnings: pipelineWarnings,
    status,
    templateComplianceScore,
  };

  evictOldestPipelineCacheEntry();
  pipelineCache.set(cacheKey, { ...result, fingerprint: fp });
  console.log(`[Pipeline] Cached result for ${ideaId} (mode=${mode}, fingerprint ${fp}, ${buildResult.buffer.length} bytes, status=${status}, warnings=${pipelineWarnings.length}, templateCompliance=${templateComplianceScore ?? "N/A"})`);

  return result;
}

export function getCachedPipelineResult(ideaId: string, mode?: GenerationMode): PipelineResult | null {
  if (mode) {
    return pipelineCache.get(`${ideaId}:${mode}`) || null;
  }
  return pipelineCache.get(`${ideaId}:full_implementation`) || pipelineCache.get(`${ideaId}:baseline_openable`) || null;
}

export async function generateDhg(
  ideaId: string,
  pkg: UiPathPackage,
): Promise<DhgResult> {
  const cached = getCachedPipelineResult(ideaId);
  if (cached) {
    console.log(`[Pipeline] Serving cached DHG for ${ideaId}`);
    return {
      dhgContent: cached.dhgContent,
      projectName: cached.projectName,
      analysisReports: cached.xamlEntries.map(e => {
        const { report } = analyzeAndFix(e.content);
        return { fileName: e.name, report };
      }),
    };
  }

  console.log(`[Pipeline] No cached result for DHG — running full pipeline for ${ideaId}`);
  const pipelineResult = await generateUiPathPackage(ideaId, pkg);

  return {
    dhgContent: pipelineResult.dhgContent,
    projectName: pipelineResult.projectName,
    analysisReports: pipelineResult.xamlEntries.map(e => {
      const { report } = analyzeAndFix(e.content);
      return { fileName: e.name, report };
    }),
  };
}

export { QualityGateError } from "./uipath-integration";

export function normalizeXaml(
  xaml: string,
  targetFramework: "Windows" | "Portable" = "Windows",
): { normalized: string; report: AnalysisReport } {
  const compliant = makeUiPathCompliant(xaml, targetFramework);
  const { fixed, report } = analyzeAndFix(compliant);
  return { normalized: fixed, report };
}

export { makeUiPathCompliant, analyzeAndFix };
