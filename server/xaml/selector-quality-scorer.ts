export interface UiContext {
  applicationNames: string[];
  screenNames: string[];
  fieldLabels: string[];
  buttonTexts: string[];
  urlPatterns: string[];
  formDescriptions: string[];
}

export interface SelectorScore {
  file: string;
  line: number;
  activityTag: string;
  displayName: string;
  selector: string;
  score: number;
  maxScore: number;
  breakdown: ScoringBreakdown;
  isPlaceholder: boolean;
  businessContext?: string;
}

export interface ScoringBreakdown {
  automationId: number;
  name: number;
  aaname: number;
  tag: number;
  idxPenalty: number;
  fallbackBonus: number;
  wildcardPenalty: number;
  specificityBonus: number;
}

export interface ResilienceDefaults {
  waitForReady: string;
  timeout: string;
}

const ATTR_SCORES: Record<string, number> = {
  automationid: 5,
  id: 4,
  name: 4,
  aaname: 3,
  tag: 2,
  class: 1,
  css_selector: 3,
  parentid: 2,
  tablerow: 1,
  tablecol: 1,
};

const PENALTY_ATTRS: Record<string, number> = {
  idx: -2,
};

const PLACEHOLDER_PATTERNS = [
  /TODO/i,
  /PLACEHOLDER/i,
  /CHANGEME/i,
  /example\.com/i,
  /set.*url/i,
  /set.*selector/i,
];

const TARGET_COMPATIBLE_ACTIVITIES = new Set([
  "ui:Click",
  "ui:TypeInto",
  "ui:GetText",
  "ui:SetText",
  "ui:Check",
  "ui:SelectItem",
  "ui:GetAttribute",
  "ui:ElementExists",
  "ui:FindElement",
  "ui:Hover",
  "ui:DoubleClick",
  "ui:SendHotkey",
  "ui:GetFullText",
  "ui:HighlightElement",
  "ui:ScrollTo",
  "ui:WaitElementVanish",
  "ui:Screenshot",
  "ui:TakeScreenshot",
  "uweb:TypeInto",
  "uweb:Click",
  "uweb:GetText",
  "uweb:SetText",
  "uweb:GetAttribute",
  "uweb:Check",
  "uweb:SelectItem",
  "uweb:Hover",
]);

const SCOPE_ACTIVITIES = new Set([
  "ui:OpenBrowser",
  "ui:UseBrowser",
  "ui:UseApplication",
  "ui:SetClipping",
]);

export function extractUiContext(sddContent: string): UiContext {
  const ctx: UiContext = {
    applicationNames: [],
    screenNames: [],
    fieldLabels: [],
    buttonTexts: [],
    urlPatterns: [],
    formDescriptions: [],
  };

  if (!sddContent) return ctx;

  const appPatterns = [
    /(?:application|system|platform|tool|software|portal)\s*(?:name|called|named|:)\s*["']?([A-Z][A-Za-z0-9\s]+?)["']?(?:\.|,|\n|$)/gi,
    /(?:log(?:s?\s+)into|opens?|launches?|navigates?\s+to|uses?)\s+(?:the\s+)?["']?([A-Z][A-Za-z0-9\s]{2,30}?)["']?\s+(?:application|system|portal|platform|website)/gi,
    /(?:in|on|from|within|using)\s+(?:the\s+)?([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)?)\s+(?:ERP|CRM|portal|system|application|platform)/gi,
  ];

  for (const pattern of appPatterns) {
    let match;
    while ((match = pattern.exec(sddContent)) !== null) {
      const name = match[1].trim();
      if (name.length >= 2 && name.length <= 40 && !ctx.applicationNames.includes(name)) {
        ctx.applicationNames.push(name);
      }
    }
  }

  const screenPatterns = [
    /(?:screen|page|tab|window|dialog|modal|panel|view|form)\s*(?:named|called|:|\s+-\s+)\s*["']?([A-Z][A-Za-z0-9\s]+?)["']?(?:\.|,|\n|$)/gi,
    /(?:navigates?\s+to|opens?)\s+(?:the\s+)?["']?([A-Z][A-Za-z0-9\s]{2,40}?)["']?\s+(?:screen|page|tab|window|dialog|form|view)/gi,
  ];

  for (const pattern of screenPatterns) {
    let match;
    while ((match = pattern.exec(sddContent)) !== null) {
      const name = match[1].trim();
      if (name.length >= 2 && name.length <= 50 && !ctx.screenNames.includes(name)) {
        ctx.screenNames.push(name);
      }
    }
  }

  const fieldPatterns = [
    /(?:field|input|textbox|text\s*box|dropdown|combo\s*box|text\s*field)\s*(?:named|called|labeled|labelled|:)\s*["']?([A-Za-z0-9\s_-]+?)["']?(?:\.|,|\n|$)/gi,
    /(?:enters?|types?|fills?\s+in|inputs?|sets?)\s+(?:the\s+)?(?:value\s+)?(?:in(?:to)?|for)\s+(?:the\s+)?["']?([A-Za-z0-9\s_-]{2,40}?)["']?\s+(?:field|input|textbox|text\s*box|dropdown)/gi,
  ];

  for (const pattern of fieldPatterns) {
    let match;
    while ((match = pattern.exec(sddContent)) !== null) {
      const label = match[1].trim();
      if (label.length >= 2 && label.length <= 50 && !ctx.fieldLabels.includes(label)) {
        ctx.fieldLabels.push(label);
      }
    }
  }

  const buttonPatterns = [
    /(?:clicks?|presses?|selects?|taps?)\s+(?:the\s+)?["']([A-Za-z0-9\s]+?)["']\s*(?:button|link|icon|tab|menu\s*item)/gi,
    /(?:clicks?|presses?|selects?|taps?)\s+(?:the\s+)?["']?([A-Z][A-Za-z0-9\s]+?)["']?\s+button/gi,
    /button\s*(?:named|called|labeled|labelled|:)\s*["']?([A-Za-z0-9\s]+?)["']?(?:\.|,|\n|$)/gi,
  ];

  for (const pattern of buttonPatterns) {
    let match;
    while ((match = pattern.exec(sddContent)) !== null) {
      const text = match[1].trim();
      if (text.length >= 2 && text.length <= 40 && !ctx.buttonTexts.includes(text)) {
        ctx.buttonTexts.push(text);
      }
    }
  }

  const urlPatterns = [
    /https?:\/\/[^\s"'<>]+/gi,
    /(?:URL|endpoint|address|link)\s*(?:is|:)\s*["']?(https?:\/\/[^\s"'<>]+)["']?/gi,
  ];

  for (const pattern of urlPatterns) {
    let match;
    while ((match = pattern.exec(sddContent)) !== null) {
      const url = (match[1] || match[0]).trim();
      if (!ctx.urlPatterns.includes(url) && !url.includes("example.com")) {
        ctx.urlPatterns.push(url);
      }
    }
  }

  const formPatterns = [
    /(?:form|screen|page)\s+(?:contains?|includes?|has)\s+(.+?)(?:\.|$)/gim,
  ];

  for (const pattern of formPatterns) {
    let match;
    while ((match = pattern.exec(sddContent)) !== null) {
      const desc = match[1].trim();
      if (desc.length >= 5 && desc.length <= 200 && !ctx.formDescriptions.includes(desc)) {
        ctx.formDescriptions.push(desc);
      }
    }
  }

  return ctx;
}

export function formatUiContextForPrompt(ctx: UiContext): string {
  if (!ctx.applicationNames.length && !ctx.screenNames.length &&
      !ctx.fieldLabels.length && !ctx.buttonTexts.length &&
      !ctx.urlPatterns.length && !ctx.formDescriptions.length) {
    return "";
  }

  const lines: string[] = [
    "=== SECTION 6: UI CONTEXT FROM SDD ===",
    "Use these real identifiers from the SDD when generating selectors.",
    "Do NOT use TODO or PLACEHOLDER values when real names are available below.",
    "",
  ];

  if (ctx.applicationNames.length > 0) {
    lines.push("Applications: " + ctx.applicationNames.join(", "));
  }
  if (ctx.screenNames.length > 0) {
    lines.push("Screens/Pages: " + ctx.screenNames.join(", "));
  }
  if (ctx.fieldLabels.length > 0) {
    lines.push("Field Labels: " + ctx.fieldLabels.join(", "));
  }
  if (ctx.buttonTexts.length > 0) {
    lines.push("Buttons/Links: " + ctx.buttonTexts.join(", "));
  }
  if (ctx.urlPatterns.length > 0) {
    lines.push("URLs: " + ctx.urlPatterns.slice(0, 5).join(", "));
  }
  if (ctx.formDescriptions.length > 0) {
    lines.push("Form Descriptions: " + ctx.formDescriptions.slice(0, 3).join("; "));
  }

  lines.push("");
  lines.push("SELECTOR RULES:");
  lines.push("- Use aaname= for buttons/links with visible text (e.g. aaname='Submit Invoice')");
  lines.push("- Use name= for input fields with name attributes from the SDD");
  lines.push("- Use automationid= when available (highest reliability)");
  lines.push("- Include app= in the top-level <html> or <wnd> tag using application names above");
  lines.push("- Combine multiple attributes for resilience (e.g. tag + aaname + class)");
  lines.push("- NEVER use idx unless absolutely necessary (fragile, breaks on UI changes)");

  return lines.join("\n");
}

export function scoreSelector(selector: string): ScoringBreakdown {
  const breakdown: ScoringBreakdown = {
    automationId: 0,
    name: 0,
    aaname: 0,
    tag: 0,
    idxPenalty: 0,
    fallbackBonus: 0,
    wildcardPenalty: 0,
    specificityBonus: 0,
  };

  const lower = selector.toLowerCase();

  if (/automationid\s*=/.test(lower)) breakdown.automationId = ATTR_SCORES.automationid;
  if (/(?<!automation)\bid\s*=/.test(lower)) breakdown.specificityBonus = ATTR_SCORES.id;
  if (/\bname\s*=/.test(lower) && !/aaname/.test(lower.substring(0, lower.indexOf("name=")))) {
    breakdown.name = ATTR_SCORES.name;
  }
  if (/aaname\s*=/.test(lower)) breakdown.aaname = ATTR_SCORES.aaname;
  if (/\btag\s*=/.test(lower)) breakdown.tag = ATTR_SCORES.tag;

  if (/\bidx\s*=/.test(lower)) breakdown.idxPenalty = PENALTY_ATTRS.idx;

  const attrCount = (lower.match(/\w+\s*=/g) || []).length;
  if (attrCount >= 3) breakdown.fallbackBonus = 2;
  else if (attrCount >= 2) breakdown.fallbackBonus = 1;

  if (/tag\s*=\s*'?\*'?/.test(lower)) breakdown.wildcardPenalty = -1;

  if (/css_selector\s*=/.test(lower) && breakdown.specificityBonus === 0) {
    breakdown.specificityBonus = 3;
  }

  return breakdown;
}

export function computeTotalScore(breakdown: ScoringBreakdown): number {
  return breakdown.automationId + breakdown.name + breakdown.aaname +
    breakdown.tag + breakdown.idxPenalty + breakdown.fallbackBonus +
    breakdown.wildcardPenalty + breakdown.specificityBonus;
}

export function isPlaceholderSelector(selector: string): boolean {
  return PLACEHOLDER_PATTERNS.some(p => p.test(selector));
}

export function scoreSelectorQuality(
  xamlEntries: { name: string; content: string }[],
): SelectorScore[] {
  const results: SelectorScore[] = [];

  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;

    const seenSelectors = new Set<string>();

    const tagPattern = /<((?:ui:|uweb:)?[A-Za-z]+)((?:\s[^>]*?(?:\n[^>]*?)*)?)(?:\s*\/?>)/g;
    let tagMatch;
    while ((tagMatch = tagPattern.exec(entry.content)) !== null) {
      const activityTag = tagMatch[1];
      const attrBlock = tagMatch[2];

      const selectorAttrMatch = attrBlock.match(/Selector="([^"]+)"/);
      if (!selectorAttrMatch) continue;

      const selector = selectorAttrMatch[1];
      const selectorKey = `${selector}@${tagMatch.index}`;
      if (seenSelectors.has(selectorKey)) continue;
      seenSelectors.add(selectorKey);

      const displayNameAttrMatch = attrBlock.match(/DisplayName="([^"]+)"/);
      const displayName = displayNameAttrMatch ? displayNameAttrMatch[1] : activityTag;
      const lineNum = entry.content.substring(0, tagMatch.index).split("\n").length;

      const breakdown = scoreSelector(selector);
      const score = computeTotalScore(breakdown);
      const placeholder = isPlaceholderSelector(selector);

      results.push({
        file: shortName,
        line: lineNum,
        activityTag,
        displayName,
        selector,
        score,
        maxScore: 14,
        breakdown,
        isPlaceholder: placeholder,
      });
    }
  }

  return results;
}

export function getResilienceDefaults(): ResilienceDefaults {
  return {
    waitForReady: "INTERACTIVE",
    timeout: "30000",
  };
}

export function injectResilienceDefaults(
  xamlEntries: { name: string; content: string }[],
): { name: string; content: string }[] {
  const defaults = getResilienceDefaults();
  const corrected: { name: string; content: string }[] = [];

  for (const entry of xamlEntries) {
    let content = entry.content;
    let changed = false;

    for (const tag of TARGET_COMPATIBLE_ACTIVITIES) {
      const tagEscaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(<${tagEscaped}\\s)([^>]*?)(\\s*\\/?>)`, "g");

      content = content.replace(pattern, (match, open, attrs, close) => {
        let newAttrs = attrs;

        if (!attrs.includes("Target.WaitForReady")) {
          newAttrs += ` Target.WaitForReady="${defaults.waitForReady}"`;
          changed = true;
        }
        if (!attrs.includes("Target.Timeout")) {
          newAttrs += ` Target.Timeout="${defaults.timeout}"`;
          changed = true;
        }

        return open + newAttrs + close;
      });
    }

    if (changed) {
      corrected.push({ name: entry.name, content });
    }
  }

  return corrected;
}

function deriveBusinessContext(s: SelectorScore): string {
  const parts: string[] = [];
  const tag = s.activityTag.replace(/^(?:ui|uweb):/, "");

  if (tag === "Click" || tag === "DoubleClick") {
    parts.push(`Click action "${s.displayName}"`);
  } else if (tag === "TypeInto" || tag === "SetText") {
    parts.push(`Text input "${s.displayName}"`);
  } else if (tag === "GetText" || tag === "GetFullText") {
    parts.push(`Text extraction "${s.displayName}"`);
  } else if (tag === "GetAttribute") {
    parts.push(`Attribute read "${s.displayName}"`);
  } else if (tag === "SelectItem") {
    parts.push(`Dropdown selection "${s.displayName}"`);
  } else if (tag === "Check") {
    parts.push(`Checkbox toggle "${s.displayName}"`);
  } else if (tag === "UseBrowser" || tag === "UseApplication" || tag === "OpenBrowser") {
    parts.push(`Application scope "${s.displayName}"`);
  } else {
    parts.push(`UI interaction "${s.displayName}"`);
  }

  parts.push(`should target a specific UI element`);

  if (s.isPlaceholder) {
    parts.push(`but currently has a placeholder selector that must be replaced with a real element reference`);
  } else if (s.score <= 3) {
    parts.push(`but selector relies on fragile attributes — add automationid, name, or aaname for resilience`);
  }

  return parts.join(" ");
}

export function generateSelectorWarnings(
  scores: SelectorScore[],
): { check: string; file: string; detail: string; severity: "warning"; category: "accuracy"; businessContext: string }[] {
  const warnings: { check: string; file: string; detail: string; severity: "warning"; category: "accuracy"; businessContext: string }[] = [];

  for (const s of scores) {
    const businessContext = deriveBusinessContext(s);

    if (s.isPlaceholder) {
      warnings.push({
        check: "SELECTOR_PLACEHOLDER",
        file: s.file,
        detail: `Line ${s.line}: ${s.displayName} has placeholder selector — needs real UI element targeting. Selector: ${s.selector.substring(0, 80)}`,
        severity: "warning",
        category: "accuracy",
        businessContext,
      });
    } else if (s.score <= 3) {
      warnings.push({
        check: "SELECTOR_LOW_QUALITY",
        file: s.file,
        detail: `Line ${s.line}: ${s.displayName} has low-quality selector (score ${s.score}/${s.maxScore}) — consider adding automationid, name, or aaname attributes. Selector: ${s.selector.substring(0, 80)}`,
        severity: "warning",
        category: "accuracy",
        businessContext,
      });
    }
  }

  return warnings;
}
