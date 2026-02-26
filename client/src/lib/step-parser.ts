export interface ParsedStep {
  name: string;
  role: string;
  system: string;
  nodeType: "task" | "decision" | "start" | "end";
  from?: string;
  edgeLabel?: string;
  stepNumber?: string;
  fromStepNumber?: string;
}

const STEP_REGEX = /\[STEP:\s*([^|]+?)\s*\|\s*ROLE:\s*([^|]+?)\s*\|\s*SYSTEM:\s*([^|]+?)\s*\|\s*TYPE:\s*(task|decision|start|end)(?:\s*\|\s*FROM:\s*([^|]*?))?(?:\s*\|\s*LABEL:\s*([^\]]*?))?\s*\]/gi;

const STEP_NUMBER_PREFIX = /^(\d+\.\d+)\s+(.+)$/;
const IS_STEP_NUMBER = /^\d+\.\d+$/;

export function parseStepsFromText(text: string): ParsedStep[] {
  const steps: ParsedStep[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(STEP_REGEX.source, "gi");

  while ((match = regex.exec(text)) !== null) {
    const rawName = match[1].trim();
    const rawFrom = match[5]?.trim() || undefined;

    let stepNumber: string | undefined;
    let name = rawName;
    const numMatch = STEP_NUMBER_PREFIX.exec(rawName);
    if (numMatch) {
      stepNumber = numMatch[1];
      name = numMatch[2].trim();
    }

    let fromStepNumber: string | undefined;
    let from = rawFrom;
    if (rawFrom && IS_STEP_NUMBER.test(rawFrom)) {
      fromStepNumber = rawFrom;
      from = undefined;
    }

    steps.push({
      name,
      role: match[2].trim(),
      system: match[3].trim(),
      nodeType: match[4].toLowerCase().trim() as ParsedStep["nodeType"],
      from,
      edgeLabel: match[6]?.trim() || undefined,
      stepNumber,
      fromStepNumber,
    });
  }

  return steps;
}

export function hasCompleteStepTag(text: string): boolean {
  const regex = new RegExp(STEP_REGEX.source, "gi");
  return regex.test(text);
}

export interface ViewSteps {
  viewType: "as-is" | "to-be";
  steps: ParsedStep[];
}

const AS_IS_HEADER = /\*{0,2}AS[-\s]IS\s+(?:Process\s*)?Map\*{0,2}/i;
const TO_BE_HEADER = /\*{0,2}TO[-\s]BE\s+(?:Process\s*)?Map\*{0,2}/i;

export function parseStepsByView(text: string): ViewSteps[] {
  const cleaned = text.replace(/\*{1,2}/g, "");
  const asIsMatch = AS_IS_HEADER.exec(cleaned);
  const toBeMatch = TO_BE_HEADER.exec(cleaned);

  if (!asIsMatch && !toBeMatch) {
    const steps = parseStepsFromText(text);
    if (steps.length === 0) return [];
    return [{ viewType: "as-is", steps }];
  }

  const result: ViewSteps[] = [];

  if (asIsMatch && toBeMatch) {
    const firstIsAsIs = asIsMatch.index < toBeMatch.index;
    const firstStart = firstIsAsIs ? asIsMatch.index : toBeMatch.index;
    const secondStart = firstIsAsIs ? toBeMatch.index : asIsMatch.index;

    const firstSection = cleaned.slice(firstStart, secondStart);
    const secondSection = cleaned.slice(secondStart);

    const firstSteps = parseStepsFromText(firstSection);
    const secondSteps = parseStepsFromText(secondSection);

    if (firstSteps.length > 0) {
      result.push({ viewType: firstIsAsIs ? "as-is" : "to-be", steps: firstSteps });
    }
    if (secondSteps.length > 0) {
      result.push({ viewType: firstIsAsIs ? "to-be" : "as-is", steps: secondSteps });
    }
  } else if (asIsMatch) {
    const section = cleaned.slice(asIsMatch.index);
    const steps = parseStepsFromText(section);
    if (steps.length > 0) result.push({ viewType: "as-is", steps });
  } else if (toBeMatch) {
    const section = cleaned.slice(toBeMatch.index);
    const steps = parseStepsFromText(section);
    if (steps.length > 0) result.push({ viewType: "to-be", steps });
  }

  if (result.length === 0) {
    const steps = parseStepsFromText(text);
    if (steps.length > 0) return [{ viewType: "as-is", steps }];
  }

  return result;
}
