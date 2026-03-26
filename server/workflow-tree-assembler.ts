import type {
  WorkflowNode,
  WorkflowSpec,
  VariableDeclaration,
  ActivityNode,
  SequenceNode,
  TryCatchNode,
  IfNode,
  WhileNode,
  ForEachNode,
  RetryScopeNode,
  PropertyValue,
} from "./workflow-spec-types";
import { catalogService } from "./catalog/catalog-service";
import type { ActivityValidationResult, ValidationCorrection } from "./catalog/catalog-service";
import { buildTemplateBlock } from "./catalog/xaml-template-builder";
import type { ProcessType } from "./catalog/catalog-service";
import { escapeXml } from "./lib/xml-utils";
import { buildExpression, isValueIntent, type ValueIntent } from "./xaml/expression-builder";
import { getActivityTag, getActivityPrefixStrict } from "./xaml/xaml-compliance";
import type { RemediationEntry, RemediationCode } from "./uipath-pipeline";
import { PROPERTY_REMEDIATION_ESCALATION_THRESHOLD } from "./uipath-pipeline";

export interface PropertyRemediationRecord {
  propertyName: string;
  remediationCode: RemediationCode;
  reason: string;
  originalValue: string;
  replacementValue: string;
}

export interface AssemblyRemediationContext {
  fileName: string;
  propertyRemediations: RemediationEntry[];
  escalationThreshold: number;
}

let _activeRemediationContext: AssemblyRemediationContext | null = null;

export function setRemediationContext(ctx: AssemblyRemediationContext): void {
  _activeRemediationContext = ctx;
}

export function clearRemediationContext(): AssemblyRemediationContext | null {
  const ctx = _activeRemediationContext;
  _activeRemediationContext = null;
  return ctx;
}

function recordPropertyRemediation(
  propertyName: string,
  remediationCode: RemediationCode,
  reason: string,
  activityTemplate: string,
  displayName: string,
): void {
  if (!_activeRemediationContext) return;
  _activeRemediationContext.propertyRemediations.push({
    level: "property",
    file: _activeRemediationContext.fileName,
    remediationCode,
    originalTag: activityTemplate,
    originalDisplayName: displayName,
    propertyName,
    reason,
    classifiedCheck: remediationCode,
    developerAction: `Fix property "${propertyName}" on "${displayName}" (${activityTemplate}) in ${_activeRemediationContext.fileName} — ${reason}`,
    estimatedEffortMinutes: estimatePropertyEffort(remediationCode),
  });
}

function estimatePropertyEffort(code: RemediationCode): number {
  const effortMap: Record<string, number> = {
    "STUB_PROPERTY_BAD_EXPRESSION": 10,
    "STUB_PROPERTY_MISSING_SELECTOR": 15,
    "STUB_PROPERTY_UNSUPPORTED_TYPE": 5,
    "STUB_PROPERTY_INVALID_VALUE": 5,
  };
  return effortMap[code] || 5;
}

function validatePropertyValue(
  key: string,
  value: string,
  schema: any,
  templateName: string,
): { valid: boolean; code: RemediationCode; reason: string } | null {
  if (value === "[object Object]" || value === "undefined" || value === "null") {
    return {
      valid: false,
      code: "STUB_PROPERTY_BAD_EXPRESSION",
      reason: `Property "${key}" contains serialization artifact "${value}"`,
    };
  }

  if (key.toLowerCase() === "selector" || key.toLowerCase().endsWith("selector")) {
    if (!value || value === "" || value === '""') {
      return {
        valid: false,
        code: "STUB_PROPERTY_MISSING_SELECTOR",
        reason: `Property "${key}" has empty or missing selector value`,
      };
    }
  }

  if (schema) {
    const propDef = schema.activity?.properties?.find((p: any) => p.name === key);
    if (propDef?.validValues && propDef.validValues.length > 0) {
      const normalizedValue = value.replace(/^\[|\]$/g, "").trim();
      if (!propDef.validValues.includes(normalizedValue) && !propDef.validValues.includes(value)) {
        return {
          valid: false,
          code: "STUB_PROPERTY_INVALID_VALUE",
          reason: `Property "${key}" has value "${value}" which is not in valid values: ${propDef.validValues.join(", ")}`,
        };
      }
    }
  }

  return null;
}

function getSafeDefaultForProperty(key: string, code: RemediationCode): string {
  if (code === "STUB_PROPERTY_MISSING_SELECTOR") {
    return '[TODO: Capture selector using UiExplorer]';
  }
  if (code === "STUB_PROPERTY_BAD_EXPRESSION") {
    return '[TODO: Replace with valid expression]';
  }
  if (code === "STUB_PROPERTY_INVALID_VALUE") {
    return '[TODO: Set valid value]';
  }
  return `[TODO: Fix ${key}]`;
}

function mapClrType(type: string): string {
  const lower = type.toLowerCase();
  if (lower === "string" || lower === "system.string" || lower === "x:string") return "x:String";
  if (lower === "int32" || lower === "integer" || lower === "int" || lower === "system.int32" || lower === "x:int32") return "x:Int32";
  if (lower === "int64" || lower === "long" || lower === "system.int64" || lower === "x:int64") return "x:Int64";
  if (lower === "boolean" || lower === "bool" || lower === "system.boolean" || lower === "x:boolean") return "x:Boolean";
  if (lower === "double" || lower === "system.double" || lower === "x:double") return "x:Double";
  if (lower === "decimal" || lower === "system.decimal" || lower === "x:decimal") return "x:Decimal";
  if (lower === "datetime" || lower === "system.datetime" || lower === "s:datetime") return "s:DateTime";
  if (lower === "timespan" || lower === "system.timespan" || lower === "s:timespan") return "s:TimeSpan";
  if (lower === "object" || lower === "system.object" || lower === "x:object") return "x:Object";
  if (lower.includes("datatable")) return "scg2:DataTable";
  if (lower.includes("datarow")) return "scg2:DataRow";
  if (lower.includes("securestring")) return "s:Security.SecureString";
  return "x:Object";
}

function inferAssignType(varName: string, variables: VariableDeclaration[]): string {
  const decl = variables.find(v => v.name === varName);
  if (decl) return mapClrType(decl.type);
  if (varName.startsWith("str_")) return "x:String";
  if (varName.startsWith("int_")) return "x:Int32";
  if (varName.startsWith("bool_")) return "x:Boolean";
  if (varName.startsWith("dbl_")) return "x:Double";
  if (varName.startsWith("dec_")) return "x:Decimal";
  if (varName.startsWith("dt_")) return "scg2:DataTable";
  if (varName.startsWith("drow_")) return "scg2:DataRow";
  if (varName.startsWith("sec_")) return "s:Security.SecureString";
  if (varName.startsWith("ts_")) return "s:TimeSpan";
  if (varName.startsWith("obj_")) return "x:Object";
  return "x:Object";
}

function indent(xml: string, level: number): string {
  const spaces = "  ".repeat(level);
  return xml.split("\n").map(line => line.trim() ? spaces + line : line).join("\n");
}

function ensureBracketWrapped(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
  if (trimmed.startsWith("\"") || trimmed.startsWith("'")) return trimmed;
  if (/^\d+$/.test(trimmed)) return trimmed;
  if (trimmed === "True" || trimmed === "False") return trimmed;
  return `[${trimmed}]`;
}

function looksLikeVariableRef(expr: string): boolean {
  const trimmed = expr.trim();
  if (!trimmed) return false;
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return true;
  if (/^[a-zA-Z_][a-zA-Z0-9_.]+$/.test(trimmed)) return true;
  return false;
}

function smartBracketWrap(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
  if (trimmed.startsWith("<InArgument") || trimmed.startsWith("<OutArgument")) return trimmed;
  if (/^".*"$/.test(trimmed)) return trimmed;
  if (/^'.*'$/.test(trimmed)) return trimmed;
  if (/^&quot;.*&quot;$/.test(trimmed)) return trimmed;
  if (trimmed === "True" || trimmed === "False" || trimmed === "Nothing" || trimmed === "null") return trimmed;
  if (/^[0-9]+$/.test(trimmed)) return trimmed;
  return `[${trimmed}]`;
}

export function resolvePropertyValue(value: PropertyValue): string {
  if (isValueIntent(value)) {
    return buildExpression(value as ValueIntent);
  }
  return smartBracketWrap(String(value));
}

export function resolvePropertyValueRaw(value: PropertyValue): string {
  if (isValueIntent(value)) {
    return buildExpression(value as ValueIntent);
  }
  return String(value);
}

function parseEmittedXmlForValidation(xml: string): {
  tag: string;
  className: string;
  attributes: Record<string, string>;
  childNames: string[];
} | null {
  const trimmed = xml.trim();
  const openTagMatch = trimmed.match(/^<((?:[\w]+:)?[\w]+)([\s\S]*?)(?:\/>|>)/);
  if (!openTagMatch) return null;
  const tag = openTagMatch[1];
  const className = tag.includes(":") ? tag.split(":").pop()! : tag;
  const attrString = openTagMatch[2];

  const attributes: Record<string, string> = {};
  const attrRegex = /([\w]+(?:\.[\w]+)?)="([^"]*)"/g;
  let m;
  while ((m = attrRegex.exec(attrString)) !== null) {
    if (m[1].startsWith("xmlns") || m[1].includes(":")) continue;
    attributes[m[1]] = m[2];
  }

  const childNames: string[] = [];
  const childPropRegex = new RegExp(`<${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\w+)[\\s>]`, "g");
  let cm;
  while ((cm = childPropRegex.exec(trimmed)) !== null) {
    childNames.push(cm[1]);
    childNames.push(`${className}.${cm[1]}`);
  }

  return { tag, className, attributes, childNames };
}

function applyCatalogConformance(xml: string): string {
  if (!catalogService.isLoaded()) {
    try { catalogService.load(); } catch (e) { }
  }
  if (!catalogService.isLoaded()) return xml;

  const parsed = parseEmittedXmlForValidation(xml);
  if (!parsed) return xml;

  const { tag, className } = parsed;
  const templateName = className;
  const schema = catalogService.getActivitySchema(templateName);
  if (!schema) return xml;

  const validation = catalogService.validateEmittedActivity(
    tag,
    parsed.attributes,
    parsed.childNames,
  );

  if (validation.valid && validation.corrections.length === 0) return xml;

  let corrected = xml;
  for (const correction of validation.corrections) {
    if (correction.type === "move-to-child-element") {
      const propName = correction.property;
      const propVal = parsed.attributes[propName];
      if (propVal === undefined) continue;

      const wrapper = correction.argumentWrapper || "InArgument";
      const xType = correction.typeArguments || "x:String";
      const wrappedVal = ensureBracketWrapped(propVal);
      const childElement = `<${className}.${propName}>\n    <${wrapper} x:TypeArguments="${xType}">${wrappedVal}</${wrapper}>\n  </${className}.${propName}>`;

      const escapedPropName = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedVal = propVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const selfClosingRegex = new RegExp(`(<${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s[^>]*?)${escapedPropName}="${escapedVal}"([^>]*?)\\s*\\/>`);
      if (selfClosingRegex.test(corrected)) {
        corrected = corrected.replace(selfClosingRegex, `$1$2>\n  ${childElement}\n</${tag}>`);
      } else {
        const openRegex = new RegExp(`(<${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s[^>]*?)${escapedPropName}="${escapedVal}"([^>]*?>)`);
        if (openRegex.test(corrected)) {
          corrected = corrected.replace(openRegex, `$1$2\n  ${childElement}`);
          const closingTag = `</${tag}>`;
          if (!corrected.includes(closingTag)) {
            corrected += `\n${closingTag}`;
          }
        }
      }

      console.log(`[Catalog Conformance] Moved ${tag}.${propName} from attribute to child-element at emission time`);
    } else if (correction.type === "move-to-attribute") {
      console.log(`[Catalog Conformance] Property ${tag}.${correction.property} should be attribute, not child-element (logged for review)`);
    }
  }

  corrected = corrected.replace(/\s{2,}\/?>/g, (match) => match.includes('/') ? ' />' : '>');
  corrected = corrected.replace(/<(\S+)\s+>/g, '<$1>');

  return corrected;
}

function getPropString(props: Record<string, PropertyValue>, ...keys: string[]): string {
  for (const key of keys) {
    if (props[key] !== undefined) {
      const val = props[key];
      if (isValueIntent(val)) {
        return buildExpression(val as ValueIntent);
      }
      return String(val);
    }
  }
  return "";
}

export type EmissionContext = "normal" | "mandatory-catch" | "mandatory-finally";

export function resolveActivityTemplate(
  node: ActivityNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType = "general",
  emissionContext: EmissionContext = "normal"
): string {
  const templateName = node.template;
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);

  if (templateName === "Assign") {
    return applyCatalogConformance(resolveAssignTemplate(node, allVariables));
  }

  if (templateName === "LogMessage") {
    const level = getPropString(props, "Level", "level") || "Info";
    const message = getPropString(props, "Message", "message") || `"${displayName}"`;
    const wrappedMessage = smartBracketWrap(message);
    return applyCatalogConformance(`<ui:LogMessage Level="${escapeXml(level)}" Message="${escapeXml(wrappedMessage)}" DisplayName="${displayName}" />`);
  }

  if (templateName === "Delay") {
    const duration = getPropString(props, "Duration", "duration") || "00:00:05";
    return applyCatalogConformance(`<Delay Duration="${escapeXml(duration)}" DisplayName="${displayName}" />`);
  }

  if (templateName === "Rethrow") {
    return applyCatalogConformance(`<Rethrow DisplayName="${displayName}" />`);
  }

  if (templateName === "InvokeWorkflowFile") {
    const fileName = getPropString(props, "WorkflowFileName", "workflowFileName") || "Workflow.xaml";
    return applyCatalogConformance(`<ui:InvokeWorkflowFile WorkflowFileName="${escapeXml(fileName)}" DisplayName="${displayName}">\n` +
      `  <ui:InvokeWorkflowFile.Arguments>\n` +
      `  </ui:InvokeWorkflowFile.Arguments>\n` +
      `</ui:InvokeWorkflowFile>`);
  }

  if (templateName === "GetAsset") {
    return applyCatalogConformance(resolveGetAssetTemplate(node));
  }

  if (templateName === "GetCredential") {
    return applyCatalogConformance(resolveGetCredentialTemplate(node));
  }

  if (templateName === "SendSmtpMailMessage") {
    return applyCatalogConformance(resolveSendSmtpMailMessageTemplate(node));
  }

  if (templateName === "HttpClient") {
    return applyCatalogConformance(resolveHttpClientTemplate(node));
  }

  if (templateName === "DeserializeJson") {
    const input = getPropString(props, "JsonString", "jsonString", "Input") || "";
    const outputVar = node.outputVar || "obj_Result";
    const djTag = getActivityTag("DeserializeJson");
    return applyCatalogConformance(`<${djTag} DisplayName="${displayName}" JsonString="${escapeXml(input)}">\n` +
      `  <${djTag}.Result>\n` +
      `    <OutArgument x:TypeArguments="x:Object">${ensureBracketWrapped(outputVar)}</OutArgument>\n` +
      `  </${djTag}.Result>\n` +
      `</${djTag}>`);
  }

  if (templateName === "Comment") {
    const text = getPropString(props, "Text", "text") || "";
    return applyCatalogConformance(`<ui:Comment Text="${escapeXml(text)}" DisplayName="${displayName}" />`);
  }

  if (!catalogService.isLoaded()) {
    try {
      catalogService.load();
    } catch (e) {
    }
  }

  const UNSUPPORTED_ACTIVITIES = new Set([
    "InvokeAgent", "DownloadFile", "UploadFile",
  ]);

  if (UNSUPPORTED_ACTIVITIES.has(templateName)) {
    const isMandatoryPath = emissionContext === "mandatory-catch" || emissionContext === "mandatory-finally";
    console.warn(`[Tree Assembler] Unsupported activity "${templateName}" — "${node.displayName}"${isMandatoryPath ? " (in mandatory path)" : ""}. Emitting fallback.`);
    if (_activeRemediationContext) {
      _activeRemediationContext.propertyRemediations.push({
        level: "activity",
        file: _activeRemediationContext.fileName,
        remediationCode: "STUB_ACTIVITY_CATALOG_VIOLATION",
        originalTag: templateName,
        originalDisplayName: node.displayName,
        propertyName: isMandatoryPath ? "(unsupported-activity-mandatory-path)" : "(unsupported-activity)",
        reason: `Activity "${templateName}" is not supported — no valid catalog entry or package mapping exists. Business step "${node.displayName}" requires manual implementation.${isMandatoryPath ? " This activity is in a mandatory execution path (catch/finally block) — the workflow is BLOCKED until resolved." : ""}`,
        classifiedCheck: "UNSUPPORTED_ACTIVITY",
        developerAction: `Manually implement "${node.displayName}" using supported activities — "${templateName}" has no valid package mapping`,
        estimatedEffortMinutes: isMandatoryPath ? 45 : 30,
      });
    }
    if (isMandatoryPath) {
      return `<!-- BLOCKED: Unsupported activity "${escapeXml(templateName)}" in mandatory ${emissionContext === "mandatory-catch" ? "catch" : "finally"} path — "${escapeXml(node.displayName)}" requires manual implementation -->
<ui:LogMessage Level="Error" Message="[&quot;BLOCKED: Unsupported activity &apos;${escapeXml(templateName)}&apos; in mandatory path — business step &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Blocked Activity (${escapeXml(node.displayName)})" />
<Rethrow DisplayName="Rethrow — blocked activity &apos;${escapeXml(node.displayName)}&apos;" />`;
    }
    return `<!-- WARNING: Unsupported activity "${escapeXml(templateName)}" — "${escapeXml(node.displayName)}" requires manual implementation -->
<ui:Comment Text="[BLOCKED] Unsupported activity: ${escapeXml(templateName)}. Business step &quot;${escapeXml(node.displayName)}&quot; requires manual implementation using supported UiPath activities." DisplayName="${escapeXml(node.displayName)} (unsupported — manual implementation required)" />
<ui:LogMessage Level="Warn" Message="[&quot;WARNING: Business step &apos;${escapeXml(node.displayName)}&apos; uses unsupported activity &apos;${escapeXml(templateName)}&apos; — requires manual implementation&quot;]" DisplayName="Log Unsupported Activity Warning" />`;
  }

  if (catalogService.isLoaded()) {
    const schema = catalogService.getActivitySchema(templateName);
    if (!schema) {
      const isMandatoryPath = emissionContext === "mandatory-catch" || emissionContext === "mandatory-finally";
      console.warn(`[Tree Assembler] Unknown template "${templateName}" — not in catalog${isMandatoryPath ? " (in mandatory path)" : ""}, emitting fallback`);
      if (_activeRemediationContext) {
        _activeRemediationContext.propertyRemediations.push({
          level: "activity",
          file: _activeRemediationContext.fileName,
          remediationCode: "STUB_ACTIVITY_CATALOG_VIOLATION",
          originalTag: templateName,
          originalDisplayName: node.displayName,
          propertyName: isMandatoryPath ? "(unknown-template-mandatory-path)" : "(unknown-template)",
          reason: `Activity "${templateName}" is not in the activity catalog. Business step "${node.displayName}" requires manual implementation.${isMandatoryPath ? " This activity is in a mandatory execution path — the workflow is BLOCKED until resolved." : ""}`,
          classifiedCheck: "CATALOG_VIOLATION",
          developerAction: `Verify and implement "${node.displayName}" (${templateName}) using supported activities`,
          estimatedEffortMinutes: isMandatoryPath ? 30 : 20,
        });
      }
      if (isMandatoryPath) {
        return `<!-- BLOCKED: Unknown activity "${escapeXml(templateName)}" in mandatory ${emissionContext === "mandatory-catch" ? "catch" : "finally"} path — "${escapeXml(node.displayName)}" -->
<ui:LogMessage Level="Error" Message="[&quot;BLOCKED: Unknown activity &apos;${escapeXml(templateName)}&apos; in mandatory path — business step &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Blocked Activity (${escapeXml(node.displayName)})" />
<Rethrow DisplayName="Rethrow — blocked activity &apos;${escapeXml(node.displayName)}&apos;" />`;
      }
      return `<!-- WARNING: Unknown activity template "${escapeXml(templateName)}" — "${escapeXml(node.displayName)}" not found in catalog -->
<ui:Comment Text="[BLOCKED] Unknown activity: ${escapeXml(templateName)}. Business step &quot;${escapeXml(node.displayName)}&quot; requires manual implementation." DisplayName="${escapeXml(node.displayName)} (unknown — manual implementation required)" />
<ui:LogMessage Level="Warn" Message="[&quot;WARNING: Business step &apos;${escapeXml(node.displayName)}&apos; uses unknown activity &apos;${escapeXml(templateName)}&apos; — requires manual implementation&quot;]" DisplayName="Log Unknown Activity Warning" />`;
    }
  } else {
    const isMandatoryPath = emissionContext === "mandatory-catch" || emissionContext === "mandatory-finally";
    console.error(`[Tree Assembler] Catalog not loaded — cannot resolve template "${templateName}" safely${isMandatoryPath ? " (in mandatory path)" : ""}. Emitting stub.`);
    if (_activeRemediationContext) {
      _activeRemediationContext.propertyRemediations.push({
        level: "activity",
        file: _activeRemediationContext.fileName,
        remediationCode: "STUB_ACTIVITY_CATALOG_VIOLATION",
        originalTag: templateName,
        originalDisplayName: node.displayName,
        propertyName: isMandatoryPath ? "(catalog-not-loaded-mandatory-path)" : "(catalog-not-loaded)",
        reason: `Catalog not loaded — cannot verify template "${templateName}" structure. Emitting stub to avoid schema-less degradation.${isMandatoryPath ? " This is in a mandatory execution path — workflow is BLOCKED." : ""}`,
        classifiedCheck: "CATALOG_VIOLATION",
        developerAction: `Verify and re-implement "${node.displayName}" (${templateName}) — catalog was not available at emission time`,
        estimatedEffortMinutes: isMandatoryPath ? 25 : 15,
      });
    }
    if (isMandatoryPath) {
      return `<!-- BLOCKED: Catalog not loaded for "${escapeXml(templateName)}" in mandatory ${emissionContext === "mandatory-catch" ? "catch" : "finally"} path -->
<ui:LogMessage Level="Error" Message="[&quot;BLOCKED: Activity &apos;${escapeXml(templateName)}&apos; could not be validated (catalog not loaded) in mandatory path — business step &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Blocked Activity (${escapeXml(node.displayName)})" />
<Rethrow DisplayName="Rethrow — blocked activity &apos;${escapeXml(node.displayName)}&apos;" />`;
    }
    return `<!-- CATALOG NOT LOADED: ${escapeXml(templateName)} — "${escapeXml(node.displayName)}" -->
<ui:Comment Text="[TODO: Activity ${escapeXml(templateName)} requires catalog validation. Manual implementation required.]" DisplayName="${escapeXml(node.displayName)} (stub)" />`;
  }

  return resolveDynamicTemplate(node, processType, emissionContext);
}

function resolveAssignTemplate(node: ActivityNode, allVariables: VariableDeclaration[]): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const toRaw = props.To || props.to || node.outputVar || "obj_Result";
  const valRaw = props.Value || props.value || '""';
  const toVarName = isValueIntent(toRaw) && (toRaw as ValueIntent).type === "variable"
    ? (toRaw as ValueIntent & { type: "variable" }).name
    : isValueIntent(toRaw) ? buildExpression(toRaw as ValueIntent) : String(toRaw);
  const typeArg = inferAssignType(toVarName, allVariables);
  const wrappedTo = ensureBracketWrapped(toVarName);
  const wrappedVal = resolvePropertyValue(valRaw as PropertyValue);

  return `<Assign DisplayName="${displayName}">\n` +
    `  <Assign.To>\n` +
    `    <OutArgument x:TypeArguments="${typeArg}">${wrappedTo}</OutArgument>\n` +
    `  </Assign.To>\n` +
    `  <Assign.Value>\n` +
    `    <InArgument x:TypeArguments="${typeArg}">${wrappedVal}</InArgument>\n` +
    `  </Assign.Value>\n` +
    `</Assign>`;
}

function resolveGetAssetTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const assetName = getPropString(props, "AssetName", "assetName") || "PLACEHOLDER_AssetName";
  const outputVar = node.outputVar || getPropString(props, "AssetValue", "Value") || "str_AssetValue";

  return `<ui:GetAsset DisplayName="${displayName}" AssetName="${escapeXml(assetName)}">\n` +
    `  <ui:GetAsset.AssetValue>\n` +
    `    <OutArgument x:TypeArguments="x:String">${ensureBracketWrapped(outputVar)}</OutArgument>\n` +
    `  </ui:GetAsset.AssetValue>\n` +
    `</ui:GetAsset>`;
}

function resolveGetCredentialTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const assetName = getPropString(props, "AssetName", "assetName") || "PLACEHOLDER_CredentialName";
  const usernameVar = getPropString(props, "Username", "username") || "str_Username";
  const passwordVar = getPropString(props, "Password", "password") || "sec_Password";

  return `<ui:GetCredential DisplayName="${displayName}" AssetName="${escapeXml(assetName)}">\n` +
    `  <ui:GetCredential.Username>\n` +
    `    <OutArgument x:TypeArguments="x:String">${ensureBracketWrapped(usernameVar)}</OutArgument>\n` +
    `  </ui:GetCredential.Username>\n` +
    `  <ui:GetCredential.Password>\n` +
    `    <OutArgument x:TypeArguments="s:Security.SecureString">${ensureBracketWrapped(passwordVar)}</OutArgument>\n` +
    `  </ui:GetCredential.Password>\n` +
    `</ui:GetCredential>`;
}

function wrapSmtpPropValue(val: string): string {
  if (!val) return val;
  return smartBracketWrap(val);
}

function resolveSendSmtpMailMessageTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const to = getPropString(props, "To", "to") || "PLACEHOLDER_To";
  const from = getPropString(props, "From", "from");
  const subject = getPropString(props, "Subject", "subject") || "PLACEHOLDER_Subject";
  const body = getPropString(props, "Body", "body") || "PLACEHOLDER_Body";
  const server = getPropString(props, "Server", "server") || "PLACEHOLDER_SmtpServer";
  const port = getPropString(props, "Port", "port") || "587";
  const email = getPropString(props, "Email", "email");
  const password = getPropString(props, "Password", "password");
  const username = getPropString(props, "Username", "username");
  const isBodyHtml = getPropString(props, "IsBodyHtml", "isBodyHtml") || "False";

  const wrappedTo = wrapSmtpPropValue(to);
  const wrappedSubject = wrapSmtpPropValue(subject);
  const wrappedBody = wrapSmtpPropValue(body);

  let attrs = `DisplayName="${displayName}" To="${escapeXml(wrappedTo)}" Subject="${escapeXml(wrappedSubject)}" Body="${escapeXml(wrappedBody)}"`;
  attrs += ` IsBodyHtml="${escapeXml(isBodyHtml)}"`;
  attrs += ` Server="${escapeXml(server)}" Port="${escapeXml(port)}"`;
  if (from) attrs += ` From="${escapeXml(wrapSmtpPropValue(from))}"`;
  if (email) attrs += ` Email="${escapeXml(wrapSmtpPropValue(email))}"`;
  if (username) attrs += ` Username="${escapeXml(wrapSmtpPropValue(username))}"`;
  if (password) attrs += ` Password="${escapeXml(wrapSmtpPropValue(password))}"`;

  return `<ui:SendSmtpMailMessage ${attrs} />`;
}

function resolveHttpClientTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const endpointRaw = props.Endpoint || props.endpoint || props.URL || props.url;
  if (!endpointRaw) {
    throw new Error(`[HttpClient] Activity "${node.displayName}" is missing a required Endpoint/URL property — cannot emit HttpClient without a valid endpoint.`);
  }
  const endpointResolved = resolvePropertyValueRaw(endpointRaw as PropertyValue);
  const method = getPropString(props, "Method", "method") || "GET";
  const outputVar = node.outputVar || "str_ResponseBody";
  const tag = getActivityTag("HttpClient");

  let wrappedEndpoint: string;
  if (endpointResolved.startsWith("[") && endpointResolved.endsWith("]")) {
    wrappedEndpoint = endpointResolved;
  } else if (/^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*$/.test(endpointResolved)) {
    wrappedEndpoint = `[${endpointResolved}]`;
  } else if (/^https?:\/\//.test(endpointResolved) || endpointResolved.includes("://")) {
    wrappedEndpoint = `[&quot;${escapeXml(endpointResolved)}&quot;]`;
  } else {
    wrappedEndpoint = `[${endpointResolved}]`;
  }

  let xml = `<${tag} DisplayName="${displayName}" Endpoint="${wrappedEndpoint}" Method="${escapeXml(method)}"`;

  xml += `>\n`;

  const body = getPropString(props, "Body", "body");
  const methodUpper = method.toUpperCase();
  if (body) {
    xml += `  <${tag}.Body>\n`;
    xml += `    <InArgument x:TypeArguments="x:String">${ensureBracketWrapped(body)}</InArgument>\n`;
    xml += `  </${tag}.Body>\n`;
  } else if (methodUpper === "POST" || methodUpper === "PUT" || methodUpper === "PATCH") {
    xml += `  <${tag}.Body>\n`;
    xml += `    <InArgument x:TypeArguments="x:String">[str_RequestBody]</InArgument>\n`;
    xml += `  </${tag}.Body>\n`;
  }

  const headers = getPropString(props, "Headers", "headers");
  if (headers) {
    xml += `  <${tag}.Headers>\n`;
    xml += `    <InArgument x:TypeArguments="scg:Dictionary(x:String, x:String)">${ensureBracketWrapped(headers)}</InArgument>\n`;
    xml += `  </${tag}.Headers>\n`;
  } else {
    const authToken = getPropString(props, "AuthToken", "authToken", "BearerToken", "bearerToken");
    if (authToken) {
      xml += `  <${tag}.Headers>\n`;
      xml += `    <InArgument x:TypeArguments="scg:Dictionary(x:String, x:String)">[New Dictionary(Of String, String) From {{"Authorization", "Bearer " &amp; ${ensureBracketWrapped(authToken).slice(1, -1)}}}]</InArgument>\n`;
      xml += `  </${tag}.Headers>\n`;
    }
  }

  xml += `  <${tag}.Result>\n`;
  xml += `    <OutArgument x:TypeArguments="x:String">${ensureBracketWrapped(outputVar)}</OutArgument>\n`;
  xml += `  </${tag}.Result>\n`;
  xml += `</${tag}>`;

  return xml;
}

function resolveDynamicTemplate(node: ActivityNode, processType: ProcessType, emissionContext: EmissionContext = "normal"): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const templateName = node.template;

  const strictPrefix = getActivityPrefixStrict(templateName);
  if (strictPrefix === null) {
    const isMandatoryPath = emissionContext === "mandatory-catch" || emissionContext === "mandatory-finally";
    console.warn(`[Tree Assembler] Activity "${templateName}" has no resolved namespace mapping — emitting as unsupported`);
    if (_activeRemediationContext) {
      _activeRemediationContext.propertyRemediations.push({
        level: "activity",
        file: _activeRemediationContext.fileName,
        remediationCode: "STUB_ACTIVITY_CATALOG_VIOLATION",
        originalTag: templateName,
        originalDisplayName: node.displayName,
        propertyName: "(unmapped-namespace)",
        reason: `Activity "${templateName}" could not be resolved to a known UiPath package namespace. Business step "${node.displayName}" requires manual implementation.${isMandatoryPath ? " This is in a mandatory execution path — workflow is BLOCKED." : ""}`,
        classifiedCheck: "UNMAPPED_NAMESPACE",
        developerAction: `Resolve namespace mapping for "${templateName}" and re-implement "${node.displayName}"`,
        estimatedEffortMinutes: isMandatoryPath ? 30 : 20,
      });
    }
    if (isMandatoryPath) {
      return `<!-- BLOCKED: Unmapped namespace for "${escapeXml(templateName)}" in mandatory path -->
<ui:LogMessage Level="Error" Message="[&quot;BLOCKED: Activity &apos;${escapeXml(templateName)}&apos; has no resolved namespace — business step &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Unmapped Activity (${escapeXml(node.displayName)})" />
<Rethrow DisplayName="Rethrow — unmapped activity &apos;${escapeXml(node.displayName)}&apos;" />`;
    }
    return `<!-- WARNING: Unmapped namespace for "${escapeXml(templateName)}" — "${escapeXml(node.displayName)}" -->
<ui:Comment Text="[BLOCKED] Unmapped namespace: ${escapeXml(templateName)}. Business step &quot;${escapeXml(node.displayName)}&quot; requires manual namespace resolution." DisplayName="${escapeXml(node.displayName)} (unmapped namespace — manual fix required)" />
<ui:LogMessage Level="Warn" Message="[&quot;WARNING: Activity &apos;${escapeXml(templateName)}&apos; has no resolved namespace — &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Unmapped Activity Warning" />`;
  }

  const tag = strictPrefix ? `${strictPrefix}:${templateName}` : templateName;

  const attrParts: string[] = [`DisplayName="${displayName}"`];
  const childParts: string[] = [];

  let schema: any = null;
  if (!catalogService.isLoaded()) {
    try { catalogService.load(); } catch (e) { }
  }
  if (catalogService.isLoaded()) {
    schema = catalogService.getActivitySchema(templateName);
  }

  const escalationThreshold = _activeRemediationContext?.escalationThreshold ?? PROPERTY_REMEDIATION_ESCALATION_THRESHOLD;
  const propertyFailures: PropertyRemediationRecord[] = [];
  const pendingPropertyRemediations: Array<{ propertyName: string; code: RemediationCode; reason: string }> = [];

  for (const [key, rawValue] of Object.entries(props)) {
    if (key.startsWith("_") || key === "displayName") continue;

    const value = isValueIntent(rawValue) ? buildExpression(rawValue as ValueIntent) : String(rawValue);

    const validationResult = validatePropertyValue(key, value, schema, templateName);
    if (validationResult && _activeRemediationContext) {
      const safeDefault = getSafeDefaultForProperty(key, validationResult.code);
      propertyFailures.push({
        propertyName: key,
        remediationCode: validationResult.code,
        reason: validationResult.reason,
        originalValue: value,
        replacementValue: safeDefault,
      });
    }

    if (propertyFailures.length > escalationThreshold) {
      const isMandatoryPath = emissionContext === "mandatory-catch" || emissionContext === "mandatory-finally";
      if (_activeRemediationContext) {
        _activeRemediationContext.propertyRemediations.push({
          level: "activity",
          file: _activeRemediationContext.fileName,
          remediationCode: "STUB_ACTIVITY_PROPERTY_ESCALATION",
          originalTag: templateName,
          originalDisplayName: node.displayName,
          propertyName: isMandatoryPath ? "(escalated-mandatory-path)" : "(escalated)",
          reason: `${propertyFailures.length} properties failed validation (threshold: ${escalationThreshold}) — escalating to activity-level stub${isMandatoryPath ? ". This is in a mandatory execution path — workflow is BLOCKED." : ""}`,
          classifiedCheck: "STUB_ACTIVITY_PROPERTY_ESCALATION",
          developerAction: `Re-implement "${node.displayName}" (${templateName}) in ${_activeRemediationContext.fileName} — ${propertyFailures.length} properties failed: ${propertyFailures.map(f => f.propertyName).join(', ')}`,
          estimatedEffortMinutes: isMandatoryPath ? 30 : 20,
        });
      }
      if (isMandatoryPath) {
        return `<!-- BLOCKED: Property escalation for "${escapeXml(templateName)}" in mandatory path -->
<ui:LogMessage Level="Error" Message="[&quot;BLOCKED: Activity &apos;${escapeXml(templateName)}&apos; failed property validation in mandatory path — business step &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Blocked Activity (${escapeXml(node.displayName)})" />
<Rethrow DisplayName="Rethrow — blocked activity &apos;${escapeXml(node.displayName)}&apos;" />`;
      }
      return `<ui:Comment Text="[TODO: Re-implement ${escapeXml(templateName)} activity — ${escapeXml(node.displayName)}. ${propertyFailures.length} properties failed validation. Original properties: ${propertyFailures.map(f => f.propertyName).join(', ')}]" DisplayName="${displayName} (stub)" />`;
    }

    let effectiveValue = value;
    if (validationResult && _activeRemediationContext) {
      const safeDefault = getSafeDefaultForProperty(key, validationResult.code);
      effectiveValue = safeDefault;
      pendingPropertyRemediations.push({
        propertyName: key,
        code: validationResult.code,
        reason: validationResult.reason,
      });
    }

    let isChildElement = false;
    if (schema) {
      const propDef = schema.activity.properties.find((p: any) => p.name === key);
      if (propDef && propDef.xamlSyntax === "child-element") {
        isChildElement = true;
        const wrapper = propDef.argumentWrapper || "InArgument";
        const typeArg = propDef.typeArguments ? ` x:TypeArguments="${propDef.typeArguments}"` : "";
        const wrappedValue = validationResult ? effectiveValue : (isValueIntent(rawValue) ? buildExpression(rawValue as ValueIntent) : smartBracketWrap(effectiveValue));
        childParts.push(
          `  <${tag}.${key}>\n` +
          `    <${wrapper}${typeArg}>${wrappedValue}</${wrapper}>\n` +
          `  </${tag}.${key}>`
        );
      }
    }

    if (!isChildElement) {
      attrParts.push(`${key}="${escapeXml(effectiveValue)}"`);
    }
  }

  for (const pending of pendingPropertyRemediations) {
    recordPropertyRemediation(pending.propertyName, pending.code, pending.reason, templateName, node.displayName);
  }

  if (node.outputVar) {
    const outputType = node.outputType || "x:Object";
    childParts.push(
      `  <${tag}.Result>\n` +
      `    <OutArgument x:TypeArguments="${mapClrType(outputType)}">${ensureBracketWrapped(node.outputVar)}</OutArgument>\n` +
      `  </${tag}.Result>`
    );
  }

  if (childParts.length === 0) {
    return `<${tag} ${attrParts.join(" ")} />`;
  }

  return `<${tag} ${attrParts.join(" ")}>\n${childParts.join("\n")}\n</${tag}>`;
}

function wrapInTryCatch(innerXml: string, displayName: string): string {
  return `<TryCatch DisplayName="Try: ${escapeXml(displayName)}">
  <TryCatch.Try>
    <Sequence DisplayName="Try Block">
      ${innerXml}
    </Sequence>
  </TryCatch.Try>
  <TryCatch.Catches>
    <Catch x:TypeArguments="s:Exception">
      <ActivityAction x:TypeArguments="s:Exception">
        <ActivityAction.Argument>
          <DelegateInArgument x:TypeArguments="s:Exception" Name="exception" />
        </ActivityAction.Argument>
        <Sequence DisplayName="Handle Exception">
          <ui:LogMessage Level="Error" Message="[&quot;Error in ${escapeXml(displayName)}: &quot; &amp; exception.Message]" DisplayName="Log Exception" />
          <Rethrow DisplayName="Rethrow Exception" />
        </Sequence>
      </ActivityAction>
    </Catch>
  </TryCatch.Catches>
</TryCatch>`;
}

function wrapInRetryScope(innerXml: string, displayName: string, retries: number = 3, interval: string = "00:00:05"): string {
  return `<ui:RetryScope NumberOfRetries="${retries}" RetryInterval="${interval}" DisplayName="Retry: ${escapeXml(displayName)}">
  <ui:RetryScope.Body>
    <Sequence DisplayName="Retry Body">
      ${innerXml}
    </Sequence>
  </ui:RetryScope.Body>
  <ui:RetryScope.Condition>
    <ui:ShouldRetry />
  </ui:RetryScope.Condition>
</ui:RetryScope>`;
}

export function assembleNode(
  node: WorkflowNode,
  allVariables: VariableDeclaration[] = [],
  processType: ProcessType = "general",
  depthLevel: number = 0,
  emissionContext: EmissionContext = "normal",
): string {
  switch (node.kind) {
    case "activity":
      return assembleActivityNode(node, allVariables, processType, emissionContext);
    case "sequence":
      return assembleSequenceNode(node, allVariables, processType, depthLevel, emissionContext);
    case "tryCatch":
      return assembleTryCatchNode(node, allVariables, processType, depthLevel, emissionContext);
    case "if":
      return assembleIfNode(node, allVariables, processType, depthLevel, emissionContext);
    case "while":
      return assembleWhileNode(node, allVariables, processType, depthLevel, emissionContext);
    case "forEach":
      return assembleForEachNode(node, allVariables, processType, depthLevel, emissionContext);
    case "retryScope":
      return assembleRetryScopeNode(node, allVariables, processType, depthLevel, emissionContext);
    default:
      return `<!-- Unknown node kind -->`;
  }
}

function assembleActivityNode(
  node: ActivityNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  emissionContext: EmissionContext = "normal",
): string {
  let xml = resolveActivityTemplate(node, allVariables, processType, emissionContext);

  if (node.errorHandling === "catch" || node.errorHandling === "escalate") {
    xml = wrapInTryCatch(xml, node.displayName);
  } else if (node.errorHandling === "retry") {
    xml = wrapInRetryScope(xml, node.displayName);
  }

  return xml;
}

function assembleSequenceNode(
  node: SequenceNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  emissionContext: EmissionContext = "normal",
): string {
  const displayName = escapeXml(node.displayName);
  const childrenXml = node.children
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext))
    .join("\n");

  let varsBlock = "";
  if (node.variables && node.variables.length > 0) {
    varsBlock = "  <Sequence.Variables>\n";
    for (const v of node.variables) {
      const typeAttr = mapClrType(v.type);
      if (v.default) {
        varsBlock += `    <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}" Default="${escapeXml(v.default)}" />\n`;
      } else {
        varsBlock += `    <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}" />\n`;
      }
    }
    varsBlock += "  </Sequence.Variables>\n";
  }

  return `<Sequence DisplayName="${displayName}">\n${varsBlock}  ${childrenXml}\n</Sequence>`;
}

function assembleTryCatchNode(
  node: TryCatchNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  _parentEmissionContext: EmissionContext = "normal",
): string {
  const displayName = escapeXml(node.displayName);
  const tryXml = node.tryChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1))
    .join("\n");

  const catchXml = node.catchChildren.length > 0
    ? node.catchChildren
        .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, "mandatory-catch"))
        .join("\n")
    : `<ui:LogMessage Level="Error" Message="[&quot;Error: &quot; &amp; exception.Message]" DisplayName="Log Exception" />\n<Rethrow DisplayName="Rethrow Exception" />`;

  const finallyXml = node.finallyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, "mandatory-finally"))
    .join("\n");

  let xml = `<TryCatch DisplayName="${displayName}">\n`;
  xml += `  <TryCatch.Try>\n`;
  xml += `    <Sequence DisplayName="Try Block">\n`;
  xml += `      ${tryXml}\n`;
  xml += `    </Sequence>\n`;
  xml += `  </TryCatch.Try>\n`;
  xml += `  <TryCatch.Catches>\n`;
  xml += `    <Catch x:TypeArguments="s:Exception">\n`;
  xml += `      <ActivityAction x:TypeArguments="s:Exception">\n`;
  xml += `        <ActivityAction.Argument>\n`;
  xml += `          <DelegateInArgument x:TypeArguments="s:Exception" Name="exception" />\n`;
  xml += `        </ActivityAction.Argument>\n`;
  xml += `        <Sequence DisplayName="Handle Exception">\n`;
  xml += `          ${catchXml}\n`;
  xml += `        </Sequence>\n`;
  xml += `      </ActivityAction>\n`;
  xml += `    </Catch>\n`;
  xml += `  </TryCatch.Catches>\n`;
  if (finallyXml.trim()) {
    xml += `  <TryCatch.Finally>\n`;
    xml += `    <Sequence DisplayName="Finally Block">\n`;
    xml += `      ${finallyXml}\n`;
    xml += `    </Sequence>\n`;
    xml += `  </TryCatch.Finally>\n`;
  }
  xml += `</TryCatch>`;

  return xml;
}

function resolveConditionValue(condition: string | ValueIntent): string {
  if (isValueIntent(condition)) {
    const built = buildExpression(condition as ValueIntent);
    return built.replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  const trimmed = (condition as string).trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return escapeXml(trimmed);
  if (trimmed === "True" || trimmed === "False") return trimmed;
  if (/[<>=]/.test(trimmed) || /\b(And|Or|Not|AndAlso|OrElse|Is|IsNot|Like)\b/.test(trimmed)) {
    return escapeXml(`[${trimmed}]`);
  }
  return escapeXml(trimmed);
}

function assembleIfNode(
  node: IfNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  emissionContext: EmissionContext = "normal",
): string {
  const displayName = escapeXml(node.displayName);
  const condition = resolveConditionValue(node.condition);

  const thenXml = node.thenChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext))
    .join("\n");

  const elseXml = node.elseChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext))
    .join("\n");

  let xml = `<If Condition="${condition}" DisplayName="${displayName}">\n`;
  xml += `  <If.Then>\n`;
  xml += `    <Sequence DisplayName="Then">\n`;
  xml += `      ${thenXml}\n`;
  xml += `    </Sequence>\n`;
  xml += `  </If.Then>\n`;
  if (elseXml.trim()) {
    xml += `  <If.Else>\n`;
    xml += `    <Sequence DisplayName="Else">\n`;
    xml += `      ${elseXml}\n`;
    xml += `    </Sequence>\n`;
    xml += `  </If.Else>\n`;
  }
  xml += `</If>`;

  return xml;
}

function assembleWhileNode(
  node: WhileNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  emissionContext: EmissionContext = "normal",
): string {
  const displayName = escapeXml(node.displayName);
  const condition = resolveConditionValue(node.condition);

  const bodyXml = node.bodyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext))
    .join("\n");

  return `<While Condition="${condition}" DisplayName="${displayName}">\n` +
    `  <While.Body>\n` +
    `    <Sequence DisplayName="While Body">\n` +
    `      ${bodyXml}\n` +
    `    </Sequence>\n` +
    `  </While.Body>\n` +
    `</While>`;
}

function inferForEachItemType(itemType: string, valuesExpression: string): string {
  if (itemType && itemType !== "x:Object" && itemType !== "x:String") return itemType;
  const expr = valuesExpression.trim().replace(/^\[|\]$/g, "");
  if (/\bdt_\w*\.Rows\b/i.test(expr) || /\.AsEnumerable\(\)/i.test(expr) || /\bDataTable\b.*\.Rows\b/i.test(expr)) {
    return "scg2:DataRow";
  }
  return itemType || "x:Object";
}

function assembleForEachNode(
  node: ForEachNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  emissionContext: EmissionContext = "normal",
): string {
  const displayName = escapeXml(node.displayName);
  const itemType = inferForEachItemType(node.itemType || "x:Object", node.valuesExpression);
  const wrappedValues = ensureBracketWrapped(node.valuesExpression);

  const bodyXml = node.bodyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext))
    .join("\n");

  return `<ForEach x:TypeArguments="${itemType}" Values="${escapeXml(wrappedValues)}" DisplayName="${displayName}">\n` +
    `  <ActivityAction x:TypeArguments="${itemType}">\n` +
    `    <ActivityAction.Argument>\n` +
    `      <DelegateInArgument x:TypeArguments="${itemType}" Name="${escapeXml(node.iteratorName)}" />\n` +
    `    </ActivityAction.Argument>\n` +
    `    <Sequence DisplayName="Body">\n` +
    `      ${bodyXml}\n` +
    `    </Sequence>\n` +
    `  </ActivityAction>\n` +
    `</ForEach>`;
}

function assembleRetryScopeNode(
  node: RetryScopeNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  emissionContext: EmissionContext = "normal",
): string {
  const displayName = escapeXml(node.displayName);

  const bodyXml = node.bodyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext))
    .join("\n");

  return `<ui:RetryScope NumberOfRetries="${node.numberOfRetries}" RetryInterval="${node.retryInterval}" DisplayName="${displayName}">\n` +
    `  <ui:RetryScope.Body>\n` +
    `    <Sequence DisplayName="Retry Body">\n` +
    `      ${bodyXml}\n` +
    `    </Sequence>\n` +
    `  </ui:RetryScope.Body>\n` +
    `  <ui:RetryScope.Condition>\n` +
    `    <ui:ShouldRetry />\n` +
    `  </ui:RetryScope.Condition>\n` +
    `</ui:RetryScope>`;
}

function buildVariablesBlock(variables: VariableDeclaration[]): string {
  if (variables.length === 0) return "";
  let xml = "<Sequence.Variables>\n";
  const seen = new Set<string>();
  for (const v of variables) {
    if (seen.has(v.name)) continue;
    seen.add(v.name);
    const typeAttr = mapClrType(v.type);
    if (v.default) {
      xml += `      <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}" Default="${escapeXml(v.default)}" />\n`;
    } else {
      xml += `      <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}" />\n`;
    }
  }
  xml += "    </Sequence.Variables>";
  return xml;
}

function buildXMembersBlock(
  args: Array<{ name: string; direction: string; type: string }>
): string {
  if (!args || args.length === 0) return "";
  const lines: string[] = [];
  lines.push("  <x:Members>");
  for (const arg of args) {
    const clrType = mapClrType(arg.type);
    const dir = arg.direction || "InArgument";
    lines.push(`    <x:Property Name="${escapeXml(arg.name)}" Type="${dir}(${clrType})" />`);
  }
  lines.push("  </x:Members>");
  return lines.join("\n") + "\n";
}

function collectGetCredentialNodes(node: WorkflowNode): ActivityNode[] {
  const results: ActivityNode[] = [];
  if (node.kind === "activity" && node.template === "GetCredential") {
    results.push(node);
  } else if (node.kind === "sequence") {
    for (const child of node.children) results.push(...collectGetCredentialNodes(child));
  } else if (node.kind === "tryCatch") {
    for (const child of [...node.tryChildren, ...node.catchChildren, ...node.finallyChildren]) results.push(...collectGetCredentialNodes(child));
  } else if (node.kind === "if") {
    for (const child of [...node.thenChildren, ...node.elseChildren]) results.push(...collectGetCredentialNodes(child));
  } else if (node.kind === "while" || node.kind === "forEach" || node.kind === "retryScope") {
    for (const child of node.bodyChildren) results.push(...collectGetCredentialNodes(child));
  }
  return results;
}

function crossCheckGetCredentialVariableTypes(
  rootSequence: { children: WorkflowNode[]; variables?: VariableDeclaration[] },
  allVariables: VariableDeclaration[],
): void {
  const credNodes: ActivityNode[] = [];
  for (const child of rootSequence.children) {
    credNodes.push(...collectGetCredentialNodes(child));
  }

  for (const node of credNodes) {
    const props = node.properties || {};
    const passwordVar = (props.Password as string) || (props.password as string) || "sec_Password";
    const usernameVar = (props.Username as string) || (props.username as string) || "str_Username";

    const pwDecl = allVariables.find(v => v.name === passwordVar);
    if (pwDecl) {
      const mapped = mapClrType(pwDecl.type);
      if (mapped !== "s:Security.SecureString") {
        console.log(`[CrossCheck] Fixing variable ${passwordVar} type from ${pwDecl.type} to SecureString for GetCredential.Password`);
        pwDecl.type = "SecureString";
      }
    } else {
      allVariables.push({ name: passwordVar, type: "SecureString" });
      console.log(`[CrossCheck] Added missing variable ${passwordVar} as SecureString for GetCredential.Password`);
    }

    const unDecl = allVariables.find(v => v.name === usernameVar);
    if (!unDecl) {
      allVariables.push({ name: usernameVar, type: "String" });
      console.log(`[CrossCheck] Added missing variable ${usernameVar} as String for GetCredential.Username`);
    }
  }
}

export function assembleWorkflowFromSpec(
  spec: WorkflowSpec,
  processType: ProcessType = "general",
): { xaml: string; variables: VariableDeclaration[] } {
  const workflowName = (spec.name || "Workflow").replace(/\s+/g, "_");
  const allVariables = [...(spec.variables || [])];

  if (spec.rootSequence.variables) {
    for (const v of spec.rootSequence.variables) {
      if (!allVariables.find(av => av.name === v.name)) {
        allVariables.push(v);
      }
    }
  }

  if (!allVariables.find(v => v.name === "str_ScreenshotPath")) {
    allVariables.push({
      name: "str_ScreenshotPath",
      type: "String",
      default: '"screenshots/error_" & DateTime.Now.ToString("yyyyMMdd_HHmmss") & ".png"',
    });
  }

  crossCheckGetCredentialVariableTypes(spec.rootSequence, allVariables);

  const activitiesXml = spec.rootSequence.children
    .map(child => assembleNode(child, allVariables, processType))
    .join("\n    ");

  const isMainWorkflow = workflowName.toLowerCase() === "main" || workflowName.toLowerCase() === "main.xaml";
  const isInitAllSettings = workflowName.toLowerCase().includes("initallsettings");
  const wfArgs = [...(spec.arguments || [])];
  const hasDictConfigRef = !isMainWorkflow && !isInitAllSettings && activitiesXml.includes("dict_Config");
  if (hasDictConfigRef && !wfArgs.some(a => a.name === "in_Config")) {
    wfArgs.push({ name: "in_Config", direction: "InArgument", type: "scg:Dictionary(x:String, x:Object)" });
  }
  if (hasDictConfigRef && !allVariables.find(v => v.name === "dict_Config")) {
    allVariables.push({ name: "dict_Config", type: "scg:Dictionary(x:String, x:Object)", default: "[in_Config]" });
  }

  const variablesBlock = buildVariablesBlock(allVariables);
  const xMembersBlock = buildXMembersBlock(wfArgs);

  const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeXml(workflowName)}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
${xMembersBlock}  <Sequence DisplayName="${escapeXml(workflowName)}">
    ${variablesBlock}
    ${activitiesXml}
  </Sequence>
</Activity>`;

  return { xaml, variables: allVariables };
}
