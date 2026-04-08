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
  return JSON.parse(sanitized) as T;
}

export function trySanitizeAndParseJson<T = any>(raw: string): T | null {
  try {
    return sanitizeAndParseJson<T>(raw);
  } catch {
    return null;
  }
}
