import { catalogService } from "../catalog/catalog-service";
import type { QualityGateViolation } from "../uipath-quality-gate";

export interface TypeMismatchResult {
  violations: QualityGateViolation[];
  repairs: TypeRepairAction[];
  correctedEntries: { name: string; content: string }[];
}

export interface TypeRepairAction {
  file: string;
  line: number;
  activity: string;
  property: string;
  expectedType: string;
  actualType: string;
  repairKind: "conversion-wrap" | "variable-type-change" | "unrepairable";
  boundVariable: string;
  detail: string;
}

const CLR_SHORT_TO_FULL: Record<string, string> = {
  "x:String": "System.String",
  "x:Int32": "System.Int32",
  "x:Int64": "System.Int64",
  "x:Boolean": "System.Boolean",
  "x:Double": "System.Double",
  "x:Decimal": "System.Decimal",
  "x:Object": "System.Object",
  "s:DateTime": "System.DateTime",
  "s:TimeSpan": "System.TimeSpan",
  "scg2:DataTable": "System.Data.DataTable",
  "scg2:DataRow": "System.Data.DataRow",
  "s:Exception": "System.Exception",
  "s:SecureString": "System.Security.SecureString",
  "s:Security.SecureString": "System.Security.SecureString",
  "s:Net.Mail.MailMessage": "System.Net.Mail.MailMessage",
  "ui:QueueItem": "UiPath.Core.QueueItem",
  "ui:QueueItemData": "UiPath.Core.QueueItemData",
  "String": "System.String",
  "Int32": "System.Int32",
  "Int64": "System.Int64",
  "Boolean": "System.Boolean",
  "Double": "System.Double",
  "Decimal": "System.Decimal",
  "Object": "System.Object",
  "DateTime": "System.DateTime",
  "TimeSpan": "System.TimeSpan",
  "DataTable": "System.Data.DataTable",
  "DataRow": "System.Data.DataRow",
};

function normalizeClrType(typeStr: string): string {
  if (CLR_SHORT_TO_FULL[typeStr]) return CLR_SHORT_TO_FULL[typeStr];
  return typeStr;
}

const IMPLICIT_COMPATIBLE: [string, string][] = [
  ["System.Int32", "System.Int64"],
  ["System.Int32", "System.Double"],
  ["System.Int32", "System.Decimal"],
  ["System.Int64", "System.Double"],
  ["System.Int64", "System.Decimal"],
  ["System.Single", "System.Double"],
];

export function areTypesCompatible(sourceType: string, targetType: string): boolean {
  const src = normalizeClrType(sourceType);
  const tgt = normalizeClrType(targetType);

  if (src === tgt) return true;

  if (tgt === "System.Object") return true;

  if (src === "System.Object") return false;

  for (const [from, to] of IMPLICIT_COMPATIBLE) {
    if (src === from && tgt === to) return true;
  }

  if (tgt.includes("IEnumerable") && (src.includes("List") || src.includes("Array") || src === "System.Data.DataTable")) {
    return true;
  }

  if (src === "UiPath.Core.QueueItem" && tgt === "UiPath.Core.QueueItemData") return true;

  return false;
}

export type ConversionKind = "wrap" | "variable-type-change" | "unrepairable";

export interface ConversionInfo {
  kind: ConversionKind;
  wrapper?: string;
  newType?: string;
  detail: string;
}

const CONVERSION_MAP: Record<string, Record<string, ConversionInfo>> = {
  "System.String": {
    "System.Int32": { kind: "wrap", wrapper: "CInt", detail: "Wrap in CInt([var]) to convert String→Int32" },
    "System.Int64": { kind: "wrap", wrapper: "CLng", detail: "Wrap in CLng([var]) to convert String→Int64" },
    "System.Double": { kind: "wrap", wrapper: "CDbl", detail: "Wrap in CDbl([var]) to convert String→Double" },
    "System.Decimal": { kind: "wrap", wrapper: "CDec", detail: "Wrap in CDec([var]) to convert String→Decimal" },
    "System.Boolean": { kind: "wrap", wrapper: "CBool", detail: "Wrap in CBool([var]) to convert String→Boolean" },
    "System.DateTime": { kind: "wrap", wrapper: "DateTime.Parse", detail: "Wrap in DateTime.Parse([var]) to convert String→DateTime" },
    "System.Data.DataTable": { kind: "unrepairable", detail: "Cannot convert String to DataTable — requires structural change (e.g., use Read Range or Build Data Table)" },
    "System.Data.DataRow": { kind: "unrepairable", detail: "Cannot convert String to DataRow — requires structural change" },
    "System.Security.SecureString": { kind: "unrepairable", detail: "Cannot convert String to SecureString inline — use GetSecureCredential or New System.Net.NetworkCredential(\"\", [var]).SecurePassword" },
  },
  "System.Int32": {
    "System.String": { kind: "wrap", wrapper: "CStr", detail: "Wrap in CStr([var]) to convert Int32→String" },
    "System.Boolean": { kind: "wrap", wrapper: "CBool", detail: "Wrap in CBool([var]) to convert Int32→Boolean" },
  },
  "System.Int64": {
    "System.String": { kind: "wrap", wrapper: "CStr", detail: "Wrap in CStr([var]) to convert Int64→String" },
    "System.Int32": { kind: "wrap", wrapper: "CInt", detail: "Wrap in CInt([var]) to convert Int64→Int32 (may overflow)" },
  },
  "System.Double": {
    "System.String": { kind: "wrap", wrapper: "CStr", detail: "Wrap in CStr([var]) to convert Double→String" },
    "System.Int32": { kind: "wrap", wrapper: "CInt", detail: "Wrap in CInt([var]) to convert Double→Int32 (truncates)" },
    "System.Decimal": { kind: "wrap", wrapper: "CDec", detail: "Wrap in CDec([var]) to convert Double→Decimal" },
  },
  "System.Decimal": {
    "System.String": { kind: "wrap", wrapper: "CStr", detail: "Wrap in CStr([var]) to convert Decimal→String" },
    "System.Int32": { kind: "wrap", wrapper: "CInt", detail: "Wrap in CInt([var]) to convert Decimal→Int32 (truncates)" },
    "System.Double": { kind: "wrap", wrapper: "CDbl", detail: "Wrap in CDbl([var]) to convert Decimal→Double" },
  },
  "System.Boolean": {
    "System.String": { kind: "wrap", wrapper: "CStr", detail: "Wrap in CStr([var]) to convert Boolean→String" },
    "System.Int32": { kind: "wrap", wrapper: "CInt", detail: "Wrap in CInt([var]) to convert Boolean→Int32" },
  },
  "System.DateTime": {
    "System.String": { kind: "wrap", wrapper: ".ToString(\"yyyy-MM-dd\")", detail: "Append .ToString(\"yyyy-MM-dd\") to convert DateTime→String" },
    "System.Int32": { kind: "unrepairable", detail: "Cannot convert DateTime to Int32 directly" },
  },
  "System.Data.DataTable": {
    "System.String": { kind: "unrepairable", detail: "Cannot convert DataTable to String — use DataTable.Rows.Count.ToString or serialize via JsonConvert" },
    "System.Int32": { kind: "unrepairable", detail: "Cannot convert DataTable to Int32 — use DataTable.Rows.Count for row count" },
  },
};

export function getConversion(sourceType: string, targetType: string): ConversionInfo | null {
  const src = normalizeClrType(sourceType);
  const tgt = normalizeClrType(targetType);

  if (src === tgt || areTypesCompatible(src, tgt)) return null;

  const srcConversions = CONVERSION_MAP[src];
  if (srcConversions && srcConversions[tgt]) {
    return srcConversions[tgt];
  }

  return {
    kind: "unrepairable",
    detail: `No known conversion from ${src} to ${tgt} — review the variable type or activity property`,
  };
}

interface VariableInfo {
  name: string;
  type: string;
  fullClrType: string;
  line: number;
}

interface PropertyBinding {
  activityTag: string;
  propertyName: string;
  boundVariable: string;
  direction: "In" | "Out" | "InOut" | "None";
  expectedClrType: string;
  line: number;
  matchStart: number;
  matchEnd: number;
}

function extractVariableDeclarations(xamlContent: string): VariableInfo[] {
  const results: VariableInfo[] = [];
  const patterns = [
    /<Variable\s+x:TypeArguments="([^"]+)"\s+Name="([^"]+)"/g,
    /<Variable\s+Name="([^"]+)"\s+x:TypeArguments="([^"]+)"/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(xamlContent)) !== null) {
      const typeArg = pattern === patterns[0] ? match[1] : match[2];
      const name = pattern === patterns[0] ? match[2] : match[1];
      const line = xamlContent.substring(0, match.index).split("\n").length;
      const existing = results.find(r => r.name === name);
      if (!existing) {
        results.push({
          name,
          type: typeArg,
          fullClrType: normalizeClrType(typeArg),
          line,
        });
      }
    }
  }

  return results;
}

function extractPropertyBindings(
  xamlContent: string,
  fileName: string,
): PropertyBinding[] {
  const bindings: PropertyBinding[] = [];

  const activityPattern = /<((?:ui:|uweb:|uds:|upers:|uexcel:|umail:|udb:|uml:|uocr:)?[A-Z][A-Za-z]+)\s([^>]*?)(?:\/>|>)/g;
  let actMatch;
  while ((actMatch = activityPattern.exec(xamlContent)) !== null) {
    const activityTag = actMatch[1];
    const attrBlock = actMatch[2];
    const line = xamlContent.substring(0, actMatch.index).split("\n").length;

    const schema = catalogService.getActivitySchema(activityTag);
    if (!schema) continue;

    for (const prop of schema.activity.properties) {
      const attrPattern = new RegExp(`${prop.name}="\\[([^\\]]+)\\]"`, "g");
      let attrMatch;
      while ((attrMatch = attrPattern.exec(attrBlock)) !== null) {
        const varRef = attrMatch[1].trim();
        if (varRef.includes("(") || varRef.includes("+") || varRef.includes("&") || varRef.includes(".") || varRef.includes(" ")) {
          continue;
        }
        const attrBlockOffset = actMatch[0].indexOf(attrBlock);
        const absStart = actMatch.index + attrBlockOffset + attrMatch.index;
        const absEnd = absStart + attrMatch[0].length;
        bindings.push({
          activityTag,
          propertyName: prop.name,
          boundVariable: varRef,
          direction: prop.direction,
          expectedClrType: prop.clrType,
          line,
          matchStart: absStart,
          matchEnd: absEnd,
        });
      }
    }
  }

  const childPropPattern = /<([A-Za-z:]+)\.(\w+)>\s*<(In|Out|InOut)Argument[^>]*>\s*\[([^\]]+)\]\s*<\/\3Argument>\s*<\/\1\.\2>/g;
  let childMatch;
  while ((childMatch = childPropPattern.exec(xamlContent)) !== null) {
    const activityTag = childMatch[1];
    const propName = childMatch[2];
    const argDir = childMatch[3];
    const varRef = childMatch[4].trim();
    const line = xamlContent.substring(0, childMatch.index).split("\n").length;

    if (varRef.includes("(") || varRef.includes("+") || varRef.includes("&") || varRef.includes(" ")) {
      continue;
    }

    const schema = catalogService.getActivitySchema(activityTag);
    if (!schema) continue;

    const prop = schema.activity.properties.find(p => p.name === propName);
    if (!prop) continue;

    const existing = bindings.find(b =>
      b.activityTag === activityTag &&
      b.propertyName === propName &&
      b.boundVariable === varRef &&
      Math.abs(b.line - line) <= 5
    );
    if (!existing) {
      bindings.push({
        activityTag,
        propertyName: propName,
        boundVariable: varRef,
        direction: prop.direction,
        expectedClrType: prop.clrType,
        line,
        matchStart: childMatch.index,
        matchEnd: childMatch.index + childMatch[0].length,
      });
    }
  }

  return bindings;
}

function applyConversionWrapAtPosition(
  xamlContent: string,
  varName: string,
  wrapper: string,
  matchStart: number,
  matchEnd: number,
): string {
  const wrapExpr = wrapper.startsWith(".")
    ? `${varName}${wrapper}`
    : `${wrapper}(${varName})`;

  const segment = xamlContent.substring(matchStart, matchEnd);
  const replaced = segment.replace(`[${varName}]`, `[${wrapExpr}]`);

  return xamlContent.substring(0, matchStart) + replaced + xamlContent.substring(matchEnd);
}

function changeVariableType(
  xamlContent: string,
  varName: string,
  newTypeArg: string,
): string {
  const varEscaped = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const pattern1 = new RegExp(
    `(<Variable\\s+x:TypeArguments=")[^"]+("\\s+Name="${varEscaped}")`,
    "g"
  );
  xamlContent = xamlContent.replace(pattern1, `$1${newTypeArg}$2`);

  const pattern2 = new RegExp(
    `(<Variable\\s+Name="${varEscaped}"\\s+x:TypeArguments=")[^"]+(")`,
    "g"
  );
  xamlContent = xamlContent.replace(pattern2, `$1${newTypeArg}$2`);

  return xamlContent;
}

function clrTypeToXamlTypeArg(clrType: string): string {
  const reverseMap: Record<string, string> = {
    "System.String": "x:String",
    "System.Int32": "x:Int32",
    "System.Int64": "x:Int64",
    "System.Boolean": "x:Boolean",
    "System.Double": "x:Double",
    "System.Decimal": "x:Decimal",
    "System.Object": "x:Object",
    "System.DateTime": "s:DateTime",
    "System.TimeSpan": "s:TimeSpan",
    "System.Data.DataTable": "scg2:DataTable",
    "System.Data.DataRow": "scg2:DataRow",
    "System.Exception": "s:Exception",
    "System.Security.SecureString": "s:SecureString",
    "UiPath.Core.QueueItem": "ui:QueueItem",
    "UiPath.Core.QueueItemData": "ui:QueueItemData",
  };
  return reverseMap[clrType] || clrType;
}

export function validateTypeCompatibility(
  xamlEntries: { name: string; content: string }[],
): TypeMismatchResult {
  const violations: QualityGateViolation[] = [];
  const repairs: TypeRepairAction[] = [];
  const correctedEntries: { name: string; content: string }[] = [];

  if (!catalogService.isLoaded()) {
    return { violations, repairs, correctedEntries };
  }

  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    let patchedContent = entry.content;
    let changed = false;
    const MAX_PASSES = 3;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const variables = extractVariableDeclarations(patchedContent);
      const bindings = extractPropertyBindings(patchedContent, shortName);

      const varMap = new Map<string, VariableInfo>();
      for (const v of variables) {
        varMap.set(v.name, v);
      }

      let madeChangesThisPass = false;

      if (pass === 0) {
        for (const binding of bindings) {
          if (binding.direction !== "Out" && binding.direction !== "InOut") continue;
          const varInfo = varMap.get(binding.boundVariable);
          if (!varInfo) continue;

          if (areTypesCompatible(varInfo.fullClrType, normalizeClrType(binding.expectedClrType))) continue;

          const targetTypeArg = clrTypeToXamlTypeArg(normalizeClrType(binding.expectedClrType));
          const oldType = varInfo.type;
          const oldClrType = varInfo.fullClrType;
          patchedContent = changeVariableType(patchedContent, binding.boundVariable, targetTypeArg);
          changed = true;
          madeChangesThisPass = true;

          repairs.push({
            file: shortName,
            line: binding.line,
            activity: binding.activityTag,
            property: binding.propertyName,
            expectedType: binding.expectedClrType,
            actualType: oldClrType,
            repairKind: "variable-type-change",
            boundVariable: binding.boundVariable,
            detail: `Changed variable "${binding.boundVariable}" type from ${oldType} to ${targetTypeArg} to match ${binding.activityTag}.${binding.propertyName} output type`,
          });

          violations.push({
            category: "accuracy",
            severity: "warning",
            check: "TYPE_MISMATCH",
            file: shortName,
            detail: `Line ${binding.line}: Auto-repaired — changed variable "${binding.boundVariable}" type from ${oldType} to ${targetTypeArg} to match ${binding.activityTag}.${binding.propertyName} (${binding.expectedClrType})`,
          });
        }
      }

      const refreshedVars = extractVariableDeclarations(patchedContent);
      const refreshedVarMap = new Map<string, VariableInfo>();
      for (const v of refreshedVars) {
        refreshedVarMap.set(v.name, v);
      }

      const refreshedBindings = pass === 0 && madeChangesThisPass
        ? extractPropertyBindings(patchedContent, shortName)
        : bindings;

      interface PendingWrap {
        binding: PropertyBinding;
        conversion: ConversionInfo;
        varInfo: VariableInfo;
      }
      const pendingWraps: PendingWrap[] = [];

      for (const binding of refreshedBindings) {
        if (binding.direction === "Out" || binding.direction === "InOut") continue;
        const varInfo = refreshedVarMap.get(binding.boundVariable);
        if (!varInfo) continue;

        if (areTypesCompatible(varInfo.fullClrType, normalizeClrType(binding.expectedClrType))) continue;

        const conversion = getConversion(varInfo.fullClrType, normalizeClrType(binding.expectedClrType));
        if (!conversion) continue;

        const alreadyRepaired = repairs.some(r =>
          r.file === shortName &&
          r.property === binding.propertyName &&
          r.boundVariable === binding.boundVariable &&
          r.activity === binding.activityTag
        );
        if (alreadyRepaired) continue;

        if (conversion.kind === "wrap" && conversion.wrapper) {
          pendingWraps.push({ binding, conversion, varInfo });
        } else {
          repairs.push({
            file: shortName,
            line: binding.line,
            activity: binding.activityTag,
            property: binding.propertyName,
            expectedType: binding.expectedClrType,
            actualType: varInfo.fullClrType,
            repairKind: "unrepairable",
            boundVariable: binding.boundVariable,
            detail: conversion.detail,
          });

          violations.push({
            category: "accuracy",
            severity: "warning",
            check: "TYPE_MISMATCH",
            file: shortName,
            detail: `Line ${binding.line}: Type mismatch — variable "${binding.boundVariable}" (${varInfo.fullClrType}) bound to ${binding.activityTag}.${binding.propertyName} (expects ${binding.expectedClrType}). ${conversion.detail}`,
          });
        }
      }

      pendingWraps.sort((a, b) => b.binding.matchStart - a.binding.matchStart);
      for (const { binding, conversion, varInfo } of pendingWraps) {
        patchedContent = applyConversionWrapAtPosition(
          patchedContent,
          binding.boundVariable,
          conversion.wrapper!,
          binding.matchStart,
          binding.matchEnd,
        );
        changed = true;
        madeChangesThisPass = true;

        repairs.push({
          file: shortName,
          line: binding.line,
          activity: binding.activityTag,
          property: binding.propertyName,
          expectedType: binding.expectedClrType,
          actualType: varInfo.fullClrType,
          repairKind: "conversion-wrap",
          boundVariable: binding.boundVariable,
          detail: conversion.detail.replace("[var]", binding.boundVariable),
        });

        violations.push({
          category: "accuracy",
          severity: "warning",
          check: "TYPE_MISMATCH",
          file: shortName,
          detail: `Line ${binding.line}: Auto-repaired — ${conversion.detail.replace("[var]", binding.boundVariable)} for ${binding.activityTag}.${binding.propertyName}`,
        });
      }

      if (!madeChangesThisPass) break;
    }

    if (changed) {
      correctedEntries.push({ name: entry.name, content: patchedContent });
    }
  }

  return { violations, repairs, correctedEntries };
}
