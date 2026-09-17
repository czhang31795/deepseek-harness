export interface LlmRuntimeConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

const DEFAULT_BASE_URL =
  'http://qwen35112b-qwen35-122b.ai.xyl.cn:30080/v1';
const DEFAULT_MODEL = 'qwen35-122b';

export function resolveLlmRuntimeConfig(
  get: (key: string) => string | undefined,
): LlmRuntimeConfig {
  return {
    baseUrl: stripTrailingSlash(
      get('QWEN_BASE_URL')?.trim() || DEFAULT_BASE_URL,
    ),
    model: get('QWEN_MODEL')?.trim() || DEFAULT_MODEL,
    apiKey: get('QWEN_API_KEY')?.trim() || undefined,
  };
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}
