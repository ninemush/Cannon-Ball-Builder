import archiver from "archiver";
  import AdmZip from "adm-zip";
  import { createHash } from "crypto";
  import { PassThrough } from "stream";
  import { recordTransform, getCurrentRunId } from "./llm-trace-collector";
  import {
    generateRichXamlFromSpec,
    generateRichXamlFromNodes,
    generateInitAllSettingsXaml,
    generateInitXaml,
    generateReframeworkMainXaml,
    generateGetTransactionDataXaml,
    generateSetTransactionStatusXaml,
    generateCloseAllApplicationsXaml,
    generateKillAllProcessesXaml,
    aggregateGaps,
    normalizeXaml as makeUiPathCompliant,
    ensureBracketWrapped,
    normalizeAssignArgumentNesting,
    validateXamlContent,
    generateStubWorkflow,
    selectGenerationMode,
    applyActivityPolicy,
    isReFrameworkFile,
    preserveStructureAndStubLeaves,
    type GenerationMode,
    type GenerationModeConfig,
    type XamlGeneratorResult,
    type XamlGap,
    type TargetFramework,
    type XamlValidationViolation,
    type DhgQualityIssue,
  } from "./xaml-generator";
  import type { XamlGenerationContext, UiPathPackage } from "./types/uipath-package";
  import { enrichWithAITree, type EnrichmentResult, type TreeEnrichmentResult } from "./ai-xaml-enricher";
  import { assembleWorkflowFromSpec } from "./workflow-tree-assembler";
  import type { WorkflowSpec as TreeWorkflowSpec, WorkflowNode as TreeWorkflowNode } from "./workflow-spec-types";
  import { normalizeWorkflowSpec } from "./normalize-workflow-spec";
  import { analyzeAndFix, setGovernancePolicies, type AnalysisReport } from "./workflow-analyzer";
  import { runQualityGate, validatePackage, formatQualityGateViolations, classifyQualityIssues, getBlockingFiles, hasOnlyWarnings, hasBlockingIssues, type QualityGateResult, type ClassifiedIssue, type PackageReadiness } from "./uipath-quality-gate";
  import { escapeXml } from "./lib/xml-utils";
  import { computePackageFingerprint, computeEnrichmentFingerprint, computeXamlFingerprint, computeQualityGateFingerprint } from "./lib/utils";
  import { buildDeterministicScaffold as buildGenericDeterministicScaffold } from "./deterministic-scaffold";
  import { computeDhgAccuracy } from "./pipeline-health";
  import { getConversion, normalizeClrType } from "./xaml/type-compatibility-validator";
  import { inferTypeFromPrefix } from "./shared/type-inference";
  import { scanXamlForRequiredPackages, classifyAutomationPattern, shouldUseReFramework, type AutomationPattern, ACTIVITY_NAME_ALIAS_MAP, normalizeActivityName, NAMESPACE_PREFIX_TO_PACKAGE, getActivityPackage } from "./uipath-activity-registry";
  import { filterBlockedActivitiesFromXaml } from "./uipath-activity-policy";
  import { catalogService, type ProcessType, type ValidationCorrection } from "./catalog/catalog-service";
  import type { StudioProfile } from "./catalog/metadata-service";
  import { validateWorkflowSpec as validateSpec, type SpecValidationReport } from "./catalog/spec-validator";
  import { UIPATH_PACKAGE_ALIAS_MAP, QualityGateError, isFrameworkAssembly, type UiPathConfig } from "./uipath-shared";
  import { runEmissionGate, type EmissionGateResult } from "./emission-gate";
  import { buildWorkflowBusinessContextMap, type WorkflowBusinessContextMap } from "./sdd-business-context-mapper";
  import { metadataService as _metadataService } from "./catalog/metadata-service";
  import { PACKAGE_NAMESPACE_MAP, validateXmlWellFormedness, injectMissingNamespaceDeclarations, collectUsedPackages, buildDynamicXmlnsDeclarations, buildDynamicAssemblyRefs, buildDynamicNamespaceImports, resolvePackageNamespaceInfo, injectInArgumentTypeArguments, resolveActivityToPackage, deriveRequiredDeclarationsForXaml, insertBeforeClosingCollectionTag } from "./xaml/xaml-compliance";
  import type { ComplexityTier } from "./complexity-classifier";
  import { generateDhgFromOutcomeReport, type DhgContext } from "./dhg-generator";
  import { runDhgAnalysis } from "./xaml/dhg-analyzers";
  import { XMLParser, XMLBuilder } from "fast-xml-parser";
  import { runPostEmissionDependencyAnalysis, type DependencyDiagnosticsArtifact, type ResolutionSource } from "./post-emission-dependency-analyzer";
  import { getAndClearPropertySerializationTrace, getAndClearInvokeContractTrace, getAndClearStageHashParity, updateStageHash, hasStageHash, emitInvokeContractTrace, runWithTraceContext } from "./pipeline-trace-collector";
  import { validateContractIntegrity, buildWorkflowContracts, extractInvocations, resolveTargetContract, type WorkflowContract, type ContractIntegrityDefect } from "./xaml/workflow-contract-integrity";
  import { canonicalizeInvokeBindings, canonicalizeTargetValueExpressions, type InvokeCanonicalizationResult, type TargetValueCanonicalizationResult } from "./xaml/invoke-binding-canonicalizer";
  import { classifyFromArchiveBuffer, buildWorkflowStatusParity, normalizeClassifierFileName, AUTHORITATIVE_STUB_PATTERNS, verifyAndReclassifyFromArchive, assertClassificationFreshness, freezeArchiveWorkflows, isArchiveFrozen, getArchiveFreezePoint, resetArchiveFreeze, checkPostFreezeDeferredWriteMutation, getMutationTrace, recordMutationAttempt, assertNoPostFreezeStatusMutation, createGuardedDeferredWrites, createGuardedPostGateEntries, verifyFrozenArchiveBuffer, type WorkflowStatusClassifierResult, type WorkflowStatusParityEntry, type WorkflowStatusParityResult, type PostClassifierMutationTrace } from "./workflow-status-classifier";

interface DomCorrectionResult {
  content: string;
  correctedProperties: Set<string>;
  applied: number;
  fallbackUsed: boolean;
}

function applyDomBasedCatalogCorrections(
  xmlContent: string,
  corrections: Array<{ fullTag: string; correction: ValidationCorrection; attrs: Record<string, string> }>,
  fileName: string,
): DomCorrectionResult {
  const ATTR_PREFIX = "@_";
  const parserOpts = {
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    allowBooleanAttributes: true,
    processEntities: true,
    htmlEntities: true,
    trimValues: false,
    parseTagValue: false,
    commentPropName: "#comment",
  };
  const builderOpts = {
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    format: true,
    indentBy: "  ",
    suppressEmptyNode: true,
    commentPropName: "#comment",
    processEntities: true,
  };

  let tree: any[];
  try {
    const parser = new XMLParser(parserOpts);
    tree = parser.parse(xmlContent);
  } catch (parseErr) {
    console.warn(`[Activity Catalog DOM] Failed to parse ${fileName} for DOM corrections — falling back to regex path`);
    return { content: xmlContent, correctedProperties: new Set(), applied: 0, fallbackUsed: true };
  }

  const correctedProperties = new Set<string>();
  let applied = 0;

  function getTagName(node: any): string {
    for (const key of Object.keys(node)) {
      if (key !== ":@" && key !== "#text" && key !== "#comment") return key;
    }
    return "";
  }

  function walkAndCorrect(nodes: any[]): void {
    for (const node of nodes) {
      const tagName = getTagName(node);
      if (!tagName) continue;

      const nodeAttrs = node[":@"] || {};
      const shortTag = tagName.includes(":") ? tagName.split(":").pop()! : tagName;

      for (const corr of corrections) {
        const corrShortTag = corr.fullTag.includes(":") ? corr.fullTag.split(":").pop()! : corr.fullTag;
        if (shortTag !== corrShortTag && tagName !== corr.fullTag) continue;

        const attrKey = `${ATTR_PREFIX}${corr.correction.property}`;

        if (corr.correction.type === "fix-invalid-value" && corr.correction.correctedValue) {
          if (attrKey in nodeAttrs) {
            nodeAttrs[attrKey] = corr.correction.correctedValue;
            correctedProperties.add(corr.correction.property);
            applied++;
          }
        } else if (corr.correction.type === "move-to-child-element") {
          const propName = corr.correction.property;
          if (attrKey in nodeAttrs) {
            const propVal = nodeAttrs[attrKey];
            delete nodeAttrs[attrKey];
            const wrapper = corr.correction.argumentWrapper || "InArgument";
            const xType = corr.correction.typeArguments || "x:String";
            const wrappedVal = ensureBracketWrapped(propVal);
            const childPropTag = `${tagName}.${propName}`;
            const children = node[tagName] || [];
            children.push({
              [childPropTag]: [{
                [wrapper]: [{ "#text": wrappedVal }],
                ":@": { [`${ATTR_PREFIX}x:TypeArguments`]: xType }
              }]
            });
            node[tagName] = children;
            correctedProperties.add(propName);
            applied++;
          }
        } else if (corr.correction.type === "wrap-in-argument" && corr.correction.argumentWrapper) {
          const propName = corr.correction.property;
          const childPropTag = `${tagName}.${propName}`;
          const children = node[tagName] || [];
          for (const child of children) {
            const childTag = getTagName(child);
            if (childTag === childPropTag) {
              const innerChildren = child[childTag] || [];
              const alreadyWrapped = innerChildren.some((ic: any) => {
                const t = getTagName(ic);
                return t === "InArgument" || t === "OutArgument" || t === "InOutArgument";
              });
              if (!alreadyWrapped && innerChildren.length > 0) {
                const wrapper = corr.correction.argumentWrapper;
                const xType = corr.correction.typeArguments || "x:String";
                child[childTag] = [{
                  [wrapper]: innerChildren,
                  ":@": { [`${ATTR_PREFIX}x:TypeArguments`]: xType }
                }];
                correctedProperties.add(propName);
                applied++;
              }
            }
          }
        }
      }

      const children = node[tagName];
      if (Array.isArray(children)) {
        walkAndCorrect(children);
      }
    }
  }

  walkAndCorrect(tree);

  if (applied === 0) {
    return { content: xmlContent, correctedProperties, applied: 0, fallbackUsed: false };
  }

  try {
    const builder = new XMLBuilder(builderOpts);
    let result = builder.build(tree);
    if (typeof result === "string") {
      result = result.replace(/^\s*\n/, "");
    }
    const wellFormed = validateXmlWellFormedness(result);
    if (!wellFormed.valid) {
      console.warn(`[Activity Catalog DOM] DOM-serialized result for ${fileName} is malformed — rolling back`);
      return { content: xmlContent, correctedProperties: new Set(), applied: 0, fallbackUsed: true };
    }
    return { content: result, correctedProperties, applied, fallbackUsed: false };
  } catch (buildErr) {
    console.warn(`[Activity Catalog DOM] Failed to serialize ${fileName} after DOM corrections — rolling back`);
    return { content: xmlContent, correctedProperties: new Set(), applied: 0, fallbackUsed: true };
  }
}

async function getProbeCache() {
  const { getProbeCache: _getProbeCache } = await import("./uipath-integration");
  return _getProbeCache();
}

function getBaselineFallbackVersion(pkgName: string, _framework: "Windows" | "Portable"): string | null {
  const validated = _metadataService.getValidatedVersion(pkgName);
  if (validated) return validated;
  if (!_metadataService.getStudioTarget()) {
    _metadataService.load();
    return _metadataService.getValidatedVersion(pkgName);
  }
  return null;
}
  
function resolveExpressionLanguage(
  profile: StudioProfile | null | undefined,
  metaTarget: { expressionLanguage: string } | null | undefined,
): string {
  const lang = profile?.expressionLanguage || metaTarget?.expressionLanguage;
  if (!lang) {
    throw new Error("Cannot assemble package: expression language is unavailable from MetadataService");
  }
  return lang;
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
    "System.Data.DataTable": "scg:DataTable",
    "System.Data.DataRow": "scg:DataRow",
    "UiPath.Core.QueueItem": "ui:QueueItem",
    "UiPath.Core.DataTypes.TransactionItem": "ui:TransactionItem",
    "System.Security.SecureString": "s:Security.SecureString",
    "System.Net.Mail.MailMessage": "s:Net.Mail.MailMessage",
    "System.Collections.Generic.Dictionary`2[System.String,System.Object]": "scg:Dictionary(x:String, x:Object)",
    "System.Collections.Generic.List`1[System.String]": "scg:List(x:String)",
    "System.Collections.Generic.List`1[System.Object]": "scg:List(x:Object)",
  };
  return map[clrType] || "x:String";
}

function sanitizeClrTypeArguments(xamlContent: string): string {
  return xamlContent.replace(
    /x:TypeArguments="(\{[^"]+\})"/g,
    (_match, clrExpr: string) => {
      let cleaned = clrExpr
        .replace(/\{http:\/\/schemas\.microsoft\.com\/netfx\/2009\/xaml\/activities\}Variable\(([^)]+)\)/g, (_m, inner: string) => {
          const resolved = resolveClrTypeRef(inner);
          return `Variable(${resolved})`;
        })
        .replace(/\{http:\/\/[^}]+\}(\w+)/g, (_m, typeName: string) => {
          return resolveClrTypeName(typeName);
        });
      if (cleaned.startsWith("{")) {
        cleaned = "x:String";
      }
      return `x:TypeArguments="${cleaned}"`;
    }
  );
}

function resolveClrTypeRef(clrRef: string): string {
  const trimmed = clrRef.trim();
  if (trimmed.startsWith("{")) {
    const nameMatch = trimmed.match(/\}(\w+)$/);
    if (nameMatch) {
      return resolveClrTypeName(nameMatch[1]);
    }
  }
  return trimmed;
}

function resolveClrTypeName(name: string): string {
  const typeMap: Record<string, string> = {
    "Variable": "Variable",
    "String": "x:String",
    "Object": "x:Object",
    "Boolean": "x:Boolean",
    "Int32": "x:Int32",
    "Int64": "x:Int64",
    "Double": "x:Double",
    "DateTime": "s:DateTime",
    "TimeSpan": "s:TimeSpan",
    "Exception": "s:Exception",
    "DataTable": "scg:DataTable",
    "DataRow": "scg:DataRow",
    "QueueItem": "ui:QueueItem",
    "TransactionItem": "ui:TransactionItem",
    "SecureString": "s:Security.SecureString",
    "MailMessage": "s:Net.Mail.MailMessage",
  };
  return typeMap[name] || `x:${name}`;
}

const VALUE_INTENT_PATTERNS = [
  /\{"type":"[^"]*","value":"([^"]*)"\}/g,
  /\{&quot;type&quot;:&quot;[^&]*&quot;,&quot;value&quot;:&quot;([^&]*)&quot;\}/g,
  /\{type:[^,]*,value:([^}]*)\}/g,
];

function sweepValueIntentFromXaml(xamlContent: string): { content: string; repairCount: number } {
  let content = xamlContent;
  let repairCount = 0;
  for (const pattern of VALUE_INTENT_PATTERNS) {
    const regex = new RegExp(pattern.source, "g");
    content = content.replace(regex, (_match, innerValue: string) => {
      repairCount++;
      return innerValue;
    });
  }
  return { content, repairCount };
}

export function isValidNuGetVersion(version: string): boolean {
  return /^\[?\d+\.\d+(\.\d+){0,2}(,\s*\))?\]?$/.test(version);
}

function getPreferredVersionFromMeta(pkgName: string): string | null {
  if (!_metadataService.getStudioTarget()) {
    _metadataService.load();
  }
  return _metadataService.getPreferredVersion(pkgName);
}

const KNOWN_TRANSITIVE_COLLISION_PAIRS: Array<{
  packages: [string, string];
  conflictingTransitive: string;
  resolution: string;
}> = [
  {
    packages: ["UiPath.Mail.Activities", "UiPath.System.Activities"],
    conflictingTransitive: "Microsoft.Office.Interop.Outlook",
    resolution: "align-system-version",
  },
];

function extractExactVersion(versionStr: string): string {
  let v = versionStr.trim();
  v = v.replace(/^\[/, "").replace(/[,)\]]/g, "").trim();
  const match = v.match(/^(\d+\.\d+(\.\d+){0,2})/);
  return match ? match[1] : v;
}

function validateAndEnforceDependencyCompatibility(
  deps: Record<string, string>,
  warnings: DependencyResolutionResult["warnings"],
): void {
  for (const [pkgName, version] of Object.entries(deps)) {
    const preferredVersion = getPreferredVersionFromMeta(pkgName);
    if (!preferredVersion) continue;

    const cleanVersion = extractExactVersion(version);

    if (cleanVersion !== preferredVersion) {
      const oldVersion = deps[pkgName];
      deps[pkgName] = `[${preferredVersion}]`;
      warnings.push({
        code: "DEPENDENCY_VERSION_PINNED_TO_VERIFIED",
        message: `Package ${pkgName} version ${oldVersion} differs from preferred version — pinned to [${preferredVersion}]`,
        stage: "dependency-compatibility",
        recoverable: true,
      });
      console.log(`[Dependency Compatibility] Pinned ${pkgName} from ${oldVersion} to [${preferredVersion}]`);
    }
  }

  const depKeys = Object.keys(deps);
  for (const collision of KNOWN_TRANSITIVE_COLLISION_PAIRS) {
    const [pkg1, pkg2] = collision.packages;
    if (depKeys.includes(pkg1) && depKeys.includes(pkg2)) {
      if (collision.resolution === "align-system-version") {
        const systemPkg = collision.packages.find(p => p === "UiPath.System.Activities") || pkg2;
        const otherPkg = systemPkg === pkg1 ? pkg2 : pkg1;

        const systemPreferred = getPreferredVersionFromMeta(systemPkg);
        const otherPreferred = getPreferredVersionFromMeta(otherPkg);

        if (systemPreferred && deps[systemPkg]) {
          const currentSysVer = extractExactVersion(deps[systemPkg]);
          if (currentSysVer !== systemPreferred) {
            deps[systemPkg] = `[${systemPreferred}]`;
            console.log(`[Dependency Compatibility] Aligned ${systemPkg} to [${systemPreferred}] to prevent transitive collision with ${otherPkg} via ${collision.conflictingTransitive}`);
          }
        }
        if (otherPreferred && deps[otherPkg]) {
          const currentOtherVer = extractExactVersion(deps[otherPkg]);
          if (currentOtherVer !== otherPreferred) {
            deps[otherPkg] = `[${otherPreferred}]`;
            console.log(`[Dependency Compatibility] Aligned ${otherPkg} to [${otherPreferred}] to prevent transitive collision with ${systemPkg} via ${collision.conflictingTransitive}`);
          }
        }

        warnings.push({
          code: "TRANSITIVE_COLLISION_RESOLVED",
          message: `${pkg1} and ${pkg2} aligned to verified versions to prevent transitive collision via ${collision.conflictingTransitive}`,
          stage: "dependency-compatibility",
          recoverable: true,
        });
      }
    }
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

const VALID_STUDIO_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function validateStudioVersion(version: string): boolean {
  if (!VALID_STUDIO_VERSION_PATTERN.test(version)) return false;
  const parts = version.split(".").map(Number);
  if (parts[0] < 20 || parts[0] > 30) return false;
  return true;
}

function isVersionFromValidatedSource(
  _studioProfile: StudioProfile | null,
  metaTarget: { version: string } | null,
): string | null {
  if (metaTarget?.version && validateStudioVersion(metaTarget.version)) {
    return metaTarget.version;
  }
  if (_studioProfile?.studioVersion && validateStudioVersion(_studioProfile.studioVersion)) {
    return _studioProfile.studioVersion;
  }
  return null;
}

function normalizeXamlPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^[./]+/, "");
}

const CANONICAL_INFRASTRUCTURE_NAMES = new Set([
  "main", "init", "initallsettings", "dispatcher", "performer",
  "finalise", "finalize", "process", "closeallapplications",
  "gettransactiondata", "settransactionstatus", "killallprocesses",
]);

import { normalizeWorkflowName, canonicalizeWorkflowName } from "./workflow-name-utils";
export { normalizeWorkflowName, canonicalizeWorkflowName } from "./workflow-name-utils";

export function detectFinalDedupCollisions(
  paths: string[],
): { dupsToRemove: string[]; collisionDetails: string[] } {
  const canonicalSeen = new Map<string, string>();
  const dupsToRemove: string[] = [];
  const collisionDetails: string[] = [];
  for (const path of paths) {
    if (!path.endsWith(".xaml")) continue;
    const fileName = path.split("/").pop() || path;
    const canonical = canonicalizeWorkflowName(fileName.replace(/\.xaml$/i, ""));
    const existing = canonicalSeen.get(canonical);
    if (existing) {
      const existingFileName = existing.split("/").pop() || existing;
      const isBracketNamed = /[\[\]"]/.test(fileName) || fileName.indexOf("&quot;") >= 0;
      const existingIsBracketNamed = /[\[\]"]/.test(existingFileName) || existingFileName.indexOf("&quot;") >= 0;
      if (isBracketNamed && !existingIsBracketNamed) {
        dupsToRemove.push(path);
        collisionDetails.push(`Rejected bracket-named "${fileName}" — canonical match with "${existingFileName}"`);
      } else if (!isBracketNamed && existingIsBracketNamed) {
        dupsToRemove.push(existing);
        canonicalSeen.set(canonical, path);
        collisionDetails.push(`Rejected bracket-named "${existingFileName}" — canonical match with "${fileName}"`);
      } else {
        dupsToRemove.push(path);
        collisionDetails.push(`Rejected duplicate "${fileName}" — canonical collision with "${existingFileName}"`);
      }
    } else {
      canonicalSeen.set(canonical, path);
    }
  }
  return { dupsToRemove, collisionDetails };
}

function isCanonicalInfrastructureName(name: string): boolean {
  return CANONICAL_INFRASTRUCTURE_NAMES.has(canonicalizeWorkflowName(name));
}

/**
 * Final authoritative normalization stage (closed class list).
 * Runs after convergence loop and before pre-package validation.
 * 
 * EXHAUSTIVE SET OF NORMALIZATION CLASSES (do not expand without deliberate review):
 * 1. Boolean child-element InArgument normalization
 * 2. Final enum literal normalization
 * 3. Final prompt/string literal coercion
 * 4. Final deterministic String.Format overflow handling
 * 
 * Fields touched by this stage are marked normalized:true and must not be
 * reprocessed by downstream stages.
 */
function finalNormalize(
  xamlEntries: Array<{ name: string; content: string }>,
  deferredWrites: Map<string, string>,
): Set<string> {
  const normalizedFieldSet = new Set<string>();
  let totalNormalized = 0;

  for (let i = 0; i < xamlEntries.length; i++) {
    let content = xamlEntries[i].content;
    let modified = false;
    const fileName = xamlEntries[i].name;

    const boolNormalized = normalizeBooleanInArguments(content);
    if (boolNormalized !== content) {
      content = boolNormalized;
      modified = true;
      normalizedFieldSet.add(`${fileName}:boolean-inargument`);
      totalNormalized++;
    }

    const enumNormalized = normalizeEnumLiterals(content);
    if (enumNormalized !== content) {
      content = enumNormalized;
      modified = true;
      normalizedFieldSet.add(`${fileName}:enum-literal`);
      totalNormalized++;
    }

    const stringNormalized = normalizeStringLiterals(content);
    if (stringNormalized !== content) {
      content = stringNormalized;
      modified = true;
      normalizedFieldSet.add(`${fileName}:string-literal`);
      totalNormalized++;
    }

    const formatNormalized = normalizeStringFormatOverflow(content);
    if (formatNormalized !== content) {
      content = formatNormalized;
      modified = true;
      normalizedFieldSet.add(`${fileName}:string-format`);
      totalNormalized++;
    }

    if (modified) {
      xamlEntries[i] = { name: fileName, content };
      const archivePath = Array.from(deferredWrites.keys()).find(
        p => (p.split("/").pop() || p) === (fileName.split("/").pop() || fileName)
      );
      if (archivePath) {
        deferredWrites.set(archivePath, content);
      }
    }
  }

  if (totalNormalized > 0) {
    console.log(`[Final Normalization] Applied ${totalNormalized} normalization(s) across ${xamlEntries.length} file(s)`);
  }

  return normalizedFieldSet;
}

function normalizeBooleanInArguments(xml: string): string {
  return xml.replace(
    /<(InArgument|OutArgument)\s+x:TypeArguments="x:Boolean">"(True|False)"<\/(InArgument|OutArgument)>/g,
    (_match, openTag, boolVal, closeTag) => {
      if (openTag !== closeTag) return _match;
      return `<${openTag} x:TypeArguments="x:Boolean">${boolVal}</${closeTag}>`;
    }
  );
}

function normalizeEnumLiterals(xml: string): string {
  const ENUM_NORMALIZE: Record<string, string> = {
    "information": "Info", "warning": "Warn", "debug": "Trace",
    "critical": "Fatal", "verbose": "Trace",
  };

  return xml.replace(
    /Level="\[If\([^"]*\)\]"/g,
    (_match) => {
      console.warn(`[Final Normalization] Skipping conditional Level expression (preserving runtime logic): ${_match}`);
      return _match;
    }
  ).replace(
    /Level="([^"]+)"/g,
    (_match, level) => {
      const normalized = ENUM_NORMALIZE[level.toLowerCase()];
      if (normalized) {
        return `Level="${normalized}"`;
      }
      return _match;
    }
  );
}

function normalizeStringLiterals(xml: string): string {
  let result = xml.replace(
    /(<InArgument\s+x:TypeArguments="x:String">)\[([A-Z][a-zA-Z]+\/[A-Z][a-zA-Z_]+)\](<\/InArgument>)/g,
    (_match, open, tz, close) => {
      return `${open}"${tz}"${close}`;
    }
  );

  result = result.replace(
    /(<InArgument\s+x:TypeArguments="x:String">)\[([A-Z]:\\[^\]]+)\](<\/InArgument>)/g,
    (_match, open, path, close) => {
      return `${open}"${path}"${close}`;
    }
  );

  result = result.replace(
    /(<InArgument\s+x:TypeArguments="x:String">)\[([a-zA-Z]+(?:\s+[a-zA-Z]+){2,})\](<\/InArgument>)/g,
    (_match, open, text, close) => {
      if (/^[A-Z][a-z]+\s/.test(text) && !/\(/.test(text) && !/\./.test(text)) {
        return `${open}"${text}"${close}`;
      }
      return _match;
    }
  );

  return result;
}

function normalizeStringFormatOverflow(xml: string): string {
  return xml.replace(
    /String\.Format\s*\("([^"]*)"((?:\s*,\s*[^,)]+)*)\)/g,
    (_match, formatStr, argsStr) => {
      const placeholders = formatStr.match(/\{(\d+)\}/g) || [];
      const maxIndex = placeholders.reduce((max: number, p: string) => {
        const idx = parseInt(p.replace(/[{}]/g, ""), 10);
        return Math.max(max, idx);
      }, -1);

      const args = argsStr ? argsStr.split(",").filter((s: string) => s.trim()).map((s: string) => s.trim()) : [];

      if (maxIndex >= 0 && args.length > maxIndex + 1) {
        const trimmedArgs = args.slice(0, maxIndex + 1);
        return `String.Format("${formatStr}", ${trimmedArgs.join(", ")})`;
      }

      if (maxIndex >= 0 && args.length <= maxIndex) {
        const missingCount = maxIndex + 1 - args.length;
        if (missingCount > 2) {
          console.error(`[Final Normalization] BLOCKED: String.Format has ${maxIndex + 1} placeholder(s) but only ${args.length} arg(s) — gap too large (${missingCount}) for safe repair`);
          return `"HANDOFF_STRING_FORMAT_UNSAFE"`;
        }
        console.warn(`[Final Normalization] String.Format has ${maxIndex + 1} placeholder(s) but only ${args.length} arg(s) — padding with empty strings`);
        const paddedArgs = [...args];
        while (paddedArgs.length <= maxIndex) {
          paddedArgs.push('""');
        }
        return `String.Format("${formatStr}", ${paddedArgs.join(", ")})`;
      }

      return _match;
    }
  );
}

export interface StudioLoadabilityResult {
  loadable: boolean;
  reason?: string;
  repairable?: boolean;
}

export function checkStudioLoadability(xamlContent: string): StudioLoadabilityResult {
  if (!xamlContent || xamlContent.trim().length === 0) {
    return { loadable: false, reason: "Empty XAML content" };
  }

  const hasActivityRoot = /<Activity\b[^.]/i.test(xamlContent);
  if (!hasActivityRoot) {
    return { loadable: false, reason: "Missing root <Activity> element" };
  }

  const isEmptyActivity = /<Activity\b[^.][^>]*>\s*<\/Activity>/s.test(xamlContent);
  if (isEmptyActivity) {
    return { loadable: false, reason: "Empty <Activity> element — no Implementation child" };
  }

  if (/\[ASSEMBLY_FAILED\]/.test(xamlContent)) {
    return { loadable: false, reason: "Workflow contains [ASSEMBLY_FAILED] marker — tree assembly produced malformed XML" };
  }

  const implPattern = /<(?:Sequence|Flowchart|StateMachine)\b(?!\.)(?:\s|>|\/)/i;
  const hasImplementation = implPattern.test(xamlContent);
  if (!hasImplementation) {
    return { loadable: false, reason: "No <Sequence>, <Flowchart>, or <StateMachine> child — Studio will report DynamicActivity/Implementation is null", repairable: true };
  }

  if (/x:TypeArguments="\{http:\/\//.test(xamlContent)) {
    return { loadable: false, reason: "Variable declarations contain CLR namespace format in x:TypeArguments — Studio cannot resolve these type references", repairable: true };
  }

  const activityOpenEnd = xamlContent.match(/<Activity\b[\s\S]*?>/);
  if (activityOpenEnd) {
    const afterActivityOpen = xamlContent.substring(activityOpenEnd.index! + activityOpenEnd[0].length);
    const xMembersEnd = afterActivityOpen.match(/<\/x:Members>/);
    const contentAfterMembers = xMembersEnd
      ? afterActivityOpen.substring(xMembersEnd.index! + xMembersEnd[0].length)
      : afterActivityOpen;
    const metadataSkipped = contentAfterMembers
      .replace(/<mva:VisualBasic\.Settings[\s\S]*?<\/mva:VisualBasic\.Settings>/g, "")
      .replace(/<TextExpression\.NamespacesForImplementation[\s\S]*?<\/TextExpression\.NamespacesForImplementation>/g, "")
      .replace(/<TextExpression\.ReferencesForImplementation[\s\S]*?<\/TextExpression\.ReferencesForImplementation>/g, "")
      .replace(/<sap2010:WorkflowViewState\.IdRef>[^<]*<\/sap2010:WorkflowViewState\.IdRef>/g, "")
      .trim();
    const firstElementMatch = metadataSkipped.match(/<([A-Za-z][\w]*)\b/);
    if (firstElementMatch) {
      const firstTag = firstElementMatch[1];
      if (firstTag !== "Sequence" && firstTag !== "Flowchart" && firstTag !== "StateMachine") {
        return { loadable: false, reason: `First child of Activity is <${firstTag}> instead of Sequence/Flowchart/StateMachine — Studio requires a direct implementation child`, repairable: true };
      }
    }
  }

  const openTags: string[] = [];
  const structuralTagPattern = /<\/?(?:Activity|Sequence|Flowchart|StateMachine|TryCatch|If|While|DoWhile|ForEach|Switch|Pick|Parallel)\b(?!\.)[^>]*\/?>/gi;
  let match;
  while ((match = structuralTagPattern.exec(xamlContent)) !== null) {
    const tag = match[0];
    if (tag.endsWith("/>")) continue;
    if (tag.startsWith("</")) {
      const closeName = tag.match(/<\/(\w+)/)?.[1]?.toLowerCase();
      if (closeName && openTags.length > 0 && openTags[openTags.length - 1] === closeName) {
        openTags.pop();
      }
    } else {
      const openName = tag.match(/<(\w+)/)?.[1]?.toLowerCase();
      if (openName) openTags.push(openName);
    }
  }
  if (openTags.length > 0) {
    return { loadable: false, reason: `Unclosed structural element(s): ${openTags.join(", ")}` };
  }

  return { loadable: true };
}

function ensureStubNamespaces(xamlContent: string): string {
  const requiredNamespaces: Array<{ prefix: string; uri: string }> = [
    { prefix: "xmlns:x", uri: "http://schemas.microsoft.com/winfx/2006/xaml" },
    { prefix: "xmlns:sap", uri: "http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation" },
    { prefix: "xmlns:sap2010", uri: "http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation" },
    { prefix: "xmlns:mc", uri: "http://schemas.openxmlformats.org/markup-compatibility/2006" },
  ];

  let result = xamlContent;
  const activityTagMatch = result.match(/<Activity\b/);
  if (!activityTagMatch) return result;

  const tagEnd = result.indexOf(">", activityTagMatch.index!);
  if (tagEnd < 0) return result;

  const activityTag = result.substring(activityTagMatch.index!, tagEnd + 1);

  for (const ns of requiredNamespaces) {
    if (!activityTag.includes(ns.prefix + "=")) {
      const insertPos = tagEnd;
      result = result.substring(0, insertPos) + `\n  ${ns.prefix}="${ns.uri}"` + result.substring(insertPos);
    }
  }

  if (!result.includes('xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"')) {
    const activityTagMatch2 = result.match(/<Activity\b/);
    if (activityTagMatch2) {
      const insertPos2 = activityTagMatch2.index! + "<Activity".length;
      result = result.substring(0, insertPos2) + ' xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"' + result.substring(insertPos2);
    }
  }

  return result;
}

function repairMissingImplementation(xamlContent: string, fileName: string): { repaired: boolean; content: string } {
  let content = xamlContent;

  content = ensureStubNamespaces(content);

  if (/x:TypeArguments="\{http:\/\//.test(content)) {
    content = sanitizeClrTypeArguments(content);
    console.log(`[UiPath] Repaired CLR namespace type arguments in "${fileName}"`);
  }

  const loadResult = checkStudioLoadability(content);
  if (loadResult.loadable) {
    if (content !== xamlContent) {
      console.log(`[UiPath] Namespace repair succeeded for "${fileName}" — fixed missing xmlns declarations`);
      return { repaired: true, content };
    }
    return { repaired: false, content: xamlContent };
  }
  if (!loadResult.repairable) {
    return { repaired: false, content };
  }

  const activityOpenMatch = content.match(/<Activity\b[\s\S]*?>/);
  const activityCloseIdx = content.lastIndexOf("</Activity>");
  if (!activityOpenMatch || activityCloseIdx < 0) {
    return { repaired: false, content };
  }

  const activityOpenEnd = activityOpenMatch.index! + activityOpenMatch[0].length;
  const innerContent = content.substring(activityOpenEnd, activityCloseIdx).trim();

  const xMembersMatch = innerContent.match(/<x:Members\b[\s\S]*?<\/x:Members>/);
  const xMembersBlock = xMembersMatch ? xMembersMatch[0] : "";
  const remainingInner = xMembersMatch
    ? innerContent.replace(xMembersBlock, "").trim()
    : innerContent;

  const metadataBlocks: string[] = [];
  const metadataPatterns = [
    /<mva:VisualBasic\.Settings[\s\S]*?<\/mva:VisualBasic\.Settings>/g,
    /<sap2010:WorkflowViewState\.IdRef>[^<]*<\/sap2010:WorkflowViewState\.IdRef>/g,
    /<TextExpression\.NamespacesForImplementation[\s\S]*?<\/TextExpression\.NamespacesForImplementation>/g,
    /<TextExpression\.ReferencesForImplementation[\s\S]*?<\/TextExpression\.ReferencesForImplementation>/g,
  ];
  let strippedRemaining = remainingInner;
  for (const pattern of metadataPatterns) {
    const matches = remainingInner.match(pattern);
    if (matches) {
      for (const m of matches) {
        metadataBlocks.push(m);
        strippedRemaining = strippedRemaining.replace(m, "").trim();
      }
    }
  }

  const className = fileName.replace(/\.xaml$/i, "").replace(/[^A-Za-z0-9_]/g, "_");
  const hasUiNamespace = /xmlns:ui=/.test(content);

  let sequenceBody: string;
  if (strippedRemaining.length > 0) {
    sequenceBody = `  <Sequence DisplayName="${className}">\n    ${strippedRemaining}\n  </Sequence>`;
  } else {
    const stubComment = hasUiNamespace
      ? `<ui:Comment Text="[IMPLEMENTATION_REPAIRED] Root container was missing — this stub Sequence was injected to prevent DynamicActivity/Implementation null. Implement the actual logic here." DisplayName="Implementation Repair Stub" />`
      : `<!-- [IMPLEMENTATION_REPAIRED] Root container was missing — this stub Sequence was injected to prevent DynamicActivity/Implementation null. Implement the actual logic here. -->`;
    sequenceBody = `  <Sequence DisplayName="${className}">\n    ${stubComment}\n  </Sequence>`;
  }

  const repairedXaml =
    content.substring(0, activityOpenEnd) +
    "\n" +
    (xMembersBlock ? xMembersBlock + "\n" : "") +
    metadataBlocks.map(b => b + "\n").join("") +
    sequenceBody +
    "\n" +
    content.substring(activityCloseIdx);

  const recheckResult = checkStudioLoadability(repairedXaml);
  if (recheckResult.loadable) {
    console.log(`[UiPath] Implementation repair succeeded for "${fileName}" — injected root Sequence`);
    return { repaired: true, content: repairedXaml };
  }

  return { repaired: false, content: xamlContent };
}

function classifyStubFailureCategory(
  file: string,
  remediations: Array<{ file: string; remediationCode: string; classifiedCheck?: string; reason?: string }>,
  qualityViolations: Array<{ file: string; check: string; severity: string; detail?: string }>,
): { category: import("./uipath-pipeline").StubFailureCategory; summary: string; developerAction: string } {
  const fileRemediations = remediations.filter(r => r.file === file || r.file === file.replace(/\.xaml$/i, ""));
  const fileViolations = qualityViolations.filter(v => v.file === file);

  const checks = new Set([
    ...fileRemediations.map(r => r.classifiedCheck).filter(Boolean),
    ...fileViolations.filter(v => v.severity === "error").map(v => v.check),
  ]);

  if (checks.has("xml-wellformedness") || fileRemediations.some(r => r.remediationCode === "STUB_WORKFLOW_BLOCKING" && r.reason?.includes("well-formedness"))) {
    return {
      category: "xml-wellformedness",
      summary: "XML well-formedness failure in tree assembler",
      developerAction: "Regenerate the workflow from the SDD spec, or manually fix XML structure (proper nesting and closing tags)",
    };
  }

  if (checks.has("EXPRESSION_SYNTAX_UNFIXABLE") || checks.has("EXPRESSION_SYNTAX")) {
    const hasVarDefaults = fileViolations.some(v => v.detail?.includes("variable default") || v.detail?.includes("Variable.Default"));
    if (hasVarDefaults) {
      return {
        category: "quality-gate-escalation",
        summary: "Quality gate escalation — variable defaults treated as expressions",
        developerAction: "Manually set variable default values in Studio — the pipeline incorrectly flagged literal defaults as invalid expressions",
      };
    }
    return {
      category: "expression-syntax",
      summary: "Expression syntax errors that could not be auto-corrected",
      developerAction: "Open in Studio and fix VB.NET expression syntax in flagged activities",
    };
  }

  if (checks.has("TYPE_MISMATCH") || checks.has("FOREACH_TYPE_MISMATCH") || checks.has("LITERAL_TYPE_ERROR") || checks.has("invalid-type-argument")) {
    return {
      category: "type-mismatch",
      summary: "Type mismatch — x:Object or incorrect types used where specific types needed",
      developerAction: "Change variable types to match expected types in Studio (e.g., replace x:Object with System.Data.DataTable)",
    };
  }

  if (checks.has("undeclared-variable")) {
    return {
      category: "undeclared-variable",
      summary: "References to variables not declared in the workflow scope",
      developerAction: "Declare missing variables in the Variables panel in Studio, or fix variable name references",
    };
  }

  if (checks.has("unknown-activity") || checks.has("undeclared-namespace") || checks.has("policy-blocked-activity")) {
    return {
      category: "unknown-activity",
      summary: "Unknown or policy-blocked activities referenced in XAML",
      developerAction: "Install required NuGet packages or replace blocked activities with approved alternatives",
    };
  }

  if (fileRemediations.some(r => r.remediationCode === "STUB_WORKFLOW_GENERATOR_FAILURE")) {
    return {
      category: "generation-failure",
      summary: "Workflow generation failed — LLM output could not be parsed into valid XAML",
      developerAction: "Re-implement the workflow from scratch using the SDD specification as reference",
    };
  }

  const loadabilityFailure = fileRemediations.some(r => r.reason?.includes("not Studio-loadable") || r.reason?.includes("Implementation is null"));
  if (loadabilityFailure) {
    return {
      category: "structural-invalid",
      summary: "Structural preservation — valid XML but not Studio-loadable (missing Implementation)",
      developerAction: "Rebuild the workflow from scratch — the preserved XML structure lacks required XAML semantics",
    };
  }

  return {
    category: "compliance-failure",
    summary: "Compliance or quality gate failure requiring manual remediation",
    developerAction: "Review quality gate findings and fix each issue in Studio",
  };
}

function buildReachabilityGraph(
  deferredWrites: Map<string, string>,
  xamlEntries: Array<{ name: string; content: string }>,
  libPath: string,
): { reachable: Set<string>; unreachable: Set<string>; graph: Map<string, string[]> } {
  const allFiles = new Map<string, string>();
  const filenameToKey = new Map<string, string>();
  const prefix = libPath + "/";

  Array.from(deferredWrites.entries()).forEach(([path, content]) => {
    if (path.endsWith(".xaml")) {
      const relPath = path.startsWith(prefix) ? path.slice(prefix.length) : (path.split("/").pop() || path);
      const normalizedKey = normalizeXamlPath(relPath);
      allFiles.set(normalizedKey, content);
      const basename = normalizedKey.split("/").pop() || normalizedKey;
      if (!filenameToKey.has(basename)) {
        filenameToKey.set(basename, normalizedKey);
      }
    }
  });
  for (const entry of xamlEntries) {
    const relPath = entry.name.startsWith(prefix) ? entry.name.slice(prefix.length) : (entry.name.split("/").pop() || entry.name);
    const normalizedKey = normalizeXamlPath(relPath);
    if (normalizedKey.endsWith(".xaml") && !allFiles.has(normalizedKey)) {
      allFiles.set(normalizedKey, entry.content);
      const basename = normalizedKey.split("/").pop() || normalizedKey;
      if (!filenameToKey.has(basename)) {
        filenameToKey.set(basename, normalizedKey);
      }
    }
  }

  const graph = new Map<string, string[]>();

  const canonicalToKey = new Map<string, string>();
  Array.from(allFiles.keys()).forEach(file => {
    const basename = (file.split("/").pop() || file).replace(/\.xaml$/i, "");
    const canonical = normalizeWorkflowName(basename);
    if (!canonicalToKey.has(canonical)) {
      canonicalToKey.set(canonical, file);
    }
  });

  const unresolvedRefs: Array<{ source: string; rawRef: string }> = [];

  Array.from(allFiles.entries()).forEach(([file, content]) => {
    const refs: string[] = [];
    const invokePattern = /WorkflowFileName="([^"]+)"/g;
    let match;
    while ((match = invokePattern.exec(content)) !== null) {
      const rawValue = match[1];
      const normalized = normalizeWorkflowName(rawValue);
      const normalizedXaml = normalized + ".xaml";
      const normalizedPath = normalizeXamlPath(normalizedXaml);

      if (allFiles.has(normalizedPath)) {
        refs.push(normalizedPath);
      } else {
        const mappedKey = filenameToKey.get(normalizedPath) || canonicalToKey.get(normalized.toLowerCase());
        if (mappedKey) {
          refs.push(mappedKey);
        } else {
          const rawRef = normalizeXamlPath(rawValue);
          if (allFiles.has(rawRef)) {
            refs.push(rawRef);
          } else {
            const refBasename = rawRef.split("/").pop() || rawRef;
            const mappedByBasename = filenameToKey.get(refBasename);
            if (mappedByBasename) {
              refs.push(mappedByBasename);
            } else {
              unresolvedRefs.push({ source: file, rawRef: rawValue });
              refs.push(rawRef);
            }
          }
        }
      }
    }
    graph.set(file, refs);
  });

  for (const { source, rawRef } of unresolvedRefs) {
    console.warn(`[Reachability] Unresolved InvokeWorkflowFile reference in ${source}: "${rawRef}" — no matching file found after normalization`);
  }

  const reachable = new Set<string>();
  const mainKey = allFiles.has("Main.xaml") ? "Main.xaml" : (filenameToKey.get("Main.xaml") || "Main.xaml");
  const queue = [mainKey];
  reachable.add(mainKey);

  const processKey = allFiles.has("Process.xaml") ? "Process.xaml" : filenameToKey.get("Process.xaml");
  if (processKey && !reachable.has(processKey)) {
    reachable.add(processKey);
    queue.push(processKey);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const refs = graph.get(current) || [];
    for (const ref of refs) {
      if (!reachable.has(ref) && allFiles.has(ref)) {
        reachable.add(ref);
        queue.push(ref);
      }
    }
  }

  const INFRASTRUCTURE_FILES = new Set([
    "InitAllSettings.xaml",
    "CloseAllApplications.xaml",
    "KillAllProcesses.xaml",
  ]);

  const unreachable = new Set<string>();
  Array.from(allFiles.keys()).forEach(file => {
    const basename = file.split("/").pop() || file;
    if (!reachable.has(file) && !INFRASTRUCTURE_FILES.has(basename)) {
      unreachable.add(file);
    }
  });

  return { reachable, unreachable, graph };
}

function filterUnreachableBySpecDecomposition(
  unreachable: Set<string>,
  generatedWorkflowNames: Set<string>,
): { trulyOrphaned: Set<string>; specRetained: Set<string> } {
  const trulyOrphaned = new Set<string>();
  const specRetained = new Set<string>();

  Array.from(unreachable).forEach(file => {
    const basename = (file.split("/").pop() || file).replace(/\.xaml$/i, "");
    if (generatedWorkflowNames.has(basename)) {
      specRetained.add(file);
    } else {
      trulyOrphaned.add(file);
    }
  });

  return { trulyOrphaned, specRetained };
}

function removeUnreachableFiles(
  deferredWrites: Map<string, string>,
  xamlEntries: Array<{ name: string; content: string }>,
  unreachable: Set<string>,
  libPath: string,
): { removedFiles: string[]; reasons: string[] } {
  const removedFiles: string[] = [];
  const reasons: string[] = [];

  Array.from(unreachable).forEach(file => {
    if (file === "Main.xaml" || file === "Process.xaml" || file === "InitAllSettings.xaml") {
      console.log(`[Structural Dedup] Protected "${file}" from removal — critical entry-point file`);
      return;
    }
    const archivePath = `${libPath}/${file}`;
    if (deferredWrites.has(archivePath)) {
      deferredWrites.delete(archivePath);
      removedFiles.push(file);
      reasons.push(`Removed "${file}": unreachable from Main.xaml entry-point graph — no InvokeWorkflowFile reference chain leads to this file`);
      console.log(`[Structural Dedup] Removed unreachable file: ${file}`);
    }
  });

  const prefix = libPath + "/";
  for (let i = xamlEntries.length - 1; i >= 0; i--) {
    const entryName = xamlEntries[i].name;
    const relPath = entryName.startsWith(prefix) ? entryName.slice(prefix.length) : (entryName.split("/").pop() || entryName);
    if (unreachable.has(relPath)) {
      if (relPath === "Main.xaml" || relPath === "Process.xaml" || relPath === "InitAllSettings.xaml") continue;
      if (!removedFiles.includes(relPath)) {
        removedFiles.push(relPath);
        reasons.push(`Removed "${relPath}" from xamlEntries: unreachable from Main.xaml entry-point graph`);
      }
      xamlEntries.splice(i, 1);
      console.log(`[Structural Dedup] Removed unreachable xamlEntry: ${relPath}`);
    }
  }

  return { removedFiles, reasons };
}

type CredentialStrategy = "GetAsset" | "GetCredential" | "mixed" | "none";

function detectCredentialStrategy(xamlContent: string): CredentialStrategy {
  const hasGetAsset = /<ui:GetAsset[\s>]/.test(xamlContent);
  const hasGetCredential = /<ui:GetCredential[\s>]/.test(xamlContent);
  if (hasGetAsset && hasGetCredential) return "mixed";
  if (hasGetAsset) return "GetAsset";
  if (hasGetCredential) return "GetCredential";
  return "none";
}

function determineCredentialStrategy(orchestratorArtifacts?: any): CredentialStrategy {
  const assets = orchestratorArtifacts?.assets || [];
  const hasCredentials = assets.some((a: any) => a.type === "Credential");
  const hasTextAssets = assets.some((a: any) => a.type !== "Credential");
  if (hasCredentials && !hasTextAssets) return "GetCredential";
  if (!hasCredentials && hasTextAssets) return "GetAsset";
  if (hasCredentials && hasTextAssets) return "mixed";
  return "none";
}

function reconcileCredentialStrategy(
  deferredWrites: Map<string, string>,
  xamlEntries: Array<{ name: string; content: string }>,
  predeterminedStrategy?: CredentialStrategy,
): { strategy: CredentialStrategy; reconciled: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (predeterminedStrategy && predeterminedStrategy !== "none") {
    if (predeterminedStrategy === "mixed") {
      console.log(`[Credential Reconciliation] Pre-determined mixed strategy (both credential and text assets declared) — both GetCredential and GetAsset are intentional, skipping reconciliation`);
    } else {
      console.log(`[Credential Reconciliation] Using pre-determined strategy: ${predeterminedStrategy} — skipping reconciliation`);
    }
    const effectiveStrategy = predeterminedStrategy === "mixed" ? "GetCredential" : predeterminedStrategy;
    return { strategy: effectiveStrategy, reconciled: false, warnings };
  }

  let globalHasAsset = false;
  let globalHasCredential = false;

  Array.from(deferredWrites.entries()).forEach(([path, content]) => {
    if (path.endsWith(".xaml")) {
      const strategy = detectCredentialStrategy(content);
      if (strategy === "GetAsset" || strategy === "mixed") globalHasAsset = true;
      if (strategy === "GetCredential" || strategy === "mixed") globalHasCredential = true;
    }
  });

  for (const entry of xamlEntries) {
    const strategy = detectCredentialStrategy(entry.content);
    if (strategy === "GetAsset" || strategy === "mixed") globalHasAsset = true;
    if (strategy === "GetCredential" || strategy === "mixed") globalHasCredential = true;
  }

  if (!globalHasAsset || !globalHasCredential) {
    const strategy = globalHasCredential ? "GetCredential" : (globalHasAsset ? "GetAsset" : "none");
    return { strategy, reconciled: false, warnings };
  }

  const targetStrategy: CredentialStrategy = "GetCredential";
  warnings.push(
    `Mixed credential strategies detected (both GetAsset and GetCredential). ` +
    `Reconciled to "${targetStrategy}" for consistency across all workflows.`
  );
  console.log(`[Credential Reconciliation] Mixed strategies detected — reconciling to ${targetStrategy}`);

  return { strategy: targetStrategy, reconciled: true, warnings };
}

interface PostAssemblyValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  remediations: Array<{ code: string; detail: string }>;
}

const PROPERTY_NAME_CORRECTIONS: Array<{
  activityClass: string;
  wrong: string;
  correct: string;
  note: string;
}> = [
  { activityClass: "GetTransactionItem", wrong: "QueueItemName", correct: "QueueName", note: "UiPath.Core.Activities 23.10+: property is QueueName (InArgument child element), not QueueItemName" },
  { activityClass: "SetTransactionStatus", wrong: "StatusInfo", correct: "Status", note: "UiPath.Core.Activities 23.10+: property is Status, not StatusInfo" },
];

function getPlaceholderForClrType(clrType: string): string {
  const placeholders: Record<string, string> = {
    "System.String": "PLACEHOLDER",
    "System.Int32": "0",
    "System.Int64": "0",
    "System.Boolean": "False",
    "System.Double": "0.0",
    "System.TimeSpan": "00:00:00",
    "System.Object": "Nothing",
  };
  return placeholders[clrType] || "PLACEHOLDER";
}

function inferTransitionTargetFromDisplayName(displayName: string, stateNames: string[], stateDisplayNames: Map<string, string>): string | null {
  const arrowMatch = displayName.match(/(?:->|→|->|&gt;)\s*(.+)$/);
  if (!arrowMatch) return null;
  const targetHint = arrowMatch[1].trim().replace(/\(.*\)$/, "").trim();
  if (!targetHint) return null;

  const targetLower = targetHint.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const [stateName, stateDisplayName] of Array.from(stateDisplayNames.entries())) {
    const dnLower = stateDisplayName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (dnLower === targetLower || dnLower.includes(targetLower) || targetLower.includes(dnLower)) {
      return stateName;
    }
  }

  for (const stateName of stateNames) {
    const snLower = stateName.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (snLower.includes(targetLower) || targetLower.includes(snLower.replace("state_", ""))) {
      return stateName;
    }
  }

  const KEYWORD_TO_STATE: Record<string, string[]> = {
    "init": ["init", "initialize", "initialization"],
    "get": ["gettransaction", "gettransactiondata", "get_transaction"],
    "process": ["process", "processtransaction", "process_transaction"],
    "end": ["end", "endprocess", "end_process", "final", "done", "complete"],
  };
  for (const stateName of stateNames) {
    const snKey = stateName.toLowerCase().replace(/^state_?/i, "").replace(/[^a-z0-9]/g, "");
    for (const [, keywords] of Object.entries(KEYWORD_TO_STATE)) {
      if (keywords.some(kw => targetLower.includes(kw) || kw.includes(targetLower))) {
        if (keywords.some(kw => snKey.includes(kw) || kw.includes(snKey))) {
          return stateName;
        }
      }
    }
  }

  return null;
}

function repairTransitionsInXaml(xamlContent: string): { content: string; repairs: string[]; unrepaired: string[] } {
  let content = xamlContent;
  const repairs: string[] = [];
  const unrepaired: string[] = [];

  const stateNameMatches = Array.from(content.matchAll(/x:Name="([^"]+)"/g));
  const stateNames = stateNameMatches.map(m => m[1]);

  const stateDisplayNames = new Map<string, string>();
  const stateTagPattern = /<State\s[^>]*?(?:DisplayName="([^"]*)"[^>]*?x:Name="([^"]*)")|(?:x:Name="([^"]*)"[^>]*?DisplayName="([^"]*)")/g;
  let sdMatch;
  while ((sdMatch = stateTagPattern.exec(content)) !== null) {
    const dn = sdMatch[1] || sdMatch[4] || "";
    const name = sdMatch[2] || sdMatch[3] || "";
    if (name) stateDisplayNames.set(name, dn);
  }

  const finalStatePattern = /<State\s[^>]*IsFinal="True"[^>]*x:Name="([^"]+)"/g;
  const finalStateNames: string[] = [];
  let fsMatch;
  while ((fsMatch = finalStatePattern.exec(content)) !== null) {
    finalStateNames.push(fsMatch[1]);
  }
  const finalStatePattern2 = /<State\s[^>]*x:Name="([^"]+)"[^>]*IsFinal="True"/g;
  while ((fsMatch = finalStatePattern2.exec(content)) !== null) {
    if (!finalStateNames.includes(fsMatch[1])) finalStateNames.push(fsMatch[1]);
  }

  const transPattern = /<Transition\s([^>]*?)(\/>|>)/g;
  let tMatch;
  while ((tMatch = transPattern.exec(content)) !== null) {
    const attrs = tMatch[1];
    if (attrs.includes('To="')) continue;

    const transStart = tMatch.index!;
    if (tMatch[2] === ">") {
      const transEnd = content.indexOf("</Transition>", transStart);
      if (transEnd !== -1) {
        const transBody = content.substring(transStart, transEnd + "</Transition>".length);
        if (transBody.includes("<Transition.To>")) continue;
      }
    }

    const displayNameMatch = attrs.match(/DisplayName="([^"]*)"/);
    const dn = displayNameMatch ? displayNameMatch[1] : "Transition";

    let targetState: string | null = null;
    if (finalStateNames.length === 1) {
      targetState = finalStateNames[0];
    } else if (stateNames.length === 1) {
      targetState = stateNames[0];
    }

    if (!targetState) {
      targetState = inferTransitionTargetFromDisplayName(dn, stateNames, stateDisplayNames);
    }

    if (targetState) {
      const original = tMatch[0];
      const repaired = original.replace(
        tMatch[2] === "/>" ? /\/>$/ : />$/,
        ` To="{x:Reference ${targetState}}"${tMatch[2]}`
      );
      content = content.replace(original, repaired);
      repairs.push(`Transition "${dn}" repaired with target "${targetState}"`);
    } else {
      unrepaired.push(`Transition "${dn}" missing To attribute — no safe target inferable (${stateNames.length} states, ${finalStateNames.length} final)`);
    }
  }

  return { content, repairs, unrepaired };
}

function applyPropertyNameCorrections(
  deferredWrites: Map<string, string>,
  xamlEntries: Array<{ name: string; content: string }>,
  remediations: Array<{ code: string; detail: string }>,
): void {
  for (const correction of PROPERTY_NAME_CORRECTIONS) {
    const wrongPattern = new RegExp(`(${correction.activityClass}[.\\s][^>]*)\\b${correction.wrong}="([^"]*)"`, "g");
    Array.from(deferredWrites.entries()).forEach(([path, content]) => {
      if (!path.endsWith(".xaml")) return;
      const fileName = path.split("/").pop() || path;
      let updated = content;
      let corrected = false;
      updated = updated.replace(wrongPattern, (match: string, prefix: string, value: string) => {
        if (catalogService.isLoaded()) {
          const schema = catalogService.getActivitySchema(correction.activityClass);
          if (schema) {
            const hasProp = schema.activity.properties.some(p => p.name === correction.wrong);
            if (hasProp) return match;
          }
        }
        corrected = true;
        return `${prefix}${correction.correct}="${value}"`;
      });
      if (corrected) {
        deferredWrites.set(path, updated);
        remediations.push({
          code: "PROPERTY_NAME_CORRECTED",
          detail: `${fileName}: ${correction.activityClass}.${correction.wrong} → ${correction.correct} (${correction.note})`,
        });
        console.log(`[Post-Assembly] Property correction in ${fileName}: ${correction.activityClass}.${correction.wrong} → ${correction.correct}`);
      }
    });
    for (const entry of xamlEntries) {
      let updated = entry.content;
      let corrected = false;
      updated = updated.replace(wrongPattern, (_match: string, prefix: string, value: string) => {
        corrected = true;
        return `${prefix}${correction.correct}="${value}"`;
      });
      if (corrected) {
        entry.content = updated;
      }
    }
  }
}

function runPostAssemblyValidation(
  deps: Record<string, string>,
  studioVersion: string,
  xamlEntries: Array<{ name: string; content: string }>,
  deferredWrites: Map<string, string>,
  libPath: string,
  studioProfile: StudioProfile | null,
  metaTarget: { version: string } | null,
): PostAssemblyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const remediations: Array<{ code: string; detail: string }> = [];

  applyPropertyNameCorrections(deferredWrites, xamlEntries, remediations);

  for (const [pkgName, version] of Object.entries(deps)) {
    const metaVersion = _metadataService.getPreferredVersion(pkgName);
    if (!metaVersion) {
      errors.push(`Dependency "${pkgName}" version "${version}" is not in the validated version registry`);
    }
  }

  if (!validateStudioVersion(studioVersion)) {
    errors.push(`studioVersion "${studioVersion}" does not match a valid Studio version format`);
  } else {
    const validatedVersion = isVersionFromValidatedSource(studioProfile, metaTarget);
    if (!validatedVersion) {
      errors.push(`studioVersion "${studioVersion}" is not from a validated source (studio profile or metadata service)`);
    } else if (validatedVersion !== studioVersion) {
      warnings.push(`studioVersion "${studioVersion}" differs from validated source version "${validatedVersion}"`);
    }
  }

  Array.from(deferredWrites.entries()).forEach(([path, content]) => {
    if (!path.endsWith(".xaml")) return;
    const viSweep = sweepValueIntentFromXaml(content);
    if (viSweep.repairCount > 0) {
      deferredWrites.set(path, viSweep.content);
      const fn = path.split("/").pop() || path;
      console.log(`[Post-Assembly] Pre-reachability ValueIntent sweep: cleaned ${viSweep.repairCount} fragment(s) in ${fn}`);
    }
  });
  for (const entry of xamlEntries) {
    const viSweep = sweepValueIntentFromXaml(entry.content);
    if (viSweep.repairCount > 0) {
      entry.content = viSweep.content;
    }
  }

  const { reachable, unreachable } = buildReachabilityGraph(deferredWrites, xamlEntries, libPath);

  const fileRelPaths = new Set<string>();
  const valPrefix = libPath + "/";
  Array.from(deferredWrites.entries()).forEach(([path]) => {
    if (path.endsWith(".xaml")) {
      const relPath = path.startsWith(valPrefix) ? path.slice(valPrefix.length) : (path.split("/").pop() || path);
      fileRelPaths.add(relPath);
    }
  });
  for (const entry of xamlEntries) {
    const relPath = entry.name.startsWith(valPrefix) ? entry.name.slice(valPrefix.length) : (entry.name.split("/").pop() || entry.name);
    if (relPath.endsWith(".xaml")) fileRelPaths.add(relPath);
  }

  if (!fileRelPaths.has("Main.xaml")) {
    errors.push("Entry point file Main.xaml does not exist in the package");
  }

  if (unreachable.size > 0) {
    const allFileCanonicals = new Map<string, string>();
    Array.from(reachable).forEach(f => {
      const bn = (f.split("/").pop() || f).replace(/\.xaml$/i, "");
      allFileCanonicals.set(canonicalizeWorkflowName(bn), f);
    });

    const trulyUnreachable: string[] = [];
    Array.from(unreachable).forEach(file => {
      const bn = (file.split("/").pop() || file).replace(/\.xaml$/i, "");
      const canonical = canonicalizeWorkflowName(bn);
      if (allFileCanonicals.has(canonical)) {
        remediations.push({
          code: "REACHABILITY_IDENTITY_DRIFT",
          detail: `"${file}" unreachable due to pre-canonicalization identity drift — canonical name "${canonical}" matches reachable file "${allFileCanonicals.get(canonical)}"`,
        });
      } else {
        trulyUnreachable.push(file);
      }
    });

    if (trulyUnreachable.length > 0) {
      warnings.push(`${trulyUnreachable.length} XAML file(s) unreachable from Main.xaml: ${trulyUnreachable.join(", ")}`);
    }
  }

  let allXamlContent = [
    ...xamlEntries.map(e => e.content),
    ...Array.from(deferredWrites.entries())
      .filter(([p]) => p.endsWith(".xaml"))
      .map(([, c]) => c),
  ].join("\n");

  const objectDefaultPattern = /<Variable\s+x:TypeArguments="x:Object"[^>]*Default="[^"]*"/g;
  let objDefaultMatch;
  while ((objDefaultMatch = objectDefaultPattern.exec(allXamlContent)) !== null) {
    const nameMatch = objDefaultMatch[0].match(/Name="([^"]+)"/);
    const varName = nameMatch ? nameMatch[1] : "unknown";
    warnings.push(`Variable "${varName}" has Default value on x:Object type — may cause "Literal only supports value types" error`);
  }

  const csharpPatterns = [
    { pattern: /\bnew\s+[A-Z]\w*\s*</g, desc: "C# new with generic angle bracket" },
    { pattern: /!=\s*null/g, desc: "C# != null" },
    { pattern: /&&/g, desc: "C# &&" },
    { pattern: /\|\|/g, desc: "C# ||" },
    { pattern: /=>\s*\{/g, desc: "C# lambda =>" },
    { pattern: /\$"/g, desc: "C# string interpolation $\"" },
  ];
  const exprContentOnly = allXamlContent.replace(/<\?xml[^>]*\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const { pattern, desc } of csharpPatterns) {
    const attrContext = new RegExp(`(?:Condition|Value|Expression|Message|Text)="[^"]*${pattern.source}`, "g");
    if (attrContext.test(exprContentOnly)) {
      warnings.push(`C# expression leakage detected: ${desc} found in XAML expression attributes`);
    }
  }

  if (/<If\.Then>\s*<\/If\.Then>/.test(allXamlContent)) {
    errors.push("Container structure error: Empty If.Then element — Studio requires exactly one child activity");
  }
  if (/<TryCatch\.Try>\s*<\/TryCatch\.Try>/.test(allXamlContent)) {
    errors.push("Container structure error: Empty TryCatch.Try element — Studio requires exactly one child activity");
  }
  const forEachPattern = /<ForEach\s[^>]*>[\s\S]*?<\/ForEach>/g;
  let feCheckMatch;
  while ((feCheckMatch = forEachPattern.exec(allXamlContent)) !== null) {
    if (!feCheckMatch[0].includes("<ActivityAction")) {
      errors.push("Container structure error: ForEach missing ActivityAction child — required by Studio");
    }
  }

  if (allXamlContent.includes("<StateMachine") || allXamlContent.includes("<State ")) {
    if (!allXamlContent.includes("System.Activities.Statements") && !allXamlContent.includes("sads:")) {
      warnings.push("StateMachine/State used but System.Activities.Statements namespace not declared");
    }
  }

  if (allXamlContent.includes("<ui:RetryScope")) {
    if (allXamlContent.includes("<ui:RetryScope.Body>")) {
      allXamlContent = allXamlContent.replace(/<ui:RetryScope\.Body>\s*/g, "").replace(/\s*<\/ui:RetryScope\.Body>/g, "");
      warnings.push("RetryScope had explicit .Body property element — unwrapped to use default content property");
    }
    const retryScopeBlocks = /<ui:RetryScope\s[^>]*>[\s\S]*?<\/ui:RetryScope>/g;
    let rsMatch;
    while ((rsMatch = retryScopeBlocks.exec(allXamlContent)) !== null) {
      const block = rsMatch[0];
      if (!block.includes("<ui:RetryScope.Condition>") && !block.includes("<ui:ShouldRetry")) {
        warnings.push("RetryScope is missing Condition element (ui:RetryScope.Condition with ui:ShouldRetry)");
      }
      const directChildren = block.match(/<Sequence\s/g) || [];
      if (directChildren.length === 0 && !block.includes("<ui:RetryScope.Body>")) {
        warnings.push("RetryScope has no Sequence child as default content — body activities may not execute");
      }
    }
  }

  if (allXamlContent.includes("<ui:GetAsset")) {
    const getAssetVarPattern = /<ui:GetAsset\.AssetValue>\s*<OutArgument[^>]*>\[([^\]]+)\]\s*<\/OutArgument>\s*<\/ui:GetAsset\.AssetValue>/g;
    let gaMatch;
    while ((gaMatch = getAssetVarPattern.exec(allXamlContent)) !== null) {
      let varName = gaMatch[1];
      const dictAccessMatch = varName.match(/^([a-zA-Z_]\w*)\s*\(/);
      if (dictAccessMatch) {
        varName = dictAccessMatch[1];
      }
      const varDeclared = allXamlContent.includes(`Name="${varName}"`);
      if (!varDeclared) {
        warnings.push(`GetAsset output variable "${varName}" is not declared in workflow variables`);
      }
    }
  }

  if (catalogService.isLoaded()) {
    const missingPropRepairs: Array<{ activityTag: string; propName: string; placeholder: string }> = [];
    const activityTagPattern = /<((?:[a-z]+:)?[A-Z][A-Za-z]+)\s([^>]*?)(?:\/>|>)/g;
    let actFamilyMatch;
    const checkedActivities = new Set<string>();
    while ((actFamilyMatch = activityTagPattern.exec(allXamlContent)) !== null) {
      const activityTag = actFamilyMatch[1];
      const tagStr = actFamilyMatch[0];
      const schema = catalogService.getActivitySchema(activityTag);
      if (!schema) {
        checkedActivities.add(activityTag);
        continue;
      }
      for (const propDef of schema.activity.properties) {
        if (!propDef.required) continue;
        if (tagStr.includes(`${propDef.name}="`)) continue;
        const closeTag = `</${activityTag}>`;
        const endIdx = allXamlContent.indexOf(closeTag, actFamilyMatch.index);
        const bodySection = endIdx > 0 ? allXamlContent.substring(actFamilyMatch.index, endIdx) : tagStr;
        if (bodySection.includes(`${activityTag}.${propDef.name}`)) continue;

        const placeholder = getPlaceholderForClrType(propDef.clrType || "System.String");
        missingPropRepairs.push({ activityTag, propName: propDef.name, placeholder });
        warnings.push(`${schema.activity.displayName || activityTag} activity is missing required property "${propDef.name}" — auto-injected placeholder`);
        remediations.push({
          code: "MISSING_REQUIRED_PROPERTY_INJECTED",
          detail: `${activityTag}.${propDef.name} set to ${placeholder} — developer must provide actual value`,
        });
        const traceRunId = getCurrentRunId();
        if (traceRunId) {
          recordTransform(traceRunId, {
            stage: "auto_injected_property",
            file: "package",
            description: `Auto-injected required property ${activityTag}.${propDef.name} with placeholder "${placeholder}"`,
            after: placeholder,
          });
        }
      }
      checkedActivities.add(activityTag);
    }

    if (missingPropRepairs.length > 0) {
      for (const repair of missingPropRepairs) {
        const attrInjection = ` ${repair.propName}="${repair.placeholder}"`;
        const selfClosingPattern = new RegExp(`(<${repair.activityTag}\\s[^>]*?)(/?>)`, "g");
        const applyRepair = (content: string): string => {
          return content.replace(selfClosingPattern, (match: string, prefix: string, closing: string) => {
            if (match.includes(`${repair.propName}="`)) return match;
            return `${prefix}${attrInjection}${closing}`;
          });
        };
        Array.from(deferredWrites.entries()).forEach(([path, content]) => {
          if (!path.endsWith(".xaml")) return;
          const updated = applyRepair(content);
          if (updated !== content) deferredWrites.set(path, updated);
        });
        for (const entry of xamlEntries) {
          entry.content = applyRepair(entry.content);
        }
      }
      console.log(`[Post-Assembly] Auto-injected ${missingPropRepairs.length} missing required property placeholder(s)`);
    }
  }

  {
    let transitionRepairCount = 0;
    Array.from(deferredWrites.entries()).forEach(([path, content]) => {
      if (!path.endsWith(".xaml")) return;
      if (!content.includes("<Transition")) return;
      const transResult = repairTransitionsInXaml(content);
      if (transResult.repairs.length > 0) {
        deferredWrites.set(path, transResult.content);
        transitionRepairCount += transResult.repairs.length;
        transResult.repairs.forEach(r => {
          remediations.push({ code: "TRANSITION_REPAIRED", detail: r });
        });
      }
      transResult.unrepaired.forEach(u => {
        warnings.push(u);
        remediations.push({ code: "TRANSITION_UNREPAIRED", detail: u });
      });
    });
    for (const entry of xamlEntries) {
      if (!entry.content.includes("<Transition")) continue;
      const transResult = repairTransitionsInXaml(entry.content);
      if (transResult.repairs.length > 0) {
        entry.content = transResult.content;
        transitionRepairCount += transResult.repairs.length;
        transResult.repairs.forEach(r => {
          remediations.push({ code: "TRANSITION_REPAIRED", detail: r });
        });
      }
      transResult.unrepaired.forEach(u => {
        warnings.push(u);
        remediations.push({ code: "TRANSITION_UNREPAIRED", detail: u });
      });
    }
    if (transitionRepairCount > 0) {
      console.log(`[Post-Assembly] Repaired ${transitionRepairCount} Transition(s) with missing To attributes`);
    }
  }

  if (allXamlContent.includes("<State ")) {
    const stateBlocks = /<State\s[^>]*DisplayName="([^"]*)"[^>]*>[\s\S]*?<\/State>/g;
    let stValidMatch;
    while ((stValidMatch = stateBlocks.exec(allXamlContent)) !== null) {
      const stateName = stValidMatch[1];
      const block = stValidMatch[0];
      const isFinal = /IsFinal="True"/i.test(block);
      if (!isFinal && !block.includes("<State.Entry>")) {
        warnings.push(`State "${stateName}" is missing State.Entry — non-final states require entry activities`);
      }
    }
  }

  console.log(`[Post-Assembly Validation] Activity family checks complete: ${warnings.length} warning(s), ${errors.length} error(s), ${remediations.length} remediation(s)`);

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    remediations,
  };
}

function buildAssemblyToPackageMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [packageId, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
    if (info.assembly && !isFrameworkAssembly(packageId)) {
      map.set(info.assembly, packageId);
    }
  }
  return map;
}

function runAuthoritativeNamespaceInjection(
  deferredWrites: Map<string, string>,
  deps: Record<string, string>,
  isCrossPlatform: boolean,
): { injectedCount: number; warnings: string[] } {
  const warnings: string[] = [];
  let injectedCount = 0;

  Array.from(deferredWrites.entries()).forEach(([path, content]) => {
    if (!path.endsWith(".xaml")) return;
    const fileName = path.split("/").pop() || path;

    const declarations = deriveRequiredDeclarationsForXaml(content);
    const usedPackages = declarations.neededPackages;

    let updated = content;
    const additionalXmlns = buildDynamicXmlnsDeclarations(usedPackages, isCrossPlatform, updated);
    const additionalAssemblyRefs = buildDynamicAssemblyRefs(usedPackages, updated);
    const additionalNamespaceImports = buildDynamicNamespaceImports(usedPackages, updated);

    if (additionalXmlns) {
      const xmlnsInsertPoint = updated.indexOf('xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"');
      if (xmlnsInsertPoint >= 0) {
        const insertAfter = xmlnsInsertPoint + 'xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"'.length;
        updated = updated.slice(0, insertAfter) + "\n" + additionalXmlns + updated.slice(insertAfter);
        injectedCount++;
      }
    }

    if (additionalAssemblyRefs) {
      const result = insertBeforeClosingCollectionTag(updated, "</TextExpression.ReferencesForImplementation>", additionalAssemblyRefs);
      if (result.succeeded) {
        updated = result.updated;
        injectedCount++;
        console.log(`[Namespace Injection] [${fileName}] Injected assembly references`);
      } else {
        const refsBlockPattern = /<TextExpression\.ReferencesForImplementation>[\s\S]*?<\/TextExpression\.ReferencesForImplementation>/;
        const existingRefsBlock = updated.match(refsBlockPattern);
        if (existingRefsBlock) {
          const existingAsmEntries: string[] = [];
          const existAsmPat = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
          let ea;
          while ((ea = existAsmPat.exec(existingRefsBlock[0])) !== null) {
            existingAsmEntries.push(`      <AssemblyReference>${ea[1].trim()}</AssemblyReference>`);
          }
          const additionalLines = additionalAssemblyRefs.split("\n").filter((l: string) => l.trim());
          const allAsmEntries = [...existingAsmEntries, ...additionalLines];
          const freshRefsBlock = `<TextExpression.ReferencesForImplementation>\n    <sco:Collection x:TypeArguments="AssemblyReference">\n${allAsmEntries.join("\n")}\n    </sco:Collection>\n  </TextExpression.ReferencesForImplementation>`;
          updated = updated.replace(refsBlockPattern, freshRefsBlock);
          injectedCount++;
          console.log(`[Namespace Injection] [${fileName}] Rebuilt malformed ReferencesForImplementation block — injected assembly references`);
        } else {
          console.warn(`[Namespace Injection] WARNING: [${fileName}] Failed to inject assembly references — no ReferencesForImplementation block found`);
          warnings.push(`${fileName}: failed to inject assembly references`);
        }
      }
    }

    if (additionalNamespaceImports) {
      const result = insertBeforeClosingCollectionTag(updated, "</TextExpression.NamespacesForImplementation>", additionalNamespaceImports);
      if (result.succeeded) {
        updated = result.updated;
        injectedCount++;
        console.log(`[Namespace Injection] [${fileName}] Injected namespace imports`);
      } else {
        const nsBlockPattern = /<TextExpression\.NamespacesForImplementation>[\s\S]*?<\/TextExpression\.NamespacesForImplementation>/;
        const existingNsBlock = updated.match(nsBlockPattern);
        if (existingNsBlock) {
          const existingNsEntries: string[] = [];
          const existNsPat = /<x:String[^>]*>([^<]+)<\/x:String>/g;
          let en;
          while ((en = existNsPat.exec(existingNsBlock[0])) !== null) {
            existingNsEntries.push(`      <x:String>${en[1].trim()}</x:String>`);
          }
          const additionalLines = additionalNamespaceImports.split("\n").filter((l: string) => l.trim());
          const allNsEntries = [...existingNsEntries, ...additionalLines];
          const freshNsBlock = `<TextExpression.NamespacesForImplementation>\n    <sco:Collection x:TypeArguments="x:String">\n${allNsEntries.join("\n")}\n    </sco:Collection>\n  </TextExpression.NamespacesForImplementation>`;
          updated = updated.replace(nsBlockPattern, freshNsBlock);
          injectedCount++;
          console.log(`[Namespace Injection] [${fileName}] Rebuilt malformed NamespacesForImplementation block — injected namespace imports`);
        } else {
          console.warn(`[Namespace Injection] WARNING: [${fileName}] Failed to inject namespace imports — no NamespacesForImplementation block found`);
          warnings.push(`${fileName}: failed to inject namespace imports`);
        }
      }
    }

    const prefixPattern = /<(\w+):/g;
    let pm;
    const usedPrefixes = new Set<string>();
    while ((pm = prefixPattern.exec(updated)) !== null) {
      if (!["xmlns", "xml", "x", "sap", "sap2010", "mc", "s", "scg", "sco", "mva", "sads", "scg2"].includes(pm[1])) {
        usedPrefixes.add(pm[1]);
      }
    }

    Array.from(usedPrefixes).forEach(prefix => {
      const hasXmlns = new RegExp(`xmlns:${prefix}=`).test(updated);
      if (!hasXmlns) {
        let foundPkg = false;
        for (const [, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
          if (info.prefix === prefix) {
            foundPkg = true;
            break;
          }
        }
        if (!foundPkg) {
          warnings.push(`[${fileName}] Activity prefix "${prefix}:" used but has no catalog entry — may be unresolvable in Studio`);
        }
      }
    });

    if (updated !== content) {
      deferredWrites.set(path, updated);
    }
  });

  return { injectedCount, warnings };
}

export function runStudioResolutionSmokeTest(
  deferredWrites: Map<string, string>,
  deps: Record<string, string>,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const depPackages = new Set(Object.keys(deps));
  const assemblyToPackage = buildAssemblyToPackageMap();

  Array.from(deferredWrites.entries()).forEach(([path, content]) => {
    if (!path.endsWith(".xaml")) return;
    const fileName = path.split("/").pop() || path;

    const declaredPrefixes = new Set<string>();
    const xmlnsPattern = /xmlns:(\w+)="([^"]+)"/g;
    let xm;
    while ((xm = xmlnsPattern.exec(content)) !== null) {
      declaredPrefixes.add(xm[1]);
    }

    const declaredAssemblies = new Set<string>();
    const asmRefPattern = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
    let arm;
    while ((arm = asmRefPattern.exec(content)) !== null) {
      declaredAssemblies.add(arm[1].trim());
    }

    const declaredNamespaces = new Set<string>();
    const nsImportPattern = /<x:String[^>]*>([^<]+)<\/x:String>/g;
    let nsm;
    while ((nsm = nsImportPattern.exec(content)) !== null) {
      const val = nsm[1].trim();
      declaredNamespaces.add(val);
      const clrMatch = val.match(/^clr-namespace:([^;]+)/);
      if (clrMatch) {
        declaredNamespaces.add(clrMatch[1].trim());
      }
    }

    const checkedActivities = new Set<string>();
    const activityTagPattern = /<(\w+):(\w+)[\s>\/]/g;
    let atm;
    while ((atm = activityTagPattern.exec(content)) !== null) {
      const prefix = atm[1];
      const activityName = atm[2];
      if (prefix === "xmlns" || prefix === "xml" || prefix === "x" || prefix === "sap" || prefix === "sap2010" || prefix === "mc" || prefix === "s" || prefix === "scg" || prefix === "sco" || prefix === "mva" || prefix === "sads" || prefix === "scg2") continue;

      if (!declaredPrefixes.has(prefix)) {
        errors.push(`[${fileName}] Activity tag "${prefix}:${activityName}" uses undeclared namespace prefix "${prefix}:" — will be unresolvable in Studio`);
      }

      const activityKey = prefix + ":" + activityName;
      if (checkedActivities.has(activityKey)) continue;
      checkedActivities.add(activityKey);

      const resolvedPackage = resolveActivityToPackage(activityName);

      let matchedPackage = resolvedPackage;
      if (!matchedPackage) {
        for (const [pkgId, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
          if (info.prefix === prefix) {
            matchedPackage = pkgId;
            break;
          }
        }
      }

      if (matchedPackage && !depPackages.has(matchedPackage)) {
        errors.push(`[${fileName}] Activity "${prefix}:${activityName}" requires package "${matchedPackage}" which is not in project.json dependencies`);
      }

      if (matchedPackage) {
        const info = PACKAGE_NAMESPACE_MAP[matchedPackage];
        if (info && info.assembly && info.assembly !== "UiPath.Core.Activities" && info.assembly !== "System.Activities") {
          if (!declaredAssemblies.has(info.assembly)) {
            errors.push(`[${fileName}] Activity "${prefix}:${activityName}" requires assembly "${info.assembly}" which is not in AssemblyReference list`);
          }
        }

        if (info && info.clrNamespace) {
          if (!declaredNamespaces.has(info.clrNamespace)) {
            errors.push(`[${fileName}] Activity "${prefix}:${activityName}" missing namespace import "${info.clrNamespace}" in NamespacesForImplementation — activity will be unresolvable`);
          }
        }
      }
    }

    if (!content.includes("TextExpression.NamespacesForImplementation")) {
      errors.push(`[${fileName}] Missing TextExpression.NamespacesForImplementation block — Studio cannot resolve expression types`);
    }
    if (!content.includes("TextExpression.ReferencesForImplementation")) {
      errors.push(`[${fileName}] Missing TextExpression.ReferencesForImplementation block — Studio cannot resolve assembly references`);
    }
  });

  return { errors, warnings };
}

function extractXamlNamespaceAndAssemblyPackages(allXamlContent: string): Set<string> {
  const packages = new Set<string>();
  const assemblyToPackage = buildAssemblyToPackageMap();

  const xmlnsPattern = /xmlns:\w+="clr-namespace:[^;]*;assembly=([^"]+)"/g;
  let match;
  while ((match = xmlnsPattern.exec(allXamlContent)) !== null) {
    const assemblyName = match[1].trim();
    const pkgId = assemblyToPackage.get(assemblyName);
    if (pkgId) {
      packages.add(pkgId);
    }
  }

  const assemblyRefPattern = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
  while ((match = assemblyRefPattern.exec(allXamlContent)) !== null) {
    const assemblyName = match[1].trim();
    const pkgId = assemblyToPackage.get(assemblyName);
    if (pkgId) {
      packages.add(pkgId);
    }
  }

  return packages;
}

function validateNamespaceCoverage(
  allXamlContent: string,
  deps: Record<string, string>,
): string[] {
  const warnings: string[] = [];
  const assemblyToPackage = buildAssemblyToPackageMap();
  const depPackages = new Set(Object.keys(deps));

  const xmlnsPattern = /xmlns:(\w+)="clr-namespace:([^;]*);assembly=([^"]+)"/g;
  let match;
  while ((match = xmlnsPattern.exec(allXamlContent)) !== null) {
    const [, prefix, , assemblyName] = match;
    const trimmedAssembly = assemblyName.trim();
    if (isFrameworkAssembly(trimmedAssembly)) continue;
    if (trimmedAssembly === "System.Activities" || trimmedAssembly === "mscorlib" || trimmedAssembly === "System" || trimmedAssembly === "System.Core" || trimmedAssembly === "System.Data") continue;

    const pkgId = assemblyToPackage.get(trimmedAssembly);
    if (pkgId) {
      if (!depPackages.has(pkgId)) {
        warnings.push(`Namespace prefix "${prefix}" references assembly "${trimmedAssembly}" (package: ${pkgId}) which is not in project.json dependencies`);
      }
    }
  }

  const assemblyRefPattern = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
  while ((match = assemblyRefPattern.exec(allXamlContent)) !== null) {
    const assemblyName = match[1].trim();
    if (isFrameworkAssembly(assemblyName)) continue;
    if (assemblyName === "System.Activities" || assemblyName === "mscorlib" || assemblyName === "System" || assemblyName === "System.Core" || assemblyName === "System.Data") continue;

    const pkgId = assemblyToPackage.get(assemblyName);
    if (pkgId && !depPackages.has(pkgId)) {
      warnings.push(`AssemblyReference "${assemblyName}" (package: ${pkgId}) is not covered by project.json dependencies`);
    }
  }

  return warnings;
}

function sanitizeDeps(deps: Record<string, string>): void {
  for (const [key, val] of Object.entries(deps)) {
    if (isFrameworkAssembly(key)) {
      console.log(`[UiPath Sanitize] Removing framework assembly from dependencies: ${key}`);
      delete deps[key];
    } else if (val === "*" || val === "[*]") {
      console.log(`[UiPath Sanitize] Removing wildcard dependency version: ${key}=${val}`);
      delete deps[key];
    } else if (!isValidNuGetVersion(val)) {
      console.log(`[UiPath Sanitize] Removing malformed dependency version: ${key}=${val}`);
      delete deps[key];
    }
  }
}

export function normalizePackageName(name: string): string {
  return UIPATH_PACKAGE_ALIAS_MAP[name] || name;
}

export interface DependencyResolutionResult {
  deps: Record<string, string>;
  warnings: Array<{ code: string; message: string; stage: string; recoverable: boolean; affectedFiles?: string[] }>;
  specPredictedPackages: Set<string>;
}

function collectActivityTemplatesFromNode(node: TreeWorkflowNode): string[] {
  const templates: string[] = [];
  if (node.kind === "activity") {
    templates.push(node.template);
  } else if (node.kind === "sequence" && node.children) {
    for (const child of node.children) {
      templates.push(...collectActivityTemplatesFromNode(child));
    }
  } else if (node.kind === "tryCatch") {
    for (const child of [...(node.tryChildren || []), ...(node.catchChildren || []), ...(node.finallyChildren || [])]) {
      templates.push(...collectActivityTemplatesFromNode(child));
    }
  } else if (node.kind === "if") {
    for (const child of [...(node.thenChildren || []), ...(node.elseChildren || [])]) {
      templates.push(...collectActivityTemplatesFromNode(child));
    }
  } else if (node.kind === "while" || node.kind === "forEach" || node.kind === "retryScope") {
    for (const child of (node.bodyChildren || [])) {
      templates.push(...collectActivityTemplatesFromNode(child));
    }
  }
  return templates;
}

function collectActivityTemplatesFromSpec(spec: TreeWorkflowSpec): Set<string> {
  const templates = new Set<string>();
  templates.add("LogMessage");
  if (spec.rootSequence?.children) {
    for (const child of spec.rootSequence.children) {
      for (const t of collectActivityTemplatesFromNode(child)) {
        templates.add(t);
      }
    }
  }
  return templates;
}

function collectActivityTypesFromWorkflows(workflows: Array<{ steps?: Array<{ activityType?: string; activityPackage?: string }> }>): Set<string> {
  const packages = new Set<string>();
  packages.add("UiPath.System.Activities");
  for (const wf of workflows) {
    for (const step of wf.steps || []) {
      if (step.activityPackage) {
        packages.add(step.activityPackage);
      }
      if (step.activityType) {
        const pkg = catalogService.getPackageForActivity(step.activityType);
        if (pkg) {
          packages.add(pkg);
        } else {
          const registryPkg = getActivityPackage(step.activityType);
          if (registryPkg) {
            packages.add(registryPkg);
            console.log(`[Dependency Resolution] Proactively resolved ${step.activityType} → ${registryPkg} via activity registry (catalog miss)`);
          }
        }
      }
    }
  }
  return packages;
}

/**
 * Speculative dependency resolution based on planning metadata, tree specs, and keyword matching.
 * NON-AUTHORITATIVE: This function is used for cache fingerprinting and early estimation only.
 * The authoritative dependency set is produced by PostEmissionDependencyAnalyzer after XAML emission.
 * If PostEmissionDependencyAnalyzer is unavailable, this function's output may be used as a named fallback
 * with the event recorded in the diagnostics artifact.
 */
export function resolveDependencies(
  pkg: { workflows?: Array<{ name?: string; steps?: Array<{ activityType?: string; activityPackage?: string }> }> },
  studioProfile: StudioProfile | null,
  treeSpecs: TreeWorkflowSpec | TreeWorkflowSpec[] | null,
  targetFramework?: "Windows" | "Portable",
  xamlContentSources?: string[],
): DependencyResolutionResult {
  const deps: Record<string, string> = {};
  const warnings: DependencyResolutionResult["warnings"] = [];
  const referencedPackages = new Set<string>();
  const specPredictedPackages = new Set<string>();
  const tf = targetFramework || (studioProfile?.targetFramework) || "Windows";

  referencedPackages.add("UiPath.System.Activities");

  const specArray: TreeWorkflowSpec[] = treeSpecs
    ? (Array.isArray(treeSpecs) ? treeSpecs : [treeSpecs])
    : [];

  const NEWTONSOFT_TRIGGER_ACTIVITIES = new Set(["DeserializeJson", "SerializeJson", "HttpClient", "DeserializeJsonArray"]);
  const NEWTONSOFT_TYPE_PATTERNS = ["JObject", "JToken", "JArray", "JValue", "JsonConvert", "Newtonsoft"];

  for (const treeSpec of specArray) {
    const activityTemplates = collectActivityTemplatesFromSpec(treeSpec);
    for (const template of activityTemplates) {
      let pkgId = catalogService.getPackageForActivity(template);
      if (!pkgId) {
        pkgId = getActivityPackage(template) || null;
        if (pkgId) {
          console.log(`[Dependency Resolution] Proactively resolved tree spec activity ${template} → ${pkgId} via registry fallback`);
        }
      }
      if (pkgId) {
        const normalized = normalizePackageName(pkgId);
        referencedPackages.add(normalized);
        specPredictedPackages.add(normalized);
      }
      if (NEWTONSOFT_TRIGGER_ACTIVITIES.has(template)) {
        referencedPackages.add("Newtonsoft.Json");
        specPredictedPackages.add("Newtonsoft.Json");
        console.log(`[Dependency Resolution] Proactively added Newtonsoft.Json — spec references JSON activity "${template}"`);
      }
    }

    const specJson = JSON.stringify(treeSpec);
    for (const typePattern of NEWTONSOFT_TYPE_PATTERNS) {
      if (specJson.includes(typePattern)) {
        referencedPackages.add("Newtonsoft.Json");
        specPredictedPackages.add("Newtonsoft.Json");
        console.log(`[Dependency Resolution] Proactively added Newtonsoft.Json — spec contains type reference "${typePattern}"`);
        break;
      }
    }
  }

  const PROACTIVE_COMMON_PACKAGES: Record<string, string[]> = {
    "UiPath.UIAutomation.Activities": ["Click", "TypeInto", "GetText", "OpenBrowser", "CloseBrowser", "NavigateTo", "CloseApplication", "KillProcess", "TakeScreenshot", "UseApplicationBrowser", "OpenApplication", "AttachBrowser", "AttachWindow", "FindElement", "ElementExists", "HighlightElement", "SetText", "SendHotkey", "SelectItem", "Check", "GetAttribute", "WaitElementVanish", "LogMessage", "RetryScope", "GetAsset", "GetCredential", "AddQueueItem", "GetTransactionItem", "SetTransactionStatus", "InvokeWorkflowFile", "ReadTextFile", "WriteTextFile", "PathExists", "AddLogFields", "Comment", "ShouldRetry"],
    "UiPath.Mail.Activities": ["SendSmtpMailMessage", "GetImapMailMessages", "GetOutlookMailMessages", "SendOutlookMailMessage", "GetPop3MailMessages", "ForwardMailMessage", "ReplyToMailMessage", "SaveMailMessage", "ReadMail", "SendMail", "GetMail", "ClassifyEmail", "GetImapMailMessage"],
    "UiPath.Excel.Activities": ["ExcelApplicationScope", "ReadRange", "WriteRange", "ReadCell", "WriteCell", "AppendRange", "InsertDeleteColumns", "InsertDeleteRows", "ExcelReadRange", "ExcelWriteRange", "ExcelReadCell", "ExcelWriteCell", "UseExcel"],
    "UiPath.Persistence.Activities": ["CreateFormTask", "WaitForFormTask", "ResumeFormTask", "FormTaskAction", "GetFormTaskData", "SetFormTaskData", "WaitForFormTaskAndResume"],
    "UiPath.Database.Activities": ["DatabaseConnect", "DatabaseDisconnect", "ExecuteQuery", "ExecuteNonQuery", "InsertDataTable", "ConnectToDatabase"],
    "UiPath.WebAPI.Activities": ["HttpClient", "DeserializeJson", "SerializeJson", "DeserializeJSON", "HttpClientRequest", "DownloadFile"],
    "UiPath.ComplexScenarios.Activities": ["MultipleAssign", "WaitForDownload", "RepeatUntil", "BuildDataTable", "FilterDataTable", "SortDataTable", "RemoveDuplicateRows", "JoinDataTables", "OutputDataTable", "AddDataRow", "RemoveDataRow", "LookupDataTable"],
  };

  for (const treeSpec of specArray) {
    const specStr = JSON.stringify(treeSpec);
    for (const [pkgName, triggers] of Object.entries(PROACTIVE_COMMON_PACKAGES)) {
      for (const trigger of triggers) {
        if (specStr.includes(trigger)) {
          const normalized = normalizePackageName(pkgName);
          if (!referencedPackages.has(normalized)) {
            referencedPackages.add(normalized);
            specPredictedPackages.add(normalized);
            console.log(`[Dependency Resolution] Proactively added ${pkgName} — spec references activity "${trigger}"`);
          }
          break;
        }
      }
    }
  }

  if (specArray.length === 0 && pkg.workflows) {
    for (const wf of pkg.workflows) {
      for (const step of wf.steps || []) {
        const actType = step.activityType;
        if (!actType) continue;
        for (const [pkgName, triggers] of Object.entries(PROACTIVE_COMMON_PACKAGES)) {
          if (triggers.includes(actType)) {
            const normalized = normalizePackageName(pkgName);
            if (!referencedPackages.has(normalized)) {
              referencedPackages.add(normalized);
              specPredictedPackages.add(normalized);
              console.log(`[Dependency Resolution] Proactively added ${pkgName} — workflow step references activity "${actType}"`);
            }
            break;
          }
        }
      }
    }
  }

  if (xamlContentSources && xamlContentSources.length > 0) {
    for (const xamlContent of xamlContentSources) {
      for (const [pkgName, triggers] of Object.entries(PROACTIVE_COMMON_PACKAGES)) {
        for (const trigger of triggers) {
          if (xamlContent.includes(trigger)) {
            const normalized = normalizePackageName(pkgName);
            if (!referencedPackages.has(normalized)) {
              referencedPackages.add(normalized);
              specPredictedPackages.add(normalized);
              console.log(`[Dependency Resolution] Proactively added ${pkgName} — XAML content references activity "${trigger}"`);
            }
            break;
          }
        }
      }
    }
  }

  if (pkg.workflows) {
    const legacyPackages = collectActivityTypesFromWorkflows(pkg.workflows);
    for (const p of legacyPackages) {
      referencedPackages.add(normalizePackageName(p));
    }
  }

  if (studioProfile) {
    for (const requiredPkg of studioProfile.minimumRequiredPackages) {
      referencedPackages.add(normalizePackageName(requiredPkg));
    }
  }

  Array.from(referencedPackages).forEach(fwAsm => {
    if (isFrameworkAssembly(fwAsm)) {
      referencedPackages.delete(fwAsm);
      console.log(`[Dependency Resolution] Excluded framework assembly from dependencies: ${fwAsm}`);
    }
  });

  const packageProvenance: Record<string, { activities: string[]; workflows: string[] }> = {};
  if (pkg.workflows) {
    for (const wf of pkg.workflows) {
      const wfName = wf.name || "unknown-workflow";
      for (const step of wf.steps || []) {
        const pkgs: string[] = [];
        if (step.activityPackage) pkgs.push(normalizePackageName(step.activityPackage));
        if (step.activityType) {
          const resolved = catalogService.getPackageForActivity(step.activityType);
          if (resolved) pkgs.push(normalizePackageName(resolved));
        }
        for (const p of pkgs) {
          if (!packageProvenance[p]) packageProvenance[p] = { activities: [], workflows: [] };
          if (step.activityType && !packageProvenance[p].activities.includes(step.activityType)) {
            packageProvenance[p].activities.push(step.activityType);
          }
          if (!packageProvenance[p].workflows.includes(wfName)) {
            packageProvenance[p].workflows.push(wfName);
          }
        }
      }
    }
  }

  for (const rawPkgName of referencedPackages) {
    const pkgName = normalizePackageName(rawPkgName);
    if (isFrameworkAssembly(pkgName)) {
      console.log(`[Dependency Resolution] Excluded framework assembly (post-normalize) from dependencies: ${pkgName}`);
      continue;
    }
    let version: string | null = null;
    let source: string = "";

    const preferred = getPreferredVersionFromMeta(pkgName);
    if (preferred) {
      version = preferred;
      source = "generation-metadata";
    }

    if (!version && catalogService.isLoaded()) {
      const catalogVersion = catalogService.getConfirmedVersion(pkgName);
      if (catalogVersion) {
        version = catalogVersion;
        source = "catalog";
      }
    }

    if (!version) {
      const prov = packageProvenance[pkgName];
      const activityInfo = prov?.activities.length ? ` Referenced by activities: [${prov.activities.join(", ")}].` : "";
      const workflowInfo = prov?.workflows.length ? ` Found in workflows: [${prov.workflows.join(", ")}].` : "";
      const layersChecked = [
        "generation-metadata (packageVersionRanges): no match",
        catalogService.isLoaded() ? "activity-catalog (getConfirmedVersion): no match" : "activity-catalog: not loaded",
      ].join("; ");
      throw new Error(
        `[Dependency Resolution] FATAL: Package "${pkgName}" is referenced by activities but has no validated version.${activityInfo}${workflowInfo} ` +
        `Authority layers checked: [${layersChecked}]. ` +
        `Cannot emit a fabricated version — build aborted. Add this package to the generation-metadata.json packageVersionRanges to resolve.`
      );
    }

    deps[pkgName] = version;
  }

  const basePackages = new Set<string>([
    "UiPath.System.Activities",
  ]);
  if (studioProfile) {
    for (const requiredPkg of studioProfile.minimumRequiredPackages) {
      basePackages.add(normalizePackageName(requiredPkg));
    }
  }

  const prunedPackages: string[] = [];
  for (const pkgName of Object.keys(deps)) {
    if (basePackages.has(pkgName)) continue;
    const prov = packageProvenance[pkgName];
    const hasActivityReference = prov && prov.activities.length > 0;
    const hasSpecPrediction = specPredictedPackages.has(pkgName);
    if (!hasActivityReference && !hasSpecPrediction) {
      prunedPackages.push(pkgName);
      delete deps[pkgName];
    }
  }
  if (prunedPackages.length > 0) {
    console.log(`[Dependency Resolution] Pruned ${prunedPackages.length} unreferenced packages: ${prunedPackages.join(", ")}`);
    warnings.push({
      code: "PRUNED_UNREFERENCED_PACKAGES",
      message: `Removed ${prunedPackages.length} packages not referenced by any activity: ${prunedPackages.join(", ")}`,
      stage: "dependency-resolution",
      recoverable: true,
    });
  }

  validateAndEnforceDependencyCompatibility(deps, warnings);

  console.log(`[Dependency Resolution] Resolved ${Object.keys(deps).length} dependencies proactively from ${referencedPackages.size} referenced packages (${specPredictedPackages.size} spec-predicted)`);
  return { deps, warnings, specPredictedPackages };
}

type CachedStageEnrichment = {
  fingerprint: string;
  enrichment: EnrichmentResult | null;
  treeEnrichment: TreeEnrichmentResult | null;
  usedAIFallback: boolean;
};

type CachedStageXaml = {
  fingerprint: string;
  xamlEntries: { name: string; content: string }[];
  gaps: XamlGap[];
  usedPackages: string[];
  dependencyMap: Record<string, string>;
  archiveManifest: string[];
  referencedMLSkillNames: string[];
  projectJsonContent?: string;
  configCsv?: string;
  targetFramework?: string;
  automationPattern?: string;
  buffer: Buffer;
};

type CachedStageQualityGate = {
  fingerprint: string;
  qualityGatePassed: boolean;
  qualityGateResult?: QualityGateResult;
};

type CachedBuild = {
  overallFingerprint: string;
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
  stageEnrichment?: CachedStageEnrichment;
  stageXaml?: CachedStageXaml;
  stageQualityGate?: CachedStageQualityGate;
  complexityTier?: string;
  outcomeReport?: PipelineOutcomeReport;
  propertySerializationTrace?: import("./pipeline-trace-collector").PropertySerializationTraceEntry[];
  invokeContractTrace?: import("./pipeline-trace-collector").InvokeContractTraceEntry[];
  stageHashParity?: import("./pipeline-trace-collector").StageHashParityEntry[];
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
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Data;assembly=System.Data"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <TextExpression.NamespacesForImplementation>
    <sco:Collection x:TypeArguments="x:String">
      <x:String>System</x:String>
      <x:String>System.Collections</x:String>
      <x:String>System.Collections.Generic</x:String>
      <x:String>System.Data</x:String>
      <x:String>System.IO</x:String>
      <x:String>System.Linq</x:String>
      <x:String>System.Xml</x:String>
      <x:String>System.Xml.Linq</x:String>
      <x:String>UiPath.Core</x:String>
      <x:String>UiPath.Core.Activities</x:String>
      <x:String>Microsoft.VisualBasic</x:String>
      <x:String>Microsoft.VisualBasic.Activities</x:String>
      <x:String>System.Activities</x:String>
      <x:String>System.Activities.Statements</x:String>
      <x:String>System.Activities.Expressions</x:String>
      <x:String>System.ComponentModel</x:String>
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <TextExpression.ReferencesForImplementation>
    <sco:Collection x:TypeArguments="AssemblyReference">
      <AssemblyReference>System.Activities</AssemblyReference>
      <AssemblyReference>System.Activities.Core.Presentation</AssemblyReference>
      <AssemblyReference>Microsoft.VisualBasic</AssemblyReference>
      <AssemblyReference>mscorlib</AssemblyReference>
      <AssemblyReference>System.Data</AssemblyReference>
      <AssemblyReference>System</AssemblyReference>
      <AssemblyReference>System.Core</AssemblyReference>
      <AssemblyReference>System.Xml</AssemblyReference>
      <AssemblyReference>System.Xml.Linq</AssemblyReference>
      <AssemblyReference>UiPath.Core</AssemblyReference>
      <AssemblyReference>UiPath.Core.Activities</AssemblyReference>
      <AssemblyReference>UiPath.System.Activities</AssemblyReference>
      <AssemblyReference>UiPath.UIAutomation.Activities</AssemblyReference>
      <AssemblyReference>System.ServiceModel</AssemblyReference>
      <AssemblyReference>System.ComponentModel.Composition</AssemblyReference>
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>
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
  StructuralPreservationMetrics,
  PerWorkflowStudioCompatibility,
  StudioCompatibilityLevel,
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
  dependencyWarnings?: Array<{ code: string; message: string; stage: string; recoverable: boolean; affectedFiles?: string[] }>;
  emissionGateWarnings?: Array<{ code: string; message: string; file: string; line?: number; type: string }>;
  usedAIFallback: boolean;
  outcomeReport?: PipelineOutcomeReport;
  projectJsonContent?: string;
  dependencyDiagnostics?: DependencyDiagnosticsArtifact;
  dependencyGaps?: Array<{ activityTag: string; fileName: string; detail: string }>;
  ambiguousResolutions?: Array<{ activityTag: string; candidatePackages: string[]; fileName: string }>;
  orphanDependencies?: Array<{ packageId: string; version: string | null; reason: string }>;
  propertySerializationTrace?: import("./pipeline-trace-collector").PropertySerializationTraceEntry[];
  invokeContractTrace?: import("./pipeline-trace-collector").InvokeContractTraceEntry[];
  stageHashParity?: import("./pipeline-trace-collector").StageHashParityEntry[];
};

export function fixMixedLiteralExpressionSyntax(content: string): { content: string; fixes: string[] } {
  const fixes: string[] = [];
  const attrPattern = /((?:Message|Default|Value)=")([^"]+)(")/g;

  const result = content.replace(attrPattern, (match, prefix, val, suffix) => {
    if (!val.includes("[") || !val.includes("]")) return match;
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.substring(1, val.length - 1);
      let innerDepth = 0;
      let isFullyBracketed = true;
      for (let ci = 0; ci < inner.length; ci++) {
        if (inner[ci] === "[") innerDepth++;
        else if (inner[ci] === "]") {
          if (innerDepth === 0) { isFullyBracketed = false; break; }
          innerDepth--;
        }
      }
      if (isFullyBracketed) return match;
    }

    const hasLiteralBeforeBracket = /^[^[&\d]/.test(val) &&
      !val.startsWith("True") && !val.startsWith("False") &&
      !val.startsWith("Nothing") && !val.startsWith("PLACEHOLDER");
    const hasLiteralAfterBracket = val.startsWith("[") && !val.endsWith("]");
    const hasBracketThenLiteralThenBracket = val.startsWith("[") && val.endsWith("]") && !hasLiteralBeforeBracket;
    if (!hasLiteralBeforeBracket && !hasLiteralAfterBracket && !hasBracketThenLiteralThenBracket) return match;

    const bracketSegments: { start: number; end: number; content: string }[] = [];
    let depth = 0;
    let segStart = -1;
    for (let i = 0; i < val.length; i++) {
      if (val[i] === "[") {
        if (depth === 0) segStart = i;
        depth++;
      } else if (val[i] === "]") {
        depth--;
        if (depth === 0 && segStart >= 0) {
          bracketSegments.push({ start: segStart, end: i, content: val.substring(segStart + 1, i) });
          segStart = -1;
        } else if (depth < 0) {
          return match;
        }
      }
    }
    if (depth !== 0) return match;
    if (bracketSegments.length === 0) return match;

    const vbExpressionPattern = /^[a-zA-Z_]\w*(\.\w+)*(\(.*\))?(\.\w+(\(.*\))?)*$/;
    for (const seg of bracketSegments) {
      if (seg.content.length === 0) return match;
      const decoded = seg.content.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      const trimmed = decoded.trim();
      if (!vbExpressionPattern.test(trimmed)) return match;
      const looksLikeVbExpression = trimmed.includes("_") || trimmed.includes(".") || trimmed.includes("(");
      if (!looksLikeVbExpression) return match;
    }

    const vbOperatorPattern = /[+\-*/%=<>^\\]/;
    const parts: string[] = [];
    let lastIdx = 0;
    for (const seg of bracketSegments) {
      if (seg.start > lastIdx) {
        const literal = val.substring(lastIdx, seg.start);
        if (literal.includes("&quot;") || literal.includes("&amp;")) return match;
        if (vbOperatorPattern.test(literal.trim())) return match;
        parts.push(`&quot;${literal}&quot;`);
      }
      parts.push(seg.content);
      lastIdx = seg.end + 1;
    }
    if (lastIdx < val.length) {
      const literal = val.substring(lastIdx);
      if (literal.includes("&quot;") || literal.includes("&amp;")) return match;
      if (vbOperatorPattern.test(literal.trim())) return match;
      parts.push(`&quot;${literal}&quot;`);
    }

    const corrected = `[${parts.join(" &amp; ")}]`;
    fixes.push(`${val} → ${corrected}`);
    return prefix + corrected + suffix;
  });

  return { content: result, fixes };
}

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

function extractVariablesFromSDD(sddContent: string): Array<{ name: string; type: string; default?: string }> {
  const vars: Array<{ name: string; type: string; default?: string }> = [];
  const seen = new Set<string>();

  const queueMatch = sddContent.match(/queue[:\s]+["']?([A-Za-z_]\w*)["']?/i);
  if (queueMatch && !seen.has("str_QueueName")) {
    vars.push({ name: "str_QueueName", type: "String", default: `"${queueMatch[1]}"` });
    seen.add("str_QueueName");
  }

  const assetRegex = /asset[:\s]+["']?([A-Za-z_]\w*)["']?/gi;
  let assetMatch;
  while ((assetMatch = assetRegex.exec(sddContent)) !== null) {
    const varName = `str_Asset_${assetMatch[1]}`;
    if (!seen.has(varName)) {
      vars.push({ name: varName, type: "String", default: `"${assetMatch[1]}"` });
      seen.add(varName);
    }
  }

  const configMatch = sddContent.match(/config\s*(?:file|path|sheet)[:\s]+["']?([^\s"']+)["']?/i);
  if (configMatch && !seen.has("str_ConfigPath")) {
    vars.push({ name: "str_ConfigPath", type: "String", default: `"${configMatch[1]}"` });
    seen.add("str_ConfigPath");
  }

  const urlRegex = /(?:url|endpoint)[:\s]+["']?(https?:\/\/[^\s"']+)["']?/gi;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(sddContent)) !== null) {
    const varName = `str_URL`;
    if (!seen.has(varName)) {
      vars.push({ name: varName, type: "String", default: `"${urlMatch[1]}"` });
      seen.add(varName);
    }
  }

  return vars;
}


function buildDeterministicScaffold(
  processNodes: any[],
  projectName: string,
  sddContent?: string,
  processEdges?: any[],
): { treeEnrichment: TreeEnrichmentResult; usedAIFallback: boolean; allTreeEnrichments?: Map<string, { spec: TreeWorkflowSpec; processType: ProcessType }> } {
  return buildGenericDeterministicScaffold(processNodes, projectName, sddContent, processEdges, extractVariablesFromSDD);
}



export async function buildNuGetPackage(pkg: UiPathPackage, version: string = "1.0.0", ideaId?: string, generationMode: GenerationMode = "full_implementation", onProgress?: (event: { type: "started" | "heartbeat" | "completed" | "warning" | "failed"; stage: string; message: string }) => void, studioProfile?: StudioProfile | null, complexityTier?: ComplexityTier): Promise<BuildResult> {
  return runWithTraceContext(() => buildNuGetPackageImpl(pkg, version, ideaId, generationMode, onProgress, studioProfile, complexityTier));
}

async function buildNuGetPackageImpl(pkg: UiPathPackage, version: string = "1.0.0", ideaId?: string, generationMode: GenerationMode = "full_implementation", onProgress?: (event: { type: "started" | "heartbeat" | "completed" | "warning" | "failed"; stage: string; message: string }) => void, studioProfile?: StudioProfile | null, complexityTier?: ComplexityTier): Promise<BuildResult> {
  if (!catalogService.isLoaded()) {
    console.warn(`[Package Assembler] Catalog not loaded at buildNuGetPackage entry — attempting synchronous load`);
    try {
      catalogService.load();
    } catch (err: any) {
      console.error(`[Package Assembler] Catalog load failed at entry: ${err.message}`);
    }
    if (!catalogService.isLoaded()) {
      const reason = catalogService.getLastLoadError?.() || "unknown";
      const msg = `Activity catalog could not be loaded — build aborted. Reason: ${reason}`;
      console.error(`[Package Assembler] FATAL: ${msg}`);
      throw new Error(`[Package Assembler] ${msg}`);
    }
  }

  const _probeCacheSnapshot = await getProbeCache();
  const _studioProfile = studioProfile !== undefined ? studioProfile : catalogService.getStudioProfile();
  const projectName = (pkg.projectName || "Automation").replace(/\s+/g, "_");
  const sddContent = pkg.internal?.sddContent || "";
  const orchestratorArtifacts = pkg.internal?.orchestratorArtifacts || null;
  const processNodes = pkg.internal?.processNodes || [];
  const processEdges = pkg.internal?.processEdges || [];

  let fingerprint: string | undefined;
  const buildCacheKey = ideaId ? `${ideaId}:${generationMode}` : undefined;
  const forceRebuild = !!pkg.internal?.forceRebuild;
  const tierStr: string | undefined = complexityTier || pkg.internal?.complexityTier || undefined;
  const enrichmentFp = ideaId ? computeEnrichmentFingerprint(processNodes, processEdges, sddContent, orchestratorArtifacts, projectName, tierStr, pkg.workflows) : undefined;
  let cachedEntry: CachedBuild | undefined;
  if (ideaId && buildCacheKey) {
    fingerprint = computePackageFingerprint(pkg, sddContent, processNodes, processEdges, orchestratorArtifacts, UIPATH_PACKAGE_ALIAS_MAP, tierStr);
    cachedEntry = packageBuildCache.get(buildCacheKey);
    if (forceRebuild) {
      console.log(`[UiPath Cache] FORCE REBUILD requested for ${buildCacheKey} — bypassing all stage caches`);
      packageBuildCache.delete(buildCacheKey);
      cachedEntry = undefined;
    } else if (cachedEntry && cachedEntry.overallFingerprint === fingerprint && cachedEntry.version === version) {
      if (!cachedEntry.qualityGatePassed) {
        console.log(`[UiPath Cache] HIT for ${buildCacheKey} but quality gate was not passed — rebuilding`);
        packageBuildCache.delete(buildCacheKey);
        cachedEntry = packageBuildCache.get(buildCacheKey);
      } else {
        console.log(`[UiPath Cache] FULL HIT for ${buildCacheKey} — all stages cached (enrichment, XAML, quality gate)`);
        return { buffer: cachedEntry.buffer, gaps: cachedEntry.gaps, usedPackages: cachedEntry.usedPackages, cacheHit: true, qualityGateResult: cachedEntry.qualityGateResult, xamlEntries: cachedEntry.xamlEntries, dependencyMap: cachedEntry.dependencyMap, archiveManifest: cachedEntry.archiveManifest, usedFallbackStubs: false, generationMode, referencedMLSkillNames: cachedEntry.referencedMLSkillNames || [], usedAIFallback: cachedEntry.usedAIFallback || false, projectJsonContent: cachedEntry.projectJsonContent, outcomeReport: cachedEntry.outcomeReport, propertySerializationTrace: cachedEntry.propertySerializationTrace, invokeContractTrace: cachedEntry.invokeContractTrace, stageHashParity: cachedEntry.stageHashParity };
      }
    } else if (cachedEntry) {
      const enrichHit = cachedEntry.stageEnrichment && cachedEntry.stageEnrichment.fingerprint === enrichmentFp;
      const reasons: string[] = [];
      if (cachedEntry.overallFingerprint !== fingerprint) reasons.push("overall fingerprint changed");
      if (cachedEntry.version !== version) reasons.push(`version changed (${cachedEntry.version} → ${version})`);
      if (cachedEntry.complexityTier !== tierStr) reasons.push(`complexity tier changed (${cachedEntry.complexityTier || "none"} → ${tierStr || "none"})`);
      console.log(`[UiPath Cache] PARTIAL for ${buildCacheKey} — ${reasons.join(", ")}${enrichHit ? "; enrichment stage still valid" : "; enrichment stage invalidated"}`);
    } else {
      console.log(`[UiPath Cache] MISS for ${buildCacheKey} (no cache)`);
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
  let allTreeEnrichments: Map<string, { spec: TreeWorkflowSpec; processType: ProcessType }> = new Map();
  let _usedAIFallback = false;
  if (generationMode === "baseline_openable") {
    console.log(`[UiPath] baseline_openable mode — skipping AI enrichment, using flat scaffold`);
  } else {
    const hasDecomposedSpecs = pkg.workflows && pkg.workflows.length > 0 &&
      pkg.workflows.some(w => w.steps && w.steps.length > 0);
    let mappedTreeFallback: typeof treeEnrichment = null;
    let mappedAllTreeEnrichments: typeof allTreeEnrichments | null = null;
    if (hasDecomposedSpecs) {
      try {
        const { mapPackageSpecToTreeEnrichments } = await import("./spec-to-tree-mapper");
        const mapped = mapPackageSpecToTreeEnrichments(pkg);
        if (mapped.size > 0) {
          mappedAllTreeEnrichments = mapped;
          const mainEntry = mapped.get("Main") || mapped.values().next().value;
          if (mainEntry) {
            mappedTreeFallback = { status: "success", workflowSpec: mainEntry.spec, processType: mainEntry.processType };
          }
          const wfNames = Array.from(mapped.keys());
          console.log(`[UiPath] Mapped ${mapped.size} decomposed spec(s) to tree enrichments (held as fallback for AI refinement): ${wfNames.join(", ")}`);
          if (onProgress) onProgress({ type: "completed", stage: "spec_mapping", message: `Mapped ${mapped.size} decomposed spec(s) — proceeding to AI enrichment refinement` });
        }
      } catch (err: any) {
        console.log(`[UiPath] Spec-to-tree mapping failed: ${err.message} — continuing with normal enrichment`);
      }
    }

    const canReuseEnrichment = !treeEnrichment && !forceRebuild && cachedEntry?.stageEnrichment && enrichmentFp && cachedEntry.stageEnrichment.fingerprint === enrichmentFp;
    if (canReuseEnrichment) {
      enrichment = cachedEntry!.stageEnrichment!.enrichment;
      treeEnrichment = cachedEntry!.stageEnrichment!.treeEnrichment;
      _usedAIFallback = cachedEntry!.stageEnrichment!.usedAIFallback;
      if (enrichment || treeEnrichment) {
        console.log(`[UiPath Cache] Enrichment cache HIT — enrichment fingerprint unchanged (reusing ${enrichment ? `legacy enrichment with ${enrichment.nodes.length} nodes` : "tree enrichment"})`);
      } else {
        console.log(`[UiPath Cache] Enrichment cache HIT — previously attempted, cached as null`);
      }
    } else if (!treeEnrichment && cachedEntry?.stageEnrichment && enrichmentFp) {
      console.log(`[UiPath Cache] Enrichment cache MISS — enrichment fingerprint changed`);
    }
    if (!treeEnrichment && !canReuseEnrichment && processNodes.length > 0 && sddContent) {
      try {
        const isSimpleTier = complexityTier === "simple";
        const enrichmentLabel = mappedAllTreeEnrichments ? "AI refinement of mapped specs" : (isSimpleTier ? "single-pass" : "tree-based");
        const nodeCount = processNodes.filter(n => n.nodeType !== "start" && n.nodeType !== "end").length;
        const treeTimeout = isSimpleTier ? 60000 : (nodeCount >= 12 ? 180000 : 120000);
        console.log(`[UiPath] Requesting ${enrichmentLabel} AI enrichment for ${processNodes.length} process nodes${mappedAllTreeEnrichments ? ` (refining ${mappedAllTreeEnrichments.size} pre-mapped specs)` : ""}${isSimpleTier ? " (simple tier — no retry)" : ""} (timeout: ${treeTimeout}ms)...`);
        if (onProgress) onProgress({ type: "started", stage: "ai_enrichment_tree", message: `Starting ${enrichmentLabel} AI enrichment` });
        const treeHeartbeat = onProgress ? setInterval(() => {
          onProgress({ type: "heartbeat", stage: "ai_enrichment_tree", message: isSimpleTier ? "AI is generating workflow structure (streamlined)..." : "AI is building the workflow tree structure — this may take a minute for complex processes..." });
        }, 10000) : null;
        try {
          const treeResult = await enrichWithAITree(
            processNodes,
            processEdges,
            sddContent,
            orchestratorArtifacts,
            projectName,
            treeTimeout,
            automationPattern,
            isSimpleTier,
            mappedAllTreeEnrichments || undefined,
          );
          if (treeResult && treeResult.status === "success") {
            treeEnrichment = treeResult;
            if (mappedAllTreeEnrichments && mappedAllTreeEnrichments.size > 0) {
              allTreeEnrichments = new Map(mappedAllTreeEnrichments);
              const aiMainName = treeResult.workflowSpec.name || "Main";
              allTreeEnrichments.set(aiMainName, { spec: treeResult.workflowSpec, processType: treeResult.processType });
              console.log(`[UiPath] Tree enrichment successful: AI refined "${aiMainName}" (${treeResult.workflowSpec.variables.length} variables), preserving ${mappedAllTreeEnrichments.size} mapped workflow decomposition(s)`);
            } else {
              console.log(`[UiPath] Tree enrichment successful: "${treeResult.workflowSpec.name}", ${treeResult.workflowSpec.variables.length} variables`);
            }
            if (onProgress) onProgress({ type: "completed", stage: "ai_enrichment_tree", message: `Tree enrichment complete — ${treeResult.workflowSpec.variables.length} variables mapped` });
          } else if (treeResult && treeResult.status === "validation_failed") {
            const errorSummary = treeResult.validationErrors.join("; ");
            console.log(`[UiPath] Tree enrichment validation failed: ${errorSummary} — ${mappedTreeFallback ? "falling back to mapped specs" : "falling through to deterministic scaffold"}`);
            if (onProgress) onProgress({ type: "warning", stage: "ai_enrichment_tree", message: `Tree enrichment validation failed — ${mappedTreeFallback ? "using mapped spec fallback" : "falling back to deterministic scaffold"}` });
          }
        } finally {
          if (treeHeartbeat) clearInterval(treeHeartbeat);
        }
      } catch (err: any) {
        console.log(`[UiPath] Tree enrichment error: ${err.message} — ${mappedTreeFallback ? "falling back to mapped specs" : "falling back to deterministic scaffold"}`);
        if (onProgress) onProgress({ type: "warning", stage: "ai_enrichment_tree", message: `Tree enrichment failed — ${mappedTreeFallback ? "using mapped spec fallback" : "falling back to deterministic scaffold"}` });
      }

      if (!treeEnrichment && mappedTreeFallback) {
        console.log(`[UiPath] AI enrichment did not succeed — using mapped spec fallback with ${mappedAllTreeEnrichments?.size || 0} pre-mapped workflow(s)`);
        treeEnrichment = mappedTreeFallback;
        allTreeEnrichments = mappedAllTreeEnrichments || new Map();
        if (onProgress) onProgress({ type: "completed", stage: "ai_enrichment_tree", message: `Using mapped spec fallback — ${mappedAllTreeEnrichments?.size || 0} workflow(s)` });
      }

      if (!treeEnrichment && processNodes.length > 0) {
        console.log(`[UiPath] Tree enrichment failed — generating deterministic scaffold from ${processNodes.length} process nodes`);
        if (onProgress) onProgress({ type: "started", stage: "deterministic_scaffold", message: "Generating deterministic scaffold" });
        const scaffold = buildDeterministicScaffold(processNodes, projectName, sddContent || undefined, processEdges);
        treeEnrichment = scaffold.treeEnrichment;
        _usedAIFallback = scaffold.usedAIFallback;
        if (scaffold.allTreeEnrichments && scaffold.allTreeEnrichments.size > 0) {
          allTreeEnrichments = scaffold.allTreeEnrichments;
        }
        if (onProgress) onProgress({ type: "completed", stage: "deterministic_scaffold", message: "Deterministic scaffold generated" });
      }
    } else if (processNodes.length > 0 && !sddContent) {
      console.log(`[UiPath] No SDD content available — generating map-only deterministic scaffold from ${processNodes.length} process nodes`);
      const scaffold = buildDeterministicScaffold(processNodes, projectName, undefined, processEdges);
      treeEnrichment = scaffold.treeEnrichment;
      _usedAIFallback = scaffold.usedAIFallback;
      if (scaffold.allTreeEnrichments && scaffold.allTreeEnrichments.size > 0) {
        allTreeEnrichments = scaffold.allTreeEnrichments;
      }
    }
  }

  automationPattern = classifyAutomationPattern(
    processNodes,
    sddContent,
    hasQueues,
    enrichment?.useReFramework,
  );
  const modeConfig = selectGenerationMode(automationPattern, undefined, _studioProfile);
  generationMode = modeConfig.mode;
  let useReFramework = modeConfig.blockReFramework ? false : shouldUseReFramework(automationPattern);
  const genCtx: XamlGenerationContext = {
    generationMode,
    automationPattern,
    aiCenterSkills: pkg.internal?.aiCenterSkills || [],
    referencedMLSkillNames: [],
  };
  console.log(`[UiPath] Automation pattern: ${automationPattern}, generationMode: ${generationMode}, useReFramework: ${useReFramework}, reason: ${modeConfig.reason}`);

  if (!forceRebuild && cachedEntry && buildCacheKey) {
    const _earlyMetaTarget = _metadataService.getStudioTarget();
    const explicitFw = pkg.internal?.targetFramework;
    const earlyIsServerless = explicitFw === "Portable" || !!pkg.internal?.isServerless || (!explicitFw && !!(_probeCacheSnapshot?.serverlessDetected) && !_probeCacheSnapshot?.flags?.hasUnattendedSlots);
    const earlyTf: TargetFramework = _studioProfile ? _studioProfile.targetFramework : (_earlyMetaTarget?.targetFramework || (earlyIsServerless ? "Portable" : "Windows"));
    const earlyTreeSpecs: TreeWorkflowSpec[] = [];
    if (allTreeEnrichments.size > 0) {
      Array.from(allTreeEnrichments.values()).forEach(entry => earlyTreeSpecs.push(entry.spec));
    } else if (treeEnrichment?.status === "success") {
      earlyTreeSpecs.push(treeEnrichment.workflowSpec);
    }
    const earlyDepRes = resolveDependencies(pkg, _studioProfile, earlyTreeSpecs.length > 0 ? earlyTreeSpecs : null, earlyTf as "Windows" | "Portable");
    const currentDepMap = earlyDepRes.deps;
    const xamlFpCheck = computeXamlFingerprint(enrichment, treeEnrichment, pkg, orchestratorArtifacts, generationMode, tierStr, currentDepMap, earlyTf);
    const xamlStageHit = cachedEntry.stageXaml && cachedEntry.stageXaml.fingerprint === xamlFpCheck;
    const versionMatch = cachedEntry.version === version;
    if (xamlStageHit && !versionMatch) {
      console.log(`[UiPath Cache] XAML cache HIT but version changed (${cachedEntry.version} → ${version}) — must rebuild archive with new version metadata`);
    } else if (xamlStageHit) {
      const qgFpCheck = computeQualityGateFingerprint(
        cachedEntry.stageXaml!.xamlEntries,
        cachedEntry.stageXaml!.projectJsonContent || "",
        cachedEntry.stageXaml!.configCsv || "",
        orchestratorArtifacts,
        earlyTf,
        tierStr,
        automationPattern,
      );
      const qgStageHit = cachedEntry.stageQualityGate && cachedEntry.stageQualityGate.fingerprint === qgFpCheck && cachedEntry.stageQualityGate.qualityGatePassed;
      if (qgStageHit) {
        console.log(`[UiPath Cache] XAML cache HIT — XAML fingerprint unchanged (artifacts/enrichment stable)`);
        console.log(`[UiPath Cache] Quality gate cache HIT — QG fingerprint unchanged (XAML + validation inputs stable)`);
        console.log(`[UiPath Cache] All stages cached — returning cached result for ${buildCacheKey}`);
        return {
          buffer: cachedEntry.buffer,
          gaps: cachedEntry.gaps,
          usedPackages: cachedEntry.usedPackages,
          cacheHit: true,
          qualityGateResult: cachedEntry.qualityGateResult,
          xamlEntries: cachedEntry.xamlEntries,
          dependencyMap: cachedEntry.dependencyMap,
          archiveManifest: cachedEntry.archiveManifest,
          usedFallbackStubs: false,
          generationMode,
          referencedMLSkillNames: cachedEntry.referencedMLSkillNames || [],
          usedAIFallback: cachedEntry.usedAIFallback || false,
          projectJsonContent: cachedEntry.projectJsonContent,
          outcomeReport: cachedEntry.outcomeReport,
          propertySerializationTrace: cachedEntry.propertySerializationTrace,
          invokeContractTrace: cachedEntry.invokeContractTrace,
          stageHashParity: cachedEntry.stageHashParity,
        };
      } else {
        const qgReason = !cachedEntry.stageQualityGate
          ? "no cached QG stage"
          : !cachedEntry.stageQualityGate.qualityGatePassed
            ? "previous QG did not pass"
            : "QG fingerprint changed";
        console.log(`[UiPath Cache] XAML cache HIT — XAML fingerprint unchanged`);
        console.log(`[UiPath Cache] Quality gate cache MISS — ${qgReason}; re-running quality gate with cached XAML`);
        const cachedXaml = cachedEntry.stageXaml!;
        const rerunQG = runQualityGate({
          xamlEntries: cachedXaml.xamlEntries,
          projectJsonContent: cachedXaml.projectJsonContent || "",
          configData: cachedXaml.configCsv || "",
          orchestratorArtifacts,
          targetFramework: earlyTf as "Windows" | "Portable",
          archiveManifest: cachedXaml.archiveManifest,
          archiveContentHashes: {},
          automationPattern: (cachedXaml.automationPattern || "attended") as AutomationPattern,
        });
        if (rerunQG.passed) {
          console.log(`[UiPath Cache] Quality gate re-run PASSED — updating cache and returning cached XAML with fresh QG result`);
          const freshQgFp = computeQualityGateFingerprint(
            cachedXaml.xamlEntries,
            cachedXaml.projectJsonContent || "",
            cachedXaml.configCsv || "",
            orchestratorArtifacts,
            earlyTf,
            tierStr,
            automationPattern,
          );
          cachedEntry.qualityGatePassed = true;
          cachedEntry.qualityGateResult = rerunQG;
          cachedEntry.stageQualityGate = {
            fingerprint: freshQgFp,
            qualityGatePassed: true,
            qualityGateResult: rerunQG,
          };
          return {
            buffer: cachedXaml.buffer,
            gaps: cachedXaml.gaps,
            usedPackages: cachedXaml.usedPackages,
            cacheHit: true,
            qualityGateResult: rerunQG,
            xamlEntries: cachedXaml.xamlEntries,
            dependencyMap: cachedXaml.dependencyMap,
            archiveManifest: cachedXaml.archiveManifest,
            usedFallbackStubs: false,
            generationMode,
            referencedMLSkillNames: cachedXaml.referencedMLSkillNames || [],
            usedAIFallback: cachedEntry.usedAIFallback || false,
            projectJsonContent: cachedXaml.projectJsonContent,
            outcomeReport: cachedEntry.outcomeReport,
            propertySerializationTrace: cachedEntry.propertySerializationTrace,
            invokeContractTrace: cachedEntry.invokeContractTrace,
            stageHashParity: cachedEntry.stageHashParity,
          };
        } else {
          console.log(`[UiPath Cache] Quality gate re-run FAILED (${rerunQG.summary?.totalErrors || 0} error(s)) — proceeding with full rebuild`);
        }
      }
    } else {
      const xamlReason = !cachedEntry.stageXaml ? "no cached XAML stage" : "XAML fingerprint changed (enrichment or pkg spec changed)";
      console.log(`[UiPath Cache] XAML cache MISS — ${xamlReason}`);
      console.log(`[UiPath Cache] Quality gate cache MISS — upstream XAML stage invalidated`);
    }
  }

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
    const libPath = _studioProfile
      ? (_studioProfile.targetFramework === "Portable" ? "lib/net6.0" : "lib/net45")
      : (isServerless ? "lib/net6.0" : "lib/net45");
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

    const _metaTarget2 = _metadataService.getStudioTarget();
    const tf: TargetFramework = _studioProfile ? _studioProfile.targetFramework : (_metaTarget2?.targetFramework || (isServerless ? "Portable" : "Windows"));
    const allTreeSpecsForDeps: TreeWorkflowSpec[] = [];
    if (allTreeEnrichments.size > 0) {
      Array.from(allTreeEnrichments.values()).forEach(entry => {
        allTreeSpecsForDeps.push(entry.spec);
      });
    } else if (treeEnrichment?.status === "success") {
      allTreeSpecsForDeps.push(treeEnrichment.workflowSpec);
    }
    const priorCompliantXamlSources: string[] = [];
    if (allTreeSpecsForDeps.length === 0) {
      const priorWorkflows = pkg.internal?.priorCompliantWorkflows || [];
      for (const pw of priorWorkflows) {
        if (pw.content) priorCompliantXamlSources.push(pw.content);
      }
    }
    const depResolution = resolveDependencies(pkg, _studioProfile, allTreeSpecsForDeps.length > 0 ? allTreeSpecsForDeps : null, tf as "Windows" | "Portable", priorCompliantXamlSources.length > 0 ? priorCompliantXamlSources : undefined);
    const deps = depResolution.deps;
    const dependencyWarnings = depResolution.warnings;
    const proactivelyResolvedPackages = new Set(Object.keys(deps));
    const specPredictedPackages = depResolution.specPredictedPackages;

    const analysisReports: { fileName: string; report: AnalysisReport }[] = [];
    const xamlEntries: { name: string; content: string }[] = [];
    let deferredWrites: Map<string, string> = new Map<string, string>();
    const apEnabled = !!pkg.internal?.autopilotEnabled || !!(_probeCacheSnapshot?.flags?.autopilot);
    const earlyStubFallbacks: string[] = [];
    const complianceFallbacks: Array<{ file: string; reason: string; wasFullStub: boolean }> = [];
    const allPolicyBlocked: Array<{ file: string; activities: string[] }> = [];
    const collectedQualityIssues: DhgQualityIssue[] = [];
    const priorCompliantWorkflows = pkg.internal?.priorCompliantWorkflows || [];
    const priorCompliantMap = new Map<string, string>();
    if (priorCompliantWorkflows.length > 0) {
      for (const pw of priorCompliantWorkflows) {
        const shortName = pw.name.split("/").pop() || pw.name;
        const baseName = shortName.replace(/\.xaml$/i, "");
        priorCompliantMap.set(baseName, pw.content);
      }
      console.log(`[UiPath] ${priorCompliantMap.size} prior compliant workflow(s) available for reuse: ${Array.from(priorCompliantMap.keys()).join(", ")}`);
    }
    type CatalogPropertySnapshot = Map<string, Map<string, string>>;

    const COMPLIANCE_EXPECTED_TRANSFORMS: Record<string, Set<string>> = {
      "Assign": new Set(["To", "Value"]),
      "InvokeWorkflowFile": new Set(["Input", "Output"]),
    };

    function snapshotCatalogValidProperties(xml: string): CatalogPropertySnapshot {
      const snapshot: CatalogPropertySnapshot = new Map();
      const elementRegex = /<((?:[\w]+:)?[\w]+)(\s[^>]*?|\s*)(\/?>)/g;
      let elMatch;
      while ((elMatch = elementRegex.exec(xml)) !== null) {
        const fullTag = elMatch[1];
        if (fullTag.includes(".") || fullTag.startsWith("x:") || fullTag.startsWith("sap") || fullTag.startsWith("mc:")) continue;
        const className = fullTag.includes(":") ? fullTag.split(":").pop()! : fullTag;
        const schema = catalogService.getActivitySchema(className);
        if (!schema) continue;

        const expectedTransforms = COMPLIANCE_EXPECTED_TRANSFORMS[className];
        const attrString = elMatch[2];
        const attrRegex2 = /([\w]+(?:\.[\w]+)?)="([^"]*)"/g;
        let attrMatch;
        const validAttrs = new Map<string, string>();
        while ((attrMatch = attrRegex2.exec(attrString)) !== null) {
          if (attrMatch[1].startsWith("xmlns") || attrMatch[1].includes(":")) continue;
          const propName = attrMatch[1];
          if (expectedTransforms && expectedTransforms.has(propName)) continue;
          const propVal = attrMatch[2];
          const knownProp = schema.activity.properties.find(p => p.name === propName);
          if (knownProp && knownProp.xamlSyntax === "attribute") {
            validAttrs.set(propName, propVal);
          }
        }
        if (validAttrs.size > 0) {
          const key = `${fullTag}@${elMatch.index}`;
          snapshot.set(key, validAttrs);
        }
      }
      return snapshot;
    }

    function enforcePreCompliancePropertyProtection(preComplianceXml: string, postComplianceXml: string, snapshot: CatalogPropertySnapshot, fileName: string): string {
      if (snapshot.size === 0) return postComplianceXml;
      let result = postComplianceXml;
      let protectedCount = 0;
      let damagedCount = 0;

      Array.from(snapshot.entries()).forEach(([key, validAttrs]) => {
        const tagName = key.split("@")[0];
        Array.from(validAttrs.entries()).forEach(([propName, propVal]) => {
          const escapedPropName = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const escapedPropVal = propVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const attrPattern = new RegExp(`${escapedPropName}="${escapedPropVal}"`);
          if (attrPattern.test(result)) {
            protectedCount++;
            return;
          }
          damagedCount++;
          const escapedPropValXml = propVal.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const nsPrefix = tagName.includes(":") ? tagName.split(":")[0] + ":" : "";
          const localTag = tagName.includes(":") ? tagName.split(":")[1] : tagName;
          const childElPatterns = [
            new RegExp(`<${nsPrefix}${localTag}\\.${escapedPropName}>\\s*<(?:In|Out|InOut)Argument[^>]*>\\s*${escapedPropValXml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</(?:In|Out|InOut)Argument>\\s*</${nsPrefix}${localTag}\\.${escapedPropName}>`, "s"),
            new RegExp(`<${localTag}\\.${escapedPropName}>\\s*<(?:In|Out|InOut)Argument[^>]*>\\s*${escapedPropValXml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</(?:In|Out|InOut)Argument>\\s*</${localTag}\\.${escapedPropName}>`, "s"),
          ];
          let restored = false;
          for (const pat of childElPatterns) {
            const childMatch = pat.exec(result);
            if (childMatch) {
              const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const tagOpenPat = new RegExp(`<${escapedTag}\\s[^>]*?>`, "g");
              const searchRegion = result.substring(0, childMatch.index);
              let lastTagMatch: RegExpExecArray | null = null;
              let m;
              while ((m = tagOpenPat.exec(searchRegion)) !== null) {
                lastTagMatch = m;
              }
              if (lastTagMatch) {
                const childStr = childMatch[0];
                const childIdx = childMatch.index;
                result = result.substring(0, childIdx) + result.substring(childIdx + childStr.length);
                const tagOpenStr = lastTagMatch[0];
                const tagOpenEnd = lastTagMatch.index + tagOpenStr.length - 1;
                result = result.substring(0, tagOpenEnd) + ` ${propName}="${propVal}"` + result.substring(tagOpenEnd);
                restored = true;
                console.log(`[Compliance Preservation] ${fileName}: restored "${propName}" on <${tagName}> from child-element back to attribute form`);
              }
              break;
            }
          }
          if (!restored) {
            console.warn(`[Compliance Preservation] ${fileName}: catalog-valid property "${propName}" on <${tagName}> was damaged by compliance pass and could not be auto-restored`);
          }
        });
      });

      if (damagedCount > 0) {
        console.log(`[Compliance Preservation] ${fileName}: ${damagedCount} damaged, ${protectedCount} preserved; auto-restored where possible`);
      } else if (protectedCount > 0) {
        console.log(`[Compliance Preservation] ${fileName}: all ${protectedCount} catalog-valid property(ies) preserved through compliance pass`);
      }
      return result;
    }

    let totalPostComplianceReCorrections = 0;

    /**
     * STAGE-OWNERSHIP CONTRACT: Compliance Pass
     * 
     * This stage MAY mutate:
     * - Namespace declarations and prefix normalization
     * - Activity tag prefixes (adding ui: etc.)
     * - XML structural well-formedness repairs
     * - Activity policy filtering
     * 
     * This stage MUST NOT mutate:
     * - Boolean InArgument values that have been normalized (no re-quoting True → "True")
     * - Enum literal values that have been normalized
     * - String literal values that have been normalized to quoted form
     * - Any field marked as normalized:true by the final normalization stage
     */
    function compliancePass(rawXaml: string, fileName: string, skipTracking?: boolean): string {
      const preCatalogSnapshot = catalogService.isLoaded() ? snapshotCatalogValidProperties(rawXaml) : null;
      let compliant = makeUiPathCompliant(rawXaml, tf);
      if (compliant !== rawXaml) {
        const traceRunId = getCurrentRunId();
        if (traceRunId) {
          recordTransform(traceRunId, {
            stage: "compliance_normalization",
            file: fileName,
            description: `XAML compliance normalization applied (${rawXaml.length} → ${compliant.length} chars)`,
            before: rawXaml.length > 500 ? rawXaml.slice(0, 500) + `... [${rawXaml.length} chars]` : rawXaml,
            after: compliant.length > 500 ? compliant.slice(0, 500) + `... [${compliant.length} chars]` : compliant,
          });
        }
      }
      if (preCatalogSnapshot && preCatalogSnapshot.size > 0) {
        const preProtection = compliant;
        compliant = enforcePreCompliancePropertyProtection(rawXaml, compliant, preCatalogSnapshot, fileName);
        if (compliant !== preProtection) {
          const traceRunId = getCurrentRunId();
          if (traceRunId) {
            recordTransform(traceRunId, {
              stage: "catalog_property_protection",
              file: fileName,
              description: `Catalog property protection restored ${preCatalogSnapshot.size} property snapshot(s)`,
            });
          }
        }
      }
      const { filtered, removed } = filterBlockedActivitiesFromXaml(compliant, automationPattern);
      compliant = filtered;
      if (removed.length > 0) {
        const traceRunId = getCurrentRunId();
        if (traceRunId) {
          recordTransform(traceRunId, {
            stage: "activity_policy_filter",
            file: fileName,
            description: `Removed ${removed.length} blocked activit(ies) for pattern "${automationPattern}": ${removed.join(", ")}`,
          });
        }
        console.log(`[UiPath Policy] ${fileName}: removed ${removed.length} blocked activit(ies) for pattern "${automationPattern}": ${removed.join(", ")}`);
      }
      const policyResult = applyActivityPolicy(compliant, modeConfig, fileName);
      compliant = policyResult.content;
      if (policyResult.blocked.length > 0) {
        allPolicyBlocked.push({ file: fileName, activities: policyResult.blocked });
        const traceRunId = getCurrentRunId();
        if (traceRunId) {
          recordTransform(traceRunId, {
            stage: "activity_policy_block",
            file: fileName,
            description: `Policy blocked ${policyResult.blocked.length} activit(ies) in ${generationMode} mode: ${policyResult.blocked.join(", ")}`,
          });
        }
        console.log(`[UiPath Policy] ${fileName}: blocked ${policyResult.blocked.join(", ")} (${generationMode} mode)`);
      }
      const { fixed, report } = analyzeAndFix(compliant);
      analysisReports.push({ fileName, report });
      if (!skipTracking) {
        xamlEntries.push({ name: fileName, content: fixed });
      }
      if (report.totalAutoFixed > 0) {
        const traceRunId = getCurrentRunId();
        if (traceRunId) {
          recordTransform(traceRunId, {
            stage: "workflow_analyzer_autofix",
            file: fileName,
            description: `Auto-fixed ${report.totalAutoFixed} issue(s), ${report.totalRemaining} remaining`,
          });
        }
        console.log(`[UiPath Analyzer] ${fileName}: ${report.totalAutoFixed} auto-fixed, ${report.totalRemaining} remaining`);
      }

      let convergedOutput = fixed;
      const MAX_CONVERGENCE_PASSES = 3;
      try {
        for (let pass = 1; pass <= MAX_CONVERGENCE_PASSES; pass++) {
          const reCompliant = makeUiPathCompliant(convergedOutput, tf);
          if (reCompliant === convergedOutput) {
            if (pass > 1) {
              console.log(`[Compliance Idempotency] ${fileName}: converged after ${pass} pass(es)`);
            }
            break;
          }
          if (pass === 1) {
            const diffLines: string[] = [];
            const fixedLines = convergedOutput.split("\n");
            const reLines = reCompliant.split("\n");
            const maxLen = Math.max(fixedLines.length, reLines.length);
            for (let i = 0; i < maxLen && diffLines.length < 5; i++) {
              if (fixedLines[i] !== reLines[i]) {
                diffLines.push(`  line ${i + 1}: "${(fixedLines[i] || "").slice(0, 120)}" → "${(reLines[i] || "").slice(0, 120)}"`);
              }
            }
            console.warn(`[Compliance Idempotency] ${fileName}: compliance pass was NOT idempotent — running convergence loop (max ${MAX_CONVERGENCE_PASSES} passes). First differences:\n${diffLines.join("\n")}`);
          }
          convergedOutput = reCompliant;
          totalPostComplianceReCorrections++;
          if (pass === MAX_CONVERGENCE_PASSES) {
            console.warn(`[Compliance Idempotency] ${fileName}: did not converge after ${MAX_CONVERGENCE_PASSES} passes — using last result`);
          }
        }
        if (convergedOutput !== fixed && !skipTracking) {
          const idx = xamlEntries.findIndex(e => e.name === fileName);
          if (idx >= 0) {
            xamlEntries[idx].content = convergedOutput;
          }
        }
      } catch (idempotencyErr: any) {
        console.warn(`[Compliance Idempotency] ${fileName}: convergence pass failed — ${idempotencyErr.message}`);
      }

      return convergedOutput;
    }

    function tryStructuralPreservationOrStub(
      rawXaml: string,
      wfName: string,
      compErrMessage: string,
    ): { content: string; wasFullStub: boolean } {
      const spResult = preserveStructureAndStubLeaves(
        rawXaml,
        [{ file: `${wfName}.xaml`, check: "compliance-crash", detail: `Compliance transform failed: ${compErrMessage}` }],
        { isMainXaml: wfName === "Main" || wfName === "Process" },
      );
      if (spResult.preserved || spResult.parseableXml) {
        console.log(`[UiPath] Structural preservation succeeded for "${wfName}" after compliance failure: ${spResult.preservedActivities} preserved, ${spResult.stubbedActivities} stubbed`);
        try {
          const preserved = compliancePass(spResult.content, `${wfName}.xaml`, true);
          return { content: preserved, wasFullStub: false };
        } catch {
          console.log(`[UiPath] Structural preservation output failed compliance for "${wfName}" — falling back to full stub`);
        }
      }
      return { content: compliancePass(generateStubWorkflow(wfName, { reason: `Compliance transform failed — ${compErrMessage}` }), `${wfName}.xaml`, true), wasFullStub: true };
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
        outcomeRemediations.push({
          level: "workflow",
          file: `${wfName}.xaml`,
          remediationCode: "STUB_WORKFLOW_BLOCKING",
          reason: `Generator failed: ${err.message} — replaced with stub`,
          classifiedCheck: "generator-failure",
          developerAction: `Re-implement ${wfName}.xaml — generator could not produce valid XAML`,
          estimatedEffortMinutes: 60,
        });
        return null;
      }
    }

    const workflows = pkg.workflows || [];
    let hasMain = false;
    const generatedWorkflowNames = new Set<string>();

    let specValidationReport: SpecValidationReport | null = null;
    const enrichmentsToProcess: Array<{ name: string; spec: TreeWorkflowSpec; processType: ProcessType }> = [];
    if (allTreeEnrichments.size > 0) {
      Array.from(allTreeEnrichments.entries()).forEach(([name, entry]) => {
        enrichmentsToProcess.push({ name, spec: entry.spec, processType: entry.processType });
      });
    } else if (treeEnrichment && treeEnrichment.status === "success") {
      enrichmentsToProcess.push({ name: treeEnrichment.workflowSpec.name || "Main", spec: treeEnrichment.workflowSpec, processType: treeEnrichment.processType });
    }

    const nonMainWorkflowNames: string[] = [];
    let deferredHallucinatedRecoveries: Array<{ template: string; displayName: string; file: string }> = [];
    let mainWfName = "Main";

    if (enrichmentsToProcess.length > 0) {
      const mainIdx = enrichmentsToProcess.findIndex(e => e.name === "Main");
      if (mainIdx > 0) {
        const [mainEntry] = enrichmentsToProcess.splice(mainIdx, 1);
        enrichmentsToProcess.unshift(mainEntry);
      }

      let totalStrippedProperties = 0;
      let totalExcessiveStripping = 0;
      const excessiveStrippingFiles = new Set<string>();

      for (const enrichEntry of enrichmentsToProcess) {
        let spec = enrichEntry.spec;
        spec = normalizeWorkflowSpec(spec);
        const validationResult = validateSpec(spec, _studioProfile);
        spec = validationResult.spec;
        const report = validationResult.report;
        totalStrippedProperties += report.strippedProperties;
        totalExcessiveStripping += report.excessiveStrippingCount;
        const wfFileName = ((spec.name || enrichEntry.name || "").replace(/\s+/g, "_")) + ".xaml";
        if (report.excessiveStrippingCount > 0) {
          excessiveStrippingFiles.add(wfFileName);
          const perFileHallucinated = report.issues.filter(
            i => i.code === "EXCESSIVE_PROPERTIES_STRIPPED" && i.severity === "error"
          );
          for (const hi of perFileHallucinated) {
            deferredHallucinatedRecoveries.push({
              template: hi.activityTemplate,
              displayName: hi.activityDisplayName,
              file: wfFileName,
            });
          }
        }

        if (!specValidationReport) {
          specValidationReport = { ...report };
          treeEnrichment = { status: "success", workflowSpec: spec, processType: enrichEntry.processType };
        } else {
          specValidationReport.totalActivities += report.totalActivities;
          specValidationReport.validActivities += report.validActivities;
          specValidationReport.unknownActivities += report.unknownActivities;
          specValidationReport.strippedProperties += report.strippedProperties;
          specValidationReport.enumCorrections += report.enumCorrections;
          specValidationReport.missingRequiredFilled += report.missingRequiredFilled;
          specValidationReport.commentConversions += report.commentConversions;
          specValidationReport.excessiveStrippingCount += report.excessiveStrippingCount;
          specValidationReport.issues = specValidationReport.issues.concat(report.issues);
          specValidationReport.catalogLoaded = (specValidationReport.catalogLoaded ?? true) && (report.catalogLoaded ?? true);
          if (report.catalogLoadError && !specValidationReport.catalogLoadError) {
            specValidationReport.catalogLoadError = report.catalogLoadError;
          }
        }

        const specJson = JSON.stringify(spec, null, 2);
        const truncatedSpec = specJson.length > 5000 ? specJson.slice(0, 5000) + "\n... [truncated]" : specJson;
        console.log(`[UiPath] WorkflowSpec tree (validated) before assembly for "${enrichEntry.name}":\n${truncatedSpec}`);
        console.log(`[UiPath] Using tree-based assembly for "${spec.name}"`);

        const rawWfName = (spec.name || enrichEntry.name || projectName);
        const wfName = normalizeWorkflowName(rawWfName);
        if (isCanonicalInfrastructureName(wfName) && generatedWorkflowNames.has(wfName)) {
          console.log(`[UiPath] Skipping duplicate infrastructure workflow "${wfName}" (canonical match) — already generated`);
          continue;
        }
        if (isCanonicalInfrastructureName(wfName)) {
          const existingCanonical = Array.from(generatedWorkflowNames).find(
            existing => canonicalizeWorkflowName(existing) === canonicalizeWorkflowName(wfName)
          );
          if (existingCanonical) {
            console.log(`[UiPath] Skipping duplicate infrastructure workflow "${wfName}" — canonical match with existing "${existingCanonical}"`);
            continue;
          }
        }
        if (priorCompliantMap.has(wfName)) {
          const priorContent = priorCompliantMap.get(wfName)!;
          deferredWrites.set(`${libPath}/${wfName}.xaml`, priorContent);
          generatedWorkflowNames.add(wfName);
          if (wfName === "Main" || wfName === "Process") {
            hasMain = true;
          } else {
            nonMainWorkflowNames.push(wfName);
          }
          xamlResults.push({ xaml: priorContent, gaps: [], usedPackages: ["UiPath.System.Activities"], variables: [] });
          xamlEntries.push({ name: `${wfName}.xaml`, content: priorContent });
          console.log(`[UiPath] Reused prior compliant workflow "${wfName}" — skipping regeneration`);
          continue;
        }
        try {
          const { xaml, variables } = assembleWorkflowFromSpec(spec, enrichEntry.processType);
          let compliant: string;
          let complianceFailed = false;
          try {
            compliant = compliancePass(xaml, `${wfName}.xaml`);
          } catch (compErr: any) {
            complianceFailed = true;
            console.warn(`[UiPath] Compliance pass failed for tree-assembled "${wfName}": ${compErr.message} — attempting structural preservation`);
            const spResult = tryStructuralPreservationOrStub(xaml, wfName, compErr.message);
            compliant = spResult.content;
            complianceFallbacks.push({ file: `${wfName}.xaml`, reason: compErr.message, wasFullStub: spResult.wasFullStub });
          }
          updateStageHash(`${wfName}.xaml`, "postGeneration", compliant);
          const implRepair = repairMissingImplementation(compliant, `${wfName}.xaml`);
          if (implRepair.repaired) {
            compliant = implRepair.content;
          }
          updateStageHash(`${wfName}.xaml`, "postRepair", compliant);
          deferredWrites.set(`${libPath}/${wfName}.xaml`, compliant);
          generatedWorkflowNames.add(wfName);
          if ((wfName === "Main" || wfName === "Process") && !complianceFailed) {
            hasMain = true;
          } else if (wfName !== "Main" && wfName !== "Process") {
            nonMainWorkflowNames.push(wfName);
          }
          xamlResults.push({
            xaml: compliant,
            gaps: [],
            usedPackages: ["UiPath.System.Activities"],
            variables: variables.map(v => ({ name: v.name, type: v.type, defaultValue: v.default || "" })),
          });
          console.log(`[UiPath] Tree assembly produced XAML for "${wfName}" (${variables.length} variables)`);
        } catch (err: any) {
          console.warn(`[UiPath] Tree assembly failed for "${wfName}": ${err.message} — attempting structural preservation before stub`);
          const spResult = tryStructuralPreservationOrStub("", wfName, `Tree assembly failed — ${err.message}`);
          deferredWrites.set(`${libPath}/${wfName}.xaml`, spResult.content);
          generatedWorkflowNames.add(wfName);
          complianceFallbacks.push({ file: `${wfName}.xaml`, reason: `Tree assembly failed — ${err.message}`, wasFullStub: spResult.wasFullStub });
          if (wfName !== "Main" && wfName !== "Process") {
            nonMainWorkflowNames.push(wfName);
          }
          xamlResults.push({
            xaml: spResult.content,
            gaps: [],
            usedPackages: ["UiPath.System.Activities"],
            variables: [],
          });
          if (enrichEntry.name === enrichmentsToProcess[0]?.name) {
            treeEnrichment = null;
          }
        }
      }

      if (totalStrippedProperties > 0) {
        dependencyWarnings.push({
          code: "CATALOG_PROPERTY_STRIPPED",
          message: `Pre-emission validation stripped ${totalStrippedProperties} non-catalog properties across ${enrichmentsToProcess.length} workflow(s)`,
          stage: "spec-validation",
          recoverable: true,
        });
      }

      if (totalExcessiveStripping > 0) {
        const affectedFileList = Array.from(excessiveStrippingFiles).join(", ");
        if (deferredHallucinatedRecoveries.length > 0) {
          console.log(`[UiPath Recovery] Identified ${deferredHallucinatedRecoveries.length} potentially hallucinated activit(ies) for targeted recovery:`);
          for (const ha of deferredHallucinatedRecoveries) {
            console.log(`  - ${ha.template} ("${ha.displayName}") in ${ha.file} — converted to Comment stub at spec-validator level`);
          }
        }
        dependencyWarnings.push({
          code: "EXCESSIVE_PROPERTY_STRIPPING",
          message: `${totalExcessiveStripping} activit(ies) had 5+ non-catalog properties stripped (structural breaks only) in [${affectedFileList}] — indicates generation hallucination for uncataloged activity types. ${deferredHallucinatedRecoveries.length} converted to Comment stubs at spec-validator level.`,
          stage: "spec-validation",
          recoverable: true,
          affectedFiles: Array.from(excessiveStrippingFiles),
        });
        console.warn(`[UiPath] EXCESSIVE PROPERTY STRIPPING: ${totalExcessiveStripping} activities exceeded the stripping threshold in ${affectedFileList} — ${deferredHallucinatedRecoveries.length} converted to Comment stubs via spec-level recovery`);
      }

      mainWfName = generatedWorkflowNames.has("Main") ? "Main" : (generatedWorkflowNames.has("Process") ? "Process" : (enrichmentsToProcess[0]?.name || "Main").replace(/\s+/g, "_"));
      const mainXamlPath = `${libPath}/${mainWfName}.xaml`;
      if (nonMainWorkflowNames.length > 0 && deferredWrites.has(mainXamlPath)) {
        let mainXaml = deferredWrites.get(mainXamlPath)!;
        const invokeRefs: string[] = [];
        const initInvokeRef = `<ui:InvokeWorkflowFile DisplayName="Initialize All Settings" WorkflowFileName="InitAllSettings.xaml" />`;
        if (!mainXaml.includes('WorkflowFileName="InitAllSettings.xaml"')) {
          invokeRefs.push(`      ${initInvokeRef}`);
        }
        for (const subWfName of nonMainWorkflowNames) {
          const subFileName = `${subWfName}.xaml`;
          if (!mainXaml.includes(`WorkflowFileName="${subFileName}"`)) {
            invokeRefs.push(`      <ui:InvokeWorkflowFile DisplayName="${subWfName}" WorkflowFileName="${subFileName}" />`);
          }
        }
        if (invokeRefs.length > 0) {
          const seqVarsEndMatch = mainXaml.match(/<\/Sequence\.Variables>\s*\n/);
          const rootSeqMatch = mainXaml.match(/<Sequence\s[^>]*DisplayName="[^"]*"[^>]*>\s*\n/);
          const insertMatch = seqVarsEndMatch || rootSeqMatch;
          if (insertMatch) {
            const insertPos = insertMatch.index! + insertMatch[0].length;
            mainXaml = mainXaml.slice(0, insertPos) + invokeRefs.join("\n") + "\n" + mainXaml.slice(insertPos);
            deferredWrites.set(mainXamlPath, mainXaml);
            const existingIdx = xamlEntries.findIndex(e => {
              const bn = e.name.split("/").pop() || e.name;
              return bn === `${mainWfName}.xaml`;
            });
            if (existingIdx >= 0) {
              xamlEntries[existingIdx] = { name: xamlEntries[existingIdx].name, content: mainXaml };
            }
            console.log(`[UiPath] Injected ${invokeRefs.length} InvokeWorkflowFile reference(s) into ${mainWfName}.xaml: InitAllSettings${nonMainWorkflowNames.length > 0 ? ", " + nonMainWorkflowNames.join(", ") : ""}`);
          }
        }
      } else if (nonMainWorkflowNames.length === 0 && deferredWrites.has(mainXamlPath)) {
        let mainXaml = deferredWrites.get(mainXamlPath)!;
        if (!mainXaml.includes('WorkflowFileName="InitAllSettings.xaml"')) {
          const seqVarsEndMatch = mainXaml.match(/<\/Sequence\.Variables>\s*\n/);
          const rootSeqMatch = mainXaml.match(/<Sequence\s[^>]*DisplayName="[^"]*"[^>]*>\s*\n/);
          const insertMatch = seqVarsEndMatch || rootSeqMatch;
          if (insertMatch) {
            const insertPos = insertMatch.index! + insertMatch[0].length;
            mainXaml = mainXaml.slice(0, insertPos) + `      ${`<ui:InvokeWorkflowFile DisplayName="Initialize All Settings" WorkflowFileName="InitAllSettings.xaml" />`}\n` + mainXaml.slice(insertPos);
            deferredWrites.set(mainXamlPath, mainXaml);
            console.log(`[UiPath] Injected InitAllSettings.xaml reference into tree-assembled ${mainWfName}.xaml`);
          }
        }
      }

      if (hasMain) {
        console.log(`[UiPath] Multi-workflow tree assembly complete: ${generatedWorkflowNames.size} workflow(s) assembled (${nonMainWorkflowNames.length} non-Main)`);
      }
    }

    if (!specValidationReport && enrichmentsToProcess.length === 0) {
      const deferredXamlCount = Array.from(deferredWrites.keys()).filter(k => k.endsWith(".xaml")).length;
      if (deferredXamlCount > 0) {
        specValidationReport = {
          totalActivities: 0,
          validActivities: 0,
          unknownActivities: 0,
          strippedProperties: 0,
          enumCorrections: 0,
          missingRequiredFilled: 0,
          commentConversions: 0,
          excessiveStrippingCount: 0,
          catalogLoaded: catalogService.isLoaded(),
          issues: [{
            activityType: "PIPELINE_HEALTH",
            property: "specValidation",
            issue: `Pre-emission validation bypassed: ${deferredXamlCount} XAML file(s) with zero activity coverage`,
            severity: "error" as const,
          }],
        };
        dependencyWarnings.push({
          code: "PRE_EMISSION_VALIDATION_BYPASSED",
          message: `Pre-emission spec validation did not run despite ${deferredXamlCount} generated XAML file(s) — build health is degraded`,
          stage: "pre-emission-spec-validation",
          recoverable: false,
        });
        throw new Error(`[Pre-Emission Spec Validation] BLOCKED: ${deferredXamlCount} XAML file(s) generated but pre-emission validation produced zero activity coverage — cannot certify build health`);
      } else {
        console.warn(`[Pre-Emission Spec Validation] No enrichments and no XAML files — initializing empty report`);
        specValidationReport = {
          totalActivities: 0,
          validActivities: 0,
          unknownActivities: 0,
          strippedProperties: 0,
          enumCorrections: 0,
          missingRequiredFilled: 0,
          commentConversions: 0,
          excessiveStrippingCount: 0,
          catalogLoaded: catalogService.isLoaded(),
          issues: [],
        };
      }
    }

    if (specValidationReport) {
      console.log(`[Pre-Emission Spec Validation] Report: ${specValidationReport.totalActivities} total activities, ${specValidationReport.validActivities} valid, ${specValidationReport.unknownActivities} unknown, ${specValidationReport.strippedProperties} stripped properties, ${specValidationReport.issues.length} issues`);

      const deferredXamlCount = Array.from(deferredWrites.keys()).filter(k => k.endsWith(".xaml")).length;
      if (specValidationReport.totalActivities === 0 && deferredXamlCount > 0 && enrichmentsToProcess.length > 0) {
        if (specValidationReport.catalogLoaded === false) {
          const reason = specValidationReport.catalogLoadError || catalogService.getLastLoadError() || "unknown catalog load failure";
          dependencyWarnings.push({
            code: "CATALOG_INTEGRITY_FAILURE",
            message: `Catalog failed to load (${reason}) — spec validation was blind across ${deferredXamlCount} XAML file(s) and ${enrichmentsToProcess.length} enrichment(s)`,
            stage: "pre-emission-spec-validation",
            recoverable: false,
          });
          throw new Error(`[Pre-Emission Spec Validation] BLOCKED: catalog integrity failure (${reason}) — spec validation was blind, cannot certify build health`);
        }
        dependencyWarnings.push({
          code: "PRE_EMISSION_ZERO_COVERAGE",
          message: `Pre-emission validation ran but covered 0 activities across ${deferredXamlCount} XAML file(s) and ${enrichmentsToProcess.length} enrichment(s) — build health is degraded`,
          stage: "pre-emission-spec-validation",
          recoverable: false,
        });
        throw new Error(`[Pre-Emission Spec Validation] BLOCKED: validation ran but covered 0 activities across ${deferredXamlCount} XAML file(s) — cannot certify build health`);
      }
    }

    if (enrichment?.decomposition?.length && !treeEnrichment) {
      console.log(`[UiPath] Using AI decomposition: ${enrichment.decomposition.length} sub-workflows`);
      for (const decomp of enrichment.decomposition) {
        const wfName = normalizeWorkflowName(decomp.name);
        if (priorCompliantMap.has(wfName)) {
          const priorContent = priorCompliantMap.get(wfName)!;
          deferredWrites.set(`${libPath}/${wfName}.xaml`, priorContent);
          generatedWorkflowNames.add(wfName);
          if (wfName === "Main") hasMain = true;
          xamlResults.push({ xaml: priorContent, gaps: [], usedPackages: ["UiPath.System.Activities"], variables: [] });
          console.log(`[UiPath] Reused prior compliant workflow "${wfName}" in decomposition — skipping regeneration`);
          continue;
        }
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
            let decompCompliant: string;
            let decompComplianceFailed = false;
            try {
              decompCompliant = compliancePass(result.xaml, `${wfName}.xaml`);
            } catch (compErr: any) {
              decompComplianceFailed = true;
              console.warn(`[UiPath] Compliance pass failed for decomposed "${wfName}": ${compErr.message} — attempting structural preservation`);
              const spResult = tryStructuralPreservationOrStub(result.xaml, wfName, compErr.message);
              decompCompliant = spResult.content;
              complianceFallbacks.push({ file: `${wfName}.xaml`, reason: compErr.message, wasFullStub: spResult.wasFullStub });
            }
            deferredWrites.set(`${libPath}/${wfName}.xaml`, decompCompliant);
            generatedWorkflowNames.add(wfName);
            if (wfName === "Main" && !decompComplianceFailed) hasMain = true;
            console.log(`[UiPath] Generated decomposed workflow "${wfName}": ${decompNodes.length} nodes, ${result.gaps.length} gaps`);
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
            let specCompliant: string;
            let specComplianceFailed = false;
            try {
              specCompliant = compliancePass(result.xaml, `${wfName}.xaml`);
            } catch (compErr: any) {
              specComplianceFailed = true;
              console.warn(`[UiPath] Compliance pass failed for spec-decomposed "${wfName}": ${compErr.message} — attempting structural preservation`);
              const spResult = tryStructuralPreservationOrStub(result.xaml, wfName, compErr.message);
              specCompliant = spResult.content;
              complianceFallbacks.push({ file: `${wfName}.xaml`, reason: compErr.message, wasFullStub: spResult.wasFullStub });
            }
            deferredWrites.set(`${libPath}/${wfName}.xaml`, specCompliant);
            generatedWorkflowNames.add(wfName);
            if (wfName === "Main" && !specComplianceFailed) hasMain = true;
            console.log(`[UiPath] Generated decomposed workflow "${wfName}" from spec (no matching nodes): ${result.gaps.length} gaps`);
          }
        }
      }
    }

    if (!treeEnrichment) {
      for (const wf of workflows) {
        const wfName = normalizeWorkflowName(wf.name || "Workflow");
        if (generatedWorkflowNames.has(wfName)) continue;
        if (priorCompliantMap.has(wfName)) {
          const priorContent = priorCompliantMap.get(wfName)!;
          deferredWrites.set(`${libPath}/${wfName}.xaml`, priorContent);
          generatedWorkflowNames.add(wfName);
          if (wfName === "Main") hasMain = true;
          xamlResults.push({ xaml: priorContent, gaps: [], usedPackages: ["UiPath.System.Activities"], variables: [] });
          console.log(`[UiPath] Reused prior compliant workflow "${wfName}" — skipping regeneration`);
          continue;
        }
        const result = tryGenerateOrStub(
          () => generateRichXamlFromSpec(wf, sddContent || undefined, undefined, tf, apEnabled, genCtx),
          wfName,
          wf.name || "Workflow",
        );
        if (result) {
          xamlResults.push(result);
          let richCompliant: string;
          let richComplianceFailed = false;
          try {
            richCompliant = compliancePass(result.xaml, `${wfName}.xaml`);
          } catch (compErr: any) {
            richComplianceFailed = true;
            console.warn(`[UiPath] Compliance pass failed for rich XAML "${wfName}": ${compErr.message} — attempting structural preservation`);
            const spResult = tryStructuralPreservationOrStub(result.xaml, wfName, compErr.message);
            richCompliant = spResult.content;
            complianceFallbacks.push({ file: `${wfName}.xaml`, reason: compErr.message, wasFullStub: spResult.wasFullStub });
          }
          deferredWrites.set(`${libPath}/${wfName}.xaml`, richCompliant);
          generatedWorkflowNames.add(wfName);
          if (wfName === "Main" && !richComplianceFailed) hasMain = true;
          console.log(`[UiPath] Generated rich XAML for "${wfName}": ${result.gaps.length} gaps, ${result.usedPackages.length} packages`);
        }
      }
    } else {
      for (const wf of workflows) {
        const wfName = normalizeWorkflowName(wf.name || "Workflow");
        if (generatedWorkflowNames.has(wfName)) continue;
        if (priorCompliantMap.has(wfName)) {
          const priorContent = priorCompliantMap.get(wfName)!;
          deferredWrites.set(`${libPath}/${wfName}.xaml`, priorContent);
          generatedWorkflowNames.add(wfName);
          if (wfName === "Main") hasMain = true;
          xamlResults.push({ xaml: priorContent, gaps: [], usedPackages: ["UiPath.System.Activities"], variables: [] });
          console.log(`[UiPath] Reused prior compliant workflow "${wfName}" — skipping regeneration`);
          continue;
        }
        const result = tryGenerateOrStub(
          () => generateRichXamlFromSpec(wf, sddContent || undefined, undefined, tf, apEnabled, genCtx),
          wfName,
          wf.name || "Workflow",
        );
        if (result) {
          xamlResults.push(result);
          let richCompliant: string;
          let remainingComplianceFailed = false;
          try {
            richCompliant = compliancePass(result.xaml, `${wfName}.xaml`);
          } catch (compErr: any) {
            remainingComplianceFailed = true;
            console.warn(`[UiPath] Compliance pass failed for remaining rich XAML "${wfName}": ${compErr.message} — attempting structural preservation`);
            const spResult = tryStructuralPreservationOrStub(result.xaml, wfName, compErr.message);
            richCompliant = spResult.content;
            complianceFallbacks.push({ file: `${wfName}.xaml`, reason: compErr.message, wasFullStub: spResult.wasFullStub });
          }
          deferredWrites.set(`${libPath}/${wfName}.xaml`, richCompliant);
          generatedWorkflowNames.add(wfName);
          if (wfName === "Main" && !remainingComplianceFailed) hasMain = true;
          console.log(`[UiPath] Generated remaining workflow "${wfName}" alongside tree-assembled workflows`);
        }
      }
    }

    if (enrichmentsToProcess.length === 0 || !treeEnrichment) {
      mainWfName = generatedWorkflowNames.has("Main") ? "Main" : (generatedWorkflowNames.has("Process") ? "Process" : "Main");
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
        let processCompliant: string;
        try {
          processCompliant = compliancePass(processResult.xaml, `${processFileName}.xaml`);
        } catch (compErr: any) {
          console.warn(`[UiPath] Compliance pass failed for process "${processFileName}": ${compErr.message} — attempting structural preservation`);
          const spResult = tryStructuralPreservationOrStub(processResult.xaml, processFileName, compErr.message);
          processCompliant = spResult.content;
          complianceFallbacks.push({ file: `${processFileName}.xaml`, reason: compErr.message, wasFullStub: spResult.wasFullStub });
        }
        deferredWrites.set(`${libPath}/${processFileName}.xaml`, processCompliant);
        console.log(`[UiPath] Generated process XAML from ${processNodes.length} map nodes: ${processResult.gaps.length} gaps`);
      }
    }

    const packageCredentialStrategy = determineCredentialStrategy(orchestratorArtifacts);
    console.log(`[UiPath] Package-level credential strategy determined: ${packageCredentialStrategy}`);
    const initXaml = generateInitAllSettingsXaml(orchestratorArtifacts, tf, packageCredentialStrategy);
    deferredWrites.set(`${libPath}/InitAllSettings.xaml`, compliancePass(initXaml, "InitAllSettings.xaml"));

    if (useReFramework && !hasMain) {
      const preRefXamlLen = xamlEntries.length;
      const preRefReportsLen = analysisReports.length;
      const preRefBlockedLen = allPolicyBlocked.length;
      const refDeferredKeys = [
        `${libPath}/Main.xaml`,
        `${libPath}/GetTransactionData.xaml`,
        `${libPath}/SetTransactionStatus.xaml`,
        `${libPath}/CloseAllApplications.xaml`,
        `${libPath}/KillAllProcesses.xaml`,
        `${libPath}/Init.xaml`,
      ];
      try {
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

        const initXaml = generateInitXaml(tf);
        deferredWrites.set(`${libPath}/Init.xaml`, compliancePass(initXaml, "Init.xaml"));
        console.log(`[UiPath] Generated deterministic Init.xaml template`);

        if (!deferredWrites.has(`${libPath}/Process.xaml`)) {
          let processInvocations = "";
          const invokedInProcess = new Set<string>();
          if (enrichment?.decomposition?.length) {
            for (const decomp of enrichment.decomposition) {
              const wfName = normalizeWorkflowName(decomp.name);
              if (isCanonicalInfrastructureName(wfName)) continue;
              if (invokedInProcess.has(wfName)) continue;
              invokedInProcess.add(wfName);
              processInvocations += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(decomp.name)}" WorkflowFileName="${wfName}.xaml" />`;
            }
          }
          Array.from(generatedWorkflowNames).forEach(gwfName => {
            if (isCanonicalInfrastructureName(gwfName)) return;
            if (invokedInProcess.has(gwfName)) return;
            invokedInProcess.add(gwfName);
            processInvocations += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(gwfName)}" WorkflowFileName="${gwfName}.xaml" />`;
          });
          if (!processInvocations) {
            processInvocations = `
        <ui:LogMessage DisplayName="Log Process Placeholder" Level="Info" Message="[&quot;Process transaction logic goes here&quot;]" />`;
          }
          const processXaml = buildXaml("Process", `${projectName} - Process Transaction`, processInvocations);
          deferredWrites.set(`${libPath}/Process.xaml`, compliancePass(processXaml, "Process.xaml"));
          console.log(`[UiPath] Generated Process.xaml wiring ${invokedInProcess.size} sub-workflow(s) for REFramework`);
        }
      } catch (reframeworkErr: any) {
        console.error(`[UiPath] REFramework compliance failed, falling back to simple linear Main.xaml: ${reframeworkErr.message}`);
        const rolledBackXaml = xamlEntries.length - preRefXamlLen;
        const rolledBackReports = analysisReports.length - preRefReportsLen;
        const rolledBackBlocked = allPolicyBlocked.length - preRefBlockedLen;
        xamlEntries.length = preRefXamlLen;
        analysisReports.length = preRefReportsLen;
        allPolicyBlocked.length = preRefBlockedLen;
        let rolledBackDeferred = 0;
        for (const key of refDeferredKeys) {
          if (deferredWrites.delete(key)) rolledBackDeferred++;
        }
        console.log(`[UiPath] REFramework rollback: removed ${rolledBackXaml} xamlEntries, ${rolledBackReports} analysisReports, ${rolledBackBlocked} allPolicyBlocked, ${rolledBackDeferred} deferredWrites keys`);
        hasMain = false;
        useReFramework = false;
      }
    }
    if (!hasMain) {
      let mainActivities = `
        <ui:InvokeWorkflowFile DisplayName="Initialize Settings" WorkflowFileName="InitAllSettings.xaml" />`;

      const invokedNames = new Set<string>();
      const isMainVariant = (name: string): boolean => {
        const normalized = name.replace(/\.xaml$/i, "").replace(/[_\s.]+/g, "").toLowerCase();
        return normalized === "main";
      };

      if (enrichment?.decomposition?.length) {
        for (const decomp of enrichment.decomposition) {
          const wfName = normalizeWorkflowName(decomp.name);
          if (isMainVariant(wfName)) continue;
          invokedNames.add(wfName);
          mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(decomp.name)}" WorkflowFileName="${wfName}.xaml" />`;
        }
      }
      if (workflows.length > 0) {
        for (const wf of workflows) {
          const wfName = normalizeWorkflowName(wf.name || "Workflow");
          if (isMainVariant(wfName)) continue;
          if (invokedNames.has(wfName)) continue;
          invokedNames.add(wfName);
          mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(wf.name || wfName)}" WorkflowFileName="${wfName}.xaml" />`;
        }
      }
      Array.from(generatedWorkflowNames).forEach(gwfName => {
        if (isMainVariant(gwfName)) return;
        if (invokedNames.has(gwfName)) return;
        invokedNames.add(gwfName);
        mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(gwfName)}" WorkflowFileName="${gwfName}.xaml" />`;
      });

      if (invokedNames.size === 0 && processNodes.length > 0 && !isMainVariant(projectName)) {
        mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(projectName)}" WorkflowFileName="${projectName}.xaml" />`;
        invokedNames.add(projectName);
      } else if (invokedNames.size === 0) {
        mainActivities += `
        <ui:Comment DisplayName="Auto-generated by CannonBall" Text="This automation package was generated from the CannonBall pipeline. Open this project in UiPath Studio to build out the workflow logic." />`;
      }

      for (const gwfName of generatedWorkflowNames) {
        if (invokedNames.has(gwfName)) continue;
        if (gwfName.toLowerCase() === "main") continue;
        invokedNames.add(gwfName);
        mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(gwfName)}" WorkflowFileName="${gwfName}.xaml" />`;
      }

      const infrastructureFiles = CANONICAL_INFRASTRUCTURE_NAMES;
      for (const deferredKey of deferredWrites.keys()) {
        const deferredMatch = deferredKey.match(/([^/]+)\.xaml$/i);
        if (!deferredMatch) continue;
        const deferredBasename = deferredMatch[1];
        const canonicalBasename = canonicalizeWorkflowName(deferredBasename);
        if (infrastructureFiles.has(canonicalBasename)) continue;
        if (invokedNames.has(deferredBasename)) continue;
        invokedNames.add(deferredBasename);
        mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(deferredBasename)}" WorkflowFileName="${deferredBasename}.xaml" />`;
      }

      const closeAppsXaml = generateCloseAllApplicationsXaml(tf);
      deferredWrites.set(`${libPath}/CloseAllApplications.xaml`, compliancePass(closeAppsXaml, "CloseAllApplications.xaml"));

      mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Close All Applications" WorkflowFileName="CloseAllApplications.xaml" />`;
      mainActivities += `
        <ui:LogMessage Level="Info" Message="[&quot;Process completed successfully&quot;]" DisplayName="Log Completion" />`;

      let mainXaml = buildXaml("Main", `${projectName} - Main Workflow`, mainActivities);
      const selfRefBefore = mainXaml;
      mainXaml = mainXaml.replace(/<ui:InvokeWorkflowFile[^>]*WorkflowFileName\s*=\s*"(?:[.\/\\]*(?:lib[.\/\\])?)?Main\.xaml"[^>]*\/>/gi, "");
      if (mainXaml !== selfRefBefore) {
        console.warn(`[UiPath] Removed Main.xaml self-reference from simple Main fallback`);
      }
      deferredWrites.set(`${libPath}/Main.xaml`, compliancePass(mainXaml, "Main.xaml"));
    }

    {
      const existingFiles = new Set<string>();
      const prefix = libPath + "/";
      for (const [path] of deferredWrites) {
        if (path.endsWith(".xaml")) {
          const relPath = path.startsWith(prefix) ? path.slice(prefix.length) : (path.split("/").pop() || path);
          existingFiles.add(relPath);
        }
      }
      for (const entry of xamlEntries) {
        const relPath = entry.name.startsWith(prefix) ? entry.name.slice(prefix.length) : (entry.name.split("/").pop() || entry.name);
        if (relPath.endsWith(".xaml")) existingFiles.add(relPath);
      }

      const referencedFiles = new Set<string>();
      for (const [path, content] of deferredWrites) {
        if (!path.endsWith(".xaml")) continue;
        const pattern = /WorkflowFileName="([^"]+)"/g;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const ref = match[1].replace(/\\/g, "/").replace(/^[./]+/, "")
            .replace(/&quot;/g, "").replace(/^"+|"+$/g, "")
            .replace(/\{type:[^}]*,value:([^}]*)\}/g, "$1")
            .replace(/\{"type":"[^"]*","value":"([^"]*)"\}/g, "$1")
            .replace(/[{}]/g, "");
          referencedFiles.add(ref);
        }
      }
      for (const entry of xamlEntries) {
        const pattern = /WorkflowFileName="([^"]+)"/g;
        let match;
        while ((match = pattern.exec(entry.content)) !== null) {
          const ref = match[1].replace(/\\/g, "/").replace(/^[./]+/, "")
            .replace(/&quot;/g, "").replace(/^"+|"+$/g, "")
            .replace(/\{type:[^}]*,value:([^}]*)\}/g, "$1")
            .replace(/\{"type":"[^"]*","value":"([^"]*)"\}/g, "$1")
            .replace(/[{}]/g, "");
          referencedFiles.add(ref);
        }
      }

      const existingFilesNormalized = new Set<string>();
      for (const f of existingFiles) {
        existingFilesNormalized.add(f.replace(/\.xaml$/i, "").toLowerCase());
      }
      function isExistingFile(ref: string): boolean {
        if (existingFiles.has(ref)) return true;
        const norm = ref.replace(/\.xaml$/i, "").toLowerCase();
        return existingFilesNormalized.has(norm);
      }

      let stubCount = 0;
      let retryCount = 0;
      for (const ref of referencedFiles) {
        if (!isExistingFile(ref)) {
          const baseName = ref.split("/").pop() || ref;
          const className = baseName.replace(/\.xaml$/i, "");
          let generated = false;
          const matchingWfSpec = workflows.find(w => {
            const wfSanitized = (w.name || "").replace(/\s+/g, "_");
            return wfSanitized === className || w.name === className;
          });
          if (matchingWfSpec && matchingWfSpec.steps && matchingWfSpec.steps.length > 0) {
            try {
              const retryResult = tryGenerateOrStub(
                () => generateRichXamlFromSpec(matchingWfSpec, sddContent || undefined, undefined, tf, apEnabled, genCtx),
                className,
                matchingWfSpec.description || className,
              );
              if (retryResult) {
                let retryCompliant: string;
                try {
                  retryCompliant = compliancePass(retryResult.xaml, `${className}.xaml`);
                } catch (compErr: any) {
                  retryCompliant = tryStructuralPreservationOrStub(retryResult.xaml, className, compErr.message).content;
                }
                deferredWrites.set(`${libPath}/${ref}`, retryCompliant);
                existingFiles.add(ref);
                existingFilesNormalized.add(ref.replace(/\.xaml$/i, "").toLowerCase());
                retryCount++;
                generated = true;
                console.log(`[Scaffold] Retry-generated XAML for missing referenced workflow: ${ref} (${matchingWfSpec.steps.length} steps)`);
              }
            } catch (retryErr: any) {
              console.log(`[Scaffold] Retry generation failed for ${ref}: ${retryErr.message} — falling back to stub`);
            }
          }
          if (!generated) {
            const stubXaml = buildXaml(className, `${className} - Stub Workflow`, `
        <ui:Comment DisplayName="TODO: Implement ${escapeXml(className)}" Text="This workflow was auto-generated as a stub. Open in UiPath Studio to implement the logic." />`);
            deferredWrites.set(`${libPath}/${ref}`, compliancePass(stubXaml, ref));
            existingFiles.add(ref);
            existingFilesNormalized.add(ref.replace(/\.xaml$/i, "").toLowerCase());
            stubCount++;
            console.log(`[Scaffold] Generated stub XAML for referenced workflow: ${ref}`);
          }
        }
      }
      if (retryCount > 0) {
        console.log(`[Scaffold] Retry-generated ${retryCount} XAML file(s) for missing referenced workflows`);
      }
      if (stubCount > 0) {
        console.log(`[Scaffold] Generated ${stubCount} stub XAML file(s) for missing referenced workflows`);
      }
    }

    for (const [path, content] of deferredWrites.entries()) {
      if (!path.endsWith(".xaml")) continue;
      const shortName = path.split("/").pop() || path;
      if (!hasStageHash(shortName, "postGeneration")) {
        updateStageHash(shortName, "postGeneration", content);
      }
      if (!hasStageHash(shortName, "postRepair")) {
        updateStageHash(shortName, "postRepair", content);
      }
    }

    const prePruningXamlParts: string[] = xamlEntries.map(e => e.content);
    Array.from(deferredWrites.entries()).forEach(([path, content]) => {
      if (path.endsWith(".xaml")) {
        prePruningXamlParts.push(content);
      }
    });
    const prePruningXamlContent = prePruningXamlParts.join("\n");

    {
      const mainDeferredKey = Array.from(deferredWrites.keys()).find(k => (k.split("/").pop() || k) === "Main.xaml");
      const mainContent = mainDeferredKey ? deferredWrites.get(mainDeferredKey) || "" : "";
      const mainIsFullStub = earlyStubFallbacks.includes("Main.xaml") ||
        mainContent.includes("STUB_BLOCKING_FALLBACK") || mainContent.includes("STUB: Main") ||
        complianceFallbacks.some(fb => (fb.file === "Main.xaml" || fb.file === "Process.xaml") && fb.wasFullStub);

      const subWorkflowCount = Array.from(generatedWorkflowNames).filter(n => n !== "Main" && n !== "Process").length;
      const mainHasInvokeRefs = mainContent.includes("InvokeWorkflowFile");
      const mainIsFunctionallyEmpty = !mainHasInvokeRefs && subWorkflowCount > 0 && (() => {
        const bodyOnlyPlaceholders = (() => {
          const activityPattern = /<([\w:]+)\s[^>]*DisplayName="[^"]*"/g;
          const activities: string[] = [];
          let m;
          while ((m = activityPattern.exec(mainContent)) !== null) {
            const tag = m[1].replace(/^[a-zA-Z]+:/, "");
            if (tag !== "Sequence" && tag !== "Variable") activities.push(tag);
          }
          const placeholderTags = new Set(["LogMessage", "Comment", "WriteLine"]);
          return activities.length > 0 && activities.every(a => placeholderTags.has(a));
        })();

        const hasFallbackMarkers = mainContent.includes("TODO:") || mainContent.includes("STUB") ||
          mainContent.includes("Placeholder") || mainContent.includes("stub");

        const varMatches = mainContent.match(/<Variable\s/g);
        const varCount = varMatches ? varMatches.length : 0;
        const activityMatches = mainContent.match(/<([\w:]+)\s[^>]*DisplayName="/g);
        const activityCount = activityMatches ? activityMatches.length : 0;
        const triviallyLowActivities = varCount > 5 && activityCount <= Math.max(3, Math.floor(varCount / 10));

        return bodyOnlyPlaceholders || hasFallbackMarkers || triviallyLowActivities;
      })();

      if (mainIsFunctionallyEmpty && !mainIsFullStub) {
        console.log(`[UiPath] Main.xaml is functionally empty (no InvokeWorkflowFile refs, ${subWorkflowCount} sub-workflows exist) — injecting references and skipping reachability pruning`);
      }

      const mainHadFallback = mainIsFullStub || mainIsFunctionallyEmpty ||
        complianceFallbacks.some(fb => fb.file === "Main.xaml" || fb.file === "Process.xaml");
      const processDeferredKeyForCheck = Array.from(deferredWrites.keys()).find(k => (k.split("/").pop() || k) === "Process.xaml");
      const processContent = processDeferredKeyForCheck ? deferredWrites.get(processDeferredKeyForCheck) || "" : "";
      const processIsFullStub = earlyStubFallbacks.includes("Process.xaml") ||
        processContent.includes("STUB_BLOCKING_FALLBACK") || processContent.includes("STUB: Process") ||
        complianceFallbacks.some(fb => fb.file === "Process.xaml" && fb.wasFullStub);
      const processHadFallback = processIsFullStub ||
        complianceFallbacks.some(fb => fb.file === "Process.xaml");
      if ((mainIsFullStub || mainIsFunctionallyEmpty) && mainDeferredKey) {
        let stubbedMainXaml = deferredWrites.get(mainDeferredKey) || "";
        const allWorkflowNames = new Set([...nonMainWorkflowNames, ...Array.from(generatedWorkflowNames).filter(n => n !== "Main" && n !== "Process")]);
        const invokeRefsToInject: string[] = [];
        if (!stubbedMainXaml.includes('WorkflowFileName="InitAllSettings.xaml"')) {
          invokeRefsToInject.push(`      <ui:InvokeWorkflowFile DisplayName="Initialize All Settings" WorkflowFileName="InitAllSettings.xaml" />`);
        }
        for (const subWfName of allWorkflowNames) {
          const subFileName = `${subWfName}.xaml`;
          if (!stubbedMainXaml.includes(`WorkflowFileName="${subFileName}"`)) {
            invokeRefsToInject.push(`      <ui:InvokeWorkflowFile DisplayName="${subWfName}" WorkflowFileName="${subFileName}" />`);
          }
        }
        if (invokeRefsToInject.length > 0) {
          const seqVarsEndMatch = stubbedMainXaml.match(/<\/Sequence\.Variables>\s*\n/);
          const rootSeqMatch = stubbedMainXaml.match(/<Sequence\s[^>]*DisplayName="[^"]*"[^>]*>\s*\n/);
          const insertMatch = seqVarsEndMatch || rootSeqMatch;
          if (insertMatch) {
            const insertPos = insertMatch.index! + insertMatch[0].length;
            stubbedMainXaml = stubbedMainXaml.slice(0, insertPos) + invokeRefsToInject.join("\n") + "\n" + stubbedMainXaml.slice(insertPos);
            deferredWrites.set(mainDeferredKey, stubbedMainXaml);
            const existingIdx = xamlEntries.findIndex(e => {
              const bn = e.name.split("/").pop() || e.name;
              return bn === "Main.xaml";
            });
            if (existingIdx >= 0) {
              xamlEntries[existingIdx] = { name: xamlEntries[existingIdx].name, content: stubbedMainXaml };
            }
            console.log(`[UiPath] Injected ${invokeRefsToInject.length} InvokeWorkflowFile reference(s) into stubbed Main.xaml to preserve invocation graph`);
          }
        }
      }
      if (processIsFullStub) {
        const processDeferredKey = Array.from(deferredWrites.keys()).find(k => (k.split("/").pop() || k) === "Process.xaml");
        if (processDeferredKey) {
          let stubbedProcessXaml = deferredWrites.get(processDeferredKey) || "";
          const processWorkflowNames = Array.from(generatedWorkflowNames).filter(n => n !== "Main" && n !== "Process" && n !== "InitAllSettings");
          const processInvokeRefs: string[] = [];
          for (const subWfName of processWorkflowNames) {
            const subFileName = `${subWfName}.xaml`;
            if (!stubbedProcessXaml.includes(`WorkflowFileName="${subFileName}"`)) {
              processInvokeRefs.push(`      <ui:InvokeWorkflowFile DisplayName="Run ${subWfName}" WorkflowFileName="${subFileName}" />`);
            }
          }
          if (processInvokeRefs.length > 0) {
            const seqVarsEndMatch = stubbedProcessXaml.match(/<\/Sequence\.Variables>\s*\n/);
            const rootSeqMatch = stubbedProcessXaml.match(/<Sequence\s[^>]*DisplayName="[^"]*"[^>]*>\s*\n/);
            const insertMatch = seqVarsEndMatch || rootSeqMatch;
            if (insertMatch) {
              const insertPos = insertMatch.index! + insertMatch[0].length;
              stubbedProcessXaml = stubbedProcessXaml.slice(0, insertPos) + processInvokeRefs.join("\n") + "\n" + stubbedProcessXaml.slice(insertPos);
              deferredWrites.set(processDeferredKey, stubbedProcessXaml);
              const existingIdx = xamlEntries.findIndex(e => {
                const bn = e.name.split("/").pop() || e.name;
                return bn === "Process.xaml";
              });
              if (existingIdx >= 0) {
                xamlEntries[existingIdx] = { name: xamlEntries[existingIdx].name, content: stubbedProcessXaml };
              }
              console.log(`[UiPath] Injected ${processInvokeRefs.length} InvokeWorkflowFile reference(s) into stubbed Process.xaml to preserve invocation graph`);
            }
          }
        }
      }
      if (mainHadFallback || processHadFallback) {
        console.log(`[Structural Dedup] ${mainHadFallback ? "Main.xaml" : ""}${mainHadFallback && processHadFallback ? " and " : ""}${processHadFallback ? "Process.xaml" : ""} had fallback — skipping reachability pruning to preserve child workflows`);
        const { graph } = buildReachabilityGraph(deferredWrites, xamlEntries, libPath);
        Array.from(graph.entries()).forEach(([file, refs]) => {
          if (refs.length > 0) {
            console.log(`[Structural Dedup] ${file} -> ${refs.join(", ")}`);
          }
        });
      } else {
        console.log(`[Structural Dedup] Building reachability graph from Main.xaml entry point...`);
        const { reachable, unreachable, graph } = buildReachabilityGraph(deferredWrites, xamlEntries, libPath);
        console.log(`[Structural Dedup] Reachability analysis: ${reachable.size} reachable, ${unreachable.size} unreachable out of ${reachable.size + unreachable.size} total XAML files`);

        if (unreachable.size > 0) {
          const { trulyOrphaned, specRetained } = filterUnreachableBySpecDecomposition(unreachable, generatedWorkflowNames);

          if (specRetained.size > 0) {
            console.log(`[Structural Dedup] Retained ${specRetained.size} spec-decomposed workflow(s) despite being unreachable from fallback Main.xaml: ${Array.from(specRetained).join(", ")}`);
            const processPath = `${libPath}/Process.xaml`;
            let processXaml = deferredWrites.get(processPath) || "";
            let processSource: "deferred" | "entry" | "none" = "none";
            if (processXaml) {
              processSource = "deferred";
            } else {
              const processEntry = xamlEntries.find(e => e.name.endsWith("Process.xaml"));
              if (processEntry) {
                processXaml = processEntry.content;
                processSource = "entry";
              }
            }
            const injectedFiles: string[] = [];
            if (processXaml) {
              let closingSeqIdx = processXaml.lastIndexOf("</Sequence>");
              if (closingSeqIdx < 0) {
                const closingActivityIdx = processXaml.lastIndexOf("</Activity>");
                if (closingActivityIdx >= 0) {
                  const seqInsert = `  <Sequence DisplayName="Process Body">\n  </Sequence>\n`;
                  processXaml = processXaml.substring(0, closingActivityIdx) + seqInsert + processXaml.substring(closingActivityIdx);
                  closingSeqIdx = processXaml.lastIndexOf("</Sequence>");
                }
              }
              if (closingSeqIdx >= 0) {
                let invokeBlock = "";
                Array.from(specRetained).forEach(retained => {
                  const basename = retained.split("/").pop() || retained;
                  const basenameNoExt = basename.replace(/\.xaml$/i, "");
                  const alreadyReferenced = processXaml.includes(`WorkflowFileName="${basename}"`) ||
                    processXaml.includes(`WorkflowFileName="${basenameNoExt}"`) ||
                    processXaml.includes(`WorkflowFileName="${basenameNoExt}.xaml"`);
                  if (!alreadyReferenced) {
                    const displayBasename = basenameNoExt;
                    invokeBlock += `    <ui:InvokeWorkflowFile WorkflowFileName="${basename}" DisplayName="Invoke ${displayBasename}">\n` +
                      `      <ui:InvokeWorkflowFile.Arguments>\n` +
                      `      </ui:InvokeWorkflowFile.Arguments>\n` +
                      `    </ui:InvokeWorkflowFile>\n`;
                    injectedFiles.push(basename);
                  }
                });
                if (invokeBlock) {
                  processXaml = processXaml.substring(0, closingSeqIdx) + invokeBlock + processXaml.substring(closingSeqIdx);
                  if (processSource === "deferred") {
                    deferredWrites.set(processPath, processXaml);
                  } else if (processSource === "entry") {
                    const processEntry = xamlEntries.find(e => e.name.endsWith("Process.xaml"));
                    if (processEntry) processEntry.content = processXaml;
                  }
                  console.log(`[Structural Dedup] Injected InvokeWorkflowFile calls into Process.xaml for: ${injectedFiles.join(", ")}`);
                }
              }
            }
            Array.from(specRetained).forEach(retained => {
              const basename = retained.split("/").pop() || retained;
              if (injectedFiles.includes(basename)) {
                dependencyWarnings.push({
                  code: "SPEC_WORKFLOW_WIRED",
                  message: `"${retained}" was generated from spec decomposition and has been wired into Process.xaml via InvokeWorkflowFile`,
                  stage: "structural-deduplication",
                  recoverable: true,
                });
              } else {
                dependencyWarnings.push({
                  code: "SPEC_WORKFLOW_NOT_WIRED",
                  message: `"${retained}" was generated from spec decomposition but could not be auto-wired — flagged as "generated but not wired"`,
                  stage: "structural-deduplication",
                  recoverable: true,
                });
              }
            });
          }

          if (trulyOrphaned.size > 0) {
            const { removedFiles, reasons } = removeUnreachableFiles(deferredWrites, xamlEntries, trulyOrphaned, libPath);
            for (const reason of reasons) {
              console.log(`[Structural Dedup] ${reason}`);
              dependencyWarnings.push({
                code: "STRUCTURAL_DEDUP_REMOVED",
                message: reason,
                stage: "structural-deduplication",
                recoverable: true,
              });
            }
            console.log(`[Structural Dedup] Removed ${removedFiles.length} truly orphaned file(s): ${removedFiles.join(", ")}`);
          } else {
            console.log(`[Structural Dedup] All unreachable files are spec-decomposed — no files removed`);
          }
        } else {
          console.log(`[Structural Dedup] All XAML files are reachable from Main.xaml — no orphaned files detected`);
        }

        Array.from(graph.entries()).forEach(([file, refs]) => {
          if (refs.length > 0) {
            console.log(`[Structural Dedup] ${file} -> ${refs.join(", ")}`);
          }
        });
      }
    }

    {
      const credResult = reconcileCredentialStrategy(deferredWrites, xamlEntries, packageCredentialStrategy);
      if (credResult.reconciled) {
        for (const warning of credResult.warnings) {
          dependencyWarnings.push({
            code: "CREDENTIAL_STRATEGY_RECONCILED",
            message: warning,
            stage: "credential-reconciliation",
            recoverable: true,
          });
        }
        console.log(`[Credential Reconciliation] Reconciled to strategy: ${credResult.strategy}`);
      } else if (credResult.strategy !== "none") {
        console.log(`[Credential Reconciliation] Consistent strategy detected: ${credResult.strategy}`);
      }
    }

    const configCsv = generateConfigXlsx(projectName, sddContent || undefined, orchestratorArtifacts);
    archive.append(configCsv, { name: `${libPath}/Data/Config.xlsx` });

    const allXamlParts: string[] = xamlEntries.map(e => e.content);
    Array.from(deferredWrites.entries()).forEach(([path, content]) => {
      if (path.endsWith(".xaml")) {
        allXamlParts.push(content);
      }
    });
    const allXamlContent = allXamlParts.join("\n");
    const depAlignmentXamlContent = prePruningXamlContent;
    const scannedPackages = scanXamlForRequiredPackages(depAlignmentXamlContent);

    {
      const DEPENDENCY_SAFE_LIST = new Set([
        "UiPath.System.Activities",
        "UiPath.Mail.Activities",
        "UiPath.Testing.Activities",
      ]);

      for (const [prefix, pkgName] of Object.entries(NAMESPACE_PREFIX_TO_PACKAGE)) {
        const prefixPattern = new RegExp(`<${prefix}:[A-Za-z]+[\\s/>]`);
        if (prefixPattern.test(depAlignmentXamlContent)) {
          DEPENDENCY_SAFE_LIST.add(pkgName);
          console.log(`[Dependency Alignment] Dynamically added ${pkgName} to safe list — namespace prefix "${prefix}:" detected in XAML`);
        }
      }

      const usedPackages = new Set(Array.from(scannedPackages));
      usedPackages.add("UiPath.System.Activities");

      const nsAndAsmPackages = extractXamlNamespaceAndAssemblyPackages(depAlignmentXamlContent);
      for (const pkg of nsAndAsmPackages) {
        usedPackages.add(pkg);
      }

      try {
        const { catalogService } = await import("./catalog/catalog-service");
        if (catalogService.isLoaded()) {
          const activityTagPattern = /<([a-zA-Z]+):([A-Za-z]+)[\s/>]/g;
          let actMatch;
          while ((actMatch = activityTagPattern.exec(depAlignmentXamlContent)) !== null) {
            const activityTag = actMatch[2];
            const catalogPkg = catalogService.getPackageForActivity(activityTag);
            if (catalogPkg && !usedPackages.has(catalogPkg)) {
              usedPackages.add(catalogPkg);
              console.log(`[Dependency Alignment] Catalog-based addition: ${catalogPkg} — activity "${activityTag}" found in XAML`);
            }
          }
        }
      } catch (catalogErr: any) {
        console.log(`[Dependency Alignment] Catalog-based dependency resolution skipped: ${catalogErr.message}`);
      }

      for (const safePkg of DEPENDENCY_SAFE_LIST) {
        if (deps[safePkg] && !usedPackages.has(safePkg)) {
          console.log(`[Dependency Alignment] Safe list preserved dependency: ${safePkg} — would have been pruned without safe list`);
        }
        usedPackages.add(safePkg);
      }

      const unusedDeps: string[] = [];
      for (const pkgName of Object.keys(deps)) {
        if (!usedPackages.has(pkgName)) {
          unusedDeps.push(pkgName);
        }
      }
      const proactiveRemovals: string[] = [];
      for (const pkgName of unusedDeps) {
        if (specPredictedPackages.has(pkgName)) {
          console.log(`[Dependency Alignment] Preserving spec-predicted dependency ${pkgName} — spec is source of truth for required packages`);
          continue;
        }
        delete deps[pkgName];
        if (proactivelyResolvedPackages.has(pkgName)) {
          proactiveRemovals.push(pkgName);
          console.log(`[Dependency Alignment] Silently removing proactively-resolved dependency: ${pkgName} — not used in emitted XAML`);
        } else {
          console.log(`[Dependency Alignment] Removing unused dependency: ${pkgName} — not referenced in any emitted XAML (activity tags, namespace imports, or assembly references)`);
          dependencyWarnings.push({
            code: "DEPENDENCY_UNUSED_REMOVED",
            message: `Package ${pkgName} was in dependencies but not referenced in any emitted XAML (activity tags, namespace imports, assembly references, TypeArguments, or expressions) — removed`,
            stage: "dependency-alignment",
            recoverable: true,
          });
        }
      }
      if (unusedDeps.length > 0) {
        console.log(`[Dependency Alignment] Removed ${unusedDeps.length} unused dependenc(ies): ${unusedDeps.join(", ")}${proactiveRemovals.length > 0 ? ` (${proactiveRemovals.length} silently from proactive resolution)` : ""}`);
      }

      const MANDATORY_BASELINE_PACKAGES: string[] = ["UiPath.System.Activities"];
      for (const baselinePkg of MANDATORY_BASELINE_PACKAGES) {
        if (!deps[baselinePkg]) {
          let version: string | null = null;
          const preferred = getPreferredVersionFromMeta(baselinePkg);
          if (preferred) {
            version = preferred;
          } else if (catalogService.isLoaded()) {
            const catalogVersion = catalogService.getPreferredVersion(baselinePkg);
            if (catalogVersion) version = catalogVersion;
          }
          if (!version) {
            const fallback = getBaselineFallbackVersion(baselinePkg, tf as "Windows" | "Portable");
            if (fallback) version = fallback;
          }
          if (version) {
            deps[baselinePkg] = version;
            console.log(`[Dependency Enforcement] Re-added mandatory baseline package ${baselinePkg}@${version} after alignment pruned it`);
          }
        }
      }
    }
    for (const rawPkgName of scannedPackages) {
      const pkgName = normalizePackageName(rawPkgName);
      if (deps[pkgName]) continue;
      if (isFrameworkAssembly(pkgName)) {
        console.log(`[Dependency CrossCheck] Rejected framework assembly from XAML scan: ${pkgName}`);
        continue;
      }
      let resolved = false;
      if (catalogService.isLoaded()) {
        const catalogVersion = catalogService.getPreferredVersion(pkgName);
        if (catalogVersion) {
          deps[pkgName] = catalogVersion;
          dependencyWarnings.push({
            code: "DEPENDENCY_DISCOVERED_IN_XAML",
            message: `Package ${pkgName} was not resolved proactively but was discovered in emitted XAML — added from catalog preferred version (v${catalogVersion}). This indicates a gap in the activity catalog mapping.`,
            stage: "dependency-crosscheck",
            recoverable: true,
          });
          console.warn(`[Dependency CrossCheck] Gap detected: ${pkgName} found in XAML but not in proactive resolution — added from catalog preferred v${catalogVersion}`);
          resolved = true;
        }
      }
      if (!resolved) {
        const fallback = getBaselineFallbackVersion(pkgName, tf as "Windows" | "Portable");
        if (fallback) {
          deps[pkgName] = fallback;
          dependencyWarnings.push({
            code: "DEPENDENCY_DISCOVERED_IN_XAML",
            message: `Package ${pkgName} was discovered in emitted XAML but not in catalog — using validated metadata service version ${fallback}`,
            stage: "dependency-crosscheck",
            recoverable: true,
          });
          console.warn(`[Dependency CrossCheck] Using validated metadata service version for ${pkgName}: ${fallback}`);
        } else {
          const xamlFiles = xamlEntries
            ? xamlEntries.filter((e: { name: string; content: string }) => e.content.includes(pkgName)).map((e: { name: string; content: string }) => e.name)
            : [];
          const xamlContext = xamlFiles.length ? ` Found in XAML files: [${xamlFiles.join(", ")}].` : "";
          const layersChecked = [
            catalogService.isLoaded() ? "activity-catalog (getPreferredVersion): no match" : "activity-catalog: not loaded",
            "generation-metadata (getBaselineFallbackVersion): no match",
          ].join("; ");
          throw new Error(
            `[Dependency CrossCheck] FATAL: Package "${pkgName}" is referenced in emitted XAML but has no validated version.${xamlContext} ` +
            `Authority layers checked: [${layersChecked}]. ` +
            `Cannot emit a fabricated version — build aborted. Add this package to the generation-metadata.json packageVersionRanges or activity catalog to resolve.`
          );
        }
      }
    }

    validateAndEnforceDependencyCompatibility(deps, dependencyWarnings);

    {
      const feedValidationIssues: string[] = [];
      const allReferencedPackages = new Set(Array.from(scannedPackages));
      const nsAndAsmPkgs = extractXamlNamespaceAndAssemblyPackages(depAlignmentXamlContent);
      nsAndAsmPkgs.forEach(p => allReferencedPackages.add(p));
      for (const [pkgName, version] of Object.entries(deps)) {
        const versionRange = _metadataService.getPackageVersionRange(pkgName);
        if (!versionRange) {
          const referencedInXaml = allReferencedPackages.has(pkgName) || scannedPackages.has(pkgName);
          if (referencedInXaml) {
            feedValidationIssues.push(`${pkgName}@${version}`);
            dependencyWarnings.push({
              code: "DEPENDENCY_VERSION_UNVERIFIED",
              message: `Package ${pkgName}@${version} has no verified metadata entry — version may not exist on any NuGet feed. Workflows referencing this package may fail to restore.`,
              stage: "dependency-feed-validation",
              recoverable: false,
            });
            console.warn(`[Dependency Feed Validation] UNVERIFIED: ${pkgName}@${version} — no metadata entry, version existence cannot be confirmed`);
          }
          continue;
        }
        const cleanVersion = extractExactVersion(version);
        if (cleanVersion !== versionRange.preferred) {
          feedValidationIssues.push(`${pkgName}@${version} (preferred: ${versionRange.preferred})`);
          dependencyWarnings.push({
            code: "DEPENDENCY_VERSION_MISMATCH",
            message: `Package ${pkgName} resolved to ${version} but preferred verified version is ${versionRange.preferred} (source: ${versionRange.verificationSource}) — version may be stale`,
            stage: "dependency-feed-validation",
            recoverable: true,
          });
          console.warn(`[Dependency Feed Validation] VERSION MISMATCH: ${pkgName}@${version} vs preferred ${versionRange.preferred}`);
        }
        if (versionRange.verificationSource === "studio-bundled") {
          const catalogVersion = catalogService.isLoaded() ? catalogService.getPreferredVersion(pkgName) : null;
          if (catalogVersion && catalogVersion !== versionRange.preferred) {
            dependencyWarnings.push({
              code: "DEPENDENCY_STUDIO_BUNDLED_STALE",
              message: `Package ${pkgName}@${versionRange.preferred} uses studio-bundled version but catalog suggests ${catalogVersion} — consider verifying against NuGet feed`,
              stage: "dependency-feed-validation",
              recoverable: true,
            });
            console.warn(`[Dependency Feed Validation] STUDIO-BUNDLED STALE: ${pkgName}@${versionRange.preferred} — catalog suggests ${catalogVersion}`);
          }
        }
      }
      const unverifiedBlockingPkgs = dependencyWarnings.filter(w => w.code === "DEPENDENCY_VERSION_UNVERIFIED");
      if (unverifiedBlockingPkgs.length > 0) {
        const unverifiedNames = unverifiedBlockingPkgs.map(w => w.message.split(" ")[1] || "unknown").join(", ");
        console.error(`[Dependency Feed Validation] BLOCKING: ${unverifiedBlockingPkgs.length} XAML-referenced package(s) have no verified metadata: ${unverifiedNames}`);
        throw new Error(
          `Dependency feed validation failed: ${unverifiedBlockingPkgs.length} XAML-referenced package(s) have unverified versions that may not exist on any NuGet feed. Affected: ${feedValidationIssues.filter(i => !i.includes("preferred")).join(", ")}`
        );
      }
      if (feedValidationIssues.length > 0) {
        console.log(`[Dependency Feed Validation] ${feedValidationIssues.length} package(s) flagged (non-blocking): ${feedValidationIssues.join(", ")}`);
      } else {
        console.log(`[Dependency Feed Validation] All ${Object.keys(deps).length} package versions verified against metadata`);
      }
    }

    const allGaps = aggregateGaps(xamlResults);

    const entryPointId = generateUuid();
    const _metaTarget = _metadataService.getStudioTarget();
    if (!_studioProfile && !_metaTarget) {
      console.error("[PackageAssembler] DEGRADED MODE: No StudioProfile or MetadataService target available. Package metadata will be incomplete — this indicates a startup failure in MetadataService.");
    }
    const studioVer = _studioProfile?.studioVersion || _metaTarget?.version;
    if (!studioVer) {
      throw new Error("Cannot assemble package: Studio version is unavailable. MetadataService and StudioProfile both failed to load.");
    }
    const validatedStudioVer = isVersionFromValidatedSource(_studioProfile, _metaTarget);
    if (!validatedStudioVer) {
      throw new Error(
        `Cannot assemble package: Studio version "${studioVer}" is not from a validated source. ` +
        `Ensure generation-metadata.json is properly configured with a valid studioVersion.`
      );
    }
    if (validatedStudioVer !== studioVer) {
      console.warn(`[Studio Version] Using validated version ${validatedStudioVer} instead of derived version ${studioVer}`);
    }
    const projectJson: Record<string, any> = {
      name: projectName,
      description: pkg.description || "",
      main: "Main.xaml",
      dependencies: deps,
      webServices: [],
      entitiesStores: [],
      schemaVersion: "4.0",
      studioVersion: validatedStudioVer,
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
      expressionLanguage: resolveExpressionLanguage(_studioProfile, _metaTarget),
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
    if (_studioProfile) {
      projectJson.targetFramework = _studioProfile.targetFramework;
      projectJson.sourceLanguage = _studioProfile.expressionLanguage;
    } else if (_metaTarget) {
      projectJson.targetFramework = _metaTarget.targetFramework;
      projectJson.sourceLanguage = _metaTarget.expressionLanguage;
    } else if (isServerless) {
      projectJson.targetFramework = "Portable";
      projectJson.sourceLanguage = "CSharp";
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

    {
      const nsCoverageWarnings = validateNamespaceCoverage(allXamlContent, deps);
      const autoAddedPackages = new Set<string>();
      for (const warning of nsCoverageWarnings) {
        const pkgMatch = warning.match(/\(package: ([^)]+)\)/);
        if (pkgMatch) {
          const missingPkg = pkgMatch[1];
          if (!deps[missingPkg] && !isFrameworkAssembly(missingPkg)) {
            let version: string | null = null;
            if (catalogService.isLoaded()) {
              version = catalogService.getPreferredVersion(missingPkg);
            }
            if (!version) {
              version = getBaselineFallbackVersion(missingPkg, tf as "Windows" | "Portable");
            }
            if (version) {
              deps[missingPkg] = version;
              autoAddedPackages.add(missingPkg);
              console.log(`[Namespace Coverage] Auto-added missing dependency ${missingPkg}@${version} to satisfy namespace/assembly reference`);
            }
          }
        }
      }
      for (const warning of nsCoverageWarnings) {
        const pkgMatch = warning.match(/\(package: ([^)]+)\)/);
        if (pkgMatch && autoAddedPackages.has(pkgMatch[1])) {
          continue;
        }
        console.warn(`[Namespace Coverage] ${warning}`);
        dependencyWarnings.push({
          code: "NAMESPACE_MISSING_DEPENDENCY",
          message: warning,
          stage: "namespace-coverage-validation",
          recoverable: true,
        });
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
        const n = normalizeWorkflowName(d.name);
        if (!workflowNames.includes(n)) workflowNames.push(n);
      }
    }
    for (const wf of workflows) {
      const n = normalizeWorkflowName(wf.name || "Workflow");
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
        const rawCleaned = rawMissingFile.replace(/\\/g, "/").replace(/^[./]+/, "");
        const baseName = rawCleaned.replace(/\.xaml$/i, "");
        const normalizedBase = normalizeWorkflowName(baseName);
        const missingFile = normalizedBase + (rawCleaned.toLowerCase().endsWith(".xaml") ? ".xaml" : "");
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
    const placeholderCleanupRepairs: { repairCode: "REPAIR_PLACEHOLDER_CLEANUP"; file: string; description: string; developerAction: string; estimatedEffortMinutes: number }[] = [];
    for (let i = 0; i < xamlEntries.length; i++) {
      const content = xamlEntries[i].content;
      if (content.includes("PLACEHOLDER_") || content.includes("TODO_") || /\bTODO\b/.test(content) || /\bPLACEHOLDER\b/.test(content)) {
        const placeholderCount = (content.match(/\bPLACEHOLDER\b|\bTODO\b|PLACEHOLDER_|TODO_/g) || []).length;
        const commentReplacement = '<ui:Comment Text="REVIEW: Unknown activity type was generated here — implement manually" />';
        const afterTagSafety = content
          .replace(/<(ui:)?(?:TODO_|PLACEHOLDER_)(\w+)\b[^>]*?>[\s\S]*?<\/\1?(?:TODO_|PLACEHOLDER_)\2>/g, commentReplacement)
          .replace(/<(ui:)?(?:TODO_|PLACEHOLDER_)\w+\b[^>]*?\/>/g, commentReplacement);
        let cleaned = afterTagSafety
          .replace(/\[(?:PLACEHOLDER_\w*|TODO_\w*)\]/g, '[Nothing]')
          .replace(/="(?:PLACEHOLDER_\w*|TODO_\w*)"/g, '="[Nothing]"');

        cleaned = cleaned.replace(/="([^"]*\b(?:TODO|PLACEHOLDER)\b[^"]*)"/g, (_match, val) => {
          if (/^PLACEHOLDER_\w*$/.test(val) || /^TODO_\w*$/.test(val)) {
            return '="[Nothing]"';
          }
          return `="HANDOFF: ${val.replace(/\bTODO\b/g, "HANDOFF_TODO").replace(/\bPLACEHOLDER\b/g, "HANDOFF_PLACEHOLDER")}"`;
        });

        cleaned = cleaned.replace(/>([^<]*\b(?:TODO|PLACEHOLDER)\b[^<]*)</g, (_match, textContent) => {
          const sanitized = textContent
            .replace(/\bTODO\b/g, "HANDOFF_TODO")
            .replace(/\bPLACEHOLDER\b/g, "HANDOFF_PLACEHOLDER");
          return `>${sanitized}<`;
        });

        cleaned = cleaned
          .replace(/(?<!HANDOFF_)PLACEHOLDER_\w*/g, '')
          .replace(/(?<!HANDOFF_)TODO_\w*/g, '');
        xamlEntries[i] = { ...xamlEntries[i], content: cleaned };
        const archivePath = Array.from(deferredWrites.keys()).find(
          p => (p.split("/").pop() || p) === (xamlEntries[i].name.split("/").pop() || xamlEntries[i].name)
        );
        if (archivePath) {
          deferredWrites.set(archivePath, cleaned);
        } else {
          console.warn(`[UiPath Parity] No deferredWrites key found for basename "${xamlEntries[i].name}" during placeholder cleanup — skipping deferred update`);
        }
        const fileName = xamlEntries[i].name.split("/").pop() || xamlEntries[i].name;
        placeholderCleanupRepairs.push({
          repairCode: "REPAIR_PLACEHOLDER_CLEANUP" as const,
          file: fileName,
          description: `Stripped ${placeholderCount} placeholder token(s) from ${fileName}`,
          developerAction: `Review ${fileName} for Comment elements marking where placeholder activities were removed`,
          estimatedEffortMinutes: 5,
        });
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
      `${libPath}/DeveloperHandoffGuide.md`,
    ];

    const autoFixSummary: string[] = [];
    const outcomeRemediations: RemediationEntry[] = [];
    for (const fb of complianceFallbacks) {
      const wfBaseName = fb.file.replace(/\.xaml$/, "");
      const matchingSpec = allTreeEnrichments.get(wfBaseName);
      const wfPurpose = matchingSpec?.spec?.description || "";
      const targetSystem = (() => {
        if (!matchingSpec?.spec?.rootSequence?.children) return "";
        for (const child of matchingSpec.spec.rootSequence.children) {
          if (child.kind === "activity" && child.properties) {
            const sys = child.properties.Application || child.properties.BrowserType || child.properties.Target || "";
            if (sys) return sys;
          }
        }
        return "";
      })();
      const actionDescription = wfPurpose
        ? `TODO: Implement ${wfPurpose}${targetSystem ? ` (System: ${targetSystem})` : ""}`
        : `TODO: Implement ${wfBaseName}${targetSystem ? ` (System: ${targetSystem})` : ""} — review SDD for workflow requirements`;
      outcomeRemediations.push({
        level: "workflow",
        file: fb.file,
        remediationCode: "STUB_WORKFLOW_GENERATOR_FAILURE",
        reason: `Compliance transform failed — ${fb.reason}`,
        classifiedCheck: "compliance-crash",
        developerAction: actionDescription,
        estimatedEffortMinutes: 15,
      });
    }
    if (deferredHallucinatedRecoveries.length > 0) {
      for (const ha of deferredHallucinatedRecoveries) {
        outcomeRemediations.push({
          level: "activity",
          file: ha.file,
          remediationCode: "HALLUCINATED_ACTIVITY_STUBBED",
          originalTag: ha.template,
          originalDisplayName: ha.displayName,
          reason: `Activity template "${ha.template}" had >50% properties stripped — likely hallucinated or wrong activity type`,
          classifiedCheck: "EXCESSIVE_PROPERTIES_STRIPPED",
          developerAction: `Replace "${ha.template}" ("${ha.displayName}") with the correct UiPath activity from the catalog. The generated activity template does not match any known catalog entry well enough to be used directly.`,
          estimatedEffortMinutes: 15,
        });
      }
      console.log(`[UiPath Recovery] Registered ${deferredHallucinatedRecoveries.length} hallucinated activity remediation(s) — targeted for per-activity recovery instead of package-level downgrade`);
    }
    const outcomeAutoRepairs: AutoRepairEntry[] = [...placeholderCleanupRepairs];
    const structuralPreservationMetrics: StructuralPreservationMetrics[] = [];

    function mapCheckToRemediationCode(check: string): RemediationCode {
      const codeMap: Record<string, RemediationCode> = {
        "CATALOG_VIOLATION": "STUB_ACTIVITY_CATALOG_VIOLATION",
        "CATALOG_STRUCTURAL_VIOLATION": "STUB_ACTIVITY_CATALOG_VIOLATION",
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
        "CATALOG_STRUCTURAL_VIOLATION": 15,
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
        "CATALOG_STRUCTURAL_VIOLATION": `Fix property syntax for ${actLabel} in ${file} — move attribute to child-element or vice versa per UiPath catalog`,
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

          interface BatchedCorrection {
            fullTag: string;
            correction: ValidationCorrection;
            attrs: Record<string, string>;
          }
          const batchedCorrections: BatchedCorrection[] = [];
          const allCorrectedProperties = new Set<string>();

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
              for (const correction of validation.corrections) {
                batchedCorrections.push({ fullTag, correction, attrs: { ...attrs } });
              }

              for (const v of validation.violations) {
                const propMatch = v.match(/"([^"]+)"/);
                const violationProp = propMatch ? propMatch[1] : null;
                if (!violationProp) {
                  catalogViolations.push({ file: fileName, detail: v });
                }
              }
            }
          }

          if (batchedCorrections.length > 0) {
            const domResult = applyDomBasedCatalogCorrections(content, batchedCorrections, fileName);

            if (!domResult.fallbackUsed && domResult.applied > 0) {
              content = domResult.content;
              modified = true;
              for (const prop of domResult.correctedProperties) {
                allCorrectedProperties.add(prop);
              }
              for (const corr of batchedCorrections) {
                if (domResult.correctedProperties.has(corr.correction.property)) {
                  autoFixSummary.push(`Catalog (DOM): ${corr.correction.type} ${corr.fullTag}.${corr.correction.property} in ${fileName}`);
                }
              }
              console.log(`[Activity Catalog DOM] Applied ${domResult.applied} correction(s) to ${fileName} via DOM parse/serialize`);
            } else if (domResult.fallbackUsed) {
              const preCorrectionsSnapshot = content;
              for (const { fullTag, correction, attrs } of batchedCorrections) {
                const beforeThisCorrection = content;
                let correctionApplied = false;

                if (correction.type === "move-to-child-element") {
                  const propName = correction.property;
                  const propVal = attrs[propName];
                  if (propVal !== undefined) {
                    const wrapper = correction.argumentWrapper || "InArgument";
                    const xType = correction.typeArguments || clrToXamlType("System.String");

                    const escapedTag = fullTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const escapedVal = propVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const wrappedVal = ensureBracketWrapped(propVal);
                    const childElement = `<${fullTag}.${propName}>\n            <${wrapper} x:TypeArguments="${xType}">${wrappedVal}</${wrapper}>\n          </${fullTag}.${propName}>`;

                    const selfClosingRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)${propName}="${escapedVal}"([^>]*?)(\\s*\\/>)`);
                    const openTagRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)${propName}="${escapedVal}"([^>]*?>)`);

                    if (selfClosingRegex.test(content)) {
                      content = content.replace(selfClosingRegex, `$1 $2>\n          ${childElement}\n        </${fullTag}>`);
                      correctionApplied = true;
                      autoFixSummary.push(`Catalog (fallback): Moved ${fullTag}.${propName} from attribute to child-element in ${fileName}`);
                    } else if (openTagRegex.test(content)) {
                      content = content.replace(openTagRegex, `$1 $2\n          ${childElement}`);
                      correctionApplied = true;
                      autoFixSummary.push(`Catalog (fallback): Moved ${fullTag}.${propName} from attribute to child-element in ${fileName}`);
                    }
                  }
                } else if (correction.type === "fix-invalid-value" && correction.correctedValue) {
                  const propName = correction.property;
                  const oldVal = attrs[propName];
                  if (oldVal !== undefined) {
                    const escapedTag = fullTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const escapedOldVal = oldVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const attrFixRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)${propName}="${escapedOldVal}"`, "g");
                    const newContent = content.replace(attrFixRegex, `$1${propName}="${correction.correctedValue}"`);
                    if (newContent !== content) {
                      content = newContent;
                      correctionApplied = true;
                      autoFixSummary.push(`Catalog (fallback): Corrected ${fullTag}.${propName} value in ${fileName}`);
                    }
                  }
                } else if (correction.type === "wrap-in-argument" && correction.argumentWrapper) {
                  const propName = correction.property;
                  const className = fullTag.includes(":") ? fullTag.split(":").pop()! : fullTag;

                  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const wrapper = correction.argumentWrapper;
                  const xType = correction.typeArguments || clrToXamlType("System.String");

                  const childTagRegex = new RegExp(
                    `(<${escapedClassName}\\.${propName}>)\\s*(?!<(?:InArgument|OutArgument|InOutArgument)[\\s>\\n])([\\s\\S]*?)\\s*(<\\/${escapedClassName}\\.${propName}>)`,
                  );
                  const alreadyWrappedRegex = new RegExp(
                    `<${escapedClassName}\\.${propName}>[\\s\\n]*<(?:InArgument|OutArgument|InOutArgument)[\\s>]`,
                  );
                  if (childTagRegex.test(content) && !alreadyWrappedRegex.test(content)) {
                    content = content.replace(childTagRegex,
                      `$1\n            <${wrapper} x:TypeArguments="${xType}">$2</${wrapper}>\n          $3`
                    );
                    correctionApplied = true;
                    autoFixSummary.push(`Catalog (fallback): Wrapped ${fullTag}.${propName} in <${wrapper}> in ${fileName}`);
                  }
                }

                if (correctionApplied) {
                  const stepCheck = validateXmlWellFormedness(content);
                  if (!stepCheck.valid) {
                    console.warn(`[Activity Catalog Fallback] Correction ${correction.type} for ${fullTag}.${correction.property} in ${fileName} produced malformed XML — rolling back this step`);
                    content = beforeThisCorrection;
                  } else {
                    allCorrectedProperties.add(correction.property);
                    modified = true;
                  }
                }
              }

              if (modified) {
                const xmlWellFormedCheck = validateXmlWellFormedness(content);
                if (!xmlWellFormedCheck.valid) {
                  console.warn(`[Activity Catalog Fallback] Final corrections for ${fileName} still malformed — rolling back`);
                  content = preCorrectionsSnapshot;
                  modified = false;
                  allCorrectedProperties.clear();
                }
              }
            }

            for (const bc of batchedCorrections) {
              const freshAttrs: Record<string, string> = { ...bc.attrs };
              for (const corr of batchedCorrections) {
                if (corr.fullTag === bc.fullTag && corr.correction) {
                  freshAttrs[corr.correction.property] = corr.correction.correctedValue;
                }
              }
              const validation = catalogService.validateEmittedActivity(bc.fullTag, freshAttrs, []);
              for (const v of validation.violations) {
                const propMatch = v.match(/"([^"]+)"/);
                const violationProp = propMatch ? propMatch[1] : null;
                if (!violationProp || !allCorrectedProperties.has(violationProp)) {
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
            } else {
              console.warn(`[UiPath Parity] No deferredWrites key found for basename "${fileName}" during catalog conformance — skipping deferred update`);
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
      const entry = xamlEntries[i];
      const normalized = normalizeAssignArgumentNesting(entry.content);
      if (normalized !== entry.content) {
        console.log(`[XAML Post-Pass] ${entry.name}: normalized nested Assign argument wrappers`);
        xamlEntries[i] = { name: entry.name, content: normalized };
        const archivePath = Array.from(deferredWrites.keys()).find(
          p => (p.split("/").pop() || p) === entry.name
        );
        if (archivePath) {
          deferredWrites.set(archivePath, normalized);
        } else {
          console.warn(`[UiPath Parity] No deferredWrites key found for basename "${entry.name}" during assign normalization — skipping deferred update`);
        }
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
      content = content.replace(/<ui:TakeScreenshot\s+([^>]*?)FileName="([^"]*)"([^>]*?)\/>/g, (_match, before, _fileNameVal, after) => {
        const attrs = (before + after).trim();
        autoFixSummary.push(`Stripped TakeScreenshot FileName in ${xamlEntries[i].name}`);
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

      const mixedExprResult = fixMixedLiteralExpressionSyntax(content);
      if (mixedExprResult.fixes.length > 0) {
        content = mixedExprResult.content;
        for (const fix of mixedExprResult.fixes) {
          autoFixSummary.push(`Mixed-expression: ${fix} in ${xamlEntries[i].name}`);
        }
        wasFixed = true;
      }

      if (content !== xamlEntries[i].content) {
        xamlEntries[i] = { name: xamlEntries[i].name, content };
        const basename = xamlEntries[i].name.split("/").pop() || xamlEntries[i].name;
        const archivePath = Array.from(deferredWrites.keys()).find(p => (p.split("/").pop() || p) === basename);
        if (archivePath) {
          deferredWrites.set(archivePath, content);
        } else {
          console.warn(`[UiPath Parity] No deferredWrites key found for basename "${basename}" during XAML sanitization — skipping deferred update`);
        }
        if (!wasFixed) autoFixSummary.push(`Applied XAML sanitization fixes to ${xamlEntries[i].name}`);
      }
    }

    const usedFallback = false;

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
      } else {
        console.warn(`[UiPath Parity] No deferredWrites key found for basename "${basename}" during quality gate sync — skipping deferred update`);
      }
    }

    for (let i = 0; i < xamlEntries.length; i++) {
      const entry = xamlEntries[i];
      const loadResult = checkStudioLoadability(entry.content);
      if (!loadResult.loadable && loadResult.repairable) {
        const repair = repairMissingImplementation(entry.content, entry.name.split("/").pop() || entry.name);
        if (repair.repaired) {
          xamlEntries[i] = { name: entry.name, content: repair.content };
          const archivePath = Array.from(deferredWrites.keys()).find(k => (k.split("/").pop() || k) === (entry.name.split("/").pop() || entry.name));
          if (archivePath) deferredWrites.set(archivePath, repair.content);
        }
      }
    }

    const emissionGateMode = generationMode === "baseline_openable" ? "baseline" as const : "strict" as const;
    const emissionGateWarningsList: Array<{ code: string; message: string; file: string; line?: number; type: string }> = [];
    const workflowBusinessContext = buildWorkflowBusinessContextMap(
      sddContent || undefined,
      (pkg.workflows || []).map(w => ({
        name: w.name,
        description: w.description,
        steps: (w.steps || []).map(s => ({ activity: s.activity, notes: s.notes })),
      })),
    );
    const emissionGateResult = runEmissionGate(xamlEntries, emissionGateMode, workflowBusinessContext);
    if (emissionGateResult.violations.length > 0) {
      console.log(`[Emission Gate] Post-generation emission contract (${emissionGateMode} mode): ${emissionGateResult.summary.totalViolations} violation(s) — ${emissionGateResult.summary.stubbed} stubbed, ${emissionGateResult.summary.corrected} corrected, ${emissionGateResult.summary.blocked} blocked, ${emissionGateResult.summary.degraded} degraded`);
      for (const entry of xamlEntries) {
        const basename = entry.name.split("/").pop() || entry.name;
        const archivePath = Array.from(deferredWrites.keys()).find(p => (p.split("/").pop() || p) === basename);
        if (archivePath) {
          deferredWrites.set(archivePath, entry.content);
        }
      }
      if (emissionGateResult.blocked) {
        const blockedViolations = emissionGateResult.violations.filter(v => v.resolution === "blocked");
        const integrityBlocked = blockedViolations.filter(v => v.isIntegrityFailure === true);
        const nonIntegrityBlocked = blockedViolations.filter(v => v.isIntegrityFailure !== true);

        if (generationMode === "baseline_openable" && integrityBlocked.length === 0 && nonIntegrityBlocked.length > 0) {
          console.warn(`[Emission Gate] baseline_openable mode — ${nonIntegrityBlocked.length} non-integrity violation(s) treated as warnings (not blocking):`);
          for (const v of nonIntegrityBlocked) {
            console.warn(`[Emission Gate]   WARNING: ${v.file}${v.line ? `:${v.line}` : ""} — ${v.detail}`);
            emissionGateWarningsList.push({
              code: "EMISSION_GATE_SUPPRESSED",
              message: v.detail,
              file: v.file,
              line: v.line,
              type: v.type,
            });
          }
        } else {
          const diagnostics = blockedViolations.map(v => `  ${v.file}${v.line ? `:${v.line}` : ""} — ${v.detail}`).join("\n");
          console.error(`[Emission Gate] BLOCKING: ${blockedViolations.length} emission contract violation(s) cannot be safely remediated:\n${diagnostics}`);
          throw new QualityGateError(
            `[Emission Gate] Packaging blocked: ${blockedViolations.length} emission contract violation(s) cannot be safely remediated. ` +
            blockedViolations.map(v => `${v.file}${v.line ? `:${v.line}` : ""}: ${v.detail}`).join("; ")
          );
        }
      }
    }

    const normalizedFields = finalNormalize(xamlEntries, deferredWrites);
    if (normalizedFields.size > 0) {
      console.log(`[Final Normalization] Normalized fields before quality gate: ${Array.from(normalizedFields).join(", ")}`);
    }

    for (const entry of xamlEntries) {
      const shortName = entry.name.split("/").pop() || entry.name;
      updateStageHash(shortName, "postNormalization", entry.content);
    }

    const qualityGateRunCount = 1;
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
    const initialQGViolationCount = qualityGateResult.violations?.length || 0;

    if (catalogViolations.length > 0) {
      const existingKeys = new Set(
        qualityGateResult.violations
          .filter(v => v.check === "CATALOG_VIOLATION" || v.check === "ENUM_VIOLATION" || v.check === "CATALOG_STRUCTURAL_VIOLATION")
          .map(v => `${v.file}::${v.detail}`)
      );
      let addedWarnings = 0;
      let addedErrors = 0;
      for (const cv of catalogViolations) {
        const key = `${cv.file}::${cv.detail}`;
        if (!existingKeys.has(key)) {
          const isEnumViolation = cv.detail.includes("ENUM_VIOLATION");
          const isStructuralViolation = cv.detail.includes("must be a child element") ||
            cv.detail.includes("should be an attribute") ||
            cv.detail.includes("move-to-child-element") ||
            cv.detail.includes("move-to-attribute");
          const severity = (isEnumViolation || isStructuralViolation) ? "error" as const : "warning" as const;
          const check = isEnumViolation ? "ENUM_VIOLATION" :
            isStructuralViolation ? "CATALOG_STRUCTURAL_VIOLATION" : "CATALOG_VIOLATION";
          qualityGateResult.violations.push({
            category: "accuracy",
            severity,
            check,
            file: cv.file,
            detail: cv.detail,
          });
          existingKeys.add(key);
          if (severity === "error") {
            addedErrors++;
          } else {
            addedWarnings++;
          }
        }
      }
      if (addedWarnings > 0) {
        qualityGateResult.summary.accuracyWarnings = (qualityGateResult.summary.accuracyWarnings || 0) + addedWarnings;
        qualityGateResult.summary.totalWarnings += addedWarnings;
      }
      if (addedErrors > 0) {
        qualityGateResult.summary.accuracyErrors = (qualityGateResult.summary.accuracyErrors || 0) + addedErrors;
        qualityGateResult.summary.totalErrors = (qualityGateResult.summary.totalErrors || 0) + addedErrors;
        qualityGateResult.passed = false;
      }
    }

    {
      const classifiedIssues = classifyQualityIssues(qualityGateResult);
      for (const ci of classifiedIssues) {
        collectedQualityIssues.push({
          severity: ci.severity,
          file: ci.file,
          check: ci.check,
          detail: ci.detail,
        });
        if (ci.severity === "blocking") {
          outcomeRemediations.push({
            level: "validation-finding",
            file: ci.file,
            remediationCode: mapCheckToRemediationCode(ci.check),
            reason: ci.detail,
            classifiedCheck: ci.check,
            developerAction: developerActionForCheck(ci.check, ci.file),
            estimatedEffortMinutes: estimateEffortForCheck(ci.check),
          });
        }
      }
      if (!qualityGateResult.passed) {
        console.log(`[UiPath Quality Gate] Validation found ${qualityGateResult.summary.totalErrors} error(s), ${qualityGateResult.summary.totalWarnings} warning(s) — reporting in DHG without remediation`);
      }
    }

    {
      const allXamlForProactive = xamlEntries.map(e => e.content).join("\n");
      const PROACTIVE_PREFIX_PACKAGES: Record<string, string> = {
        "umail:": "UiPath.Mail.Activities",
        "upers:": "UiPath.Persistence.Activities",
        "uexcel:": "UiPath.Excel.Activities",
        "uauto:": "UiPath.UIAutomation.Activities",
        "uweb:": "UiPath.WebAPI.Activities",
        "uwebapi:": "UiPath.WebAPI.Activities",
        "udb:": "UiPath.Database.Activities",
        "ucred:": "UiPath.Credentials.Activities",
        "utest:": "UiPath.Testing.Activities",
        "uform:": "UiPath.Form.Activities",
        "ugs:": "UiPath.GSuite.Activities",
        "uo365:": "UiPath.MicrosoftOffice365.Activities",
        "snetmail:": "System",
      };
      for (const [prefix, pkgName] of Object.entries(PROACTIVE_PREFIX_PACKAGES)) {
        if (allXamlForProactive.includes(`<${prefix}`) || allXamlForProactive.includes(`</${prefix}`)) {
          if (pkgName === "System") continue;
          if (!deps[pkgName]) {
            if (catalogService.isLoaded()) {
              const catalogVersion = catalogService.getPreferredVersion(pkgName);
              if (catalogVersion) {
                deps[pkgName] = catalogVersion;
                autoFixSummary.push(`Proactively added ${pkgName}@${catalogVersion} — ${prefix} activities detected in XAML`);
                console.log(`[Dependency Proactive] Added ${pkgName}@${catalogVersion} — ${prefix} prefix detected in emitted XAML`);
                continue;
              }
            }
            const fallback = getBaselineFallbackVersion(pkgName, tf as "Windows" | "Portable");
            if (fallback) {
              deps[pkgName] = fallback;
              autoFixSummary.push(`Proactively added ${pkgName}@${fallback} — ${prefix} activities detected in XAML`);
              console.log(`[Dependency Proactive] Added ${pkgName}@${fallback} — ${prefix} prefix detected in emitted XAML`);
            }
          }
        }
      }
      const hasNewtonsoftTypesProactive = /JObject|JToken|JArray|JsonConvert|Newtonsoft/i.test(allXamlForProactive);
      if (hasNewtonsoftTypesProactive && !deps["Newtonsoft.Json"]) {
        const njtVersion = catalogService.isLoaded() ? catalogService.getPreferredVersion("Newtonsoft.Json") : null;
        const resolvedNjt = njtVersion || "13.0.3";
        deps["Newtonsoft.Json"] = resolvedNjt;
        autoFixSummary.push(`Proactively added Newtonsoft.Json@${resolvedNjt} — Newtonsoft types detected in XAML`);
        console.log(`[Dependency Proactive] Added Newtonsoft.Json@${resolvedNjt} — JSON types detected in emitted XAML`);
      }
    }

    {
      const depsAfterScan = scanXamlForRequiredPackages(xamlEntries.map(e => e.content).join("\n"));
      for (const rawPkgName of depsAfterScan) {
        const pkgName = normalizePackageName(rawPkgName);
        if (deps[pkgName]) continue;
        if (isFrameworkAssembly(pkgName)) {
          console.log(`[Dependency CrossCheck] Rejected framework assembly from post-meta-validation scan: ${pkgName}`);
          continue;
        }
        if (catalogService.isLoaded()) {
          const catalogVersion = catalogService.getPreferredVersion(pkgName);
          if (catalogVersion) {
            deps[pkgName] = catalogVersion;
            autoFixSummary.push(`Added dependency from catalog crosscheck: ${pkgName}@${catalogVersion}`);
            console.warn(`[Dependency CrossCheck] Post-fix gap: ${pkgName} discovered in XAML after meta-validation — added from catalog preferred v${catalogVersion}`);
            continue;
          }
        }
        const fallback = getBaselineFallbackVersion(pkgName, tf as "Windows" | "Portable");
        if (fallback) {
          deps[pkgName] = fallback;
          autoFixSummary.push(`Added dependency from validated metadata service: ${pkgName}@${fallback}`);
          console.warn(`[Dependency CrossCheck] Post-fix: using validated metadata service version for ${pkgName}: ${fallback}`);
        } else {
          const postRemXamlFiles = xamlEntries
            ? xamlEntries.filter((e: { name: string; content: string }) => e.content.includes(pkgName)).map((e: { name: string; content: string }) => e.name)
            : [];
          const postRemXamlContext = postRemXamlFiles.length ? ` Found in XAML files: [${postRemXamlFiles.join(", ")}].` : "";
          const postRemLayersChecked = [
            catalogService.isLoaded() ? "activity-catalog (getPreferredVersion): no match" : "activity-catalog: not loaded",
            "generation-metadata (getBaselineFallbackVersion): no match",
          ].join("; ");
          throw new Error(
            `[Dependency CrossCheck] FATAL: Package "${pkgName}" is referenced in post-remediation XAML but has no validated version.${postRemXamlContext} ` +
            `Authority layers checked: [${postRemLayersChecked}]. ` +
            `Build aborted. Add this package to the generation-metadata.json packageVersionRanges or activity catalog.`
          );
        }
      }

      {
        const allXamlForNewtonsoftCheck = xamlEntries.map(e => e.content).join("\n");
        const hasNewtonsoftTypes = /JObject|JToken|JArray|JsonConvert|Newtonsoft/i.test(allXamlForNewtonsoftCheck);
        if (hasNewtonsoftTypes && !deps["Newtonsoft.Json"]) {
          const newtonsoftVersion = catalogService.isLoaded()
            ? catalogService.getPreferredVersion("Newtonsoft.Json")
            : null;
          const resolvedVersion = newtonsoftVersion || "13.0.3";
          deps["Newtonsoft.Json"] = resolvedVersion;
          autoFixSummary.push(`Proactively added Newtonsoft.Json@${resolvedVersion} — Newtonsoft types detected in XAML`);
          console.log(`[Dependency Proactive] Added Newtonsoft.Json@${resolvedVersion} — JObject/JToken/JArray/JsonConvert types detected in XAML`);
        }
        const hasWebAPIPackage = deps["UiPath.WebAPI.Activities"] || deps["UiPath.Web.Activities"];
        if (deps["UiPath.Web.Activities"] && !deps["UiPath.WebAPI.Activities"]) {
          const webVersion = deps["UiPath.Web.Activities"];
          delete deps["UiPath.Web.Activities"];
          deps["UiPath.WebAPI.Activities"] = catalogService.isLoaded()
            ? (catalogService.getPreferredVersion("UiPath.WebAPI.Activities") || "2.4.0")
            : "2.4.0";
          autoFixSummary.push(`Migrated legacy UiPath.Web.Activities@${webVersion} → UiPath.WebAPI.Activities@${deps["UiPath.WebAPI.Activities"]}`);
          console.log(`[Dependency Migration] Migrated UiPath.Web.Activities → UiPath.WebAPI.Activities`);
        }
        if (hasWebAPIPackage && !deps["Newtonsoft.Json"]) {
          const newtonsoftVersion = catalogService.isLoaded()
            ? catalogService.getPreferredVersion("Newtonsoft.Json")
            : null;
          const resolvedVersion = newtonsoftVersion || "13.0.3";
          deps["Newtonsoft.Json"] = resolvedVersion;
          autoFixSummary.push(`Proactively added Newtonsoft.Json@${resolvedVersion} — required by UiPath.WebAPI.Activities`);
          console.log(`[Dependency Proactive] Added Newtonsoft.Json@${resolvedVersion} — required by UiPath.WebAPI.Activities dependency`);
        }
      }

      validateAndEnforceDependencyCompatibility(deps, dependencyWarnings);
    }

    if (autoFixSummary.length > 0) {
      console.log(`[UiPath Auto-Fix] Applied ${autoFixSummary.length} proven-safe fix(es):\n${autoFixSummary.map(s => `  - ${s}`).join("\n")}`);
    }

    if (!qualityGateResult.passed) {
      const formattedViolations = formatQualityGateViolations(qualityGateResult);
      if (generationMode === "baseline_openable") {
        console.warn(`[UiPath Quality Gate] baseline_openable mode — ${qualityGateResult.summary.totalErrors} error(s) reported as validation issues (non-blocking):\n${formattedViolations}`);
      } else {
        console.warn(`[UiPath Quality Gate] Validation found ${qualityGateResult.summary.totalErrors} error(s) — reported in DHG without remediation:\n${formattedViolations}`);
      }
    }

    {
      const warnCount = qualityGateResult.summary.totalWarnings;
      const errorCount = qualityGateResult.summary.totalErrors;
      const evidenceCount = qualityGateResult.positiveEvidence?.length || 0;
      const readiness = qualityGateResult.readiness;
      const status = readiness === "SUCCESS" ? "PASSED"
        : readiness === "READY_WITH_WARNINGS" ? "PASSED_WITH_WARNINGS"
        : "NEEDS_ATTENTION";
      console.log(`[UiPath Quality Gate] ${status} (readiness: ${readiness})${errorCount > 0 ? `, ${errorCount} error(s)` : ""}${warnCount > 0 ? `, ${warnCount} warning(s)` : ""}${stubsGenerated.length > 0 ? `, ${stubsGenerated.length} stub(s) generated` : ""}, ${evidenceCount} positive evidence item(s)`);

      const totalActivities = xamlEntries.reduce((sum, e) => {
        const matches = e.content.match(/<([\w:]+)\s[^>]*DisplayName="/g);
        return sum + (matches ? matches.length : 0);
      }, 0);
      const postComplianceDefectCount = totalPostComplianceReCorrections;

      const convergenceMetrics = {
        qualityGateRunCount,
        cascadeAmplificationRatio: 1.0,
        stubRatio: 0,
        stubbedActivities: 0,
        totalActivities,
        qualityGateStatus: status,
        readiness,
        autoRepairsApplied: autoFixSummary.length,
        initialViolationCount: initialQGViolationCount,
        finalViolationCount: qualityGateResult.violations?.length || 0,
        dhgAccuracy: computeDhgAccuracy({
          usedFallbackStubs: stubsGenerated.length > 0,
          outcomeReport: qualityGateResult ? {
            remediations: qualityGateResult.violations?.map(v => ({ level: v.severity || "warning" })) || [],
            studioCompatibility: qualityGateResult.violations?.filter(v => v.category === "studio-blocked").map(v => ({ level: "studio-blocked" })) || [],
            fullyGeneratedFiles: xamlEntries.filter(e => !stubsGenerated.includes(e.name)).map(e => e.name),
          } : undefined,
          xamlEntries,
        }),
        usedFallbackStubs: stubsGenerated.length > 0,
        postComplianceDefectCount,
        complianceIdempotencyRate: postComplianceDefectCount === 0 ? 1.0 : Math.max(0, 1 - (postComplianceDefectCount / Math.max(1, totalActivities))),
      };
      console.log(`[Pipeline Convergence Metrics] ${JSON.stringify(convergenceMetrics)}`);
    }

    if (orchestratorArtifacts?.agents?.length > 0) {
      for (const agent of orchestratorArtifacts.agents) {
        const agentFileName = `Agent_${(agent.name || "Unnamed").replace(/\s+/g, "_")}.json`;
        const agentConfig = JSON.stringify({
          name: agent.name,
          agentType: agent.agentType || "autonomous",
          description: agent.description || "",
          systemPrompt: agent.systemPrompt || "",
          tools: agent.tools || [],
          contextGrounding: agent.contextGrounding || undefined,
          knowledgeBases: agent.knowledgeBases || [],
          guardrails: agent.guardrails || [],
          escalationRules: agent.escalationRules || [],
          inputSchema: agent.inputSchema || undefined,
          outputSchema: agent.outputSchema || undefined,
          maxIterations: agent.maxIterations || 10,
          temperature: agent.temperature ?? 0.3,
          provisionedBy: "CannonBall",
          provisionedAt: new Date().toISOString(),
        }, null, 2);
        archive.append(agentConfig, { name: `${libPath}/Agents/${agentFileName}` });
        console.log(`[UiPath] Included agent config "${agentFileName}" in package for Agent Builder import`);
      }
    }

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
      console.error(`[UiPath Pre-Package Validation] ${severeValidationErrors.length} severe violation(s) found — attempting per-file remediation:\n${details}`);

      const corruptedFiles = new Set(severeValidationErrors.map(v => v.file));
      const allCorrupted = corruptedFiles.size >= xamlEntries.length;

      if (allCorrupted) {
        throw new Error(
          `UiPath pre-package validation failed with ${severeValidationErrors.length} severe violation(s) (all files corrupted):\n${details}`
        );
      }

      let remediationFailed = false;
      for (const corruptedFile of corruptedFiles) {
        const stubName = corruptedFile.replace(/\.xaml$/i, "");
        const corruptedEntry = xamlEntries.find(e => e.name === corruptedFile || (e.name.split("/").pop() || e.name) === corruptedFile);
        const corruptedContent = corruptedEntry?.content || "";
        const extractedArgs: Array<{ name: string; direction: string; type: string }> = [];
        const extractedVars: Array<{ name: string; type: string; defaultValue?: string }> = [];
        const propPattern = /<x:Property\s+Name="([^"]+)"\s+Type="([^"]+)"/g;
        let propMatch;
        while ((propMatch = propPattern.exec(corruptedContent)) !== null) {
          const argName = propMatch[1];
          const typeStr = propMatch[2];
          let direction = "InArgument";
          if (typeStr.includes("OutArgument")) direction = "OutArgument";
          else if (typeStr.includes("InOutArgument")) direction = "InOutArgument";
          const typeMatch = typeStr.match(/Argument\(([^)]+)\)/);
          const baseType = typeMatch ? typeMatch[1] : "x:String";
          extractedArgs.push({ name: argName, direction, type: baseType });
        }
        const varPattern = /<Variable\s+(?:x:TypeArguments="([^"]+)"\s+Name="([^"]+)"|Name="([^"]+)"\s+x:TypeArguments="([^"]+)")(?:\s+Default="([^"]*)")?/g;
        let varMatch;
        while ((varMatch = varPattern.exec(corruptedContent)) !== null) {
          const varType = varMatch[1] || varMatch[4] || "x:String";
          const varName = varMatch[2] || varMatch[3] || "";
          const defVal = varMatch[5];
          if (varName) extractedVars.push({ name: varName, type: varType, ...(defVal ? { defaultValue: defVal } : {}) });
        }
        let finalArgs = extractedArgs;
        let finalVars = extractedVars;
        if (finalVars.length === 0) {
          const matchingSpec = workflows.find(wf => {
            const specName = (wf.name || "").replace(/\s+/g, "_");
            return specName === stubName || specName + ".xaml" === corruptedFile;
          });
          if (matchingSpec && matchingSpec.variables && matchingSpec.variables.length > 0) {
            finalVars = matchingSpec.variables.map(v => ({
              name: v.name,
              type: v.type || "x:String",
              ...(v.defaultValue ? { defaultValue: v.defaultValue } : {}),
            }));
          }
        }
        if (finalArgs.length === 0) {
          const specArgs = treeEnrichment?.status === "success" && treeEnrichment.workflowSpec?.arguments?.length
            ? treeEnrichment.workflowSpec.arguments
            : enrichment?.arguments?.length ? enrichment.arguments : null;
          if (specArgs) {
            finalArgs = specArgs.map(a => ({
              name: a.name,
              direction: a.direction || "InArgument",
              type: a.type || "x:String",
            }));
          }
        }
        const isMainFile = corruptedFile === "Main.xaml" || corruptedFile === `${mainWfName}.xaml`;
        let invokeWorkflows: Array<{ displayName: string; fileName: string }> | undefined;
        if (isMainFile) {
          const effectiveWorkflowNames = nonMainWorkflowNames.length > 0
            ? nonMainWorkflowNames
            : Array.from(generatedWorkflowNames).filter(n => n !== "Main" && n !== "Process");
          if (effectiveWorkflowNames.length > 0) {
            const seenFiles = new Set<string>();
            invokeWorkflows = [];
            const initFile = "InitAllSettings.xaml";
            if (!seenFiles.has(initFile)) {
              seenFiles.add(initFile);
              invokeWorkflows.push({ displayName: "Initialize All Settings", fileName: initFile });
            }
            for (const name of effectiveWorkflowNames) {
              const fn = `${name}.xaml`;
              if (!seenFiles.has(fn) && name !== stubName) {
                seenFiles.add(fn);
                invokeWorkflows.push({ displayName: name, fileName: fn });
              }
            }
            console.log(`[UiPath Pre-Package Validation] Main.xaml stub will preserve ${invokeWorkflows.length} InvokeWorkflowFile reference(s) to maintain sub-workflow reachability`);
          }
        }
        const stubXaml = generateStubWorkflow(stubName, {
          reason: `Final validation remediation — original XAML had well-formedness violations`,
          arguments: finalArgs.length > 0 ? finalArgs : undefined,
          variables: finalVars.length > 0 ? finalVars : undefined,
          invokeWorkflows: invokeWorkflows && invokeWorkflows.length > 0 ? invokeWorkflows : undefined,
        });
        let stubCompliant: string;
        try {
          stubCompliant = compliancePass(stubXaml, corruptedFile, true);
        } catch (stubCompErr: any) {
          if (corruptedFile === "Main.xaml") {
            remediationFailed = true;
            console.error(`[UiPath Pre-Package Validation] Cannot remediate entry-point Main.xaml — stub compliance also failed: ${stubCompErr.message}`);
            continue;
          }
          stubCompliant = stubXaml;
        }
        const entryIdx = xamlEntries.findIndex(e => e.name === corruptedFile || (e.name.split("/").pop() || e.name) === corruptedFile);
        if (entryIdx >= 0) {
          xamlEntries[entryIdx] = { ...xamlEntries[entryIdx], content: stubCompliant };
        }
        const archivePath = Array.from(deferredWrites.keys()).find(
          p => (p.split("/").pop() || p) === corruptedFile
        );
        if (archivePath) {
          deferredWrites.set(archivePath, stubCompliant);
        } else {
          console.warn(`[UiPath Parity] No deferredWrites key found for basename "${corruptedFile}" during final validation remediation — skipping deferred update`);
        }
        const fileSpecificErrors = severeValidationErrors
          .filter(v => v.file === corruptedFile)
          .map(v => `[${v.check}] ${v.detail}`);
        const specificErrorDetail = fileSpecificErrors.length > 0
          ? fileSpecificErrors.join("; ")
          : "No specific error details captured";
        outcomeRemediations.push({
          level: "workflow",
          file: corruptedFile,
          remediationCode: "STUB_WORKFLOW_BLOCKING",
          reason: `Final validation: XAML well-formedness violations — replaced with stub. Details: ${specificErrorDetail}`,
          classifiedCheck: "xml-wellformedness",
          developerAction: `Fix XML structure in ${corruptedFile} — ${specificErrorDetail}`,
          estimatedEffortMinutes: 15,
        });
        console.warn(`[UiPath Pre-Package Validation] Remediated corrupted file "${corruptedFile}" with stub workflow. Specific errors: ${specificErrorDetail}`);
      }

      if (remediationFailed) {
        throw new Error(
          `UiPath pre-package validation failed — entry-point Main.xaml corrupted and stub remediation failed:\n${details}`
        );
      }
    }

    const archiveWfNames = Array.from(deferredWrites.keys())
      .filter(k => k.endsWith(".xaml"))
      .map(k => {
        const baseName = (k.split("/").pop() || k);
        return baseName.replace(/\.xaml$/i, "");
      });

    const stubRemediationFiles = new Set(
      outcomeRemediations
        .filter(r => r.remediationCode === "STUB_WORKFLOW_BLOCKING" || r.remediationCode === "STUB_WORKFLOW_GENERATOR_FAILURE")
        .map(r => r.file.replace(/\.xaml$/i, ""))
    );
    const complianceFallbackFiles = new Set(complianceFallbacks.map(fb => fb.file.replace(/\.xaml$/i, "")));
    for (const cf of complianceFallbackFiles) stubRemediationFiles.add(cf);
    const entryPointStubbed = stubRemediationFiles.has("Main") || earlyStubFallbacks.includes("Main.xaml") || complianceFallbackFiles.has("Main");
    const stubCount = stubRemediationFiles.size + earlyStubFallbacks.filter(f => !stubRemediationFiles.has(f.replace(/\.xaml$/i, ""))).length;
    const archiveWfSet = new Set(archiveWfNames);
    const plannedButMissingCount = workflowNames.filter(n => !archiveWfSet.has(n)).length;

    let assemblerStudioBlockedCount = stubCount;
    let assemblerStudioLoadableCount = Math.max(0, archiveWfSet.size - stubCount);
    for (const entry of xamlEntries) {
      const shortName = (entry.name.split("/").pop() || entry.name).replace(/\.xaml$/i, "");
      if (stubRemediationFiles.has(shortName) || earlyStubFallbacks.includes(shortName + ".xaml")) continue;
      const nsFixResult = injectMissingNamespaceDeclarations(entry.content);
      if (nsFixResult.injected.length > 0) {
        entry.content = nsFixResult.xml;
        const archivePathNs = Array.from(deferredWrites.keys()).find(k => (k.split("/").pop() || k) === (entry.name.split("/").pop() || entry.name));
        if (archivePathNs) deferredWrites.set(archivePathNs, nsFixResult.xml);
        console.log(`[Package Assembler] Injected missing xmlns for ${shortName}: ${nsFixResult.injected.join(", ")}`);
      }

      let loadability = checkStudioLoadability(entry.content);
      if (!loadability.loadable && loadability.repairable) {
        const repair = repairMissingImplementation(entry.content, entry.name.split("/").pop() || entry.name);
        if (repair.repaired) {
          entry.content = repair.content;
          const archivePath = Array.from(deferredWrites.keys()).find(k => (k.split("/").pop() || k) === (entry.name.split("/").pop() || entry.name));
          if (archivePath) deferredWrites.set(archivePath, repair.content);
          loadability = checkStudioLoadability(entry.content);
        }
      }
      if (!loadability.loadable) {
        assemblerStudioBlockedCount++;
        assemblerStudioLoadableCount = Math.max(0, assemblerStudioLoadableCount - 1);
      }
    }

    const stubAwareness = {
      entryPointStubbed,
      stubCount,
      totalWorkflowCount: archiveWfSet.size,
      plannedButMissingCount,
      studioLoadableCount: assemblerStudioLoadableCount,
      studioBlockedCount: assemblerStudioBlockedCount,
    };

    const qualityWarningCount = qualityGateResult.violations.filter(v => v.severity === "warning").length;
    const remediationCount = outcomeRemediations.length;
    const emptyContainerCount = qualityGateResult.violations.filter(v => v.check === "empty-container" && v.severity === "error").length;

    const archiveXamlEntries = Array.from(deferredWrites.entries())
      .filter(([k]) => k.endsWith(".xaml"))
      .map(([name, content]) => ({ name, content }));

    const dhgAllFiles = new Set(
      Array.from(deferredWrites.keys())
        .filter(k => k.endsWith(".xaml"))
        .map(k => {
          const baseName = k.split("/").pop() || k;
          return baseName.endsWith(".xaml") ? baseName : `${baseName}.xaml`;
        })
    );
    const dhgRemediatedFileSet = new Set(outcomeRemediations.map(r => r.file));
    const dhgStructuralDefectChecks = new Set([
      "placeholder-value",
      "empty-container",
      "empty-http-endpoint",
      "unassigned-decision-variable",
      "expression-syntax-mismatch",
      "invalid-type-argument",
      "invalid-default-value",
      "invalid-trycatch-structure",
      "invalid-catch-type",
      "invalid-activity-property",
      "invalid-continue-on-error",
      "invoke-arg-type-mismatch",
      "undeclared-variable",
      "unknown-activity",
      "undeclared-namespace",
      "policy-blocked-activity",
      "invalid-takescreenshot-result",
      "invalid-takescreenshot-outputpath",
      "invalid-takescreenshot-outputpath-attr",
      "invalid-takescreenshot-filename",
      "invalid-takescreenshot-filename-attr",
      "object-object",
      "pseudo-xaml",
      "fake-trycatch",
      "EXPRESSION_SYNTAX",
      "EXPRESSION_SYNTAX_UNFIXABLE",
      "TYPE_MISMATCH",
      "FOREACH_TYPE_MISMATCH",
      "LITERAL_TYPE_ERROR",
    ]);
    const dhgFilesWithStructuralDefects = new Set(
      qualityGateResult.violations
        .filter(v => v.severity === "error" && dhgStructuralDefectChecks.has(v.check))
        .map(v => v.file)
    );
    const DHG_STUB_CONTENT_PATTERNS = AUTHORITATIVE_STUB_PATTERNS;
    const dhgFilesWithStubContent = new Set<string>();
    const dhgStudioNonLoadableFiles = new Set<string>();
    const dhgStudioLoadabilityReasons = new Map<string, string>();
    for (const entry of xamlEntries) {
      const shortName = entry.name.split("/").pop() || entry.name;
      if (DHG_STUB_CONTENT_PATTERNS.some(pattern => entry.content.includes(pattern))) {
        dhgFilesWithStubContent.add(shortName);
      }
      let loadability = checkStudioLoadability(entry.content);
      if (!loadability.loadable && loadability.repairable) {
        const repair = repairMissingImplementation(entry.content, shortName);
        if (repair.repaired) {
          entry.content = repair.content;
          const archivePath = Array.from(deferredWrites.keys()).find(k => (k.split("/").pop() || k) === shortName);
          if (archivePath) deferredWrites.set(archivePath, repair.content);
          loadability = checkStudioLoadability(entry.content);
        }
      }
      if (!loadability.loadable) {
        dhgStudioNonLoadableFiles.add(shortName);
        dhgStudioLoadabilityReasons.set(shortName, loadability.reason || "Unknown Studio-loadability failure");
        console.log(`[Studio-Loadability] ${shortName}: NOT loadable — ${loadability.reason}`);
      }
    }
    const dhgFilesWithBlockingFindings = new Set<string>();
    for (const v of qualityGateResult.violations) {
      if (v.severity === "error") {
        dhgFilesWithBlockingFindings.add(v.file || "unknown");
      }
    }
    const dhgFilesWithCatalogViolations = new Set<string>();
    for (const v of qualityGateResult.violations) {
      if (v.check === "CATALOG_STRUCTURAL_VIOLATION" || v.check === "CATALOG_VIOLATION") {
        dhgFilesWithCatalogViolations.add(v.file || "unknown");
      }
    }
    const dhgFullyGenerated = Array.from(dhgAllFiles).filter(f =>
      !dhgRemediatedFileSet.has(f) &&
      !earlyStubFallbacks.includes(f) &&
      !dhgFilesWithStructuralDefects.has(f) &&
      !dhgFilesWithStubContent.has(f) &&
      !dhgStudioNonLoadableFiles.has(f) &&
      !dhgFilesWithBlockingFindings.has(f) &&
      !dhgFilesWithCatalogViolations.has(f)
    );

    const dhgQualityWarnings = qualityGateResult.violations
      .filter(v => v.severity === "warning")
      .map(v => ({
        check: v.check,
        file: v.file || "unknown",
        detail: v.detail,
        severity: v.severity as "warning",
        businessContext: v.businessContext,
        stubCategory: v.stubCategory,
      }));

    for (const v of qualityGateResult.violations) {
      if ((v.check === "UNDECLARED_VARIABLE" || v.check === "undeclared-variable") && v.severity === "error") {
        const varMatch = v.detail.match(/variable "([^"]+)"/);
        const varName = varMatch ? varMatch[1] : "unknown";
        const exprMatch = v.detail.match(/in expression: (.+?)(?:\s*—|$)/);
        const exprContext = exprMatch ? exprMatch[1].trim() : "";
        const prefixType = inferTypeFromPrefix(varName);
        outcomeRemediations.push({
          level: "activity",
          file: v.file || "unknown",
          remediationCode: "UNDECLARED_VARIABLE_MANUAL",
          reason: `Undeclared variable "${varName}" — type cannot be auto-inferred (no recognized naming prefix)`,
          classifiedCheck: "UNDECLARED_VARIABLE",
          developerAction: `Declare variable "${varName}" in ${v.file || "unknown"} with the appropriate type. Expression context: ${exprContext || v.detail}`,
          estimatedEffortMinutes: 5,
          inferredType: prefixType ?? undefined,
        });
      }
      if (v.check === "invoke-arg-type-mismatch" && v.severity === "error") {
        const argMatch = v.detail.match(/argument "([^"]+)" passed as ([^\s]+) to "([^"]+)" but declared as ([^\s]+)/);
        if (argMatch) {
          const [, argName, passedType, targetFile, declaredType] = argMatch;
          const conversion = getConversion(passedType, declaredType);
          if (conversion && conversion.kind === "wrap" && conversion.wrapper) {
            const file = v.file || "unknown";
            const deferredKey = Array.from(deferredWrites.keys()).find(k => {
              const name = (k.split("/").pop() || k);
              return name === file;
            });
            if (deferredKey) {
              const content = deferredWrites.get(deferredKey)!;
              const argBindPattern = new RegExp(
                `(x:Key="${argName}"[^>]*>\\s*)\\[([^\\]]+)\\]`,
              );
              const bindMatch = content.match(argBindPattern);
              if (bindMatch && bindMatch[2]) {
                const origExpr = bindMatch[2];
                const convertedExpr = `${conversion.wrapper}(${origExpr})`;
                deferredWrites.set(deferredKey, content.replace(
                  argBindPattern,
                  `$1[${convertedExpr}]`
                ));
                console.log(`[Invoke Arg Auto-Convert] ${file}: wrapped "${argName}" binding with ${conversion.wrapper}() (${passedType} → ${declaredType})`);
                continue;
              }
            }
          }
          const action = conversion
            ? conversion.kind === "wrap"
              ? `Auto-convertible: ${conversion.detail}`
              : conversion.kind === "variable-type-change"
                ? `Retype variable: ${conversion.detail}`
                : `Manual fix required: ${conversion.detail}`
            : `Fix type mismatch: argument "${argName}" is passed as ${passedType} but ${targetFile} expects ${declaredType}`;
          outcomeRemediations.push({
            level: "activity",
            file: v.file || "unknown",
            remediationCode: "INVOKE_ARG_TYPE_MISMATCH",
            reason: `Argument type mismatch in InvokeWorkflowFile: "${argName}" (${passedType} → ${declaredType})`,
            classifiedCheck: "invoke-arg-type-mismatch",
            developerAction: action,
            estimatedEffortMinutes: conversion && conversion.kind === "wrap" ? 2 : 10,
          });
        }
      }
    }

    const dhgStudioBlockingChecks = new Set([
      "empty-container", "empty-http-endpoint", "invalid-trycatch-structure",
      "invalid-catch-type", "invalid-activity-property",
      "unknown-activity", "undeclared-namespace", "invalid-type-argument",
      "invalid-default-value", "policy-blocked-activity", "pseudo-xaml",
      "fake-trycatch", "object-object", "EXPRESSION_SYNTAX_UNFIXABLE",
      "TYPE_MISMATCH", "FOREACH_TYPE_MISMATCH", "LITERAL_TYPE_ERROR",
      "CATALOG_STRUCTURAL_VIOLATION", "STRING_FORMAT_OVERFLOW",
      "EXPRESSION_IN_LITERAL_SLOT", "UNDECLARED_ARGUMENT",
    ]);
    const dhgStudioWarningChecks = new Set([
      "placeholder-value", "expression-syntax-mismatch", "invoke-arg-type-mismatch",
      "invalid-continue-on-error", "EXPRESSION_SYNTAX", "UNSAFE_VARIABLE_NAME", "empty-catches",
      "undeclared-variable",
    ]);
    const dhgStubbedFiles = new Set(complianceFallbacks.map(fb => fb.file));
    for (const esf of earlyStubFallbacks) dhgStubbedFiles.add(esf);
    for (const r of outcomeRemediations) {
      if (r.remediationCode === "STUB_WORKFLOW_BLOCKING" || r.remediationCode === "STUB_WORKFLOW_GENERATOR_FAILURE") {
        dhgStubbedFiles.add(r.file);
      }
    }
    for (const f of dhgFilesWithStubContent) dhgStubbedFiles.add(f);
    const dhgStudioCompatibility: PerWorkflowStudioCompatibility[] = Array.from(dhgAllFiles).map(file => {
      if (dhgStudioNonLoadableFiles.has(file) && !dhgStubbedFiles.has(file)) {
        const reason = dhgStudioLoadabilityReasons.get(file) || "Not Studio-loadable";
        return {
          file,
          level: "studio-blocked" as StudioCompatibilityLevel,
          blockers: [`[STUDIO_LOADABILITY] ${reason}`],
          failureCategory: "structural-invalid" as import("./uipath-pipeline").StubFailureCategory,
          failureSummary: "Structural preservation — valid XML but not Studio-loadable",
        };
      }
      if (dhgStubbedFiles.has(file)) {
        const classified = classifyStubFailureCategory(file, outcomeRemediations, qualityGateResult.violations);
        return {
          file,
          level: "studio-blocked" as StudioCompatibilityLevel,
          blockers: [`[${classified.category.toUpperCase()}] ${classified.summary}`],
          failureCategory: classified.category,
          failureSummary: classified.summary,
        };
      }
      const fileViolations = qualityGateResult.violations.filter(v => v.file === file);
      const blockingViolations = fileViolations.filter(v => v.severity === "error" && dhgStudioBlockingChecks.has(v.check));
      const warningViolations = fileViolations.filter(v =>
        (v.severity === "error" && dhgStudioWarningChecks.has(v.check)) ||
        (v.severity === "warning" && (dhgStudioBlockingChecks.has(v.check) || dhgStudioWarningChecks.has(v.check)))
      );
      const blockers = blockingViolations.map(v => `[${v.check}] ${v.detail}`);
      let level: StudioCompatibilityLevel = blockingViolations.length > 0
        ? "studio-blocked"
        : warningViolations.length > 0
          ? "studio-warnings"
          : "studio-clean";
      const loadability = dhgStudioNonLoadableFiles.has(file);
      if (level === "studio-clean" && loadability) {
        level = "studio-blocked";
        blockers.push(`[STUDIO_LOADABILITY] ${dhgStudioLoadabilityReasons.get(file) || "Not Studio-loadable"}`);
      }
      return { file, level, blockers };
    });

    const assemblerOutcomeReport: PipelineOutcomeReport = {
      fullyGeneratedFiles: dhgFullyGenerated,
      autoRepairs: [],
      remediations: outcomeRemediations,
      propertyRemediations: [],
      downgradeEvents: [],
      qualityWarnings: dhgQualityWarnings,
      totalEstimatedEffortMinutes: outcomeRemediations.reduce((s, r) => s + (r.estimatedEffortMinutes || 0), 0),
      studioCompatibility: dhgStudioCompatibility,
      emissionGateViolations: emissionGateResult.violations.length > 0 ? {
        totalViolations: emissionGateResult.summary.totalViolations,
        stubbed: emissionGateResult.summary.stubbed,
        corrected: emissionGateResult.summary.corrected,
        blocked: emissionGateResult.summary.blocked,
        degraded: emissionGateResult.summary.degraded,
        details: emissionGateResult.violations.map(v => ({
          file: v.file,
          line: v.line,
          type: v.type,
          detail: v.detail,
          resolution: v.resolution,
          containingBlockType: v.containingBlockType,
          containedActivities: v.containedActivities,
          isIntegrityFailure: v.isIntegrityFailure,
        })),
      } : undefined,
    };

    if (xamlEntries.length > 0) {
      let parityMatches = 0;
      let parityMismatches = 0;
      const mismatchedFiles: string[] = [];
      for (const entry of xamlEntries) {
        const basename = entry.name.split("/").pop() || entry.name;
        const deferredKey = Array.from(deferredWrites.keys()).find(p => (p.split("/").pop() || p) === basename);
        const deferredContent = deferredKey ? deferredWrites.get(deferredKey) : undefined;
        const entriesHash = createHash("sha256").update(entry.content).digest("hex").substring(0, 12);
        const deferredHash = deferredContent ? createHash("sha256").update(deferredContent).digest("hex").substring(0, 12) : "MISSING";
        const match = deferredContent === entry.content;
        if (match) {
          parityMatches++;
        } else {
          parityMismatches++;
          mismatchedFiles.push(basename);
          const entryLen = entry.content.length;
          const deferredLen = deferredContent ? deferredContent.length : 0;
          let firstDiffPos = -1;
          if (deferredContent) {
            const minLen = Math.min(entryLen, deferredLen);
            for (let c = 0; c < minLen; c++) {
              if (entry.content[c] !== deferredContent[c]) {
                firstDiffPos = c;
                break;
              }
            }
            if (firstDiffPos === -1 && entryLen !== deferredLen) {
              firstDiffPos = minLen;
            }
          }
          console.log(`[Parity Pre-Check] MISMATCH ${basename}: entryLen=${entryLen}, deferredLen=${deferredLen}, firstDiffPos=${firstDiffPos}`);
        }
        console.log(`[Parity Pre-Check] ${basename}: entries=${entriesHash}, deferred=${deferredHash}, match=${match ? "true" : "FALSE"}`);
      }
      const mismatchSuffix = parityMismatches > 0 ? `, ${parityMismatches} mismatch(es): ${mismatchedFiles.join(", ")}` : "";
      console.log(`[Parity Pre-Check] Summary: ${parityMatches}/${xamlEntries.length} files match${mismatchSuffix}`);

      if (parityMismatches > 0) {
        console.log(`[Parity Pre-Check] Syncing xamlEntries from deferredWrites to resolve drift...`);
        for (let i = 0; i < xamlEntries.length; i++) {
          const basename = xamlEntries[i].name.split("/").pop() || xamlEntries[i].name;
          const deferredKey = Array.from(deferredWrites.keys()).find(p => (p.split("/").pop() || p) === basename);
          if (deferredKey) {
            const deferredContent = deferredWrites.get(deferredKey)!;
            if (xamlEntries[i].content !== deferredContent) {
              xamlEntries[i] = { name: xamlEntries[i].name, content: deferredContent };
              console.log(`[Parity Pre-Check] Synced ${basename} from deferredWrites`);
            }
          }
        }
      }

      const xamlBasenames = new Set(xamlEntries.map(e => (e.name.split("/").pop() || e.name)));
      const deferredXamlKeys = Array.from(deferredWrites.keys()).filter(p => p.endsWith(".xaml"));
      for (const dKey of deferredXamlKeys) {
        const dBasename = dKey.split("/").pop() || dKey;
        if (!xamlBasenames.has(dBasename)) {
          console.warn(`[Parity Pre-Check] XAML "${dBasename}" exists in deferredWrites but not in xamlEntries — adding to xamlEntries`);
          xamlEntries.push({ name: dKey, content: deferredWrites.get(dKey)! });
          xamlBasenames.add(dBasename);
        }
      }
      for (const entry of xamlEntries) {
        const basename = entry.name.split("/").pop() || entry.name;
        const hasDeferredKey = deferredXamlKeys.some(p => (p.split("/").pop() || p) === basename);
        if (!hasDeferredKey) {
          console.warn(`[Parity Pre-Check] XAML "${basename}" exists in xamlEntries but not in deferredWrites — orphaned entry`);
        }
      }
    }

    {
      console.log(`[Tier 2 Argument Reconciliation] Scanning InvokeWorkflowFile argument bindings across all workflows...`);
      const invokeArgContracts = new Map<string, Map<string, string>>();
      for (const [_path, content] of deferredWrites.entries()) {
        if (!_path.endsWith(".xaml")) continue;
        const invokePattern = /<ui:InvokeWorkflowFile[^>]*WorkflowFileName="([^"]+)"[^]*?<\/ui:InvokeWorkflowFile>/g;
        let invokeMatch;
        while ((invokeMatch = invokePattern.exec(content)) !== null) {
          const targetFile = invokeMatch[1].replace(/^.*[\\/]/, "");
          const argBlock = invokeMatch[0];
          const argElementPattern = /<(InArgument|OutArgument|InOutArgument)\s+[^>]*>/g;
          let adm;
          while ((adm = argElementPattern.exec(argBlock)) !== null) {
            const elemTag = adm[0];
            const typeMatch = elemTag.match(/x:TypeArguments="([^"]+)"/);
            const keyMatch = elemTag.match(/x:Key="([^"]+)"/);
            if (keyMatch) {
              const callerType = typeMatch ? typeMatch[1] : "";
              const argName = keyMatch[1];
              if (!invokeArgContracts.has(targetFile)) invokeArgContracts.set(targetFile, new Map());
              invokeArgContracts.get(targetFile)!.set(argName, callerType);
            }
          }
          const argKeyPattern = /x:Key="((?:in_|out_|io_)[A-Za-z]\w*)"/g;
          let akm;
          while ((akm = argKeyPattern.exec(argBlock)) !== null) {
            if (!invokeArgContracts.has(targetFile)) invokeArgContracts.set(targetFile, new Map());
            if (!invokeArgContracts.get(targetFile)!.has(akm[1])) {
              invokeArgContracts.get(targetFile)!.set(akm[1], "");
            }
          }
        }
        const fileName = _path.split("/").pop() || _path;
        const contentWithoutInvokeArgs = content.replace(/<ui:InvokeWorkflowFile\.Arguments>[\s\S]*?<\/ui:InvokeWorkflowFile\.Arguments>/g, "");
        const bodyArgRefs = /\b(in_[A-Za-z]\w*|out_[A-Za-z]\w*|io_[A-Za-z]\w*)\b/g;
        let bodyArg;
        while ((bodyArg = bodyArgRefs.exec(contentWithoutInvokeArgs)) !== null) {
          const xMemberCheck = new RegExp(`<x:Property\\s+Name="${bodyArg[1]}"`);
          const varCheck = new RegExp(`<Variable[^>]*\\bName="${bodyArg[1]}"`);
          if (!xMemberCheck.test(content) && !varCheck.test(content)) {
            if (!invokeArgContracts.has(fileName)) invokeArgContracts.set(fileName, new Map());
            if (!invokeArgContracts.get(fileName)!.has(bodyArg[1])) {
              invokeArgContracts.get(fileName)!.set(bodyArg[1], "");
            }
          }
        }
      }
      let tier2Injections = 0;
      for (const [dPath, dContent] of deferredWrites.entries()) {
        if (!dPath.endsWith(".xaml")) continue;
        const fileName = dPath.split("/").pop() || dPath;
        const neededArgs = invokeArgContracts.get(fileName);
        if (!neededArgs || neededArgs.size === 0) continue;
        let updatedContent = dContent;
        for (const [argName, callerType] of neededArgs.entries()) {
          const alreadyDeclared = new RegExp(`<x:Property\\s+Name="${argName}"`).test(updatedContent);
          const isVariable = new RegExp(`<Variable[^>]*\\bName="${argName}"`).test(updatedContent);
          if (alreadyDeclared || isVariable) continue;
          const direction = argName.startsWith("out_") ? "OutArgument"
            : argName.startsWith("io_") ? "InOutArgument"
            : "InArgument";
          const typeMap: Record<string, string> = {
            "str_": "x:String", "int_": "x:Int32", "bool_": "x:Boolean",
            "dt_": "scg2:DataTable", "dict_": "scg:Dictionary(x:String, x:Object)",
            "sec_": "x:String", "dbl_": "x:Double",
          };
          let argType = callerType || "";
          if (!argType) {
            const prefix = argName.replace(/^(?:in_|out_|io_)/, "").match(/^[a-z]+_/)?.[0] || "";
            argType = typeMap[prefix] || "x:String";
          }
          const openCount = (`${direction}(${argType})`).split("(").length - 1;
          const closeCount = (`${direction}(${argType})`).split(")").length - 1;
          const balancedType = openCount > closeCount ? `${direction}(${argType})` + ")".repeat(openCount - closeCount) : `${direction}(${argType})`;
          const propXml = `    <x:Property Name="${argName}" Type="${balancedType}" />\n`;
          const membersEnd = updatedContent.indexOf("</x:Members>");
          if (membersEnd >= 0) {
            updatedContent = updatedContent.slice(0, membersEnd) + propXml + updatedContent.slice(membersEnd);
            tier2Injections++;
            console.log(`[Tier 2 Argument Reconciliation] Injected ${direction} "${argName}" (${argType}) into ${fileName}`);
          } else {
            const selfClosingMembers = updatedContent.match(/<x:Members\s*\/>/);
            if (selfClosingMembers) {
              const replacement = `<x:Members>\n${propXml}  </x:Members>`;
              updatedContent = updatedContent.replace(selfClosingMembers[0], replacement);
              tier2Injections++;
              console.log(`[Tier 2 Argument Reconciliation] Expanded self-closing x:Members and injected ${direction} "${argName}" (${argType}) into ${fileName}`);
            } else {
              const activityTagMatch = updatedContent.match(/<Activity\b[^>]*>/);
              if (activityTagMatch) {
                const insertPos = activityTagMatch.index! + activityTagMatch[0].length;
                const membersBlock = `\n  <x:Members>\n${propXml}  </x:Members>`;
                updatedContent = updatedContent.slice(0, insertPos) + membersBlock + updatedContent.slice(insertPos);
                tier2Injections++;
                console.log(`[Tier 2 Argument Reconciliation] Created x:Members and injected ${direction} "${argName}" (${argType}) into ${fileName}`);
              }
            }
          }
        }
        if (updatedContent !== dContent) {
          deferredWrites.set(dPath, updatedContent);
          const matchingEntry = xamlEntries.find(e => (e.name.split("/").pop() || e.name) === fileName);
          if (matchingEntry) matchingEntry.content = updatedContent;
        }
      }
      console.log(`[Tier 2 Argument Reconciliation] Complete: ${tier2Injections} argument(s) injected across ${invokeArgContracts.size} workflow(s)`);
      if (tier2Injections > 0) {
        const beforeCount = qualityGateResult.violations.length;
        qualityGateResult.violations = qualityGateResult.violations.filter(v => {
          if (v.check !== "UNDECLARED_ARGUMENT") return true;
          const argMatch = v.detail.match(/Argument "([^"]+)"/);
          if (!argMatch) return true;
          const argName = argMatch[1];
          const fileName = v.file;
          const dKey = Array.from(deferredWrites.keys()).find(p => (p.split("/").pop() || p) === fileName);
          if (!dKey) return true;
          const currentContent = deferredWrites.get(dKey)!;
          return !new RegExp(`<x:Property\\s+Name="${argName}"`).test(currentContent);
        });
        const removed = beforeCount - qualityGateResult.violations.length;
        if (removed > 0) {
          console.log(`[Tier 2 Argument Reconciliation] Removed ${removed} stale UNDECLARED_ARGUMENT violation(s) resolved by injection`);
        }
      }
    }

    {
      console.log(`[Post-Repair Validation] Running final XAML validation pass after all post-processing...`);
      const postRepairViolations: Array<{ category: "blocked-pattern" | "completeness" | "accuracy" | "runtime-safety" | "logic-location"; severity: "error" | "warning"; check: string; file: string; detail: string }> = [];

      for (const [dPath, content] of deferredWrites.entries()) {
        if (!dPath.endsWith(".xaml")) continue;
        const shortName = dPath.split("/").pop() || dPath;

        const xmlWellFormed = validateXmlWellFormedness(content);
        if (!xmlWellFormed.valid) {
          postRepairViolations.push({ category: "accuracy", severity: "error", check: "INVALID_XML_CONTENT", file: shortName, detail: `Post-repair: XML is not well-formed: ${xmlWellFormed.errors.slice(0, 2).join("; ")}` });
        }

        const bareExprPattern = /Default="([^"]+)"/g;
        let bem;
        while ((bem = bareExprPattern.exec(content)) !== null) {
          const val = bem[1];
          if (val === "True" || val === "False" || val === "Nothing" || val === "null") continue;
          if (/^[0-9]+(\.[0-9]+)?$/.test(val)) continue;
          if (val.startsWith("[") && val.endsWith("]")) continue;
          if (val.startsWith("&quot;") || val.startsWith('"')) continue;
          if (/^\d{1,2}:\d{2}:\d{2}/.test(val)) continue;
          if (/^[a-zA-Z][\w\s.,!?;:'-]*$/.test(val) && !/[()]/.test(val) && !/^(in_|out_|io_)/.test(val)) continue;
          const looksLikeExpr = /^(in_|out_|io_|str_|int_|bool_|dict_|dt_|sec_)\w+$/.test(val) ||
            /\w+\.\w+\(/.test(val) || /\bNew\s/.test(val) || /\bDirectCast\b/.test(val) ||
            (/\(.*\)/.test(val) && /^[a-zA-Z_]\w*/.test(val));
          if (looksLikeExpr) {
            postRepairViolations.push({ category: "accuracy", severity: "error", check: "EXPRESSION_IN_LITERAL_SLOT", file: shortName, detail: `Post-repair: Variable Default="${val}" still contains an unwrapped VB expression` });
          }
        }

        const xPropNames = new Set<string>();
        const xpp = /<x:Property\s+Name="([^"]+)"/g;
        let xppm;
        while ((xppm = xpp.exec(content)) !== null) {
          xPropNames.add(xppm[1]);
        }
        const varNames = new Set<string>();
        const vp = /<Variable[^>]*\bName="([^"]+)"/g;
        let vpm;
        while ((vpm = vp.exec(content)) !== null) {
          varNames.add(vpm[1]);
        }
        const contentWithoutInvokeArgsForScan = content.replace(/<ui:InvokeWorkflowFile\.Arguments>[\s\S]*?<\/ui:InvokeWorkflowFile\.Arguments>/g, "");
        const argRefs = /\b(in_[A-Za-z]\w*|out_[A-Za-z]\w*|io_[A-Za-z]\w*)\b/g;
        let arm;
        while ((arm = argRefs.exec(contentWithoutInvokeArgsForScan)) !== null) {
          if (!xPropNames.has(arm[1]) && !varNames.has(arm[1])) {
            postRepairViolations.push({ category: "accuracy", severity: "error", check: "UNDECLARED_ARGUMENT", file: shortName, detail: `Post-repair: Argument "${arm[1]}" referenced but not declared in x:Members or Variables` });
            break;
          }
        }

        const prefixedStructuralPattern = /<[A-Za-z]+:?[A-Za-z]*\.(_(?:Try|Then|Else|Body|Condition|Catches|Finally|Cases|Default))\b/g;
        let psm;
        while ((psm = prefixedStructuralPattern.exec(content)) !== null) {
          postRepairViolations.push({ category: "accuracy", severity: "error", check: "STRUCTURAL_NAME_MUTATED", file: shortName, detail: `Post-repair: XAML structural member name mutated to "${psm[1]}" — Studio will fail to load this element` });
        }

        const retryIntervalPattern = /RetryInterval="([^"]+)"/g;
        let rim;
        while ((rim = retryIntervalPattern.exec(content)) !== null) {
          const riVal = rim[1];
          if (riVal === "00:00:05") {
            postRepairViolations.push({ category: "accuracy", severity: "warning", check: "RETRY_INTERVAL_DEFAULTED", file: shortName, detail: `Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow context` });
          } else if (riVal.startsWith("[") && riVal.endsWith("]")) {
            postRepairViolations.push({ category: "accuracy", severity: "warning", check: "RETRY_INTERVAL_EXPRESSION_WRAPPED", file: shortName, detail: `Post-repair: RetryInterval="${riVal}" was bracket-wrapped from a variable/expression — verify the referenced variable is declared` });
          }
        }
      }

      if (postRepairViolations.length > 0) {
        console.warn(`[Post-Repair Validation] Found ${postRepairViolations.length} issue(s) — injecting into quality gate violations`);
        for (const v of postRepairViolations) {
          qualityGateResult.violations.push(v);
        }
        for (const compat of dhgStudioCompatibility) {
          const filePostRepairBlockers = postRepairViolations.filter(v => v.file === compat.file && v.severity === "error");
          if (filePostRepairBlockers.length > 0 && compat.level !== "studio-blocked") {
            compat.level = "studio-blocked" as StudioCompatibilityLevel;
            for (const b of filePostRepairBlockers) {
              compat.blockers.push(`[${b.check}] ${b.detail}`);
            }
          }
        }
        assemblerOutcomeReport.studioCompatibility = dhgStudioCompatibility;
        const postRepairBlockedFiles = new Set(
          postRepairViolations.filter(v => v.severity === "error").map(v => v.file)
        );
        if (postRepairBlockedFiles.size > 0) {
          const beforeCount = assemblerOutcomeReport.fullyGeneratedFiles.length;
          assemblerOutcomeReport.fullyGeneratedFiles = assemblerOutcomeReport.fullyGeneratedFiles.filter(
            f => !postRepairBlockedFiles.has(f.split("/").pop() || f)
          );
          const removedCount = beforeCount - assemblerOutcomeReport.fullyGeneratedFiles.length;
          if (removedCount > 0) {
            console.log(`[Post-Repair Validation] Removed ${removedCount} file(s) from fullyGeneratedFiles due to post-repair blocking violations`);
          }
        }
        console.log(`[Post-Repair Validation] Studio compatibility recomputed from post-repair violations`);
      }
      console.log(`[Post-Repair Validation] Complete: ${postRepairViolations.length} issue(s) found across deferred XAML entries`);
    }

    {
      console.log(`[Post-Repair Dependency Reconciliation] Re-scanning packages after all cleanup/repair passes...`);
      const allDeferredXaml = Array.from(deferredWrites.entries()).filter(([p]) => p.endsWith(".xaml")).map(([_, c]) => c).join("\n");
      const finalDeps = scanXamlForRequiredPackages(allDeferredXaml);
      const removedDeps: string[] = [];
      for (const depName of Object.keys(deps)) {
        if (depName === "UiPath.System.Activities" || depName === "UiPath.UIAutomation.Activities") continue;
        const isUsed = Array.from(finalDeps).some(d => normalizePackageName(d) === depName);
        const isRefInXaml = allDeferredXaml.includes(depName.split(".").pop() || depName);
        if (!isUsed && !isRefInXaml) {
          removedDeps.push(depName);
        }
      }
      if (removedDeps.length > 0) {
        for (const rd of removedDeps) {
          console.log(`[Post-Repair Dependency Reconciliation] Removing unused dependency: ${rd}`);
          delete deps[rd];
        }
      }
    }

    {
      console.log(`[Authoritative Namespace Injection] Running single authoritative pass across all XAML files...`);
      const isCrossPlatform = tf === "Portable";
      const nsInjectionResult = runAuthoritativeNamespaceInjection(deferredWrites, deps, isCrossPlatform);
      if (nsInjectionResult.injectedCount > 0) {
        console.log(`[Authoritative Namespace Injection] Injected namespace declarations in ${nsInjectionResult.injectedCount} location(s)`);
      }
      for (const warn of nsInjectionResult.warnings) {
        console.warn(`[Authoritative Namespace Injection] ${warn}`);
        dependencyWarnings.push({
          code: "NAMESPACE_INJECTION_WARNING",
          message: warn,
          stage: "authoritative-namespace-injection",
          recoverable: true,
        });
      }
    }

    {
      console.log(`[Authoritative Declaration Synthesis] Inspecting final XAML files for required declarations...`);
      let selfCheckFixes = 0;
      let injectionFailures = 0;
      let filesInspected = 0;
      Array.from(deferredWrites.entries()).forEach(([path, content]) => {
        if (!path.endsWith(".xaml")) return;
        const fileName = path.split("/").pop() || path;
        filesInspected++;
        let updated = content;

        const hasRefs = content.includes("TextExpression.ReferencesForImplementation");
        const hasNs = content.includes("TextExpression.NamespacesForImplementation");
        const hasScoClose = content.includes("</sco:Collection>");
        if (hasRefs || hasNs) {
          console.log(`[Authoritative Declaration Synthesis] [DIAG] [${fileName}] hasRefs=${hasRefs} hasNs=${hasNs} hasScoClose=${hasScoClose} contentLen=${content.length}`);
        }

        const declarations = deriveRequiredDeclarationsForXaml(content);
        const { neededPackages, neededAssemblies, neededNamespaces, neededXmlns, activitiesDetected } = declarations;

        if (activitiesDetected.length > 0) {
          console.log(`[Authoritative Declaration Synthesis] [${fileName}] Activities detected: ${activitiesDetected.join(", ")}`);
          console.log(`[Authoritative Declaration Synthesis] [${fileName}] Required packages: ${Array.from(neededPackages).join(", ")}`);
          console.log(`[Authoritative Declaration Synthesis] [${fileName}] Required assemblies: ${Array.from(neededAssemblies).join(", ")}`);
          console.log(`[Authoritative Declaration Synthesis] [${fileName}] Required namespaces: ${Array.from(neededNamespaces).join(", ")}`);
        }

        for (const pkg of neededPackages) {
          if (!deps[pkg]) {
            const info = PACKAGE_NAMESPACE_MAP[pkg];
            if (info) {
              deps[pkg] = "*";
              console.log(`[Authoritative Declaration Synthesis] [${fileName}] Added missing project dependency: ${pkg}`);
            }
          }
        }

        const declaredPrefixes = new Set<string>();
        const xmlnsDeclPattern = /xmlns:(\w+)="([^"]+)"/g;
        let xdm;
        while ((xdm = xmlnsDeclPattern.exec(updated)) !== null) {
          declaredPrefixes.add(xdm[1]);
        }

        const missingXmlnsDecls: string[] = [];
        Array.from(neededXmlns.entries()).forEach(([prefix, xmlns]) => {
          if (!declaredPrefixes.has(prefix)) {
            missingXmlnsDecls.push(`  xmlns:${prefix}="${xmlns}"`);
          }
        });

        if (missingXmlnsDecls.length > 0) {
          const xmlnsInsertPoint = updated.indexOf('xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"');
          if (xmlnsInsertPoint >= 0) {
            const insertAfter = xmlnsInsertPoint + 'xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"'.length;
            updated = updated.slice(0, insertAfter) + "\n" + missingXmlnsDecls.join("\n") + updated.slice(insertAfter);
            selfCheckFixes += missingXmlnsDecls.length;
            console.log(`[Authoritative Declaration Synthesis] [${fileName}] Injected xmlns declarations: ${missingXmlnsDecls.length}`);
          }
        }

        const declaredAssemblies = new Set<string>();
        const asmRefPattern = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
        let arm;
        while ((arm = asmRefPattern.exec(updated)) !== null) {
          declaredAssemblies.add(arm[1].trim());
        }

        const declaredNamespaces = new Set<string>();
        const nsImportPattern = /<x:String[^>]*>([^<]+)<\/x:String>/g;
        let nsm;
        while ((nsm = nsImportPattern.exec(updated)) !== null) {
          declaredNamespaces.add(nsm[1].trim());
        }

        const missingAssemblies: string[] = [];
        Array.from(neededAssemblies).forEach(asm => {
          if (!declaredAssemblies.has(asm)) {
            missingAssemblies.push(`      <AssemblyReference>${asm}</AssemblyReference>`);
          }
        });

        const missingNamespaces: string[] = [];
        Array.from(neededNamespaces).forEach(ns => {
          if (!declaredNamespaces.has(ns)) {
            missingNamespaces.push(`      <x:String>${ns}</x:String>`);
          }
        });

        const hasRefsBlock = updated.includes("TextExpression.ReferencesForImplementation");
        const hasNsBlock = updated.includes("TextExpression.NamespacesForImplementation");
        if ((missingAssemblies.length > 0 || missingNamespaces.length > 0) && !hasRefsBlock && !hasNsBlock) {
          const activityCloseMatch = updated.match(/<\/Activity>\s*$/);
          const seqMatch = updated.match(/(\s*<Sequence[\s>])/);
          const xMembersMatch = updated.match(/(\s*<x:Members>)/);
          let bootstrapInsertIdx = -1;
          if (xMembersMatch && xMembersMatch.index !== undefined) {
            bootstrapInsertIdx = xMembersMatch.index;
          } else if (seqMatch && seqMatch.index !== undefined) {
            bootstrapInsertIdx = seqMatch.index;
          } else if (activityCloseMatch && activityCloseMatch.index !== undefined) {
            bootstrapInsertIdx = activityCloseMatch.index;
          }
          if (bootstrapInsertIdx >= 0) {
            const allNs = Array.from(neededNamespaces).map(ns => `      <x:String>${ns}</x:String>`).join("\n");
            const allAsm = Array.from(neededAssemblies).map(asm => `      <AssemblyReference>${asm}</AssemblyReference>`).join("\n");
            const bootstrapBlock = `\n  <TextExpression.NamespacesForImplementation>\n    <sco:Collection x:TypeArguments="x:String">\n${allNs}\n    </sco:Collection>\n  </TextExpression.NamespacesForImplementation>\n  <TextExpression.ReferencesForImplementation>\n    <sco:Collection x:TypeArguments="AssemblyReference">\n${allAsm}\n    </sco:Collection>\n  </TextExpression.ReferencesForImplementation>\n`;
            updated = updated.slice(0, bootstrapInsertIdx) + bootstrapBlock + updated.slice(bootstrapInsertIdx);
            selfCheckFixes += missingAssemblies.length + missingNamespaces.length;
            missingAssemblies.length = 0;
            missingNamespaces.length = 0;
            console.log(`[Authoritative Declaration Synthesis] [${fileName}] Bootstrapped both NamespacesForImplementation and ReferencesForImplementation blocks (last-resort fallback)`);
          }
        }

        if (missingAssemblies.length > 0) {
          let asmInserted = false;
          if (updated.includes("TextExpression.ReferencesForImplementation")) {
            const result = insertBeforeClosingCollectionTag(updated, "</TextExpression.ReferencesForImplementation>", missingAssemblies.join("\n"));
            if (result.succeeded) {
              updated = result.updated;
              selfCheckFixes += missingAssemblies.length;
              asmInserted = true;
              console.log(`[Authoritative Declaration Synthesis] [${fileName}] Injected assembly references: ${missingAssemblies.length}`);
            } else {
              const refsBlockPattern = /<TextExpression\.ReferencesForImplementation>[\s\S]*?<\/TextExpression\.ReferencesForImplementation>/;
              const existingRefsBlock = updated.match(refsBlockPattern);
              if (existingRefsBlock) {
                const existingAsmEntries: string[] = [];
                const existAsmPat = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
                let ea;
                while ((ea = existAsmPat.exec(existingRefsBlock[0])) !== null) {
                  existingAsmEntries.push(`      <AssemblyReference>${ea[1].trim()}</AssemblyReference>`);
                }
                const allAsmEntries = [...existingAsmEntries, ...missingAssemblies];
                const freshRefsBlock = `<TextExpression.ReferencesForImplementation>\n    <sco:Collection x:TypeArguments="AssemblyReference">\n${allAsmEntries.join("\n")}\n    </sco:Collection>\n  </TextExpression.ReferencesForImplementation>`;
                updated = updated.replace(refsBlockPattern, freshRefsBlock);
                selfCheckFixes += missingAssemblies.length;
                asmInserted = true;
                console.log(`[Authoritative Declaration Synthesis] [${fileName}] Rebuilt malformed ReferencesForImplementation block with ${allAsmEntries.length} total assembly reference(s) (${missingAssemblies.length} added)`);
              }
            }
          } else {
            const nsForImplEnd = updated.match(/<\/TextExpression\.NamespacesForImplementation>/);
            if (nsForImplEnd && nsForImplEnd.index !== undefined) {
              const insertAt = nsForImplEnd.index + nsForImplEnd[0].length;
              const refsBlock = `\n  <TextExpression.ReferencesForImplementation>\n    <sco:Collection x:TypeArguments="AssemblyReference">\n${missingAssemblies.join("\n")}\n    </sco:Collection>\n  </TextExpression.ReferencesForImplementation>`;
              updated = updated.slice(0, insertAt) + refsBlock + updated.slice(insertAt);
              selfCheckFixes += missingAssemblies.length;
              asmInserted = true;
              console.log(`[Authoritative Declaration Synthesis] [${fileName}] Created ReferencesForImplementation block with ${missingAssemblies.length} assembly reference(s)`);
            }
          }
          if (!asmInserted) {
            injectionFailures++;
            console.warn(`[Authoritative Declaration Synthesis] WARNING: [${fileName}] Failed to inject ${missingAssemblies.length} assembly reference(s) — could not locate valid insertion point`);
          }
        }

        if (missingNamespaces.length > 0) {
          let nsInserted = false;
          if (updated.includes("TextExpression.NamespacesForImplementation")) {
            const result = insertBeforeClosingCollectionTag(updated, "</TextExpression.NamespacesForImplementation>", missingNamespaces.join("\n"));
            if (result.succeeded) {
              updated = result.updated;
              selfCheckFixes += missingNamespaces.length;
              nsInserted = true;
              console.log(`[Authoritative Declaration Synthesis] [${fileName}] Injected namespace imports: ${missingNamespaces.length}`);
            } else {
              const nsBlockPattern = /<TextExpression\.NamespacesForImplementation>[\s\S]*?<\/TextExpression\.NamespacesForImplementation>/;
              const existingNsBlock = updated.match(nsBlockPattern);
              if (existingNsBlock) {
                const existingNsEntries: string[] = [];
                const existNsPat = /<x:String[^>]*>([^<]+)<\/x:String>/g;
                let en;
                while ((en = existNsPat.exec(existingNsBlock[0])) !== null) {
                  existingNsEntries.push(`      <x:String>${en[1].trim()}</x:String>`);
                }
                const allNsEntries = [...existingNsEntries, ...missingNamespaces];
                const freshNsBlock = `<TextExpression.NamespacesForImplementation>\n    <sco:Collection x:TypeArguments="x:String">\n${allNsEntries.join("\n")}\n    </sco:Collection>\n  </TextExpression.NamespacesForImplementation>`;
                updated = updated.replace(nsBlockPattern, freshNsBlock);
                selfCheckFixes += missingNamespaces.length;
                nsInserted = true;
                console.log(`[Authoritative Declaration Synthesis] [${fileName}] Rebuilt malformed NamespacesForImplementation block with ${allNsEntries.length} total namespace import(s) (${missingNamespaces.length} added)`);
              }
            }
          } else {
            const refsForImplEnd = updated.match(/<\/TextExpression\.ReferencesForImplementation>/);
            if (refsForImplEnd && refsForImplEnd.index !== undefined) {
              const insertAt = refsForImplEnd.index + refsForImplEnd[0].length;
              const nsBlock = `\n  <TextExpression.NamespacesForImplementation>\n    <sco:Collection x:TypeArguments="x:String">\n${missingNamespaces.join("\n")}\n    </sco:Collection>\n  </TextExpression.NamespacesForImplementation>`;
              updated = updated.slice(0, insertAt) + nsBlock + updated.slice(insertAt);
              selfCheckFixes += missingNamespaces.length;
              nsInserted = true;
              console.log(`[Authoritative Declaration Synthesis] [${fileName}] Created NamespacesForImplementation block with ${missingNamespaces.length} namespace import(s)`);
            }
          }
          if (!nsInserted) {
            injectionFailures++;
            console.warn(`[Authoritative Declaration Synthesis] WARNING: [${fileName}] Failed to inject ${missingNamespaces.length} namespace import(s) — could not locate valid insertion point`);
          }
        }

        if (missingAssemblies.length === 0 && missingNamespaces.length === 0 && missingXmlnsDecls.length === 0) {
          console.log(`[Authoritative Declaration Synthesis] [${fileName}] All declarations already present`);
        }

        if (updated !== content) {
          deferredWrites.set(path, updated);
        }
      });
      if (selfCheckFixes > 0 && injectionFailures === 0) {
        console.log(`[Authoritative Declaration Synthesis] Injected ${selfCheckFixes} missing declaration(s) across ${filesInspected} XAML file(s)`);
      } else if (selfCheckFixes > 0 && injectionFailures > 0) {
        console.warn(`[Authoritative Declaration Synthesis] Injected ${selfCheckFixes} declaration(s) but ${injectionFailures} injection(s) failed across ${filesInspected} XAML file(s)`);
      } else if (injectionFailures > 0) {
        console.warn(`[Authoritative Declaration Synthesis] ${injectionFailures} injection(s) failed across ${filesInspected} XAML file(s), no declarations were successfully injected`);
      } else {
        console.log(`[Authoritative Declaration Synthesis] All declarations already present across ${filesInspected} XAML file(s)`);
      }

      let postCheckFailures = 0;
      Array.from(deferredWrites.entries()).forEach(([path, content]) => {
        if (!path.endsWith(".xaml")) return;
        const fileName = path.split("/").pop() || path;
        const postDecl = deriveRequiredDeclarationsForXaml(content);

        const declaredAssembliesPost = new Set<string>();
        const asmRefPatternPost = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
        let armPost;
        while ((armPost = asmRefPatternPost.exec(content)) !== null) {
          declaredAssembliesPost.add(armPost[1].trim());
        }

        const declaredNamespacesPost = new Set<string>();
        const nsImportPatternPost = /<x:String[^>]*>([^<]+)<\/x:String>/g;
        let nsmPost;
        while ((nsmPost = nsImportPatternPost.exec(content)) !== null) {
          declaredNamespacesPost.add(nsmPost[1].trim());
        }

        const declaredPrefixesPost = new Set<string>();
        const xmlnsDeclPatternPost = /xmlns:(\w+)="([^"]+)"/g;
        let xdmPost;
        while ((xdmPost = xmlnsDeclPatternPost.exec(content)) !== null) {
          declaredPrefixesPost.add(xdmPost[1]);
        }

        const stillMissingAsm = Array.from(postDecl.neededAssemblies).filter(a => !declaredAssembliesPost.has(a));
        const stillMissingNs = Array.from(postDecl.neededNamespaces).filter(n => !declaredNamespacesPost.has(n));
        const stillMissingXmlns = Array.from(postDecl.neededXmlns.entries()).filter(([prefix]) => !declaredPrefixesPost.has(prefix));

        if (stillMissingAsm.length > 0 || stillMissingNs.length > 0 || stillMissingXmlns.length > 0) {
          postCheckFailures++;
          if (stillMissingAsm.length > 0) {
            console.error(`[Authoritative Declaration Synthesis] POST-CHECK ERROR: [${fileName}] Still missing assembly references: ${stillMissingAsm.join(", ")}`);
          }
          if (stillMissingNs.length > 0) {
            console.error(`[Authoritative Declaration Synthesis] POST-CHECK ERROR: [${fileName}] Still missing namespace imports: ${stillMissingNs.join(", ")}`);
          }
          if (stillMissingXmlns.length > 0) {
            console.error(`[Authoritative Declaration Synthesis] POST-CHECK ERROR: [${fileName}] Still missing xmlns declarations: ${stillMissingXmlns.map(([p, u]) => `xmlns:${p}="${u}"`).join(", ")}`);
          }
        }
      });
      if (postCheckFailures > 0) {
        console.error(`[Authoritative Declaration Synthesis] POST-CHECK: ${postCheckFailures} file(s) still have missing declarations after injection`);
      } else if (selfCheckFixes > 0) {
        console.log(`[Authoritative Declaration Synthesis] POST-CHECK: All injections verified — zero missing declarations remain`);
      }
    }

    {
      console.log(`[Final Dedup Gate] Checking for bracket-named duplicate files...`);
      const deferredPaths = Array.from(deferredWrites.keys());
      const { collisionDetails } = detectFinalDedupCollisions(deferredPaths);
      if (collisionDetails.length > 0) {
        for (const detail of collisionDetails) {
          console.error(`[Final Dedup Gate] ${detail}`);
        }
        throw new Error(`[Final Dedup Gate] BLOCKED: ${collisionDetails.length} canonical name collision(s) detected — bracket-named duplicates would create ambiguous workflows in Studio:\n${collisionDetails.join("\n")}`);
      }
    }

    {
      console.log(`[Post-Assembly Validation] Running final validation pass...`);
      const postValidation = runPostAssemblyValidation(
        deps,
        projectJson.studioVersion,
        xamlEntries,
        deferredWrites,
        libPath,
        _studioProfile,
        _metaTarget,
      );

      for (const warning of postValidation.warnings) {
        console.warn(`[Post-Assembly Validation] WARNING: ${warning}`);
        dependencyWarnings.push({
          code: "POST_ASSEMBLY_WARNING",
          message: warning,
          stage: "post-assembly-validation",
          recoverable: true,
        });
      }

      for (const remediation of postValidation.remediations) {
        outcomeRemediations.push({
          level: "activity",
          file: "",
          remediationCode: "POST_ASSEMBLY_REPAIR",
          reason: `[${remediation.code}] ${remediation.detail}`,
          classifiedCheck: "post-assembly-repair",
          developerAction: remediation.detail,
          estimatedEffortMinutes: 5,
        });
      }

      if (!postValidation.passed) {
        const errorDetails = postValidation.errors.map((e: string) => `  - ${e}`).join("\n");
        console.error(`[Post-Assembly Validation] FAILED with ${postValidation.errors.length} error(s):\n${errorDetails}`);
        throw new Error(
          `Post-assembly validation failed with ${postValidation.errors.length} error(s):\n${errorDetails}`
        );
      }

      console.log(`[Post-Assembly Validation] PASSED — all dependency versions validated, entry point verified, studio version confirmed`);
    }

    let postGateXamlEntries: Array<{ name: string; content: string }> = [];

    for (const [path, content] of deferredWrites.entries()) {
      if (path.endsWith(".xaml")) {
        let sanitized = content;
        const archiveFileName = path.split("/").pop() || path;

        {
          const preArchiveLoad = checkStudioLoadability(sanitized);
          if (!preArchiveLoad.loadable && preArchiveLoad.repairable) {
            const repair = repairMissingImplementation(sanitized, archiveFileName);
            if (repair.repaired) {
              sanitized = repair.content;
              console.log(`[Archive Gate] Repaired DynamicActivity/Implementation for "${archiveFileName}" before archive write`);
            }
          }
          if (!preArchiveLoad.loadable && !preArchiveLoad.repairable) {
            console.warn(`[Archive Gate] "${archiveFileName}" is not Studio-loadable and not repairable — reason: ${preArchiveLoad.reason || "unknown"}`);
          }
        }

        {
          const viSweep = sweepValueIntentFromXaml(sanitized);
          if (viSweep.repairCount > 0) {
            sanitized = viSweep.content;
            console.log(`[Archive Gate] Swept ${viSweep.repairCount} residual ValueIntent JSON fragment(s) from "${archiveFileName}"`);
          }
        }

        {
          const preCLR = sanitized;
          sanitized = sanitizeClrTypeArguments(sanitized);
          if (sanitized !== preCLR) {
            console.log(`[Archive Gate] Converted CLR namespace type arguments to XAML prefix format in "${archiveFileName}"`);
          }
        }

        sanitized = sanitized.replace(/\s+[a-zA-Z_][\w]*="No auto-correction[^"]*"/g, "");
        sanitized = sanitized.replace(/\s+[a-zA-Z_][\w]*="[^"]*;\s*(?:do not|must not|should not|cannot)[^"]*"/gi, "");

        const wellFormed = validateXmlWellFormedness(sanitized);
        if (!wellFormed.valid) {
          const fileName = path.split("/").pop() || path;
          console.error(`[XML Well-Formedness Gate] ${fileName}: ${wellFormed.errors.join("; ")}`);

          let prevSanitized = "";
          while (prevSanitized !== sanitized) {
            prevSanitized = sanitized;
            sanitized = sanitized.replace(/<ui:TakeScreenshot\s+([^>]*?)(?:FileName|OutputPath)="([^"]*)"([^>]*?)\/>/g, (_m, before, _val, after) => {
              return `<ui:TakeScreenshot ${(before + after).trim()} />`;
            });
          }

          const recheck = validateXmlWellFormedness(sanitized);
          if (!recheck.valid) {
            console.error(`[XML Well-Formedness Gate] ${fileName}: still invalid after targeted fix — replacing with Studio-openable stub`);
            const stubName = fileName.replace(/\.xaml$/i, "");
            const isMainStub = fileName === "Main.xaml" || fileName === `${mainWfName}.xaml`;
            let stubInvokes: Array<{ displayName: string; fileName: string }> | undefined;
            if (isMainStub) {
              const effectiveWfNames = nonMainWorkflowNames.length > 0
                ? nonMainWorkflowNames
                : Array.from(generatedWorkflowNames).filter(n => n !== "Main" && n !== "Process");
              if (effectiveWfNames.length > 0) {
                const seenFiles = new Set<string>();
                stubInvokes = [];
                const initFile = "InitAllSettings.xaml";
                if (!seenFiles.has(initFile)) {
                  seenFiles.add(initFile);
                  stubInvokes.push({ displayName: "Initialize All Settings", fileName: initFile });
                }
                for (const name of effectiveWfNames) {
                  const fn = `${name}.xaml`;
                  if (!seenFiles.has(fn) && fn !== fileName) {
                    seenFiles.add(fn);
                    stubInvokes.push({ displayName: name, fileName: fn });
                  }
                }
                console.log(`[XML Well-Formedness Gate] Main.xaml stub preserving ${stubInvokes.length} InvokeWorkflowFile reference(s)`);
              }
            }
            const stubXaml = generateStubWorkflow(stubName, {
              reason: `Original XAML failed XML well-formedness validation: ${wellFormed.errors.join("; ")}`,
              invokeWorkflows: stubInvokes && stubInvokes.length > 0 ? stubInvokes : undefined,
            });
            sanitized = stubXaml;
            deferredWrites.set(path, sanitized);
            const archiveGateErrors = recheck.errors.length > 0 ? recheck.errors.join("; ") : wellFormed.errors.join("; ");
            outcomeRemediations.push({
              level: "workflow",
              file: fileName,
              remediationCode: "STUB_WORKFLOW_BLOCKING",
              reason: `Archive gate: XAML well-formedness failure — replaced with stub. Details: ${archiveGateErrors}`,
              classifiedCheck: "xml-wellformedness",
              developerAction: `Fix XML structure in ${fileName} — ${archiveGateErrors}`,
              estimatedEffortMinutes: 15,
            });
            autoFixSummary.push(`Replaced ${fileName} with Studio-openable stub due to XML well-formedness failure`);
          } else {
            autoFixSummary.push(`Fixed XML well-formedness issues in ${fileName} via targeted repair`);
          }
        }
        updateStageHash(path.split("/").pop() || path, "preCanonicalization", sanitized);
        postGateXamlEntries.push({ name: path, content: sanitized });
      } else {
        archive.append(content, { name: path });
      }
    }

    let preArchiveInvokeCanonicalization: InvokeCanonicalizationResult | undefined;
    let preArchiveTargetValueCanonicalization: TargetValueCanonicalizationResult | undefined;
    const preArchiveStructuralDefects: Array<{ file: string; pattern: string; detail: string }> = [];
    const preCanonicalizationHashes = new Map<string, string>();

    {
      console.log(`[Pre-Archive Canonicalization] Running invoke binding canonicalization on ${postGateXamlEntries.length} XAML entries BEFORE archive write...`);
      for (const entry of postGateXamlEntries) {
        preCanonicalizationHashes.set(entry.name, createHash("sha256").update(entry.content).digest("hex"));
      }

      preArchiveInvokeCanonicalization = canonicalizeInvokeBindings(postGateXamlEntries);
      if (preArchiveInvokeCanonicalization.totalCanonicalizations > 0) {
        console.log(`[Pre-Archive Canonicalization] Invoke binding canonicalization: ${preArchiveInvokeCanonicalization.totalCanonicalizations} fix(es) applied, ${preArchiveInvokeCanonicalization.totalResidualDefects} residual defect(s)`);
      }

      console.log(`[Pre-Archive Canonicalization] Running target/value expression canonicalization on ${postGateXamlEntries.length} XAML entries BEFORE archive write...`);
      preArchiveTargetValueCanonicalization = canonicalizeTargetValueExpressions(postGateXamlEntries);
      if (preArchiveTargetValueCanonicalization.expressionCanonicalizationFixes.length > 0 || preArchiveTargetValueCanonicalization.symbolScopeDefects.length > 0 || preArchiveTargetValueCanonicalization.sentinelReplacements.length > 0 || preArchiveTargetValueCanonicalization.unresolvableJsonDefects.length > 0) {
        console.log(`[Pre-Archive Canonicalization] ${preArchiveTargetValueCanonicalization.summary}`);
      }

      const MALFORMED_QUOTING_PATTERN = /(?:AssetName|AssetValue|Value|Text|Message)="\[(?:&quot;|")\w+(?:&quot;|")]/;
      const JSON_OBJECT_IN_ATTR_PATTERN = /(?:Message|Value|To|Text|Expression|Condition)="\{(?:&quot;|")(?:type|value|name)(?:&quot;|")\s*:/;
      const TARGET_OBJECT_PATTERN = /<(?:Assign\.To|Assign\.Value)>[\s\S]*?(?:<(?:In|Out|InOut)Argument\b[^>]*>)?\s*\{(?:&quot;|")(?:type|value|name)(?:&quot;|")\s*:/;

      for (const entry of postGateXamlEntries) {
        const shortName = entry.name.split("/").pop() || entry.name;

        const malformedQuotingMatch = MALFORMED_QUOTING_PATTERN.exec(entry.content);
        if (malformedQuotingMatch) {
          preArchiveStructuralDefects.push({
            file: shortName,
            pattern: "malformed_attribute_quoting",
            detail: `Malformed attribute quoting detected: ${malformedQuotingMatch[0].substring(0, 120)}`,
          });
        }

        const jsonAttrMatch = JSON_OBJECT_IN_ATTR_PATTERN.exec(entry.content);
        if (jsonAttrMatch) {
          preArchiveStructuralDefects.push({
            file: shortName,
            pattern: "json_object_in_executable_attribute",
            detail: `JSON-like object payload in executable attribute: ${jsonAttrMatch[0].substring(0, 120)}`,
          });
        }

        const targetObjMatch = TARGET_OBJECT_PATTERN.exec(entry.content);
        if (targetObjMatch) {
          preArchiveStructuralDefects.push({
            file: shortName,
            pattern: "object_payload_in_target_value_slot",
            detail: `Object payload in target/value slot: ${targetObjMatch[0].substring(0, 120)}`,
          });
        }
      }

      if (preArchiveStructuralDefects.length > 0) {
        console.warn(`[Pre-Archive Assertion] ${preArchiveStructuralDefects.length} structural defect(s) detected after canonicalization:`);
        const defectsByFile = new Map<string, Array<{ pattern: string; detail: string }>>();
        for (const defect of preArchiveStructuralDefects) {
          console.warn(`  [${defect.file}] ${defect.pattern}: ${defect.detail}`);
          outcomeRemediations.push({
            level: "workflow",
            file: defect.file,
            remediationCode: "STUB_WORKFLOW_BLOCKING",
            reason: `Pre-archive assertion: ${defect.pattern} — ${defect.detail}`,
            classifiedCheck: "pre-archive-canonicalization",
            developerAction: `Resolve ${defect.pattern} in ${defect.file}`,
            estimatedEffortMinutes: 10,
          });
          if (!defectsByFile.has(defect.file)) defectsByFile.set(defect.file, []);
          defectsByFile.get(defect.file)!.push({ pattern: defect.pattern, detail: defect.detail });
        }

        if (generationMode === "package") {
          for (const entry of postGateXamlEntries) {
            const shortName = entry.name.split("/").pop() || entry.name;
            const fileDefects = defectsByFile.get(shortName);
            if (!fileDefects || fileDefects.length === 0) continue;

            const defectSummary = fileDefects.map(d => `${d.pattern}: ${d.detail}`).join("; ");
            const stubName = shortName.replace(/\.xaml$/i, "");
            console.error(`[Pre-Archive Enforcement] Replacing malformed "${shortName}" with handoff stub — defects: ${defectSummary.substring(0, 200)}`);
            const safeDefectSummary = escapeXml(defectSummary.substring(0, 300));
            const safeStubName = escapeXml(stubName);
            const handoffStubContent = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="${safeStubName}" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="${safeStubName} — Handoff Required">
    <ui:LogMessage Level="Warn" Message="&quot;[CannonBall] This workflow requires manual implementation — pre-archive canonicalization detected unresolvable structural defects: ${safeDefectSummary}&quot;" DisplayName="Handoff Notice" />
  </Sequence>
</Activity>`;
            const preStubHash = createHash("sha256").update(entry.content).digest("hex");
            entry.content = handoffStubContent;
            deferredWrites.set(entry.name, handoffStubContent);
            const postStubHash = createHash("sha256").update(handoffStubContent).digest("hex");
            recordMutationAttempt({
              stage: "pre-archive-handoff-stub-injection",
              function: "buildNuGetPackage:preArchiveEnforcement",
              file: shortName,
              mutationType: "stub_injection",
              preHash: preStubHash,
              postHash: postStubHash,
              allowed: true,
              reason: `Handoff stub injected for "${shortName}" due to pre-archive structural defects (before freeze)`,
              changedBytes: preStubHash !== postStubHash,
              changedStatus: false,
              enforcementAction: "none",
            });
          }
        }
      }
    }

    const canonicalizationArchiveParity: Array<{ file: string; preCanonicalizationHash: string; canonicalizedHash: string; archivedHash: string; identical: boolean; mutated: boolean }> = [];

    for (const entry of postGateXamlEntries) {
      const shortName = entry.name.split("/").pop() || entry.name;
      const deferredContent = deferredWrites.get(entry.name);
      if (deferredContent !== undefined && deferredContent !== entry.content) {
        const entryHash = createHash("sha256").update(entry.content).digest("hex").substring(0, 12);
        const deferredHash = createHash("sha256").update(deferredContent).digest("hex").substring(0, 12);
        throw new Error(
          `[Pre-Archive Integrity] FATAL: postGateXamlEntries and deferredWrites diverge for "${shortName}" at archive append. ` +
          `postGate=${entryHash}, deferred=${deferredHash}. Single authoritative source invariant violated.`
        );
      }
      const preHash = preCanonicalizationHashes.get(entry.name) || "unknown";
      const canonicalizedHash = createHash("sha256").update(entry.content).digest("hex");
      const archivedContent = entry.content;
      updateStageHash(shortName, "archivedFile", archivedContent);
      archive.append(archivedContent, { name: entry.name });
      const archivedHash = createHash("sha256").update(archivedContent).digest("hex");
      canonicalizationArchiveParity.push({
        file: shortName,
        preCanonicalizationHash: preHash,
        canonicalizedHash,
        archivedHash,
        identical: canonicalizedHash === archivedHash,
        mutated: preHash !== canonicalizedHash,
      });
    }

    const speculativeDepsSnapshot = { ...deps };

    let postEmissionDiagnostics: DependencyDiagnosticsArtifact | undefined;
    let postEmissionGaps: Array<{ activityTag: string; fileName: string; detail: string }> | undefined;
    let postEmissionAmbiguous: Array<{ activityTag: string; candidatePackages: string[]; fileName: string }> | undefined;
    let postEmissionOrphans: Array<{ packageId: string; version: string | null; reason: string }> | undefined;

    {

      try {
        console.log(`[Post-Emission Analyzer] Running post-emission dependency analysis on ${postGateXamlEntries.length} final XAML entries...`);
        const postEmissionResult = runPostEmissionDependencyAnalysis(
          postGateXamlEntries,
          tf as "Windows" | "Portable",
          speculativeDepsSnapshot,
        );

        const derivedDeps = postEmissionResult.deps;
        const derivedReport = postEmissionResult.report;
        postEmissionDiagnostics = postEmissionResult.diagnostics;

        for (const key of Object.keys(deps)) {
          delete deps[key];
        }
        for (const [key, val] of Object.entries(derivedDeps)) {
          deps[key] = val;
        }

        const droppedSpeculative: string[] = [];
        for (const [specPkg] of Object.entries(speculativeDepsSnapshot)) {
          if (!deps[specPkg] && specPredictedPackages.has(specPkg)) {
            droppedSpeculative.push(specPkg);
            console.log(`[Post-Emission Analyzer] Dropped speculative package ${specPkg} — not found in XAML-derived set (post-emission analyzer is authoritative)`);
          }
        }

        if (droppedSpeculative.length > 0) {
          console.log(`[Post-Emission Analyzer] Dropped ${droppedSpeculative.length} speculative package(s) not confirmed by XAML analysis: ${droppedSpeculative.join(", ")}`);
        }

        if (derivedReport.dependencyGaps.length > 0) {
          postEmissionGaps = derivedReport.dependencyGaps;
        }
        if (derivedReport.ambiguousResolutions.length > 0) {
          postEmissionAmbiguous = derivedReport.ambiguousResolutions;
        }
        if (postEmissionDiagnostics.orphanDependencies.length > 0) {
          postEmissionOrphans = postEmissionDiagnostics.orphanDependencies;
          for (const orphan of postEmissionDiagnostics.orphanDependencies) {
            dependencyWarnings.push({
              code: "ORPHAN_DEPENDENCY",
              message: `${orphan.reason}`,
              stage: "post-emission-analysis",
              recoverable: true,
            });
          }
        }

        console.log(`[Post-Emission Analyzer] XAML-derived dependency set: ${Object.keys(deps).length} packages (speculative had ${Object.keys(speculativeDepsSnapshot).length}, ${droppedSpeculative.length} speculative dropped)`);
      } catch (analyzerErr: unknown) {
        const errMsg = analyzerErr instanceof Error ? analyzerErr.message : String(analyzerErr);
        console.warn(`[Post-Emission Analyzer] Analyzer failed — falling back to speculative dependencies: ${errMsg}`);
        dependencyWarnings.push({
          code: "POST_EMISSION_ANALYZER_FALLBACK",
          message: `Post-emission dependency analyzer failed: ${errMsg}. Using speculative (resolveDependencies) set as fallback.`,
          stage: "post-emission-analysis",
          recoverable: true,
        });
        postEmissionDiagnostics = {
          activityResolutions: [],
          packageResolutions: Object.entries(speculativeDepsSnapshot).map(([pkgId, ver]) => ({
            packageId: pkgId,
            version: ver,
            resolutionSource: "speculative_fallback" as ResolutionSource,
            activities: [],
          })),
          unresolvedActivities: [],
          ambiguousResolutions: [],
          orphanDependencies: [],
          speculativeComparisonDelta: null,
          summary: {
            totalActivities: 0,
            resolvedPackages: Object.keys(speculativeDepsSnapshot).length,
            unresolvedCount: 0,
            ambiguousCount: 0,
            orphanCount: 0,
          },
        };
      }
    }

    {
      console.log(`[Studio Resolution Smoke Test] Scanning all XAML files against post-emission-derived deps...`);
      const smokeTestResult = runStudioResolutionSmokeTest(deferredWrites, deps);
      for (const warn of smokeTestResult.warnings) {
        console.warn(`[Studio Resolution Smoke Test] WARNING: ${warn}`);
        dependencyWarnings.push({
          code: "STUDIO_RESOLUTION_WARNING",
          message: warn,
          stage: "studio-resolution-smoke-test",
          recoverable: true,
        });
      }
      if (smokeTestResult.errors.length > 0) {
        for (const err of smokeTestResult.errors) {
          console.warn(`[Studio Resolution Smoke Test] DIAGNOSTIC: ${err}`);
          dependencyWarnings.push({
            code: "STUDIO_RESOLUTION_DIAGNOSTIC",
            message: err,
            stage: "studio-resolution-smoke-test",
            recoverable: true,
          });
        }
        console.warn(`[Studio Resolution Smoke Test] ${smokeTestResult.errors.length} unresolvable activity diagnostic(s) — package generation continues with structured diagnostics`);
      } else {
        console.log(`[Studio Resolution Smoke Test] PASSED — all activity prefixes map to declared namespaces and post-emission dependencies`);
      }
    }

    sanitizeDeps(deps);
    for (const [key, val] of Object.entries(deps)) {
      if (isFrameworkAssembly(key)) {
        console.log(`[Dependency FinalGuard] Rejected late-surviving framework assembly before emit: ${key}`);
        delete deps[key];
      } else if (!isValidNuGetVersion(val)) {
        console.log(`[Dependency FinalGuard] Rejected invalid version before emit: ${key}=${val}`);
        delete deps[key];
      }
    }
    projectJson.dependencies = { ...deps };

    const finalProjectJsonStr = JSON.stringify(projectJson, null, 2);
    archive.append(finalProjectJsonStr, { name: `${libPath}/project.json` });

    {
      for (const entry of postGateXamlEntries) {
        const currentDeferred = deferredWrites.get(entry.name);
        if (currentDeferred !== entry.content) {
          const preHash = currentDeferred ? createHash("sha256").update(currentDeferred).digest("hex") : "missing";
          const postHash = createHash("sha256").update(entry.content).digest("hex");
          deferredWrites.set(entry.name, entry.content);
          recordMutationAttempt({
            stage: "pre-freeze-authoritative-sync",
            function: "buildNuGetPackage:authoritativeSync",
            file: entry.name.split("/").pop() || entry.name,
            mutationType: "deferred_write",
            preHash,
            postHash,
            allowed: true,
            reason: `Synced deferredWrites from authoritative postGateXamlEntries before freeze`,
            changedBytes: true,
            changedStatus: false,
            enforcementAction: "none",
          });
        }
      }
      console.log(`[Authoritative Source Sync] postGateXamlEntries is the single authoritative content source — deferredWrites synced to match before freeze`);

      for (const entry of postGateXamlEntries) {
        if (!entry.name.endsWith(".xaml")) continue;
        const dwContent = deferredWrites.get(entry.name);
        if (dwContent !== entry.content) {
          throw new Error(
            `[Single Authority Violation] deferredWrites diverged from authoritative postGateXamlEntries for "${entry.name}" after pre-freeze sync. ` +
            `This indicates a bug in the sync logic — deferredWrites must be derived from postGateXamlEntries.`
          );
        }
      }

      const postGateArchiveXamlEntries = postGateXamlEntries.filter(e => e.name.endsWith(".xaml"));
      const postGateRemediationCount = outcomeRemediations.length;
      const dhgAnalysis = runDhgAnalysis(
        postGateArchiveXamlEntries,
        finalProjectJsonStr,
        qualityWarningCount,
        postGateRemediationCount,
        pkg.internal?.automationType || undefined,
        undefined,
        undefined,
        stubAwareness,
        emptyContainerCount,
      );
      dhgAnalysis.hasBlockedWorkflows = dhgStudioCompatibility.some(sc => sc.level === "studio-blocked");
      const finalArchiveWfNames = postGateXamlEntries
        .filter(e => e.name.endsWith(".xaml"))
        .map(e => {
          const baseName = (e.name.split("/").pop() || e.name);
          return baseName.replace(/\.xaml$/i, "");
        });
      const phase1Archive = new AdmZip();
      for (const [path, content] of deferredWrites.entries()) {
        phase1Archive.addFile(path, Buffer.from(content, "utf-8"));
      }
      const phase1Buffer = phase1Archive.toBuffer();
      console.log(`[Phase 1 Archive] Finalized pre-DHG archive buffer (${phase1Buffer.length} bytes) for authoritative XAML classification`);

      const authoritativeClassification = classifyFromArchiveBuffer(phase1Buffer);
      console.log(`[Authoritative Classifier] Classified ${authoritativeClassification.classifications.length} workflow(s) from finalized Phase 1 archive buffer, stageMarker=${authoritativeClassification.stageMarker}, version=${authoritativeClassification.classifierVersion}`);
      assemblerOutcomeReport._preArchiveClassification = authoritativeClassification;

      const phase1XamlEntries: Array<{ name: string; content: string }> = [];
      const phase1Zip = new AdmZip(phase1Buffer);
      for (const zipEntry of phase1Zip.getEntries()) {
        if (zipEntry.isDirectory || !zipEntry.entryName.endsWith(".xaml")) continue;
        phase1XamlEntries.push({
          name: zipEntry.entryName,
          content: zipEntry.getData().toString("utf-8"),
        });
      }

      resetArchiveFreeze();
      const archiveFreezeResult = freezeArchiveWorkflows(phase1XamlEntries, authoritativeClassification);
      console.log(`[Archive Freeze] Freeze point established — ${archiveFreezeResult.frozenWorkflows.size} workflow(s) frozen with stageMarker=${archiveFreezeResult.freezeStageMarker}, timestamp=${archiveFreezeResult.freezeTimestamp}`);

      const isPackageMode = true;
      deferredWrites = createGuardedDeferredWrites(deferredWrites, isPackageMode);
      postGateXamlEntries = createGuardedPostGateEntries(postGateXamlEntries, isPackageMode);
      console.log(`[Archive Freeze] deferredWrites and postGateXamlEntries now guarded — any post-freeze XAML mutation will be intercepted`);

      const dhgContext: DhgContext = {
        projectName,
        workflowNames: finalArchiveWfNames,
        generationMode: generationMode || undefined,
        generationModeReason: modeConfig.reason,
        analysis: dhgAnalysis,
        authoritativeClassification,
      };
      const dhg = generateDhgFromOutcomeReport(assemblerOutcomeReport, dhgContext);
      archive.append(dhg, { name: `${libPath}/DeveloperHandoffGuide.md` });

      const parityResult = assertDhgArchiveParity(dhg, finalArchiveWfNames, phase1XamlEntries, authoritativeClassification);
      if (!parityResult.passed) {
        throw new Error(`[Package-DHG Parity] FATAL DIVERGENCE: ${parityResult.divergences.join("; ")}`);
      } else {
        console.log(`[Package-DHG Parity] PASS — archive and DHG agree on ${finalArchiveWfNames.length} workflow(s) with matching statuses`);
      }

      const dhgTierMap = new Map<string, string>();
      const dhgTierPattern = /\|\s*\d+\s*\|\s*`([^`]+\.xaml)`\s*\|\s*(Generated|Handoff|Stub|Blocked)\s*\|/g;
      let tierMatch;
      while ((tierMatch = dhgTierPattern.exec(dhg)) !== null) {
        const wfName = tierMatch[1].replace(/\.xaml$/i, "").toLowerCase();
        dhgTierMap.set(wfName, tierMatch[2]);
      }

      if (isArchiveFrozen()) {
        const dhgStatusMap: Record<string, string> = { "Generated": "non-stub", "Handoff": "non-stub", "Stub": "stub", "Blocked": "blocked" };
        for (const [wfName, dhgTier] of Array.from(dhgTierMap.entries())) {
          const mappedStatus = dhgStatusMap[dhgTier];
          if (mappedStatus) {
            assertNoPostFreezeStatusMutation(
              "dhg-tier-mapping",
              wfName + ".xaml",
              mappedStatus as "stub" | "non-stub" | "blocked" | "malformed",
              `DHG tier "${dhgTier}" maps to status "${mappedStatus}"`,
            );
          }
        }
        console.log(`[Archive Freeze] DHG tier-to-status mapping verified against frozen statuses — ${dhgTierMap.size} workflow(s) checked`);
      }

      const statusParityResult = buildWorkflowStatusParity(authoritativeClassification, dhgTierMap, phase1XamlEntries);
      if (statusParityResult.divergenceCount > 0) {
        console.warn(`[Workflow Status Parity] ${statusParityResult.divergenceCount} divergence(s) detected`);
        for (const entry of statusParityResult.entries.filter(e => e.divergenceReason)) {
          console.warn(`  - ${entry.file}: ${entry.divergenceReason}`);
        }
      } else {
        console.log(`[Workflow Status Parity] PASS — all ${statusParityResult.entries.length} workflow(s) have consistent status`);
      }
      assemblerOutcomeReport.workflowStatusParity = statusParityResult.entries;

      console.log(`[UiPath] Generated Developer Handoff Guide (structured): ${finalArchiveWfNames.length} workflows, ${outcomeRemediations.length} remediations, REFramework=${useReFramework}`);
    }

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

  const buffer = await archive.finalize();

  runPostArchiveParityCheck(buffer, _archiveManifestTracker, _appendedContentHashes, xamlEntries, libPath);

  if (isArchiveFrozen()) {
    const frozenVerification = verifyFrozenArchiveBuffer(buffer, libPath);
    if (!frozenVerification.verified) {
      const mismatchDetails = frozenVerification.mismatches.map(m =>
        `${m.file}: frozen=${m.frozenHash.substring(0, 12)} archive=${m.archiveHash.substring(0, 12)}`
      );
      throw new Error(
        `[Post-Archive Freeze Verification] FATAL: Finalized archive buffer diverges from frozen content. ` +
        `${frozenVerification.mismatches.length} mismatch(es): ${mismatchDetails.join("; ")}. ` +
        `This indicates a late-stage mutation corrupted the archive after the classifier freeze.`
      );
    }
    console.log(`[Post-Archive Freeze Verification] PASS — finalized archive buffer matches all ${getArchiveFreezePoint()!.frozenWorkflows.size} frozen workflow(s)`);
  }

  {
    const preArchiveClassification = assemblerOutcomeReport._preArchiveClassification;
    if (preArchiveClassification) {
      const archiveVerification = verifyAndReclassifyFromArchive(preArchiveClassification, buffer, libPath);
      if (!archiveVerification.verified) {
        const hashMismatchDetails = archiveVerification.hashMismatches.map(h =>
          `${h.file}: pre=${h.preArchiveHash.substring(0, 12)} archive=${h.archiveHash.substring(0, 12)}`
        );
        const statusChangeDetails = archiveVerification.statusChanges.map(s =>
          `${s.file}: ${s.preArchiveStatus} → ${s.archiveStatus}`
        );
        console.error(`[Post-Archive Classifier Verification] DIVERGENCE DETECTED:`);
        if (hashMismatchDetails.length > 0) console.error(`  Hash mismatches: ${hashMismatchDetails.join("; ")}`);
        if (statusChangeDetails.length > 0) console.error(`  Status changes: ${statusChangeDetails.join("; ")}`);
        throw new Error(
          `[Post-Archive Classifier Verification] FATAL: Archive bytes diverge from pre-archive classification. ` +
          `${archiveVerification.hashMismatches.length} hash mismatch(es), ${archiveVerification.statusChanges.length} status change(s). ` +
          `This indicates a late-stage mutation corrupted the archive.`
        );
      }
      console.log(`[Post-Archive Classifier Verification] PASS — ${archiveVerification.reclassifiedCount} workflow(s) verified against finalized archive bytes, all classifications match`);
      assertClassificationFreshness(archiveVerification.finalClassification);

      if (assemblerOutcomeReport.workflowStatusParity) {
        for (const parityEntry of assemblerOutcomeReport.workflowStatusParity) {
          const reclassified = archiveVerification.finalClassification.classifications.find(
            c => normalizeClassifierFileName(c.file) === normalizeClassifierFileName(parityEntry.file)
          );
          if (reclassified) {
            parityEntry.postArchiveHash = reclassified.contentHash;
            parityEntry.postArchiveStatus = reclassified.status;
            parityEntry.postArchiveVerified = reclassified.contentHash === parityEntry.finalArchiveHash;
          }
        }
        console.log(`[Post-Archive Parity] Annotated workflowStatusParity with post-finalization verification (provenance preserved)`);
      }
    }
  }

  const finalXamlEntries = postGateXamlEntries.map(e => ({ name: e.name, content: e.content }));
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
    else if (fix.includes("TakeScreenshot OutputPath") || fix.includes("TakeScreenshot FileName")) repairCode = "REPAIR_TAKESCREENSHOT_STRIP";
    else if (fix.includes("Mixed-expression:")) repairCode = "REPAIR_MIXED_EXPRESSION_SYNTAX";
    else if (fix.includes("Per-activity stub") || fix.includes("Per-sequence stub") || fix.includes("per-workflow")) continue;

    const fileMatch = fix.match(/in\s+([\w/.-]+\.xaml)/);
    outcomeAutoRepairs.push({
      repairCode,
      file: fileMatch ? fileMatch[1] : "unknown",
      description: fix,
    });
  }

  if (qualityGateResult.typeRepairs) {
    for (const tr of qualityGateResult.typeRepairs) {
      let repairCode = "REPAIR_TYPE_MISMATCH";
      if (tr.repairKind === "conversion-wrap") repairCode = "REPAIR_TYPE_CONVERSION_WRAP";
      else if (tr.repairKind === "variable-type-change") repairCode = "REPAIR_TYPE_VARIABLE_CHANGE";
      outcomeAutoRepairs.push({
        repairCode,
        file: tr.file,
        description: tr.detail,
      });
    }
  }

  const allFiles = new Set(xamlEntries.map(e => (e.name.split("/").pop() || e.name)));
  const remediatedFiles = new Set(outcomeRemediations.map(r => r.file));
  const structuralDefectChecks = new Set([
    "placeholder-value",
    "empty-container",
    "empty-http-endpoint",
    "unassigned-decision-variable",
    "expression-syntax-mismatch",
    "invalid-type-argument",
    "invalid-default-value",
    "invalid-trycatch-structure",
    "invalid-catch-type",
    "invalid-activity-property",
    "invalid-continue-on-error",
    "invoke-arg-type-mismatch",
    "undeclared-variable",
    "unknown-activity",
    "undeclared-namespace",
    "policy-blocked-activity",
    "invalid-takescreenshot-result",
    "invalid-takescreenshot-outputpath",
    "invalid-takescreenshot-outputpath-attr",
    "invalid-takescreenshot-filename",
    "invalid-takescreenshot-filename-attr",
    "object-object",
    "pseudo-xaml",
    "fake-trycatch",
    "EXPRESSION_SYNTAX",
    "EXPRESSION_SYNTAX_UNFIXABLE",
    "TYPE_MISMATCH",
    "FOREACH_TYPE_MISMATCH",
    "LITERAL_TYPE_ERROR",
  ]);
  const filesWithStructuralDefects = new Set(
    qualityGateResult.violations
      .filter(v => v.severity === "error" && structuralDefectChecks.has(v.check))
      .map(v => v.file)
  );

  const STUB_CONTENT_PATTERNS = [
    "STUB_BLOCKING_FALLBACK",
    "STUB: ",
    "STUB_WORKFLOW_GENERATOR_FAILURE",
    "stub — Final validation remediation",
    "stub due to generation/compliance failure",
    "Manual implementation required",
  ];

  const filesWithStubContent = new Set<string>();
  const studioNonLoadableFiles = new Set<string>();
  const studioLoadabilityReasons = new Map<string, string>();
  const freezePoint = getArchiveFreezePoint();
  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    if (STUB_CONTENT_PATTERNS.some(pattern => entry.content.includes(pattern))) {
      filesWithStubContent.add(shortName);
    }
    const frozenContent = freezePoint
      ? freezePoint.frozenWorkflows.get(normalizeClassifierFileName(shortName))?.content || entry.content
      : entry.content;
    const loadability = checkStudioLoadability(frozenContent);
    if (!loadability.loadable) {
      studioNonLoadableFiles.add(shortName);
      studioLoadabilityReasons.set(shortName, loadability.reason || "Unknown Studio-loadability failure");
      console.log(`[Studio-Loadability] ${shortName}: NOT loadable — ${loadability.reason}`);
    }
  }

  const filesWithBlockingFindings = new Set<string>();
  for (const v of qualityGateResult.violations) {
    if (v.severity === "error") {
      const file = v.file || "unknown";
      filesWithBlockingFindings.add(file);
    }
  }

  const filesWithCatalogViolations = new Set<string>();
  for (const v of qualityGateResult.violations) {
    if (v.check === "CATALOG_STRUCTURAL_VIOLATION" || v.check === "CATALOG_VIOLATION") {
      filesWithCatalogViolations.add(v.file || "unknown");
    }
  }

  const fullyGenerated = Array.from(allFiles).filter(f =>
    !remediatedFiles.has(f) &&
    !earlyStubFallbacks.includes(f) &&
    !filesWithStructuralDefects.has(f) &&
    !filesWithStubContent.has(f) &&
    !studioNonLoadableFiles.has(f) &&
    !filesWithBlockingFindings.has(f) &&
    !filesWithCatalogViolations.has(f)
  );

  const qualityWarnings = qualityGateResult.violations
    .filter(v => v.severity === "warning")
    .map(v => ({
      check: v.check,
      file: v.file || "unknown",
      detail: v.detail,
      severity: v.severity as "warning",
      businessContext: v.businessContext,
      stubCategory: v.stubCategory,
    }));

  const studioBlockingChecks = new Set([
    "empty-container",
    "empty-http-endpoint",
    "invalid-trycatch-structure",
    "invalid-catch-type",
    "invalid-activity-property",
    "undeclared-variable",
    "unknown-activity",
    "undeclared-namespace",
    "invalid-type-argument",
    "invalid-default-value",
    "policy-blocked-activity",
    "pseudo-xaml",
    "fake-trycatch",
    "object-object",
    "EXPRESSION_SYNTAX_UNFIXABLE",
    "TYPE_MISMATCH",
    "FOREACH_TYPE_MISMATCH",
    "LITERAL_TYPE_ERROR",
    "CATALOG_STRUCTURAL_VIOLATION",
    "STRING_FORMAT_OVERFLOW",
    "EXPRESSION_IN_LITERAL_SLOT",
    "UNDECLARED_ARGUMENT",
    "CSHARP_DYNAMIC_TYPE",
    "VB_KEYWORD_AS_VARIABLE",
    "CSHARP_LAMBDA_VARIABLE",
    "STRUCTURAL_NAME_MUTATED",
  ]);
  const studioWarningChecks = new Set([
    "placeholder-value",
    "expression-syntax-mismatch",
    "invoke-arg-type-mismatch",
    "invalid-continue-on-error",
    "EXPRESSION_SYNTAX",
    "UNSAFE_VARIABLE_NAME",
    "empty-catches",
  ]);
  const stubbedFiles = new Set(complianceFallbacks.map(fb => fb.file));
  for (const esf of earlyStubFallbacks) stubbedFiles.add(esf);
  for (const r of outcomeRemediations) {
    if (r.remediationCode === "STUB_WORKFLOW_BLOCKING" || r.remediationCode === "STUB_WORKFLOW_GENERATOR_FAILURE") {
      stubbedFiles.add(r.file);
    }
  }
  for (const f of filesWithStubContent) stubbedFiles.add(f);
  const studioCompatibility: PerWorkflowStudioCompatibility[] = Array.from(allFiles).map(file => {
    if (studioNonLoadableFiles.has(file) && !stubbedFiles.has(file)) {
      const reason = studioLoadabilityReasons.get(file) || "Not Studio-loadable";
      return {
        file,
        level: "studio-blocked" as StudioCompatibilityLevel,
        blockers: [`[STUDIO_LOADABILITY] ${reason}`],
        failureCategory: "structural-invalid" as import("./uipath-pipeline").StubFailureCategory,
        failureSummary: "Structural preservation — valid XML but not Studio-loadable",
      };
    }
    if (stubbedFiles.has(file)) {
      const classified = classifyStubFailureCategory(file, outcomeRemediations, qualityGateResult.violations);
      return {
        file,
        level: "studio-blocked" as StudioCompatibilityLevel,
        blockers: [`[${classified.category.toUpperCase()}] ${classified.summary}`],
        failureCategory: classified.category,
        failureSummary: classified.summary,
      };
    }
    const fileViolations = qualityGateResult.violations.filter(v => v.file === file);
    const blockingViolations = fileViolations.filter(v => v.severity === "error" && studioBlockingChecks.has(v.check));
    const warningViolations = fileViolations.filter(v =>
      (v.severity === "error" && studioWarningChecks.has(v.check)) ||
      (v.severity === "warning" && (studioBlockingChecks.has(v.check) || studioWarningChecks.has(v.check)))
    );
    const blockers = blockingViolations.map(v => `[${v.check}] ${v.detail}`);
    let level: StudioCompatibilityLevel = blockingViolations.length > 0
      ? "studio-blocked"
      : warningViolations.length > 0
        ? "studio-warnings"
        : "studio-clean";
    if (level === "studio-clean" && studioNonLoadableFiles.has(file)) {
      level = "studio-blocked";
      blockers.push(`[STUDIO_LOADABILITY] ${studioLoadabilityReasons.get(file) || "Not Studio-loadable"}`);
    }
    return { file, level, blockers };
  });

  for (const entry of finalXamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    updateStageHash(shortName, "postFinalValidationInput", entry.content);
  }

  const brokenWorkflowFiles = new Set<string>();
  for (const sc of studioCompatibility) {
    if (sc.level === "studio-blocked" || sc.level === "studio-warnings") {
      brokenWorkflowFiles.add(sc.file);
    }
  }
  for (const f of stubbedFiles) brokenWorkflowFiles.add(f);
  if (generationMode === "baseline_openable") {
    for (const f of allFiles) brokenWorkflowFiles.add(f);
  }

  for (const entry of finalXamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    if (brokenWorkflowFiles.has(shortName)) {
      updateStageHash(shortName, "preArchive", entry.content);
    }
  }

  const collectedPropTrace = getAndClearPropertySerializationTrace();

  try {
    const contractResult = validateContractIntegrity(finalXamlEntries);
    const contracts = buildWorkflowContracts(finalXamlEntries);

    const defectIndex = new Map<string, ContractIntegrityDefect[]>();
    for (const defect of contractResult.contractIntegrityDefects) {
      const key = `${defect.file}::${defect.targetWorkflow}`;
      if (!defectIndex.has(key)) defectIndex.set(key, []);
      defectIndex.get(key)!.push(defect);
    }

    for (const entry of finalXamlEntries) {
      const normalizedName = entry.name.replace(/\\/g, "/").replace(/^[./]+/, "");
      const wfBaseName = (normalizedName.split("/").pop() || normalizedName).replace(/\.xaml$/i, "");
      const invocations = extractInvocations(entry.content, normalizedName, wfBaseName, [], []);

      for (const invocation of invocations) {
        const childContract = resolveTargetContract(invocation.targetWorkflow, contracts);
        const targetDeclaredArguments: string[] = [];
        if (childContract) {
          for (const argName of childContract.declaredArguments.keys()) {
            targetDeclaredArguments.push(argName);
          }
        }

        const providedBindings: Record<string, string> = {};
        for (const [k, v] of invocation.bindings) {
          providedBindings[k] = v;
        }

        const defectKey = `${normalizedName}::${invocation.targetWorkflow}`;
        const matchedDefects = defectIndex.get(defectKey) || [];

        const unknownTargetArguments: string[] = [];
        const missingRequiredArguments: string[] = [];
        const undeclaredSymbols: string[] = [];

        const bindingKeys = new Set(invocation.bindings.keys());
        for (const defect of matchedDefects) {
          if (defect.defectType === "unknown_target_argument" && defect.targetArgument && bindingKeys.has(defect.targetArgument)) {
            unknownTargetArguments.push(defect.targetArgument);
          } else if (defect.defectType === "missing_required_target_argument" && defect.targetArgument) {
            missingRequiredArguments.push(defect.targetArgument);
          } else if (defect.defectType === "invoke_argument_binding_mismatch" && defect.targetArgument && bindingKeys.has(defect.targetArgument)) {
            unknownTargetArguments.push(defect.targetArgument);
          }
        }

        const bindingValues = new Set(invocation.bindings.values());
        for (const defect of contractResult.contractIntegrityDefects) {
          if (defect.file !== normalizedName) continue;
          if (defect.defectType !== "undeclared_variable_reference" && defect.defectType !== "undeclared_argument_reference") continue;
          if (!defect.referencedSymbol || !defect.offendingValue) continue;
          for (const bv of bindingValues) {
            if (bv && bv.includes(defect.referencedSymbol)) {
              undeclaredSymbols.push(defect.referencedSymbol);
              break;
            }
          }
        }

        emitInvokeContractTrace({
          callerWorkflow: entry.name.split("/").pop() || entry.name,
          targetWorkflow: invocation.targetWorkflow,
          targetDeclaredArguments,
          providedBindings,
          unknownTargetArguments,
          missingRequiredArguments,
          undeclaredSymbols: [...new Set(undeclaredSymbols)],
        });
      }
    }
  } catch (contractErr) {
    console.warn(`[Pipeline Trace] Invoke contract trace extraction failed: ${contractErr instanceof Error ? contractErr.message : String(contractErr)}`);
  }

  const collectedInvokeTrace = getAndClearInvokeContractTrace();
  const collectedStageHash = getAndClearStageHashParity();
  const brokenOnlyStageHash = collectedStageHash.filter(e => brokenWorkflowFiles.has(e.workflowFile));

  const outcomeReport: PipelineOutcomeReport = {
    fullyGeneratedFiles: fullyGenerated,
    autoRepairs: outcomeAutoRepairs,
    remediations: outcomeRemediations,
    propertyRemediations: [],
    downgradeEvents: [],
    qualityWarnings,
    totalEstimatedEffortMinutes: outcomeRemediations.reduce((s, r) => s + (r.estimatedEffortMinutes || 0), 0),
    structuralPreservationMetrics: structuralPreservationMetrics.length > 0 ? structuralPreservationMetrics : undefined,
    studioCompatibility,
    propertySerializationTrace: collectedPropTrace.length > 0 ? collectedPropTrace : undefined,
    invokeContractTrace: collectedInvokeTrace.length > 0 ? collectedInvokeTrace : undefined,
    stageHashParity: brokenOnlyStageHash.length > 0 ? brokenOnlyStageHash : undefined,
    emissionGateViolations: emissionGateResult.violations.length > 0 ? {
      totalViolations: emissionGateResult.summary.totalViolations,
      stubbed: emissionGateResult.summary.stubbed,
      corrected: emissionGateResult.summary.corrected,
      blocked: emissionGateResult.summary.blocked,
      degraded: emissionGateResult.summary.degraded,
      details: emissionGateResult.violations.map(v => ({
        file: v.file,
        line: v.line,
        type: v.type,
        detail: v.detail,
        resolution: v.resolution,
        containingBlockType: v.containingBlockType,
        containedActivities: v.containedActivities,
        isIntegrityFailure: v.isIntegrityFailure,
      })),
    } : undefined,
    preEmissionValidation: specValidationReport ? {
      totalActivities: specValidationReport.totalActivities,
      validActivities: specValidationReport.validActivities,
      unknownActivities: specValidationReport.unknownActivities,
      strippedProperties: specValidationReport.strippedProperties,
      enumCorrections: specValidationReport.enumCorrections,
      missingRequiredFilled: specValidationReport.missingRequiredFilled,
      commentConversions: specValidationReport.commentConversions,
      issueCount: specValidationReport.issues.length,
    } : undefined,
    invokeSerializationFixes: preArchiveInvokeCanonicalization ? preArchiveInvokeCanonicalization.invokeSerializationFixes : undefined,
    expressionCanonicalizationFixes: preArchiveTargetValueCanonicalization ? preArchiveTargetValueCanonicalization.expressionCanonicalizationFixes : undefined,
    symbolScopeDefects: preArchiveTargetValueCanonicalization ? preArchiveTargetValueCanonicalization.symbolScopeDefects : undefined,
    targetValueCanonicalizationSummary: preArchiveTargetValueCanonicalization ? preArchiveTargetValueCanonicalization.summary : undefined,
    residualExpressionSerializationDefects: preArchiveInvokeCanonicalization ? preArchiveInvokeCanonicalization.residualExpressionSerializationDefects : undefined,
    sentinelReplacements: preArchiveTargetValueCanonicalization ? preArchiveTargetValueCanonicalization.sentinelReplacements : undefined,
    unresolvableJsonDefects: preArchiveTargetValueCanonicalization ? preArchiveTargetValueCanonicalization.unresolvableJsonDefects : undefined,
    canonicalizationArchiveParity: canonicalizationArchiveParity.length > 0 ? canonicalizationArchiveParity : undefined,
    preArchiveStructuralDefects: preArchiveStructuralDefects.length > 0 ? preArchiveStructuralDefects : undefined,
    postClassifierMutationTrace: getMutationTrace(),
    postFreezeMutationTrace: getMutationTrace(),
  };

  if (buildCacheKey && fingerprint) {
    evictOldestCacheEntry();
    const stageEnrichment: CachedStageEnrichment = {
      fingerprint: enrichmentFp || fingerprint,
      enrichment,
      treeEnrichment,
      usedAIFallback: _usedAIFallback,
    };
    const xamlFp = computeXamlFingerprint(enrichment, treeEnrichment, pkg, orchestratorArtifacts, generationMode, tierStr, finalDependencyMap, tf);
    const stageXaml: CachedStageXaml = {
      fingerprint: xamlFp,
      xamlEntries: finalXamlEntries,
      gaps: allGaps,
      usedPackages: allUsedPkgs,
      dependencyMap: finalDependencyMap,
      archiveManifest: finalArchiveManifest,
      referencedMLSkillNames: [...genCtx.referencedMLSkillNames],
      projectJsonContent: finalProjectJsonStr,
      configCsv: configCsv,
      targetFramework: tf,
      automationPattern,
      buffer,
    };
    const qgFp = computeQualityGateFingerprint(finalXamlEntries, finalProjectJsonStr, configCsv, orchestratorArtifacts, tf, tierStr, automationPattern);
    const stageQualityGate: CachedStageQualityGate = {
      fingerprint: qgFp,
      qualityGatePassed: qualityGateResult.passed,
      qualityGateResult,
    };
    packageBuildCache.set(buildCacheKey, {
      overallFingerprint: fingerprint,
      version,
      buffer,
      gaps: allGaps,
      usedPackages: allUsedPkgs,
      enrichment,
      qualityGatePassed: qualityGateResult.passed,
      qualityGateResult,
      xamlEntries: finalXamlEntries,
      dependencyMap: finalDependencyMap,
      archiveManifest: finalArchiveManifest,
      referencedMLSkillNames: [...genCtx.referencedMLSkillNames],
      usedAIFallback: _usedAIFallback,
      projectJsonContent: finalProjectJsonStr,
      stageEnrichment,
      stageXaml,
      stageQualityGate,
      complexityTier: tierStr,
      outcomeReport,
      propertySerializationTrace: collectedPropTrace.length > 0 ? collectedPropTrace : undefined,
      invokeContractTrace: collectedInvokeTrace.length > 0 ? collectedInvokeTrace : undefined,
      stageHashParity: brokenOnlyStageHash.length > 0 ? brokenOnlyStageHash : undefined,
    });
    console.log(`[UiPath Cache] Stored build for ${buildCacheKey} (${buffer.length} bytes, v${version}) with per-stage fingerprints [enrichment=${stageEnrichment.fingerprint.slice(0, 8)}, xaml=${xamlFp.slice(0, 8)}, qg=${qgFp.slice(0, 8)}]`);
  }
  return { buffer, gaps: allGaps, usedPackages: allUsedPkgs, qualityGateResult, xamlEntries: finalXamlEntries, dependencyMap: finalDependencyMap, archiveManifest: finalArchiveManifest, usedFallbackStubs: usedFallback, generationMode, referencedMLSkillNames: [...genCtx.referencedMLSkillNames], dependencyWarnings: dependencyWarnings.length > 0 ? dependencyWarnings : undefined, emissionGateWarnings: emissionGateWarningsList.length > 0 ? emissionGateWarningsList : undefined, usedAIFallback: _usedAIFallback, outcomeReport, projectJsonContent: finalProjectJsonStr, dependencyDiagnostics: postEmissionDiagnostics, dependencyGaps: postEmissionGaps, ambiguousResolutions: postEmissionAmbiguous, orphanDependencies: postEmissionOrphans, propertySerializationTrace: collectedPropTrace.length > 0 ? collectedPropTrace : undefined, invokeContractTrace: collectedInvokeTrace.length > 0 ? collectedInvokeTrace : undefined, stageHashParity: brokenOnlyStageHash.length > 0 ? brokenOnlyStageHash : undefined };
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
      const hashBuffer = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
      contentHashes.set(opts.name, createHash("sha256").update(hashBuffer).digest("hex"));
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

export function assertDhgArchiveParity(
  dhgContent: string,
  archiveWorkflowNames: string[],
  archiveXamlEntries: Array<{ name: string; content: string }>,
  authoritativeClassification?: WorkflowStatusClassifierResult,
): { passed: boolean; divergences: string[] } {
  const divergences: string[] = [];

  const dhgWorkflowTablePattern = /\|\s*\d+\s*\|\s*`([^`]+\.xaml)`\s*\|\s*(Generated|Handoff|Stub|Blocked)\s*\|/g;
  const dhgWorkflowEntries = new Map<string, string>();
  let dhgTableMatch;
  while ((dhgTableMatch = dhgWorkflowTablePattern.exec(dhgContent)) !== null) {
    const wfName = dhgTableMatch[1].replace(/\.xaml$/i, "").toLowerCase();
    dhgWorkflowEntries.set(wfName, dhgTableMatch[2]);
  }

  const archiveManifest = new Set(archiveWorkflowNames.map(n => n.toLowerCase()));
  const dhgManifest = new Set(dhgWorkflowEntries.keys());
  const inArchiveNotDhg = Array.from(archiveManifest).filter(n => !dhgManifest.has(n));
  const inDhgNotArchive = Array.from(dhgManifest).filter(n => !archiveManifest.has(n));
  if (inArchiveNotDhg.length > 0) {
    divergences.push(`In archive but not DHG: ${inArchiveNotDhg.join(", ")}`);
  }
  if (inDhgNotArchive.length > 0) {
    divergences.push(`In DHG but not archive: ${inDhgNotArchive.join(", ")}`);
  }

  const classMap = new Map<string, import("./workflow-status-classifier").WorkflowStatusClassification>();
  if (authoritativeClassification) {
    for (const c of authoritativeClassification.classifications) {
      classMap.set(normalizeClassifierFileName(c.file), c);
    }
  }

  for (const [wfNameLower, dhgTier] of dhgWorkflowEntries) {
    const authEntry = classMap.get(wfNameLower);
    if (authEntry) {
      const isStub = authEntry.status === "stub";
      const isMalformed = authEntry.status === "malformed";
      const isBlocked = authEntry.status === "blocked";
      const isNonStub = authEntry.status === "non-stub";

      if (dhgTier === "Generated" && (isStub || isMalformed || isBlocked)) {
        divergences.push(`Status mismatch: ${wfNameLower}.xaml — DHG says "Generated" but authoritative classifier says "${authEntry.status}" (${authEntry.rationale})`);
      } else if (dhgTier === "Handoff" && (isStub || isMalformed || isBlocked)) {
        divergences.push(`Status mismatch: ${wfNameLower}.xaml — DHG says "Handoff" but authoritative classifier says "${authEntry.status}" (${authEntry.rationale})`);
      } else if (dhgTier === "Stub" && !isStub) {
        divergences.push(`Status mismatch: ${wfNameLower}.xaml — DHG says "Stub" but authoritative classifier says "${authEntry.status}" (${authEntry.rationale})`);
      } else if (dhgTier === "Blocked" && !(isMalformed || isBlocked)) {
        divergences.push(`Status mismatch: ${wfNameLower}.xaml — DHG says "Blocked" but authoritative classifier says "${authEntry.status}" (${authEntry.rationale})`);
      }
    } else {
      const archiveEntry = archiveXamlEntries.find(e => {
        const entryName = (e.name.split("/").pop() || e.name).replace(/\.xaml$/i, "").toLowerCase();
        return entryName === wfNameLower;
      });
      if (archiveEntry) {
        const isActuallyStub = AUTHORITATIVE_STUB_PATTERNS.some(p => archiveEntry.content.includes(p));
        if (dhgTier === "Generated" && isActuallyStub) {
          divergences.push(`Status mismatch: ${wfNameLower}.xaml — DHG says "Generated" but archive content is a stub`);
        } else if (dhgTier === "Handoff" && isActuallyStub) {
          divergences.push(`Status mismatch: ${wfNameLower}.xaml — DHG says "Handoff" but archive content is a stub`);
        } else if (dhgTier === "Stub" && !isActuallyStub) {
          divergences.push(`Status mismatch: ${wfNameLower}.xaml — DHG says "Stub" but archive content is not a stub`);
        } else if (dhgTier === "Blocked" && isActuallyStub) {
          divergences.push(`Status mismatch: ${wfNameLower}.xaml — DHG says "Blocked" but archive content is a stub`);
        }
      }
    }
  }

  return { passed: divergences.length === 0, divergences };
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
      const rawData = entry.getData();
      const actualHash = createHash("sha256").update(rawData).digest("hex");
      if (actualHash !== expectedHash) {
        const utf8Hash = createHash("sha256").update(rawData.toString("utf-8")).digest("hex");
        if (utf8Hash === expectedHash) {
          continue;
        }
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
        const expectedHash = appendedContentHashes.get(archivePath);
        if (expectedHash) {
          const entryData = zip.getEntry(archivePath)?.getData();
          if (entryData) {
            const actualHash = createHash("sha256").update(entryData).digest("hex");
            if (actualHash !== expectedHash) {
              const entryContentHash = createHash("sha256").update(entry.content).digest("hex");
              if (entryContentHash === expectedHash) {
                console.log(`[UiPath Post-Archive Parity] "${basename}": cross-library encoding divergence detected (appended hash matches xamlEntry, AdmZip read differs) — treating as pass`);
              } else {
                parityErrors.push(`Content mismatch for validated XAML "${basename}": appended hash ${expectedHash.substring(0, 12)}..., archive hash ${actualHash.substring(0, 12)}..., xamlEntry hash ${entryContentHash.substring(0, 12)}...`);
              }
            }
          }
        } else {
          console.warn(`[UiPath Post-Archive Parity] No appended hash found for "${archivePath}" — skipping content verification`);
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

  const orchUrl = _metadataService.getServiceUrl("OR", config);
  const uploadUrl = `${orchUrl}/odata/Processes/UiPath.Server.Configuration.OData.UploadPackage`;

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

