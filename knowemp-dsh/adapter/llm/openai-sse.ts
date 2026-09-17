export type LlmContentPart =
  | string
  | { type?: string; text?: string }
  | null
  | undefined;

export interface LlmStreamChoice {
  finish_reason?: string | null;
  delta?: {
    content?: LlmContentPart | LlmContentPart[];
    reasoning_content?: string | null;
    reasoning?: string | null;
  };
  message?: {
    content?: LlmContentPart | LlmContentPart[];
    reasoning_content?: string | null;
    reasoning?: string | null;
  };
}

export interface LlmStreamPayload {
  choices?: LlmStreamChoice[];
  error?: { message?: string; code?: string };
}

export interface LlmSseState {
  buffer: string;
  reasoningChars: number;
  finishReason?: string;
}

export function createLlmSseState(): LlmSseState {
  return { buffer: '', reasoningChars: 0 };
}

export function normalizeLlmText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (!Array.isArray(raw)) return '';
  return raw
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part) {
        return typeof part.text === 'string' ? part.text : '';
      }
      return '';
    })
    .join('');
}

export function parseLlmSseLine(line: string): {
  text?: string;
  reasoning?: string;
  finishReason?: string;
  error?: string;
} | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return null;

  let data = trimmed;
  if (trimmed.startsWith('data:')) {
    data = trimmed.slice(5).trim();
  } else if (!trimmed.startsWith('{')) {
    return null;
  }
  if (!data || data === '[DONE]') return null;

  let json: LlmStreamPayload;
  try {
    json = JSON.parse(data) as LlmStreamPayload;
  } catch {
    return null;
  }

  if (json.error?.message) {
    return { error: json.error.message };
  }

  const choice = json.choices?.[0];
  if (!choice) return null;

  const reasoningRaw =
    choice.delta?.reasoning_content ??
    choice.message?.reasoning_content ??
    choice.delta?.reasoning ??
    choice.message?.reasoning;
  const reasoning = typeof reasoningRaw === 'string' ? reasoningRaw : '';
  const text = normalizeLlmText(
    choice.delta?.content ?? choice.message?.content,
  );

  return {
    text: text.length ? text : undefined,
    reasoning: reasoning.length ? reasoning : undefined,
    finishReason: choice.finish_reason ?? undefined,
  };
}

export function consumeLlmSseChunk(
  state: LlmSseState,
  chunk: string,
  flush = false,
): { texts: string[]; reasonings: string[]; error?: string } {
  state.buffer += chunk;
  const parts = state.buffer.split(/\r?\n/);
  state.buffer = flush ? '' : (parts.pop() ?? '');

  const texts: string[] = [];
  const reasonings: string[] = [];
  for (const line of parts) {
    const parsed = parseLlmSseLine(line);
    if (!parsed) continue;
    if (parsed.error) return { texts, reasonings, error: parsed.error };
    if (parsed.finishReason) state.finishReason = parsed.finishReason;
    if (parsed.reasoning) {
      state.reasoningChars += parsed.reasoning.length;
      reasonings.push(parsed.reasoning);
    }
    if (parsed.text) texts.push(parsed.text);
  }
  return { texts, reasonings };
}
