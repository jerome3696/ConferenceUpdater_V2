import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConferences } from './useConferences';

vi.mock('../services/dataManager', () => ({
  loadConferences: vi.fn(),
  saveConferencesLocal: vi.fn(),
  commitToGitHub: vi.fn(),
  getCachedSha: vi.fn().mockReturnValue(null),
  ConflictError: class ConflictError extends Error {
    constructor(msg) { super(msg); this.name = 'ConflictError'; }
  },
}));

vi.mock('../utils/dateUtils', () => ({
  isExpired: vi.fn().mockReturnValue(false),
  formatDate: vi.fn((d) => d),
  todayIso: vi.fn().mockReturnValue('2026-04-17'),
}));

import { loadConferences, saveConferencesLocal, commitToGitHub } from '../services/dataManager';
import { isExpired } from '../utils/dateUtils';

const CONFERENCE = { id: 'c1', full_name: 'Thermal Conf', category: 'heat', field: 'HT', region: 'EU', starred: false };
const EDITION_UPCOMING = { id: 'ed1', conference_id: 'c1', status: 'upcoming', start_date: '2026-09-01', end_date: '2026-09-05', venue: 'Paris', link: 'https://example.com', source: 'user_input' };
const EDITION_PAST = { id: 'ed2', conference_id: 'c1', status: 'past', start_date: '2025-09-01', end_date: '2025-09-05', venue: 'Berlin', link: null, source: 'user_input' };

function makeData(conferences = [CONFERENCE], editions = []) {
  return { conferences, editions };
}

beforeEach(() => {
  loadConferences.mockResolvedValue({ data: makeData(), sha: null });
  saveConferencesLocal.mockImplementation(() => {});
  commitToGitHub.mockResolvedValue('new-sha');
  isExpired.mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

// --- 데이터 로드 ---

describe('데이터 로드', () => {
  it('초기 로드 후 loading=false, rows에 학회 포함', async () => {
    const { result } = renderHook(() => useConferences());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].id).toBe('c1');
  });

  it('loadConferences 실패 시 error 상태 설정', async () => {
    const err = new Error('network error');
    loadConferences.mockRejectedValue(err);

    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(err);
  });

  it('token 변경 시 재로드', async () => {
    const { result, rerender } = renderHook(({ token }) => useConferences({ token }), {
      initialProps: { token: undefined },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadConferences).toHaveBeenCalledTimes(1);

    rerender({ token: 'new-token' });
    await waitFor(() => expect(loadConferences).toHaveBeenCalledTimes(2));
    expect(loadConferences).toHaveBeenLastCalledWith({ token: 'new-token' });
  });
});

// --- 날짜 자동 전환 ---

describe('날짜 자동 전환', () => {
  it('만료된 upcoming 에디션은 rows에서 upcoming 없음 (past로 전환)', async () => {
    loadConferences.mockResolvedValue({
      data: makeData([CONFERENCE], [EDITION_UPCOMING]),
      sha: null,
    });
    isExpired.mockReturnValue(true);

    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows[0].upcoming).toBeUndefined();
  });

  it('만료되지 않은 upcoming은 rows에 그대로 포함', async () => {
    loadConferences.mockResolvedValue({
      data: makeData([CONFERENCE], [EDITION_UPCOMING]),
      sha: null,
    });
    isExpired.mockReturnValue(false);

    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows[0].upcoming).toBeDefined();
    expect(result.current.rows[0].upcoming.id).toBe('ed1');
  });
});

// --- applyAiUpdate ---

describe('applyAiUpdate', () => {
  it('기존 upcoming 없음 → 신규 ai_search 에디션 생성', async () => {
    loadConferences.mockResolvedValue({ data: makeData([CONFERENCE], []), sha: null });

    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.applyAiUpdate('c1', {
        start_date: '2027-09-01',
        end_date: '2027-09-05',
        venue: 'Tokyo',
        link: 'https://example.com',
      });
    });

    const editions = result.current.data.editions;
    expect(editions).toHaveLength(1);
    expect(editions[0].source).toBe('ai_search');
    expect(editions[0].status).toBe('upcoming');
    expect(editions[0].venue).toBe('Tokyo');
    expect(saveConferencesLocal).toHaveBeenCalled();
  });

  it('기존 upcoming 있음 → 해당 에디션 업데이트 (신규 생성 없음)', async () => {
    loadConferences.mockResolvedValue({
      data: makeData([CONFERENCE], [EDITION_UPCOMING]),
      sha: null,
    });

    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.applyAiUpdate('c1', {
        start_date: '2026-10-01',
        end_date: '2026-10-05',
        venue: 'Rome',
        link: null,
      });
    });

    const editions = result.current.data.editions;
    expect(editions).toHaveLength(1);
    expect(editions[0].id).toBe('ed1');
    expect(editions[0].venue).toBe('Rome');
    expect(editions[0].source).toBe('ai_search');
  });

  it('applyAiUpdate 후 token 있으면 syncStatus=dirty (debounce 대기)', async () => {
    loadConferences.mockResolvedValue({ data: makeData([CONFERENCE], []), sha: null });

    vi.useFakeTimers();
    const { result } = renderHook(() => useConferences({ token: 'tok' }));

    // 초기 로드: 타이머 + 마이크로태스크 전부 flush
    await act(async () => { await vi.runAllTimersAsync(); });

    act(() => {
      result.current.applyAiUpdate('c1', { start_date: '2027-01-01', end_date: null, venue: null, link: null });
    });

    expect(result.current.syncStatus).toBe('dirty');

    // debounce(10초) 경과 후 commitToGitHub Promise까지 flush
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.syncStatus).toBe('saved');
  });
});

// --- rows 계산 ---

describe('rows 계산', () => {
  it('에디션 없는 학회는 upcoming, last 모두 undefined', async () => {
    loadConferences.mockResolvedValue({ data: makeData([CONFERENCE], []), sha: null });

    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows[0].upcoming).toBeUndefined();
    expect(result.current.rows[0].last).toBeUndefined();
  });

  it('upcoming + past 에디션 모두 있을 때 올바르게 rows 조인', async () => {
    loadConferences.mockResolvedValue({
      data: makeData([CONFERENCE], [EDITION_UPCOMING, EDITION_PAST]),
      sha: null,
    });

    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows[0].upcoming.id).toBe('ed1');
    expect(result.current.rows[0].last.id).toBe('ed2');
  });
});
