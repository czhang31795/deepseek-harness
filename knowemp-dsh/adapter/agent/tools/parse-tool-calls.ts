import type { LlmToolCall } from '../../llm/llm.service';

function stringifyArgs(value: unknown): string {
  if (typeof value === 'string') return value.trim() || '{}';
  if (value == null) return '{}';
  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toolCallFromUnknown(
  value: unknown,
  knownNames: Set<string>,
  index: number,
): LlmToolCall | null {
  const rec = asObject(value);
  if (!rec) return null;
  const fn = asObject(rec.function) ?? rec;
  const name = String(fn.name ?? rec.name ?? '').trim();
  if (!name || !knownNames.has(name)) return null;
  const args = fn.arguments ?? rec.arguments ?? rec.parameters ?? {};
  return {
    id: String(rec.id ?? `parsed_${name}_${index}`),
    type: 'function',
    function: {
      name,
      arguments: stringifyArgs(args),
    },
  };
}

function extractBalancedJson(
  text: string,
  start: number,
): { json: string; end: number } | null {
  const open = text.indexOf('{', start);
  if (open < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { json: text.slice(open, i + 1), end: i + 1 };
      }
    }
  }
  return null;
}

/** 把模型写进正文的 JSON / print() 伪调用解析成可执行的 tool_calls。 */
export function extractToolCallsFromText(
  text: string | null | undefined,
  knownNames: Iterable<string>,
): LlmToolCall[] {
  const names = knownNames instanceof Set ? knownNames : new Set(knownNames);
  if (!text?.trim() || names.size === 0) return [];
  const calls: LlmToolCall[] = [];
  const seen = new Set<string>();
  let index = 0;
  const push = (call: LlmToolCall | null) => {
    if (!call) return;
    const key = `${call.function.name}:${call.function.arguments}`;
    if (seen.has(key)) return;
    seen.add(key);
    calls.push(call);
    index += 1;
  };

  let cursor = 0;
  while (cursor < text.length) {
    const extracted = extractBalancedJson(text, cursor);
    if (!extracted) break;
    cursor = extracted.end;
    let parsed: unknown;
    try {
      parsed = JSON.parse(extracted.json);
    } catch {
      continue;
    }
    push(toolCallFromUnknown(parsed, names, index));
  }
  for (const call of extractCallStyleToolCalls(text, names, index)) {
    push(call);
  }
  return calls;
}

export function looksLikeToolCallDump(
  text: string | null | undefined,
  knownNames: Iterable<string>,
): boolean {
  return extractToolCallsFromText(text, knownNames).length > 0;
}

export function isPseudoToolText(text: string | null | undefined): boolean {
  const value = text?.trim() ?? '';
  if (!value) return false;
  return /print\s*\(|\bsearch_knowledge\s*\(|```(?:json|python)?\s*\{/.test(
    value,
  );
}

export function isDumpedToolCallText(
  text: string | null | undefined,
  knownNames: Iterable<string>,
): boolean {
  return isPseudoToolText(text) || looksLikeToolCallDump(text, knownNames);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCallStyleArgs(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('{')) {
    try {
      const rec = JSON.parse(trimmed) as unknown;
      if (rec && typeof rec === 'object' && !Array.isArray(rec)) {
        return rec as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return { query: trimmed.slice(1, -1) };
  }
  const rec: Record<string, unknown> = {};
  const kw = /(\w+)\s*=\s*(['"])(.*?)\2/g;
  for (const match of trimmed.matchAll(kw)) {
    rec[match[1]] = match[3];
  }
  return rec;
}

/** print("search_knowledge(query='…')") 或 search_knowledge(query="…") */
function extractCallStyleToolCalls(
  text: string,
  names: Set<string>,
  startIndex: number,
): LlmToolCall[] {
  const alt = [...names]
    .map(escapeRegExp)
    .sort((left, right) => right.length - left.length)
    .join('|');
  if (!alt) return [];
  const re = new RegExp(
    String.raw`(?:print\s*\(\s*["'])?(${alt})\s*\(([\s\S]*?)\)(?:\s*["']\s*\))?`,
    'gi',
  );
  const calls: LlmToolCall[] = [];
  let index = startIndex;
  for (const match of text.matchAll(re)) {
    const rawName = String(match[1] ?? '').trim();
    const name = [...names].find(
      (item) => item.toLowerCase() === rawName.toLowerCase(),
    );
    if (!name) continue;
    const args = parseCallStyleArgs(match[2] ?? '');
    calls.push({
      id: `parsed_${name}_${index}`,
      type: 'function',
      function: {
        name,
        arguments: stringifyArgs(args),
      },
    });
    index += 1;
  }
  return calls;
}

/** 兼容 arguments 为对象、或旧版 function_call 单条。 */
export function normalizeLlmToolCalls(raw: unknown): LlmToolCall[] {
  if (Array.isArray(raw) && raw.length) {
    const calls: LlmToolCall[] = [];
    raw.forEach((item, index) => {
      const rec = asObject(item);
      if (!rec) return;
      const fn = asObject(rec.function) ?? rec;
      const name = String(fn.name ?? '').trim();
      if (!name) return;
      calls.push({
        id: String(rec.id ?? `call_${index}`),
        type: 'function',
        function: { name, arguments: stringifyArgs(fn.arguments) },
      });
    });
    return calls;
  }
  const rec = asObject(raw);
  const fn = rec ? asObject(rec.function) ?? rec : null;
  const name = String(fn?.name ?? '').trim();
  if (!name || !fn) return [];
  return [
    {
      id: String(rec?.id ?? 'call_0'),
      type: 'function',
      function: { name, arguments: stringifyArgs(fn.arguments) },
    },
  ];
}
