export interface SanitizedMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SanitizeChatOptions {
  maxMessageLength?: number;
  maxMessages?: number;
  stripDocTags?: boolean;
  stripUiPathTags?: boolean;
  mergeSeparator?: string;
  preProcess?: (messages: { role: string; content: string }[]) => { role: string; content: string }[];
}

const DEFAULT_OPTIONS: Required<SanitizeChatOptions> = {
  maxMessageLength: 2000,
  maxMessages: 30,
  stripDocTags: true,
  stripUiPathTags: true,
  mergeSeparator: "\n",
  preProcess: (msgs) => msgs,
};

export function sanitizeChatForLLM(
  messages: { role: string; content: string }[],
  options: SanitizeChatOptions = {},
): SanitizedMessage[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let filtered = messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  if (opts.stripDocTags) {
    filtered = filtered.filter((m) => !m.content.startsWith("[DOC:"));
  }
  if (opts.stripUiPathTags) {
    filtered = filtered.filter((m) => !m.content.startsWith("[UIPATH:"));
  }

  filtered = opts.preProcess(filtered);

  for (const m of filtered) {
    if (m.role !== "user" && m.role !== "assistant") {
      throw new Error(
        `Invalid message role "${m.role}" after preProcess. Only "user" and "assistant" roles are allowed. The preProcess callback must not introduce non-user/assistant roles.`,
      );
    }
  }

  const merged: SanitizedMessage[] = [];
  for (const m of filtered) {
    const role = m.role as "user" | "assistant";
    let content = m.content;
    if (opts.maxMessageLength && content.length > opts.maxMessageLength) {
      content = content.slice(0, opts.maxMessageLength) + "\n...[truncated]";
    }
    if (merged.length > 0 && merged[merged.length - 1].role === role) {
      merged[merged.length - 1].content += opts.mergeSeparator + content;
    } else {
      merged.push({ role, content });
    }
  }

  let result = opts.maxMessages && merged.length > opts.maxMessages
    ? merged.slice(merged.length - opts.maxMessages)
    : merged;

  if (result.length > 0 && result[0].role !== "user") {
    result = result.slice(1);
  }

  return result;
}
