export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function decodeXmlEntities(str: string): string {
  let result = str;
  let prev: string;
  do {
    prev = result;
    result = result
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&");
  } while (result !== prev);
  return result;
}

export function escapeXmlExpression(str: string): string {
  const normalized = decodeXmlEntities(str);
  return normalized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function normalizeXmlExpression(str: string): string {
  let result = str;
  let prev: string;
  do {
    prev = result;
    result = result
      .replace(/&amp;quot;/g, "&quot;")
      .replace(/&amp;amp;/g, "&amp;")
      .replace(/&amp;lt;/g, "&lt;")
      .replace(/&amp;gt;/g, "&gt;")
      .replace(/&amp;apos;/g, "&apos;");
  } while (result !== prev);
  return result;
}
