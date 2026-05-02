import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// supabase 가 없는 상태에서는 callClaude 가 즉시 auth 에러를 던지므로,
// JWT 가 살아있는 상황을 모사하기 위해 mock.
vi.mock('./supabaseClient', () => ({
  supabase: { auth: { getSession: vi.fn() } },
  supabaseConfigured: true,
  getAccessToken: vi.fn().mockResolvedValue('jwt-token'),
}));

import { callClaude, ClaudeApiError, subscribeQuota } from './claudeApiServer';

const ENV_BACKUP = { ...import.meta.env };

beforeEach(() => {
  // VITE_EDGE_FUNCTION_URL 강제 주입 (테스트 환경에서 부재일 수 있음)
  import.meta.env.VITE_EDGE_FUNCTION_URL = 'https://example.supabase.co/functions/v1/claude-proxy';
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  Object.assign(import.meta.env, ENV_BACKUP);
  vi.restoreAllMocks();
});

describe('callClaude (정상)', () => {
  it('200 응답에서 response 만 추출하여 반환 + quota_after 구독자에게 전달', async () => {
    const fakeResponse = { content: [{ type: 'text', text: 'hello' }], usage: {} };
    const fakeQuota = { update_used: 1, update_limit: 10, discovery_used: 0, discovery_limit: 3 };
    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ response: fakeResponse, cost_usd: 0.01, quota_after: fakeQuota }),
    });

    const seen = [];
    const unsub = subscribeQuota((q) => seen.push(q));

    const out = await callClaude({
      prompt: 'hi', system: 'sys', endpoint: 'update', conferenceId: 'c1', forceRefresh: true,
    });

    unsub();
    expect(out).toEqual(fakeResponse);
    expect(seen).toEqual([fakeQuota]);

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/claude-proxy');
    expect(init.headers.authorization).toBe('Bearer jwt-token');
    const body = JSON.parse(init.body);
    expect(body.endpoint).toBe('update');
    expect(body.conference_id).toBe('c1');
    expect(body.force_refresh).toBe(true);
  });
});

describe('callClaude (429 quota_exceeded)', () => {
  it('rate_limit kind + quota 메시지 + payload.quota_after 도 emit', async () => {
    const fakeQuota = { update_used: 10, update_limit: 10, discovery_used: 0, discovery_limit: 3 };
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'quota_exceeded', quota_after: fakeQuota }),
    });

    await expect(callClaude({ prompt: 'p', endpoint: 'update' })).rejects.toMatchObject({
      name: 'ClaudeApiError',
      kind: 'rate_limit',
      status: 429,
      quota: fakeQuota,
    });
  });
});

describe('callClaude (429 budget_cap)', () => {
  it('rate_limit kind + 메시지에 cap 표시', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'budget_cap', monthly_used: 51, cap: 50 }),
    });

    await expect(callClaude({ prompt: 'p', endpoint: 'update' })).rejects.toMatchObject({
      name: 'ClaudeApiError',
      kind: 'rate_limit',
      status: 429,
    });
    try {
      await callClaude({ prompt: 'p', endpoint: 'update' });
    } catch (e) {
      expect(e.message).toMatch(/예산/);
      expect(e.message).toMatch(/\$50/);
    }
  });
});

describe('callClaude (401 unauthorized)', () => {
  it('auth kind 매핑', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized' }),
    });

    await expect(callClaude({ prompt: 'p', endpoint: 'update' })).rejects.toMatchObject({
      name: 'ClaudeApiError',
      kind: 'auth',
      status: 401,
    });
  });
});

describe('callClaude (cache hit)', () => {
  it('cached:true 응답은 ClaudeApiError(kind=cached) 로 변환', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ cached: true, conference_id: 'c1', last_ai_update_at: 't' }),
    });

    await expect(callClaude({
      prompt: 'p', endpoint: 'update', conferenceId: 'c1',
    })).rejects.toMatchObject({
      name: 'ClaudeApiError',
      kind: 'cached',
    });
  });
});

describe('callClaude (502 upstream)', () => {
  it('server kind 매핑 + detail 메시지 반영', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'upstream_error', detail: 'boom' }),
    });

    await expect(callClaude({ prompt: 'p', endpoint: 'update' })).rejects.toMatchObject({
      name: 'ClaudeApiError',
      kind: 'server',
      status: 502,
    });
  });
});

describe('callClaude (인자 검증)', () => {
  it('알 수 없는 endpoint 는 즉시 ClaudeApiError', async () => {
    await expect(callClaude({ prompt: 'p', endpoint: 'bogus' })).rejects.toMatchObject({
      name: 'ClaudeApiError',
      kind: 'unknown',
    });
  });
});

describe('subscribeQuota', () => {
  it('해제 후에는 더 이상 호출되지 않음', async () => {
    const fakeResponse = { content: [], usage: {} };
    const fakeQuota = { update_used: 2, update_limit: 10, discovery_used: 0, discovery_limit: 3 };
    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ response: fakeResponse, cost_usd: 0, quota_after: fakeQuota }),
    });
    const seen = [];
    const unsub = subscribeQuota((q) => seen.push(q));
    unsub();
    await callClaude({ prompt: 'p', endpoint: 'update' });
    expect(seen).toEqual([]);
  });
});

// 헷갈림 방지: 보장 — 정상 export 가 정의돼 있다.
describe('exports', () => {
  it('ClaudeApiError 인스턴스화', () => {
    const e = new ClaudeApiError('x', { kind: 'auth', status: 401 });
    expect(e).toBeInstanceOf(Error);
    expect(e.kind).toBe('auth');
  });
});
