import { escapeXml } from "../lib/xml-utils";
import { ACTIVITY_NAME_ALIAS_MAP } from "../uipath-activity-registry";

export type TargetFramework = "Windows" | "Portable";

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
  const argTags = ["InArgument", "OutArgument"];
  for (const tag of argTags) {
    const outerOpenPattern = new RegExp(
      `<${tag}(\\s[^>]*)?>\\s*<${tag}(\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>\\s*<\\/${tag}>`,
      "g"
    );
    xml = xml.replace(outerOpenPattern, (_match, outerAttrs, innerAttrs, content) => {
      const attrs = ((innerAttrs || outerAttrs) || "").trim();
      const trimmedContent = content.trim();
      return `<${tag}${attrs ? " " + attrs : ""}>${trimmedContent}</${tag}>`;
    });
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
  "gmailAppPassword": "s:SecureString",
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
  if (lower.startsWith("dt_") || lower.startsWith("datatable_")) return "s:DataTable";
  if (lower.startsWith("qi_")) return "ui:QueueItem";
  if (lower.startsWith("dic_") || lower.startsWith("dict_")) return "scg:Dictionary(x:String, x:Object)";
  if (lower.startsWith("arr_")) return "s:String[]";
  if (lower.startsWith("img_")) return "ui:Image";
  if (lower.startsWith("dbl_") || lower.startsWith("dec_")) return "x:Double";
  if (lower.startsWith("obj_")) return "x:Object";
  if (lower.startsWith("row_")) return "scg2:DataRow";
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
  for (const [varName, refIdx] of referencedVarsWithPos) {
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

  const activityTagPattern = /<(Sequence|If|TryCatch|ForEach|Assign|State|StateMachine|Transition|Flowchart|FlowStep|FlowDecision|ui:[A-Za-z]+)\s+((?:[^>]*?\s+)?)DisplayName="([^"]*)"([^>]*?)(\s*\/?>)/g;
  xml = xml.replace(activityTagPattern, (match, tag, preAttrs, displayName, rest, closing) => {
    if (preAttrs.includes("WorkflowViewState.IdRef") || rest.includes("WorkflowViewState.IdRef")) return match;
    const prefix = tag.replace("ui:", "").replace(/[^A-Za-z]/g, "");
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

  xml = xml.replace(/Message="'([^']*)'"/g, 'Message="[&quot;$1&quot;]"');
  xml = xml.replace(/Default="'([^']*)'"/g, 'Default="[&quot;$1&quot;]"');

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

  xml = xml.replace(/<sap:WorkflowViewState\.ViewStateManager>[\s\S]*?<\/sap:WorkflowViewState\.ViewStateManager>/g, "");
  xml = xml.replace(/<WorkflowViewState\.ViewStateManager>[\s\S]*?<\/WorkflowViewState\.ViewStateManager>/g, "");

  xml = xml.replace(/<ui:ExcelApplicationScope\.Body>\s*(?!<ActivityAction)<Sequence\s/g, () => {
    return `<ui:ExcelApplicationScope.Body>\n        <ActivityAction x:TypeArguments="x:Object">\n          <ActivityAction.Handler>\n            <Sequence `;
  });
  if (xml.includes("<ui:ExcelApplicationScope.Body>") && !xml.includes("<ActivityAction.Handler>")) {
    xml = xml.replace(/<\/Sequence>\s*<\/ui:ExcelApplicationScope\.Body>/g,
      `</Sequence>\n          </ActivityAction.Handler>\n        </ActivityAction>\n      </ui:ExcelApplicationScope.Body>`);
  }

  if (isCrossPlatform) {
    xml = xml.replace(/Condition="\[(\w+) IsNot Nothing\]"/g, 'Condition="[$1 != null]"');
    xml = xml.replace(/Condition="\[(\w+) Is Nothing\]"/g, 'Condition="[$1 == null]"');
    xml = xml.replace(/Condition="\[Not (\w+)\]"/g, 'Condition="[!$1]"');

    xml = xml.replace(/Condition="\[(\w+) = &quot;([^&]*)&quot;\]"/g, 'Condition="[$1 == &quot;$2&quot;]"');

    xml = xml.replace(/\.ToString(?!\()/g, ".ToString()");

    xml = xml.replace(/ &amp; /g, " + ");
  }

  const UIPATH_ACTIVITIES_NEEDING_PREFIX = [
    "InvokeWorkflowFile", "RetryScope", "AddQueueItem", "GetTransactionItem",
    "SetTransactionStatus", "LogMessage", "GetCredential", "GetAsset",
    "TakeScreenshot", "AddLogFields", "HttpClient", "DeserializeJson",
    "SerializeJson", "Comment", "ShouldRetry", "SendSmtpMailMessage",
    "SendOutlookMailMessage", "GetImapMailMessage", "GetOutlookMailMessages",
    "SendMail", "GetMail", "ExcelApplicationScope", "UseExcel",
    "ExcelReadRange", "ExcelWriteRange", "ExcelWriteCell", "ReadRange",
    "WriteRange", "ElementExists", "Click", "TypeInto", "GetText",
    "OpenBrowser", "NavigateTo", "AttachBrowser", "AttachWindow",
    "UseApplicationBrowser", "UseBrowser", "UseApplication",
    "ExecuteQuery", "ExecuteNonQuery", "ConnectToDatabase",
    "ReadTextFile", "WriteTextFile", "PathExists",
    "CreateFormTask", "WaitForFormTaskAndResume",
    "MLSkill", "Predict",
    "DigitizeDocument", "ClassifyDocument", "ExtractDocumentData", "ValidateDocumentData",
    "Rethrow",
  ];
  for (const actName of UIPATH_ACTIVITIES_NEEDING_PREFIX) {
    const openPattern = new RegExp(`<(?!ui:)${actName}(\\s|>|\\/)`, "g");
    xml = xml.replace(openPattern, `<ui:${actName}$1`);
    const closePattern = new RegExp(`<\\/(?!ui:)${actName}>`, "g");
    xml = xml.replace(closePattern, `</ui:${actName}>`);
  }

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

  xml = xml.replace(/<(ui:HttpClient\s)([^>]*?)>/g, (match, prefix, attrs) => {
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
    fixed = fixed.replace(/\bOutput="([^"]*)"/g, (m: string, val: string) => {
      if (val.startsWith("[")) return `ResponseContent="${escapeXml(val)}"`;
      if (/^[a-zA-Z_]\w*$/.test(val)) return `ResponseContent="[${val}]"`;
      return `ResponseContent="[str_HttpResponse]"`;
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


  xml = xml.replace(/<(InArgument|OutArgument)([^>]*)>\s*<\1([^>]*)>([^<]*)<\/\1>\s*<\/\1>/g, (_m, tag, outerAttrs, innerAttrs, content) => {
    const attrs = (innerAttrs || outerAttrs).trim();
    return `<${tag}${attrs ? " " + attrs : ""}>${content}</${tag}>`;
  });

  xml = xml.replace(/<(InArgument|OutArgument)([^>]*)>\s*\n\s*<\1([^>]*)>([^<]*)<\/\1>\s*\n\s*<\/\1>/g, (_m, tag, outerAttrs, innerAttrs, content) => {
    const attrs = (innerAttrs || outerAttrs).trim();
    return `<${tag}${attrs ? " " + attrs : ""}>${content}</${tag}>`;
  });

  xml = collapseDoubledArgumentsXmlParser(xml);

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

  xml = ensureVariableDeclarations(xml);

  return xml;
}
