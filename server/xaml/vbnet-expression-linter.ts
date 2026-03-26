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
  "Return", "Exit", "Continue", "GoTo", "ReDim", "Preserve",
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
  const stringPattern = /"(?:[^"\\]|\\.)*"/g;
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
  const stringPattern = /"(?:[^"\\]|\\.)*"/g;
  const withoutStrings = input.replace(stringPattern, (m) => " ".repeat(m.length));
  return pattern.test(withoutStrings);
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
  for (const ch of body) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) count++;
  }
  return count;
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
    "ToString": { minArgs: 0, maxArgs: 1 },
    "Trim": { minArgs: 0, maxArgs: 1 },
    "Split": { minArgs: 1, maxArgs: 3 },
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
  };

  const staticPattern = /\b([A-Z]\w+\.\w+)\s*\(/g;
  while ((m = staticPattern.exec(expression)) !== null) {
    const fullName = m[1];
    const sig = STATIC_METHOD_SIGNATURES[fullName];
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

export function lintExpression(expression: string): LintResult {
  const issues: LintIssue[] = [];
  let corrected = expression;
  let wasModified = false;

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
      || /CStr\([^)]*\)\s*\+/.test(corrected);
    const isPureNumeric = /^\s*\d[\d.]*\s*\+\s*\d[\d.]*\s*$/.test(corrected);
    if (hasStringContext && !isPureNumeric) {
      applyFix(
        "CSHARP_STRING_CONCAT",
        "C# '+' for string concatenation should be VB.NET '&'",
        /\+/g,
        " & "
      );
    }
  }

  applyFix(
    "CSHARP_NEW",
    "C# 'new ' should be VB.NET 'New '",
    /\bnew\s+(?=[A-Z])/g,
    "New "
  );

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

  const exprWithoutStrings = corrected.replace(/&quot;[^&]*&quot;/g, (m) => " ".repeat(m.length)).replace(/"[^"]*"/g, (m) => " ".repeat(m.length));
  const openParens = (exprWithoutStrings.match(/\(/g) || []).length;
  const closeParens = (exprWithoutStrings.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    const diff = openParens - closeParens;
    if (diff > 0 && diff <= 2) {
      corrected = corrected + ")".repeat(diff);
      issues.push({ code: "UNBALANCED_PARENS", message: `Added ${diff} missing closing parenthesis(es)`, autoFixed: true });
      wasModified = true;
    } else if (diff < 0 && diff >= -2) {
      const toRemove = Math.abs(diff);
      for (let i = 0; i < toRemove; i++) {
        const lastIdx = corrected.lastIndexOf(")");
        if (lastIdx >= 0) {
          corrected = corrected.substring(0, lastIdx) + corrected.substring(lastIdx + 1);
        }
      }
      issues.push({ code: "UNBALANCED_PARENS", message: `Removed ${toRemove} extra closing parenthesis(es)`, autoFixed: true });
      wasModified = true;
    } else {
      reportOnly("UNBALANCED_PARENS", `Unbalanced parentheses: ${openParens} open vs ${closeParens} close — cannot auto-fix`);
    }
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

  if (/;\s*$/.test(corrected)) {
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

export function findUndeclaredVariables(expression: string, declaredVars: Set<string>): string[] {
  const undeclared: string[] = [];
  const decoded = decodeXmlEntities(expression);
  const stringPattern = /"(?:[^"\\]|\\.)*"/g;
  const exprWithoutStrings = decoded.replace(stringPattern, (m) => " ".repeat(m.length));

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

  const identPattern = /\b([a-zA-Z_]\w*)\b/g;
  let m;
  const seen = new Set<string>();

  while ((m = identPattern.exec(exprWithoutStrings)) !== null) {
    const ident = m[1];
    if (seen.has(ident)) continue;
    seen.add(ident);

    if (VB_KEYWORDS.has(ident)) continue;
    if (VB_BUILTIN_TYPES.has(ident)) continue;
    if (VB_BUILTIN_FUNCTIONS.has(ident)) continue;
    if (declaredVars.has(ident)) continue;

    const charBefore = m.index > 0 ? exprWithoutStrings[m.index - 1] : "";
    if (charBefore === ".") continue;

    if (/^[A-Z][a-z]/.test(ident) && expression.includes(`${ident}.`)) continue;
    if (/^[A-Z][a-z]/.test(ident) && expression.includes(`${ident}(`)) continue;

    if (/^[A-Z]{2,}$/.test(ident)) continue;

    if (/^(x|s|ui|scg|scg2|mva|sap|sap2010|mc|sads|local|p)$/.test(ident)) continue;

    if (invokedTokens.has(ident) && !declaredVars.has(ident)) {
      if (/^[A-Z]/.test(ident)) continue;
    }

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
          corrections.push({
            file: loc.file,
            line: loc.line,
            original: loc.expression,
            corrected: result.corrected,
            issues: result.issues,
          });

          patchedContent = patchedContent.replace(
            `[${loc.expression}]`,
            `[${result.corrected}]`
          );

          const exprAttrPattern = new RegExp(
            `(Expression(?:Text)?=")${loc.expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(")`,
            "g"
          );
          patchedContent = patchedContent.replace(exprAttrPattern, `$1${result.corrected}$2`);
        }

        for (const issue of result.issues) {
          violations.push({
            category: "accuracy",
            severity: issue.autoFixed ? "warning" : "error",
            check: issue.autoFixed ? "EXPRESSION_SYNTAX" : "EXPRESSION_SYNTAX_UNFIXABLE",
            file: loc.file,
            detail: `Line ${loc.line}: ${issue.message} in expression: ${loc.expression.substring(0, 80)}${loc.expression.length > 80 ? "..." : ""}`,
          });
        }
      }

      const exprToCheck = result.corrected || loc.expression;
      const undeclaredVars = findUndeclaredVariables(exprToCheck, declaredVars);
      for (const varName of undeclaredVars) {
        violations.push({
          category: "accuracy",
          severity: "warning",
          check: "EXPRESSION_SYNTAX",
          file: loc.file,
          detail: `Line ${loc.line}: Possible undeclared variable "${varName}" in expression: ${loc.expression.substring(0, 60)}${loc.expression.length > 60 ? "..." : ""}`,
        });
        totalIssues++;
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
