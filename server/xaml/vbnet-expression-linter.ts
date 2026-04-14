import type { QualityGateViolation } from "../uipath-quality-gate";

export interface ExpressionLocation {
  file: string;
  line: number;
  expression: string;
  context: string;
}

export interface LintResult {
  original: string;
  corrected: string | null;
  issues: LintIssue[];
}

export interface LintIssue {
  code: string;
  message: string;
  autoFixed: boolean;
}

const VB_KEYWORDS = new Set([
  "True", "False", "Nothing", "New", "Not", "And", "Or", "AndAlso", "OrElse",
  "Is", "IsNot", "Like", "Mod", "Xor", "If", "Then", "Else", "ElseIf",
  "End", "Sub", "Function", "Dim", "As", "Of", "In", "To", "Step",
  "For", "Each", "Next", "While", "Do", "Loop", "Until", "Wend",
  "Select", "Case", "With", "Using", "Try", "Catch", "Finally", "Throw",
  "Return", "Exit", "Continue", "GoTo", "ReDim", "Preserve", "From",
  "ByVal", "ByRef", "Optional", "ParamArray",
  "Public", "Private", "Protected", "Friend", "Shared", "Static",
  "ReadOnly", "WriteOnly", "Overrides", "Overridable", "MustOverride",
  "Imports", "Namespace", "Class", "Structure", "Interface", "Enum",
  "Property", "Get", "Set", "AddHandler", "RemoveHandler", "RaiseEvent",
  "Implements", "Inherits", "MyBase", "MyClass", "Me",
  "TypeOf", "GetType", "DirectCast", "TryCast", "CType",
  "CBool", "CByte", "CChar", "CDate", "CDbl", "CDec", "CInt", "CLng",
  "CObj", "CSByte", "CShort", "CSng", "CStr", "CUInt", "CULng", "CUShort",
  "AddressOf", "Date", "Decimal", "Double", "Single",
]);

const VB_BUILTIN_TYPES = new Set([
  "String", "Integer", "Boolean", "DateTime", "TimeSpan", "Object",
  "Int32", "Int64", "Double", "Decimal", "Byte", "SByte", "Short",
  "UShort", "UInteger", "ULong", "Long", "Single", "Char", "Date",
  "DataTable", "DataRow", "DataColumn",
  "Array", "List", "Dictionary", "HashSet", "Queue", "Stack",
  "Exception", "Math", "Convert", "Environment", "Regex",
  "StringBuilder", "StreamReader", "StreamWriter",
  "File", "Directory", "Path", "Console",
  "System", "Microsoft", "UiPath",
  "StringComparer", "TimeZoneInfo", "Guid", "Encoding", "Uri",
  "Activator", "Enumerable", "Queryable", "Task", "CancellationToken",
  "JsonConvert", "JObject", "JArray", "JToken",
  "SecureString", "NetworkCredential",
  "Type", "Nullable", "Tuple", "KeyValuePair",
  "Process", "Thread", "Monitor", "Interlocked",
  "HttpClient", "WebClient", "WebRequest", "WebResponse",
  "MailMessage", "SmtpClient",
  "XDocument", "XElement", "XmlDocument", "XmlNode",
  "Enumeration", "BitConverter", "Buffer",
]);

const VB_BUILTIN_FUNCTIONS = new Set([
  "CType", "CStr", "CInt", "CDbl", "CDec", "CBool", "CLng", "CDate",
  "CObj", "CSng", "CShort", "CByte", "CChar", "CSByte", "CUInt",
  "CULng", "CUShort", "DirectCast", "TryCast",
  "Len", "Mid", "Left", "Right", "Trim", "LTrim", "RTrim",
  "UCase", "LCase", "InStr", "InStrRev", "Replace", "Split", "Join",
  "Val", "Str", "Chr", "Asc", "Format", "FormatNumber",
  "IsNumeric", "IsDate", "IsArray", "IsNothing", "IsDBNull",
  "Now", "Today", "DateAdd", "DateDiff", "DatePart",
  "Year", "Month", "Day", "Hour", "Minute", "Second",
  "Abs", "Int", "Fix", "Round", "Rnd", "Sgn", "Sqr",
  "IIf", "Choose", "Switch",
  "MsgBox", "InputBox",
  "TypeOf", "GetType", "NameOf",
]);

function replaceOutsideStrings(input: string, pattern: RegExp, replacement: string | ((...args: string[]) => string)): string {
  const segments: { text: string; isString: boolean }[] = [];
  let current = 0;
  const stringPattern = /"(?:[^"]|"")*"/g;
  let sm;
  while ((sm = stringPattern.exec(input)) !== null) {
    if (sm.index > current) {
      segments.push({ text: input.substring(current, sm.index), isString: false });
    }
    segments.push({ text: sm[0], isString: true });
    current = sm.index + sm[0].length;
  }
  if (current < input.length) {
    segments.push({ text: input.substring(current), isString: false });
  }

  return segments.map(seg => {
    if (seg.isString) return seg.text;
    const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
    const globalPattern = new RegExp(pattern.source, flags);
    if (typeof replacement === "function") {
      return seg.text.replace(globalPattern, replacement as (...args: string[]) => string);
    }
    return seg.text.replace(globalPattern, replacement);
  }).join("");
}

function testOutsideStrings(input: string, pattern: RegExp): boolean {
  const stringPattern = /"(?:[^"]|"")*"/g;
  const withoutStrings = input.replace(stringPattern, (m) => " ".repeat(m.length));
  return pattern.test(withoutStrings);
}

function looksLikeLogMessageText(expr: string): boolean {
  if (/\u2014/.test(expr)) return true;
  if (/^\[[\w]+\]\s+[A-Z]+\s/.test(expr)) return true;
  if (/\b(WARN|INFO|ERROR|DEBUG|TRACE|FATAL)\b/.test(expr) && /\s{2,}|\u2014|—/.test(expr)) return true;
  const words = expr.split(/\s+/);
  if (words.length >= 5 && /[a-z]/.test(expr) && !/[()=<>&|]/.test(expr) && /[.,!?;:'"…\-]/.test(expr)) return true;
  return false;
}

function looksLikeFilenameOrUrl(expr: string): boolean {
  if (/^[\w./-]+\.\w{1,5}$/.test(expr.trim())) return true;
  if (/^[\w./-]+(\/[\w./-]+){2,}/.test(expr.trim())) return true;
  if (/^\w+\/v\d+\//.test(expr.trim())) return true;
  return false;
}

function looksLikeHandoffContent(expr: string): boolean {
  if (/\bHANDOFF_\w+/.test(expr)) return true;
  if (/\[HANDOFF\]/i.test(expr)) return true;
  if (/\bHANDOFF\b/i.test(expr) && /placeholder|replace|TODO|binding|content/i.test(expr)) return true;
  if (/\bSTUB_\w+/.test(expr)) return true;
  if (/\bASSEMBLY_FAILED\b/.test(expr)) return true;
  if (/\bPLACEHOLDER_\w+/.test(expr)) return true;
  return false;
}

export function extractExpressions(xamlContent: string, fileName: string): ExpressionLocation[] {
  const results: ExpressionLocation[] = [];
  const lines = xamlContent.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const attrPattern = /="\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]"/g;
    let m;
    while ((m = attrPattern.exec(line)) !== null) {
      const expr = m[1];
      if (!expr || expr.startsWith("&quot;") || expr.startsWith("\"")) continue;
      if (/^x:|^xmlns:|^mc:|^sap/.test(expr)) continue;
      if (looksLikeLogMessageText(expr)) continue;
      if (looksLikeFilenameOrUrl(expr)) continue;
      if (looksLikeHandoffContent(expr)) continue;
      results.push({
        file: fileName,
        line: i + 1,
        expression: expr,
        context: line.trim().substring(0, 120),
      });
    }

    const vbValuePattern = /<\s*(?:InArgument|OutArgument|InOutArgument)[^>]*>\s*\[([^\]]+(?:\[[^\]]*\][^\]]*)*)\]\s*<\//g;
    while ((m = vbValuePattern.exec(line)) !== null) {
      const expr = m[1];
      if (!expr) continue;
      results.push({
        file: fileName,
        line: i + 1,
        expression: expr,
        context: line.trim().substring(0, 120),
      });
    }
  }

  const multilineArgPattern = /<\s*(?:InArgument|OutArgument|InOutArgument)[^>]*>\s*\n\s*\[([^\]]+(?:\[[^\]]*\][^\]]*)*)\]\s*\n/g;
  let mm;
  while ((mm = multilineArgPattern.exec(xamlContent)) !== null) {
    const expr = mm[1];
    if (!expr) continue;
    const lineNum = xamlContent.substring(0, mm.index).split("\n").length;
    const alreadyFound = results.some(r => r.expression === expr && Math.abs(r.line - lineNum) <= 2);
    if (!alreadyFound) {
      results.push({
        file: fileName,
        line: lineNum,
        expression: expr,
        context: expr.substring(0, 120),
      });
    }
  }

  const vbValuePattern = /<mva:VisualBasicValue[^>]*Expression(?:Text)?="([^"]+)"/g;
  while ((mm = vbValuePattern.exec(xamlContent)) !== null) {
    const expr = mm[1];
    if (!expr) continue;
    const lineNum = xamlContent.substring(0, mm.index).split("\n").length;
    const alreadyFound = results.some(r => r.expression === expr && Math.abs(r.line - lineNum) <= 2);
    if (!alreadyFound) {
      results.push({
        file: fileName,
        line: lineNum,
        expression: expr,
        context: expr.substring(0, 120),
      });
    }
  }

  const vbRefPattern = /<mva:VisualBasicReference[^>]*Expression(?:Text)?="([^"]+)"/g;
  while ((mm = vbRefPattern.exec(xamlContent)) !== null) {
    const expr = mm[1];
    if (!expr) continue;
    const lineNum = xamlContent.substring(0, mm.index).split("\n").length;
    const alreadyFound = results.some(r => r.expression === expr && Math.abs(r.line - lineNum) <= 2);
    if (!alreadyFound) {
      results.push({
        file: fileName,
        line: lineNum,
        expression: expr,
        context: expr.substring(0, 120),
      });
    }
  }

  const genericBracketPattern = />(\s*)\[([^\]]+(?:\[[^\]]*\][^\]]*)*)\](\s*)</g;
  while ((mm = genericBracketPattern.exec(xamlContent)) !== null) {
    const expr = mm[2];
    if (!expr) continue;
    if (expr.startsWith("&quot;") || expr.startsWith("\"")) continue;
    if (looksLikeLogMessageText(expr)) continue;
    if (looksLikeFilenameOrUrl(expr)) continue;
    if (looksLikeHandoffContent(expr)) continue;
    const lineNum = xamlContent.substring(0, mm.index).split("\n").length;
    const alreadyFound = results.some(r => r.expression === expr && Math.abs(r.line - lineNum) <= 2);
    if (!alreadyFound) {
      results.push({
        file: fileName,
        line: lineNum,
        expression: expr,
        context: expr.substring(0, 120),
      });
    }
  }

  return results;
}

const FUNCTION_SIGNATURES: Record<string, { minArgs: number; maxArgs: number }> = {
  "CType": { minArgs: 2, maxArgs: 2 },
  "CStr": { minArgs: 1, maxArgs: 1 },
  "CInt": { minArgs: 1, maxArgs: 1 },
  "CDbl": { minArgs: 1, maxArgs: 1 },
  "CDec": { minArgs: 1, maxArgs: 1 },
  "CBool": { minArgs: 1, maxArgs: 1 },
  "CLng": { minArgs: 1, maxArgs: 1 },
  "CDate": { minArgs: 1, maxArgs: 1 },
  "CObj": { minArgs: 1, maxArgs: 1 },
  "DirectCast": { minArgs: 2, maxArgs: 2 },
  "TryCast": { minArgs: 2, maxArgs: 2 },
};

function countFunctionArgs(body: string): number {
  if (!body.trim()) return 0;
  let depth = 0;
  let count = 1;
  let inQuote = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuote) {
      if (ch === '"' && i + 1 < body.length && body[i + 1] === '"') {
        i++;
      } else if (ch === '"') {
        inQuote = false;
      }
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      continue;
    }
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) count++;
  }
  return count;
}

function splitFormatArgs(body: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  let inQuote = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuote) {
      current += ch;
      if (ch === '"' && i + 1 < body.length && body[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      }
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;

    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function canSafelyDecomposeStringFormat(formatStr: string, args: string[]): boolean {
  let raw = formatStr.trim();
  if (raw.startsWith('"') && raw.endsWith('"')) {
    raw = raw.substring(1, raw.length - 1);
  } else if (raw.startsWith('&quot;') && raw.endsWith('&quot;')) {
    raw = raw.substring(6, raw.length - 6);
  }

  for (const arg of args) {
    const trimmed = arg.trim();
    let depth = 0;
    for (const ch of trimmed) {
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
    }
    if (depth !== 0) return false;
  }

  const escaped = raw.replace(/\{\{/g, "").replace(/\}\}/g, "");
  const unmatched = escaped.replace(/\{(\d+)(?:,(-?\d+))?(?::([^}]*))?\}/g, "");
  if (unmatched.includes("{") || unmatched.includes("}")) return false;

  return true;
}

function buildConcatFromStringFormat(formatStr: string, args: string[]): string {
  if (!canSafelyDecomposeStringFormat(formatStr, args)) {
    throw new Error(`Cannot safely decompose String.Format: unbalanced parens in arguments or unmatched braces in format string`);
  }

  let raw = formatStr.trim();
  if (raw.startsWith('"') && raw.endsWith('"')) {
    raw = raw.substring(1, raw.length - 1);
  } else if (raw.startsWith('&quot;') && raw.endsWith('&quot;')) {
    raw = raw.substring(6, raw.length - 6);
  }

  raw = raw.replace(/\{\{/g, "\x00LBRACE\x00").replace(/\}\}/g, "\x00RBRACE\x00");

  const placeholderRegex = /\{(\d+)(?:,(-?\d+))?(?::([^}]*))?\}/g;
  let lastEnd = 0;
  const parts: string[] = [];
  let match;

  while ((match = placeholderRegex.exec(raw)) !== null) {
    const literal = raw.substring(lastEnd, match.index)
      .replace(/\x00LBRACE\x00/g, "{").replace(/\x00RBRACE\x00/g, "}");
    if (literal) {
      parts.push(`"${literal}"`);
    }
    const argIdx = parseInt(match[1], 10);
    const alignment = match[2];
    const formatSpec = match[3];
    if (argIdx < args.length) {
      if (formatSpec || alignment) {
        const miniFormat = `{0${alignment ? "," + alignment : ""}${formatSpec ? ":" + formatSpec : ""}}`;
        parts.push(`String.Format("${miniFormat}", ${args[argIdx]})`);
      } else {
        parts.push(`CStr(${args[argIdx]})`);
      }
    } else {
      parts.push(`"[MISSING_ARG_${argIdx}]"`);
    }
    lastEnd = match.index + match[0].length;
  }

  const trailing = raw.substring(lastEnd)
    .replace(/\x00LBRACE\x00/g, "{").replace(/\x00RBRACE\x00/g, "}");
  if (trailing) {
    parts.push(`"${trailing}"`);
  }

  if (parts.length === 0) return '""';

  return parts.join(" & ");
}

function validateFunctionCalls(expression: string, issues: LintIssue[]): void {
  const funcCallPattern = /\b([A-Za-z_]\w*)\s*\(/g;
  let m;
  while ((m = funcCallPattern.exec(expression)) !== null) {
    const funcName = m[1];
    const sig = FUNCTION_SIGNATURES[funcName];
    if (!sig) continue;

    const startIdx = m.index + m[0].length;
    let depth = 1;
    let endIdx = startIdx;
    for (let i = startIdx; i < expression.length && depth > 0; i++) {
      if (expression[i] === "(") depth++;
      else if (expression[i] === ")") depth--;
      if (depth === 0) { endIdx = i; break; }
    }

    if (depth !== 0) {
      issues.push({
        code: "FUNC_UNBALANCED",
        message: `${funcName}() has unbalanced parentheses`,
        autoFixed: false,
      });
      continue;
    }

    const body = expression.substring(startIdx, endIdx);
    const argCount = countFunctionArgs(body);

    if (argCount < sig.minArgs || argCount > sig.maxArgs) {
      const expected = sig.minArgs === sig.maxArgs
        ? `${sig.minArgs}`
        : `${sig.minArgs}-${sig.maxArgs}`;
      issues.push({
        code: "FUNC_ARG_COUNT",
        message: `${funcName}() expects ${expected} argument(s) but got ${argCount}`,
        autoFixed: false,
      });
    }
  }

  const METHOD_SIGNATURES: Record<string, { minArgs: number; maxArgs: number }> = {
    "ToString": { minArgs: 0, maxArgs: 2 },
    "Trim": { minArgs: 0, maxArgs: 1 },
    "Split": { minArgs: 1, maxArgs: 6 },
    "Substring": { minArgs: 1, maxArgs: 2 },
    "Replace": { minArgs: 2, maxArgs: 2 },
    "Contains": { minArgs: 1, maxArgs: 1 },
    "StartsWith": { minArgs: 1, maxArgs: 2 },
    "EndsWith": { minArgs: 1, maxArgs: 2 },
    "IndexOf": { minArgs: 1, maxArgs: 3 },
    "ToUpper": { minArgs: 0, maxArgs: 0 },
    "ToLower": { minArgs: 0, maxArgs: 0 },
    "PadLeft": { minArgs: 1, maxArgs: 2 },
    "PadRight": { minArgs: 1, maxArgs: 2 },
  };

  const STATIC_METHOD_SIGNATURES: Record<string, { minArgs: number; maxArgs: number }> = {
    "String.Format": { minArgs: 2, maxArgs: 10 },
    "String.IsNullOrEmpty": { minArgs: 1, maxArgs: 1 },
    "String.IsNullOrWhiteSpace": { minArgs: 1, maxArgs: 1 },
    "String.Concat": { minArgs: 2, maxArgs: 10 },
    "String.Join": { minArgs: 2, maxArgs: 2 },
    "Convert.ToInt32": { minArgs: 1, maxArgs: 1 },
    "Convert.ToInt64": { minArgs: 1, maxArgs: 1 },
    "Convert.ToDouble": { minArgs: 1, maxArgs: 1 },
    "Convert.ToDecimal": { minArgs: 1, maxArgs: 1 },
    "Convert.ToBoolean": { minArgs: 1, maxArgs: 1 },
    "Convert.ToString": { minArgs: 1, maxArgs: 1 },
    "Convert.ToDateTime": { minArgs: 1, maxArgs: 1 },
    "Math.Abs": { minArgs: 1, maxArgs: 1 },
    "Math.Round": { minArgs: 1, maxArgs: 2 },
    "Math.Max": { minArgs: 2, maxArgs: 2 },
    "Math.Min": { minArgs: 2, maxArgs: 2 },
    "Regex.Replace": { minArgs: 3, maxArgs: 4 },
  };

  const staticMatchPositions = new Set<number>();
  const staticPattern = /\b([A-Z]\w+\.\w+)\s*\(/g;
  while ((m = staticPattern.exec(expression)) !== null) {
    const fullName = m[1];
    const sig = STATIC_METHOD_SIGNATURES[fullName];
    if (!sig) {
      continue;
    }
    const dotIdx = fullName.indexOf(".");
    staticMatchPositions.add(m.index + dotIdx);

    const startIdx = m.index + m[0].length;
    let depth = 1;
    let endIdx = startIdx;
    for (let i = startIdx; i < expression.length && depth > 0; i++) {
      if (expression[i] === "(") depth++;
      else if (expression[i] === ")") depth--;
      if (depth === 0) { endIdx = i; break; }
    }

    if (depth !== 0) {
      issues.push({
        code: "FUNC_UNBALANCED",
        message: `${fullName}() has unbalanced parentheses`,
        autoFixed: false,
      });
      continue;
    }

    const body = expression.substring(startIdx, endIdx);
    const argCount = countFunctionArgs(body);

    if (argCount < sig.minArgs || argCount > sig.maxArgs) {
      const expected = sig.minArgs === sig.maxArgs
        ? `${sig.minArgs}`
        : `${sig.minArgs}-${sig.maxArgs}`;
      issues.push({
        code: "FUNC_ARG_COUNT",
        message: `${fullName}() expects ${expected} argument(s) but got ${argCount}`,
        autoFixed: false,
      });
    }
  }

  const methodPattern = /\.(\w+)\s*\(/g;
  while ((m = methodPattern.exec(expression)) !== null) {
    if (staticMatchPositions.has(m.index)) continue;
    const methodName = m[1];
    const startIdx = m.index + m[0].length;
    let depth = 1;
    let endIdx = startIdx;
    for (let i = startIdx; i < expression.length && depth > 0; i++) {
      if (expression[i] === "(") depth++;
      else if (expression[i] === ")") depth--;
      if (depth === 0) { endIdx = i; break; }
    }
    if (depth !== 0) {
      issues.push({
        code: "METHOD_UNBALANCED",
        message: `.${methodName}() has unbalanced parentheses`,
        autoFixed: false,
      });
      continue;
    }

    const methSig = METHOD_SIGNATURES[methodName];
    if (methSig) {
      const body = expression.substring(startIdx, endIdx);
      const argCount = countFunctionArgs(body);
      if (argCount < methSig.minArgs || argCount > methSig.maxArgs) {
        const expected = methSig.minArgs === methSig.maxArgs
          ? `${methSig.minArgs}`
          : `${methSig.minArgs}-${methSig.maxArgs}`;
        issues.push({
          code: "FUNC_ARG_COUNT",
          message: `.${methodName}() expects ${expected} argument(s) but got ${argCount}`,
          autoFixed: false,
        });
      }
    }
  }
}

export function isComplexExpression(expression: string): boolean {
  const stripped = expression.replace(/"(?:[^"\\]|\\.)*"/g, (m) => " ".repeat(m.length))
    .replace(/&quot;[^&]*&quot;/g, (m) => " ".repeat(m.length));
  if (/\bFunction\s*\(/.test(stripped) || /\bSub\s*\(/.test(stripped)) return true;
  if (/\bFrom\s+\w+\s+In\b/i.test(stripped) && /\b(Select|Where|Aggregate|Group|Order\s+By|Join|Let)\b/i.test(stripped)) return true;
  const operators = stripped.match(/(\bAndAlso\b|\bOrElse\b|\bAnd\b|\bOr\b|\bXor\b|[+\-*\/&<>=])/g) || [];
  if (operators.length >= 3) {
    const funcCallDepth = (stripped.match(/\w+\s*\(/g) || []).length;
    if (funcCallDepth >= 3) return true;
  }
  const nestedCalls = stripped.match(/\w+\s*\([^)]*\w+\s*\(/g);
  if (nestedCalls && nestedCalls.length >= 2 && operators.length >= 3) return true;
  return false;
}

export function lintExpression(expression: string): LintResult {
  const issues: LintIssue[] = [];
  let corrected = expression;
  let wasModified = false;

  if (looksLikeHandoffContent(expression)) {
    return {
      original: expression,
      corrected: null,
      issues: [],
    };
  }

  if (isComplexExpression(expression)) {
    issues.push({ code: "COMPLEX_EXPRESSION_PASSTHROUGH", message: "Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption", autoFixed: false });
    return {
      original: expression,
      corrected: null,
      issues,
    };
  }

  const applyFix = (code: string, message: string, pattern: RegExp, replacement: string | ((...args: string[]) => string)) => {
    if (testOutsideStrings(corrected, pattern)) {
      const before = corrected;
      corrected = replaceOutsideStrings(corrected, pattern, replacement);
      if (corrected !== before) {
        issues.push({ code, message, autoFixed: true });
        wasModified = true;
      }
    }
  };

  const reportOnly = (code: string, message: string) => {
    issues.push({ code, message, autoFixed: false });
  };

  if (/&amp;quot;/.test(corrected)) {
    const before = corrected;
    corrected = corrected.replace(/&amp;quot;/g, "&quot;");
    if (corrected !== before) {
      issues.push({ code: "DOUBLE_ENCODED_QUOT", message: "Double-encoded '&amp;quot;' corrected to '&quot;'", autoFixed: true });
      wasModified = true;
    }
  }

  if (/&amp;amp;/.test(corrected)) {
    const before = corrected;
    corrected = corrected.replace(/&amp;amp;/g, "&amp;");
    if (corrected !== before) {
      issues.push({ code: "DOUBLE_ENCODED_AMP", message: "Double-encoded '&amp;amp;' corrected to '&amp;'", autoFixed: true });
      wasModified = true;
    }
  }

  if (/&amp;lt;/.test(corrected)) {
    const before = corrected;
    corrected = corrected.replace(/&amp;lt;/g, "&lt;");
    if (corrected !== before) {
      issues.push({ code: "DOUBLE_ENCODED_LT", message: "Double-encoded '&amp;lt;' corrected to '&lt;'", autoFixed: true });
      wasModified = true;
    }
  }

  if (/&amp;gt;/.test(corrected)) {
    const before = corrected;
    corrected = corrected.replace(/&amp;gt;/g, "&gt;");
    if (corrected !== before) {
      issues.push({ code: "DOUBLE_ENCODED_GT", message: "Double-encoded '&amp;gt;' corrected to '&gt;'", autoFixed: true });
      wasModified = true;
    }
  }

  applyFix(
    "CSHARP_NULL",
    "C# 'null' should be VB.NET 'Nothing'",
    /\bnull\b/g,
    "Nothing"
  );

  applyFix(
    "CSHARP_NOT_EQUAL",
    "C# '!=' should be VB.NET '<>'",
    /!=/g,
    "<>"
  );

  applyFix(
    "CSHARP_AND",
    "C# '&&' should be VB.NET 'AndAlso'",
    /&&/g,
    " AndAlso "
  );

  applyFix(
    "CSHARP_OR",
    "C# '\\|\\|' should be VB.NET 'OrElse'",
    /\|\|/g,
    " OrElse "
  );

  applyFix(
    "CSHARP_NOT",
    "C# '!' prefix should be VB.NET 'Not'",
    /(?<![<>=])!(?!=)(?=[a-zA-Z_(])/g,
    "Not "
  );

  applyFix(
    "CSHARP_BOOL_TRUE",
    "C# 'true' should be VB.NET 'True'",
    /\btrue\b/g,
    "True"
  );

  applyFix(
    "CSHARP_BOOL_FALSE",
    "C# 'false' should be VB.NET 'False'",
    /\bfalse\b/g,
    "False"
  );

  if (testOutsideStrings(corrected, /=>/)) {
    const fullLambdaMatch = corrected.match(/^\s*\(([^)]*)\)\s*=>\s*(.+)\s*$/);
    if (fullLambdaMatch) {
      const params = fullLambdaMatch[1].trim();
      const body = fullLambdaMatch[2].trim();
      corrected = `Function(${params}) ${body}`;
      issues.push({ code: "CSHARP_LAMBDA", message: "C# lambda '=>' converted to VB.NET 'Function()'", autoFixed: true });
      wasModified = true;
    } else {
      reportOnly("CSHARP_LAMBDA_COMPLEX", "C# lambda '=>' detected but cannot auto-convert — rewrite as VB.NET Function()");
    }
  }

  if (/\+/.test(corrected)) {
    const hasStringContext = /"[^"]*"\s*\+/.test(corrected) || /\+\s*"[^"]*"/.test(corrected)
      || /\.ToString\(\)\s*\+/.test(corrected) || /\+\s*\w+\.ToString\(\)/.test(corrected)
      || /CStr\([^)]*\)\s*\+/.test(corrected)
      || /&quot;.*?&quot;\s*\+/.test(corrected) || /\+\s*&quot;.*?&quot;/.test(corrected)
      || /\.GetType\(\)\.Name\s*\+/.test(corrected)
      || /\.Name\s*\+\s*&quot;/.test(corrected) || /&quot;.*?&quot;\s*\+\s*\w+\.Message/.test(corrected)
      || /\bexception\w*\.Message/i.test(corrected) || /\bex\.Message/i.test(corrected)
      || /String\.Concat\b/.test(corrected);
    const isPureNumeric = /^\s*\d[\d.]*\s*\+\s*\d[\d.]*\s*$/.test(corrected);
    const hasNumericPlus = /\b\d+\s*\+\s*\d+\b/.test(corrected)
      || /\bint_\w+\s*\+\s*\d+/.test(corrected)
      || /\b\d+\s*\+\s*int_\w+/.test(corrected)
      || /\bint_\w+\s*\+\s*int_\w+/.test(corrected)
      || /\bdbl_\w+\s*\+/.test(corrected)
      || /\bCInt\s*\(/.test(corrected)
      || /\bCDbl\s*\(/.test(corrected);
    if (hasStringContext && !isPureNumeric && !hasNumericPlus) {
      applyFix(
        "CSHARP_STRING_CONCAT",
        "C# '+' for string concatenation should be VB.NET '&'",
        /\+/g,
        " & "
      );
    }
  }

  {
    const csharpGenericPattern = /\bnew\s+([A-Z][A-Za-z0-9_]*)\s*<\s*([^>]+)\s*>\s*\(\s*\)/g;
    if (csharpGenericPattern.test(corrected)) {
      csharpGenericPattern.lastIndex = 0;
      corrected = corrected.replace(csharpGenericPattern, (_match: string, typeName: string, typeArgs: string) => {
        const vbTypeArgs = typeArgs.split(",").map((t: string) => t.trim()).join(", ");
        return `New ${typeName}(Of ${vbTypeArgs})()`;
      });
      issues.push({ code: "CSHARP_GENERIC_NEW", message: "C# generic construction 'new Type<T>()' converted to VB.NET 'New Type(Of T)()'", autoFixed: true });
      wasModified = true;
    }
  }

  {
    const csharpGenericPatternNoParens = /\bnew\s+([A-Z][A-Za-z0-9_]*)\s*<\s*([^>]+)\s*>\s*(?!\()/g;
    if (csharpGenericPatternNoParens.test(corrected)) {
      csharpGenericPatternNoParens.lastIndex = 0;
      corrected = corrected.replace(csharpGenericPatternNoParens, (_match: string, typeName: string, typeArgs: string) => {
        const vbTypeArgs = typeArgs.split(",").map((t: string) => t.trim()).join(", ");
        return `New ${typeName}(Of ${vbTypeArgs})`;
      });
      issues.push({ code: "CSHARP_GENERIC_NEW", message: "C# generic construction 'new Type<T>' converted to VB.NET 'New Type(Of T)'", autoFixed: true });
      wasModified = true;
    }
  }

  applyFix(
    "CSHARP_NEW",
    "C# 'new ' should be VB.NET 'New '",
    /\bnew\s+(?=[A-Z])/g,
    "New "
  );

  if (testOutsideStrings(corrected, /\?[^.?]/) && testOutsideStrings(corrected, /:/)) {
    const ternaryMatch = corrected.match(/^(.+?)\s*\?\s*(.+?)\s*:\s*(.+)$/);
    if (ternaryMatch) {
      const [, cond, trueVal, falseVal] = ternaryMatch;
      if (!cond.includes("(Of") && !cond.includes("TypeArguments")) {
        corrected = `If(${cond.trim()}, ${trueVal.trim()}, ${falseVal.trim()})`;
        issues.push({ code: "CSHARP_TERNARY", message: "C# ternary 'condition ? a : b' converted to VB.NET 'If(condition, a, b)'", autoFixed: true });
        wasModified = true;
      }
    }
  }

  if (/\$"/.test(corrected)) {
    const before = corrected;
    corrected = corrected.replace(/\$"([^"]*)"/g, (_match: string, inner: string) => {
      let idx = 0;
      const args: string[] = [];
      const formatted = inner.replace(/\{([^}]+)\}/g, (_m: string, expr: string) => {
        args.push(expr);
        return `{${idx++}}`;
      });
      if (args.length > 0) {
        return `String.Format("${formatted}", ${args.join(", ")})`;
      }
      return `"${inner}"`;
    });
    if (corrected !== before) {
      issues.push({ code: "CSHARP_STRING_INTERPOLATION", message: "C# $\"...\" string interpolation should use String.Format()", autoFixed: true });
      wasModified = true;
    }
  }

  if (testOutsideStrings(corrected, /\?\./)) {
    const before = corrected;
    corrected = replaceOutsideStrings(corrected, /\b([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)\?\.([a-zA-Z_]\w*)/g,
      (_match: string, obj: string, prop: string) => {
        return `If(${obj} IsNot Nothing, ${obj}.${prop}, Nothing)`;
      }
    );
    if (corrected !== before) {
      issues.push({ code: "CSHARP_NULL_CONDITIONAL", message: "C# '?.' null-conditional operator converted to VB.NET 'If(obj IsNot Nothing, obj.Prop, Nothing)'", autoFixed: true });
      wasModified = true;
    }
  }

  {
    const strippedForNarrowing = corrected.replace(/"(?:[^"\\]|\\.)*"/g, (m) => " ".repeat(m.length))
      .replace(/&quot;[^&]*&quot;/g, (m) => " ".repeat(m.length));
    const narrowingPatterns: Array<{ pattern: RegExp; fix: string }> = [
      { pattern: /\bCInt\s*\(\s*([a-zA-Z_]\w*)\s*\)/g, fix: "CInt" },
      { pattern: /\bCDbl\s*\(\s*([a-zA-Z_]\w*)\s*\)/g, fix: "CDbl" },
      { pattern: /\bCDec\s*\(\s*([a-zA-Z_]\w*)\s*\)/g, fix: "CDec" },
      { pattern: /\bCLng\s*\(\s*([a-zA-Z_]\w*)\s*\)/g, fix: "CLng" },
      { pattern: /\bCSng\s*\(\s*([a-zA-Z_]\w*)\s*\)/g, fix: "CSng" },
    ];
    for (const np of narrowingPatterns) {
      let nm;
      while ((nm = np.pattern.exec(strippedForNarrowing)) !== null) {
        const argName = nm[1];
        const argIsCTypeWrapped = new RegExp(`\\bCType\\s*\\(\\s*${argName}\\b`).test(strippedForNarrowing);
        if (!argIsCTypeWrapped) {
          reportOnly("IMPLICIT_NARROWING", `Expression contains ${np.fix}(${argName}) which may fail under Option Strict On if "${argName}" is typed as Object — ensure the variable is correctly typed`);
        }
      }
    }
  }

  const exprWithoutStrings = corrected.replace(/&quot;[^&]*&quot;/g, (m) => " ".repeat(m.length)).replace(/"[^"]*"/g, (m) => " ".repeat(m.length));
  const openParens = (exprWithoutStrings.match(/\(/g) || []).length;
  const closeParens = (exprWithoutStrings.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    const diff = openParens - closeParens;
    let contextDetail = "";
    let depthTrack = 0;
    let maxDepth = 0;
    let firstUnbalancedPos = -1;
    for (let ci = 0; ci < exprWithoutStrings.length; ci++) {
      if (exprWithoutStrings[ci] === "(") {
        depthTrack++;
        if (depthTrack > maxDepth) maxDepth = depthTrack;
      } else if (exprWithoutStrings[ci] === ")") {
        depthTrack--;
        if (depthTrack < 0 && firstUnbalancedPos === -1) {
          firstUnbalancedPos = ci;
        }
      }
    }
    if (firstUnbalancedPos === -1 && depthTrack > 0) {
      firstUnbalancedPos = exprWithoutStrings.length;
    }
    const fragmentStart = Math.max(0, firstUnbalancedPos - 30);
    const fragmentEnd = Math.min(exprWithoutStrings.length, firstUnbalancedPos + 30);
    const fragment = exprWithoutStrings.substring(fragmentStart, fragmentEnd).trim();
    contextDetail = ` | max nesting depth: ${maxDepth}, first imbalance near position ${firstUnbalancedPos}`;
    if (fragment) {
      contextDetail += `, fragment: "${fragment}"`;
    }
    if (diff > 0 && diff <= 4) {
      corrected = corrected + ")".repeat(diff);
      wasModified = true;
      issues.push({ code: "UNBALANCED_PARENS", message: `Unbalanced parentheses: ${openParens} open vs ${closeParens} close — appended ${diff} closing paren(s)${contextDetail}`, autoFixed: true });
    } else if (diff < 0 && diff >= -4) {
      let fixedExpr = corrected;
      let remaining = Math.abs(diff);
      for (let ri = fixedExpr.length - 1; ri >= 0 && remaining > 0; ri--) {
        if (fixedExpr[ri] === ")") {
          fixedExpr = fixedExpr.slice(0, ri) + fixedExpr.slice(ri + 1);
          remaining--;
        }
      }
      if (remaining === 0) {
        corrected = fixedExpr;
        wasModified = true;
        issues.push({ code: "UNBALANCED_PARENS", message: `Unbalanced parentheses: ${openParens} open vs ${closeParens} close — removed ${Math.abs(diff)} extra closing paren(s)${contextDetail}`, autoFixed: true });
      } else {
        reportOnly("UNBALANCED_PARENS", `Unbalanced parentheses: ${openParens} open vs ${closeParens} close (diff: ${diff > 0 ? "+" : ""}${diff})${contextDetail}`);
      }
    } else {
      reportOnly("UNBALANCED_PARENS", `Unbalanced parentheses: ${openParens} open vs ${closeParens} close (diff: ${diff > 0 ? "+" : ""}${diff})${contextDetail}`);
    }
  }

  const openBrackets = (exprWithoutStrings.match(/\[/g) || []).length;
  const closeBrackets = (exprWithoutStrings.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets && openBrackets > 0) {
    const bracketDiff = openBrackets - closeBrackets;
    let bracketContext = "";
    let bDepth = 0;
    let firstBracketImbalance = -1;
    for (let bi = 0; bi < exprWithoutStrings.length; bi++) {
      if (exprWithoutStrings[bi] === "[") bDepth++;
      else if (exprWithoutStrings[bi] === "]") {
        bDepth--;
        if (bDepth < 0 && firstBracketImbalance === -1) firstBracketImbalance = bi;
      }
    }
    if (firstBracketImbalance === -1 && bDepth > 0) firstBracketImbalance = exprWithoutStrings.length;
    if (firstBracketImbalance >= 0) {
      const bFragStart = Math.max(0, firstBracketImbalance - 30);
      const bFragEnd = Math.min(exprWithoutStrings.length, firstBracketImbalance + 30);
      const bFragment = exprWithoutStrings.substring(bFragStart, bFragEnd).trim();
      bracketContext = ` | first imbalance near position ${firstBracketImbalance}`;
      if (bFragment) bracketContext += `, fragment: "${bFragment}"`;
    }
    reportOnly("UNBALANCED_BRACKETS", `Unbalanced brackets: ${openBrackets} open vs ${closeBrackets} close (diff: ${bracketDiff > 0 ? "+" : ""}${bracketDiff})${bracketContext}`);
  }

  const openQuotes = (corrected.match(/(?<![\\])"/g) || []).length;
  if (openQuotes % 2 !== 0) {
    if (corrected.endsWith('"')) {
      reportOnly("UNBALANCED_QUOTES", "Odd number of double quotes — may be intentional escaping");
    } else {
      corrected = corrected + '"';
      issues.push({ code: "UNBALANCED_QUOTES", message: "Added missing closing double quote", autoFixed: true });
      wasModified = true;
    }
  }

  if (/\[\[/.test(expression) && /\]\]/.test(expression)) {
    reportOnly("DOUBLE_BRACKET", "Expression has double-bracket wrapping [[expr]] — outer brackets will be added by the framework");
  }

  {
    const strippedForAngle = corrected.replace(/"(?:[^"\\]|\\.)*"/g, (m) => '"' + " ".repeat(Math.max(0, m.length - 2)) + '"');
    const withoutEscaped = strippedForAngle.replace(/&lt;/g, "  ").replace(/&gt;/g, "  ");
    const withoutVbOps = withoutEscaped.replace(/<>/g, "  ").replace(/<=/g, "  ").replace(/>=/g, "  ");
    if (/</.test(withoutVbOps)) {
      reportOnly("BARE_ANGLE_BRACKET", "Bare '<' operator in expression — should be XML-escaped as '&lt;' in XAML attributes");
    }
    if (/>/.test(withoutVbOps)) {
      reportOnly("BARE_ANGLE_BRACKET", "Bare '>' operator in expression — should be XML-escaped as '&gt;' in XAML attributes");
    }
  }

  validateFunctionCalls(corrected, issues);

  {
    const stripped = corrected.replace(/"(?:[^"\\]|\\.)*"/g, (m) => " ".repeat(m.length))
      .replace(/&quot;[^&]*&quot;/g, (m) => " ".repeat(m.length));
    const bareWordPattern = /(?<![."&\w])([A-Z][a-z]+)(?!\s*[.(]|[A-Za-z])/g;
    let bm;
    while ((bm = bareWordPattern.exec(stripped)) !== null) {
      const word = bm[1];
      if (VB_KEYWORDS.has(word)) continue;
      if (VB_BUILTIN_TYPES.has(word)) continue;
      if (VB_BUILTIN_FUNCTIONS.has(word)) continue;
      if (/^(True|False|Nothing|Empty)$/.test(word)) continue;
      if (bm.index > 0 && stripped[bm.index - 1] === "_") continue;
      const afterIdx = bm.index + word.length;
      if (afterIdx < stripped.length && /[A-Za-z0-9_]/.test(stripped[afterIdx])) continue;
      if (stripped.includes(`${word}.`) || stripped.includes(`${word}(`)) continue;
      const hasPrefix = /^(str|int|bool|dbl|dec|obj|dt|ts|drow|qi|qid|arr|dict|list|jobj|sec)_/i.test(word);
      if (hasPrefix) continue;
      if (/[=<>&|,+\-*/^]/.test(stripped.substring(Math.max(0, bm.index - 3), bm.index))) continue;
      const looksLikeStandaloneWord = /^\s*$/.test(stripped.substring(0, bm.index)) &&
        /^\s*$/.test(stripped.substring(afterIdx));
      if (looksLikeStandaloneWord) {
        if (word === "Yes" || word === "No") {
          const replacement = word === "Yes" ? "True" : "False";
          issues.push({ code: "BARE_WORD_REFERENCE", message: `Standalone "${word}" corrected to "${replacement}"`, autoFixed: true });
          corrected = replacement;
          break;
        } else {
          reportOnly("BARE_WORD_REFERENCE", `Standalone word "${word}" may be an undeclared variable — should it be a string literal "${word}"?`);
        }
      }
    }
  }

  {
    const stripped = corrected.replace(/"(?:[^"\\]|\\.)*"/g, (m) => " ".repeat(m.length))
      .replace(/&quot;[^&]*&quot;/g, (m) => " ".repeat(m.length));
    if (/\)\s*[A-Za-z_]\w*\s*\(/.test(stripped)) {
      const missingCommaMatch = stripped.match(/\)\s*([A-Za-z_]\w*)\s*\(/);
      if (missingCommaMatch) {
        reportOnly("MISSING_COMMA_OR_OPERATOR", `Possible missing comma or operator between ")" and "${missingCommaMatch[1]}(" — check expression syntax`);
      }
    }
    if (/[A-Za-z_]\w*\s+[A-Za-z_]\w*\s*\(/.test(stripped)) {
      const adjacentMatch = stripped.match(/([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*\(/);
      if (adjacentMatch) {
        const w1 = adjacentMatch[1];
        const w2 = adjacentMatch[2];
        if (!VB_KEYWORDS.has(w1) && !VB_KEYWORDS.has(w2) && !/^(Of|To|As|In|Is|IsNot|And|Or|Not|AndAlso|OrElse|Mod|Xor|Like|New|TypeOf)$/i.test(w1)) {
          reportOnly("ADJACENT_IDENTIFIERS", `Adjacent identifiers "${w1} ${w2}(" — possible missing operator or comma`);
        }
      }
    }
  }

  if (/\.length\b/.test(corrected)) {
    applyFix("CSHARP_LENGTH", "C# '.length' should be VB.NET '.Length'", /\.length\b/g, ".Length");
  }

  if (/\.count\b/.test(corrected)) {
    applyFix("CSHARP_COUNT", "C# '.count' should be VB.NET '.Count'", /\.count\b/g, ".Count");
  }

  if (/\.tostring\(\)/i.test(corrected)) {
    applyFix("CSHARP_TOSTRING_CASE", "Fix ToString() casing", /\.tostring\(\)/gi, ".ToString()");
  }

  if (/\.toupper\(\)/i.test(corrected)) {
    applyFix("CSHARP_TOUPPER_CASE", "Fix ToUpper() casing", /\.toupper\(\)/gi, ".ToUpper()");
  }

  if (/\.tolower\(\)/i.test(corrected)) {
    applyFix("CSHARP_TOLOWER_CASE", "Fix ToLower() casing", /\.tolower\(\)/gi, ".ToLower()");
  }

  if (/\bvar\s+\w+\s*=/.test(corrected)) {
    reportOnly("CSHARP_VAR", "C# 'var' keyword detected — VB.NET uses 'Dim' for variable declarations");
  }

  if (/;\s*$/.test(corrected) && !/&(?:quot|amp|lt|gt|apos);\s*$/.test(corrected)) {
    applyFix("CSHARP_SEMICOLON", "C# trailing semicolon removed", /;\s*$/, "");
  }

  if (/\bstring\.IsNullOrEmpty\b/i.test(corrected)) {
    applyFix(
      "CSHARP_ISNULLOREMPTY_CASE",
      "Fix String.IsNullOrEmpty casing",
      /\bstring\.IsNullOrEmpty\b/gi,
      "String.IsNullOrEmpty"
    );
  }

  if (/\bstring\.IsNullOrWhiteSpace\b/i.test(corrected)) {
    applyFix(
      "CSHARP_ISNULLORWHITESPACE_CASE",
      "Fix String.IsNullOrWhiteSpace casing",
      /\bstring\.IsNullOrWhiteSpace\b/gi,
      "String.IsNullOrWhiteSpace"
    );
  }

  {
    const MAX_SF_REPAIRS = 5;
    for (let sfPass = 0; sfPass < MAX_SF_REPAIRS; sfPass++) {
      const sfMatch = corrected.match(/\bString\.Format\s*\(/);
      if (!sfMatch) break;
      const startIdx = sfMatch.index! + sfMatch[0].length;
      let depth = 1;
      let endIdx = startIdx;
      for (let i = startIdx; i < corrected.length && depth > 0; i++) {
        if (corrected[i] === "(") depth++;
        else if (corrected[i] === ")") depth--;
        if (depth === 0) { endIdx = i; break; }
      }
      if (depth !== 0) break;
      const body = corrected.substring(startIdx, endIdx);
      const argCount = countFunctionArgs(body);
      const formatStr = body.split(",")[0] || "";
      const maxPlaceholder = [...formatStr.matchAll(/\{(\d+)/g)].reduce((max, m) => Math.max(max, parseInt(m[1], 10)), -1);
      if (maxPlaceholder < 10 && argCount <= 11) break;
      const allArgs = splitFormatArgs(body);
      if (allArgs.length >= 2) {
        const fmtStr = allArgs[0];
        const valueArgs = allArgs.slice(1);
        try {
          const concatExpr = buildConcatFromStringFormat(fmtStr, valueArgs);
          const fullCallStart = sfMatch.index!;
          const fullCallEnd = endIdx + 1;
          const before = corrected;
          corrected = corrected.substring(0, fullCallStart) + concatExpr + corrected.substring(fullCallEnd);
          if (corrected !== before) {
            issues.push({
              code: "STRING_FORMAT_OVERFLOW",
              message: `String.Format with ${argCount} arguments (highest placeholder {${maxPlaceholder}}) auto-converted to string concatenation for UiPath Studio compatibility`,
              autoFixed: true,
            });
            wasModified = true;
          }
        } catch (sfErr: any) {
          issues.push({
            code: "STRING_FORMAT_OVERFLOW_BLOCKING",
            message: `BLOCKING: String.Format with ${argCount} arguments (highest placeholder {${maxPlaceholder}}) cannot be safely decomposed — ${sfErr?.message || "parse error"}. Rewrite manually using string concatenation (&).`,
            autoFixed: false,
          });
          break;
        }
      } else {
        issues.push({
          code: "STRING_FORMAT_OVERFLOW_BLOCKING",
          message: `BLOCKING: String.Format with ${argCount} arguments (highest placeholder {${maxPlaceholder}}) cannot be parsed — insufficient arguments for decomposition. Rewrite manually using string concatenation (&).`,
          autoFixed: false,
        });
        break;
      }
    }
  }

  {
    const stripped = corrected.replace(/"(?:[^"\\]|\\.)*"/g, (m) => " ".repeat(m.length))
      .replace(/&quot;[^&]*&quot;/g, (m) => " ".repeat(m.length));
    if (/\bDynamic\b/.test(stripped) && !VB_KEYWORDS.has("Dynamic") && !VB_BUILTIN_TYPES.has("Dynamic")) {
      reportOnly("CSHARP_DYNAMIC_TYPE", `C# "Dynamic" type detected — VB.NET uses "Object" instead. Replace "Dynamic" with "Object".`);
    }
    if (/\bFrom\b/.test(stripped) && /\bFrom\s*[^(]/.test(stripped)) {
      const isLinqFrom = /\bFrom\s+\w+\s+In\b/i.test(stripped);
      const isLambdaOrAggregate = /\b(Select|Where|Aggregate|Group|Order\s+By|Join|Let)\b/i.test(stripped);
      if (!isLinqFrom && !isLambdaOrAggregate) {
        const fromContext = stripped.match(/\b(From\s+\w+)/);
        if (fromContext) {
          reportOnly("VB_KEYWORD_AS_VARIABLE", `"From" is a VB.NET collection initializer keyword and cannot be used as a variable name. Rename to a non-reserved identifier.`);
        }
      }
    }
    if (/\b[a-z]\s*=>/.test(stripped)) {
      reportOnly("CSHARP_LAMBDA_VARIABLE", `C#-style lambda variable detected (single-character variable before "=>"). VB.NET uses "Function(x)" syntax instead. This expression needs manual conversion.`);
    }
  }

  corrected = corrected.replace(/\s{2,}/g, " ").trim();
  if (corrected !== expression.replace(/\s{2,}/g, " ").trim()) {
    wasModified = true;
  }

  return {
    original: expression,
    corrected: wasModified ? corrected : null,
    issues,
  };
}

export function extractDeclaredVariables(xamlContent: string): Set<string> {
  const declared = new Set<string>();

  const varPattern = /<Variable[^>]*\bName="([^"]+)"/g;
  let m;
  while ((m = varPattern.exec(xamlContent)) !== null) {
    declared.add(m[1]);
  }

  const propPattern = /<x:Property\s+Name="([^"]+)"/g;
  while ((m = propPattern.exec(xamlContent)) !== null) {
    declared.add(m[1]);
  }

  const delegatePattern = /<(?:Delegate)?InArgument[^>]*\bName="([^"]+)"/g;
  while ((m = delegatePattern.exec(xamlContent)) !== null) {
    declared.add(m[1]);
  }

  const outArgPattern = /<(?:Delegate)?OutArgument[^>]*\bName="([^"]+)"/g;
  while ((m = outArgPattern.exec(xamlContent)) !== null) {
    declared.add(m[1]);
  }

  const memberPattern = /<x:Member\s+Name="([^"]+)"/g;
  while ((m = memberPattern.exec(xamlContent)) !== null) {
    declared.add(m[1]);
  }

  return declared;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
}

const VB_KEYWORDS_LOWER = new Set<string>();
VB_KEYWORDS.forEach(k => VB_KEYWORDS_LOWER.add(k.toLowerCase()));
const VB_BUILTIN_TYPES_LOWER = new Set<string>();
VB_BUILTIN_TYPES.forEach(k => VB_BUILTIN_TYPES_LOWER.add(k.toLowerCase()));
const VB_BUILTIN_FUNCTIONS_LOWER = new Set<string>();
VB_BUILTIN_FUNCTIONS.forEach(k => VB_BUILTIN_FUNCTIONS_LOWER.add(k.toLowerCase()));

const COMPLIANCE_XML_ENTITY_NAMES = new Set(["gt", "lt", "amp", "quot", "apos"]);
const COMPLIANCE_CLR_EXTRA_NAMES = new Set([
  "HttpClient", "Newtonsoft", "JObject", "JArray", "JToken", "JValue",
  "Regex", "Match", "StringBuilder", "StreamReader", "StreamWriter",
  "File", "Path", "Directory", "Uri", "WebClient", "HttpWebRequest",
  "DataTable", "DataRow", "DataColumn", "DataSet",
  "List", "Dictionary", "HashSet", "Queue", "Stack",
  "Task", "Thread", "Guid", "Decimal", "Double", "Single",
  "Int16", "Int32", "Int64", "Byte", "Char", "Object",
  "Information", "Trace", "Warning", "Error",
  "Json", "Xml", "Linq", "Text", "IO", "Net", "Threading",
  "Globalization", "Collections", "Generic", "Runtime",
  "Serialization", "Configuration", "ComponentModel",
]);

export function findUndeclaredVariables(expression: string, declaredVars: Set<string>): string[] {
  const undeclared: string[] = [];
  const trimmedExpr = expression.trim();
  if (/^"(?:[^"]|"")*"$/.test(trimmedExpr) || /^&quot;.*&quot;$/.test(trimmedExpr)) return undeclared;

  if (/^\[[\w]+\]\s*(WARN|INFO|ERROR|DEBUG)\b/.test(trimmedExpr) && /\s—\s/.test(trimmedExpr)) return undeclared;
  if (/^\[[\w]+\]/.test(trimmedExpr) && /\s—\s/.test(trimmedExpr)) return undeclared;

  if (/HANDOFF_|STUB_|ASSEMBLY_FAILED/.test(trimmedExpr)) return undeclared;
  if (/\[HANDOFF\]/i.test(trimmedExpr)) return undeclared;
  if (/\bHANDOFF\b/i.test(trimmedExpr) && /placeholder|replace|TODO|binding|content/i.test(trimmedExpr)) return undeclared;
  if (/\bPLACEHOLDER_\w+/.test(trimmedExpr)) return undeclared;

  if (/^\{.*"type"\s*:\s*"literal".*"value"\s*:/.test(trimmedExpr) ||
      /^\{&quot;type&quot;/.test(trimmedExpr) ||
      /^\{type:/.test(trimmedExpr)) {
    return undeclared;
  }

  const decoded = decodeXmlEntities(expression);

  let concatMerged = decoded;
  let prevMerged = "";
  while (prevMerged !== concatMerged) {
    prevMerged = concatMerged;
    concatMerged = concatMerged.replace(/"(?:[^"]|"")*"\s*&\s*"(?:[^"]|"")*"/g, (m) => {
      const inner = m.replace(/"\s*&\s*"/g, "");
      return `"${inner}"`;
    });
  }

  const vbStringPattern = /"(?:[^"]|"")*"/g;
  const exprWithoutStrings = concatMerged.replace(vbStringPattern, (m) => " ".repeat(m.length));

  const memberAccessTokens = new Set<string>();
  const memberPattern = /\.([a-zA-Z_]\w*)/g;
  let mm;
  while ((mm = memberPattern.exec(exprWithoutStrings)) !== null) {
    memberAccessTokens.add(mm[1]);
  }

  const invokedTokens = new Set<string>();
  const invokePattern = /\b([a-zA-Z_]\w*)\s*\(/g;
  while ((mm = invokePattern.exec(exprWithoutStrings)) !== null) {
    invokedTokens.add(mm[1]);
  }

  const lambdaParams = new Set<string>();
  const lambdaPattern = /\b(?:Function|Sub)\s*\(([^)]*)\)/gi;
  let lm;
  while ((lm = lambdaPattern.exec(exprWithoutStrings)) !== null) {
    const paramList = lm[1];
    for (const param of paramList.split(",")) {
      const parts = param.trim().split(/\s+/);
      const name = /^(byval|byref)$/i.test(parts[0]) ? parts[1] : parts[0];
      if (name && /^[a-zA-Z_]\w*$/.test(name)) {
        lambdaParams.add(name);
      }
    }
  }

  const COMMON_FILE_EXTENSIONS = new Set([
    "json", "xlsx", "xml", "txt", "csv", "pdf", "docx", "html", "htm",
    "log", "zip", "png", "jpg", "jpeg", "gif", "bmp", "yaml", "yml",
    "config", "xaml", "dll", "exe", "bat", "ps1", "sql", "xls", "doc",
  ]);

  const stringLiterals: string[] = [];
  const vbStrExtract = /"(?:[^"]|"")*"/g;
  let sl;
  while ((sl = vbStrExtract.exec(decoded)) !== null) {
    stringLiterals.push(sl[0]);
  }
  const stringContent = stringLiterals.join(" ");

  const filenameParts = new Set<string>();
  const filenameExtPattern = /([\w][\w\-]*)\.(\w+)\b/g;
  let fm;
  while ((fm = filenameExtPattern.exec(stringContent)) !== null) {
    if (COMMON_FILE_EXTENSIONS.has(fm[2].toLowerCase())) {
      const fullMatch = fm[0];
      const startIdx = fm.index;
      let extendedStart = startIdx;
      while (extendedStart > 0 && /[\w\-]/.test(stringContent[extendedStart - 1])) {
        extendedStart--;
      }
      const fullFilename = stringContent.substring(extendedStart, startIdx) + fullMatch;
      const dotIdx = fullFilename.lastIndexOf(".");
      if (dotIdx > 0) {
        filenameParts.add(fullFilename.substring(0, dotIdx));
      }
      for (const part of fullFilename.split(/[._\-]/)) {
        if (part) filenameParts.add(part);
      }
    }
  }

  const urlPathParts = new Set<string>();
  const urlPathPattern = /\b\w+\/\w+(?:\/\w+)*(?::[\w]+)?/g;
  let um;
  while ((um = urlPathPattern.exec(stringContent)) !== null) {
    for (const part of um[0].split(/[/:]/)) {
      if (part) urlPathParts.add(part);
    }
  }

  const dictKeyParts = new Set<string>();
  const dictInitPattern = /New\s+Dictionary\b[\s\S]*?From\s*\{([\s\S]*?)\}/gi;
  let dk;
  while ((dk = dictInitPattern.exec(decoded)) !== null) {
    const body = dk[1];
    const keyPattern = /\{\s*"([^"]+)"/g;
    let km;
    while ((km = keyPattern.exec(body)) !== null) {
      for (const part of km[1].split(/[\s._\-]/)) {
        if (part) dictKeyParts.add(part);
      }
    }
  }

  const jsonConcatKeyParts = new Set<string>();
  const jsonKeyPattern = /"\s*&\s*"([^"]*?)"\s*:/g;
  let jk;
  const decodedFull = decoded;
  while ((jk = jsonKeyPattern.exec(decodedFull)) !== null) {
    for (const part of jk[1].split(/[\s._\-]/)) {
      if (part) jsonConcatKeyParts.add(part);
    }
  }
  const jsonKeyPattern2 = /"([^"]*?)":\s*"/g;
  while ((jk = jsonKeyPattern2.exec(stringContent)) !== null) {
    for (const part of jk[1].split(/[\s._\-]/)) {
      if (part) jsonConcatKeyParts.add(part);
    }
  }

  const DATE_TIME_FORMAT_TOKENS = new Set([
    "yyyy", "yy", "MM", "dd", "HH", "hh", "mm", "ss", "fff", "ff", "f",
    "tt", "zzz", "zz", "ddd", "dddd", "MMM", "MMMM",
  ]);

  const isFormatContext = /String\.Format|\.ToString\s*\(|Format\s*\(|Now\.ToString|DateTime|DateTimeOffset|TimeSpan|\.ParseExact/.test(decoded)
    || /"\s*(?:yyyy|MM\/dd|HH:mm|dd-MM)/.test(decoded);

  const concatFragmentParts = new Set<string>();
  const concatPattern = /"\s*&\s*"/g;
  if (concatPattern.test(decoded)) {
    const concatSplitPattern = /"\s*&\s*"([^"]*)"/g;
    let cm;
    while ((cm = concatSplitPattern.exec(decoded)) !== null) {
      for (const part of cm[1].split(/[\s/_.\\-]/)) {
        if (part) concatFragmentParts.add(part);
      }
    }
    const concatSplitPattern2 = /"([^"]*)"\s*&\s*"/g;
    while ((cm = concatSplitPattern2.exec(decoded)) !== null) {
      for (const part of cm[1].split(/[\s/_.\\-]/)) {
        if (part) concatFragmentParts.add(part);
      }
    }
  }

  const timezoneParts = new Set<string>();
  const tzPattern = /(?:America|Europe|Asia|Africa|Pacific|Atlantic|Indian|Australia)\/[\w/]+/g;
  let tzm;
  while ((tzm = tzPattern.exec(decoded)) !== null) {
    for (const part of tzm[0].split("/")) {
      if (part) timezoneParts.add(part);
    }
  }

  const identPattern = /\b([a-zA-Z_]\w*)\b/g;
  let m;
  const seen = new Set<string>();

  while ((m = identPattern.exec(exprWithoutStrings)) !== null) {
    const ident = m[1];
    if (seen.has(ident)) continue;
    seen.add(ident);

    if (ident === "_" || ident.length === 1 && /^[a-z]$/.test(ident)) continue;

    const identLower = ident.toLowerCase();
    if (VB_KEYWORDS_LOWER.has(identLower)) continue;
    if (VB_BUILTIN_TYPES_LOWER.has(identLower)) continue;
    if (VB_BUILTIN_FUNCTIONS_LOWER.has(identLower)) continue;
    if (declaredVars.has(ident)) continue;
    if (lambdaParams.has(ident)) continue;

    if (COMPLIANCE_XML_ENTITY_NAMES.has(ident)) continue;
    if (dictKeyParts.has(ident)) continue;
    if (jsonConcatKeyParts.has(ident)) continue;

    if (ident === "c" && m.index > 0) {
      const precedingInDecoded = decoded.substring(Math.max(0, m.index - 3), m.index);
      if (/"\s*$/.test(precedingInDecoded)) continue;
      if (/"\w\s*$/.test(precedingInDecoded)) continue;
    }

    if (COMPLIANCE_CLR_EXTRA_NAMES.has(ident)) continue;

    if (isFormatContext && DATE_TIME_FORMAT_TOKENS.has(ident)) continue;

    if (concatFragmentParts.has(ident)) continue;
    if (timezoneParts.has(ident)) continue;

    if (expression.includes("@")) {
      const emailPattern = /[\w.+-]+@[\w.-]+/;
      if (emailPattern.test(expression)) {
        const emailParts = expression.match(/[\w.+-]+@[\w.-]+/g) || [];
        const allTokenParts = new Set<string>();
        for (const ep of emailParts) {
          for (const part of ep.split(/[@.+-]/)) {
            if (part) allTokenParts.add(part);
          }
        }
        if (allTokenParts.has(ident)) continue;
      }
    }
    if (expression.includes("-") && expression.includes(".")) {
      const fnPattern = /[\w]+-[\w]+\.[\w]+/;
      if (fnPattern.test(expression)) {
        const fnParts = expression.match(/[\w]+-[\w]+\.[\w]+/g) || [];
        const allTokenParts = new Set<string>();
        for (const fp of fnParts) {
          for (const part of fp.split(/[-._]/)) {
            if (part) allTokenParts.add(part);
          }
        }
        if (allTokenParts.has(ident)) continue;
      }
    }

    if (filenameParts.has(ident)) continue;
    if (urlPathParts.has(ident)) continue;

    const charBefore = m.index > 0 ? exprWithoutStrings[m.index - 1] : "";
    if (charBefore === ".") continue;

    if (/^[A-Z][a-z]/.test(ident) && (expression.includes(`${ident}.`) || decoded.includes(`${ident}.`))) continue;
    if (/^[A-Z][a-z]/.test(ident) && (expression.includes(`${ident}(`) || decoded.includes(`${ident}(`))) continue;

    if (/^[A-Z][A-Z0-9_]{1,}$/.test(ident)) continue;

    if (/^(x|s|ui|scg|scg2|mva|sap|sap2010|mc|sads|local|p)$/.test(ident)) continue;

    if (invokedTokens.has(ident) && !declaredVars.has(ident)) {
      if (/^[A-Z]/.test(ident)) continue;
    }

    if (/^(in|out|io)_/i.test(ident)) continue;

    if (/^(In|Out|InOut)[A-Z]/.test(ident)) continue;

    if (memberAccessTokens.has(ident)) continue;

    undeclared.push(ident);
  }

  return undeclared;
}

export interface ExpressionLintSummary {
  totalExpressions: number;
  totalIssues: number;
  autoFixed: number;
  unfixable: number;
  violations: QualityGateViolation[];
  correctedEntries: { name: string; content: string }[];
  corrections: Array<{
    file: string;
    line: number;
    original: string;
    corrected: string;
    issues: LintIssue[];
  }>;
}

function isLiteralDefaultFalsePositive(loc: ExpressionLocation, issue: LintIssue): boolean {
  if (issue.code !== "BARE_WORD_REFERENCE" && issue.code !== "IMPLICIT_NARROWING") return false;
  const isVariableDefault = /Default=/.test(loc.context) && /<Variable\s/.test(loc.context);
  if (!isVariableDefault) return false;
  const expr = loc.expression.trim();
  if (/^[a-zA-Z_]\w*$/.test(expr)) return true;
  if (/^&quot;.*&quot;$/.test(expr) || /^".*"$/.test(expr)) return true;
  if (/^[0-9]+(\.[0-9]+)?$/.test(expr)) return true;
  if (/^(True|False|Nothing)$/.test(expr)) return true;
  return false;
}

export function lintXamlExpressions(
  xamlEntries: { name: string; content: string }[],
): ExpressionLintSummary {
  const violations: QualityGateViolation[] = [];
  const corrections: ExpressionLintSummary["corrections"] = [];
  const correctedEntries: { name: string; content: string }[] = [];
  let totalExpressions = 0;
  let totalIssues = 0;
  let autoFixed = 0;
  let unfixable = 0;

  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const expressions = extractExpressions(entry.content, shortName);
    const declaredVars = extractDeclaredVariables(entry.content);
    let patchedContent = entry.content;

    totalExpressions += expressions.length;

    for (const loc of expressions) {
      const result = lintExpression(loc.expression);

      if (result.issues.length > 0) {
        totalIssues += result.issues.length;

        const fixedCount = result.issues.filter(i => i.autoFixed).length;
        const unfixableCount = result.issues.filter(i => !i.autoFixed).length;
        autoFixed += fixedCount;
        unfixable += unfixableCount;

        if (result.corrected) {
          const xmlSafeCorrected = result.corrected.replace(/&(?!amp;|quot;|lt;|gt;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;");

          corrections.push({
            file: loc.file,
            line: loc.line,
            original: loc.expression,
            corrected: xmlSafeCorrected,
            issues: result.issues,
          });

          patchedContent = patchedContent.replace(
            `[${loc.expression}]`,
            `[${xmlSafeCorrected}]`
          );

          const exprAttrPattern = new RegExp(
            `(Expression(?:Text)?=")${loc.expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(")`,
            "g"
          );
          patchedContent = patchedContent.replace(exprAttrPattern, `$1${xmlSafeCorrected}$2`);
        }

        const DEDICATED_CHECK_CODES = new Set([
          "STRING_FORMAT_OVERFLOW",
          "CSHARP_DYNAMIC_TYPE",
          "VB_KEYWORD_AS_VARIABLE",
          "CSHARP_LAMBDA_VARIABLE",
        ]);
        for (const issue of result.issues) {
          let severity: "warning" | "error" = issue.autoFixed ? "warning" : "error";
          let check: string;
          if (DEDICATED_CHECK_CODES.has(issue.code)) {
            check = issue.code;
            severity = "error";
          } else if (issue.code === "COMPLEX_EXPRESSION_PASSTHROUGH") {
            check = "COMPLEX_EXPRESSION_PASSTHROUGH";
            severity = "warning";
          } else if (issue.autoFixed) {
            check = "EXPRESSION_SYNTAX";
          } else {
            check = "EXPRESSION_SYNTAX_UNFIXABLE";
          }
          if (!issue.autoFixed && !DEDICATED_CHECK_CODES.has(issue.code) && isLiteralDefaultFalsePositive(loc, issue)) {
            severity = "warning";
            check = "EXPRESSION_SYNTAX";
          }
          violations.push({
            category: "accuracy",
            severity,
            check,
            file: loc.file,
            detail: `Line ${loc.line}: ${issue.message} in expression: ${loc.expression.substring(0, 80)}${loc.expression.length > 80 ? "..." : ""}`,
          });
        }
      }

      const exprToCheck = result.corrected || loc.expression;
      const undeclaredVars = findUndeclaredVariables(exprToCheck, declaredVars);

      const VB_KEYWORDS_FOR_QUOTING = new Set([
        "true", "false", "nothing", "not", "and", "or", "andalso", "orelse",
        "is", "isnot", "like", "mod", "new", "typeof", "gettype", "ctype",
        "cstr", "cint", "cdbl", "cbool", "cdate", "directcast", "trycast",
      ]);

      for (const varName of undeclaredVars) {
        const isBareWord = /^[a-zA-Z_]\w*$/.test(varName) &&
          !varName.includes(".") &&
          !varName.includes("(") &&
          !VB_KEYWORDS_FOR_QUOTING.has(varName.toLowerCase());

        const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const comparisonPattern = new RegExp(`=\\s*${escapedVarName}\\s*(?:$|[)\\]&|])`);
        const isComparisonRhs = comparisonPattern.test(exprToCheck);

        if (isBareWord && isComparisonRhs) {
          const quotedValue = `&quot;${varName}&quot;`;
          const currentExprInContent = result.corrected
            ? result.corrected.replace(/&(?!amp;|quot;|lt;|gt;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;")
            : loc.expression;
          const bareWordInExprPattern = new RegExp(
            `(=\\s*)${escapedVarName}\\b`, 'g'
          );
          const quotedExpr = currentExprInContent.replace(bareWordInExprPattern, `$1${quotedValue}`);

          if (quotedExpr !== currentExprInContent) {
            patchedContent = patchedContent.replace(
              `[${currentExprInContent}]`,
              `[${quotedExpr}]`
            );
            const exprAttrPattern = new RegExp(
              `(Expression(?:Text)?=")${currentExprInContent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(")`,
              "g"
            );
            patchedContent = patchedContent.replace(exprAttrPattern, `$1${quotedExpr}$2`);
          }

          violations.push({
            category: "accuracy",
            severity: "warning",
            check: "EXPRESSION_SYNTAX",
            file: loc.file,
            detail: `Line ${loc.line}: Auto-quoted bare word "${varName}" as string literal in comparison expression: ${loc.expression.substring(0, 60)}${loc.expression.length > 60 ? "..." : ""}`,
          });
          totalIssues++;
          autoFixed++;
        } else {
          violations.push({
            category: "accuracy",
            severity: "error",
            check: "UNDECLARED_VARIABLE",
            file: loc.file,
            detail: `Line ${loc.line}: Undeclared variable "${varName}" in expression: ${loc.expression.substring(0, 60)}${loc.expression.length > 60 ? "..." : ""} — variable is not declared in any <Variable> block in scope`,
          });
          totalIssues++;
          unfixable++;
        }
      }
    }

    if (patchedContent !== entry.content) {
      correctedEntries.push({ name: entry.name, content: patchedContent });
    }
  }

  return {
    totalExpressions,
    totalIssues,
    autoFixed,
    unfixable,
    violations,
    correctedEntries,
    corrections,
  };
}
