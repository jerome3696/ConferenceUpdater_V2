// PLAN-029: Supabase Edge Function `claude-proxy` 호출 래퍼.
// 브라우저는 더 이상 Anthropic API 를 직접 호출하지 않는다.
// JWT 는 supabase 세션에서 자동 부착, 응답의 `response` 만 추출하여 기존 형식(`{content:[{type:'text',...}]}`) 으로 반환.

import { supabase, getAccessToken } from './supabaseClient';

// EDGE_URL 은 호출 시점마다 다시 읽는다 — 테스트에서 env override 가 가능하도록.
function getEdgeUrl() { return import.meta.env.VITE_EDGE_FUNCTION_URL; }
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const VALID_ENDPOINTS = new Set(['update', 'discovery_expand', 'discovery_search', 'verify']);

export class ClaudeApiError extends Error {
  constructor(message, { kind, status, cause, quota } = {}) {
    super(message);
    this.name = 'ClaudeApiError';
    this.kind = kind; // 'auth' | 'network' | 'rate_limit' | 'server' | 'parse' | 'cached' | 'unknown'
    this.status = status;
    this.cause = cause;
    this.quota = quota ?? null;
  }
}

const quotaListeners = new Set();
let lastQuota = null;

export function subscribeQuota(fn) {
  quotaListeners.add(fn);
  return () => { quotaListeners.delete(fn); };
}

export function getLastQuota() {
  return lastQuota;
}

function emitQuota(q) {
  if (!q || typeof q !== 'object') return;
  lastQuota = q;
  for (const fn of Array.from(quotaListeners)) {
    try { fn(q); } catch { /* listener errors must not break the request */ }
  }
}

function mapErrorMessage(payload, status) {
  const code = payload?.error;
  if (code === 'quota_exceeded') return '쿼터 초과: 이번 달 한도를 모두 사용했습니다.';
  if (code === 'budget_cap') return `월 예산 상한 도달 ($${payload?.cap ?? 50}): 이번 달 호출이 차단되었습니다.`;
  if (code === 'unauthorized') return '로그인이 만료되었습니다. 다시 로그인해주세요.';
  if (code === 'upstream_error') return `Anthropic 호출 실패: ${payload?.detail ?? ''}`.trim();
  if (code === 'invalid_body') return '요청 형식이 올바르지 않습니다.';
  if (code === 'invalid_json') return '요청 본문 JSON 형식이 올바르지 않습니다.';
  if (code === 'method_not_allowed') return 'POST 메서드만 허용됩니다.';
  return `API 오류 (${status}): ${code ?? 'unknown'}`;
}

function mapErrorKind(payload, status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 502) return 'server';
  if (status >= 500) return 'server';
  if (status === 400) return 'unknown';
  return 'server';
}

/**
 * Edge Function 경유 Claude 호출.
 * 기존 callClaude signature 와 호환 (apiKey 는 무시, endpoint/conferenceId/forceRefresh 신규).
 */
export async function callClaude({
  prompt,
  system,
  endpoint = 'update',
  conferenceId,
  webSearch = false,
  webFetch = false,
  maxTokens = 1024,
  maxWebSearches = 5,
  model = DEFAULT_MODEL,
  forceRefresh = false,
  signal,
} = {}) {
  const edgeUrl = getEdgeUrl();
  if (!edgeUrl) {
    throw new ClaudeApiError(
      'Edge Function URL 이 설정되지 않았습니다 (VITE_EDGE_FUNCTION_URL).',
      { kind: 'auth' },
    );
  }
  if (!VALID_ENDPOINTS.has(endpoint)) {
    throw new ClaudeApiError(`알 수 없는 endpoint: ${endpoint}`, { kind: 'unknown' });
  }
  if (!supabase) {
    throw new ClaudeApiError(
      'Supabase 클라이언트가 초기화되지 않았습니다.',
      { kind: 'auth' },
    );
  }

  const jwt = await getAccessToken();
  if (!jwt) {
    throw new ClaudeApiError('로그인이 필요합니다.', { kind: 'auth' });
  }

  const body = {
    endpoint,
    prompt,
    webSearch,
    webFetch,
    maxTokens,
    maxWebSearches,
    model,
  };
  if (system) body.system = system;
  if (conferenceId) body.conference_id = conferenceId;
  if (forceRefresh) body.force_refresh = true;

  let res;
  try {
    res = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    const msg = err?.message || '';
    throw new ClaudeApiError(`네트워크 오류: ${msg}`, { kind: 'network', cause: err });
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch (err) {
    throw new ClaudeApiError('응답 JSON 파싱 실패', { kind: 'parse', cause: err });
  }

  if (!res.ok) {
    if (payload?.quota_after) emitQuota(payload.quota_after);
    throw new ClaudeApiError(mapErrorMessage(payload, res.status), {
      kind: mapErrorKind(payload, res.status),
      status: res.status,
      cause: payload,
      quota: payload?.quota_after ?? null,
    });
  }

  if (payload?.cached) {
    throw new ClaudeApiError(
      payload.message || '공용 캐시 히트 — 이미 최신 정보가 있습니다.',
      { kind: 'cached', cause: payload },
    );
  }

  if (payload?.quota_after) emitQuota(payload.quota_after);

  if (!payload?.response) {
    throw new ClaudeApiError('응답 본문에 response 가 없습니다.', {
      kind: 'parse',
      cause: payload,
    });
  }
  return payload.response;
}

export function extractText(response) {
  if (!response?.content) return '';
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
