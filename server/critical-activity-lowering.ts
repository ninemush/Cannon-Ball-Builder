import { ACTIVITY_DEFINITIONS_REGISTRY, type ActivityPropertyDef, type PackageActivityDefs, type ActivityDef } from "./catalog/activity-definitions";
import { catalogService } from "./catalog/catalog-service";
import type { StudioProfile } from "./catalog/metadata-service";
import type { WorkflowNode, ActivityNode } from "./workflow-spec-types";
import { checkLoweringReceivedNormalizedOnly, markLoweringAdoptionResult, type ActivePathAdoptionTraceEntry } from "./pre-lowering-spec-normalization";

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
  if (catalogService.isLoaded()) {
    const schema = catalogService.getActivitySchema(className) || catalogService.getActivitySchema(`${packageId}:${className}`);
    if (schema) {
      return schema.activity.properties.filter(p => p.required).map(p => p.name);
    }
  }
  const pkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === packageId);
  if (!pkg) return [];
  const actDef = pkg.activities.find(a => a.className === className);
  if (!actDef) return [];
  return actDef.properties.filter(p => p.required).map(p => p.name);
}

function resolveRegistryChildElements(className: string, packageId: string): string[] {
  if (catalogService.isLoaded()) {
    const schema = catalogService.getActivitySchema(className) || catalogService.getActivitySchema(`${packageId}:${className}`);
    if (schema) {
      return schema.activity.properties.filter(p => p.xamlSyntax === "child-element").map(p => p.name);
    }
  }
  const pkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === packageId);
  if (!pkg) return [];
  const actDef = pkg.activities.find(a => a.className === className);
  if (!actDef) return [];
  return actDef.properties.filter(p => p.xamlSyntax === "child-element").map(p => p.name);
}

function resolveConcreteType(className: string, packageId: string): string {
  if (catalogService.isLoaded()) {
    const schema = catalogService.getActivitySchema(className) || catalogService.getActivitySchema(`${packageId}:${className}`);
    if (schema && schema.activity.namespace) {
      return `${schema.activity.namespace}.${className}`;
    }
  }
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
  let displayLabel = mapping.className;
  if (catalogService.isLoaded()) {
    const schema = catalogService.getActivitySchema(mapping.className);
    if (schema) {
      displayLabel = schema.activity.displayName || mapping.className;
    }
  }
  if (displayLabel === mapping.className) {
    const pkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === mapping.packageId);
    const actDef = pkg?.activities.find(a => a.className === mapping.className);
    if (actDef?.displayName) displayLabel = actDef.displayName;
  }
  return {
    familyId: mapping.familyId,
    displayLabel,
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
let _contractsCatalogGeneration = -1;

function getCriticalContracts(): CriticalActivityFamilyContract[] {
  const currentGen = catalogService.isLoaded() ? catalogService.getLoadGeneration() : -1;
  if (!_cachedContracts || _contractsCatalogGeneration !== currentGen) {
    _cachedContracts = CRITICAL_FAMILY_MAPPINGS.map(buildContract);
    _contractsCatalogGeneration = currentGen;
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
  degradedToHandoff?: boolean;
  activityReplacement?: "handoff_block";
  degradationClass?: "A" | "B";
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
  if (catalogService.isLoaded()) {
    const schema = catalogService.getActivitySchema(className) || catalogService.getActivitySchema(`${packageId}:${className}`);
    if (schema) {
      const catalogProp = schema.activity.properties.find(p => p.name === propName);
      if (catalogProp) {
        return {
          name: catalogProp.name,
          direction: catalogProp.direction,
          clrType: catalogProp.clrType,
          xamlSyntax: catalogProp.xamlSyntax,
          argumentWrapper: catalogProp.argumentWrapper,
          typeArguments: catalogProp.typeArguments,
          required: catalogProp.required,
          ...(catalogProp.validValues ? { validValues: catalogProp.validValues } : {}),
          ...(catalogProp.default !== undefined ? { default: catalogProp.default } : {}),
        };
      }
    }
  }
  const pkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === packageId);
  if (!pkg) return null;
  const actDef = pkg.activities.find(a => a.className === className);
  if (!actDef) return null;
  return actDef.properties.find(p => p.name === propName) || null;
}

const CLASS_B_UNSAFE_NAMES = new Set([
  "Selector", "Target", "FormSchemaPath", "WorkflowFileName",
  "DataTable", "EntityType", "EntityObject", "TaskObject", "TaskDataJson",
]);

export function classifyPropertyDegradation(
  propName: string,
  catalogEntry: ActivityPropertyDef | null,
): "placeholder" | "replace" {
  if (catalogEntry) {
    if (catalogEntry.xamlSyntax === "child-element") return "replace";
    if (catalogEntry.clrType !== "System.String") return "replace";
    if (
      catalogEntry.argumentWrapper &&
      (catalogEntry.argumentWrapper === "InArgument" || catalogEntry.argumentWrapper === "OutArgument") &&
      catalogEntry.clrType !== "System.String"
    ) {
      return "replace";
    }
  }
  if (CLASS_B_UNSAFE_NAMES.has(propName)) return "replace";
  return "placeholder";
}

export function classifyMissingPropertiesDegradation(
  missingProps: string[],
  className: string,
  packageId: string,
): { degradationClass: "A" | "B"; activityReplacement?: "handoff_block" } {
  let hasClassB = false;
  for (const propName of missingProps) {
    const propDef = getRegistryPropertyDef(className, packageId, propName);
    const classification = classifyPropertyDegradation(propName, propDef);
    if (classification === "replace") {
      hasClassB = true;
      break;
    }
  }
  if (hasClassB) {
    return { degradationClass: "B", activityReplacement: "handoff_block" };
  }
  return { degradationClass: "A" };
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
    const degradation = classifyMissingPropertiesDegradation(missingProps, contract.className, contract.packageId);
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
      packageFatal: false,
      remediationHint: `Activity ${contract.concreteType} is missing required properties: ${missingProps.join(", ")}`,
      degradedToHandoff: true,
      degradationClass: degradation.degradationClass,
      ...(degradation.activityReplacement ? { activityReplacement: degradation.activityReplacement } : {}),
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
  adoptionTrace?: ActivePathAdoptionTraceEntry[],
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

  if (adoptionTrace) {
    const sawNormalized = checkLoweringReceivedNormalizedOnly(
      adoptionTrace,
      workflow,
      spec.rootSequence.children,
    );
    markLoweringAdoptionResult(adoptionTrace, workflow, sawNormalized);
  }

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
  severity: "execution_blocking" | "handoff_required";
  packageFatal: boolean;
  handoffGuidanceAvailable: boolean;
  remediationHint: string;
  degradationClass?: "A" | "B";
}> {
  const violations: Array<{
    file: string;
    workflow: string;
    activityType: string;
    propertyName: string;
    violationType: "critical_activity_lowering_failure";
    severity: "execution_blocking" | "handoff_required";
    packageFatal: boolean;
    handoffGuidanceAvailable: boolean;
    remediationHint: string;
    degradationClass?: "A" | "B";
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
    } else if (result.degradedToHandoff) {
      violations.push({
        file: result.file,
        workflow: result.workflow,
        activityType: result.resolvedConcreteType || result.detectedIntent,
        propertyName: result.missingRequiredProperties.join(", ") || "FamilyContract",
        violationType: "critical_activity_lowering_failure",
        severity: "handoff_required",
        packageFatal: false,
        handoffGuidanceAvailable: true,
        remediationHint: result.remediationHint,
        degradationClass: result.degradationClass,
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
        const degradation = classifyMissingPropertiesDegradation(missingProps, contract.className, contract.packageId);
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
          packageFatal: false,
          remediationHint: `Activity ${contract.concreteType} is missing required properties: ${missingProps.join(", ")}`,
          degradedToHandoff: true,
          degradationClass: degradation.degradationClass,
          ...(degradation.activityReplacement ? { activityReplacement: degradation.activityReplacement } : {}),
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

export type RepresentationType = "concrete-send" | "narrative-container" | "ambiguous-template" | "connector-intent";

export interface ConnectorIntent {
  connectorName: string;
  connectionName: string | null;
  connectionId: string | null;
  resolvedFamily: MailFamily | null;
}

export interface PropertyProvenance {
  propertyName: string;
  value: any;
  sourceNodeIndex: number;
  sourceTemplate: string;
  sourceRepresentationType: RepresentationType;
}

export interface CollapseResult {
  collapsed: boolean;
  canonicalProperties: Record<string, any>;
  provenance: PropertyProvenance[];
  rejectionReason: string | null;
  bodyPreserved: boolean;
}

export interface MailSendClusterNode {
  nodeIndex: number;
  displayName: string;
  template: string;
  detectedFamily: string | null;
  role: "concrete-send" | "trycatch-wrapper" | "retryscope-wrapper" | "catch-step" | "logging-step";
  properties: Record<string, any>;
  representationType?: RepresentationType;
  localMailSendOrdinal?: number;
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
  connectorIntent?: ConnectorIntent | null;
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
  detectedRepresentations?: RepresentationType[];
  selectedCanonicalSource?: string | null;
  rejectedCompetingRepresentations?: string[];
  propertyProvenance?: PropertyProvenance[];
  connectorIntentDetected?: ConnectorIntent | null;
  collapseApplied?: boolean;
  rewriteDirective?: RewriteDirective | null;
  degradedToHandoff?: boolean;
  activityReplacement?: "handoff_block";
  degradationClass?: "A" | "B";
}

export interface RewriteDirective {
  canonicalTopLevelIndex: number;
  competingTopLevelIndices: number[];
  canonicalTemplate: string;
  canonicalProperties: Record<string, any>;
  nestedInWrapper: boolean;
  localMailSendOrdinal?: number;
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
    totalConnectorIntentResolved: number;
    totalCollapseApplied: number;
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
  topLevelAncestorIndex?: number,
  mailSendOrdinalCounter?: { value: number },
): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const effectiveTopLevelIndex = topLevelAncestorIndex ?? i;
    const ordinalCounter = topLevelAncestorIndex !== undefined ? mailSendOrdinalCounter : undefined;

    if (node.kind === "activity" && isMailSendTemplate(node.template)) {
      const clusterId = `${file}:${workflow}:mail-cluster-${clusterCounter.value++}`;
      const family = detectMailFamily(node.template, node.displayName, node.properties || {});
      const narrativeReps = detectNarrativeContainerRepresentations(node.properties || {});
      const pseudoReps = detectPseudoRepresentations(node.properties || {});

      const clusterNodes: MailSendClusterNode[] = [];

      if (parentWrapper) {
        clusterNodes.push({
          nodeIndex: effectiveTopLevelIndex,
          displayName: parentWrapper.displayName,
          template: parentWrapper.kind === "tryCatch" ? "TryCatch" : parentWrapper.kind === "retryScope" ? "RetryScope" : parentWrapper.kind,
          detectedFamily: null,
          role: parentWrapper.kind === "tryCatch" ? "trycatch-wrapper" : parentWrapper.kind === "retryScope" ? "retryscope-wrapper" : "logging-step",
          properties: {},
        });
      }

      const currentOrdinal = ordinalCounter ? ordinalCounter.value++ : undefined;
      clusterNodes.push({
        nodeIndex: effectiveTopLevelIndex,
        displayName: node.displayName,
        template: node.template,
        detectedFamily: family,
        role: "concrete-send",
        properties: node.properties || {},
        localMailSendOrdinal: currentOrdinal,
      });

      if (i > 0) {
        const prev = nodes[i - 1];
        if (prev.kind === "activity" && isLoggingOrCatchStep(prev)) {
          clusterNodes.unshift({
            nodeIndex: topLevelAncestorIndex ?? (i - 1),
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
            nodeIndex: topLevelAncestorIndex ?? (i + 1),
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
          nodeIndex: effectiveTopLevelIndex,
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

          const sendOrdinal = ordinalCounter ? ordinalCounter.value++ : undefined;
          const sendNode: MailSendClusterNode = {
            nodeIndex: effectiveTopLevelIndex,
            displayName: mailAct.displayName,
            template: mailAct.template,
            detectedFamily: actFamily,
            role: "concrete-send",
            properties: mailAct.properties || {},
            localMailSendOrdinal: sendOrdinal,
          };
          clusterNodes.push(sendNode);
          if (!concreteSendClusterNode) concreteSendClusterNode = sendNode;
        }

        const nonMailActivities = innerActivities.filter(a => !isMailSendTemplate(a.template));
        for (const nonMail of nonMailActivities) {
          if (isLoggingOrCatchStep(nonMail)) {
            clusterNodes.push({
              nodeIndex: effectiveTopLevelIndex,
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
        const nestedOrdinal = ordinalCounter || { value: 0 };
        collectMailSendClustersRecursive(node.tryChildren, file, workflow, clusters, clusterCounter, { kind: "tryCatch", displayName: node.displayName }, effectiveTopLevelIndex, nestedOrdinal);
        collectMailSendClustersRecursive(node.catchChildren, file, workflow, clusters, clusterCounter, null, effectiveTopLevelIndex, nestedOrdinal);
        collectMailSendClustersRecursive(node.finallyChildren, file, workflow, clusters, clusterCounter, null, effectiveTopLevelIndex, nestedOrdinal);
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
          nodeIndex: effectiveTopLevelIndex,
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

          const retrySendOrdinal = ordinalCounter ? ordinalCounter.value++ : undefined;
          const sendNode: MailSendClusterNode = {
            nodeIndex: effectiveTopLevelIndex,
            displayName: mailAct.displayName,
            template: mailAct.template,
            detectedFamily: actFamily,
            role: "concrete-send",
            properties: mailAct.properties || {},
            localMailSendOrdinal: retrySendOrdinal,
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
        const nestedRetryOrdinal = ordinalCounter || { value: 0 };
        collectMailSendClustersRecursive(node.bodyChildren, file, workflow, clusters, clusterCounter, { kind: "retryScope", displayName: node.displayName }, effectiveTopLevelIndex, nestedRetryOrdinal);
      }
      continue;
    }

    if (node.kind === "sequence" || node.kind === "if" || node.kind === "while" || node.kind === "forEach") {
      const nestedOrdinal = ordinalCounter || { value: 0 };
      if (node.kind === "sequence") {
        collectMailSendClustersRecursive(node.children, file, workflow, clusters, clusterCounter, parentWrapper, effectiveTopLevelIndex, nestedOrdinal);
      } else if (node.kind === "if") {
        collectMailSendClustersRecursive(node.thenChildren, file, workflow, clusters, clusterCounter, parentWrapper, effectiveTopLevelIndex, nestedOrdinal);
        collectMailSendClustersRecursive(node.elseChildren, file, workflow, clusters, clusterCounter, parentWrapper, effectiveTopLevelIndex, nestedOrdinal);
      } else if (node.kind === "while") {
        collectMailSendClustersRecursive(node.bodyChildren, file, workflow, clusters, clusterCounter, parentWrapper, effectiveTopLevelIndex, nestedOrdinal);
      } else if (node.kind === "forEach") {
        collectMailSendClustersRecursive(node.bodyChildren, file, workflow, clusters, clusterCounter, parentWrapper, effectiveTopLevelIndex, nestedOrdinal);
      }
    }
  }
}

export function detectMailSendClusters(
  nodes: WorkflowNode[],
  file: string,
  workflow: string,
  integrationServiceConnectors?: Array<{ connectorName: string; connectionName?: string; connectionId?: string }>,
): MailSendCluster[] {
  const clusters: MailSendCluster[] = [];
  const clusterCounter = { value: 0 };
  collectMailSendClustersRecursive(nodes, file, workflow, clusters, clusterCounter, null);
  if (integrationServiceConnectors && integrationServiceConnectors.length > 0) {
    for (const cluster of clusters) {
      if (!cluster.connectorIntent && cluster.concreteSendNode) {
        cluster.connectorIntent = detectConnectorIntent(
          cluster.concreteSendNode.properties,
          cluster.concreteSendNode.displayName,
          integrationServiceConnectors,
        );
      }
    }
  }
  return clusters;
}

const CONNECTOR_INTENT_PATTERNS: Array<{ pattern: RegExp; connectorName: string; family: MailFamily }> = [
  { pattern: /\bgmail\s*connector\b/i, connectorName: "Gmail", family: "gmail-send" },
  { pattern: /\bGoogle\s*Mail\s*connector\b/i, connectorName: "Gmail", family: "gmail-send" },
  { pattern: /\bGSuite\s*connector\b/i, connectorName: "Gmail", family: "gmail-send" },
  { pattern: /\boutlook\s*connector\b/i, connectorName: "Outlook365", family: "outlook-send" },
  { pattern: /\bOffice\s*365\s*connector\b/i, connectorName: "Outlook365", family: "outlook-send" },
  { pattern: /\bSMTP\s*connector\b/i, connectorName: "SMTP", family: "smtp-send" },
];

const CONNECTOR_FAMILY_MAP: Record<string, MailFamily> = {
  "gmail": "gmail-send",
  "google mail": "gmail-send",
  "gsuite": "gmail-send",
  "outlook": "outlook-send",
  "outlook365": "outlook-send",
  "office 365": "outlook-send",
  "office365": "outlook-send",
  "smtp": "smtp-send",
};

function resolveConnectorFamily(connectorName: string): MailFamily | null {
  return CONNECTOR_FAMILY_MAP[connectorName.toLowerCase()] || null;
}

export function detectConnectorIntent(
  properties: Record<string, any>,
  displayName: string,
  integrationServiceConnectors?: Array<{ connectorName: string; connectionName?: string; connectionId?: string }>,
): ConnectorIntent | null {
  if (integrationServiceConnectors && integrationServiceConnectors.length > 0) {
    const combined = `${displayName} ${JSON.stringify(properties)}`.toLowerCase();

    for (const conn of integrationServiceConnectors) {
      const family = resolveConnectorFamily(conn.connectorName);
      if (!family) continue;

      const connNameLower = conn.connectorName.toLowerCase();
      const connectionNameLower = conn.connectionName?.toLowerCase() || "";
      const connectionIdLower = conn.connectionId?.toLowerCase() || "";

      if (combined.includes(connNameLower) ||
          (connectionNameLower && combined.includes(connectionNameLower)) ||
          (connectionIdLower && combined.includes(connectionIdLower))) {
        return { connectorName: conn.connectorName, connectionName: conn.connectionName || null, connectionId: conn.connectionId || null, resolvedFamily: family };
      }
    }

    const mailConnectors = integrationServiceConnectors.filter(c => resolveConnectorFamily(c.connectorName) !== null);
    if (mailConnectors.length === 1) {
      const conn = mailConnectors[0];
      const family = resolveConnectorFamily(conn.connectorName)!;
      return { connectorName: conn.connectorName, connectionName: conn.connectionName || null, connectionId: conn.connectionId || null, resolvedFamily: family };
    }
  }

  const combined = `${displayName} ${JSON.stringify(properties)}`;
  for (const { pattern, connectorName, family } of CONNECTOR_INTENT_PATTERNS) {
    if (pattern.test(combined)) {
      return { connectorName, connectionName: null, connectionId: null, resolvedFamily: family };
    }
  }

  return null;
}

function getRepresentationType(node: MailSendClusterNode): RepresentationType {
  if (node.representationType) return node.representationType;
  if (node.role !== "concrete-send") return "narrative-container";
  const tLower = node.template.toLowerCase().replace(/^ui:/, "");
  if (tLower === "sendmail" || tLower === "sendmail365") return "ambiguous-template";
  if (tLower === "gmailsendmessage" || tLower === "sendsmtpmailmessage" || tLower === "sendoutlookmailmessage") return "concrete-send";
  return "ambiguous-template";
}

const REPRESENTATION_PRECEDENCE: Record<RepresentationType, number> = {
  "concrete-send": 3,
  "connector-intent": 2,
  "ambiguous-template": 1,
  "narrative-container": 0,
};

function getPropertyValue(props: Record<string, any>, key: string): string | null {
  const val = props[key];
  if (val === undefined || val === null) return null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "" || /^(PLACEHOLDER|STUB|TODO|TBD)/i.test(trimmed)) return null;
    return trimmed;
  }
  if (typeof val === "object" && "value" in val) {
    const inner = String(val.value).trim();
    if (inner === "" || /^(PLACEHOLDER|STUB|TODO|TBD)/i.test(inner)) return null;
    return inner;
  }
  return null;
}

export function collapseCompetingRepresentations(
  nodes: MailSendClusterNode[],
  requiredProperties: string[],
): CollapseResult {
  const sendNodes = nodes.filter(n => n.role === "concrete-send");
  const narrativeNodes = nodes.filter(n => n.role !== "concrete-send" && Object.keys(n.properties).length > 0);

  if (sendNodes.length <= 1 && narrativeNodes.length === 0) {
    const singleNode = sendNodes[0];
    if (!singleNode) return { collapsed: true, canonicalProperties: {}, provenance: [], rejectionReason: null, bodyPreserved: true };
    const provenance: PropertyProvenance[] = [];
    for (const prop of requiredProperties) {
      const val = getPropertyValue(singleNode.properties, prop);
      if (val !== null) {
        provenance.push({ propertyName: prop, value: val, sourceNodeIndex: singleNode.nodeIndex, sourceTemplate: singleNode.template, sourceRepresentationType: getRepresentationType(singleNode) });
      }
    }
    return { collapsed: true, canonicalProperties: { ...singleNode.properties }, provenance, rejectionReason: null, bodyPreserved: getPropertyValue(singleNode.properties, "Body") !== null || !requiredProperties.includes("Body") };
  }

  const allPropertySources: MailSendClusterNode[] = [...sendNodes, ...narrativeNodes];
  const sorted = [...allPropertySources].sort((a, b) => {
    const aPrec = REPRESENTATION_PRECEDENCE[getRepresentationType(a)];
    const bPrec = REPRESENTATION_PRECEDENCE[getRepresentationType(b)];
    return bPrec - aPrec;
  });

  const canonicalProperties: Record<string, any> = {};
  const provenance: PropertyProvenance[] = [];
  const propertySourceMap = new Map<string, { value: string; nodeIndex: number; template: string; repType: RepresentationType; precedence: number }>();

  for (const node of sorted) {
    const repType = getRepresentationType(node);
    const precedence = REPRESENTATION_PRECEDENCE[repType];
    for (const prop of requiredProperties) {
      const val = getPropertyValue(node.properties, prop);
      if (val === null) continue;

      const existing = propertySourceMap.get(prop);
      if (!existing) {
        propertySourceMap.set(prop, { value: val, nodeIndex: node.nodeIndex, template: node.template, repType, precedence });
      } else if (existing.value !== val) {
        if (precedence > existing.precedence) {
          propertySourceMap.set(prop, { value: val, nodeIndex: node.nodeIndex, template: node.template, repType, precedence });
        } else if (precedence === existing.precedence) {
          return {
            collapsed: false,
            canonicalProperties: {},
            provenance: [],
            rejectionReason: `Conflicting values for property "${prop}" from representations at same precedence level: "${existing.template}" vs "${node.template}" — cannot deterministically resolve`,
            bodyPreserved: false,
          };
        }
      }
    }
  }

  let anyBodyUpstream = false;
  for (const node of allPropertySources) {
    if (getPropertyValue(node.properties, "Body") !== null) { anyBodyUpstream = true; break; }
  }

  for (const [prop, source] of propertySourceMap) {
    canonicalProperties[prop] = source.value;
    provenance.push({ propertyName: prop, value: source.value, sourceNodeIndex: source.nodeIndex, sourceTemplate: source.template, sourceRepresentationType: source.repType });
  }

  const bodyPreserved = !requiredProperties.includes("Body") || getPropertyValue(canonicalProperties, "Body") !== null;
  if (anyBodyUpstream && !bodyPreserved) {
    return {
      collapsed: false,
      canonicalProperties,
      provenance,
      rejectionReason: "Body property existed upstream but was lost during representation collapse — refusing to emit without Body",
      bodyPreserved: false,
    };
  }

  return { collapsed: true, canonicalProperties, provenance, rejectionReason: null, bodyPreserved };
}

export function lockClusterToFamily(
  cluster: MailSendCluster,
  profile: StudioProfile | null,
  verifiedPackages: Set<string>,
  integrationServiceConnectors?: Array<{ connectorName: string; connectionName?: string; connectionId?: string }>,
): MailFamilyLockResult {
  const { clusterId, file, workflow } = cluster;

  const sendNodes = cluster.nodes.filter(n => n.role === "concrete-send");
  const detectedRepresentations: RepresentationType[] = sendNodes.map(n => getRepresentationType(n));

  const connectorIntent: ConnectorIntent | null = cluster.connectorIntent ||
    (integrationServiceConnectors ? detectConnectorIntent(
      cluster.concreteSendNode?.properties || {},
      cluster.concreteSendNode?.displayName || "",
      integrationServiceConnectors,
    ) : null);

  if (connectorIntent && !detectedRepresentations.includes("connector-intent")) {
    detectedRepresentations.push("connector-intent");
  }

  if (cluster.hasNarrativeContainer && cluster.narrativeRepresentationsFound.length > 0) {
    const hasConcreteAlongside = sendNodes.some(n => getRepresentationType(n) === "concrete-send");

    if (hasConcreteAlongside && sendNodes.length > 1) {
      const concreteNodes = sendNodes.filter(n => getRepresentationType(n) === "concrete-send");
      const narrativeNodes = sendNodes.filter(n => getRepresentationType(n) !== "concrete-send");
      const rejectedTemplates = narrativeNodes.map(n => n.template);

      if (concreteNodes.length === 1) {
        const canonicalNode = concreteNodes[0];
        const canonicalFamily = canonicalNode.detectedFamily;
        if (canonicalFamily && MAIL_FAMILY_SET.has(canonicalFamily)) {
          const contract = lookupContractByFamilyId(canonicalFamily);
          if (contract) {
            const collapseResult = collapseCompetingRepresentations(cluster.nodes, contract.requiredProperties);
            if (collapseResult.collapsed) {
              const propsToCheck = collapseResult.canonicalProperties;
              const missingProps = checkRequiredPropertyCompleteness(contract, propsToCheck);
              if (missingProps.length === 0) {
                const targetFramework = profile?.targetFramework || "Windows";
                if (isFrameworkCompatible(contract, targetFramework) && isPackageInVerifiedSet(contract.packageId, verifiedPackages)) {
                  return {
                    clusterId, file, workflow,
                    selectedFamily: canonicalFamily as MailFamily,
                    concreteActivityType: contract.concreteType,
                    concretePackage: contract.packageId,
                    locked: true,
                    lockRejectionReason: null,
                    narrativeRepresentationsRejected: cluster.narrativeRepresentationsFound,
                    missingRequiredProperties: [],
                    packageFatal: false,
                    crossFamilyDriftViolation: false,
                    detectedRepresentations,
                    selectedCanonicalSource: canonicalNode.template,
                    rejectedCompetingRepresentations: rejectedTemplates,
                    propertyProvenance: collapseResult.provenance,
                    connectorIntentDetected: connectorIntent,
                    collapseApplied: true,
                  };
                }
              }
            }
          }
        }
      }
    }

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
      detectedRepresentations,
      connectorIntentDetected: connectorIntent,
    };
  }

  const concreteFamilies = Array.from(cluster.detectedFamilies).filter(f => MAIL_FAMILY_SET.has(f));
  const ambiguousFamilies = Array.from(cluster.detectedFamilies).filter(f => f === AMBIGUOUS_MAIL_FAMILY);

  if (concreteFamilies.length === 0 && ambiguousFamilies.length > 0) {
    if (connectorIntent && connectorIntent.resolvedFamily) {
      const resolvedFamily = connectorIntent.resolvedFamily;
      const contract = lookupContractByFamilyId(resolvedFamily);
      if (contract) {
        const targetFramework = profile?.targetFramework || "Windows";
        if (isFrameworkCompatible(contract, targetFramework) && isPackageInVerifiedSet(contract.packageId, verifiedPackages)) {
          const collapseResult = collapseCompetingRepresentations(cluster.nodes, contract.requiredProperties);
          if (collapseResult.collapsed) {
            const propsToCheck = collapseResult.canonicalProperties;
            const missingProps = checkRequiredPropertyCompleteness(contract, propsToCheck);
            if (missingProps.length === 0) {
              return {
                clusterId, file, workflow,
                selectedFamily: resolvedFamily,
                concreteActivityType: contract.concreteType,
                concretePackage: contract.packageId,
                locked: true,
                lockRejectionReason: null,
                narrativeRepresentationsRejected: [],
                missingRequiredProperties: [],
                packageFatal: false,
                crossFamilyDriftViolation: false,
                detectedRepresentations,
                selectedCanonicalSource: `connector-intent:${connectorIntent.connectorName}`,
                rejectedCompetingRepresentations: [],
                propertyProvenance: collapseResult.provenance,
                connectorIntentDetected: connectorIntent,
                collapseApplied: true,
              };
            } else {
              const degradation = classifyMissingPropertiesDegradation(missingProps, contract.className, contract.packageId);
              return {
                clusterId, file, workflow,
                selectedFamily: resolvedFamily,
                concreteActivityType: contract.concreteType,
                concretePackage: contract.packageId,
                locked: false,
                lockRejectionReason: `Connector intent resolved family "${resolvedFamily}" but missing required properties: ${missingProps.join(", ")}`,
                narrativeRepresentationsRejected: [],
                missingRequiredProperties: missingProps,
                packageFatal: false,
                crossFamilyDriftViolation: false,
                detectedRepresentations,
                connectorIntentDetected: connectorIntent,
                collapseApplied: false,
                degradedToHandoff: true,
                degradationClass: degradation.degradationClass,
                ...(degradation.activityReplacement ? { activityReplacement: degradation.activityReplacement } : {}),
              };
            }
          }
        }
      }
    }

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
      detectedRepresentations,
      connectorIntentDetected: connectorIntent,
    };
  }

  if (concreteFamilies.length > 1) {
    if (connectorIntent && connectorIntent.resolvedFamily && concreteFamilies.includes(connectorIntent.resolvedFamily)) {
      const resolvedFamily = connectorIntent.resolvedFamily;
      const contract = lookupContractByFamilyId(resolvedFamily);
      if (contract) {
        const collapseResult = collapseCompetingRepresentations(cluster.nodes, contract.requiredProperties);
        if (collapseResult.collapsed) {
          const targetFramework = profile?.targetFramework || "Windows";
          if (isFrameworkCompatible(contract, targetFramework) && isPackageInVerifiedSet(contract.packageId, verifiedPackages)) {
            const missingProps = checkRequiredPropertyCompleteness(contract, collapseResult.canonicalProperties);
            if (missingProps.length === 0) {
              const rejectedFamilies = concreteFamilies.filter(f => f !== resolvedFamily);
              return {
                clusterId, file, workflow,
                selectedFamily: resolvedFamily,
                concreteActivityType: contract.concreteType,
                concretePackage: contract.packageId,
                locked: true,
                lockRejectionReason: null,
                narrativeRepresentationsRejected: [],
                missingRequiredProperties: [],
                packageFatal: false,
                crossFamilyDriftViolation: false,
                detectedRepresentations,
                selectedCanonicalSource: `connector-intent:${connectorIntent.connectorName}`,
                rejectedCompetingRepresentations: rejectedFamilies,
                propertyProvenance: collapseResult.provenance,
                connectorIntentDetected: connectorIntent,
                collapseApplied: true,
              };
            }
          }
        } else if (collapseResult.rejectionReason) {
          return {
            clusterId, file, workflow,
            selectedFamily: null,
            concreteActivityType: null,
            concretePackage: null,
            locked: false,
            lockRejectionReason: collapseResult.rejectionReason,
            narrativeRepresentationsRejected: [],
            missingRequiredProperties: [],
            packageFatal: true,
            crossFamilyDriftViolation: true,
            detectedRepresentations,
            connectorIntentDetected: connectorIntent,
            collapseApplied: false,
          };
        }
      }
    }

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
      detectedRepresentations,
      connectorIntentDetected: connectorIntent,
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
      detectedRepresentations,
      connectorIntentDetected: connectorIntent,
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
      detectedRepresentations,
      connectorIntentDetected: connectorIntent,
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
      detectedRepresentations,
      connectorIntentDetected: connectorIntent,
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
      detectedRepresentations,
      connectorIntentDetected: connectorIntent,
    };
  }

  const multipleRepresentations = sendNodes.length > 1;
  let collapseResult: CollapseResult | null = null;
  let propsToCheck = cluster.concreteSendNode?.properties || {};

  if (multipleRepresentations) {
    collapseResult = collapseCompetingRepresentations(cluster.nodes, contract.requiredProperties);
    if (!collapseResult.collapsed) {
      return {
        clusterId, file, workflow,
        selectedFamily,
        concreteActivityType: contract.concreteType,
        concretePackage: contract.packageId,
        locked: false,
        lockRejectionReason: collapseResult.rejectionReason || "Failed to collapse competing representations",
        narrativeRepresentationsRejected: [],
        missingRequiredProperties: [],
        packageFatal: true,
        crossFamilyDriftViolation: false,
        detectedRepresentations,
        connectorIntentDetected: connectorIntent,
        collapseApplied: false,
      };
    }
    propsToCheck = collapseResult.canonicalProperties;
  }

  const missingProps = checkRequiredPropertyCompleteness(contract, propsToCheck);
  if (missingProps.length > 0) {
    const degradation = classifyMissingPropertiesDegradation(missingProps, contract.className, contract.packageId);
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
      packageFatal: false,
      crossFamilyDriftViolation: false,
      detectedRepresentations,
      connectorIntentDetected: connectorIntent,
      collapseApplied: multipleRepresentations,
      propertyProvenance: collapseResult?.provenance,
      degradedToHandoff: true,
      degradationClass: degradation.degradationClass,
      ...(degradation.activityReplacement ? { activityReplacement: degradation.activityReplacement } : {}),
    };
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
    detectedRepresentations,
    selectedCanonicalSource: cluster.concreteSendNode?.template || null,
    rejectedCompetingRepresentations: multipleRepresentations
      ? sendNodes.filter(n => n !== cluster.concreteSendNode).map(n => n.template)
      : [],
    propertyProvenance: collapseResult?.provenance || (cluster.concreteSendNode ? contract.requiredProperties
      .filter(p => getPropertyValue(cluster.concreteSendNode!.properties, p) !== null)
      .map(p => ({
        propertyName: p,
        value: getPropertyValue(cluster.concreteSendNode!.properties, p),
        sourceNodeIndex: cluster.concreteSendNode!.nodeIndex,
        sourceTemplate: cluster.concreteSendNode!.template,
        sourceRepresentationType: getRepresentationType(cluster.concreteSendNode!) as RepresentationType,
      })) : []),
    connectorIntentDetected: connectorIntent,
    collapseApplied: multipleRepresentations && collapseResult !== null,
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
      totalRejectedNarrative: lockResults.filter(r => r.narrativeRepresentationsRejected.length > 0 && !r.locked).length,
      totalRejectedMissingProperties: lockResults.filter(r => r.missingRequiredProperties.length > 0).length,
      totalCrossFamilyDriftViolations: lockResults.filter(r => r.crossFamilyDriftViolation).length,
      totalConnectorIntentResolved: lockResults.filter(r => r.connectorIntentDetected && r.locked).length,
      totalCollapseApplied: lockResults.filter(r => r.collapseApplied).length,
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

function canonicalizeMailSendsInSubtreeArray(
  nodes: WorkflowNode[],
  canonicalTemplate: string,
  canonicalProps: Record<string, any>,
  state: { canonicalEmitted: boolean },
): { result: WorkflowNode[]; rewroteAny: boolean } {
  const result: WorkflowNode[] = [];
  let rewroteAny = false;

  for (const node of nodes) {
    if (node.kind === "activity" && isMailSendTemplate(node.template)) {
      if (!state.canonicalEmitted) {
        state.canonicalEmitted = true;
        result.push({
          ...node,
          template: canonicalTemplate,
          properties: { ...node.properties, ...canonicalProps },
        } as WorkflowNode);
        rewroteAny = true;
      }
      continue;
    }

    if (node.kind === "tryCatch") {
      const { result: tryR, rewroteAny: r1 } = canonicalizeMailSendsInSubtreeArray(node.tryChildren, canonicalTemplate, canonicalProps, state);
      const { result: catchR, rewroteAny: r2 } = canonicalizeMailSendsInSubtreeArray(node.catchChildren || [], canonicalTemplate, canonicalProps, state);
      const { result: finallyR, rewroteAny: r3 } = canonicalizeMailSendsInSubtreeArray(node.finallyChildren || [], canonicalTemplate, canonicalProps, state);
      if (r1 || r2 || r3) rewroteAny = true;
      result.push({ ...node, tryChildren: tryR, catchChildren: catchR, finallyChildren: finallyR } as WorkflowNode);
      continue;
    }

    if (node.kind === "retryScope") {
      const { result: bodyR, rewroteAny: r } = canonicalizeMailSendsInSubtreeArray(node.bodyChildren, canonicalTemplate, canonicalProps, state);
      if (r) rewroteAny = true;
      result.push({ ...node, bodyChildren: bodyR } as WorkflowNode);
      continue;
    }

    if (node.kind === "sequence") {
      const { result: childR, rewroteAny: r } = canonicalizeMailSendsInSubtreeArray(node.children, canonicalTemplate, canonicalProps, state);
      if (r) rewroteAny = true;
      result.push({ ...node, children: childR } as WorkflowNode);
      continue;
    }

    if (node.kind === "if") {
      const { result: thenR, rewroteAny: r1 } = canonicalizeMailSendsInSubtreeArray(node.thenChildren, canonicalTemplate, canonicalProps, state);
      const { result: elseR, rewroteAny: r2 } = canonicalizeMailSendsInSubtreeArray(node.elseChildren, canonicalTemplate, canonicalProps, state);
      if (r1 || r2) rewroteAny = true;
      result.push({ ...node, thenChildren: thenR, elseChildren: elseR } as WorkflowNode);
      continue;
    }

    if (node.kind === "while" || node.kind === "forEach") {
      const { result: bodyR, rewroteAny: r } = canonicalizeMailSendsInSubtreeArray(node.bodyChildren, canonicalTemplate, canonicalProps, state);
      if (r) rewroteAny = true;
      result.push({ ...node, bodyChildren: bodyR } as WorkflowNode);
      continue;
    }

    result.push(node);
  }

  return { result, rewroteAny };
}

export function buildRewriteDirective(
  cluster: MailSendCluster,
  lockResult: MailFamilyLockResult,
): RewriteDirective | null {
  if (!lockResult.locked || !lockResult.collapseApplied || !lockResult.concreteActivityType || !lockResult.selectedFamily) {
    return null;
  }

  const contract = lookupContractByFamilyId(lockResult.selectedFamily);
  if (!contract) return null;

  const wrapperRoles = new Set(["trycatch-wrapper", "retryscope-wrapper"]);
  const mailSendRoles = new Set(["concrete-send"]);
  let hasWrapper = false;
  let canonicalIndex = -1;

  const mailSendIndices = new Set<number>();
  for (const node of cluster.nodes) {
    if (wrapperRoles.has(node.role)) {
      hasWrapper = true;
    }
    if (mailSendRoles.has(node.role)) {
      mailSendIndices.add(node.nodeIndex);
    }
  }

  const concreteSend = cluster.concreteSendNode;
  if (concreteSend) {
    canonicalIndex = concreteSend.nodeIndex;
  } else if (mailSendIndices.size > 0) {
    canonicalIndex = Math.min(...mailSendIndices);
  }

  if (canonicalIndex < 0) return null;

  const canonicalProps: Record<string, any> = {};
  if (lockResult.propertyProvenance) {
    for (const prov of lockResult.propertyProvenance) {
      if (prov.value !== undefined && prov.value !== null) {
        canonicalProps[prov.propertyName] = prov.value;
      }
    }
  }

  const competingIndices = [...mailSendIndices].filter(idx => idx !== canonicalIndex);

  const canonicalOrdinal = concreteSend?.localMailSendOrdinal;

  return {
    canonicalTopLevelIndex: canonicalIndex,
    competingTopLevelIndices: competingIndices,
    canonicalTemplate: contract.className,
    canonicalProperties: canonicalProps,
    nestedInWrapper: hasWrapper,
    localMailSendOrdinal: canonicalOrdinal,
  };
}

function applyOrdinalTargetedRewrite(
  nodes: WorkflowNode[],
  ordinalDirectives: Map<number, RewriteDirective>,
  removedOrdinals: Set<number>,
  ordinalCounter: { value: number },
): { result: WorkflowNode[]; rewroteAny: boolean } {
  const result: WorkflowNode[] = [];
  let rewroteAny = false;

  for (const node of nodes) {
    if (node.kind === "activity" && isMailSendTemplate(node.template)) {
      const currentOrdinal = ordinalCounter.value++;
      if (removedOrdinals.has(currentOrdinal)) {
        rewroteAny = true;
        continue;
      }
      const directive = ordinalDirectives.get(currentOrdinal);
      if (directive) {
        result.push({
          ...node,
          template: directive.canonicalTemplate,
          properties: { ...node.properties, ...directive.canonicalProperties },
        } as WorkflowNode);
        rewroteAny = true;
      } else {
        result.push(node);
      }
    } else if (node.kind === "sequence") {
      const { result: rChildren, rewroteAny: rA } = applyOrdinalTargetedRewrite(node.children, ordinalDirectives, removedOrdinals, ordinalCounter);
      if (rA) {
        result.push({ ...node, children: rChildren } as WorkflowNode);
        rewroteAny = true;
      } else {
        result.push(node);
      }
    } else if (node.kind === "tryCatch") {
      const { result: rTry, rewroteAny: rA1 } = applyOrdinalTargetedRewrite(node.tryChildren, ordinalDirectives, removedOrdinals, ordinalCounter);
      const { result: rCatch, rewroteAny: rA2 } = applyOrdinalTargetedRewrite(node.catchChildren, ordinalDirectives, removedOrdinals, ordinalCounter);
      const { result: rFinally, rewroteAny: rA3 } = applyOrdinalTargetedRewrite(node.finallyChildren, ordinalDirectives, removedOrdinals, ordinalCounter);
      if (rA1 || rA2 || rA3) {
        result.push({ ...node, tryChildren: rTry, catchChildren: rCatch, finallyChildren: rFinally } as WorkflowNode);
        rewroteAny = true;
      } else {
        result.push(node);
      }
    } else if (node.kind === "retryScope") {
      const { result: rBody, rewroteAny: rA } = applyOrdinalTargetedRewrite(node.bodyChildren, ordinalDirectives, removedOrdinals, ordinalCounter);
      if (rA) {
        result.push({ ...node, bodyChildren: rBody } as WorkflowNode);
        rewroteAny = true;
      } else {
        result.push(node);
      }
    } else if (node.kind === "if") {
      const { result: rThen, rewroteAny: rA1 } = applyOrdinalTargetedRewrite(node.thenChildren, ordinalDirectives, removedOrdinals, ordinalCounter);
      const { result: rElse, rewroteAny: rA2 } = applyOrdinalTargetedRewrite(node.elseChildren, ordinalDirectives, removedOrdinals, ordinalCounter);
      if (rA1 || rA2) {
        result.push({ ...node, thenChildren: rThen, elseChildren: rElse } as WorkflowNode);
        rewroteAny = true;
      } else {
        result.push(node);
      }
    } else if (node.kind === "while") {
      const { result: rBody, rewroteAny: rA } = applyOrdinalTargetedRewrite(node.bodyChildren, ordinalDirectives, removedOrdinals, ordinalCounter);
      if (rA) {
        result.push({ ...node, bodyChildren: rBody } as WorkflowNode);
        rewroteAny = true;
      } else {
        result.push(node);
      }
    } else if (node.kind === "forEach") {
      const { result: rBody, rewroteAny: rA } = applyOrdinalTargetedRewrite(node.bodyChildren, ordinalDirectives, removedOrdinals, ordinalCounter);
      if (rA) {
        result.push({ ...node, bodyChildren: rBody } as WorkflowNode);
        rewroteAny = true;
      } else {
        result.push(node);
      }
    } else {
      result.push(node);
    }
  }

  return { result, rewroteAny };
}

export function applyCanonicalRewrite(
  nodes: WorkflowNode[],
  lockResults: MailFamilyLockResult[],
): { rewrittenNodes: WorkflowNode[]; rewriteCount: number } {
  const directives = lockResults
    .filter(r => r.rewriteDirective)
    .map(r => r.rewriteDirective!);

  if (directives.length === 0) return { rewrittenNodes: nodes, rewriteCount: 0 };

  const directivesByIndex = new Map<number, RewriteDirective[]>();
  for (const d of directives) {
    const existing = directivesByIndex.get(d.canonicalTopLevelIndex) || [];
    existing.push(d);
    directivesByIndex.set(d.canonicalTopLevelIndex, existing);
  }

  const removeSet = new Set<number>();
  for (const d of directives) {
    for (const idx of d.competingTopLevelIndices) {
      removeSet.add(idx);
    }
  }

  let rewriteCount = 0;
  const result: WorkflowNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    if (removeSet.has(i)) {
      continue;
    }

    const indexDirectives = directivesByIndex.get(i);
    if (!indexDirectives || indexDirectives.length === 0) {
      result.push(nodes[i]);
      continue;
    }

    const node = nodes[i];
    const isContainerNode = node.kind === "tryCatch" || node.kind === "retryScope" ||
      node.kind === "sequence" || node.kind === "if" || node.kind === "while" || node.kind === "forEach";

    const hasOrdinals = indexDirectives.some(d => d.localMailSendOrdinal !== undefined);
    const hasMultiple = indexDirectives.length > 1;

    if (hasMultiple && hasOrdinals && isContainerNode) {
      const ordinalMap = new Map<number, RewriteDirective>();
      const removedOrdinals = new Set<number>();
      for (const d of indexDirectives) {
        if (d.localMailSendOrdinal !== undefined) {
          ordinalMap.set(d.localMailSendOrdinal, d);
        }
      }
      const ordinalCounter = { value: 0 };
      let rewrittenNode: WorkflowNode = node;
      let rewroteAny = false;

      if (node.kind === "tryCatch") {
        const { result: rTry, rewroteAny: rA1 } = applyOrdinalTargetedRewrite(node.tryChildren, ordinalMap, removedOrdinals, ordinalCounter);
        const { result: rCatch, rewroteAny: rA2 } = applyOrdinalTargetedRewrite(node.catchChildren, ordinalMap, removedOrdinals, ordinalCounter);
        const { result: rFinally, rewroteAny: rA3 } = applyOrdinalTargetedRewrite(node.finallyChildren, ordinalMap, removedOrdinals, ordinalCounter);
        rewroteAny = rA1 || rA2 || rA3;
        if (rewroteAny) rewrittenNode = { ...node, tryChildren: rTry, catchChildren: rCatch, finallyChildren: rFinally } as WorkflowNode;
      } else if (node.kind === "retryScope") {
        const { result: rBody, rewroteAny: rA } = applyOrdinalTargetedRewrite(node.bodyChildren, ordinalMap, removedOrdinals, ordinalCounter);
        rewroteAny = rA;
        if (rewroteAny) rewrittenNode = { ...node, bodyChildren: rBody } as WorkflowNode;
      } else if (node.kind === "sequence") {
        const { result: rChildren, rewroteAny: rA } = applyOrdinalTargetedRewrite(node.children, ordinalMap, removedOrdinals, ordinalCounter);
        rewroteAny = rA;
        if (rewroteAny) rewrittenNode = { ...node, children: rChildren } as WorkflowNode;
      } else if (node.kind === "if") {
        const { result: rThen, rewroteAny: rA1 } = applyOrdinalTargetedRewrite(node.thenChildren, ordinalMap, removedOrdinals, ordinalCounter);
        const { result: rElse, rewroteAny: rA2 } = applyOrdinalTargetedRewrite(node.elseChildren, ordinalMap, removedOrdinals, ordinalCounter);
        rewroteAny = rA1 || rA2;
        if (rewroteAny) rewrittenNode = { ...node, thenChildren: rThen, elseChildren: rElse } as WorkflowNode;
      } else if (node.kind === "while") {
        const { result: rBody, rewroteAny: rA } = applyOrdinalTargetedRewrite(node.bodyChildren, ordinalMap, removedOrdinals, ordinalCounter);
        rewroteAny = rA;
        if (rewroteAny) rewrittenNode = { ...node, bodyChildren: rBody } as WorkflowNode;
      } else if (node.kind === "forEach") {
        const { result: rBody, rewroteAny: rA } = applyOrdinalTargetedRewrite(node.bodyChildren, ordinalMap, removedOrdinals, ordinalCounter);
        rewroteAny = rA;
        if (rewroteAny) rewrittenNode = { ...node, bodyChildren: rBody } as WorkflowNode;
      }

      if (rewroteAny) {
        rewriteCount += indexDirectives.length;
        result.push(rewrittenNode);
      } else {
        result.push(node);
      }
    } else if (indexDirectives.length === 1) {
      const directive = indexDirectives[0];

      if (directive.nestedInWrapper || isContainerNode) {
        const state = { canonicalEmitted: false };
        let rewrittenNode = node;
        let rewroteAny = false;

        if (node.kind === "tryCatch") {
          const { result: rTry, rewroteAny: rA1 } = canonicalizeMailSendsInSubtreeArray(node.tryChildren, directive.canonicalTemplate, directive.canonicalProperties, state);
          const { result: rCatch, rewroteAny: rA2 } = canonicalizeMailSendsInSubtreeArray(node.catchChildren, directive.canonicalTemplate, directive.canonicalProperties, state);
          const { result: rFinally, rewroteAny: rA3 } = canonicalizeMailSendsInSubtreeArray(node.finallyChildren, directive.canonicalTemplate, directive.canonicalProperties, state);
          rewroteAny = rA1 || rA2 || rA3;
          if (rewroteAny) rewrittenNode = { ...node, tryChildren: rTry, catchChildren: rCatch, finallyChildren: rFinally } as WorkflowNode;
        } else if (node.kind === "retryScope") {
          const { result: rBody, rewroteAny: rA } = canonicalizeMailSendsInSubtreeArray(node.bodyChildren, directive.canonicalTemplate, directive.canonicalProperties, state);
          rewroteAny = rA;
          if (rewroteAny) rewrittenNode = { ...node, bodyChildren: rBody } as WorkflowNode;
        } else if (node.kind === "sequence") {
          const { result: rChildren, rewroteAny: rA } = canonicalizeMailSendsInSubtreeArray(node.children, directive.canonicalTemplate, directive.canonicalProperties, state);
          rewroteAny = rA;
          if (rewroteAny) rewrittenNode = { ...node, children: rChildren } as WorkflowNode;
        } else if (node.kind === "if") {
          const { result: rThen, rewroteAny: rA1 } = canonicalizeMailSendsInSubtreeArray(node.thenChildren, directive.canonicalTemplate, directive.canonicalProperties, state);
          const { result: rElse, rewroteAny: rA2 } = canonicalizeMailSendsInSubtreeArray(node.elseChildren, directive.canonicalTemplate, directive.canonicalProperties, state);
          rewroteAny = rA1 || rA2;
          if (rewroteAny) rewrittenNode = { ...node, thenChildren: rThen, elseChildren: rElse } as WorkflowNode;
        } else if (node.kind === "while") {
          const { result: rBody, rewroteAny: rA } = canonicalizeMailSendsInSubtreeArray(node.bodyChildren, directive.canonicalTemplate, directive.canonicalProperties, state);
          rewroteAny = rA;
          if (rewroteAny) rewrittenNode = { ...node, bodyChildren: rBody } as WorkflowNode;
        } else if (node.kind === "forEach") {
          const { result: rBody, rewroteAny: rA } = canonicalizeMailSendsInSubtreeArray(node.bodyChildren, directive.canonicalTemplate, directive.canonicalProperties, state);
          rewroteAny = rA;
          if (rewroteAny) rewrittenNode = { ...node, bodyChildren: rBody } as WorkflowNode;
        }

        if (rewroteAny) {
          rewriteCount++;
          result.push(rewrittenNode);
        } else {
          result.push(node);
        }
      } else if (node.kind === "activity" && isMailSendTemplate(node.template)) {
        result.push({
          ...node,
          template: directive.canonicalTemplate,
          properties: { ...node.properties, ...directive.canonicalProperties },
        } as WorkflowNode);
        rewriteCount++;
      } else {
        result.push(node);
      }
    } else {
      result.push(node);
    }
  }

  return { rewrittenNodes: result, rewriteCount };
}

export function runMailFamilyLockAnalysis(
  specs: Array<{ file: string; workflow: string; rootSequence: { kind: "sequence"; displayName: string; children: WorkflowNode[] } }>,
  profile: StudioProfile | null,
  verifiedPackages: Set<string>,
  integrationServiceConnectors?: Array<{ connectorName: string; connectionName?: string; connectionId?: string }>,
): MailFamilyLockDiagnostics {
  const lockResults: MailFamilyLockResult[] = [];

  for (const spec of specs) {
    const specLockResults: MailFamilyLockResult[] = [];
    const clusters = detectMailSendClusters(spec.rootSequence.children, spec.file, spec.workflow, integrationServiceConnectors);
    for (const cluster of clusters) {
      const result = lockClusterToFamily(cluster, profile, verifiedPackages, integrationServiceConnectors);
      result.rewriteDirective = buildRewriteDirective(cluster, result);
      specLockResults.push(result);
      lockResults.push(result);
    }

    const withDirectives = specLockResults.filter(r => r.rewriteDirective);
    if (withDirectives.length > 0) {
      const { rewrittenNodes, rewriteCount } = applyCanonicalRewrite(spec.rootSequence.children, withDirectives);
      if (rewriteCount > 0) {
        spec.rootSequence.children = rewrittenNodes;
      }
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
