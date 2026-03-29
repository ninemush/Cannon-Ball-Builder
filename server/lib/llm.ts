import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ContentBlockParam,
  TextBlock,
  RawMessageStreamEvent,
  RawContentBlockDeltaEvent,
  RawMessageDeltaEvent,
  TextDelta,
} from "@anthropic-ai/sdk/resources/messages/messages";
import OpenAI from "openai";

export interface LLMTextContent {
  type: "text";
  text: string;
}

export interface LLMImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

export type LLMContentBlock = LLMTextContent | LLMImageContent;

export interface LLMMessage {
  role: "user" | "assistant";
  content: string | LLMContentBlock[];
}

export const LLM_TIMEOUT_MS = 120_000;
export const SDD_LLM_TIMEOUT_MS = 240_000;

export interface LLMOptions {
  system: string;
  messages: LLMMessage[];
  maxTokens: number;
  temperature?: number;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
}

export interface LLMResponse {
  text: string;
  stopReason: string;
}

export interface LLMStreamEvent {
  type: "text_delta" | "stop";
  text?: string;
  stopReason?: string;
}

export interface LLMStream {
  [Symbol.asyncIterator](): AsyncIterator<LLMStreamEvent>;
  abort(): void;
}

export interface LLMProvider {
  create(options: LLMOptions): Promise<LLMResponse>;
  stream(options: LLMOptions): LLMStream;
}

function toAnthropicMessages(messages: LLMMessage[]): MessageParam[] {
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "user" && messages[i].role !== "assistant") {
      throw new Error(
        `Invalid message role "${messages[i].role}" at index ${i}. Only "user" and "assistant" roles are allowed in Anthropic messages. This is an internal error — a system-role message was not filtered before reaching the LLM provider.`,
      );
    }
  }
  return messages.map((m): MessageParam => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content };
    }
    const blocks: ContentBlockParam[] = m.content.map((block) => {
      if (block.type === "image") {
        return {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: block.source.media_type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: block.source.data,
          },
        };
      }
      return { type: "text" as const, text: block.text };
    });
    return { role: m.role, content: blocks };
  });
}

function isContentBlockDelta(event: RawMessageStreamEvent): event is RawContentBlockDeltaEvent {
  return event.type === "content_block_delta";
}

function isMessageDelta(event: RawMessageStreamEvent): event is RawMessageDeltaEvent {
  return event.type === "message_delta";
}

function isTextDelta(delta: RawContentBlockDeltaEvent["delta"]): delta is TextDelta {
  return delta.type === "text_delta";
}

class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(model: string) {
    this.client = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });
    this.model = model;
  }

  async create(options: LLMOptions): Promise<LLMResponse> {
    const response = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: options.maxTokens,
        system: options.system,
        messages: toAnthropicMessages(options.messages),
      },
      options.abortSignal ? { signal: options.abortSignal } : undefined,
    );

    const text = response.content
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return {
      text,
      stopReason: response.stop_reason || "",
    };
  }

  stream(options: LLMOptions): LLMStream {
    const anthropicStream = this.client.messages.stream({
      model: this.model,
      max_tokens: options.maxTokens,
      system: options.system,
      messages: toAnthropicMessages(options.messages),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    });

    return {
      [Symbol.asyncIterator]() {
        const iterator = anthropicStream[Symbol.asyncIterator]();
        return {
          async next(): Promise<IteratorResult<LLMStreamEvent>> {
            const result = await iterator.next();
            if (result.done) {
              return { done: true, value: undefined };
            }
            const event = result.value;
            if (isContentBlockDelta(event) && isTextDelta(event.delta)) {
              return {
                done: false,
                value: { type: "text_delta", text: event.delta.text },
              };
            }
            if (isMessageDelta(event) && event.delta.stop_reason) {
              return {
                done: false,
                value: { type: "stop", stopReason: event.delta.stop_reason },
              };
            }
            return this.next();
          },
        };
      },
      abort() {
        anthropicStream.abort();
      },
    };
  }
}

function toOpenAIMessages(
  system: string,
  messages: LLMMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "user" && messages[i].role !== "assistant") {
      throw new Error(
        `Invalid message role "${messages[i].role}" at index ${i}. Only "user" and "assistant" roles are allowed in OpenAI messages. This is an internal error — a system-role message was not filtered before reaching the LLM provider.`,
      );
    }
  }
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
  ];
  for (const m of messages) {
    if (typeof m.content === "string") {
      result.push({ role: m.role, content: m.content });
    } else {
      const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = m.content.map((block) => {
        if (block.type === "image") {
          return {
            type: "image_url" as const,
            image_url: {
              url: `data:${block.source.media_type};base64,${block.source.data}`,
            },
          };
        }
        return { type: "text" as const, text: block.text };
      });
      if (m.role === "assistant") {
        const textContent = parts
          .filter((p): p is OpenAI.Chat.Completions.ChatCompletionContentPartText => p.type === "text")
          .map((p) => p.text)
          .join("");
        result.push({ role: "assistant" as const, content: textContent });
      } else {
        result.push({ role: "user" as const, content: parts });
      }
    }
  }
  return result;
}

const MODELS_REQUIRING_MAX_COMPLETION_TOKENS = new Set([
  "gpt-5",
  "gpt-5.2",
  "gpt-5.3-codex",
]);

const MODELS_NOT_SUPPORTING_CHAT = new Set([
  "gpt-5.3-codex",
]);

function getOpenAITokenParams(model: string, maxTokens: number | undefined): { max_tokens?: number; max_completion_tokens?: number } {
  if (maxTokens === undefined) return {};
  if (MODELS_REQUIRING_MAX_COMPLETION_TOKENS.has(model)) {
    return { max_completion_tokens: maxTokens };
  }
  return { max_tokens: maxTokens };
}

class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(model: string) {
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
      throw new Error(
        "OpenAI integration is not configured. Please install the OpenAI AI Integration blueprint in your Replit project."
      );
    }
    this.client = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
    this.model = model;
  }

  private buildNonStreamingParams(options: LLMOptions): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
    const messages = toOpenAIMessages(options.system, options.messages);
    const tokenParams = getOpenAITokenParams(this.model, options.maxTokens);
    if (tokenParams.max_completion_tokens !== undefined) {
      const p: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: this.model,
        messages,
        max_completion_tokens: tokenParams.max_completion_tokens,
      };
      console.log(`[OpenAI] Request params: model=${p.model}, max_completion_tokens=${p.max_completion_tokens}, max_tokens=<not set>`);
      return p;
    }
    const p: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages,
      max_tokens: tokenParams.max_tokens,
    };
    console.log(`[OpenAI] Request params: model=${p.model}, max_tokens=${p.max_tokens}, max_completion_tokens=<not set>`);
    return p;
  }

  private buildStreamingParams(options: LLMOptions): OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming {
    const messages = toOpenAIMessages(options.system, options.messages);
    const tokenParams = getOpenAITokenParams(this.model, options.maxTokens);
    if (tokenParams.max_completion_tokens !== undefined) {
      const p: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
        model: this.model,
        messages,
        max_completion_tokens: tokenParams.max_completion_tokens,
        stream: true,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      };
      console.log(`[OpenAI] Stream params: model=${p.model}, max_completion_tokens=${p.max_completion_tokens}, max_tokens=<not set>`);
      return p;
    }
    const p: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
      model: this.model,
      messages,
      max_tokens: tokenParams.max_tokens,
      stream: true,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    };
    console.log(`[OpenAI] Stream params: model=${p.model}, max_tokens=${p.max_tokens}, max_completion_tokens=<not set>`);
    return p;
  }

  private async createViaResponses(options: LLMOptions): Promise<LLMResponse> {
    try {
      type EasyInput = { role: "user" | "assistant" | "system" | "developer"; content: string };
      const input: EasyInput[] = [];
      if (options.system) {
        input.push({ role: "developer", content: options.system });
      }
      for (const msg of options.messages) {
        if (msg.role !== "user" && msg.role !== "assistant") {
          throw new Error(
            `Invalid message role "${msg.role}" in OpenAI Responses API call. Only "user" and "assistant" roles are allowed.`,
          );
        }
        if (typeof msg.content === "string") {
          input.push({ role: msg.role, content: msg.content });
        } else {
          const textParts = msg.content.filter((b): b is LLMTextContent => b.type === "text");
          input.push({ role: msg.role, content: textParts.map((t) => t.text).join("\n") });
        }
      }

      const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
        model: this.model,
        input,
        max_output_tokens: options.maxTokens ?? undefined,
      };

      console.log(`[OpenAI Responses API] Request: model=${this.model}, max_output_tokens=${options.maxTokens ?? "<not set>"}`);
      const response: OpenAI.Responses.Response = await this.client.responses.create(
        params,
        options.abortSignal ? { signal: options.abortSignal } : undefined,
      );

      const text = response.output_text || "";
      let stopReason: string;
      if (response.status === "completed") {
        stopReason = "end_turn";
      } else if (response.status === "incomplete") {
        const incompleteReason = response.incomplete_details?.reason;
        stopReason = incompleteReason === "max_output_tokens" ? "max_tokens" : (incompleteReason || "max_tokens");
      } else {
        stopReason = response.status || "";
      }
      return { text, stopReason: normalizeStopReason(stopReason) };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`OpenAI Responses API error for model "${this.model}":`, msg);
      throw error;
    }
  }

  async create(options: LLMOptions): Promise<LLMResponse> {
    if (MODELS_NOT_SUPPORTING_CHAT.has(this.model)) {
      return this.createViaResponses(options);
    }

    try {
      const params = this.buildNonStreamingParams(options);
      const response = await this.client.chat.completions.create(
        params,
        options.abortSignal ? { signal: options.abortSignal } : undefined,
      );

      const text = response.choices[0]?.message?.content || "";
      const finishReason = response.choices[0]?.finish_reason || "";
      return { text, stopReason: normalizeStopReason(finishReason) };
    } catch (error: unknown) {
      const paramType = MODELS_REQUIRING_MAX_COMPLETION_TOKENS.has(this.model) ? "max_completion_tokens" : "max_tokens";
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`OpenAI API error for model "${this.model}" (using ${paramType}):`, msg);
      throw error;
    }
  }

  stream(options: LLMOptions): LLMStream {
    if (MODELS_NOT_SUPPORTING_CHAT.has(this.model)) {
      throw new Error(
        `Model "${this.model}" does not support chat completions. Please select a different model.`
      );
    }

    let abortController: AbortController | null = new AbortController();
    const modelName = this.model;

    const params = this.buildStreamingParams(options);
    const streamPromise = this.client.chat.completions.create(
      params,
      { signal: abortController.signal },
    );

    return {
      [Symbol.asyncIterator]() {
        let openaiStream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> | null = null;
        let iterator: AsyncIterator<OpenAI.Chat.Completions.ChatCompletionChunk> | null = null;

        return {
          async next(): Promise<IteratorResult<LLMStreamEvent>> {
            try {
              if (!openaiStream) {
                openaiStream = await streamPromise;
                iterator = openaiStream[Symbol.asyncIterator]();
              }

              const result = await iterator!.next();
              if (result.done) {
                return { done: true, value: undefined };
              }

              const chunk = result.value;
              const delta = chunk.choices[0]?.delta;
              const finishReason = chunk.choices[0]?.finish_reason;

              if (finishReason) {
                return {
                  done: false,
                  value: { type: "stop", stopReason: normalizeStopReason(finishReason) },
                };
              }

              if (delta?.content) {
                return {
                  done: false,
                  value: { type: "text_delta", text: delta.content },
                };
              }

              return this.next();
            } catch (error: unknown) {
              const paramType = MODELS_REQUIRING_MAX_COMPLETION_TOKENS.has(modelName) ? "max_completion_tokens" : "max_tokens";
              const msg = error instanceof Error ? error.message : String(error);
              console.error(`OpenAI stream error for model "${modelName}" (using ${paramType}):`, msg);
              throw error;
            }
          },
        };
      },
      abort() {
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
      },
    };
  }
}

function toGeminiContents(messages: LLMMessage[]): Array<{ role: string; parts: Array<Record<string, unknown>> }> {
  return messages.map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") {
      return { role, parts: [{ text: m.content }] };
    }
    const parts: Array<Record<string, unknown>> = m.content.map((block) => {
      if (block.type === "image") {
        return {
          inlineData: {
            mimeType: block.source.media_type,
            data: block.source.data,
          },
        };
      }
      return { text: block.text };
    });
    return { role, parts };
  });
}

class GeminiProvider implements LLMProvider {
  private baseURL: string;
  private apiKey: string;
  private model: string;

  constructor(model: string) {
    if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY || !process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
      throw new Error(
        "Gemini integration is not configured. Please install the Gemini AI Integration blueprint in your Replit project."
      );
    }
    this.baseURL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL.replace(/\/+$/, "");
    this.apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    this.model = model;
  }

  private buildRequestBody(options: LLMOptions): Record<string, unknown> {
    const body: Record<string, unknown> = {
      contents: toGeminiContents(options.messages),
      generationConfig: {
        maxOutputTokens: options.maxTokens,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      },
    };
    if (options.system) {
      body.system_instruction = {
        parts: [{ text: options.system }],
      };
    }
    return body;
  }

  async create(options: LLMOptions): Promise<LLMResponse> {
    const url = `${this.baseURL}/models/${this.model}:generateContent`;
    const body = this.buildRequestBody(options);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: options.abortSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
      };

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
      const finishReason = normalizeStopReason(candidate?.finishReason || "");
      return { text, stopReason: finishReason };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Gemini API error for model "${this.model}":`, msg);
      throw error;
    }
  }

  stream(options: LLMOptions): LLMStream {
    let abortController: AbortController | null = new AbortController();
    if (options.abortSignal) {
      const externalSignal = options.abortSignal;
      externalSignal.addEventListener("abort", () => abortController?.abort(), { once: true });
    }
    const modelName = this.model;
    const url = `${this.baseURL}/models/${this.model}:streamGenerateContent?alt=sse`;
    const body = this.buildRequestBody(options);
    const apiKey = this.apiKey;

    const fetchPromise = fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: abortController.signal,
    });

    return {
      [Symbol.asyncIterator]() {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        const decoder = new TextDecoder();
        let buffer = "";
        let dataLines: string[] = [];
        let streamDone = false;

        async function init(): Promise<void> {
          const response = await fetchPromise;
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini stream error (${response.status}): ${errorText}`);
          }
          if (!response.body) {
            throw new Error("Gemini stream response has no body");
          }
          reader = response.body.getReader();
        }

        function parseGeminiEvent(jsonStr: string): LLMStreamEvent | null {
          const chunk = JSON.parse(jsonStr) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
              finishReason?: string;
            }>;
          };
          const candidate = chunk.candidates?.[0];
          const rawFinishReason = candidate?.finishReason;
          const finishReason = rawFinishReason ? normalizeStopReason(rawFinishReason) : undefined;

          if (finishReason && finishReason !== "end_turn") {
            return { type: "stop", stopReason: finishReason };
          }

          const text = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
          if (text) {
            return { type: "text_delta", text };
          }

          if (finishReason === "end_turn") {
            return { type: "stop", stopReason: "end_turn" };
          }

          return null;
        }

        return {
          async next(): Promise<IteratorResult<LLMStreamEvent>> {
            try {
              if (!reader) {
                await init();
              }

              while (true) {
                const lineEnd = buffer.indexOf("\n");
                if (lineEnd !== -1) {
                  const line = buffer.slice(0, lineEnd).replace(/\r$/, "");
                  buffer = buffer.slice(lineEnd + 1);

                  if (line === "") {
                    if (dataLines.length > 0) {
                      const payload = dataLines.join("\n");
                      dataLines = [];
                      if (payload === "[DONE]") {
                        streamDone = true;
                        return { done: true, value: undefined };
                      }
                      try {
                        const event = parseGeminiEvent(payload);
                        if (event) return { done: false, value: event };
                      } catch (e) {
                        console.warn(`[Gemini] Failed to parse SSE payload for model "${modelName}":`, e);
                      }
                    }
                  } else if (line.startsWith("data: ")) {
                    dataLines.push(line.slice(6));
                  }
                  continue;
                }

                if (streamDone) {
                  return { done: true, value: undefined };
                }

                const result = await reader!.read();
                if (result.done) {
                  streamDone = true;
                  if (dataLines.length > 0) {
                    const payload = dataLines.join("\n");
                    dataLines = [];
                    try {
                      const event = parseGeminiEvent(payload);
                      if (event) return { done: false, value: event };
                    } catch (e) {
                      console.warn(`[Gemini] Failed to parse final SSE payload for model "${modelName}":`, e);
                    }
                  }
                  return { done: true, value: undefined };
                }

                buffer += decoder.decode(result.value, { stream: true });
              }
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : String(error);
              console.error(`Gemini stream error for model "${modelName}":`, msg);
              throw error;
            }
          },
        };
      },
      abort() {
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
      },
    };
  }
}

function normalizeStopReason(reason: string | null | undefined): string {
  if (!reason) return "";
  switch (reason) {
    case "length":
    case "MAX_TOKENS":
      return "max_tokens";
    case "stop":
    case "STOP":
      return "end_turn";
    case "SAFETY":
      return "safety";
    case "RECITATION":
      return "recitation";
    default:
      return reason;
  }
}

function withTimeout(provider: LLMProvider): LLMProvider {
  return {
    create(options: LLMOptions): Promise<LLMResponse> {
      const timeout = options.timeoutMs ?? LLM_TIMEOUT_MS;
      const controller = new AbortController();
      let timedOut = false;
      if (options.abortSignal) {
        options.abortSignal.addEventListener("abort", () => controller.abort(options.abortSignal!.reason), { once: true });
      }
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error(`LLM call timed out after ${Math.round(timeout / 1000)}s`));
      }, timeout);
      return provider.create({ ...options, abortSignal: controller.signal })
        .catch((err: any) => {
          if (timedOut) {
            throw new Error(`LLM call timed out after ${Math.round(timeout / 1000)}s`);
          }
          throw err;
        })
        .finally(() => clearTimeout(timer));
    },
    stream(options: LLMOptions): LLMStream {
      return provider.stream(options);
    },
  };
}

const PROVIDER_REGISTRY: Record<string, (model: string) => LLMProvider> = {
  anthropic: (model) => withTimeout(new AnthropicProvider(model)),
  openai: (model) => withTimeout(new OpenAIProvider(model)),
  google: (model) => withTimeout(new GeminiProvider(model)),
};

const DEFAULT_MODEL = "claude-sonnet-4-6";

export const SUPPORTED_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4 (claude-sonnet-4-6)", provider: "anthropic", chatSupported: true },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (claude-haiku-4-5)", provider: "anthropic", chatSupported: true },
  { id: "claude-opus-4", label: "Claude Opus 4 (claude-opus-4)", provider: "anthropic", chatSupported: true },
  { id: "gpt-4o", label: "GPT-4o (gpt-4o)", provider: "openai", chatSupported: true },
  { id: "gpt-5.3-codex", label: "GPT-5.3 Codex (gpt-5.3-codex) - Code only, no chat", provider: "openai", chatSupported: false },
  { id: "gpt-5.2", label: "GPT-5.2 (gpt-5.2)", provider: "openai", chatSupported: true },
  { id: "gpt-5", label: "GPT-5 (gpt-5)", provider: "openai", chatSupported: true },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (gemini-2.5-pro)", provider: "google", chatSupported: true },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (gemini-2.5-flash)", provider: "google", chatSupported: true },
];

export const CHAT_SUPPORTED_MODELS = SUPPORTED_MODELS.filter((m) => m.chatSupported);

function getProviderForModel(modelId: string): string {
  const entry = SUPPORTED_MODELS.find((m) => m.id === modelId);
  if (!entry) {
    console.warn(`[LLM] Unrecognized model "${modelId}" — defaulting to Anthropic provider. Consider updating SUPPORTED_MODELS.`);
    return "anthropic";
  }
  return entry.provider;
}

let cachedProvider: LLMProvider | null = null;
let cachedKey: string | null = null;

let dbModel: string | null = null;

export function setDbModel(model: string | null): void {
  if (model && !SUPPORTED_MODELS.some((m) => m.id === model)) {
    console.warn(`[LLM] Stored model "${model}" is not recognized. Falling back to default "${DEFAULT_MODEL}".`);
    dbModel = null;
  } else {
    dbModel = model;
  }
  cachedProvider = null;
  cachedKey = null;
}

export function getActiveModel(): string {
  return dbModel || process.env.LLM_MODEL || DEFAULT_MODEL;
}

export function getLLM(): LLMProvider {
  const model = getActiveModel();
  const providerName = getProviderForModel(model);
  const key = `${providerName}:${model}`;

  if (cachedProvider && cachedKey === key) {
    return cachedProvider;
  }

  const factory = PROVIDER_REGISTRY[providerName];
  if (!factory) {
    throw new Error(
      `Unknown LLM provider "${providerName}". Available: ${Object.keys(PROVIDER_REGISTRY).join(", ")}`
    );
  }

  cachedProvider = factory(model);
  cachedKey = key;
  console.log(`[LLM] Initialized provider="${providerName}" model="${model}"`);
  return cachedProvider;
}

export function getLLMForModel(modelId: string): LLMProvider {
  const providerName = getProviderForModel(modelId);
  const factory = PROVIDER_REGISTRY[providerName];
  if (!factory) {
    throw new Error(
      `Unknown LLM provider "${providerName}" for model "${modelId}". Available: ${Object.keys(PROVIDER_REGISTRY).join(", ")}`
    );
  }
  console.log(`[LLM] Creating provider="${providerName}" for model="${modelId}"`);
  return factory(modelId);
}

export function getModel(): string {
  return getActiveModel();
}

export function getProviderName(): string {
  const model = getActiveModel();
  return getProviderForModel(model);
}

let dbCodeModel: string | null = null;
let cachedCodeProvider: LLMProvider | null = null;
let cachedCodeKey: string | null = null;

export function setDbCodeModel(model: string | null): void {
  if (model && !SUPPORTED_MODELS.some((m) => m.id === model)) {
    console.warn(`[LLM] Stored code model "${model}" is not recognized. Ignoring.`);
    dbCodeModel = null;
  } else {
    dbCodeModel = model;
  }
  cachedCodeProvider = null;
  cachedCodeKey = null;
}

export function getActiveCodeModel(): string | null {
  return dbCodeModel || null;
}

export function getCodeLLM(): LLMProvider {
  const codeModel = getActiveCodeModel();
  if (!codeModel) {
    return getLLM();
  }

  const providerName = getProviderForModel(codeModel);
  const key = `${providerName}:${codeModel}`;

  if (cachedCodeProvider && cachedCodeKey === key) {
    return cachedCodeProvider;
  }

  const factory = PROVIDER_REGISTRY[providerName];
  if (!factory) {
    throw new Error(
      `Unknown LLM provider "${providerName}" for code model. Available: ${Object.keys(PROVIDER_REGISTRY).join(", ")}`
    );
  }

  cachedCodeProvider = factory(codeModel);
  cachedCodeKey = key;
  console.log(`[LLM] Initialized code provider="${providerName}" model="${codeModel}"`);
  return cachedCodeProvider;
}

export function getCodeProviderName(): string {
  const codeModel = getActiveCodeModel();
  if (!codeModel) return getProviderName();
  return getProviderForModel(codeModel);
}

let dbMetaValidationModel: string | null = null;

export function setDbMetaValidationModel(model: string | null): void {
  if (model && !SUPPORTED_MODELS.some((m) => m.id === model)) {
    console.warn(`[LLM] Stored meta-validation model "${model}" is not recognized. Ignoring.`);
    dbMetaValidationModel = null;
  } else {
    dbMetaValidationModel = model;
  }
}

export function getActiveMetaValidationModel(): string {
  return dbMetaValidationModel || "claude-haiku-4-5";
}

export function getMetaValidationProviderName(): string {
  const model = getActiveMetaValidationModel();
  return getProviderForModel(model);
}

