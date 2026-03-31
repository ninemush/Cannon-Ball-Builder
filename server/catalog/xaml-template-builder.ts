import { catalogService, type ProcessType, type CatalogActivity, type CatalogProperty, type PaletteEntry } from "./catalog-service";
import { getActivityPrefix } from "../xaml/xaml-compliance";

export interface TemplateEntry {
  name: string;
  category: "activity" | "structural" | "variable" | "workflow-header";
  template: string;
  placeholders: TemplatePlaceholder[];
  requiredProperties: string[];
}

export interface TemplatePlaceholder {
  key: string;
  type: string;
  required: boolean;
  validValues?: string[];
  defaultValue?: string;
}

export interface TemplateBlock {
  processType: ProcessType;
  activityTemplates: TemplateEntry[];
  structuralTemplates: TemplateEntry[];
  variableTemplate: TemplateEntry;
  workflowHeaderTemplate: TemplateEntry;
  templateNames: string[];
}

function clrTypeToPlaceholderType(clrType: string): string {
  const map: Record<string, string> = {
    "System.String": "string",
    "System.Int32": "int",
    "System.Int64": "long",
    "System.Boolean": "bool",
    "System.Double": "double",
    "System.Decimal": "decimal",
    "System.Object": "object",
    "System.DateTime": "datetime",
    "System.TimeSpan": "timespan",
    "System.Data.DataTable": "datatable",
  };
  return map[clrType] || "string";
}

function buildActivityTemplate(activity: CatalogActivity, _packageId: string): TemplateEntry {
  const className = activity.className;
  const prefix = getActivityPrefix(className);
  const tag = prefix ? `${prefix}:${className}` : className;

  const placeholders: TemplatePlaceholder[] = [];
  const requiredProperties: string[] = [];
  const attrParts: string[] = [];
  const childParts: string[] = [];

  attrParts.push(`DisplayName="{{displayName:string}}"`);
  placeholders.push({ key: "displayName", type: "string", required: true });

  for (const prop of activity.properties) {
    const phKey = prop.name.charAt(0).toLowerCase() + prop.name.slice(1);
    const baseType = clrTypeToPlaceholderType(prop.clrType);
    const isEnum = prop.validValues && prop.validValues.length > 0;
    const phType = isEnum ? "enum" : baseType;
    const enumSuffix = isEnum ? `:${prop.validValues!.join("|")}` : "";

    const ph: TemplatePlaceholder = {
      key: phKey,
      type: phType,
      required: prop.required,
      validValues: prop.validValues,
      defaultValue: prop.default,
    };
    placeholders.push(ph);

    if (prop.required) {
      requiredProperties.push(prop.name);
    }

    if (prop.xamlSyntax === "attribute") {
      attrParts.push(`${prop.name}="{{${phKey}:${phType}${enumSuffix}}}"`);
    } else if (prop.xamlSyntax === "child-element") {
      const wrapper = prop.argumentWrapper || "InArgument";
      const typeArg = prop.typeArguments ? ` x:TypeArguments="${prop.typeArguments}"` : "";
      childParts.push(
        `  <${tag}.${prop.name}>\n` +
        `    <${wrapper}${typeArg}>{{${phKey}:${phType}${enumSuffix}}}</${wrapper}>\n` +
        `  </${tag}.${prop.name}>`
      );
    }
  }

  let template: string;
  if (childParts.length === 0) {
    template = `<${tag} ${attrParts.join(" ")} />`;
  } else {
    template =
      `<${tag} ${attrParts.join(" ")}>\n` +
      childParts.join("\n") + "\n" +
      `</${tag}>`;
  }

  return {
    name: className,
    category: "activity",
    template,
    placeholders,
    requiredProperties,
  };
}

function buildAssignTemplate(): TemplateEntry {
  return {
    name: "Assign",
    category: "activity",
    template:
      `<Assign DisplayName="{{displayName:string}}">\n` +
      `  <Assign.To>\n` +
      `    <OutArgument x:TypeArguments="{{toType:type}}">[{{toVariable:string}}]</OutArgument>\n` +
      `  </Assign.To>\n` +
      `  <Assign.Value>\n` +
      `    <InArgument x:TypeArguments="{{valueType:type}}">{{valueExpression:expression}}</InArgument>\n` +
      `  </Assign.Value>\n` +
      `</Assign>`,
    placeholders: [
      { key: "displayName", type: "string", required: true },
      { key: "toType", type: "type", required: true, validValues: ["x:String", "x:Int32", "x:Boolean", "x:Object", "x:Double", "x:Decimal", "s:DateTime", "scg2:DataTable"] },
      { key: "toVariable", type: "string", required: true },
      { key: "valueType", type: "type", required: true },
      { key: "valueExpression", type: "expression", required: true },
    ],
    requiredProperties: ["To", "Value"],
  };
}

function buildLogMessageTemplate(): TemplateEntry {
  return {
    name: "LogMessage",
    category: "activity",
    template: `<ui:LogMessage Level="{{level:enum:Info|Warn|Error|Fatal|Trace}}" Message="{{message:expression}}" DisplayName="{{displayName:string}}" />`,
    placeholders: [
      { key: "displayName", type: "string", required: true },
      { key: "level", type: "enum", required: true, validValues: ["Info", "Warn", "Error", "Fatal", "Trace"], defaultValue: "Info" },
      { key: "message", type: "expression", required: true },
    ],
    requiredProperties: ["Level", "Message"],
  };
}

function buildDelayTemplate(): TemplateEntry {
  return {
    name: "Delay",
    category: "activity",
    template: `<Delay Duration="{{duration:timespan}}" DisplayName="{{displayName:string}}" />`,
    placeholders: [
      { key: "displayName", type: "string", required: true },
      { key: "duration", type: "timespan", required: true },
    ],
    requiredProperties: ["Duration"],
  };
}

function buildRethrowTemplate(): TemplateEntry {
  return {
    name: "Rethrow",
    category: "activity",
    template: `<Rethrow DisplayName="{{displayName:string}}" />`,
    placeholders: [
      { key: "displayName", type: "string", required: true },
    ],
    requiredProperties: [],
  };
}

function buildInvokeWorkflowFileTemplate(): TemplateEntry {
  return {
    name: "InvokeWorkflowFile",
    category: "activity",
    template:
      `<ui:InvokeWorkflowFile WorkflowFileName="{{workflowFileName:string}}" DisplayName="{{displayName:string}}">\n` +
      `  <ui:InvokeWorkflowFile.Arguments>\n` +
      `    <!-- Add InArgument/OutArgument entries here -->\n` +
      `  </ui:InvokeWorkflowFile.Arguments>\n` +
      `</ui:InvokeWorkflowFile>`,
    placeholders: [
      { key: "displayName", type: "string", required: true },
      { key: "workflowFileName", type: "string", required: true },
    ],
    requiredProperties: ["WorkflowFileName"],
  };
}

function buildRetryScopeTemplate(): TemplateEntry {
  return {
    name: "RetryScope",
    category: "activity",
    template:
      `<ui:RetryScope NumberOfRetries="{{numberOfRetries:int}}" RetryInterval="{{retryInterval:timespan}}" DisplayName="{{displayName:string}}">\n` +
      `  <ui:RetryScope.Condition>\n` +
      `    <ui:ShouldRetry />\n` +
      `  </ui:RetryScope.Condition>\n` +
      `  <Sequence DisplayName="Retry Body">\n` +
      `    <!-- Activities to retry go here -->\n` +
      `  </Sequence>\n` +
      `</ui:RetryScope>`,
    placeholders: [
      { key: "displayName", type: "string", required: true },
      { key: "numberOfRetries", type: "int", required: false, defaultValue: "3" },
      { key: "retryInterval", type: "timespan", required: false, defaultValue: "00:00:05" },
    ],
    requiredProperties: [],
  };
}

function buildTryCatchTemplate(): TemplateEntry {
  return {
    name: "TryCatch",
    category: "structural",
    template:
      `<TryCatch DisplayName="{{displayName:string}}">\n` +
      `  <TryCatch.Try>\n` +
      `    <Sequence DisplayName="Try Block">\n` +
      `      <!-- Protected activities go here -->\n` +
      `    </Sequence>\n` +
      `  </TryCatch.Try>\n` +
      `  <TryCatch.Catches>\n` +
      `    <Catch x:TypeArguments="s:Exception">\n` +
      `      <ActivityAction x:TypeArguments="s:Exception">\n` +
      `        <ActivityAction.Argument>\n` +
      `          <DelegateInArgument x:TypeArguments="s:Exception" Name="exception" />\n` +
      `        </ActivityAction.Argument>\n` +
      `        <Sequence DisplayName="Handle Exception">\n` +
      `          <ui:LogMessage Level="Error" Message="[&quot;Error: &quot; &amp; exception.Message]" DisplayName="Log Exception" />\n` +
      `          <Rethrow DisplayName="Rethrow Exception" />\n` +
      `        </Sequence>\n` +
      `      </ActivityAction>\n` +
      `    </Catch>\n` +
      `  </TryCatch.Catches>\n` +
      `  <TryCatch.Finally>\n` +
      `    <Sequence DisplayName="Finally Block">\n` +
      `      <!-- Cleanup activities go here -->\n` +
      `    </Sequence>\n` +
      `  </TryCatch.Finally>\n` +
      `</TryCatch>`,
    placeholders: [
      { key: "displayName", type: "string", required: true },
    ],
    requiredProperties: [],
  };
}

function buildIfThenElseTemplate(): TemplateEntry {
  return {
    name: "IfThenElse",
    category: "structural",
    template:
      `<If Condition="{{condition:expression}}" DisplayName="{{displayName:string}}">\n` +
      `  <If.Then>\n` +
      `    <Sequence DisplayName="Then">\n` +
      `      <!-- Then activities go here -->\n` +
      `    </Sequence>\n` +
      `  </If.Then>\n` +
      `  <If.Else>\n` +
      `    <Sequence DisplayName="Else">\n` +
      `      <!-- Else activities go here -->\n` +
      `    </Sequence>\n` +
      `  </If.Else>\n` +
      `</If>`,
    placeholders: [
      { key: "displayName", type: "string", required: true },
      { key: "condition", type: "expression", required: true },
    ],
    requiredProperties: ["Condition"],
  };
}

function buildVariableDeclarationTemplate(): TemplateEntry {
  return {
    name: "VariableDeclaration",
    category: "variable",
    template: `<Variable x:TypeArguments="{{variableType:type}}" Name="{{variableName:string}}" Default="{{defaultValue:expression}}" />`,
    placeholders: [
      { key: "variableType", type: "type", required: true, validValues: ["x:String", "x:Int32", "x:Int64", "x:Boolean", "x:Double", "x:Decimal", "x:Object", "s:DateTime", "s:TimeSpan", "scg2:DataTable", "scg2:DataRow"] },
      { key: "variableName", type: "string", required: true },
      { key: "defaultValue", type: "expression", required: false },
    ],
    requiredProperties: ["Name"],
  };
}

function buildWorkflowHeaderTemplate(): TemplateEntry {
  return {
    name: "WorkflowHeader",
    category: "workflow-header",
    template:
      `<Activity mc:Ignorable="sap sap2010"\n` +
      `  x:Class="{{workflowName:string}}"\n` +
      `  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"\n` +
      `  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"\n` +
      `  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"\n` +
      `  xmlns:s="clr-namespace:System;assembly=mscorlib"\n` +
      `  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"\n` +
      `  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"\n` +
      `  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"\n` +
      `  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"\n` +
      `  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"\n` +
      `  xmlns:ui="http://schemas.uipath.com/workflow/activities"\n` +
      `  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">\n` +
      `  <Sequence DisplayName="{{displayName:string}}">\n` +
      `    <Sequence.Variables>\n` +
      `      <!-- Variable declarations go here -->\n` +
      `    </Sequence.Variables>\n` +
      `    <!-- Workflow activities go here -->\n` +
      `  </Sequence>\n` +
      `</Activity>`,
    placeholders: [
      { key: "workflowName", type: "string", required: true },
      { key: "displayName", type: "string", required: true },
    ],
    requiredProperties: [],
  };
}

const HARDCODED_TEMPLATE_NAMES = new Set([
  "Assign", "LogMessage", "Delay", "Rethrow", "InvokeWorkflowFile",
  "RetryScope", "TryCatch", "IfThenElse", "VariableDeclaration", "WorkflowHeader",
]);

export function buildTemplateBlock(processType: ProcessType, wideMode: boolean = true): TemplateBlock {
  const activityTemplates: TemplateEntry[] = [];

  activityTemplates.push(buildAssignTemplate());
  activityTemplates.push(buildLogMessageTemplate());
  activityTemplates.push(buildDelayTemplate());
  activityTemplates.push(buildRethrowTemplate());
  activityTemplates.push(buildInvokeWorkflowFileTemplate());
  activityTemplates.push(buildRetryScopeTemplate());

  if (catalogService.isLoaded()) {
    const palette = wideMode
      ? catalogService.buildWidePalette()
      : catalogService.buildActivityPalette(processType);
    for (const entry of palette) {
      if (HARDCODED_TEMPLATE_NAMES.has(entry.className)) continue;

      const schema = catalogService.getActivitySchema(entry.className);
      if (!schema) continue;

      activityTemplates.push(buildActivityTemplate(schema.activity, schema.packageId));
    }
  }

  const structuralTemplates: TemplateEntry[] = [
    buildTryCatchTemplate(),
    buildIfThenElseTemplate(),
  ];

  const variableTemplate = buildVariableDeclarationTemplate();
  const workflowHeaderTemplate = buildWorkflowHeaderTemplate();

  const templateNames = [
    ...activityTemplates.map(t => t.name),
    ...structuralTemplates.map(t => t.name),
    variableTemplate.name,
    workflowHeaderTemplate.name,
  ];

  return {
    processType,
    activityTemplates,
    structuralTemplates,
    variableTemplate,
    workflowHeaderTemplate,
    templateNames,
  };
}

export function formatTemplateBlockForPrompt(block: TemplateBlock): string {
  const lines: string[] = [
    `=== ACTIVITY TEMPLATES (processType: ${block.processType}) ===`,
    "",
    "You MUST use ONLY these templates to generate XAML. Fill in the {{placeholder:type}} values.",
    "Do NOT invent XAML syntax. Do NOT add attributes not present in the template.",
    "Enum placeholders ({{name:enum}}) MUST use one of the listed validValues — any other value is a GENERATION FAILURE.",
    "",
    "--- Activity Templates ---",
    "",
  ];

  for (const t of block.activityTemplates) {
    lines.push(`## ${t.name}`);
    if (t.requiredProperties.length > 0) {
      lines.push(`Required properties: ${t.requiredProperties.join(", ")}`);
    }
    const enumPhs = t.placeholders.filter(p => p.validValues && p.validValues.length > 0);
    if (enumPhs.length > 0) {
      for (const ph of enumPhs) {
        lines.push(`  ${ph.key} valid values: ${ph.validValues!.join(" | ")}`);
      }
    }
    lines.push("```xml");
    lines.push(t.template);
    lines.push("```");
    lines.push("");
  }

  lines.push("--- Structural Templates ---");
  lines.push("");

  for (const t of block.structuralTemplates) {
    lines.push(`## ${t.name}`);
    lines.push("```xml");
    lines.push(t.template);
    lines.push("```");
    lines.push("");
  }

  lines.push("--- Variable Declaration Template ---");
  lines.push("");
  lines.push("```xml");
  lines.push(block.variableTemplate.template);
  lines.push("```");

  const varPh = block.variableTemplate.placeholders.find(p => p.key === "variableType");
  if (varPh?.validValues) {
    lines.push(`variableType valid values: ${varPh.validValues.join(" | ")}`);
  }
  lines.push("");

  lines.push("--- Workflow Header Template ---");
  lines.push("");
  lines.push("```xml");
  lines.push(block.workflowHeaderTemplate.template);
  lines.push("```");
  lines.push("");

  lines.push(`Available template names: ${block.templateNames.join(", ")}`);

  return lines.join("\n");
}

const COMPACT_TOKEN_THRESHOLD = 60;

export function formatCompactTemplateBlockForPrompt(block: TemplateBlock): string {
  const lines: string[] = [
    `=== ACTIVITY CATALOG (processType: ${block.processType}, compact) ===`,
    "",
    "Use ONLY these activities. Enum values MUST match exactly.",
    "",
  ];

  for (const t of block.activityTemplates) {
    const reqStr = t.requiredProperties.length > 0 ? ` [required: ${t.requiredProperties.join(", ")}]` : "";
    const enumPhs = t.placeholders.filter(p => p.validValues && p.validValues.length > 0);
    const enumStr = enumPhs.length > 0
      ? " | " + enumPhs.map(p => `${p.key}: ${p.validValues!.join("|")}`).join("; ")
      : "";
    lines.push(`- ${t.name}${reqStr}${enumStr}`);
  }

  lines.push("");
  lines.push("--- Structural ---");
  for (const t of block.structuralTemplates) {
    const reqStr = t.requiredProperties.length > 0 ? ` [required: ${t.requiredProperties.join(", ")}]` : "";
    lines.push(`- ${t.name}${reqStr}`);
  }

  return lines.join("\n");
}

export function buildCompactCatalogSummary(): string {
  if (!catalogService.isLoaded()) {
    return "";
  }

  const palette = catalogService.buildWidePalette();
  if (palette.length === 0) return "";

  const byPackage: Record<string, PaletteEntry[]> = {};
  for (const entry of palette) {
    if (!byPackage[entry.packageId]) {
      byPackage[entry.packageId] = [];
    }
    byPackage[entry.packageId].push(entry);
  }

  const lines: string[] = [
    "=== AVAILABLE ACTIVITIES (catalog summary) ===",
    "",
  ];

  for (const packageId of Object.keys(byPackage)) {
    const entries = byPackage[packageId];
    lines.push(`## ${packageId}`);
    for (const entry of entries) {
      const requiredProps = entry.properties.filter((p: PaletteEntry["properties"][0]) => p.required && p.direction !== "Out");
      const enumProps = entry.properties.filter((p: PaletteEntry["properties"][0]) => p.validValues && p.validValues.length > 0);

      let line = `- ${entry.className}`;
      if (requiredProps.length > 0) {
        line += ` [required: ${requiredProps.map((p: PaletteEntry["properties"][0]) => p.name).join(", ")}]`;
      }
      if (enumProps.length > 0) {
        const enumParts = enumProps.map((p: PaletteEntry["properties"][0]) => `${p.name}: ${p.validValues!.join("|")}`);
        line += ` | enums: ${enumParts.join("; ")}`;
      }
      lines.push(line);
    }
    lines.push("");
  }

  const builtInActivities = [
    "- Assign [required: To, Value]",
    "- If [required: Condition]",
    "- ForEach [required: Values]",
    "- While [required: Condition]",
    "- TryCatch",
    "- RetryScope [required: NumberOfRetries]",
    "- InvokeWorkflowFile [required: WorkflowFileName]",
    "- LogMessage [required: Message] | enums: Level: Trace|Info|Warn|Error|Fatal",
    "- Delay [required: Duration]",
  ];

  lines.push("## Built-in Activities");
  lines.push(...builtInActivities);
  lines.push("");

  return lines.join("\n");
}

export function shouldUseCompactFormat(block: TemplateBlock): boolean {
  return block.activityTemplates.length > COMPACT_TOKEN_THRESHOLD;
}

export interface TemplateComplianceResult {
  score: number;
  totalActivities: number;
  compliantActivities: number;
  violations: TemplateComplianceViolation[];
}

export interface TemplateComplianceViolation {
  activityTag: string;
  line: number;
  issue: string;
  severity: "error" | "warning";
}

function extractActivitySubtree(xamlContent: string, openTagStart: number, tag: string, isSelfClosing: boolean): string {
  if (isSelfClosing) {
    const end = xamlContent.indexOf("/>", openTagStart);
    return end >= 0 ? xamlContent.substring(openTagStart, end + 2) : "";
  }

  const baseTag = tag.replace(/^ui:/, "");
  let depth = 1;
  const openEnd = xamlContent.indexOf(">", openTagStart);
  if (openEnd < 0) return "";

  let pos = openEnd + 1;
  while (depth > 0 && pos < xamlContent.length) {
    const nextOpen = xamlContent.indexOf(`<${tag}`, pos);
    const nextOpenBase = tag.startsWith("ui:") ? -1 : xamlContent.indexOf(`<${baseTag}`, pos);
    const nextClose = xamlContent.indexOf(`</${tag}>`, pos);
    const nextCloseBase = tag.startsWith("ui:") ? -1 : xamlContent.indexOf(`</${baseTag}>`, pos);

    const candidates: number[] = [];
    if (nextClose >= 0) candidates.push(nextClose);
    if (nextCloseBase >= 0) candidates.push(nextCloseBase);
    if (candidates.length === 0) break;

    const nearestClose = Math.min(...candidates);
    const isCloseTag = (n: number) => n >= 0 && n < nearestClose;

    if (isCloseTag(nextOpen)) {
      const afterOpen = xamlContent.indexOf(">", nextOpen);
      if (afterOpen >= 0 && xamlContent[afterOpen - 1] !== "/") depth++;
      pos = afterOpen >= 0 ? afterOpen + 1 : pos + 1;
    } else if (isCloseTag(nextOpenBase)) {
      const afterOpen = xamlContent.indexOf(">", nextOpenBase);
      if (afterOpen >= 0 && xamlContent[afterOpen - 1] !== "/") depth++;
      pos = afterOpen >= 0 ? afterOpen + 1 : pos + 1;
    } else {
      depth--;
      if (depth === 0) {
        const closeEnd = nearestClose + `</${tag}>`.length;
        return xamlContent.substring(openTagStart, closeEnd);
      }
      pos = nearestClose + 1;
    }
  }

  return xamlContent.substring(openTagStart, Math.min(openTagStart + 2000, xamlContent.length));
}

export function calculateTemplateCompliance(
  xamlContent: string,
): TemplateComplianceResult {
  const violations: TemplateComplianceViolation[] = [];
  let totalActivities = 0;
  let compliantActivities = 0;

  const activityPattern = /<(ui:[A-Za-z]+|Assign|If|TryCatch|Delay|Rethrow|Throw)\s+([^>]*?)(\/?)>/g;
  let match;

  while ((match = activityPattern.exec(xamlContent)) !== null) {
    const tag = match[1];
    const attrBlock = match[2];
    const isSelfClosing = match[3] === "/";
    const lineNum = xamlContent.substring(0, match.index).split("\n").length;

    totalActivities++;

    const schema = catalogService.getActivitySchema(tag);
    if (!schema) {
      continue;
    }

    let isCompliant = true;
    const subtree = extractActivitySubtree(xamlContent, match.index, tag, isSelfClosing);

    const attrPattern = /(\w[\w:.]*)\s*=\s*"([^"]*)"/g;
    let attrMatch;
    const foundAttrs: Record<string, string> = {};
    while ((attrMatch = attrPattern.exec(attrBlock)) !== null) {
      foundAttrs[attrMatch[1]] = attrMatch[2];
    }

    const FRAMEWORK_ATTRS = new Set([
      "DisplayName", "ContinueOnError", "sap2010:WorkflowViewState.IdRef",
      "sap:VirtualizedContainerService.HintSize", "sap2010:Annotation.AnnotationText",
      "WorkflowViewState.IdRef", "VirtualizedContainerService.HintSize",
      "Annotation.AnnotationText", "Timeout", "DelayAfter", "DelayBefore",
      "mc:Ignorable", "x:Class", "x:TypeArguments", "x:Name",
    ]);

    for (const [attrName, attrValue] of Object.entries(foundAttrs)) {
      if (attrName.startsWith("xmlns")) continue;
      if (FRAMEWORK_ATTRS.has(attrName)) continue;

      const prop = schema.activity.properties.find(p => p.name === attrName);
      if (!prop) {
        violations.push({
          activityTag: tag,
          line: lineNum,
          issue: `Unrecognized attribute "${attrName}" not in catalog schema`,
          severity: "warning",
        });
        isCompliant = false;
        continue;
      }

      if (prop.xamlSyntax === "child-element") {
        violations.push({
          activityTag: tag,
          line: lineNum,
          issue: `Property "${attrName}" should be a child element, not an attribute`,
          severity: "error",
        });
        isCompliant = false;
      }

      if (prop.validValues && prop.validValues.length > 0 && attrValue) {
        if (!prop.validValues.includes(attrValue)) {
          violations.push({
            activityTag: tag,
            line: lineNum,
            issue: `Invalid enum value "${attrValue}" for "${attrName}" — valid values: ${prop.validValues.join(", ")}`,
            severity: "error",
          });
          isCompliant = false;
        }
      }
    }

    for (const prop of schema.activity.properties) {
      if (prop.required && !foundAttrs[prop.name]) {
        const childTag = `${tag.replace(/^ui:/, "")}.${prop.name}`;
        const fullChildTag = `${tag}.${prop.name}`;
        if (!subtree.includes(`<${childTag}`) && !subtree.includes(`<${fullChildTag}`)) {
          violations.push({
            activityTag: tag,
            line: lineNum,
            issue: `Missing required property "${prop.name}"`,
            severity: "error",
          });
          isCompliant = false;
        }
      }
    }

    const nestedArgPattern = /(<InArgument[^>]*>)\s*<InArgument|(<OutArgument[^>]*>)\s*<OutArgument/;
    if (nestedArgPattern.test(subtree)) {
      violations.push({
        activityTag: tag,
        line: lineNum,
        issue: "Double-wrapped argument detected (nested InArgument/OutArgument)",
        severity: "error",
      });
      isCompliant = false;
    }

    if (isCompliant) {
      compliantActivities++;
    }
  }

  const score = totalActivities > 0 ? compliantActivities / totalActivities : 1.0;

  return {
    score: Math.round(score * 100) / 100,
    totalActivities,
    compliantActivities,
    violations,
  };
}
