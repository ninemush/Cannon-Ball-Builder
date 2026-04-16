export type PlaceholderContext = "xml-attribute" | "xml-text-node" | "vb-expression";

export interface PlaceholderSanitizationRecord {
  originalToken: string;
  contextType: PlaceholderContext;
  replacement: string;
  source: string;
}

const sanitizationLog: PlaceholderSanitizationRecord[] = [];

export function drainSanitizationLog(): PlaceholderSanitizationRecord[] {
  return sanitizationLog.splice(0);
}

function stripUnsafeColons(text: string): string {
  let result = text.replace(/\bTODO\s*:/g, "TODO -");
  if (/^[A-Za-z_]\w*:/.test(result)) {
    result = result.replace(/:/, " -");
  }
  return result;
}

function hasBareAmpersand(text: string): boolean {
  return /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/.test(text);
}

function hasBareAngleBracket(text: string): boolean {
  return /</.test(text) || />/.test(text);
}

export function sanitizePlaceholder(
  raw: string,
  context: PlaceholderContext,
  source: string = "unknown",
): string {
  if (!raw || typeof raw !== "string") return raw;

  const alreadySanitized = raw.includes("TODO -") && !raw.includes("TODO:");
  if (alreadySanitized && !hasBareAmpersand(raw) && !hasBareAngleBracket(raw)) {
    return raw;
  }

  let result = raw;
  const original = raw;

  result = stripUnsafeColons(result);

  switch (context) {
    case "xml-attribute": {
      result = result.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;");
      result = result.replace(/</g, "&lt;");
      result = result.replace(/>/g, "&gt;");
      result = result.replace(/"/g, "&quot;");
      break;
    }
    case "xml-text-node": {
      result = result.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;");
      result = result.replace(/</g, "&lt;");
      result = result.replace(/>/g, "&gt;");
      break;
    }
    case "vb-expression": {
      result = result.replace(/"/g, '""');
      result = result.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;");
      result = result.replace(/</g, "&lt;");
      result = result.replace(/>/g, "&gt;");
      break;
    }
  }

  if (result !== original) {
    sanitizationLog.push({
      originalToken: original,
      contextType: context,
      replacement: result,
      source,
    });
  }

  return result;
}

export function sanitizePlaceholderForAttribute(raw: string, source: string = "unknown"): string {
  return sanitizePlaceholder(raw, "xml-attribute", source);
}

export function sanitizePlaceholderForTextNode(raw: string, source: string = "unknown"): string {
  return sanitizePlaceholder(raw, "xml-text-node", source);
}

export function sanitizePlaceholderForVbExpression(raw: string, source: string = "unknown"): string {
  return sanitizePlaceholder(raw, "vb-expression", source);
}

export function containsUnsafePlaceholder(text: string): boolean {
  return /TODO\s*:/.test(text) || hasBareAmpersand(text);
}

export function sweepUnsafePlaceholders(
  content: string,
  fileName: string,
): { content: string; fixes: PlaceholderSanitizationRecord[] } {
  const fixes: PlaceholderSanitizationRecord[] = [];

  if (!containsUnsafePlaceholder(content)) {
    return { content, fixes };
  }

  let result = content;

  result = result.replace(/(\w+)="([^"]*TODO\s*:[^"]*)"/g, (fullMatch, attrName, attrValue) => {
    const sanitized = sanitizePlaceholderForAttribute(attrValue, `${fileName}:attr:${attrName}`);
    if (sanitized !== attrValue) {
      fixes.push({
        originalToken: attrValue,
        contextType: "xml-attribute",
        replacement: sanitized,
        source: `${fileName}:attr:${attrName}`,
      });
      return `${attrName}="${sanitized}"`;
    }
    return fullMatch;
  });

  result = result.replace(/>([^<]*TODO\s*:[^<]*)</g, (fullMatch, textContent) => {
    const sanitized = sanitizePlaceholderForTextNode(textContent, `${fileName}:text-node`);
    if (sanitized !== textContent) {
      fixes.push({
        originalToken: textContent,
        contextType: "xml-text-node",
        replacement: sanitized,
        source: `${fileName}:text-node`,
      });
      return `>${sanitized}<`;
    }
    return fullMatch;
  });

  result = result.replace(/(\w+)="([^"]*&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)[^"]*)"/g, (fullMatch, attrName, attrValue) => {
    const sanitized = sanitizePlaceholderForAttribute(attrValue, `${fileName}:attr-amp:${attrName}`);
    if (sanitized !== attrValue) {
      fixes.push({
        originalToken: attrValue,
        contextType: "xml-attribute",
        replacement: sanitized,
        source: `${fileName}:attr-amp:${attrName}`,
      });
      return `${attrName}="${sanitized}"`;
    }
    return fullMatch;
  });

  result = result.replace(/>([^<]*&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)[^<]*)</g, (fullMatch, textContent) => {
    const sanitized = sanitizePlaceholderForTextNode(textContent, `${fileName}:text-amp`);
    if (sanitized !== textContent) {
      fixes.push({
        originalToken: textContent,
        contextType: "xml-text-node",
        replacement: sanitized,
        source: `${fileName}:text-amp`,
      });
      return `>${sanitized}<`;
    }
    return fullMatch;
  });

  return { content: result, fixes };
}
