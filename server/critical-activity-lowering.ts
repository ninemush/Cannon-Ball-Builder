import { ACTIVITY_DEFINITIONS_REGISTRY, type ActivityPropertyDef, type PackageActivityDefs, type ActivityDef } from "./catalog/activity-definitions";
import type { StudioProfile } from "./catalog/metadata-service";
import type { WorkflowNode, ActivityNode } from "./workflow-spec-types";

export type TargetFrameworkCompat = "Windows" | "Portable" | "Both";

export interface CriticalActivityFamilyContract {
  familyId: string;
  displayLabel: string;
  className: string;
  concreteType: string;
  packageId: string;
  targetFrameworkCompat: TargetFrameworkCompat;
  requiredProperties: string[];
  validChildElements: string[];
  disallowedPseudoRepresentations: string[];
  intentKeywords: string[];
}

interface CriticalFamilyMapping {
  familyId: string;
  className: string;
  packageId: string;
  targetFrameworkCompat: TargetFrameworkCompat;
  disallowedPseudoRepresentations: string[];
  intentKeywords: string[];
}

const CRITICAL_FAMILY_MAPPINGS: CriticalFamilyMapping[] = [
  {
    familyId: "gmail-send",
    className: "GmailSendMessage",
    packageId: "UiPath.GSuite.Activities",
    targetFrameworkCompat: "Both",
    disallowedPseudoRepresentations: ["TryCatch-as-text-property", "narrative-send-description"],
    intentKeywords: ["gmail", "google mail", "gsuite send", "google send email"],
  },
  {
    familyId: "smtp-send",
    className: "SendSmtpMailMessage",
    packageId: "UiPath.Mail.Activities",
    targetFrameworkCompat: "Both",
    disallowedPseudoRepresentations: ["TryCatch-as-text-property", "narrative-send-description"],
    intentKeywords: ["smtp", "smtp send", "send smtp mail"],
  },
  {
    familyId: "outlook-send",
    className: "SendOutlookMailMessage",
    packageId: "UiPath.Mail.Activities",
    targetFrameworkCompat: "Windows",
    disallowedPseudoRepresentations: ["TryCatch-as-text-property", "narrative-send-description"],
    intentKeywords: ["outlook", "outlook send", "send outlook"],
  },
  {
    familyId: "action-center-create",
    className: "CreateFormTask",
    packageId: "UiPath.Persistence.Activities",
    targetFrameworkCompat: "Both",
    disallowedPseudoRepresentations: ["narrative-task-description", "pseudo-property-payload"],
    intentKeywords: ["create task", "action center create", "form task", "human task create"],
  },
  {
    familyId: "action-center-wait",
    className: "WaitForFormTask",
    packageId: "UiPath.Persistence.Activities",
    targetFrameworkCompat: "Both",
    disallowedPseudoRepresentations: ["narrative-wait-description", "pseudo-property-payload"],
    intentKeywords: ["wait for task", "action center wait", "wait form task", "resume task"],
  },
  {
    familyId: "retry-scope",
    className: "RetryScope",
    packageId: "UiPath.System.Activities",
    targetFrameworkCompat: "Both",
    disallowedPseudoRepresentations: ["narrative-retry-description"],
    intentKeywords: ["retry", "retry scope", "retryscope"],
  },
  {
    familyId: "invoke-workflow",
    className: "InvokeWorkflowFile",
    packageId: "UiPath.System.Activities",
    targetFrameworkCompat: "Both",
    disallowedPseudoRepresentations: ["narrative-invoke-description"],
    intentKeywords: ["invoke workflow", "invoke file", "call workflow"],
  },
  {
    familyId: "data-service-create",
    className: "CreateEntity",
    packageId: "UiPath.DataService.Activities",
    targetFrameworkCompat: "Both",
    disallowedPseudoRepresentations: ["narrative-entity-description"],
    intentKeywords: ["data service create", "create entity", "data entity create"],
  },
  {
    familyId: "data-service-update",
    className: "UpdateEntity",
    packageId: "UiPath.DataService.Activities",
    targetFrameworkCompat: "Both",
    disallowedPseudoRepresentations: ["narrative-entity-description"],
    intentKeywords: ["data service update", "update entity", "data entity update"],
  },
  {
    familyId: "data-service-query",
    className: "QueryEntity",
    packageId: "UiPath.DataService.Activities",
    targetFrameworkCompat: "Both",
    disallowedPseudoRepresentations: ["narrative-entity-description"],
    intentKeywords: ["data service query", "query entity", "data entity query"],
  },
];

function resolveRegistryRequiredProperties(className: string, packageId: string): string[] {
  const pkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === packageId);
  if (!pkg) return [];
  const actDef = pkg.activities.find(a => a.className === className);
  if (!actDef) return [];
  return actDef.properties.filter(p => p.required).map(p => p.name);
}

function resolveRegistryChildElements(className: string, packageId: string): string[] {
  const pkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === packageId);
  if (!pkg) return [];
  const actDef = pkg.activities.find(a => a.className === className);
  if (!actDef) return [];
  return actDef.properties.filter(p => p.xamlSyntax === "child-element").map(p => p.name);
}

function resolveConcreteType(className: string, packageId: string): string {
  const pkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === packageId);
  if (!pkg) return `${packageId}.${className}`;
  const actDef = pkg.activities.find(a => a.className === className);
  if (!actDef) return `${packageId}.${className}`;
  if (actDef.namespace) return `${actDef.namespace}.${className}`;
  return `${packageId}.${className}`;
}

function buildContract(mapping: CriticalFamilyMapping): CriticalActivityFamilyContract {
  const reqProps = resolveRegistryRequiredProperties(mapping.className, mapping.packageId);
  const childElems = resolveRegistryChildElements(mapping.className, mapping.packageId);
  const concreteType = resolveConcreteType(mapping.className, mapping.packageId);
  const pkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === mapping.packageId);
  const actDef = pkg?.activities.find(a => a.className === mapping.className);
  return {
    familyId: mapping.familyId,
    displayLabel: actDef?.displayName || mapping.className,
    className: mapping.className,
    concreteType,
    packageId: mapping.packageId,
    targetFrameworkCompat: mapping.targetFrameworkCompat,
    requiredProperties: reqProps,
    validChildElements: childElems,
    disallowedPseudoRepresentations: mapping.disallowedPseudoRepresentations,
    intentKeywords: mapping.intentKeywords,
  };
}

let _cachedContracts: CriticalActivityFamilyContract[] | null = null;

function getCriticalContracts(): CriticalActivityFamilyContract[] {
  if (!_cachedContracts) {
    _cachedContracts = CRITICAL_FAMILY_MAPPINGS.map(buildContract);
  }
  return _cachedContracts;
}

export function getCriticalActivityFamilyContracts(): CriticalActivityFamilyContract[] {
  return getCriticalContracts();
}

export function lookupContractByFamilyId(familyId: string): CriticalActivityFamilyContract | null {
  return getCriticalContracts().find(c => c.familyId === familyId) || null;
}

export function lookupContractByTemplate(template: string): CriticalActivityFamilyContract | null {
  const tLower = template.toLowerCase();
  const stripped = tLower.replace(/^ui:/, "");
  for (const contract of getCriticalContracts()) {
    if (contract.className.toLowerCase() === stripped) return contract;
  }
  return null;
}

export type LoweringOutcome = "lowered" | "rejected_incomplete_contract" | "rejected_no_concrete_mapping" | "rejected_mixed_family" | "rejected_pseudo_representation" | "rejected_framework_incompatible" | "rejected_package_unavailable" | "skipped_not_critical";

export interface CriticalStepLoweringResult {
  file: string;
  workflow: string;
  sourceStep: string;
  detectedIntent: string;
  selectedFamily: string | null;
  resolvedConcreteType: string | null;
  resolvedPackage: string | null;
  targetFrameworkCompatibility: string | null;
  verifiedDependencyMatch: boolean;
  candidatesConsidered: string[];
  contractSatisfied: boolean;
  missingRequiredProperties: string[];
  rejectedPseudoRepresentations: string[];
  loweringOutcome: LoweringOutcome;
  packageFatal: boolean;
  remediationHint: string;
}

export interface CriticalActivityLoweringDiagnostics {
  perStepResults: CriticalStepLoweringResult[];
  summary: {
    totalCriticalSteps: number;
    totalLoweredSuccessfully: number;
    totalRejectedForIncompleteContract: number;
    totalRejectedForNoConcreteMapping: number;
    totalMixedFamilyConflicts: number;
    totalPseudoRepresentationRejections: number;
    totalFrameworkIncompatible: number;
    totalPackageUnavailable: number;
  };
}

const MAIL_SEND_TEMPLATES = new Set([
  "gmailsendmessage", "sendsmtpmailmessage", "sendoutlookmailmessage",
  "sendmail", "sendmail365",
]);

const GMAIL_INDICATOR_PATTERNS = [
  /gmail/i, /gsuite/i, /google\s*mail/i, /google.*send.*email/i, /google.*send.*mail/i,
];

const SMTP_INDICATOR_PATTERNS = [
  /\bsmtp\b/i, /smtp\s*send/i, /send\s*smtp/i,
];

const OUTLOOK_INDICATOR_PATTERNS = [
  /\boutlook\b/i, /outlook\s*send/i, /send\s*outlook/i,
];

const AMBIGUOUS_MAIL_FAMILY = "ambiguous-mail-send";

function detectMailFamily(template: string, displayName: string, properties: Record<string, any>): string | null {
  const tLower = template.toLowerCase().replace(/^ui:/, "");
  const combined = `${tLower} ${displayName.toLowerCase()} ${JSON.stringify(properties).toLowerCase()}`;

  const hasGmail = GMAIL_INDICATOR_PATTERNS.some(p => p.test(combined));
  const hasSmtp = SMTP_INDICATOR_PATTERNS.some(p => p.test(combined));
  const hasOutlook = OUTLOOK_INDICATOR_PATTERNS.some(p => p.test(combined));

  if (tLower === "gmailsendmessage") return "gmail-send";
  if (tLower === "sendsmtpmailmessage") return "smtp-send";
  if (tLower === "sendoutlookmailmessage") return "outlook-send";

  const familyCount = (hasGmail ? 1 : 0) + (hasSmtp ? 1 : 0) + (hasOutlook ? 1 : 0);
  if (familyCount > 1) return AMBIGUOUS_MAIL_FAMILY;

  if (hasGmail) return "gmail-send";
  if (hasSmtp) return "smtp-send";
  if (hasOutlook) return "outlook-send";

  if (tLower === "sendmail" || tLower === "sendmail365") return AMBIGUOUS_MAIL_FAMILY;

  return null;
}

function detectCriticalFamily(template: string, displayName: string, properties: Record<string, any>): string | null {
  const tLower = template.toLowerCase().replace(/^ui:/, "");

  if (MAIL_SEND_TEMPLATES.has(tLower)) {
    return detectMailFamily(template, displayName, properties);
  }

  if (tLower === "createformtask" || tLower === "createexternaltask") return "action-center-create";
  if (tLower === "waitforformtask" || tLower === "waitforformtaskandresume") return "action-center-wait";
  if (tLower === "retryscope") return "retry-scope";
  if (tLower === "invokeworkflowfile") return "invoke-workflow";
  if (tLower === "createentity" || tLower === "createentityrecord") return "data-service-create";
  if (tLower === "updateentity") return "data-service-update";
  if (tLower === "queryentity") return "data-service-query";

  for (const contract of getCriticalContracts()) {
    if (contract.className.toLowerCase() === tLower) return contract.familyId;
  }

  return null;
}

function isPackageInVerifiedSet(packageId: string, verifiedPackages: Set<string>): boolean {
  return verifiedPackages.has(packageId);
}

function isFrameworkCompatible(contract: CriticalActivityFamilyContract, targetFramework: "Windows" | "Portable"): boolean {
  if (contract.targetFrameworkCompat === "Both") return true;
  return contract.targetFrameworkCompat === targetFramework;
}

const PSEUDO_ACTIVITY_PATTERNS = [
  { pattern: /TryCatch\s*[\(\{]/i, representation: "TryCatch-as-text-property" },
  { pattern: /Try\s*[:=]\s*["'][^"']*GmailSendMessage/i, representation: "TryCatch-as-text-property" },
  { pattern: /Try\s*[:=]\s*["'][^"']*SendSmtp/i, representation: "TryCatch-as-text-property" },
  { pattern: /Catches\s*[:=]\s*["'][^"']*Exception\s*->/i, representation: "TryCatch-as-text-property" },
  { pattern: /^\s*Step\s*\d+\s*[:\.]\s*Send\s+/im, representation: "narrative-send-description" },
  { pattern: /^\s*Action\s*[:\.]\s*Create\s+Task/im, representation: "narrative-task-description" },
  { pattern: /^\s*Wait\s+for\s+the\s+task/im, representation: "narrative-wait-description" },
];

function detectPseudoRepresentations(properties: Record<string, any>): string[] {
  const detected: string[] = [];
  for (const [, value] of Object.entries(properties)) {
    const strVal = typeof value === "string" ? value : (value && typeof value === "object" && "value" in value ? String(value.value) : "");
    if (!strVal) continue;
    for (const { pattern, representation } of PSEUDO_ACTIVITY_PATTERNS) {
      if (pattern.test(strVal) && !detected.includes(representation)) {
        detected.push(representation);
      }
    }
  }
  return detected;
}

function getRegistryPropertyDef(className: string, packageId: string, propName: string): ActivityPropertyDef | null {
  const pkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === packageId);
  if (!pkg) return null;
  const actDef = pkg.activities.find(a => a.className === className);
  if (!actDef) return null;
  return actDef.properties.find(p => p.name === propName) || null;
}

function checkRequiredPropertyCompleteness(
  contract: CriticalActivityFamilyContract,
  properties: Record<string, any>,
): string[] {
  const missing: string[] = [];
  for (const reqProp of contract.requiredProperties) {
    const value = properties[reqProp];
    if (value === undefined || value === null) {
      missing.push(reqProp);
      continue;
    }

    const propDef = getRegistryPropertyDef(contract.className, contract.packageId, reqProp);

    if (propDef && propDef.xamlSyntax === "child-element") {
      if (typeof value === "string") {
        const strVal = value.trim();
        if (!strVal || strVal === '""' || /^(PLACEHOLDER|TODO|STUB|HANDOFF)(_\w*)?$/i.test(strVal)) {
          missing.push(reqProp);
          continue;
        }
      } else if (typeof value === "object" && value !== null) {
        if ("value" in value) {
          const innerVal = String(value.value || "").trim();
          if (!innerVal || /^(PLACEHOLDER|TODO|STUB|HANDOFF)(_\w*)?$/i.test(innerVal)) {
            missing.push(reqProp);
            continue;
          }
        } else {
          missing.push(reqProp);
          continue;
        }
      }
    } else {
      const strVal = typeof value === "string" ? value : (value && typeof value === "object" && "value" in value ? String(value.value) : String(value));
      if (!strVal || strVal.trim() === "" || strVal.trim() === '""' || /^(PLACEHOLDER|TODO|STUB|HANDOFF)(_\w*)?$/i.test(strVal.trim())) {
        missing.push(reqProp);
      }
    }
  }
  return missing;
}

export function lowerCriticalActivityNode(
  node: ActivityNode,
  file: string,
  workflow: string,
  profile: StudioProfile | null,
  verifiedPackages: Set<string>,
): CriticalStepLoweringResult {
  const template = node.template;
  const displayName = node.displayName;
  const properties = node.properties || {};
  const targetFramework = profile?.targetFramework || "Windows";

  const detectedFamily = detectCriticalFamily(template, displayName, properties);

  if (!detectedFamily) {
    return {
      file,
      workflow,
      sourceStep: displayName,
      detectedIntent: template,
      selectedFamily: null,
      resolvedConcreteType: null,
      resolvedPackage: null,
      targetFrameworkCompatibility: null,
      verifiedDependencyMatch: false,
      candidatesConsidered: [],
      contractSatisfied: true,
      missingRequiredProperties: [],
      rejectedPseudoRepresentations: [],
      loweringOutcome: "skipped_not_critical",
      packageFatal: false,
      remediationHint: "",
    };
  }

  const contract = lookupContractByFamilyId(detectedFamily);
  if (!contract) {
    return {
      file,
      workflow,
      sourceStep: displayName,
      detectedIntent: template,
      selectedFamily: detectedFamily,
      resolvedConcreteType: null,
      resolvedPackage: null,
      targetFrameworkCompatibility: null,
      verifiedDependencyMatch: false,
      candidatesConsidered: [detectedFamily],
      contractSatisfied: false,
      missingRequiredProperties: [],
      rejectedPseudoRepresentations: [],
      loweringOutcome: "rejected_no_concrete_mapping",
      packageFatal: true,
      remediationHint: `No concrete activity mapping found for family "${detectedFamily}" — cannot emit XAML`,
    };
  }

  if (!isFrameworkCompatible(contract, targetFramework)) {
    return {
      file,
      workflow,
      sourceStep: displayName,
      detectedIntent: template,
      selectedFamily: contract.familyId,
      resolvedConcreteType: contract.concreteType,
      resolvedPackage: contract.packageId,
      targetFrameworkCompatibility: `${contract.targetFrameworkCompat} (target: ${targetFramework})`,
      verifiedDependencyMatch: false,
      candidatesConsidered: [contract.familyId],
      contractSatisfied: false,
      missingRequiredProperties: [],
      rejectedPseudoRepresentations: [],
      loweringOutcome: "rejected_framework_incompatible",
      packageFatal: true,
      remediationHint: `Activity ${contract.concreteType} is only compatible with ${contract.targetFrameworkCompat} framework but target is ${targetFramework}`,
    };
  }

  if (!isPackageInVerifiedSet(contract.packageId, verifiedPackages)) {
    return {
      file,
      workflow,
      sourceStep: displayName,
      detectedIntent: template,
      selectedFamily: contract.familyId,
      resolvedConcreteType: contract.concreteType,
      resolvedPackage: contract.packageId,
      targetFrameworkCompatibility: `${contract.targetFrameworkCompat} (target: ${targetFramework})`,
      verifiedDependencyMatch: false,
      candidatesConsidered: [contract.familyId],
      contractSatisfied: false,
      missingRequiredProperties: [],
      rejectedPseudoRepresentations: [],
      loweringOutcome: "rejected_package_unavailable",
      packageFatal: true,
      remediationHint: `Package ${contract.packageId} is not in the verified dependency set — cannot emit ${contract.concreteType}`,
    };
  }

  const pseudoReps = detectPseudoRepresentations(properties);
  const matchingDisallowed = pseudoReps.filter(p => contract.disallowedPseudoRepresentations.includes(p));
  if (matchingDisallowed.length > 0) {
    return {
      file,
      workflow,
      sourceStep: displayName,
      detectedIntent: template,
      selectedFamily: contract.familyId,
      resolvedConcreteType: contract.concreteType,
      resolvedPackage: contract.packageId,
      targetFrameworkCompatibility: `${contract.targetFrameworkCompat} (target: ${targetFramework})`,
      verifiedDependencyMatch: true,
      candidatesConsidered: [contract.familyId],
      contractSatisfied: false,
      missingRequiredProperties: [],
      rejectedPseudoRepresentations: matchingDisallowed,
      loweringOutcome: "rejected_pseudo_representation",
      packageFatal: true,
      remediationHint: `Activity step "${displayName}" contains pseudo-activity representation(s): ${matchingDisallowed.join(", ")} — lower into real container structures or remove`,
    };
  }

  const missingProps = checkRequiredPropertyCompleteness(contract, properties);
  if (missingProps.length > 0) {
    return {
      file,
      workflow,
      sourceStep: displayName,
      detectedIntent: template,
      selectedFamily: contract.familyId,
      resolvedConcreteType: contract.concreteType,
      resolvedPackage: contract.packageId,
      targetFrameworkCompatibility: `${contract.targetFrameworkCompat} (target: ${targetFramework})`,
      verifiedDependencyMatch: true,
      candidatesConsidered: [contract.familyId],
      contractSatisfied: false,
      missingRequiredProperties: missingProps,
      rejectedPseudoRepresentations: [],
      loweringOutcome: "rejected_incomplete_contract",
      packageFatal: true,
      remediationHint: `Activity ${contract.concreteType} is missing required properties: ${missingProps.join(", ")}`,
    };
  }

  return {
    file,
    workflow,
    sourceStep: displayName,
    detectedIntent: template,
    selectedFamily: contract.familyId,
    resolvedConcreteType: contract.concreteType,
    resolvedPackage: contract.packageId,
    targetFrameworkCompatibility: `${contract.targetFrameworkCompat} (target: ${targetFramework})`,
    verifiedDependencyMatch: true,
    candidatesConsidered: [contract.familyId],
    contractSatisfied: true,
    missingRequiredProperties: [],
    rejectedPseudoRepresentations: [],
    loweringOutcome: "lowered",
    packageFatal: false,
    remediationHint: "",
  };
}

export function detectMixedFamilyDrift(
  nodes: ActivityNode[],
  file: string,
  workflow: string,
): CriticalStepLoweringResult | null {
  const mailFamilies = new Set<string>();
  const mailNodes: string[] = [];
  let hasAmbiguousFamily = false;

  for (const node of nodes) {
    const family = detectCriticalFamily(node.template, node.displayName, node.properties || {});
    if (family && (family === "gmail-send" || family === "smtp-send" || family === "outlook-send" || family === AMBIGUOUS_MAIL_FAMILY)) {
      mailFamilies.add(family);
      mailNodes.push(node.displayName);
      if (family === AMBIGUOUS_MAIL_FAMILY) {
        hasAmbiguousFamily = true;
      }
    }
  }

  if (mailFamilies.size > 1) {
    const isFatal = hasAmbiguousFamily || mailFamilies.has(AMBIGUOUS_MAIL_FAMILY);
    return {
      file,
      workflow,
      sourceStep: mailNodes.join(", "),
      detectedIntent: "mixed-mail-families",
      selectedFamily: null,
      resolvedConcreteType: null,
      resolvedPackage: null,
      targetFrameworkCompatibility: null,
      verifiedDependencyMatch: false,
      candidatesConsidered: Array.from(mailFamilies),
      contractSatisfied: false,
      missingRequiredProperties: [],
      rejectedPseudoRepresentations: [],
      loweringOutcome: "rejected_mixed_family",
      packageFatal: isFatal,
      remediationHint: isFatal
        ? `Workflow "${workflow}" mixes mail-send families with ambiguous templates: ${Array.from(mailFamilies).join(", ")} — resolve ambiguous templates to a specific mail provider`
        : `Workflow "${workflow}" uses multiple explicit mail-send families: ${Array.from(mailFamilies).join(", ")} — verify this is intentional`,
    };
  }

  return null;
}

function collectActivityNodes(node: WorkflowNode): ActivityNode[] {
  const results: ActivityNode[] = [];
  if (node.kind === "activity") {
    results.push(node);
  } else if (node.kind === "sequence") {
    for (const child of node.children) {
      results.push(...collectActivityNodes(child));
    }
  } else if (node.kind === "tryCatch") {
    for (const child of node.tryChildren) results.push(...collectActivityNodes(child));
    for (const child of node.catchChildren) results.push(...collectActivityNodes(child));
    for (const child of node.finallyChildren) results.push(...collectActivityNodes(child));
  } else if (node.kind === "if") {
    for (const child of node.thenChildren) results.push(...collectActivityNodes(child));
    for (const child of node.elseChildren) results.push(...collectActivityNodes(child));
  } else if (node.kind === "while") {
    for (const child of node.bodyChildren) results.push(...collectActivityNodes(child));
  } else if (node.kind === "forEach") {
    for (const child of node.bodyChildren) results.push(...collectActivityNodes(child));
  } else if (node.kind === "retryScope") {
    for (const child of node.bodyChildren) results.push(...collectActivityNodes(child));
  }
  return results;
}

export function runCriticalActivityLowering(
  specs: Array<{ file: string; workflow: string; rootSequence: { kind: "sequence"; displayName: string; children: WorkflowNode[] } }>,
  profile: StudioProfile | null,
  verifiedPackages: Set<string>,
): CriticalActivityLoweringDiagnostics {
  const perStepResults: CriticalStepLoweringResult[] = [];

  for (const spec of specs) {
    const allActivityNodes = collectActivityNodes(spec.rootSequence);

    const mixedDrift = detectMixedFamilyDrift(allActivityNodes, spec.file, spec.workflow);
    if (mixedDrift) {
      perStepResults.push(mixedDrift);
    }

    for (const node of allActivityNodes) {
      const result = lowerCriticalActivityNode(node, spec.file, spec.workflow, profile, verifiedPackages);
      if (result.loweringOutcome !== "skipped_not_critical") {
        perStepResults.push(result);
      }
    }
  }

  const totalCriticalSteps = perStepResults.length;
  const totalLoweredSuccessfully = perStepResults.filter(r => r.loweringOutcome === "lowered").length;
  const totalRejectedForIncompleteContract = perStepResults.filter(r => r.loweringOutcome === "rejected_incomplete_contract").length;
  const totalRejectedForNoConcreteMapping = perStepResults.filter(r => r.loweringOutcome === "rejected_no_concrete_mapping").length;
  const totalMixedFamilyConflicts = perStepResults.filter(r => r.loweringOutcome === "rejected_mixed_family").length;
  const totalPseudoRepresentationRejections = perStepResults.filter(r => r.loweringOutcome === "rejected_pseudo_representation").length;
  const totalFrameworkIncompatible = perStepResults.filter(r => r.loweringOutcome === "rejected_framework_incompatible").length;
  const totalPackageUnavailable = perStepResults.filter(r => r.loweringOutcome === "rejected_package_unavailable").length;

  return {
    perStepResults,
    summary: {
      totalCriticalSteps,
      totalLoweredSuccessfully,
      totalRejectedForIncompleteContract,
      totalRejectedForNoConcreteMapping,
      totalMixedFamilyConflicts,
      totalPseudoRepresentationRejections,
      totalFrameworkIncompatible,
      totalPackageUnavailable,
    },
  };
}

export interface PreEmissionLoweringGateResult {
  passed: boolean;
  diagnostics: CriticalActivityLoweringDiagnostics;
  fatalFailures: CriticalStepLoweringResult[];
}

export function runPreEmissionLoweringGate(
  spec: { name: string; rootSequence: { kind: "sequence"; displayName: string; children: WorkflowNode[] } },
  targetFramework: "Windows" | "Portable",
  verifiedPackages: Set<string>,
): PreEmissionLoweringGateResult {
  const profile: StudioProfile = {
    studioLine: "StudioX",
    studioVersion: "2024.10",
    targetFramework,
    projectType: "Process",
    expressionLanguage: "VisualBasic",
    minimumRequiredPackages: [],
  };
  const file = `${spec.name || "Workflow"}.xaml`;
  const workflow = spec.name || "Workflow";

  const diagnostics = runCriticalActivityLowering(
    [{ file, workflow, rootSequence: spec.rootSequence }],
    profile,
    verifiedPackages,
  );

  const fatalFailures = diagnostics.perStepResults.filter(r => r.packageFatal);
  return {
    passed: fatalFailures.length === 0,
    diagnostics,
    fatalFailures,
  };
}

export function loweringDiagnosticsToPackageViolations(
  diagnostics: CriticalActivityLoweringDiagnostics,
): Array<{
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  violationType: "critical_activity_lowering_failure";
  severity: "execution_blocking";
  packageFatal: boolean;
  handoffGuidanceAvailable: boolean;
  remediationHint: string;
}> {
  const violations: Array<{
    file: string;
    workflow: string;
    activityType: string;
    propertyName: string;
    violationType: "critical_activity_lowering_failure";
    severity: "execution_blocking";
    packageFatal: boolean;
    handoffGuidanceAvailable: boolean;
    remediationHint: string;
  }> = [];

  for (const result of diagnostics.perStepResults) {
    if (result.packageFatal) {
      violations.push({
        file: result.file,
        workflow: result.workflow,
        activityType: result.resolvedConcreteType || result.detectedIntent,
        propertyName: result.missingRequiredProperties.join(", ") || "FamilyContract",
        violationType: "critical_activity_lowering_failure",
        severity: "execution_blocking",
        packageFatal: true,
        handoffGuidanceAvailable: true,
        remediationHint: result.remediationHint,
      });
    }
  }

  return violations;
}

function extractActivityBlock(content: string, matchStart: number, activityName: string, prefix: string): string | null {
  const tagName = prefix ? `${prefix}${activityName}` : activityName;
  const selfCloseCheck = content.substring(matchStart, matchStart + 500);
  const selfCloseMatch = selfCloseCheck.match(/^<[^>]*\/>/);
  if (selfCloseMatch) {
    return selfCloseMatch[0];
  }
  const closingTag = `</${tagName}>`;
  const altClosingTag = prefix ? `</${activityName}>` : null;
  let searchFrom = matchStart;
  let endIdx = content.indexOf(closingTag, searchFrom);
  if (endIdx === -1 && altClosingTag) {
    endIdx = content.indexOf(altClosingTag, searchFrom);
  }
  if (endIdx === -1) {
    return content.substring(matchStart, Math.min(matchStart + 2000, content.length));
  }
  return content.substring(matchStart, endIdx + closingTag.length);
}

function detectPseudoRepresentationsFromStrings(properties: Record<string, string>): string[] {
  const detected: string[] = [];
  for (const [, value] of Object.entries(properties)) {
    if (!value) continue;
    for (const { pattern, representation } of PSEUDO_ACTIVITY_PATTERNS) {
      if (pattern.test(value) && !detected.includes(representation)) {
        detected.push(representation);
      }
    }
  }
  return detected;
}

export function runXamlLevelCriticalActivityLowering(
  xamlEntries: { name: string; content: string }[],
  profile: StudioProfile | null,
  verifiedPackages: Set<string>,
): CriticalActivityLoweringDiagnostics {
  const perStepResults: CriticalStepLoweringResult[] = [];

  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const workflow = shortName.replace(/\.xaml$/i, "");
    const content = entry.content;
    const targetFramework = profile?.targetFramework || "Windows";

    const mailFamilies = new Set<string>();
    const mailStepNames: string[] = [];
    let hasAmbiguousMailFamily = false;

    const activityPattern = /<(ui:)?(\w+)\s+([^>]*?)(?:\/>|>)/g;
    let match;
    while ((match = activityPattern.exec(content)) !== null) {
      const prefix = match[1] || "";
      const activityName = match[2];
      const attrs = match[3] || "";
      const fullTag = `${prefix}${activityName}`;

      const templateLower = activityName.toLowerCase();
      if (!MAIL_SEND_TEMPLATES.has(templateLower) &&
          templateLower !== "createformtask" &&
          templateLower !== "waitforformtask" &&
          templateLower !== "retryscope" &&
          templateLower !== "invokeworkflowfile" &&
          templateLower !== "createentity" &&
          templateLower !== "createentityrecord" &&
          templateLower !== "updateentity" &&
          templateLower !== "queryentity") {
        continue;
      }

      const displayNameMatch = attrs.match(/DisplayName="([^"]*)"/);
      const displayName = displayNameMatch ? displayNameMatch[1] : activityName;

      const properties: Record<string, string> = {};
      const attrPattern = /(\w+)="([^"]*)"/g;
      let attrMatch;
      while ((attrMatch = attrPattern.exec(attrs)) !== null) {
        if (attrMatch[1] !== "DisplayName" && !attrMatch[1].startsWith("xmlns") && !attrMatch[1].startsWith("sap2010")) {
          properties[attrMatch[1]] = attrMatch[2];
        }
      }

      const familyId = detectCriticalFamily(activityName, displayName, properties);

      if (familyId && (familyId === "gmail-send" || familyId === "smtp-send" || familyId === "outlook-send" || familyId === AMBIGUOUS_MAIL_FAMILY)) {
        mailFamilies.add(familyId);
        mailStepNames.push(displayName);
        if (familyId === AMBIGUOUS_MAIL_FAMILY) {
          hasAmbiguousMailFamily = true;
        }
      }

      if (!familyId) continue;

      const contract = lookupContractByFamilyId(familyId);
      if (!contract) {
        perStepResults.push({
          file: shortName,
          workflow,
          sourceStep: displayName,
          detectedIntent: fullTag,
          selectedFamily: familyId,
          resolvedConcreteType: null,
          resolvedPackage: null,
          targetFrameworkCompatibility: null,
          verifiedDependencyMatch: false,
          candidatesConsidered: [familyId],
          contractSatisfied: false,
          missingRequiredProperties: [],
          rejectedPseudoRepresentations: [],
          loweringOutcome: "rejected_no_concrete_mapping",
          packageFatal: true,
          remediationHint: `No concrete activity mapping found for family "${familyId}"`,
        });
        continue;
      }

      if (!isFrameworkCompatible(contract, targetFramework)) {
        perStepResults.push({
          file: shortName,
          workflow,
          sourceStep: displayName,
          detectedIntent: fullTag,
          selectedFamily: contract.familyId,
          resolvedConcreteType: contract.concreteType,
          resolvedPackage: contract.packageId,
          targetFrameworkCompatibility: `${contract.targetFrameworkCompat} (target: ${targetFramework})`,
          verifiedDependencyMatch: false,
          candidatesConsidered: [contract.familyId],
          contractSatisfied: false,
          missingRequiredProperties: [],
          rejectedPseudoRepresentations: [],
          loweringOutcome: "rejected_framework_incompatible",
          packageFatal: true,
          remediationHint: `Activity ${contract.concreteType} is only compatible with ${contract.targetFrameworkCompat} framework but target is ${targetFramework}`,
        });
        continue;
      }

      if (!isPackageInVerifiedSet(contract.packageId, verifiedPackages)) {
        perStepResults.push({
          file: shortName,
          workflow,
          sourceStep: displayName,
          detectedIntent: fullTag,
          selectedFamily: contract.familyId,
          resolvedConcreteType: contract.concreteType,
          resolvedPackage: contract.packageId,
          targetFrameworkCompatibility: `${contract.targetFrameworkCompat} (target: ${targetFramework})`,
          verifiedDependencyMatch: false,
          candidatesConsidered: [contract.familyId],
          contractSatisfied: false,
          missingRequiredProperties: [],
          rejectedPseudoRepresentations: [],
          loweringOutcome: "rejected_package_unavailable",
          packageFatal: true,
          remediationHint: `Package ${contract.packageId} is not in the verified dependency set`,
        });
        continue;
      }

      const activityBlock = extractActivityBlock(content, match.index!, activityName, prefix);

      const pseudoReps = detectPseudoRepresentationsFromStrings(properties);
      const matchingDisallowed = pseudoReps.filter(p => contract.disallowedPseudoRepresentations.includes(p));
      if (matchingDisallowed.length > 0) {
        perStepResults.push({
          file: shortName,
          workflow,
          sourceStep: displayName,
          detectedIntent: fullTag,
          selectedFamily: contract.familyId,
          resolvedConcreteType: contract.concreteType,
          resolvedPackage: contract.packageId,
          targetFrameworkCompatibility: `${contract.targetFrameworkCompat} (target: ${targetFramework})`,
          verifiedDependencyMatch: true,
          candidatesConsidered: [contract.familyId],
          contractSatisfied: false,
          missingRequiredProperties: [],
          rejectedPseudoRepresentations: matchingDisallowed,
          loweringOutcome: "rejected_pseudo_representation",
          packageFatal: true,
          remediationHint: `Activity step "${displayName}" contains pseudo-activity representation(s): ${matchingDisallowed.join(", ")} — lower into real container structures or remove`,
        });
        continue;
      }

      const missingProps: string[] = [];
      for (const reqProp of contract.requiredProperties) {
        const hasAsAttr = properties[reqProp] !== undefined && properties[reqProp] !== "";
        const hasAsChild = activityBlock
          ? (new RegExp(`<${fullTag}\\.${reqProp}>`, "i").test(activityBlock) ||
             new RegExp(`<${activityName}\\.${reqProp}>`, "i").test(activityBlock))
          : false;
        if (!hasAsAttr && !hasAsChild) {
          missingProps.push(reqProp);
        } else if (hasAsAttr) {
          const val = properties[reqProp];
          if (/^(PLACEHOLDER|TODO|STUB|HANDOFF)(_\w*)?$/i.test(val.trim())) {
            missingProps.push(reqProp);
          }
        }
      }

      if (missingProps.length > 0) {
        perStepResults.push({
          file: shortName,
          workflow,
          sourceStep: displayName,
          detectedIntent: fullTag,
          selectedFamily: contract.familyId,
          resolvedConcreteType: contract.concreteType,
          resolvedPackage: contract.packageId,
          targetFrameworkCompatibility: `${contract.targetFrameworkCompat} (target: ${targetFramework})`,
          verifiedDependencyMatch: true,
          candidatesConsidered: [contract.familyId],
          contractSatisfied: false,
          missingRequiredProperties: missingProps,
          rejectedPseudoRepresentations: [],
          loweringOutcome: "rejected_incomplete_contract",
          packageFatal: true,
          remediationHint: `Activity ${contract.concreteType} is missing required properties: ${missingProps.join(", ")}`,
        });
        continue;
      }

      perStepResults.push({
        file: shortName,
        workflow,
        sourceStep: displayName,
        detectedIntent: fullTag,
        selectedFamily: contract.familyId,
        resolvedConcreteType: contract.concreteType,
        resolvedPackage: contract.packageId,
        targetFrameworkCompatibility: `${contract.targetFrameworkCompat} (target: ${targetFramework})`,
        verifiedDependencyMatch: true,
        candidatesConsidered: [contract.familyId],
        contractSatisfied: true,
        missingRequiredProperties: [],
        rejectedPseudoRepresentations: [],
        loweringOutcome: "lowered",
        packageFatal: false,
        remediationHint: "",
      });
    }

    if (mailFamilies.size > 1) {
      const isFatal = hasAmbiguousMailFamily || mailFamilies.has(AMBIGUOUS_MAIL_FAMILY);
      perStepResults.push({
        file: shortName,
        workflow,
        sourceStep: mailStepNames.join(", "),
        detectedIntent: "mixed-mail-families",
        selectedFamily: null,
        resolvedConcreteType: null,
        resolvedPackage: null,
        targetFrameworkCompatibility: null,
        verifiedDependencyMatch: false,
        candidatesConsidered: Array.from(mailFamilies),
        contractSatisfied: false,
        missingRequiredProperties: [],
        rejectedPseudoRepresentations: [],
        loweringOutcome: "rejected_mixed_family",
        packageFatal: isFatal,
        remediationHint: isFatal
          ? `Workflow "${workflow}" mixes mail-send families with ambiguous templates: ${Array.from(mailFamilies).join(", ")} — resolve ambiguous templates to a specific mail provider`
          : `Workflow "${workflow}" uses multiple explicit mail-send families: ${Array.from(mailFamilies).join(", ")} — verify this is intentional`,
      });
    }
  }

  const totalCriticalSteps = perStepResults.length;
  const totalLoweredSuccessfully = perStepResults.filter(r => r.loweringOutcome === "lowered").length;
  const totalRejectedForIncompleteContract = perStepResults.filter(r => r.loweringOutcome === "rejected_incomplete_contract").length;
  const totalRejectedForNoConcreteMapping = perStepResults.filter(r => r.loweringOutcome === "rejected_no_concrete_mapping").length;
  const totalMixedFamilyConflicts = perStepResults.filter(r => r.loweringOutcome === "rejected_mixed_family").length;
  const totalPseudoRepresentationRejections = perStepResults.filter(r => r.loweringOutcome === "rejected_pseudo_representation").length;
  const totalFrameworkIncompatible = perStepResults.filter(r => r.loweringOutcome === "rejected_framework_incompatible").length;
  const totalPackageUnavailable = perStepResults.filter(r => r.loweringOutcome === "rejected_package_unavailable").length;

  return {
    perStepResults,
    summary: {
      totalCriticalSteps,
      totalLoweredSuccessfully,
      totalRejectedForIncompleteContract,
      totalRejectedForNoConcreteMapping,
      totalMixedFamilyConflicts,
      totalPseudoRepresentationRejections,
      totalFrameworkIncompatible,
      totalPackageUnavailable,
    },
  };
}

export type MailFamily = "gmail-send" | "smtp-send" | "outlook-send";

const MAIL_FAMILY_SET = new Set<string>(["gmail-send", "smtp-send", "outlook-send"]);

const MAIL_FAMILY_PACKAGE_MAP: Record<MailFamily, string> = {
  "gmail-send": "UiPath.GSuite.Activities",
  "smtp-send": "UiPath.Mail.Activities",
  "outlook-send": "UiPath.Mail.Activities",
};

const MAIL_FAMILY_ACTIVITY_MAP: Record<MailFamily, string> = {
  "gmail-send": "GmailSendMessage",
  "smtp-send": "SendSmtpMailMessage",
  "outlook-send": "SendOutlookMailMessage",
};

const CROSS_FAMILY_ACTIVITY_TAGS: Record<MailFamily, Set<string>> = {
  "gmail-send": new Set(["SendSmtpMailMessage", "SendOutlookMailMessage", "ui:SendSmtpMailMessage", "ui:SendOutlookMailMessage"]),
  "smtp-send": new Set(["GmailSendMessage", "SendOutlookMailMessage", "ui:GmailSendMessage", "ui:SendOutlookMailMessage"]),
  "outlook-send": new Set(["GmailSendMessage", "SendSmtpMailMessage", "ui:GmailSendMessage", "ui:SendSmtpMailMessage"]),
};

const CROSS_FAMILY_PACKAGE_MAP: Record<MailFamily, Set<string>> = {
  "gmail-send": new Set(["UiPath.Mail.Activities"]),
  "smtp-send": new Set(["UiPath.GSuite.Activities"]),
  "outlook-send": new Set(["UiPath.GSuite.Activities"]),
};

export interface MailSendClusterNode {
  nodeIndex: number;
  displayName: string;
  template: string;
  detectedFamily: string | null;
  role: "concrete-send" | "trycatch-wrapper" | "retryscope-wrapper" | "catch-step" | "logging-step";
  properties: Record<string, any>;
}

export interface MailSendCluster {
  clusterId: string;
  file: string;
  workflow: string;
  nodes: MailSendClusterNode[];
  concreteSendNode: MailSendClusterNode | null;
  detectedFamilies: Set<string>;
  hasNarrativeContainer: boolean;
  narrativeRepresentationsFound: string[];
}

export interface MailFamilyLockResult {
  clusterId: string;
  file: string;
  workflow: string;
  selectedFamily: MailFamily | null;
  concreteActivityType: string | null;
  concretePackage: string | null;
  locked: boolean;
  lockRejectionReason: string | null;
  narrativeRepresentationsRejected: string[];
  missingRequiredProperties: string[];
  packageFatal: boolean;
  crossFamilyDriftViolation: boolean;
}

export interface MailFamilyLockDiagnostics {
  perClusterResults: MailFamilyLockResult[];
  summary: {
    totalClusters: number;
    totalLocked: number;
    totalRejectedAmbiguous: number;
    totalRejectedNarrative: number;
    totalRejectedMissingProperties: number;
    totalCrossFamilyDriftViolations: number;
  };
}

const NARRATIVE_TRYCATCH_PATTERNS = [
  { pattern: /Try\s*[:=]\s*["'][^"']*(?:GmailSendMessage|SendSmtpMailMessage|SendOutlookMailMessage)/i, kind: "narrative-try-send" },
  { pattern: /Catches\s*[:=]\s*["'][^"']*Exception\s*->/i, kind: "narrative-catch-block" },
  { pattern: /TryCatch\s*[\(\{].*(?:GmailSendMessage|SendSmtpMailMessage|SendOutlookMailMessage)/i, kind: "narrative-trycatch-container" },
  { pattern: /Try\s*=\s*["'][^"']*Send/i, kind: "narrative-try-attribute" },
  { pattern: /Finally\s*[:=]\s*["'][^"']*(?:Log|Cleanup|Close)/i, kind: "narrative-finally-block" },
];

function detectNarrativeContainerRepresentations(properties: Record<string, any>): string[] {
  const found: string[] = [];
  for (const [, value] of Object.entries(properties)) {
    const strVal = typeof value === "string" ? value : (value && typeof value === "object" && "value" in value ? String(value.value) : "");
    if (!strVal) continue;
    for (const { pattern, kind } of NARRATIVE_TRYCATCH_PATTERNS) {
      if (pattern.test(strVal) && !found.includes(kind)) {
        found.push(kind);
      }
    }
  }
  return found;
}

function isMailSendTemplate(template: string): boolean {
  const tLower = template.toLowerCase().replace(/^ui:/, "");
  return MAIL_SEND_TEMPLATES.has(tLower);
}

function isTryCatchOrRetryWrapper(node: WorkflowNode): boolean {
  return node.kind === "tryCatch" || node.kind === "retryScope";
}

function isLoggingOrCatchStep(node: ActivityNode): boolean {
  const tLower = node.template.toLowerCase();
  return tLower === "logmessage" || tLower === "log" || tLower === "writeline" || tLower === "comment";
}

function collectMailSendClustersRecursive(
  nodes: WorkflowNode[],
  file: string,
  workflow: string,
  clusters: MailSendCluster[],
  clusterCounter: { value: number },
  parentWrapper: { kind: string; displayName: string } | null,
): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.kind === "activity" && isMailSendTemplate(node.template)) {
      const clusterId = `${file}:${workflow}:mail-cluster-${clusterCounter.value++}`;
      const family = detectMailFamily(node.template, node.displayName, node.properties || {});
      const narrativeReps = detectNarrativeContainerRepresentations(node.properties || {});
      const pseudoReps = detectPseudoRepresentations(node.properties || {});

      const clusterNodes: MailSendClusterNode[] = [];

      if (parentWrapper) {
        clusterNodes.push({
          nodeIndex: i,
          displayName: parentWrapper.displayName,
          template: parentWrapper.kind === "tryCatch" ? "TryCatch" : parentWrapper.kind === "retryScope" ? "RetryScope" : parentWrapper.kind,
          detectedFamily: null,
          role: parentWrapper.kind === "tryCatch" ? "trycatch-wrapper" : parentWrapper.kind === "retryScope" ? "retryscope-wrapper" : "logging-step",
          properties: {},
        });
      }

      clusterNodes.push({
        nodeIndex: i,
        displayName: node.displayName,
        template: node.template,
        detectedFamily: family,
        role: "concrete-send",
        properties: node.properties || {},
      });

      if (i > 0) {
        const prev = nodes[i - 1];
        if (prev.kind === "activity" && isLoggingOrCatchStep(prev)) {
          clusterNodes.unshift({
            nodeIndex: i - 1,
            displayName: prev.displayName,
            template: prev.template,
            detectedFamily: null,
            role: "logging-step",
            properties: prev.properties || {},
          });
        }
      }

      if (i + 1 < nodes.length) {
        const next = nodes[i + 1];
        if (next.kind === "activity" && isLoggingOrCatchStep(next)) {
          clusterNodes.push({
            nodeIndex: i + 1,
            displayName: next.displayName,
            template: next.template,
            detectedFamily: null,
            role: "logging-step",
            properties: next.properties || {},
          });
        }
      }

      const detectedFamilies = new Set<string>();
      if (family) detectedFamilies.add(family);

      clusters.push({
        clusterId,
        file,
        workflow,
        nodes: clusterNodes,
        concreteSendNode: clusterNodes.find(n => n.role === "concrete-send") || null,
        detectedFamilies,
        hasNarrativeContainer: narrativeReps.length > 0 || pseudoReps.some(p =>
          p === "TryCatch-as-text-property" || p === "narrative-send-description"
        ),
        narrativeRepresentationsFound: [...narrativeReps, ...pseudoReps.filter(p =>
          p === "TryCatch-as-text-property" || p === "narrative-send-description"
        )],
      });
      continue;
    }

    if (node.kind === "tryCatch") {
      const innerActivities = collectActivityNodes(node);
      const mailActivities = innerActivities.filter(a => isMailSendTemplate(a.template));

      if (mailActivities.length > 0) {
        const clusterId = `${file}:${workflow}:mail-cluster-${clusterCounter.value++}`;
        const detectedFamilies = new Set<string>();
        const allNarrativeReps: string[] = [];
        let concreteSendClusterNode: MailSendClusterNode | null = null;

        const clusterNodes: MailSendClusterNode[] = [{
          nodeIndex: i,
          displayName: node.displayName,
          template: "TryCatch",
          detectedFamily: null,
          role: "trycatch-wrapper",
          properties: {},
        }];

        for (const mailAct of mailActivities) {
          const actFamily = detectMailFamily(mailAct.template, mailAct.displayName, mailAct.properties || {});
          if (actFamily) detectedFamilies.add(actFamily);
          const narr = detectNarrativeContainerRepresentations(mailAct.properties || {});
          allNarrativeReps.push(...narr);

          const sendNode: MailSendClusterNode = {
            nodeIndex: i,
            displayName: mailAct.displayName,
            template: mailAct.template,
            detectedFamily: actFamily,
            role: "concrete-send",
            properties: mailAct.properties || {},
          };
          clusterNodes.push(sendNode);
          if (!concreteSendClusterNode) concreteSendClusterNode = sendNode;
        }

        const nonMailActivities = innerActivities.filter(a => !isMailSendTemplate(a.template));
        for (const nonMail of nonMailActivities) {
          if (isLoggingOrCatchStep(nonMail)) {
            clusterNodes.push({
              nodeIndex: i,
              displayName: nonMail.displayName,
              template: nonMail.template,
              detectedFamily: null,
              role: "catch-step",
              properties: nonMail.properties || {},
            });
          }
        }

        clusters.push({
          clusterId,
          file,
          workflow,
          nodes: clusterNodes,
          concreteSendNode: concreteSendClusterNode,
          detectedFamilies,
          hasNarrativeContainer: allNarrativeReps.length > 0,
          narrativeRepresentationsFound: allNarrativeReps,
        });
      } else {
        collectMailSendClustersRecursive(node.tryChildren, file, workflow, clusters, clusterCounter, { kind: "tryCatch", displayName: node.displayName });
        collectMailSendClustersRecursive(node.catchChildren, file, workflow, clusters, clusterCounter, null);
        collectMailSendClustersRecursive(node.finallyChildren, file, workflow, clusters, clusterCounter, null);
      }
      continue;
    }

    if (node.kind === "retryScope") {
      const innerActivities = collectActivityNodes(node);
      const mailActivities = innerActivities.filter(a => isMailSendTemplate(a.template));

      if (mailActivities.length > 0) {
        const clusterId = `${file}:${workflow}:mail-cluster-${clusterCounter.value++}`;
        const detectedFamilies = new Set<string>();
        const allNarrativeReps: string[] = [];
        let concreteSendClusterNode: MailSendClusterNode | null = null;

        const clusterNodes: MailSendClusterNode[] = [{
          nodeIndex: i,
          displayName: node.displayName,
          template: "RetryScope",
          detectedFamily: null,
          role: "retryscope-wrapper",
          properties: {},
        }];

        for (const mailAct of mailActivities) {
          const actFamily = detectMailFamily(mailAct.template, mailAct.displayName, mailAct.properties || {});
          if (actFamily) detectedFamilies.add(actFamily);
          const narr = detectNarrativeContainerRepresentations(mailAct.properties || {});
          allNarrativeReps.push(...narr);

          const sendNode: MailSendClusterNode = {
            nodeIndex: i,
            displayName: mailAct.displayName,
            template: mailAct.template,
            detectedFamily: actFamily,
            role: "concrete-send",
            properties: mailAct.properties || {},
          };
          clusterNodes.push(sendNode);
          if (!concreteSendClusterNode) concreteSendClusterNode = sendNode;
        }

        clusters.push({
          clusterId,
          file,
          workflow,
          nodes: clusterNodes,
          concreteSendNode: concreteSendClusterNode,
          detectedFamilies,
          hasNarrativeContainer: allNarrativeReps.length > 0,
          narrativeRepresentationsFound: allNarrativeReps,
        });
      } else {
        collectMailSendClustersRecursive(node.bodyChildren, file, workflow, clusters, clusterCounter, { kind: "retryScope", displayName: node.displayName });
      }
      continue;
    }

    if (node.kind === "sequence") {
      collectMailSendClustersRecursive(node.children, file, workflow, clusters, clusterCounter, parentWrapper);
    } else if (node.kind === "if") {
      collectMailSendClustersRecursive(node.thenChildren, file, workflow, clusters, clusterCounter, parentWrapper);
      collectMailSendClustersRecursive(node.elseChildren, file, workflow, clusters, clusterCounter, parentWrapper);
    } else if (node.kind === "while") {
      collectMailSendClustersRecursive(node.bodyChildren, file, workflow, clusters, clusterCounter, parentWrapper);
    } else if (node.kind === "forEach") {
      collectMailSendClustersRecursive(node.bodyChildren, file, workflow, clusters, clusterCounter, parentWrapper);
    }
  }
}

export function detectMailSendClusters(
  nodes: WorkflowNode[],
  file: string,
  workflow: string,
): MailSendCluster[] {
  const clusters: MailSendCluster[] = [];
  const clusterCounter = { value: 0 };
  collectMailSendClustersRecursive(nodes, file, workflow, clusters, clusterCounter, null);
  return clusters;
}

export function lockClusterToFamily(
  cluster: MailSendCluster,
  profile: StudioProfile | null,
  verifiedPackages: Set<string>,
): MailFamilyLockResult {
  const { clusterId, file, workflow } = cluster;

  if (cluster.hasNarrativeContainer && cluster.narrativeRepresentationsFound.length > 0) {
    return {
      clusterId,
      file,
      workflow,
      selectedFamily: null,
      concreteActivityType: null,
      concretePackage: null,
      locked: false,
      lockRejectionReason: `Cluster contains narrative container representations: ${cluster.narrativeRepresentationsFound.join(", ")} — must be lowered into real TryCatch containers or rejected`,
      narrativeRepresentationsRejected: cluster.narrativeRepresentationsFound,
      missingRequiredProperties: [],
      packageFatal: true,
      crossFamilyDriftViolation: false,
    };
  }

  const concreteFamilies = Array.from(cluster.detectedFamilies).filter(f => MAIL_FAMILY_SET.has(f));
  const ambiguousFamilies = Array.from(cluster.detectedFamilies).filter(f => f === AMBIGUOUS_MAIL_FAMILY);

  if (concreteFamilies.length === 0 && ambiguousFamilies.length > 0) {
    return {
      clusterId,
      file,
      workflow,
      selectedFamily: null,
      concreteActivityType: null,
      concretePackage: null,
      locked: false,
      lockRejectionReason: `Cluster has ambiguous mail family — cannot determine concrete family for locking`,
      narrativeRepresentationsRejected: [],
      missingRequiredProperties: [],
      packageFatal: true,
      crossFamilyDriftViolation: false,
    };
  }

  if (concreteFamilies.length > 1) {
    return {
      clusterId,
      file,
      workflow,
      selectedFamily: null,
      concreteActivityType: null,
      concretePackage: null,
      locked: false,
      lockRejectionReason: `Cluster has conflicting mail families: ${concreteFamilies.join(", ")} — cannot lock to single family`,
      narrativeRepresentationsRejected: [],
      missingRequiredProperties: [],
      packageFatal: true,
      crossFamilyDriftViolation: true,
    };
  }

  if (concreteFamilies.length === 0) {
    return {
      clusterId,
      file,
      workflow,
      selectedFamily: null,
      concreteActivityType: null,
      concretePackage: null,
      locked: false,
      lockRejectionReason: `Cluster has no detectable mail family`,
      narrativeRepresentationsRejected: [],
      missingRequiredProperties: [],
      packageFatal: true,
      crossFamilyDriftViolation: false,
    };
  }

  const selectedFamily = concreteFamilies[0] as MailFamily;
  const contract = lookupContractByFamilyId(selectedFamily);
  if (!contract) {
    return {
      clusterId,
      file,
      workflow,
      selectedFamily,
      concreteActivityType: null,
      concretePackage: null,
      locked: false,
      lockRejectionReason: `No contract found for family "${selectedFamily}"`,
      narrativeRepresentationsRejected: [],
      missingRequiredProperties: [],
      packageFatal: true,
      crossFamilyDriftViolation: false,
    };
  }

  const targetFramework = profile?.targetFramework || "Windows";
  if (!isFrameworkCompatible(contract, targetFramework)) {
    return {
      clusterId,
      file,
      workflow,
      selectedFamily,
      concreteActivityType: contract.concreteType,
      concretePackage: contract.packageId,
      locked: false,
      lockRejectionReason: `Family "${selectedFamily}" is only compatible with ${contract.targetFrameworkCompat} but target is ${targetFramework}`,
      narrativeRepresentationsRejected: [],
      missingRequiredProperties: [],
      packageFatal: true,
      crossFamilyDriftViolation: false,
    };
  }

  if (!isPackageInVerifiedSet(contract.packageId, verifiedPackages)) {
    return {
      clusterId,
      file,
      workflow,
      selectedFamily,
      concreteActivityType: contract.concreteType,
      concretePackage: contract.packageId,
      locked: false,
      lockRejectionReason: `Package ${contract.packageId} is not in the verified dependency set`,
      narrativeRepresentationsRejected: [],
      missingRequiredProperties: [],
      packageFatal: true,
      crossFamilyDriftViolation: false,
    };
  }

  if (cluster.concreteSendNode) {
    const missingProps = checkRequiredPropertyCompleteness(contract, cluster.concreteSendNode.properties);
    if (missingProps.length > 0) {
      return {
        clusterId,
        file,
        workflow,
        selectedFamily,
        concreteActivityType: contract.concreteType,
        concretePackage: contract.packageId,
        locked: false,
        lockRejectionReason: `Missing required properties: ${missingProps.join(", ")}`,
        narrativeRepresentationsRejected: [],
        missingRequiredProperties: missingProps,
        packageFatal: true,
        crossFamilyDriftViolation: false,
      };
    }
  }

  return {
    clusterId,
    file,
    workflow,
    selectedFamily,
    concreteActivityType: contract.concreteType,
    concretePackage: contract.packageId,
    locked: true,
    lockRejectionReason: null,
    narrativeRepresentationsRejected: [],
    missingRequiredProperties: [],
    packageFatal: false,
    crossFamilyDriftViolation: false,
  };
}

export function buildMailFamilyLockDiagnostics(
  lockResults: MailFamilyLockResult[],
): MailFamilyLockDiagnostics {
  return {
    perClusterResults: lockResults,
    summary: {
      totalClusters: lockResults.length,
      totalLocked: lockResults.filter(r => r.locked).length,
      totalRejectedAmbiguous: lockResults.filter(r => !r.locked && r.lockRejectionReason?.includes("ambiguous")).length,
      totalRejectedNarrative: lockResults.filter(r => r.narrativeRepresentationsRejected.length > 0).length,
      totalRejectedMissingProperties: lockResults.filter(r => r.missingRequiredProperties.length > 0).length,
      totalCrossFamilyDriftViolations: lockResults.filter(r => r.crossFamilyDriftViolation).length,
    },
  };
}

export interface CrossFamilyDriftViolation {
  clusterId: string;
  lockedFamily: MailFamily;
  violatingArtifact: string;
  violationType: "wrong-family-activity-tag" | "wrong-family-package" | "wrong-family-fallback";
  detail: string;
  packageFatal: boolean;
}

export function checkCrossFamilyDriftInXaml(
  xamlContent: string,
  lockResults: MailFamilyLockResult[],
  fileName: string,
): CrossFamilyDriftViolation[] {
  const violations: CrossFamilyDriftViolation[] = [];

  const lockedConcreteTags = new Set<string>();
  for (const lock of lockResults) {
    if (!lock.locked || !lock.selectedFamily) continue;
    if (lock.file !== fileName && !fileName.endsWith(lock.file)) continue;
    const expectedTag = MAIL_FAMILY_ACTIVITY_MAP[lock.selectedFamily as MailFamily];
    if (expectedTag) {
      lockedConcreteTags.add(expectedTag);
      lockedConcreteTags.add(`ui:${expectedTag}`);
    }
  }

  const fileLocks = lockResults.filter(l => l.locked && l.selectedFamily && (l.file === fileName || fileName.endsWith(l.file)));

  for (const lock of fileLocks) {
    if (!lock.selectedFamily) continue;
    const family = lock.selectedFamily as MailFamily;
    const wrongTags = CROSS_FAMILY_ACTIVITY_TAGS[family];
    if (!wrongTags) continue;

    for (const tag of wrongTags) {
      if (lockedConcreteTags.has(tag)) continue;

      const plainTag = tag.replace(/^ui:/, "");
      if (xamlContent.includes(`<${tag}`) || xamlContent.includes(`<ui:${plainTag}`)) {
        violations.push({
          clusterId: lock.clusterId,
          lockedFamily: family,
          violatingArtifact: tag,
          violationType: "wrong-family-activity-tag",
          detail: `Cluster "${lock.clusterId}" locked to ${family} but emitted XAML contains unattributed wrong-family activity tag <${tag}>`,
          packageFatal: true,
        });
      }
    }
  }

  return violations;
}

export function checkCrossFamilyDriftInDependencies(
  resolvedPackages: Record<string, any> | string[],
  lockResults: MailFamilyLockResult[],
): CrossFamilyDriftViolation[] {
  const violations: CrossFamilyDriftViolation[] = [];
  const packageList = Array.isArray(resolvedPackages) ? resolvedPackages : Object.keys(resolvedPackages);

  const allLockedFamilies = new Set<string>();
  const neededPackages = new Set<string>();
  for (const lock of lockResults) {
    if (!lock.locked || !lock.selectedFamily) continue;
    allLockedFamilies.add(lock.selectedFamily);
    if (lock.concretePackage) neededPackages.add(lock.concretePackage);
  }

  for (const lock of lockResults) {
    if (!lock.locked || !lock.selectedFamily) continue;

    const family = lock.selectedFamily as MailFamily;
    const wrongPackages = CROSS_FAMILY_PACKAGE_MAP[family];
    if (!wrongPackages) continue;

    for (const pkg of wrongPackages) {
      if (!packageList.includes(pkg)) continue;
      if (neededPackages.has(pkg)) continue;

      violations.push({
        clusterId: lock.clusterId,
        lockedFamily: family,
        violatingArtifact: pkg,
        violationType: "wrong-family-package",
        detail: `Cluster "${lock.clusterId}" locked to ${family} but dependency analysis includes wrong-family package ${pkg} not attributable to any locked cluster`,
        packageFatal: true,
      });
    }
  }

  return violations;
}

export function mailFamilyLockToPackageViolations(
  diagnostics: MailFamilyLockDiagnostics,
): Array<{
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  violationType: "critical_activity_lowering_failure";
  severity: "execution_blocking";
  packageFatal: boolean;
  handoffGuidanceAvailable: boolean;
  remediationHint: string;
}> {
  const violations: Array<{
    file: string;
    workflow: string;
    activityType: string;
    propertyName: string;
    violationType: "critical_activity_lowering_failure";
    severity: "execution_blocking";
    packageFatal: boolean;
    handoffGuidanceAvailable: boolean;
    remediationHint: string;
  }> = [];

  for (const result of diagnostics.perClusterResults) {
    if (result.packageFatal) {
      violations.push({
        file: result.file,
        workflow: result.workflow,
        activityType: result.concreteActivityType || "MailSendCluster",
        propertyName: result.missingRequiredProperties.join(", ") || "FamilyLock",
        violationType: "critical_activity_lowering_failure",
        severity: "execution_blocking",
        packageFatal: true,
        handoffGuidanceAvailable: true,
        remediationHint: result.lockRejectionReason || `Mail family lock failed for cluster ${result.clusterId}`,
      });
    }
  }

  return violations;
}

export function crossFamilyDriftToPackageViolations(
  violations: CrossFamilyDriftViolation[],
): Array<{
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  violationType: "critical_activity_lowering_failure";
  severity: "execution_blocking";
  packageFatal: boolean;
  handoffGuidanceAvailable: boolean;
  remediationHint: string;
}> {
  return violations.map(v => ({
    file: v.clusterId.split(":")[0] || "unknown",
    workflow: v.clusterId.split(":")[1] || "unknown",
    activityType: v.violatingArtifact,
    propertyName: "CrossFamilyDrift",
    violationType: "critical_activity_lowering_failure" as const,
    severity: "execution_blocking" as const,
    packageFatal: true,
    handoffGuidanceAvailable: true,
    remediationHint: v.detail,
  }));
}

export function runMailFamilyLockAnalysis(
  specs: Array<{ file: string; workflow: string; rootSequence: { kind: "sequence"; displayName: string; children: WorkflowNode[] } }>,
  profile: StudioProfile | null,
  verifiedPackages: Set<string>,
): MailFamilyLockDiagnostics {
  const lockResults: MailFamilyLockResult[] = [];

  for (const spec of specs) {
    const clusters = detectMailSendClusters(spec.rootSequence.children, spec.file, spec.workflow);
    for (const cluster of clusters) {
      const result = lockClusterToFamily(cluster, profile, verifiedPackages);
      lockResults.push(result);
    }
  }

  return buildMailFamilyLockDiagnostics(lockResults);
}

export function runXamlLevelMailFamilyLockAnalysis(
  xamlEntries: { name: string; content: string }[],
  profile: StudioProfile | null,
  verifiedPackages: Set<string>,
): { diagnostics: MailFamilyLockDiagnostics; crossFamilyViolations: CrossFamilyDriftViolation[] } {
  const lockResults: MailFamilyLockResult[] = [];
  const allCrossViolations: CrossFamilyDriftViolation[] = [];

  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const workflow = shortName.replace(/\.xaml$/i, "");
    const content = entry.content;

    const mailNodes: Array<{ displayName: string; template: string; family: string | null; properties: Record<string, string> }> = [];
    const activityPattern = /<(ui:)?(\w+)\s+([^>]*?)(?:\/>|>)/g;
    let match;
    while ((match = activityPattern.exec(content)) !== null) {
      const prefix = match[1] || "";
      const activityName = match[2];
      const attrs = match[3] || "";
      const templateLower = activityName.toLowerCase();
      if (!MAIL_SEND_TEMPLATES.has(templateLower)) continue;

      const displayNameMatch = attrs.match(/DisplayName="([^"]*)"/);
      const displayName = displayNameMatch ? displayNameMatch[1] : activityName;

      const properties: Record<string, string> = {};
      const attrPattern = /(\w+)="([^"]*)"/g;
      let attrMatch;
      while ((attrMatch = attrPattern.exec(attrs)) !== null) {
        if (attrMatch[1] !== "DisplayName" && !attrMatch[1].startsWith("xmlns") && !attrMatch[1].startsWith("sap2010")) {
          properties[attrMatch[1]] = attrMatch[2];
        }
      }

      const family = detectMailFamily(activityName, displayName, properties);
      mailNodes.push({ displayName, template: activityName, family, properties });
    }

    if (mailNodes.length === 0) continue;

    let clusterIdx = 0;
    for (const mailNode of mailNodes) {
      const clusterId = `${shortName}:${workflow}:mail-cluster-${clusterIdx++}`;
      const narrativeReps = detectNarrativeContainerRepresentations(mailNode.properties);
      const pseudoReps = detectPseudoRepresentationsFromStrings(mailNode.properties);
      const allNarr = [
        ...narrativeReps,
        ...pseudoReps.filter(p => p === "TryCatch-as-text-property" || p === "narrative-send-description"),
      ];

      const detectedFamilies = new Set<string>();
      if (mailNode.family) detectedFamilies.add(mailNode.family);

      const cluster: MailSendCluster = {
        clusterId,
        file: shortName,
        workflow,
        nodes: [{
          nodeIndex: 0,
          displayName: mailNode.displayName,
          template: mailNode.template,
          detectedFamily: mailNode.family,
          role: "concrete-send",
          properties: mailNode.properties,
        }],
        concreteSendNode: {
          nodeIndex: 0,
          displayName: mailNode.displayName,
          template: mailNode.template,
          detectedFamily: mailNode.family,
          role: "concrete-send",
          properties: mailNode.properties,
        },
        detectedFamilies,
        hasNarrativeContainer: allNarr.length > 0,
        narrativeRepresentationsFound: allNarr,
      };

      const result = lockClusterToFamily(cluster, profile, verifiedPackages);
      lockResults.push(result);
    }

    const crossViolations = checkCrossFamilyDriftInXaml(content, lockResults.filter(r => r.file === shortName), shortName);
    allCrossViolations.push(...crossViolations);
  }

  return {
    diagnostics: buildMailFamilyLockDiagnostics(lockResults),
    crossFamilyViolations: allCrossViolations,
  };
}

export function mergeLoweringDiagnostics(
  ...sources: (CriticalActivityLoweringDiagnostics | undefined)[]
): CriticalActivityLoweringDiagnostics {
  const allResults: CriticalStepLoweringResult[] = [];
  for (const src of sources) {
    if (src) {
      allResults.push(...src.perStepResults);
    }
  }

  const seen = new Set<string>();
  const deduped: CriticalStepLoweringResult[] = [];
  for (const r of allResults) {
    const key = `${r.file}:${r.workflow}:${r.sourceStep}:${r.loweringOutcome}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  return {
    perStepResults: deduped,
    summary: {
      totalCriticalSteps: deduped.length,
      totalLoweredSuccessfully: deduped.filter(r => r.loweringOutcome === "lowered").length,
      totalRejectedForIncompleteContract: deduped.filter(r => r.loweringOutcome === "rejected_incomplete_contract").length,
      totalRejectedForNoConcreteMapping: deduped.filter(r => r.loweringOutcome === "rejected_no_concrete_mapping").length,
      totalMixedFamilyConflicts: deduped.filter(r => r.loweringOutcome === "rejected_mixed_family").length,
      totalPseudoRepresentationRejections: deduped.filter(r => r.loweringOutcome === "rejected_pseudo_representation").length,
      totalFrameworkIncompatible: deduped.filter(r => r.loweringOutcome === "rejected_framework_incompatible").length,
      totalPackageUnavailable: deduped.filter(r => r.loweringOutcome === "rejected_package_unavailable").length,
    },
  };
}
