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
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Content, Part, EnhancedGenerateContentResponse } from "@google/generative-ai";

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

export interface LLMOptions {
  system: string;
  messages: LLMMessage[];
  maxTokens: number;
  abortSignal?: AbortSignal;
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

class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(model: string) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is required for OpenAI models. Please set it in your environment secrets."
      );
    }
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async create(options: LLMOptions): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        max_tokens: options.maxTokens,
        messages: toOpenAIMessages(options.system, options.messages),
      },
      options.abortSignal ? { signal: options.abortSignal } : undefined,
    );

    const text = response.choices[0]?.message?.content || "";
    const finishReason = response.choices[0]?.finish_reason || "";
    return { text, stopReason: finishReason };
  }

  stream(options: LLMOptions): LLMStream {
    let abortController: AbortController | null = new AbortController();

    const streamPromise = this.client.chat.completions.create(
      {
        model: this.model,
        max_tokens: options.maxTokens,
        messages: toOpenAIMessages(options.system, options.messages),
        stream: true,
      },
      { signal: abortController.signal },
    );

    return {
      [Symbol.asyncIterator]() {
        let openaiStream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> | null = null;
        let iterator: AsyncIterator<OpenAI.Chat.Completions.ChatCompletionChunk> | null = null;

        return {
          async next(): Promise<IteratorResult<LLMStreamEvent>> {
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
                value: { type: "stop", stopReason: finishReason },
              };
            }

            if (delta?.content) {
              return {
                done: false,
                value: { type: "text_delta", text: delta.content },
              };
            }

            return this.next();
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

function toGeminiContents(messages: LLMMessage[]): Content[] {
  return messages.map((m): Content => {
    const role = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") {
      return { role, parts: [{ text: m.content }] };
    }
    const parts: Part[] = m.content.map((block) => {
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
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(model: string) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_AI_API_KEY environment variable is required for Gemini models. Please set it in your environment secrets."
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async create(options: LLMOptions): Promise<LLMResponse> {
    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: options.system,
    });

    const result = await genModel.generateContent({
      contents: toGeminiContents(options.messages),
      generationConfig: { maxOutputTokens: options.maxTokens },
    });

    const response = result.response;
    const text = response.text();
    const finishReason = response.candidates?.[0]?.finishReason || "STOP";
    return { text, stopReason: finishReason };
  }

  stream(options: LLMOptions): LLMStream {
    let aborted = false;

    const genModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: options.system,
    });

    const streamPromise = genModel.generateContentStream({
      contents: toGeminiContents(options.messages),
      generationConfig: { maxOutputTokens: options.maxTokens },
    });

    return {
      [Symbol.asyncIterator]() {
        let streamResult: Awaited<typeof streamPromise> | null = null;
        let iterator: AsyncIterator<EnhancedGenerateContentResponse> | null = null;
        let finished = false;

        return {
          async next(): Promise<IteratorResult<LLMStreamEvent>> {
            if (aborted || finished) {
              return { done: true, value: undefined };
            }

            if (!streamResult) {
              streamResult = await streamPromise;
              iterator = streamResult.stream[Symbol.asyncIterator]();
            }

            const result = await iterator!.next();
            if (result.done) {
              finished = true;
              return {
                done: false,
                value: { type: "stop", stopReason: "STOP" },
              };
            }

            const chunk = result.value;
            const text = chunk.text?.();
            if (text) {
              return {
                done: false,
                value: { type: "text_delta", text },
              };
            }

            return this.next();
          },
        };
      },
      abort() {
        aborted = true;
      },
    };
  }
}

const PROVIDER_REGISTRY: Record<string, (model: string) => LLMProvider> = {
  anthropic: (model) => new AnthropicProvider(model),
  openai: (model) => new OpenAIProvider(model),
  google: (model) => new GeminiProvider(model),
};

const DEFAULT_MODEL = "claude-sonnet-4-6";

export const SUPPORTED_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4 (claude-sonnet-4-6)", provider: "anthropic" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (claude-haiku-4-5)", provider: "anthropic" },
  { id: "claude-opus-4", label: "Claude Opus 4 (claude-opus-4)", provider: "anthropic" },
  { id: "gpt-5.3-codex", label: "ChatGPT 5.3 Codex (gpt-5.3-codex)", provider: "openai" },
  { id: "gpt-5.0", label: "ChatGPT 5.0 (gpt-5.0)", provider: "openai" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (gemini-2.5-pro)", provider: "google" },
];

function getProviderForModel(modelId: string): string {
  const entry = SUPPORTED_MODELS.find((m) => m.id === modelId);
  return entry?.provider || "anthropic";
}

let cachedProvider: LLMProvider | null = null;
let cachedKey: string | null = null;

let dbModel: string | null = null;

export function setDbModel(model: string | null): void {
  dbModel = model;
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

export function getModel(): string {
  return getActiveModel();
}

export function getProviderName(): string {
  const model = getActiveModel();
  return getProviderForModel(model);
}
