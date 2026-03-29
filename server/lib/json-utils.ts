export function sanitizeJsonString(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString) {
      const code = ch.charCodeAt(0);
      if (code === 0x0A) { result += "\\n"; continue; }
      if (code === 0x09) { result += "\\t"; continue; }
      if (code < 0x20) { result += " "; continue; }
    }
    result += ch;
  }
  return result;
}

export function stripCodeFences(text: string): string {
  let s = text.trim();
  const fencedMatch = s.match(/`{3,}(?:json|orchestrator_artifacts)?\s*\n([\s\S]*)\n\s*`{3,}\s*$/);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }
  const anyFence = s.match(/`{3,}[^\n]*\n([\s\S]*?)\n\s*`{3,}/);
  if (anyFence) {
    return anyFence[1].trim();
  }
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace && firstBrace < 200) {
    return s.slice(firstBrace, lastBrace + 1);
  }
  return s;
}

export function sanitizeAndParseJson<T = any>(raw: string): T {
  const stripped = stripCodeFences(raw);
  const sanitized = sanitizeJsonString(stripped);
  try {
    return JSON.parse(sanitized) as T;
  } catch (firstError) {
    const repaired = balanceBrackets(sanitized);
    if (repaired !== sanitized) {
      try {
        return JSON.parse(repaired) as T;
      } catch {
      }
    }
    throw firstError;
  }
}

export function balanceBrackets(text: string): string {
  let s = text.replace(/,\s*(?=[}\]])/g, "");

  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack.length > 0) stack.pop();
    }
  }

  if (inString) {
    const lastQuote = s.lastIndexOf('"');
    if (lastQuote > 0) {
      s = s.slice(0, lastQuote) + '"';
      inString = false;
      const stack2: string[] = [];
      let esc2 = false, inStr2 = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (esc2) { esc2 = false; continue; }
        if (ch === "\\") { esc2 = true; continue; }
        if (ch === '"') { inStr2 = !inStr2; continue; }
        if (inStr2) continue;
        if (ch === "{") stack2.push("}");
        else if (ch === "[") stack2.push("]");
        else if (ch === "}" || ch === "]") { if (stack2.length > 0) stack2.pop(); }
      }
      stack.length = 0;
      stack.push(...stack2);
    }
  }

  if (stack.length === 0) return s;

  s = s.replace(/,\s*$/, "");
  return s + stack.reverse().join("");
}

export function diagnoseJsonFailure(raw: string): { totalLength: number; head: string; tail: string; bracketDepth: number; endsInString: boolean; truncationHint: string } {
  const KEY_VALUE_CRED = /(?:api[_-]?key|secret|password|token|auth(?:orization)?|bearer|credential|access[_-]?key)["'\s]*[:=]\s*["'][^"']{4,}/gi;
  const BEARER_PATTERN = /bearer\s+[a-zA-Z0-9_\-./+=]{8,}/gi;
  const sanitized = raw
    .replace(KEY_VALUE_CRED, "[REDACTED]")
    .replace(BEARER_PATTERN, "[REDACTED]");

  const totalLength = sanitized.length;
  const head = sanitized.slice(0, 1500);
  const tail = totalLength > 2000 ? sanitized.slice(-500) : "";

  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let i = 0; i < sanitized.length; i++) {
    const ch = sanitized[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
  }

  let truncationHint = "unknown";
  if (inString) truncationHint = "truncated_mid_string";
  else if (depth > 0) truncationHint = `unclosed_brackets_depth_${depth}`;
  else if (/,\s*$/.test(sanitized)) truncationHint = "trailing_comma";
  else if (depth === 0 && totalLength > 0) truncationHint = "balanced_but_invalid";

  return { totalLength, head, tail, bracketDepth: depth, endsInString: inString, truncationHint };
}

export function trySanitizeAndParseJson<T = any>(raw: string): T | null {
  try {
    return sanitizeAndParseJson<T>(raw);
  } catch {
    return null;
  }
}
