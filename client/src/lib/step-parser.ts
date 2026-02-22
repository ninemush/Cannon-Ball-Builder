export interface ParsedStep {
  name: string;
  role: string;
  system: string;
  nodeType: "task" | "decision" | "start" | "end";
  from?: string;
  edgeLabel?: string;
}

const STEP_REGEX = /\[STEP:\s*([^|]+?)\s*\|\s*ROLE:\s*([^|]+?)\s*\|\s*SYSTEM:\s*([^|]+?)\s*\|\s*TYPE:\s*(task|decision|start|end)(?:\s*\|\s*FROM:\s*([^|]*?))?(?:\s*\|\s*LABEL:\s*([^\]]*?))?\s*\]/gi;

export function parseStepsFromText(text: string): ParsedStep[] {
  const steps: ParsedStep[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(STEP_REGEX.source, "gi");

  while ((match = regex.exec(text)) !== null) {
    steps.push({
      name: match[1].trim(),
      role: match[2].trim(),
      system: match[3].trim(),
      nodeType: match[4].toLowerCase().trim() as ParsedStep["nodeType"],
      from: match[5]?.trim() || undefined,
      edgeLabel: match[6]?.trim() || undefined,
    });
  }

  return steps;
}

export function hasCompleteStepTag(text: string): boolean {
  const regex = new RegExp(STEP_REGEX.source, "gi");
  return regex.test(text);
}
