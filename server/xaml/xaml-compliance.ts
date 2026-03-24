import { escapeXml } from "../lib/xml-utils";
import { ACTIVITY_NAME_ALIAS_MAP } from "../uipath-activity-registry";
import { catalogService } from "../catalog/catalog-service";
import { XMLValidator } from "fast-xml-parser";
import { QualityGateError } from "../uipath-shared";

export type TargetFramework = "Windows" | "Portable";

export interface PackageNamespaceInfo {
  prefix: string;
  xmlns: string;
  assembly: string;
  clrNamespace: string;
}

export const PACKAGE_NAMESPACE_MAP: Record<string, PackageNamespaceInfo> = {
  "UiPath.UIAutomation.Activities": { prefix: "ui", xmlns: "http://schemas.uipath.com/workflow/activities", clrNamespace: "UiPath.Core.Activities", assembly: "UiPath.UIAutomation.Activities" },
  "UiPath.System.Activities": { prefix: "ui", xmlns: "http://schemas.uipath.com/workflow/activities", clrNamespace: "UiPath.Core.Activities", assembly: "UiPath.System.Activities" },
  "UiPath.Web.Activities": { prefix: "uweb", xmlns: "clr-namespace:UiPath.Web.Activities;assembly=UiPath.Web.Activities", clrNamespace: "UiPath.Web.Activities", assembly: "UiPath.Web.Activities" },
  "UiPath.DataService.Activities": { prefix: "uds", xmlns: "clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities", clrNamespace: "UiPath.DataService.Activities", assembly: "UiPath.DataService.Activities" },
  "UiPath.Persistence.Activities": { prefix: "upers", xmlns: "clr-namespace:UiPath.Persistence.Activities;assembly=UiPath.Persistence.Activities", clrNamespace: "UiPath.Persistence.Activities", assembly: "UiPath.Persistence.Activities" },
  "UiPath.Excel.Activities": { prefix: "uexcel", xmlns: "clr-namespace:UiPath.Excel.Activities;assembly=UiPath.Excel.Activities", clrNamespace: "UiPath.Excel.Activities", assembly: "UiPath.Excel.Activities" },
  "UiPath.Mail.Activities": { prefix: "umail", xmlns: "clr-namespace:UiPath.Mail.Activities;assembly=UiPath.Mail.Activities", clrNamespace: "UiPath.Mail.Activities", assembly: "UiPath.Mail.Activities" },
  "UiPath.Database.Activities": { prefix: "udb", xmlns: "clr-namespace:UiPath.Database.Activities;assembly=UiPath.Database.Activities", clrNamespace: "UiPath.Database.Activities", assembly: "UiPath.Database.Activities" },
  "UiPath.MLActivities": { prefix: "uml", xmlns: "clr-namespace:UiPath.MLActivities;assembly=UiPath.MLActivities", clrNamespace: "UiPath.MLActivities", assembly: "UiPath.MLActivities" },
  "UiPath.IntelligentOCR.Activities": { prefix: "uocr", xmlns: "clr-namespace:UiPath.IntelligentOCR.Activities;assembly=UiPath.IntelligentOCR.Activities", clrNamespace: "UiPath.IntelligentOCR.Activities", assembly: "UiPath.IntelligentOCR.Activities" },
  "System.Activities": { prefix: "", xmlns: "http://schemas.microsoft.com/netfx/2009/xaml/activities", clrNamespace: "System.Activities", assembly: "System.Activities" },
};

const SYSTEM_ACTIVITIES_NO_PREFIX = new Set([
  "Assign", "If", "TryCatch", "Sequence", "Delay", "Throw", "While", "DoWhile",
  "ForEach", "Flowchart", "FlowStep", "FlowDecision", "FlowSwitch", "Switch",
  "AddToCollection", "RemoveFromCollection", "ClearCollection", "ExistsInCollection",
  "Catch", "Rethrow",
]);

export function getActivityPrefix(templateName: string): string {
  const result = getActivityPrefixStrict(templateName);
  if (result !== null) return result;

  throw new Error(`[XAML Compliance] getActivityPrefix("${templateName}"): no namespace mapping found — activity is unmapped. Add it to GUARANTEED_ACTIVITY_PREFIX_MAP or the activity catalog.`);
}

const GUARANTEED_ACTIVITY_PREFIX_MAP: Record<string, string> = {
  "LogMessage": "ui", "Comment": "ui", "InvokeWorkflowFile": "ui",
  "RetryScope": "ui", "ShouldRetry": "ui", "GetAsset": "ui", "GetCredential": "ui",
  "AddQueueItem": "ui", "GetTransactionItem": "ui", "SetTransactionStatus": "ui",
  "TakeScreenshot": "ui", "AddLogFields": "ui", "ReadTextFile": "ui", "WriteTextFile": "ui", "PathExists": "ui",
  "Click": "ui", "TypeInto": "ui", "GetText": "ui", "ElementExists": "ui",
  "OpenBrowser": "ui", "NavigateTo": "ui", "AttachBrowser": "ui", "AttachWindow": "ui",
  "UseApplicationBrowser": "ui", "UseBrowser": "ui", "UseApplication": "ui",
  "HttpClient": "uweb", "DeserializeJson": "uweb", "SerializeJson": "uweb",
  "SendSmtpMailMessage": "umail", "SendOutlookMailMessage": "umail", "GetImapMailMessage": "umail",
  "GetOutlookMailMessages": "umail", "SendMail": "umail", "GetMail": "umail",
  "ExcelApplicationScope": "uexcel", "UseExcel": "uexcel", "ExcelReadRange": "uexcel",
  "ExcelWriteRange": "uexcel", "ExcelWriteCell": "uexcel", "ReadRange": "uexcel", "WriteRange": "uexcel",
  "ExecuteQuery": "udb", "ExecuteNonQuery": "udb", "ConnectToDatabase": "udb",
  "CreateFormTask": "upers", "WaitForFormTaskAndResume": "upers",
  "CreateEntity": "uds", "CreateEntityRecord": "uds", "QueryEntity": "uds",
  "UpdateEntity": "uds", "DeleteEntity": "uds", "GetEntityById": "uds",
  "MLSkill": "uml", "Predict": "uml",
  "DigitizeDocument": "uocr", "ClassifyDocument": "uocr", "ExtractDocumentData": "uocr", "ValidateDocumentData": "uocr",
};

export function getActivityPrefixStrict(templateName: string): string | null {
  if (SYSTEM_ACTIVITIES_NO_PREFIX.has(templateName)) return "";

  if (GUARANTEED_ACTIVITY_PREFIX_MAP[templateName] !== undefined) {
    return GUARANTEED_ACTIVITY_PREFIX_MAP[templateName];
  }

  if (!catalogService.isLoaded()) {
    try { catalogService.load(); } catch (e) { }
  }

  if (catalogService.isLoaded()) {
    const schema = catalogService.getActivitySchema(templateName);
    if (schema) {
      const pkgInfo = PACKAGE_NAMESPACE_MAP[schema.packageId];
      if (pkgInfo) return pkgInfo.prefix;
    }
  }

  return null;
}

export function getActivityTag(templateName: string): string {
  const strictPrefix = getActivityPrefixStrict(templateName);
  if (strictPrefix === null) {
    throw new Error(`[XAML Compliance] getActivityTag("${templateName}"): no namespace mapping found — activity is unmapped and cannot be emitted safely. Add it to GUARANTEED_ACTIVITY_PREFIX_MAP or the activity catalog.`);
  }
  return strictPrefix ? `${strictPrefix}:${templateName}` : templateName;
}

export function collectUsedPackages(xaml: string): Set<string> {
  const usedPackages = new Set<string>();

  for (const [packageId, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
    if (!info.prefix || info.prefix === "ui") continue;
    const prefixPattern = new RegExp(`<${info.prefix}:`, "g");
    if (prefixPattern.test(xaml)) {
      usedPackages.add(packageId);
    }
  }

  if (/<ui:/.test(xaml)) {
    usedPackages.add("UiPath.System.Activities");
  }

  return usedPackages;
}

export function buildDynamicXmlnsDeclarations(usedPackages: Set<string>, isCrossPlatform: boolean, existingXml?: string): string {
  const lines: string[] = [];
  const existingPrefixes = new Set<string>();

  if (existingXml) {
    const prefixPattern = /xmlns:(\w+)="/g;
    let m;
    while ((m = prefixPattern.exec(existingXml)) !== null) {
      existingPrefixes.add(m[1]);
    }
  }

  Array.from(usedPackages).forEach(packageId => {
    const info = PACKAGE_NAMESPACE_MAP[packageId];
    if (!info || !info.prefix || info.prefix === "ui" || info.prefix === "") return;
    if (existingPrefixes.has(info.prefix)) return;
    lines.push(`  xmlns:${info.prefix}="${info.xmlns}"`);
  });

  return lines.join("\n");
}

export function buildDynamicAssemblyRefs(usedPackages: Set<string>, existingXml?: string): string {
  const refs: string[] = [];
  const existingRefs = new Set<string>();

  if (existingXml) {
    const refPattern = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
    let m;
    while ((m = refPattern.exec(existingXml)) !== null) {
      existingRefs.add(m[1]);
    }
  }

  Array.from(usedPackages).forEach(packageId => {
    const info = PACKAGE_NAMESPACE_MAP[packageId];
    if (!info) return;
    if (info.assembly === "System.Activities" || info.assembly === "UiPath.Core.Activities") return;
    if (existingRefs.has(info.assembly)) return;
    refs.push(`      <AssemblyReference>${info.assembly}</AssemblyReference>`);
  });

  if (usedPackages.has("UiPath.Web.Activities") && !existingRefs.has("Newtonsoft.Json")) {
    refs.push(`      <AssemblyReference>Newtonsoft.Json</AssemblyReference>`);
  }

  return refs.join("\n");
}

export function buildDynamicNamespaceImports(usedPackages: Set<string>): string {
  const imports: string[] = [];

  Array.from(usedPackages).forEach(packageId => {
    const info = PACKAGE_NAMESPACE_MAP[packageId];
    if (!info) return;
    if (info.clrNamespace === "System.Activities" || info.clrNamespace === "UiPath.Core.Activities") return;
    imports.push(`      <x:String>${info.clrNamespace}</x:String>`);
  });

  if (usedPackages.has("UiPath.Web.Activities")) {
    imports.push(`      <x:String>Newtonsoft.Json</x:String>`);
    imports.push(`      <x:String>Newtonsoft.Json.Linq</x:String>`);
  }

  return imports.join("\n");
}

export function ensureBracketWrapped(val: string): string {
  const trimmed = val.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
  if (trimmed.startsWith("<InArgument") || trimmed.startsWith("<OutArgument")) return trimmed;
  return `[${trimmed}]`;
}

export function looksLikeVariableRef(val: string): boolean {
  const trimmed = val.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return false;
  if (/^[0-9]/.test(trimmed)) return false;
  if (/^".*"$/.test(trimmed)) return false;
  if (/^&quot;/.test(trimmed)) return false;
  if (trimmed === "True" || trimmed === "False" || trimmed === "Nothing" || trimmed === "null" || trimmed === "") return false;
  if (/^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*$/.test(trimmed)) return true;
  return false;
}

export function smartBracketWrap(val: string): string {
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

const UIPATH_NAMESPACES = `xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"`;

const UIPATH_CROSS_PLATFORM_NAMESPACES = `xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=System.Runtime"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=System.Runtime"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data.Common"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=System.Runtime"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"`;

const UIPATH_VB_SETTINGS = `
  <mva:VisualBasic.Settings>
    <x:Null />
  </mva:VisualBasic.Settings>
  <sap2010:WorkflowViewState.IdRef>__ROOT_ID__</sap2010:WorkflowViewState.IdRef>
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
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <TextExpression.ReferencesForImplementation>
    <sco:Collection x:TypeArguments="AssemblyReference">
      <AssemblyReference>System.Activities</AssemblyReference>
      <AssemblyReference>Microsoft.VisualBasic</AssemblyReference>
      <AssemblyReference>mscorlib</AssemblyReference>
      <AssemblyReference>System.Data</AssemblyReference>
      <AssemblyReference>System</AssemblyReference>
      <AssemblyReference>System.Core</AssemblyReference>
      <AssemblyReference>System.Xml</AssemblyReference>
      <AssemblyReference>System.Xml.Linq</AssemblyReference>
      <AssemblyReference>UiPath.Core</AssemblyReference>
      <AssemblyReference>UiPath.Core.Activities</AssemblyReference>
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>`;

const UIPATH_CSHARP_SETTINGS = `
  <sap2010:WorkflowViewState.IdRef>__ROOT_ID__</sap2010:WorkflowViewState.IdRef>
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
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <TextExpression.ReferencesForImplementation>
    <sco:Collection x:TypeArguments="AssemblyReference">
      <AssemblyReference>System.Runtime</AssemblyReference>
      <AssemblyReference>System.Data.Common</AssemblyReference>
      <AssemblyReference>System.Xml.Linq</AssemblyReference>
      <AssemblyReference>UiPath.Core</AssemblyReference>
      <AssemblyReference>UiPath.Core.Activities</AssemblyReference>
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>`;

export function parseInvokeArgs(rawValue: string, direction: "In" | "Out" | "InOut"): string {
  const decoded = rawValue.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const cleaned = decoded.replace(/^\{\s*/, "").replace(/\s*\}$/, "").trim();
  if (!cleaned) return "";

  let result = "";
  const argType = direction === "In" ? "InArgument" : direction === "Out" ? "OutArgument" : "InOutArgument";

  const pairPattern = /(?:^|,)\s*"([^"]+)"\s*:\s*("(?:[^"\\]|\\.)*"|[^,}]+)/g;
  let m;
  while ((m = pairPattern.exec(cleaned)) !== null) {
    const key = m[1].trim();
    let val = m[2].trim().replace(/^["']|["']$/g, "");
    if (!key) continue;
    if (!val.startsWith("[")) val = `[${val}]`;
    result += `                <${argType} x:TypeArguments="x:String" x:Key="${escapeXml(key)}">${escapeXml(val)}</${argType}>\n`;
  }

  if (!result) {
    const simplePairs = cleaned.split(/,\s*/);
    for (const pair of simplePairs) {
      const colonIdx = pair.indexOf(":");
      if (colonIdx < 0) continue;
      const key = pair.substring(0, colonIdx).trim().replace(/^["']|["']$/g, "");
      let val = pair.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!key) continue;
      if (!val.startsWith("[")) val = `[${val}]`;
      result += `                <${argType} x:TypeArguments="x:String" x:Key="${escapeXml(key)}">${escapeXml(val)}</${argType}>\n`;
    }
  }

  return result;
}

function collapseDoubledArgumentsXmlParser(xml: string): string {
  const argTags = ["InArgument", "OutArgument", "InOutArgument"];
  const MAX_PASSES = 20;

  for (const tag of argTags) {
    let pass = 0;
    while (pass < MAX_PASSES) {
      const before = xml;
      const outerPattern = new RegExp(
        `<${tag}(\\s[^>]*)?>\\s*<${tag}(\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>\\s*<\\/${tag}>`,
        "g"
      );
      xml = xml.replace(outerPattern, (_match, outerAttrs, innerAttrs, content) => {
        const attrs = ((innerAttrs || outerAttrs) || "").trim();
        const trimmedContent = content.trim();
        return `<${tag}${attrs ? " " + attrs : ""}>${trimmedContent}</${tag}>`;
      });

      const outerNewlinePattern = new RegExp(
        `<${tag}(\\s[^>]*)?>\\s*\\n\\s*<${tag}(\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>\\s*\\n\\s*<\\/${tag}>`,
        "g"
      );
      xml = xml.replace(outerNewlinePattern, (_match, outerAttrs, innerAttrs, content) => {
        const attrs = ((innerAttrs || outerAttrs) || "").trim();
        const trimmedContent = content.trim();
        return `<${tag}${attrs ? " " + attrs : ""}>${trimmedContent}</${tag}>`;
      });

      if (xml === before) break;
      pass++;
      if (pass > 1) {
        console.log(`[XAML Compliance] collapseDoubledArguments: pass ${pass} for <${tag}> — collapsing deeply nested wrappers`);
      }
    }
  }

  for (const tag of argTags) {
    const nestedPattern = new RegExp(`<${tag}[^>]*>\\s*<${tag}[\\s\\S]*?<\\/${tag}>\\s*<\\/${tag}>`);
    if (nestedPattern.test(xml)) {
      console.warn(`[XAML Compliance] Post-collapse: nested <${tag}> still detected — applying brute-force strip`);
      let stripPass = 0;
      while (stripPass < MAX_PASSES) {
        const beforeStrip = xml;
        xml = xml.replace(new RegExp(`(<${tag}[^>]*>)\\s*<${tag}[^>]*>`, "g"), "$1");
        xml = xml.replace(new RegExp(`<\\/${tag}>\\s*(<\\/${tag}>)`, "g"), "$1");
        if (xml === beforeStrip) break;
        stripPass++;
      }

      if (nestedPattern.test(xml)) {
        const errorMsg = `[XAML Compliance] FATAL: nested <${tag}> persists after ${MAX_PASSES} collapse passes — XAML is malformed`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }

  return xml;
}

const VB_RESERVED_WORDS = new Set([
  "true", "false", "nothing", "null", "not", "and", "or", "andalso", "orelse",
  "is", "isnot", "if", "ctype", "directcast", "gettype", "typeof", "new",
  "throw", "string", "integer", "boolean", "double", "object", "datetime",
  "math", "convert", "int32", "int64", "exception", "system", "console",
  "environment", "char", "byte", "short", "long", "single", "decimal", "date",
  "timespan", "array", "type", "enum", "dictionary", "list", "cstr", "cint",
  "cdbl", "cbool", "cdate", "clng", "csng", "cdec", "cbyte", "cshort", "cchar",
  "mod", "like", "xor", "me", "mybase", "addressof", "dim", "as", "of", "from",
  "where", "select", "in", "step", "to", "byval", "byref", "optional",
  "paramarray", "handles", "implements", "inherits", "overrides", "overloads",
  "mustoverride", "mustinherit", "shared", "static", "const", "readonly",
  "writeonly", "friend", "protected", "private", "public", "return", "exit",
  "continue", "do", "loop", "until", "wend", "each", "next", "case", "end",
  "sub", "function", "property", "event", "class", "structure", "module",
  "interface", "namespace", "imports", "try", "catch", "finally", "using",
  "with", "synclock", "raiseevent", "removehandler", "addhandler", "let",
  "set", "get", "then", "else", "elseif", "for", "while", "goto", "redim",
  "preserve", "erase", "stop", "on", "error", "resume", "option", "strict",
  "explicit", "compare", "binary", "text", "cbyte",
]);

const DOTNET_MEMBERS = new Set([
  "tostring", "substring", "length", "count", "rows", "message", "stacktrace",
  "name", "reference", "min", "max", "contains", "startswith", "endswith",
  "trim", "replace", "split", "join", "format", "parse", "tryparse", "now",
  "today", "utcnow", "adddays", "addhours", "item", "value", "key", "hasvalue",
  "result", "body", "subject", "content", "equals", "compareto", "indexof",
  "lastindexof", "remove", "insert", "padleft", "padright", "tolower", "toupper",
  "toarray", "tolist", "firstordefault", "lastordefault", "any", "all", "sum",
  "average", "orderby", "groupby", "concat", "append", "clear", "add",
  "addrange", "copyto", "clone", "dispose", "close", "flush", "read", "write",
  "seek", "getbytes", "getstring", "encode", "decode", "invoke", "execute",
  "cancel", "abort", "wait", "reset", "trygetvalue", "containskey", "keys",
  "values", "empty", "isnullorempty", "isnullorwhitespace", "toint32",
  "toint64", "todouble", "toboolean", "tosingle", "todecimal", "tobyte",
  "tochar", "tostring", "gettype", "gethashcode", "referenceequals",
  "memberwise", "finalize", "op_equality", "op_inequality",
]);

const XML_PREFIXES = new Set([
  "x", "s", "scg", "scg2", "ui", "sap", "sap2010", "mc", "mva", "sco",
  "sads", "sapv", "p", "local", "xmlns", "clr",
]);

const SPECIFIC_VARIABLE_TYPES: Record<string, string> = {
  "gmailAppPassword": "s:Security.SecureString",
  "primaryRouteDisrupted": "x:Boolean",
  "c2cAvailable": "x:Boolean",
  "smtpSendAttempt": "x:Int32",
  "severityCode": "x:Int32",
};

function inferVariableType(varName: string): string {
  if (SPECIFIC_VARIABLE_TYPES[varName]) return SPECIFIC_VARIABLE_TYPES[varName];

  const lower = varName.toLowerCase();
  if (lower.startsWith("str_")) return "x:String";
  if (lower.startsWith("int_") || lower.startsWith("i_") || lower.startsWith("int32_")) return "x:Int32";
  if (lower.startsWith("bool_") || lower.startsWith("b_") || lower.startsWith("is_") || lower.startsWith("has_")) return "x:Boolean";
  if (lower.startsWith("dt_") || lower.startsWith("datatable_")) return "scg2:DataTable";
  if (lower.startsWith("qi_")) return "ui:QueueItem";
  if (lower.startsWith("dic_") || lower.startsWith("dict_")) return "scg:Dictionary(x:String, x:Object)";
  if (lower.startsWith("arr_")) return "s:String[]";
  if (lower.startsWith("img_")) return "ui:Image";
  if (lower.startsWith("dbl_") || lower.startsWith("dec_")) return "x:Double";
  if (lower.startsWith("obj_")) return "x:Object";
  if (lower.startsWith("sec_")) return "s:Security.SecureString";
  if (lower.startsWith("row_") || lower.startsWith("drow_")) return "scg2:DataRow";
  if (lower.startsWith("lst_")) return "scg:List(x:String)";
  if (lower.startsWith("out_")) return "x:String";
  if (lower.startsWith("in_")) return "x:String";
  return "x:Object";
}

function isExcludedToken(token: string): boolean {
  if (token.length <= 1) return true;
  const lower = token.toLowerCase();
  if (VB_RESERVED_WORDS.has(lower)) return true;
  if (DOTNET_MEMBERS.has(lower)) return true;
  if (XML_PREFIXES.has(lower)) return true;
  if (/^\d/.test(token)) return true;
  if (/^[A-Z][a-z]+[A-Z]/.test(token) === false && /^[A-Z]{2,}$/.test(token)) return true;
  return false;
}

function findNearestEnclosingSequenceIndex(xml: string, refIndex: number): number {
  let bestIdx = -1;
  const seqPattern = /<Sequence\s[^>]*>/g;
  let sm;
  while ((sm = seqPattern.exec(xml)) !== null) {
    if (sm.index < refIndex) {
      const closeTag = "</Sequence>";
      const closeIdx = xml.indexOf(closeTag, sm.index);
      if (closeIdx === -1 || closeIdx > refIndex) {
        bestIdx = sm.index;
      }
    }
  }
  return bestIdx;
}

function ensureVariableDeclarations(xml: string): string {
  const declaredVars = new Set<string>();
  let m;

  const varDeclPattern = /<Variable\s[^>]*Name="([^"]+)"/g;
  while ((m = varDeclPattern.exec(xml)) !== null) declaredVars.add(m[1]);

  const delegatePattern = /<DelegateInArgument[^>]*Name="([^"]+)"/g;
  while ((m = delegatePattern.exec(xml)) !== null) declaredVars.add(m[1]);

  const propPattern = /<x:Property\s[^>]*Name="([^"]+)"/g;
  while ((m = propPattern.exec(xml)) !== null) declaredVars.add(m[1]);

  const referencedVarsWithPos = new Map<string, number>();

  const bracketExprPattern = /\[([^\[\]]+)\]/g;
  let bracketMatch;
  while ((bracketMatch = bracketExprPattern.exec(xml)) !== null) {
    const expr = bracketMatch[1];
    if (expr.startsWith("&quot;") || expr.startsWith('"')) continue;
    if (expr.includes("xmlns") || expr.includes("clr-namespace")) continue;

    const withoutStrings = expr.replace(/&quot;[^&]*&quot;/g, "").replace(/"[^"]*"/g, "");

    const tokens = withoutStrings.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g);
    if (!tokens) continue;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (isExcludedToken(token)) continue;

      const afterToken = withoutStrings.indexOf(token) + token.length;
      const charAfter = withoutStrings[afterToken];
      if (charAfter === "(") continue;

      if (i > 0) {
        const prevToken = tokens[i - 1];
        if (prevToken === "." || withoutStrings.includes(`.${token}`)) continue;
      }

      if (!referencedVarsWithPos.has(token)) {
        referencedVarsWithPos.set(token, bracketMatch.index);
      }
    }
  }

  const missingVars: { name: string; type: string; refIndex: number }[] = [];
  for (const [varName, refIdx] of Array.from(referencedVarsWithPos)) {
    if (!declaredVars.has(varName)) {
      missingVars.push({ name: varName, type: inferVariableType(varName), refIndex: refIdx });
    }
  }

  if (missingVars.length === 0) return xml;

  const classMatch = xml.match(/x:Class="([^"]+)"/);
  const workflowName = classMatch ? classMatch[1] : "unknown";

  const seqInsertions = new Map<number, { name: string; type: string }[]>();
  for (const v of missingVars) {
    console.log(`Auto-declared variable ${v.name} as ${v.type} in ${workflowName}`);
    const seqIdx = findNearestEnclosingSequenceIndex(xml, v.refIndex);
    const key = seqIdx >= 0 ? seqIdx : 0;
    if (!seqInsertions.has(key)) seqInsertions.set(key, []);
    seqInsertions.get(key)!.push({ name: v.name, type: v.type });
  }

  const sortedKeys = Array.from(seqInsertions.keys()).sort((a, b) => b - a);

  for (const seqIdx of sortedKeys) {
    const vars = seqInsertions.get(seqIdx)!;
    const varsXml = vars.map(v =>
      `      <Variable x:TypeArguments="${v.type}" Name="${v.name}" />`
    ).join("\n");

    if (seqIdx <= 0) {
      const seqVarsPattern = /(<Sequence[^>]*>)\s*(<Sequence\.Variables>)/;
      if (seqVarsPattern.test(xml)) {
        xml = xml.replace(seqVarsPattern, (match, seqTag, varsTag) => {
          return `${seqTag}\n    ${varsTag}\n${varsXml}`;
        });
      } else {
        const firstSeqPattern = /(<Sequence\s+DisplayName="[^"]*"[^>]*>)/;
        if (firstSeqPattern.test(xml)) {
          xml = xml.replace(firstSeqPattern, (match, seqTag) => {
            return `${seqTag}\n    <Sequence.Variables>\n${varsXml}\n    </Sequence.Variables>`;
          });
        }
      }
      continue;
    }

    const seqTagEndIdx = xml.indexOf(">", seqIdx);
    if (seqTagEndIdx === -1) continue;

    const afterTag = xml.substring(seqTagEndIdx + 1);
    const existingVarsMatch = afterTag.match(/^\s*<Sequence\.Variables>/);
    if (existingVarsMatch) {
      const insertPos = seqTagEndIdx + 1 + existingVarsMatch[0].length;
      xml = xml.slice(0, insertPos) + "\n" + varsXml + xml.slice(insertPos);
    } else {
      const seqTag = xml.substring(seqIdx, seqTagEndIdx + 1);
      xml = xml.slice(0, seqTagEndIdx + 1) +
        `\n    <Sequence.Variables>\n${varsXml}\n    </Sequence.Variables>` +
        xml.slice(seqTagEndIdx + 1);
    }
  }

  return xml;
}

const VARIABLE_PREFIX_PATTERN = /^(str_|int_|dbl_|bool_|sec_|dt_|drow_|obj_|dec_|ts_|lst_|dic_|arr_|row_|qi_)/i;

const QUOTED_EXPRESSION_PATTERNS = [
  /^"Exception\.Message"$/,
  /^"exception\.Message"$/,
  /^"Exception\.ToString\(\)"$/,
  /^"exception\.ToString\(\)"$/,
];

function fixBareVariableRefsInExpressionAttributes(xml: string): string {
  const expressionAttrs = ["Message", "Condition", "To", "Value"];

  for (const attr of expressionAttrs) {
    const pattern = new RegExp(`${attr}="([^"]*)"`, "g");
    xml = xml.replace(pattern, (match, val) => {
      if (!val || val.startsWith("[") || val.startsWith("&quot;") || val.startsWith("<")) return match;
      if (val === "True" || val === "False" || val === "Nothing" || val === "null") return match;
      if (/^[0-9]+$/.test(val)) return match;

      if (VARIABLE_PREFIX_PATTERN.test(val) && /^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*$/.test(val)) {
        return `${attr}="[${val}]"`;
      }

      for (const qp of QUOTED_EXPRESSION_PATTERNS) {
        if (qp.test(val)) {
          const inner = val.slice(1, -1);
          return `${attr}="[${inner}]"`;
        }
      }

      return match;
    });
  }

  return xml;
}

function sanitizeXmlArtifacts(xml: string): string {
  xml = xml.replace(/="([^"]*?[^}\]])(\}+)"/g, (match, val, braces) => {
    if (/\[.*\]/.test(val + braces)) return match;
    if (/New\s+Dictionary|From\s*\{/.test(val)) return match;
    console.log(`[XAML Compliance] Removed stray } from attribute value`);
    return `="${val}"`;
  });

  xml = xml.replace(/"([^"]*?)"\s*\}(?=\s|>|\/)/g, (match, val) => {
    if (/\[.*\]/.test(match)) return match;
    return `"${val}"`;
  });

  return xml;
}

function injectDynamicNamespaceDeclarations(xml: string, isCrossPlatform: boolean): string {
  const usedPackages = collectUsedPackages(xml);

  const hasNewtonsoftTypes = /JObject|JToken|JArray|JsonConvert|Newtonsoft/i.test(xml);
  if (hasNewtonsoftTypes) {
    usedPackages.add("UiPath.Web.Activities");
  }

  const additionalXmlns = buildDynamicXmlnsDeclarations(usedPackages, isCrossPlatform, xml);
  const additionalAssemblyRefs = buildDynamicAssemblyRefs(usedPackages, xml);
  const additionalNamespaceImports = buildDynamicNamespaceImports(usedPackages);

  if (additionalXmlns) {
    const xmlnsInsertPoint = xml.indexOf('xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"');
    if (xmlnsInsertPoint >= 0) {
      const insertAfter = xmlnsInsertPoint + 'xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"'.length;
      xml = xml.slice(0, insertAfter) + "\n" + additionalXmlns + xml.slice(insertAfter);
    }
  }

  if (additionalAssemblyRefs) {
    const refsCloseTag = "</sco:Collection>\n  </TextExpression.ReferencesForImplementation>";
    const refsIdx = xml.indexOf(refsCloseTag);
    if (refsIdx >= 0) {
      xml = xml.slice(0, refsIdx) + additionalAssemblyRefs + "\n" + xml.slice(refsIdx);
    }
  }

  if (additionalNamespaceImports) {
    const importsCloseTag = "</sco:Collection>\n  </TextExpression.NamespacesForImplementation>";
    const importsIdx = xml.indexOf(importsCloseTag);
    if (importsIdx >= 0) {
      xml = xml.slice(0, importsIdx) + additionalNamespaceImports + "\n" + xml.slice(importsIdx);
    }
  }

  return xml;
}

const APPROVED_XMLNS_MAPPINGS: Record<string, { validUris: string[] }> = {
  "ui": { validUris: ["http://schemas.uipath.com/workflow/activities"] },
  "x": { validUris: ["http://schemas.microsoft.com/winfx/2006/xaml"] },
  "mc": { validUris: ["http://schemas.openxmlformats.org/markup-compatibility/2006"] },
  "s": { validUris: ["clr-namespace:System;assembly=mscorlib", "clr-namespace:System;assembly=System.Runtime"] },
  "sap": { validUris: ["http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"] },
  "sap2010": { validUris: ["http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"] },
  "scg": { validUris: ["clr-namespace:System.Collections.Generic;assembly=mscorlib", "clr-namespace:System.Collections.Generic;assembly=System.Runtime"] },
  "scg2": { validUris: ["clr-namespace:System.Data;assembly=System.Data", "clr-namespace:System.Data;assembly=System.Data.Common"] },
  "sco": { validUris: ["clr-namespace:System.Collections.ObjectModel;assembly=mscorlib", "clr-namespace:System.Collections.ObjectModel;assembly=System.Runtime"] },
  "mva": { validUris: ["clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"] },
};

for (const [, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
  if (info.prefix && info.prefix !== "" && !APPROVED_XMLNS_MAPPINGS[info.prefix]) {
    APPROVED_XMLNS_MAPPINGS[info.prefix] = { validUris: [info.xmlns] };
  }
}

const DATETIME_FORMAT_SAFE_PREFIXES = new Set(["HH", "MM", "ss", "dd", "yyyy", "mm", "hh"]);

function stripAttributeValuesAndTextContent(xml: string): string {
  let result = "";
  let i = 0;
  while (i < xml.length) {
    if (xml[i] === "<") {
      const tagEnd = xml.indexOf(">", i);
      if (tagEnd === -1) {
        result += xml.slice(i);
        break;
      }
      const tagContent = xml.slice(i, tagEnd + 1);
      let cleaned = "";
      let j = 0;
      while (j < tagContent.length) {
        if (tagContent[j] === '"') {
          cleaned += '"';
          j++;
          while (j < tagContent.length && tagContent[j] !== '"') j++;
          if (j < tagContent.length) {
            cleaned += '"';
            j++;
          }
        } else if (tagContent[j] === "'") {
          cleaned += "'";
          j++;
          while (j < tagContent.length && tagContent[j] !== "'") j++;
          if (j < tagContent.length) {
            cleaned += "'";
            j++;
          }
        } else {
          cleaned += tagContent[j];
          j++;
        }
      }
      result += cleaned;
      i = tagEnd + 1;
    } else {
      const nextTag = xml.indexOf("<", i);
      if (nextTag === -1) {
        break;
      }
      i = nextTag;
    }
  }
  return result;
}

export function validateNamespacePrefixes(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const declaredPrefixes = new Map<string, string>();
  const xmlnsPattern = /xmlns:([a-zA-Z][a-zA-Z0-9]*)="([^"]+)"/g;
  let m;
  while ((m = xmlnsPattern.exec(xml)) !== null) {
    declaredPrefixes.set(m[1], m[2]);
  }

  const strippedXml = stripAttributeValuesAndTextContent(xml);

  const usedPrefixes = new Set<string>();
  const tagPrefixPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*):/g;
  while ((m = tagPrefixPattern.exec(strippedXml)) !== null) {
    usedPrefixes.add(m[1]);
  }

  const attrPrefixPattern = /\s([a-zA-Z][a-zA-Z0-9]*):[a-zA-Z]/g;
  while ((m = attrPrefixPattern.exec(strippedXml)) !== null) {
    if (m[1] !== "xmlns") {
      usedPrefixes.add(m[1]);
    }
  }

  Array.from(usedPrefixes).forEach(prefix => {
    if (prefix === "xml") return;
    if (DATETIME_FORMAT_SAFE_PREFIXES.has(prefix)) return;
    if (!declaredPrefixes.has(prefix)) {
      errors.push(`Namespace prefix "${prefix}" is used in activity tags but has no corresponding xmlns declaration`);
      return;
    }

    const declaredUri = declaredPrefixes.get(prefix)!;
    const approved = APPROVED_XMLNS_MAPPINGS[prefix];
    if (approved) {
      if (!approved.validUris.includes(declaredUri)) {
        errors.push(`Namespace prefix "${prefix}" is declared with URI "${declaredUri}" which does not match any approved CLR namespace mapping. Expected one of: ${approved.validUris.join(", ")}`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

export function validateActivityTagSemantics(xml: string): { valid: boolean; errors: string[]; warnings: string[]; repairedXml: string } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let repairedXml = xml;

  const activityTagPattern = /<([a-zA-Z][a-zA-Z0-9]*):([A-Z][a-zA-Z0-9]*)[\s>\/]/g;
  let m;
  const checkedTags = new Set<string>();

  while ((m = activityTagPattern.exec(xml)) !== null) {
    const emittedPrefix = m[1];
    const activityName = m[2];
    const tagKey = `${emittedPrefix}:${activityName}`;

    if (checkedTags.has(tagKey)) continue;
    checkedTags.add(tagKey);

    if (["x", "s", "scg", "scg2", "sco", "sap", "sap2010", "mva", "mc"].includes(emittedPrefix)) continue;

    if (SYSTEM_ACTIVITIES_NO_PREFIX.has(activityName)) {
      const escaped = activityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      repairedXml = repairedXml.replace(new RegExp(`<${emittedPrefix}:${escaped}(\\s|>|\\/)`, "g"), `<${activityName}$1`);
      repairedXml = repairedXml.replace(new RegExp(`<\\/${emittedPrefix}:${escaped}>`, "g"), `</${activityName}>`);
      repairedXml = repairedXml.replace(new RegExp(`<${emittedPrefix}:${escaped}\\.`, "g"), `<${activityName}.`);
      repairedXml = repairedXml.replace(new RegExp(`<\\/${emittedPrefix}:${escaped}\\.`, "g"), `</${activityName}.`);
      warnings.push(`Activity "${activityName}" had prefix "${emittedPrefix}:" auto-corrected to no prefix (System.Activities type)`);
      continue;
    }

    const strictPrefix = getActivityPrefixStrict(activityName);
    if (strictPrefix === null) {
      if (emittedPrefix === "ui") {
        warnings.push(`Activity "${activityName}" has no catalog mapping — emitted with default ui: prefix (may be incorrect)`);
      }
      continue;
    }

    if (strictPrefix !== emittedPrefix) {
      errors.push(`Activity "${activityName}" emitted with prefix "${emittedPrefix}:" but catalog maps it to "${strictPrefix || "(no prefix)"}:" — namespace mismatch will cause Studio resolution errors`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, repairedXml };
}

export function validateXmlWellFormedness(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const result = XMLValidator.validate(xml, {
    allowBooleanAttributes: true,
  });

  if (result !== true) {
    const errObj = result as { err: { code: string; msg: string; line: number; col: number } };
    if (errObj.err) {
      errors.push(`XML well-formedness error at line ${errObj.err.line}, col ${errObj.err.col}: ${errObj.err.msg} (code: ${errObj.err.code})`);
    } else {
      errors.push(`XML well-formedness validation failed with unknown error`);
    }
  }

  const openTags: string[] = [];
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*(?::[a-zA-Z][a-zA-Z0-9]*)?(?:\.[a-zA-Z][a-zA-Z0-9]*)*)(?:\s[^>]*)?\/?>/g;
  let tagMatch;
  while ((tagMatch = tagPattern.exec(xml)) !== null) {
    const fullMatch = tagMatch[0];
    const tagName = tagMatch[1];
    if (fullMatch.startsWith("<!--") || fullMatch.endsWith("/>")) continue;
    if (fullMatch.startsWith("</")) {
      if (openTags.length > 0 && openTags[openTags.length - 1] === tagName) {
        openTags.pop();
      }
    } else if (!fullMatch.endsWith("/>")) {
      openTags.push(tagName);
    }
  }

  if (openTags.length > 0 && openTags.length <= 5) {
    errors.push(`Potentially unclosed XML tags detected: ${openTags.join(", ")}`);
  }

  return { valid: errors.length === 0, errors };
}

export function makeUiPathCompliant(rawXaml: string, targetFramework: TargetFramework = "Windows"): string {
  let idCounter = 0;
  const viewStateEntries: { id: string; width: number; height: number }[] = [];
  const isCrossPlatform = targetFramework === "Portable";

  for (const [aliasName, canonicalName] of Object.entries(ACTIVITY_NAME_ALIAS_MAP)) {
    const escapedAlias = aliasName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rawXaml = rawXaml.replace(new RegExp(`<${escapedAlias}(\\s|>|\\/)`, "g"), `<${canonicalName}$1`);
    rawXaml = rawXaml.replace(new RegExp(`</${escapedAlias}>`, "g"), `</${canonicalName}>`);
  }

  function nextId(prefix: string): string {
    idCounter++;
    return `${prefix}_${idCounter}`;
  }

  function getHintSize(tag: string): { w: number; h: number } {
    if (tag.startsWith("Sequence") || tag.startsWith("StateMachine")) return { w: 400, h: 300 };
    if (tag.startsWith("If")) return { w: 400, h: 280 };
    if (tag.startsWith("TryCatch")) return { w: 400, h: 260 };
    if (tag.startsWith("ForEach")) return { w: 400, h: 240 };
    if (tag.startsWith("State")) return { w: 300, h: 200 };
    if (tag.startsWith("Transition")) return { w: 200, h: 60 };
    return { w: 334, h: 90 };
  }

  let xml = rawXaml;

  const targetNamespaces = isCrossPlatform ? UIPATH_CROSS_PLATFORM_NAMESPACES : UIPATH_NAMESPACES;
  const oldNsBlock = xml.match(/xmlns="http:\/\/schemas\.microsoft\.com\/netfx\/2009\/xaml\/activities"[\s\S]*?xmlns:x="http:\/\/schemas\.microsoft\.com\/winfx\/2006\/xaml"/);
  if (oldNsBlock) {
    xml = xml.replace(oldNsBlock[0], targetNamespaces);
  }

  const classMatch = xml.match(/x:Class="([^"]+)"/);
  const className = classMatch ? classMatch[1].replace(/[^A-Za-z0-9_]/g, "") : "Workflow";
  const rootId = nextId(className);

  const activityTagPattern = /<(Sequence|If|TryCatch|ForEach|Assign|State|StateMachine|Transition|Flowchart|FlowStep|FlowDecision|[a-zA-Z]+:[A-Za-z]+)\s+((?:[^>]*?\s+)?)DisplayName="([^"]*)"([^>]*?)(\s*\/?>)/g;
  xml = xml.replace(activityTagPattern, (match, tag, preAttrs, displayName, rest, closing) => {
    if (preAttrs.includes("WorkflowViewState.IdRef") || rest.includes("WorkflowViewState.IdRef")) return match;
    const prefix = tag.replace(/^[a-zA-Z]+:/, "").replace(/[^A-Za-z]/g, "");
    const id = nextId(prefix);
    const hint = getHintSize(tag);
    viewStateEntries.push({ id, width: hint.w, height: hint.h });
    const pre = preAttrs ? `${preAttrs}` : "";
    return `<${tag} ${pre}DisplayName="${displayName}" sap2010:WorkflowViewState.IdRef="${id}" sap:VirtualizedContainerService.HintSize="${hint.w},${hint.h}"${rest}${closing}`;
  });

  const firstChildMatch = xml.match(/<(Sequence|StateMachine|Flowchart)\s+DisplayName="[^"]*"/);
  if (firstChildMatch) {
    const rootHint = firstChildMatch[1] === "StateMachine" ? { w: 600, h: 500 } : firstChildMatch[1] === "Flowchart" ? { w: 600, h: 400 } : { w: 500, h: 400 };
    viewStateEntries.push({ id: rootId, width: rootHint.w, height: rootHint.h });
  }

  const settingsBlock = isCrossPlatform
    ? UIPATH_CSHARP_SETTINGS.replace("__ROOT_ID__", rootId)
    : UIPATH_VB_SETTINGS.replace("__ROOT_ID__", rootId);

  const firstTag = xml.match(/<(Sequence|StateMachine|Flowchart)\s/);
  if (firstTag && firstTag.index !== undefined) {
    xml = xml.slice(0, firstTag.index) + settingsBlock + "\n  " + xml.slice(firstTag.index);
  }

  xml = xml.replace(/scg:DataTable/g, "scg2:DataTable");
  xml = xml.replace(/scg:DataRow/g, "scg2:DataRow");

  xml = xml.replace(/(Message|Default|Value)="((?:[^"]*'[^']*'[^"]*(?:&amp;|\+)[^"]*)|(?:[^"]*(?:&amp;|\+)[^"]*'[^']*'[^"]*))"/g, (match, attr, content) => {
    const canonical = content.replace(/'([^']*)'/g, "&quot;$1&quot;");
    if (!canonical.startsWith("[")) {
      return `${attr}="[${canonical}]"`;
    }
    return `${attr}="${canonical}"`;
  });

  xml = xml.replace(/(Message|Default)="'([^']*)'"/g, (match, attr, content) => {
    return `${attr}="[&quot;${content}&quot;]"`;
  });

  xml = xml.replace(/Message="'([^"]*)"/g, (match, content) => {
    if (content.endsWith("'")) return match;
    return `Message="[&quot;${content}&quot;]"`;
  });

  let prevXml = "";
  while (prevXml !== xml) {
    prevXml = xml;
    xml = xml.replace(/(Message|Default|Value)="(\[[^"]*)'([^']*)'([^"]*\])"/g, (match, attr, pre, quoted, post) => {
      return `${attr}="${pre}&quot;${quoted}&quot;${post}"`;
    });
  }

  xml = xml.replace(/Default="([^"[\]]+)"/g, (match, val) => {
    if (/^[0-9]+$/.test(val) || val === "True" || val === "False" || val === "Nothing" || val === "null" || val.startsWith("[") || val.startsWith("&quot;")) return match;
    if (/^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*(\(.*\))?$/.test(val)) {
      return `Default="[${val}]"`;
    }
    return match;
  });

  xml = xml.replace(/(Message|Value)="("")([^"]*)""/g, (match, attr, _q1, inner) => {
    return `${attr}="[&quot;${inner}&quot;]"`;
  });

  xml = xml.replace(/(Message|Default|Value)="(\[[^"]*)"(?=\s|\/|>)/g, (match, attr, inner) => {
    const withoutQuoted = inner.replace(/&quot;[^&]*&quot;/g, "");
    const openBrackets = (withoutQuoted.match(/\[/g) || []).length;
    const closeBrackets = (withoutQuoted.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      const fixed = inner + "]".repeat(openBrackets - closeBrackets);
      return `${attr}="${fixed}"`;
    }
    return match;
  });

  xml = xml.replace(/<Variable\s+x:TypeArguments="([^"]*?)"\s+Name="(sec_[^"]*?)"\s*\/>/g, (match, typeArg, varName) => {
    if (typeArg !== "s:Security.SecureString") {
      console.log(`[Compliance] Fixing sec_ variable ${varName} type from ${typeArg} to s:Security.SecureString`);
      return `<Variable x:TypeArguments="s:Security.SecureString" Name="${varName}" />`;
    }
    return match;
  });
  xml = xml.replace(/<Variable\s+Name="(sec_[^"]*?)"\s+x:TypeArguments="([^"]*?)"\s*\/>/g, (match, varName, typeArg) => {
    if (typeArg !== "s:Security.SecureString") {
      console.log(`[Compliance] Fixing sec_ variable ${varName} type from ${typeArg} to s:Security.SecureString (reversed attrs)`);
      return `<Variable x:TypeArguments="s:Security.SecureString" Name="${varName}" />`;
    }
    return match;
  });

  xml = xml.replace(/<sap:WorkflowViewState\.ViewStateManager>[\s\S]*?<\/sap:WorkflowViewState\.ViewStateManager>/g, "");
  xml = xml.replace(/<WorkflowViewState\.ViewStateManager>[\s\S]*?<\/WorkflowViewState\.ViewStateManager>/g, "");

  const excelPrefixes = ["ui", "uexcel"];
  for (const ep of excelPrefixes) {
    xml = xml.replace(new RegExp(`<${ep}:ExcelApplicationScope\\.Body>\\s*(?!<ActivityAction)<Sequence\\s`, "g"), () => {
      return `<${ep}:ExcelApplicationScope.Body>\n        <ActivityAction x:TypeArguments="x:Object">\n          <ActivityAction.Handler>\n            <Sequence `;
    });
    if (xml.includes(`<${ep}:ExcelApplicationScope.Body>`) && !xml.includes("<ActivityAction.Handler>")) {
      xml = xml.replace(new RegExp(`<\\/Sequence>\\s*<\\/${ep}:ExcelApplicationScope\\.Body>`, "g"),
        `</Sequence>\n          </ActivityAction.Handler>\n        </ActivityAction>\n      </${ep}:ExcelApplicationScope.Body>`);
    }
  }

  xml = xml.replace(/\.ToString(?!\()/g, ".ToString()");

  if (isCrossPlatform) {
    xml = xml.replace(/Condition="\[(\w+) IsNot Nothing\]"/g, 'Condition="[$1 != null]"');
    xml = xml.replace(/Condition="\[(\w+) Is Nothing\]"/g, 'Condition="[$1 == null]"');
    xml = xml.replace(/Condition="\[Not (\w+)\]"/g, 'Condition="[!$1]"');

    xml = xml.replace(/Condition="\[(\w+) = &quot;([^&]*)&quot;\]"/g, 'Condition="[$1 == &quot;$2&quot;]"');

    xml = xml.replace(/ &amp; /g, " + ");
  }

  xml = sanitizeXmlArtifacts(xml);

  const KNOWN_PREFIXED_ACTIVITIES = [
    "InvokeWorkflowFile", "RetryScope", "AddQueueItem", "GetTransactionItem",
    "SetTransactionStatus", "LogMessage", "GetCredential", "GetAsset",
    "TakeScreenshot", "AddLogFields", "Comment", "ShouldRetry",
    "ReadTextFile", "WriteTextFile", "PathExists",
    "HttpClient", "DeserializeJson", "SerializeJson",
    "SendSmtpMailMessage", "SendOutlookMailMessage", "GetImapMailMessage",
    "GetOutlookMailMessages", "SendMail", "GetMail",
    "ExcelApplicationScope", "UseExcel", "ExcelReadRange", "ExcelWriteRange",
    "ExcelWriteCell", "ReadRange", "WriteRange",
    "ExecuteQuery", "ExecuteNonQuery", "ConnectToDatabase",
    "ElementExists", "Click", "TypeInto", "GetText", "OpenBrowser",
    "NavigateTo", "AttachBrowser", "AttachWindow", "UseApplicationBrowser",
    "UseBrowser", "UseApplication",
    "CreateFormTask", "WaitForFormTaskAndResume",
    "CreateEntity", "CreateEntityRecord", "QueryEntity", "UpdateEntity",
    "DeleteEntity", "GetEntityById",
    "MLSkill", "Predict",
    "DigitizeDocument", "ClassifyDocument", "ExtractDocumentData", "ValidateDocumentData",
  ];

  for (const actName of KNOWN_PREFIXED_ACTIVITIES) {
    const prefix = getActivityPrefix(actName);
    if (!prefix) continue;

    const noPrefixOpen = new RegExp(`<(?![a-zA-Z]+:)${actName}(\\s|>|\\/)`, "g");
    xml = xml.replace(noPrefixOpen, `<${prefix}:${actName}$1`);
    const noPrefixClose = new RegExp(`<\\/(?![a-zA-Z]+:)${actName}>`, "g");
    xml = xml.replace(noPrefixClose, `</${prefix}:${actName}>`);

    if (prefix !== "ui") {
      const wrongUiOpen = new RegExp(`<ui:${actName}(\\s|>|\\/)`, "g");
      xml = xml.replace(wrongUiOpen, `<${prefix}:${actName}$1`);
      const wrongUiClose = new RegExp(`<\\/ui:${actName}>`, "g");
      xml = xml.replace(wrongUiClose, `</${prefix}:${actName}>`);
      const wrongUiProp = new RegExp(`<ui:${actName}\\.`, "g");
      xml = xml.replace(wrongUiProp, `<${prefix}:${actName}.`);
      const wrongUiPropClose = new RegExp(`<\\/ui:${actName}\\.`, "g");
      xml = xml.replace(wrongUiPropClose, `</${prefix}:${actName}.`);
    }
  }

  xml = injectDynamicNamespaceDeclarations(xml, isCrossPlatform);

  xml = xml.replace(/<(ui:(?:While|RetryScope))\s+([^>]*?)\/>/g, (match, tag, attrs) => {
    if (tag === "ui:While") {
      return `<${tag} ${attrs}>
              <${tag}.Body>
                <Sequence DisplayName="While Body" />
              </${tag}.Body>
            </${tag}>`;
    }
    return `<${tag} ${attrs}>
              <${tag}.Body>
                <Sequence DisplayName="Retry Body" />
              </${tag}.Body>
              <${tag}.Condition>
                <ui:ShouldRetry />
              </${tag}.Condition>
            </${tag}>`;
  });
  xml = xml.replace(/<Assign\s+([^>]*?)To="([^"]*)"([^>]*?)Value="([^"]*)"([^>]*?)\s*\/>/g, (_match, before, toVal, mid, valVal, after) => {
    const displayMatch = (before + mid + after).match(/DisplayName="([^"]*)"/);
    const dispName = displayMatch ? displayMatch[1] : "Assign";
    const cleanAttrs = (before + mid + after).replace(/\s*(To|Value|DisplayName)="[^"]*"/g, "").trim();
    const wrappedTo = ensureBracketWrapped(toVal);
    const wrappedVal = smartBracketWrap(valVal);
    return `<Assign DisplayName="${dispName}"${cleanAttrs ? " " + cleanAttrs : ""}>
              <Assign.To><OutArgument x:TypeArguments="x:String">${wrappedTo}</OutArgument></Assign.To>
              <Assign.Value><InArgument x:TypeArguments="x:String">${wrappedVal}</InArgument></Assign.Value>
            </Assign>`;
  });
  xml = xml.replace(/<Assign\s+([^>]*?)Value="([^"]*)"([^>]*?)To="([^"]*)"([^>]*?)\s*\/>/g, (_match, before, valVal, mid, toVal, after) => {
    const displayMatch = (before + mid + after).match(/DisplayName="([^"]*)"/);
    const dispName = displayMatch ? displayMatch[1] : "Assign";
    const cleanAttrs = (before + mid + after).replace(/\s*(To|Value|DisplayName)="[^"]*"/g, "").trim();
    const wrappedTo = ensureBracketWrapped(toVal);
    const wrappedVal = smartBracketWrap(valVal);
    return `<Assign DisplayName="${dispName}"${cleanAttrs ? " " + cleanAttrs : ""}>
              <Assign.To><OutArgument x:TypeArguments="x:String">${wrappedTo}</OutArgument></Assign.To>
              <Assign.Value><InArgument x:TypeArguments="x:String">${wrappedVal}</InArgument></Assign.Value>
            </Assign>`;
  });

  xml = xml.replace(/<(While)\s+([^>]*?)\/>/g, (match, tag, attrs) => {
    return `<${tag} ${attrs}>
              <${tag}.Body>
                <Sequence DisplayName="While Body" />
              </${tag}.Body>
            </${tag}>`;
  });
  xml = xml.replace(/<(RetryScope)\s+([^>]*?)\/>/g, (match, tag, attrs) => {
    return `<ui:${tag} ${attrs}>
              <ui:${tag}.Body>
                <Sequence DisplayName="Retry Body" />
              </ui:${tag}.Body>
              <ui:${tag}.Condition>
                <ui:ShouldRetry />
              </ui:${tag}.Condition>
            </ui:${tag}>`;
  });

  xml = xml.replace(/<ui:InvokeWorkflowFile\s([^>]*?)Input="([^"]*)"([^>]*?)(\/?>)/g, (match, before, inputVal, after, closing) => {
    let argElements = parseInvokeArgs(inputVal, "In");
    const outputMatch = (before + after).match(/Output="([^"]*)"/);
    if (outputMatch) {
      argElements += parseInvokeArgs(outputMatch[1], "Out");
      before = before.replace(/\s*Output="[^"]*"/, "");
      after = after.replace(/\s*Output="[^"]*"/, "");
    }
    if (argElements) {
      const attrs = (before + after).trim();
      return `<ui:InvokeWorkflowFile ${attrs}>\n              <ui:InvokeWorkflowFile.Arguments>\n${argElements}              </ui:InvokeWorkflowFile.Arguments>\n            </ui:InvokeWorkflowFile>`;
    }
    return `<ui:InvokeWorkflowFile ${(before + after).trim()}${closing}`;
  });
  xml = xml.replace(/<ui:InvokeWorkflowFile\s([^>]*?)Output="([^"]*)"([^>]*?)(\/?>)/g, (match, before, outputVal, after, closing) => {
    if (match.includes("InvokeWorkflowFile.Arguments")) return match;
    const argElements = parseInvokeArgs(outputVal, "Out");
    if (argElements) {
      const attrs = (before + after).trim();
      return `<ui:InvokeWorkflowFile ${attrs}>\n              <ui:InvokeWorkflowFile.Arguments>\n${argElements}              </ui:InvokeWorkflowFile.Arguments>\n            </ui:InvokeWorkflowFile>`;
    }
    return `<ui:InvokeWorkflowFile ${(before + after).trim()}${closing}`;
  });

  xml = xml.replace(/<ui:TakeScreenshot\s+([^>]*?)OutputPath="([^"]*)"([^>]*?)\/>/g, (_match, before, _outputPathVal, after) => {
    const attrs = (before + after).trim();
    return `<ui:TakeScreenshot ${attrs} />`;
  });

  const httpClientPrefixes = ["ui", "uweb"];
  for (const hcp of httpClientPrefixes) {
    xml = xml.replace(new RegExp(`<(${hcp}:HttpClient\\s)([^>]*?)>`, "g"), (match, prefix, attrs) => {
      let fixed = attrs;
      fixed = fixed.replace(/\bURL="([^"]*)"/g, (m: string, val: string) => {
        if (val.startsWith("[")) return `Endpoint="${escapeXml(val)}"`;
        if (/^[a-zA-Z_]\w*$/.test(val)) return `Endpoint="[${val}]"`;
        return `Endpoint="[&quot;${escapeXml(val).replace(/&quot;/g, '&quot;&quot;')}&quot;]"`;
      });
      fixed = fixed.replace(/\bEndPoint="([^"]*)"/g, (m: string, val: string) => {
        if (val.startsWith("[")) return `Endpoint="${escapeXml(val)}"`;
        if (/^[a-zA-Z_]\w*$/.test(val)) return `Endpoint="[${val}]"`;
        return `Endpoint="[&quot;${escapeXml(val).replace(/&quot;/g, '&quot;&quot;')}&quot;]"`;
      });
      if (/\bEndpoint=""/.test(fixed)) {
        console.error(`[XAML Compliance] HttpClient has empty Endpoint="" — this indicates a generation error. The activity will not function correctly in UiPath Studio.`);
      }
      fixed = fixed.replace(/\bOutput="([^"]*)"/g, (m: string, val: string) => {
        if (val.startsWith("[")) return `ResponseContent="${escapeXml(val)}"`;
        if (/^[a-zA-Z_]\w*$/.test(val)) return `ResponseContent="[${val}]"`;
        return `ResponseContent="[str_HttpResponse]"`;
      });
      fixed = fixed.replace(/\bEndpoint="([^"]*)"/g, (m: string, val: string) => {
        if (!val) return m;
        if (val.startsWith("[")) return m;
        if (/^[a-zA-Z_]\w*$/.test(val)) return `Endpoint="[${val}]"`;
        if (val.startsWith("&quot;") || val.startsWith("http")) return `Endpoint="[&quot;${escapeXml(val).replace(/&quot;/g, '')}&quot;]"`;
        return m;
      });
      fixed = fixed.replace(/\bResponseType="[^"]*"/g, "");
      fixed = fixed.replace(/\bHeaders="\{([^"]*)\}"/g, (hm: string, jsonContent: string) => {
        const decoded = jsonContent.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
        const pairs: string[] = [];
        const pairPattern = /"([^"]+)"\s*:\s*"([^"]*)"/g;
        let pm;
        while ((pm = pairPattern.exec(decoded)) !== null) {
          pairs.push(`{&quot;${escapeXml(pm[1])}&quot;, &quot;${escapeXml(pm[2])}&quot;}`);
        }
        if (pairs.length > 0) {
          return `Headers="[New Dictionary(Of String, String) From {${pairs.join(", ")}}]"`;
        }
        return "";
      });
      fixed = fixed.replace(/\s{2,}/g, " ");
      return `<${prefix}${fixed}>`;
    });
  }


  xml = xml.replace(/<(InArgument|OutArgument)([^>]*)>\s*<\1([^>]*)>([^<]*)<\/\1>\s*<\/\1>/g, (_m, tag, outerAttrs, innerAttrs, content) => {
    const attrs = (innerAttrs || outerAttrs).trim();
    return `<${tag}${attrs ? " " + attrs : ""}>${content}</${tag}>`;
  });

  xml = xml.replace(/<(InArgument|OutArgument)([^>]*)>\s*\n\s*<\1([^>]*)>([^<]*)<\/\1>\s*\n\s*<\/\1>/g, (_m, tag, outerAttrs, innerAttrs, content) => {
    const attrs = (innerAttrs || outerAttrs).trim();
    return `<${tag}${attrs ? " " + attrs : ""}>${content}</${tag}>`;
  });

  xml = collapseDoubledArgumentsXmlParser(xml);

  xml = fixBareVariableRefsInExpressionAttributes(xml);

  xml = ensureVariableDeclarations(xml);

  xml = xml.replace(/WorkflowFileName="Workflows\\([^"]+)"/g, 'WorkflowFileName="$1"');
  xml = xml.replace(/WorkflowFileName="Workflows\/([^"]+)"/g, 'WorkflowFileName="$1"');
  xml = xml.replace(/WorkflowFileName="([^"]+)"/g, (_match: string, p1: string) => {
    const cleaned = p1.replace(/\\/g, "/").replace(/^[./]+/, "");
    return `WorkflowFileName="${cleaned}"`;
  });

  xml = xml.replace(/<Assign\.To>\s*<OutArgument([^>]*)>([^<]*)<\/OutArgument>\s*<\/Assign\.To>/g, (_match, attrs, expr) => {
    const wrappedExpr = ensureBracketWrapped(expr);
    return `<Assign.To><OutArgument${attrs}>${wrappedExpr}</OutArgument></Assign.To>`;
  });

  xml = xml.replace(/<Assign\.Value>\s*<InArgument([^>]*)>([^<]*)<\/InArgument>\s*<\/Assign\.Value>/g, (_match, attrs, expr) => {
    const wrappedExpr = smartBracketWrap(expr);
    return `<Assign.Value><InArgument${attrs}>${wrappedExpr}</InArgument></Assign.Value>`;
  });

  xml = xml.replace(/<(\w+(?::\w+)?\.[\w.]+)>\s*<OutArgument([^>]*)>([^<]*)<\/OutArgument>\s*<\/\1>/g, (_match, propTag, attrs, expr) => {
    if (propTag.startsWith("Assign.")) return _match;
    const wrappedExpr = ensureBracketWrapped(expr);
    return `<${propTag}><OutArgument${attrs}>${wrappedExpr}</OutArgument></${propTag}>`;
  });

  xml = xml.replace(/<(\w+(?::\w+)?\.[\w.]+)>\s*<InArgument([^>]*)>([^<]*)<\/InArgument>\s*<\/\1>/g, (_match, propTag, attrs, expr) => {
    if (propTag.startsWith("Assign.")) return _match;
    const wrappedExpr = smartBracketWrap(expr);
    return `<${propTag}><InArgument${attrs}>${wrappedExpr}</InArgument></${propTag}>`;
  });

  for (const sysActivity of Array.from(SYSTEM_ACTIVITIES_NO_PREFIX)) {
    const escaped = sysActivity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    xml = xml.replace(new RegExp(`<ui:${escaped}(\\s|>|\\/)`, "g"), `<${sysActivity}$1`);
    xml = xml.replace(new RegExp(`<\\/ui:${escaped}>`, "g"), `</${sysActivity}>`);
    xml = xml.replace(new RegExp(`<ui:${escaped}\\.`, "g"), `<${sysActivity}.`);
    xml = xml.replace(new RegExp(`<\\/ui:${escaped}\\.`, "g"), `</${sysActivity}.`);
  }

  xml = ensureVariableDeclarations(xml);

  const nsValidation = validateNamespacePrefixes(xml);
  if (!nsValidation.valid) {
    for (const err of nsValidation.errors) {
      console.error(`[XAML Compliance] Namespace validation: ${err}`);
    }
    const nsMessage = `XAML namespace validation failed: ${nsValidation.errors.join("; ")}`;
    console.warn(`[XAML Compliance] Namespace failure will trigger auto-downgrade path: ${nsMessage}`);
    throw new QualityGateError(nsMessage, {
      passed: false,
      violations: nsValidation.errors.map(e => ({
        check: "namespace-prefix-undeclared",
        severity: "error" as const,
        category: "completeness" as const,
        file: "Main.xaml",
        detail: e,
      })),
      positiveEvidence: [],
      completenessLevel: "incomplete" as const,
      summary: {
        blockedPatterns: 0,
        completenessErrors: nsValidation.errors.length,
        completenessWarnings: 0,
        accuracyErrors: 0,
        accuracyWarnings: 0,
        runtimeSafetyErrors: 0,
        runtimeSafetyWarnings: 0,
        logicLocationWarnings: 0,
        totalErrors: nsValidation.errors.length,
        totalWarnings: 0,
      },
    });
  }

  const semanticValidation = validateActivityTagSemantics(xml);
  if (semanticValidation.repairedXml !== xml) {
    console.log(`[XAML Compliance] Auto-repaired System.Activities prefix mismatches`);
    xml = semanticValidation.repairedXml;
  }
  if (semanticValidation.warnings.length > 0) {
    for (const warn of semanticValidation.warnings) {
      console.warn(`[XAML Compliance] Activity tag warning: ${warn}`);
    }
  }
  if (!semanticValidation.valid) {
    for (const err of semanticValidation.errors) {
      console.error(`[XAML Compliance] Activity tag semantic error: ${err}`);
    }
    throw new Error(`XAML activity tag semantic validation failed: ${semanticValidation.errors.join("; ")}`);
  }

  const xmlValidation = validateXmlWellFormedness(xml);
  if (!xmlValidation.valid) {
    for (const err of xmlValidation.errors) {
      console.error(`[XAML Compliance] XML well-formedness: ${err}`);
    }
    throw new Error(`XAML XML well-formedness validation failed: ${xmlValidation.errors.join("; ")}`);
  }

  return xml;
}
