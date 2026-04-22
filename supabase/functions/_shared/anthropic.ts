// PLAN-028 §4.3 Anthropic Messages API 호출 (Deno)
// Prompt Caching (cache_control: ephemeral) 활성화

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export interface AnthropicCallOpts {
  apiKey: string;
  prompt: string;
  system?: string;
  webSearch?: boolean;
  webFetch?: boolean;
  maxTokens?: number;
  maxWebSearches?: number;
  model?: string;
  cacheSystem?: boolean;
}

export interface AnthropicResponse {
  id: string;
  content: Array<{ type: string; text?: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    server_tool_use?: { web_search_requests?: number };
  };
  stop_reason?: string;
}

export async function callAnthropic(opts: AnthropicCallOpts): Promise<AnthropicResponse> {
  const {
    apiKey, prompt, system,
    webSearch = false, webFetch = false,
    maxTokens = 1024,
    maxWebSearches = 5,
    model = DEFAULT_MODEL,
    cacheSystem = true,
  } = opts;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };

  if (system) {
    // PLAN-028 §4.3: system 블록에 cache_control 부착 (25% 절감)
    body.system = cacheSystem
      ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
      : system;
  }

  const tools: Array<Record<string, unknown>> = [];
  if (webSearch) {
    tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: maxWebSearches });
  }
  if (webFetch) {
    tools.push({ type: 'web_fetch_20250910', name: 'web_fetch' });
  }
  if (tools.length) body.tools = tools;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic ${res.status}: ${errBody.slice(0, 500)}`);
  }

  return await res.json() as AnthropicResponse;
}

export function extractWebSearchCount(r: AnthropicResponse): number {
  return r.usage.server_tool_use?.web_search_requests ?? 0;
}
