// Claude API 호출 로직
// 브라우저에서 직접 호출하기 위해 anthropic-dangerous-direct-browser-access 헤더 사용.
// CORS가 막히는 환경이면 프록시로 교체해야 함 (dev-guide Step 3.1 참조).

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export class ClaudeApiError extends Error {
  constructor(message, { kind, status, cause } = {}) {
    super(message);
    this.name = 'ClaudeApiError';
    this.kind = kind; // 'auth' | 'network' | 'cors' | 'rate_limit' | 'server' | 'parse' | 'unknown'
    this.status = status;
    this.cause = cause;
  }
}

/**
 * Claude messages API 호출.
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.prompt                 사용자 메시지 텍스트
 * @param {string} [opts.system]               시스템 프롬프트
 * @param {boolean} [opts.webSearch=false]     web_search 도구 활성화
 * @param {number} [opts.maxTokens=1024]
 * @param {string} [opts.model]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<object>} 원본 응답 JSON
 */
export async function callClaude({
  apiKey,
  prompt,
  system,
  webSearch = false,
  maxTokens = 1024,
  model = DEFAULT_MODEL,
  signal,
}) {
  if (!apiKey) {
    throw new ClaudeApiError('API 키가 없습니다.', { kind: 'auth' });
  }

  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (system) body.system = system;
  if (webSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    // CORS 차단이나 네트워크 오류는 TypeError로 나타남
    const msg = err?.message || '';
    const isCors = /CORS|Failed to fetch|NetworkError/i.test(msg);
    throw new ClaudeApiError(
      isCors
        ? '브라우저에서 Claude API에 직접 연결할 수 없습니다(CORS 가능성). 프록시가 필요할 수 있습니다.'
        : `네트워크 오류: ${msg}`,
      { kind: isCors ? 'cors' : 'network', cause: err }
    );
  }

  if (!res.ok) {
    let errPayload = null;
    try {
      errPayload = await res.json();
    } catch {
      /* ignore */
    }
    const apiMsg = errPayload?.error?.message || res.statusText;
    let kind = 'server';
    if (res.status === 401 || res.status === 403) kind = 'auth';
    else if (res.status === 429) kind = 'rate_limit';
    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;
    const err = new ClaudeApiError(`API 오류 (${res.status}): ${apiMsg}`, {
      kind,
      status: res.status,
      cause: errPayload,
    });
    if (retryAfterMs && Number.isFinite(retryAfterMs)) err.retryAfterMs = retryAfterMs;
    throw err;
  }

  try {
    return await res.json();
  } catch (err) {
    throw new ClaudeApiError('응답 JSON 파싱 실패', { kind: 'parse', cause: err });
  }
}

/**
 * 응답에서 텍스트 블록만 연결해서 반환.
 */
export function extractText(response) {
  if (!response?.content) return '';
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
