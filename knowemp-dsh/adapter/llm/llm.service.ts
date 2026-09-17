import { Logger, ConfigService } from '../nest-shim.ts'
import type { OpenAiToolDefinition } from '../agent/tools/tool.types';
import { consumeLlmSseChunk, createLlmSseState } from './openai-sse';
import {
  resolveLlmRuntimeConfig,
  type LlmRuntimeConfig,
} from './llm.config';
import { collapseSystemMessagesForQwen } from './openai-compat.messages';
import { sanitizeToolsForVllm } from './openai-compat.schema';
import { normalizeLlmToolCalls } from '../agent/tools/parse-tool-calls';

export type LlmRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmMessage {
  role: LlmRole;
  content: string | null;
  tool_calls?: LlmToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface LlmChatOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  tools?: OpenAiToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  /** 公司 Qwen 默认开思考；工具调用 / 终答关掉，避免 reasoning 把额度吃光导致 content 为空 */
  thinking?: 'enabled' | 'disabled';
}

export interface LlmChatResult {
  content: string | null;
  reasoning: string | null;
  toolCalls: LlmToolCall[];
  finishReason?: string;
}

export type LlmStreamPart = {
  kind: 'content' | 'reasoning';
  text: string;
};

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: LlmToolCall[];
    };
    delta?: {
      role?: string;
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: 'function';
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  error?: { message?: string; code?: string; type?: string };
}

export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly runtime: LlmRuntimeConfig;

    private readonly config: ConfigService
  constructor(
    config: ConfigService
  ) {
    this.config = config

    this.runtime = resolveLlmRuntimeConfig((key) =>
      this.config.get<string>(key),
    );
    this.logger.log(
      `LLM model=${this.runtime.model} baseUrl=${this.runtime.baseUrl}`,
    );
  }

  isConfigured(): boolean {
    return Boolean(this.runtime.baseUrl && this.runtime.model);
  }

  async complete(prompt: string, options?: LlmChatOptions): Promise<string> {
    const result = await this.chat(
      [{ role: 'user', content: prompt }],
      options,
    );
    if (!result.content?.trim()) {
      throw new Error('LLM 返回空内容');
    }
    return result.content;
  }

  async chat(
    messages: LlmMessage[],
    options: LlmChatOptions = {},
  ): Promise<LlmChatResult> {
    const json = await this.requestCompletion(messages, {
      ...options,
      stream: false,
    });
    const choice = json.choices?.[0];
    const message = choice?.message;
    const nativeCalls = normalizeLlmToolCalls(
      message?.tool_calls ??
        (message as { function_call?: unknown } | undefined)?.function_call,
    );
    return {
      content: message?.content ?? null,
      reasoning: pickReasoning(message),
      toolCalls: nativeCalls,
      finishReason: choice?.finish_reason ?? undefined,
    };
  }

  async *streamChat(
    messages: LlmMessage[],
    options: LlmChatOptions = {},
  ): AsyncGenerator<LlmStreamPart> {
    const thinking = options.thinking ?? 'enabled';
    const streamOptions: LlmChatOptions = {
      ...options,
      tools: undefined,
      toolChoice: 'none',
      thinking,
      maxTokens: options.maxTokens ?? (thinking === 'enabled' ? 16384 : 4096),
    };

    const res = await this.requestRaw(messages, {
      ...streamOptions,
      stream: true,
    });

    if (!res.body) {
      throw new Error('LLM 未返回可读流');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const sse = createLlmSseState();
    let yieldedContent = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        yieldedContent =
          (yield* this.emitSseParts(sse, chunk, false)) || yieldedContent;
      }

      const tail = decoder.decode();
      yieldedContent =
        (yield* this.emitSseParts(sse, tail, true)) || yieldedContent;
    } finally {
      reader.releaseLock();
    }

    if (yieldedContent) return;

    this.logger.warn(
      `LLM stream empty finish=${sse.finishReason ?? 'none'} reasoningChars=${sse.reasoningChars}, fallback to non-stream`,
    );

    const fallback = await this.chat(messages, streamOptions);
    if (fallback.reasoning?.trim()) {
      yield { kind: 'reasoning', text: fallback.reasoning };
    }
    if (fallback.content?.trim()) {
      yield { kind: 'content', text: fallback.content };
      return;
    }

    throw new Error(
      `LLM 流式返回空内容 (finish_reason=${sse.finishReason ?? 'none'}, reasoning_chars=${sse.reasoningChars})`,
    );
  }

  private async *emitSseParts(
    sse: ReturnType<typeof createLlmSseState>,
    chunk: string,
    flush: boolean,
  ): AsyncGenerator<LlmStreamPart, boolean> {
    const parsed = consumeLlmSseChunk(sse, chunk, flush);
    if (parsed.error) {
      throw new Error(`LLM 调用失败: ${parsed.error}`);
    }
    let yieldedContent = false;
    for (const text of parsed.reasonings) {
      yield { kind: 'reasoning', text };
    }
    for (const text of parsed.texts) {
      yieldedContent = true;
      yield { kind: 'content', text };
    }
    return yieldedContent;
  }

  async *stream(
    prompt: string,
    options?: LlmChatOptions,
  ): AsyncGenerator<LlmStreamPart> {
    yield* this.streamChat([{ role: 'user', content: prompt }], options);
  }

  private async requestCompletion(
    messages: LlmMessage[],
    options: LlmChatOptions & { stream: false },
  ): Promise<ChatCompletionResponse> {
    const res = await this.requestRaw(messages, options);
    const text = await res.text();
    let json: ChatCompletionResponse | undefined;
    try {
      json = text ? (JSON.parse(text) as ChatCompletionResponse) : undefined;
    } catch {
      // keep raw
    }
    if (!json) {
      throw new Error(
        `LLM 调用失败: ${text.slice(0, 300) || `HTTP ${res.status}`}`,
      );
    }
    if (json.error?.message) {
      throw new Error(`LLM 调用失败: ${json.error.message}`);
    }
    return json;
  }

  private async requestRaw(
    messages: LlmMessage[],
    options: LlmChatOptions & { stream: boolean },
  ): Promise<Response> {
    const url = `${this.runtime.baseUrl}/chat/completions`;
    const outboundMessages = collapseSystemMessagesForQwen(messages);
    const tools = options.tools?.length
      ? sanitizeToolsForVllm(options.tools)
      : options.tools;
    const body: Record<string, unknown> = {
      model: this.runtime.model,
      messages: outboundMessages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4096,
      stream: options.stream,
    };

    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = options.toolChoice ?? 'auto';
    } else if (options.toolChoice) {
      body.tool_choice = options.toolChoice;
    }

    this.applyThinking(body, options.thinking);

    this.logger.debug(
      `LLM chat model=${this.runtime.model} stream=${options.stream} tools=${tools?.length ?? 0} messages=${outboundMessages.length} thinking=${options.thinking ?? 'default'}`,
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.stream ? { Accept: 'text/event-stream' } : {}),
    };
    if (this.runtime.apiKey) {
      headers.Authorization = `Bearer ${this.runtime.apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      let detail = text.slice(0, 300) || `HTTP ${res.status}`;
      try {
        const json = JSON.parse(text) as ChatCompletionResponse;
        if (json.error?.message) detail = json.error.message;
        else if (json.error?.type || json.error?.code) {
          detail = `${json.error.type ?? 'error'} ${json.error.code ?? res.status}`;
        }
      } catch {
        // keep raw
      }
      throw new Error(`LLM 调用失败: ${detail}`);
    }

    return res;
  }

  private applyThinking(
    body: Record<string, unknown>,
    thinking: LlmChatOptions['thinking'],
  ) {
    // 公司 Qwen 默认开思考；工具调用 / 流式回答默认关掉，显式 thinking=enabled 才打开。
    body.chat_template_kwargs = {
      enable_thinking: thinking === 'enabled',
    };
  }
}

function pickReasoning(message?: {
  reasoning?: string | null;
  reasoning_content?: string | null;
}): string | null {
  const text = message?.reasoning || message?.reasoning_content;
  return text?.trim() ? text : null;
}
