import type { WorkflowNode, ActivityNode, PropertyValue } from "./workflow-spec-types";
import { isValueIntent, type ValueIntent } from "./xaml/expression-builder";
import { isBlockedSentinel } from "./types/uipath-package";

export interface NormalizedIRShape {
  kind: "scalar" | "invoke_binding" | "typed_child_element" | "type_argument" | "blocked";
  originalShape: string;
  normalizedValue: string | InvokeBindingIR[];
  blockedReason?: string;
}

export interface InvokeBindingIR {
  name: string;
  direction: "InArgument" | "OutArgument" | "InOutArgument";
  type: string;
  value: string;
}

export interface InvokeBindingEntry {
  direction: string;
  type: string;
  value: string;
}

export type InvokeBindingMap = Record<string, InvokeBindingEntry>;

export interface NormalizationDiagnostic {
  workflowName: string;
  activityDisplayName: string;
  activityTemplate: string;
  propertyName: string;
  originalShape: string;
  normalizedShape: string;
  blockedReason?: string;
}

let _normalizationDiagnostics: NormalizationDiagnostic[] = [];

export function getAndClearNormalizationDiagnostics(): NormalizationDiagnostic[] {
  const diags = _normalizationDiagnostics;
  _normalizationDiagnostics = [];
  return diags;
}

export function getNormalizationDiagnostics(): ReadonlyArray<NormalizationDiagnostic> {
  return _normalizationDiagnostics;
}

function emitDiagnostic(
  workflowName: string,
  activityDisplayName: string,
  activityTemplate: string,
  propertyName: string,
  originalShape: string,
  normalizedShape: string,
  blockedReason?: string,
): void {
  _normalizationDiagnostics.push({
    workflowName,
    activityDisplayName,
    activityTemplate,
    propertyName,
    originalShape,
    normalizedShape,
    blockedReason,
  });
  if (blockedReason) {
    console.warn(`[Spec-IR Normalizer] BLOCKED ${workflowName}/${activityDisplayName}.${propertyName}: ${blockedReason} (original: ${originalShape.substring(0, 120)})`);
  } else {
    console.log(`[Spec-IR Normalizer] Normalized ${workflowName}/${activityDisplayName}.${propertyName}: ${originalShape} → ${normalizedShape}`);
  }
}

const SCALAR_REQUIRED_PROPERTIES = new Set([
  "WorkflowFileName",
  "Message",
  "AssetName",
  "EntityType",
  "QueueName",
  "FileName",
  "Text",
  "Level",
  "ProcessName",
  "Path",
]);

const STRUCTURED_OBJECT_PREFIX = "__STRUCTURED_OBJECT__";

function isStructuredObjectSentinel(val: unknown): boolean {
  return typeof val === "string" && val.startsWith(STRUCTURED_OBJECT_PREFIX);
}

function isContaminatedTypeValue(val: string): boolean {
  if (val.startsWith(STRUCTURED_OBJECT_PREFIX)) return true;
  if (val.startsWith("OBJECT_SERIALIZED:")) return true;
  if (val.startsWith("{") || val.startsWith("[")) return true;
  return false;
}

function sanitizeTypeValue(val: string | undefined, fallback: string = "x:Object"): string {
  if (!val || val.trim() === "") return fallback;
  if (isContaminatedTypeValue(val)) return fallback;
  return val;
}

function resolveToPlainScalar(val: PropertyValue): string | null {
  if (typeof val === "string") {
    if (val.startsWith(STRUCTURED_OBJECT_PREFIX)) {
      return null;
    }
    if (isBlockedSentinel(val)) {
      return null;
    }
    return val;
  }
  if (typeof val === "object" && val !== null && isValueIntent(val)) {
    const intent = val as ValueIntent;
    let resolved: string | undefined;
    switch (intent.type) {
      case "literal":
        resolved = intent.value;
        break;
      case "variable":
        resolved = intent.name;
        break;
      case "vb_expression":
        resolved = intent.value;
        break;
      case "expression":
        resolved = `${intent.left} ${intent.operator} ${intent.right}`;
        break;
      case "url_with_params":
        resolved = intent.baseUrl;
        break;
      default:
        return null;
    }
    if (resolved !== undefined && isBlockedSentinel(resolved)) {
      return null;
    }
    return resolved ?? null;
  }
  return null;
}

function resolveUnknownToScalar(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return resolveToPlainScalar(val);
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (isValueIntent(val)) {
      return resolveToPlainScalar(val as PropertyValue);
    }
    if (typeof obj.type === "string") {
      let resolved: string | undefined;
      if ((obj.type === "literal" || obj.type === "vb_expression") && typeof obj.value === "string") {
        resolved = obj.value;
      } else if (obj.type === "variable" && typeof obj.name === "string") {
        resolved = obj.name;
      } else if (obj.type === "expression" && typeof obj.left === "string" && typeof obj.operator === "string" && typeof obj.right === "string") {
        resolved = `${obj.left} ${obj.operator} ${obj.right}`;
      } else if (obj.type === "url_with_params" && typeof obj.baseUrl === "string") {
        resolved = obj.baseUrl;
      }
      if (resolved !== undefined) {
        if (isBlockedSentinel(resolved)) {
          return null;
        }
        return resolved;
      }
    }
  }
  return null;
}

function inferDirectionFromKey(key: string): "InArgument" | "OutArgument" | "InOutArgument" {
  const lower = key.toLowerCase();
  if (lower.startsWith("out_")) return "OutArgument";
  if (lower.startsWith("io_")) return "InOutArgument";
  return "InArgument";
}

function inferTypeFromValue(value: string): string {
  const trimmed = value.replace(/^\[|\]$/g, "").trim();
  if (/^(str_|string_)/i.test(trimmed)) return "x:String";
  if (/^(int_|int32_)/i.test(trimmed)) return "x:Int32";
  if (/^(bool_)/i.test(trimmed)) return "x:Boolean";
  if (/^(dt_|datatable_)/i.test(trimmed)) return "scg2:DataTable";
  if (/^(drow_)/i.test(trimmed)) return "scg2:DataRow";
  if (/^(obj_)/i.test(trimmed)) return "x:Object";
  if (/^(dbl_)/i.test(trimmed)) return "x:Double";
  if (/^(dec_)/i.test(trimmed)) return "x:Decimal";
  if (/^(ts_)/i.test(trimmed)) return "s:TimeSpan";
  if (/^(qi_)/i.test(trimmed)) return "ui:QueueItem";
  if (/^(sec_)/i.test(trimmed)) return "ss:SecureString";
  if (/^(dict_)/i.test(trimmed)) return "scg:Dictionary(x:String, x:Object)";
  if (/^(list_|arr_)/i.test(trimmed)) return "scg:List(x:Object)";
  return "x:Object";
}

function isAlreadyNormalizedBindings(val: unknown): boolean {
  if (typeof val !== "object" || val === null || Array.isArray(val)) return false;
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  return keys.every(k => {
    const entry = obj[k];
    if (typeof entry !== "object" || entry === null) return false;
    const e = entry as Record<string, unknown>;
    return (
      typeof e.direction === "string" &&
      (e.direction === "InArgument" || e.direction === "OutArgument" || e.direction === "InOutArgument") &&
      (typeof e.value === "string" || typeof e.value === "undefined") &&
      (typeof e.type === "string" || typeof e.type === "undefined")
    );
  });
}

function parseVbDictionaryToBindings(
  vbExpr: string,
  directionDefault: "InArgument" | "OutArgument",
): InvokeBindingIR[] | null {
  const pairPattern = /\{\s*"([^"]+)"\s*,\s*([^}]+)\s*\}/g;
  const bindings: InvokeBindingIR[] = [];
  let match: RegExpExecArray | null;
  while ((match = pairPattern.exec(vbExpr)) !== null) {
    const name = match[1];
    const value = match[2].trim();
    // Task #530: upstream filter — never let a VB-keyword / null-literal /
    // empty / whitespace key flow through into a binding. Such keys would
    // emerge from the normalizer as `x:Key="Nothing"` etc. and trigger the
    // contract validator's `unknown_target_argument` defect class. We log
    // and drop the malformed pair here so the downstream emission-time
    // guard can still apply Step-1/2/3 if other entries also fail.
    const trimmed = name.trim();
    if (!trimmed || /^(Nothing|True|False|Me|MyBase|MyClass|null|undefined)$/i.test(trimmed)) {
      console.warn(
        `[VB Dictionary Parser] Dropping malformed binding key=${JSON.stringify(name)} ` +
          `value=${JSON.stringify(value)} — would have produced an invalid x:Key in XAML.`,
      );
      continue;
    }
    bindings.push({
      name: trimmed,
      direction: inferDirectionFromKey(trimmed) === "OutArgument" ? "OutArgument" : directionDefault,
      type: inferTypeFromValue(value),
      value,
    });
  }
  return bindings.length > 0 ? bindings : null;
}

function bindingsToMap(bindings: InvokeBindingIR[]): InvokeBindingMap {
  const map: InvokeBindingMap = {};
  for (const b of bindings) {
    map[b.name] = { direction: b.direction, type: b.type, value: b.value };
  }
  return map;
}

type NormalizeArgResult =
  | { kind: "bindings"; bindings: InvokeBindingIR[] }
  | { kind: "blocked" }
  | { kind: "opaque"; resolvedValue: string }
  | { kind: "none" };

function normalizeInvokeArgumentDictionary(
  val: unknown,
  directionDefault: "InArgument" | "OutArgument",
  propertyName: string,
  workflowName: string,
  displayName: string,
  template: string,
): NormalizeArgResult {
  if (val === null || val === undefined) return { kind: "none" };

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith(STRUCTURED_OBJECT_PREFIX)) {
      try {
        const jsonStr = trimmed.slice(STRUCTURED_OBJECT_PREFIX.length);
        const parsed = JSON.parse(jsonStr);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          return normalizeInvokeArgumentDictionary(parsed, directionDefault, propertyName, workflowName, displayName, template);
        }
      } catch {
        emitDiagnostic(workflowName, displayName, template, propertyName,
          `__STRUCTURED_OBJECT__ string (unparseable)`, "blocked",
          `Cannot parse structured object sentinel for invoke arguments`);
        return { kind: "none" };
      }
    }

    if (/^New\s+Dictionary/i.test(trimmed) || /Dictionary\s*\(\s*Of/i.test(trimmed)) {
      const parsed = parseVbDictionaryToBindings(trimmed, directionDefault);
      if (parsed && parsed.length > 0) {
        return { kind: "bindings", bindings: parsed };
      }
      emitDiagnostic(workflowName, displayName, template, propertyName,
        `VB Dictionary expression (no pairs extracted)`, "skipped",
        `Invoke argument is a VB Dictionary expression but no key-value pairs could be extracted`);
      return { kind: "none" };
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return normalizeInvokeArgumentDictionary(parsed, directionDefault, propertyName, workflowName, displayName, template);
      }
    } catch {
      emitDiagnostic(workflowName, displayName, template, propertyName,
        `opaque string (non-JSON, non-VB)`, "blocked",
        `Cannot normalize opaque string invoke argument: "${trimmed.substring(0, 60)}"`);
      return { kind: "none" };
    }
    return { kind: "none" };
  }

  if (typeof val !== "object" || Array.isArray(val)) return { kind: "none" };
  const obj = val as Record<string, unknown>;

  if (typeof obj.type === "string" && !isAlreadyNormalizedBindings(obj)) {
    const resolved = resolveUnknownToScalar(val);
    if (resolved === null) {
      emitDiagnostic(workflowName, displayName, template, propertyName,
        `ValueIntent-like(${obj.type}) → blocked/null`, "blocked",
        `Top-level ValueIntent-like object in invoke arguments blocked (unresolvable or structurally unusable)`);
      return { kind: "blocked" };
    }
    if (isBlockedSentinel(resolved)) {
      emitDiagnostic(workflowName, displayName, template, propertyName,
        `ValueIntent-like(${obj.type}) → blocked sentinel`, "blocked",
        `Top-level ValueIntent-like object in invoke arguments contains blocked sentinel`);
      return { kind: "blocked" };
    }
    if (/^New\s+Dictionary/i.test(resolved) || /Dictionary\s*\(\s*Of/i.test(resolved)) {
      const parsed = parseVbDictionaryToBindings(resolved, directionDefault);
      if (parsed && parsed.length > 0) {
        return { kind: "bindings", bindings: parsed };
      }
      emitDiagnostic(workflowName, displayName, template, propertyName,
        `ValueIntent → VB Dictionary (no pairs extracted)`, "blocked",
        `ValueIntent resolved to VB Dictionary expression but no key-value pairs could be extracted`);
      return { kind: "blocked" };
    }
    try {
      const parsed = JSON.parse(resolved);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return normalizeInvokeArgumentDictionary(parsed, directionDefault, propertyName, workflowName, displayName, template);
      }
    } catch {
    }
    emitDiagnostic(workflowName, displayName, template, propertyName,
      `ValueIntent-like(${obj.type}) → opaque scalar`, "preserved-opaque",
      `Top-level ValueIntent-like object resolved to opaque scalar value: "${resolved.substring(0, 60)}"`);
    return { kind: "opaque", resolvedValue: resolved };
  }

  if (isAlreadyNormalizedBindings(obj)) {
    const bindings: InvokeBindingIR[] = [];
    for (const [name, entry] of Object.entries(obj)) {
      const e = entry as Record<string, unknown>;
      const rawType = typeof e.type === "string" ? e.type : "";
      bindings.push({
        name,
        direction: e.direction as "InArgument" | "OutArgument" | "InOutArgument",
        type: sanitizeTypeValue(rawType),
        value: typeof e.value === "string" ? e.value : "",
      });
    }
    return { kind: "bindings", bindings };
  }

  const bindings: InvokeBindingIR[] = [];
  for (const [key, entryVal] of Object.entries(obj)) {
    if (typeof entryVal === "object" && entryVal !== null) {
      const entry = entryVal as Record<string, unknown>;
      if (typeof entry.direction === "string") {
        const dir = entry.direction as string;
        const mappedDir = dir === "In" || dir === "InArgument" ? "InArgument"
          : dir === "Out" || dir === "OutArgument" ? "OutArgument"
          : dir === "InOut" || dir === "InOutArgument" ? "InOutArgument"
          : directionDefault;
        const argValue = resolveUnknownToScalar(entry.value) ?? "";
        const rawArgType = typeof entry.type === "string" ? entry.type : inferTypeFromValue(argValue);
        const argType = sanitizeTypeValue(rawArgType);
        if (argType !== rawArgType) {
          emitDiagnostic(workflowName, displayName, template, `${propertyName}.${key}.type`,
            rawArgType, "blocked → x:Object",
            `Blocked contaminated type value in invoke argument "${key}"`);
        }
        bindings.push({ name: key, direction: mappedDir, type: argType, value: argValue });
        continue;
      }
      const scalarResolved = resolveUnknownToScalar(entryVal);
      if (scalarResolved !== null) {
        bindings.push({
          name: key,
          direction: inferDirectionFromKey(key) === "OutArgument" ? "OutArgument" : directionDefault,
          type: inferTypeFromValue(scalarResolved),
          value: scalarResolved,
        });
        continue;
      }
      emitDiagnostic(workflowName, displayName, template, `${propertyName}.${key}`,
        `unresolvable object: ${JSON.stringify(entryVal).substring(0, 80)}`, "blocked",
        `Cannot resolve invoke argument "${key}" to scalar value`);
      continue;
    }
    const scalarVal = resolveUnknownToScalar(entryVal);
    if (scalarVal !== null) {
      bindings.push({
        name: key,
        direction: inferDirectionFromKey(key) === "OutArgument" ? "OutArgument" : directionDefault,
        type: inferTypeFromValue(scalarVal),
        value: scalarVal,
      });
    } else if (entryVal !== null && entryVal !== undefined) {
      bindings.push({
        name: key,
        direction: directionDefault,
        type: "x:Object",
        value: String(entryVal),
      });
    }
  }
  return bindings.length > 0 ? { kind: "bindings", bindings } : { kind: "none" };
}

function normalizeTypeArgument(
  val: PropertyValue,
  propertyName: string,
  workflowName: string,
  displayName: string,
  template: string,
): string {
  if (typeof val === "string") {
    if (val.startsWith(STRUCTURED_OBJECT_PREFIX)) {
      emitDiagnostic(workflowName, displayName, template, propertyName,
        `__STRUCTURED_OBJECT__ sentinel`, "x:Object (blocked contamination)",
        `Structured-object sentinel blocked from type argument context`);
      return "x:Object";
    }
    if (isContaminatedTypeValue(val)) {
      emitDiagnostic(workflowName, displayName, template, propertyName,
        `structured contamination: ${val.substring(0, 60)}`, "x:Object (blocked contamination)",
        `Structured data blocked from type argument context`);
      return "x:Object";
    }
    return val;
  }
  if (typeof val === "object" && val !== null && isValueIntent(val)) {
    const resolved = resolveToPlainScalar(val);
    if (resolved !== null) {
      if (isContaminatedTypeValue(resolved)) {
        emitDiagnostic(workflowName, displayName, template, propertyName,
          `ValueIntent resolving to structured data`, "x:Object (blocked contamination)",
          `ValueIntent resolved to structured data in type argument context`);
        return "x:Object";
      }
      return resolved;
    }
  }
  return "x:Object";
}

function normalizeScalarProperty(
  val: PropertyValue,
  propertyName: string,
  workflowName: string,
  displayName: string,
  template: string,
): PropertyValue {
  if (typeof val === "string") {
    if (val.startsWith(STRUCTURED_OBJECT_PREFIX)) {
      emitDiagnostic(workflowName, displayName, template, propertyName,
        `__STRUCTURED_OBJECT__ sentinel`, "blocked",
        `Structured-object sentinel in scalar-required property "${propertyName}"`);
      return "";
    }
    if (val.startsWith("OBJECT_SERIALIZED:")) {
      emitDiagnostic(workflowName, displayName, template, propertyName,
        `OBJECT_SERIALIZED prefix`, "blocked",
        `Serialized object in scalar-required property "${propertyName}"`);
      return "";
    }
    return val;
  }
  if (typeof val === "object" && val !== null) {
    const resolved = resolveToPlainScalar(val);
    if (resolved !== null) {
      emitDiagnostic(workflowName, displayName, template, propertyName,
        `ValueIntent(${(val as ValueIntent).type})`, `scalar: ${resolved.substring(0, 60)}`);
      return resolved;
    }
    emitDiagnostic(workflowName, displayName, template, propertyName,
      `unresolvable structured object`, "blocked",
      `Cannot resolve structured value to scalar for property "${propertyName}"`);
    return "";
  }
  return val;
}

export function normalizeActivityNodeForGenerator(
  node: ActivityNode,
  workflowName: string,
): ActivityNode {
  const template = node.template.includes(":")
    ? node.template.split(":").pop()!
    : node.template;
  const displayName = node.displayName;
  const props = { ...node.properties };
  let modified = false;

  if (template === "InvokeWorkflowFile") {
    const mergedBindings: InvokeBindingMap = {};
    let anyBindingsNormalized = false;

    const convertedInput = props["_convertedInputArgs"];
    if (typeof convertedInput === "string" && convertedInput.trim() !== "") {
      const parsed = parseVbDictionaryToBindings(convertedInput, "InArgument");
      if (parsed && parsed.length > 0) {
        Object.assign(mergedBindings, bindingsToMap(parsed));
        anyBindingsNormalized = true;
        emitDiagnostic(workflowName, displayName, template, "_convertedInputArgs",
          `VB Dictionary expression (${parsed.length} entries)`,
          `bridged to explicit named bindings (${parsed.length} entries)`);
        delete props["_convertedInputArgs"];
      } else {
        emitDiagnostic(workflowName, displayName, template, "_convertedInputArgs",
          `unconvertible string`, "preserved",
          `Could not parse _convertedInputArgs — preserving original for fallback handling`);
      }
    }

    const convertedOutput = props["_convertedOutputArgs"];
    if (typeof convertedOutput === "string" && convertedOutput.trim() !== "") {
      const parsed = parseVbDictionaryToBindings(convertedOutput, "OutArgument");
      if (parsed && parsed.length > 0) {
        Object.assign(mergedBindings, bindingsToMap(parsed));
        anyBindingsNormalized = true;
        emitDiagnostic(workflowName, displayName, template, "_convertedOutputArgs",
          `VB Dictionary expression (${parsed.length} entries)`,
          `bridged to explicit named bindings (Out direction, ${parsed.length} entries)`);
        delete props["_convertedOutputArgs"];
      } else {
        emitDiagnostic(workflowName, displayName, template, "_convertedOutputArgs",
          `unconvertible string`, "preserved",
          `Could not parse _convertedOutputArgs — preserving original for fallback handling`);
      }
    }

    const argKeys = ["Arguments", "arguments"];
    for (const argKey of argKeys) {
      const rawVal = props[argKey];
      if (rawVal === undefined || rawVal === null) continue;
      if (typeof rawVal === "string" && rawVal.trim() === "") continue;

      const result = normalizeInvokeArgumentDictionary(
        rawVal, "InArgument", argKey, workflowName, displayName, template,
      );
      if (result.kind === "blocked") {
        delete props[argKey];
        modified = true;
      } else if (result.kind === "opaque") {
        props[argKey] = result.resolvedValue;
        modified = true;
      } else if (result.kind === "bindings" && result.bindings.length > 0) {
        Object.assign(mergedBindings, bindingsToMap(result.bindings));
        anyBindingsNormalized = true;
        emitDiagnostic(workflowName, displayName, template, argKey,
          `dictionary/object (${result.bindings.length} entries)`,
          `explicit named bindings (${result.bindings.length} entries)`);
      }
    }

    const outArgKeys = ["OutputArguments", "outputArguments"];
    for (const outKey of outArgKeys) {
      const rawVal = props[outKey];
      if (rawVal === undefined || rawVal === null) continue;
      if (typeof rawVal === "string" && rawVal.trim() === "") continue;

      const result = normalizeInvokeArgumentDictionary(
        rawVal, "OutArgument", outKey, workflowName, displayName, template,
      );
      if (result.kind === "blocked") {
        delete props[outKey];
        modified = true;
      } else if (result.kind === "opaque") {
        props[outKey] = result.resolvedValue;
        modified = true;
      } else if (result.kind === "bindings" && result.bindings.length > 0) {
        Object.assign(mergedBindings, bindingsToMap(result.bindings));
        anyBindingsNormalized = true;
        emitDiagnostic(workflowName, displayName, template, outKey,
          `dictionary/object (${result.bindings.length} entries)`,
          `merged into Arguments as Out-direction bindings (${result.bindings.length} entries)`);
        delete props[outKey];
      } else {
        emitDiagnostic(workflowName, displayName, template, outKey,
          `unconvertible OutputArguments`, "preserved",
          `Could not normalize ${outKey} — preserving original for fallback handling`);
      }
    }

    if (anyBindingsNormalized && Object.keys(mergedBindings).length > 0) {
      (props as Record<string, unknown>)["Arguments"] = mergedBindings;
      delete props["arguments"];
      modified = true;
    }
  }

  for (const propName of SCALAR_REQUIRED_PROPERTIES) {
    if (propName in props) {
      const val = props[propName];
      if (typeof val !== "string" || val.startsWith(STRUCTURED_OBJECT_PREFIX) || val.startsWith("OBJECT_SERIALIZED:")) {
        const normalized = normalizeScalarProperty(val, propName, workflowName, displayName, template);
        if (normalized !== val) {
          props[propName] = normalized;
          modified = true;
        }
      }
    }
  }

  const typeArgKeys = ["TypeArgument", "typeArgument", "x:TypeArguments"];
  for (const typeKey of typeArgKeys) {
    if (typeKey in props) {
      const val = props[typeKey];
      if (val !== undefined && val !== null) {
        const normalized = normalizeTypeArgument(val, typeKey, workflowName, displayName, template);
        if (normalized !== val) {
          props[typeKey] = normalized;
          modified = true;
        }
      }
    }
  }

  for (const [key, val] of Object.entries(props)) {
    if (SCALAR_REQUIRED_PROPERTIES.has(key)) continue;
    if (typeArgKeys.includes(key)) continue;
    if (key.startsWith("_converted")) continue;

    if (typeof val === "object" && val !== null && !isValueIntent(val)) {
      const obj = val as Record<string, unknown>;
      if (typeof obj.type === "string" && ["literal", "variable", "vb_expression", "expression", "url_with_params"].includes(obj.type)) {
        const resolved = resolveUnknownToScalar(val);
        if (resolved !== null) {
          props[key] = resolved;
          modified = true;
          emitDiagnostic(workflowName, displayName, template, key,
            `untyped ValueIntent-like object`, `scalar: ${resolved.substring(0, 60)}`);
        }
      }
    }
  }

  if (!modified) return node;

  return {
    ...node,
    properties: props,
  };
}

export function normalizeWorkflowTreeForGenerators(
  rootNode: WorkflowNode,
  workflowName: string,
): WorkflowNode {
  return normalizeNodeRecursive(rootNode, workflowName);
}

function normalizeNodeRecursive(node: WorkflowNode, workflowName: string): WorkflowNode {
  switch (node.kind) {
    case "activity":
      return normalizeActivityNodeForGenerator(node, workflowName);
    case "sequence":
      return {
        ...node,
        children: node.children.map(c => normalizeNodeRecursive(c, workflowName)),
      };
    case "tryCatch":
      return {
        ...node,
        tryChildren: node.tryChildren.map(c => normalizeNodeRecursive(c, workflowName)),
        catchChildren: node.catchChildren.map(c => normalizeNodeRecursive(c, workflowName)),
        finallyChildren: node.finallyChildren.map(c => normalizeNodeRecursive(c, workflowName)),
      };
    case "if": {
      let condition = node.condition;
      if (typeof condition === "object" && condition !== null && isValueIntent(condition)) {
        const resolved = resolveToPlainScalar(condition);
        if (resolved !== null) {
          condition = resolved;
        }
      }
      return {
        ...node,
        condition,
        thenChildren: node.thenChildren.map(c => normalizeNodeRecursive(c, workflowName)),
        elseChildren: node.elseChildren.map(c => normalizeNodeRecursive(c, workflowName)),
      };
    }
    case "while": {
      let condition = node.condition;
      if (typeof condition === "object" && condition !== null && isValueIntent(condition)) {
        const resolved = resolveToPlainScalar(condition);
        if (resolved !== null) {
          condition = resolved;
        }
      }
      return {
        ...node,
        condition,
        bodyChildren: node.bodyChildren.map(c => normalizeNodeRecursive(c, workflowName)),
      };
    }
    case "forEach": {
      let itemType = node.itemType;
      if (typeof itemType === "string") {
        if (isStructuredObjectSentinel(itemType)) {
          emitDiagnostic(workflowName, node.displayName, "ForEach", "itemType",
            `__STRUCTURED_OBJECT__ sentinel`, "blocked",
            `Blocked structured-object sentinel from ForEach.itemType`);
          itemType = "x:Object";
        } else if (itemType.startsWith("OBJECT_SERIALIZED:")) {
          emitDiagnostic(workflowName, node.displayName, "ForEach", "itemType",
            `OBJECT_SERIALIZED prefix`, "blocked",
            `Blocked OBJECT_SERIALIZED prefix from ForEach.itemType`);
          itemType = "x:Object";
        }
      }
      return {
        ...node,
        itemType,
        bodyChildren: node.bodyChildren.map(c => normalizeNodeRecursive(c, workflowName)),
      };
    }
    case "retryScope":
      return {
        ...node,
        bodyChildren: node.bodyChildren.map(c => normalizeNodeRecursive(c, workflowName)),
      };
    default:
      return node;
  }
}
