import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../services/claudeApi', () => ({
  callClaude: vi.fn(),
  extractText: vi.fn((res) => res?.__text ?? ''),
  ClaudeApiError: class ClaudeApiError extends Error {
    constructor(msg, { kind } = {}) { super(msg); this.name = 'ClaudeApiError'; this.kind = kind; }
  },
}));

vi.mock('../utils/promptBuilder', () => ({
  buildUpdatePrompt: vi.fn(() => ({ system: 'sys', user: 'usr', version: 'v4' })),
  buildVerifyPrompt: vi.fn(() => ({ system: 'sys', user: 'usr', version: 'v1' })),
}));

vi.mock('../services/responseParser', () => ({
  parseUpdateResponse: vi.fn(),
  parseVerifyResponse: vi.fn(),
}));

vi.mock('../config/models', () => ({
  MODELS: {
    update: 'haiku',
    updateFallback: 'sonnet',
    verify: 'sonnet-verify',
  },
}));

import { useUpdateQueue } from './useUpdateQueue';
import { callClaude } from '../services/claudeApi';
import { parseUpdateResponse } from '../services/responseParser';

const ROW = { id: 'c1', full_name: 'Test Conf', abbreviation: 'TC' };

beforeEach(() => {
  callClaude.mockReset();
  parseUpdateResponse.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useUpdateQueue — Sonnet 재시도 (PLAN-005)', () => {
  it('Haiku 1차에서 start_date 있으면 재시도 없음', async () => {
    callClaude.mockResolvedValueOnce({ __text: 'ok' });
    parseUpdateResponse.mockReturnValueOnce({
      ok: true,
      data: { start_date: '2027-01-01', link: 'https://x' },
    });

    const { result } = renderHook(() =>
      useUpdateQueue({ apiKey: 'k', applyAiUpdate: vi.fn(), applyVerifyUpdate: vi.fn() })
    );

    act(() => result.current.enqueue([ROW]));

    await waitFor(() => expect(result.current.pending).toHaveLength(1));
    expect(callClaude).toHaveBeenCalledTimes(1);
    expect(callClaude.mock.calls[0][0].model).toBe('haiku');
    expect(result.current.pending[0].retry).toBeNull();
    expect(result.current.pending[0].status).toBe('ready');
  });

  it('Haiku 1차에서 start_date null이면 Sonnet+web_fetch 재시도', async () => {
    callClaude
      .mockResolvedValueOnce({ __text: 'first' })
      .mockResolvedValueOnce({ __text: 'second' });
    parseUpdateResponse
      .mockReturnValueOnce({ ok: true, data: { start_date: null, link: 'https://x' } })
      .mockReturnValueOnce({ ok: true, data: { start_date: '2026-07-06', link: 'https://x' } });

    const { result } = renderHook(() =>
      useUpdateQueue({ apiKey: 'k', applyAiUpdate: vi.fn(), applyVerifyUpdate: vi.fn() })
    );

    act(() => result.current.enqueue([ROW]));

    await waitFor(() => expect(result.current.pending).toHaveLength(1));
    expect(callClaude).toHaveBeenCalledTimes(2);
    // 1차: haiku, web_search만
    expect(callClaude.mock.calls[0][0].model).toBe('haiku');
    expect(callClaude.mock.calls[0][0].webFetch).toBeFalsy();
    // 2차: sonnet + web_fetch
    expect(callClaude.mock.calls[1][0].model).toBe('sonnet');
    expect(callClaude.mock.calls[1][0].webFetch).toBe(true);

    expect(result.current.pending[0].retry).toBe('sonnet');
    expect(result.current.pending[0].result.start_date).toBe('2026-07-06');
  });

  it('재시도는 update kind 에서만 — verify 카드는 1회만 호출', async () => {
    callClaude.mockResolvedValueOnce({ __text: 'v' });
    // parseVerify 는 parseUpdate 와 별개 — 이 테스트는 update 재시도 트리거 조건(kind==='update')이 verify에 영향 없는지 확인
    const { parseVerifyResponse } = await import('../services/responseParser');
    parseVerifyResponse.mockReturnValueOnce({ ok: true, data: { full_name: { status: '일치' } } });

    const { result } = renderHook(() =>
      useUpdateQueue({ apiKey: 'k', applyAiUpdate: vi.fn(), applyVerifyUpdate: vi.fn() })
    );

    act(() => result.current.enqueue([ROW], 'verify'));

    await waitFor(() => expect(result.current.pending).toHaveLength(1));
    expect(callClaude).toHaveBeenCalledTimes(1);
    expect(result.current.pending[0].retry).toBeNull();
  });

  it('Sonnet 2차도 parse 실패면 1차 결과 유지 + retry=sonnet_parse_fail', async () => {
    callClaude
      .mockResolvedValueOnce({ __text: 'first' })
      .mockResolvedValueOnce({ __text: 'bad' });
    parseUpdateResponse
      .mockReturnValueOnce({ ok: true, data: { start_date: null, link: 'https://x' } })
      .mockReturnValueOnce({ ok: false, reason: 'no_json', raw: 'bad' });

    const { result } = renderHook(() =>
      useUpdateQueue({ apiKey: 'k', applyAiUpdate: vi.fn(), applyVerifyUpdate: vi.fn() })
    );

    act(() => result.current.enqueue([ROW]));

    await waitFor(() => expect(result.current.pending).toHaveLength(1));
    expect(callClaude).toHaveBeenCalledTimes(2);
    expect(result.current.pending[0].status).toBe('ready');
    expect(result.current.pending[0].result.start_date).toBeNull();
    expect(result.current.pending[0].retry).toBe('sonnet_parse_fail');
  });

  it('Sonnet 2차 API 에러여도 1차 결과 유지 + retry=sonnet_error:*', async () => {
    callClaude
      .mockResolvedValueOnce({ __text: 'first' })
      .mockRejectedValueOnce(Object.assign(new Error('net'), { kind: 'network' }));
    parseUpdateResponse.mockReturnValueOnce({
      ok: true,
      data: { start_date: null, link: 'https://x' },
    });

    const { result } = renderHook(() =>
      useUpdateQueue({ apiKey: 'k', applyAiUpdate: vi.fn(), applyVerifyUpdate: vi.fn() })
    );

    act(() => result.current.enqueue([ROW]));

    await waitFor(() => expect(result.current.pending).toHaveLength(1));
    expect(result.current.pending[0].status).toBe('ready');
    expect(result.current.pending[0].result.start_date).toBeNull();
    expect(result.current.pending[0].retry).toMatch(/^sonnet_error:/);
  });
});
