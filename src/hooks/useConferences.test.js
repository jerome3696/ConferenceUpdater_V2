import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConferences } from './useConferences';

vi.mock('../services/dataManager', () => ({
  loadConferences: vi.fn(),
  saveConferencesLocal: vi.fn(),
  commitToGitHub: vi.fn(),
  getCachedSha: vi.fn().mockReturnValue(null),
  generateDiscoveryConferenceId: vi.fn(() => `disc_${Math.random().toString(36).slice(2, 8)}`),
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

// --- applyLastDiscovery (PLAN-013-D) ---

describe('applyLastDiscovery', () => {
  it('past 에디션이 없으면 신규 생성 (source=ai_search, status=past)', async () => {
    loadConferences.mockResolvedValue({ data: makeData([CONFERENCE], []), sha: null });
    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.applyLastDiscovery('c1', {
        start_date: '2024-09-01',
        end_date: '2024-09-05',
        venue: 'Milan',
        link: 'https://iccfd24.example/',
      });
    });

    const editions = result.current.data.editions;
    expect(editions).toHaveLength(1);
    expect(editions[0].status).toBe('past');
    expect(editions[0].source).toBe('ai_search');
    expect(editions[0].start_date).toBe('2024-09-01');
    expect(editions[0].link).toBe('https://iccfd24.example/');
  });

  it('기존 past 보다 더 최근 이면 덮어쓰기', async () => {
    loadConferences.mockResolvedValue({
      data: makeData([CONFERENCE], [EDITION_PAST]), // 2025-09-01
      sha: null,
    });
    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.applyLastDiscovery('c1', {
        start_date: '2026-01-15',
        end_date: '2026-01-20',
        venue: 'Seoul',
        link: 'https://newer.example/',
      });
    });

    const editions = result.current.data.editions;
    expect(editions).toHaveLength(1);
    expect(editions[0].id).toBe('ed2');
    expect(editions[0].start_date).toBe('2026-01-15');
    expect(editions[0].link).toBe('https://newer.example/');
    expect(editions[0].source).toBe('ai_search');
  });

  it('기존 past 가 더 최근이면 아무것도 바꾸지 않음', async () => {
    loadConferences.mockResolvedValue({
      data: makeData([CONFERENCE], [EDITION_PAST]), // 2025-09-01
      sha: null,
    });
    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const snapshot = JSON.stringify(result.current.data.editions);

    act(() => {
      result.current.applyLastDiscovery('c1', {
        start_date: '2023-01-01',
        end_date: '2023-01-05',
        venue: 'Old',
        link: 'https://old.example/',
      });
    });

    expect(JSON.stringify(result.current.data.editions)).toBe(snapshot);
  });

  it('start_date 없으면 무시', async () => {
    loadConferences.mockResolvedValue({ data: makeData([CONFERENCE], []), sha: null });
    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.applyLastDiscovery('c1', { start_date: null, venue: 'X' });
    });

    expect(result.current.data.editions).toHaveLength(0);
  });
});

// --- saveConferenceEdit / upsertEdition source 조건 (QA #13) ---

const EDITION_UPCOMING_AI = {
  id: 'edA', conference_id: 'c1', status: 'upcoming',
  start_date: '2026-09-01', end_date: '2026-09-05', venue: 'Paris', link: 'https://x',
  source: 'ai_search', updated_at: '2026-04-01T00:00:00Z',
};

describe('saveConferenceEdit — source 조건 (QA #13)', () => {
  it('Upcoming 변경 없으면 source ai_search 유지', async () => {
    loadConferences.mockResolvedValue({
      data: makeData([CONFERENCE], [EDITION_UPCOMING_AI]),
      sha: null,
    });

    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.saveConferenceEdit(
        'c1',
        {
          master: { full_name: 'Thermal Conf Updated' },
          starred: 1,
          upcoming: { start_date: '2026-09-01', end_date: '2026-09-05', venue: 'Paris', link: 'https://x' },
          last: { start_date: '', end_date: '', venue: '', link: '' },
        },
        'edA',
        null,
      );
    });

    const ed = result.current.data.editions.find((e) => e.id === 'edA');
    expect(ed.source).toBe('ai_search');
    expect(result.current.data.conferences[0].full_name).toBe('Thermal Conf Updated');
  });

  it('Upcoming 변경 있으면 source user_input으로 승격', async () => {
    loadConferences.mockResolvedValue({
      data: makeData([CONFERENCE], [EDITION_UPCOMING_AI]),
      sha: null,
    });

    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.saveConferenceEdit(
        'c1',
        {
          master: {},
          starred: 0,
          upcoming: { start_date: '2026-09-02', end_date: '2026-09-05', venue: 'Paris', link: 'https://x' },
          last: { start_date: '', end_date: '', venue: '', link: '' },
        },
        'edA',
        null,
      );
    });

    const ed = result.current.data.editions.find((e) => e.id === 'edA');
    expect(ed.source).toBe('user_input');
    expect(ed.start_date).toBe('2026-09-02');
  });

  it('Last(past) 에디션 변경 있어도 source 유지', async () => {
    const pastAi = { ...EDITION_PAST, source: 'ai_search' };
    loadConferences.mockResolvedValue({
      data: makeData([CONFERENCE], [pastAi]),
      sha: null,
    });

    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.saveConferenceEdit(
        'c1',
        {
          master: {},
          starred: 0,
          upcoming: { start_date: '', end_date: '', venue: '', link: '' },
          last: { start_date: '2025-09-01', end_date: '2025-09-05', venue: 'Munich', link: '' },
        },
        null,
        pastAi.id,
      );
    });

    const ed = result.current.data.editions.find((e) => e.id === pastAi.id);
    expect(ed.source).toBe('ai_search');
    expect(ed.venue).toBe('Munich');
  });

  it('신규 Upcoming(없던 학회에 추가) → source user_input', async () => {
    loadConferences.mockResolvedValue({
      data: makeData([CONFERENCE], []),
      sha: null,
    });

    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.saveConferenceEdit(
        'c1',
        {
          master: {},
          starred: 0,
          upcoming: { start_date: '2027-01-01', end_date: '2027-01-05', venue: 'NYC', link: '' },
          last: { start_date: '', end_date: '', venue: '', link: '' },
        },
        null,
        null,
      );
    });

    const upc = result.current.data.editions.find((e) => e.status === 'upcoming');
    expect(upc).toBeDefined();
    expect(upc.source).toBe('user_input');
  });
});

// --- addConferenceFromDiscovery (PLAN-011-C) ---

describe('addConferenceFromDiscovery', () => {
  const FULL_CANDIDATE = {
    full_name: 'European Heat Transfer Symposium',
    abbreviation: 'EHTS',
    field: '열전달',
    region: '유럽',
    official_url: 'https://ehts.example.org',
    organizer: 'EUROTHERM',
    cycle_years: 2,
    evidence_url: 'https://ehts.example.org/2027',
    predatory_score: 'low',
    predatory_reasons: [],
    matched_keywords: [{ ko: '열전달', en: 'heat transfer' }],
    upcoming: {
      start_date: '2027-06-15',
      end_date: '2027-06-18',
      venue: 'Lyon, France',
      link: 'https://ehts.example.org/2027',
    },
  };

  it('master + upcoming edition 동시 생성, source=ai_discovery', async () => {
    loadConferences.mockResolvedValue({ data: makeData([], []), sha: null });
    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let newId;
    act(() => {
      newId = result.current.addConferenceFromDiscovery(FULL_CANDIDATE);
    });

    expect(newId).toMatch(/^disc_/);
    expect(result.current.data.conferences).toHaveLength(1);
    const m = result.current.data.conferences[0];
    expect(m.id).toBe(newId);
    expect(m.full_name).toBe('European Heat Transfer Symposium');
    expect(m.source).toBe('ai_discovery');
    expect(m.field).toBe('열전달');
    expect(m.cycle_years).toBe(2);
    expect(m.discovery_meta.predatory_score).toBe('low');
    expect(m.discovery_meta.matched_keywords[0].en).toBe('heat transfer');

    expect(result.current.data.editions).toHaveLength(1);
    const ed = result.current.data.editions[0];
    expect(ed.conference_id).toBe(newId);
    expect(ed.status).toBe('upcoming');
    expect(ed.source).toBe('ai_discovery');
    expect(ed.start_date).toBe('2027-06-15');
    expect(ed.venue).toBe('Lyon, France');

    expect(saveConferencesLocal).toHaveBeenCalled();
  });

  it('upcoming 없는 candidate → master 만 추가, edition 0건', async () => {
    loadConferences.mockResolvedValue({ data: makeData([], []), sha: null });
    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const candidate = { ...FULL_CANDIDATE, upcoming: undefined };
    act(() => {
      result.current.addConferenceFromDiscovery(candidate);
    });

    expect(result.current.data.conferences).toHaveLength(1);
    expect(result.current.data.editions).toHaveLength(0);
  });

  it('full_name 누락 → null 반환, 데이터 변동 없음', async () => {
    loadConferences.mockResolvedValue({ data: makeData([], []), sha: null });
    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let newId;
    act(() => {
      newId = result.current.addConferenceFromDiscovery({ abbreviation: 'X' });
    });

    expect(newId).toBeNull();
    expect(result.current.data.conferences).toHaveLength(0);
  });

  it('빈 upcoming (모든 필드 비어있음) → edition 생성하지 않음', async () => {
    loadConferences.mockResolvedValue({ data: makeData([], []), sha: null });
    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const candidate = {
      ...FULL_CANDIDATE,
      upcoming: { start_date: null, end_date: null, venue: '', link: '' },
    };
    act(() => {
      result.current.addConferenceFromDiscovery(candidate);
    });

    expect(result.current.data.conferences).toHaveLength(1);
    expect(result.current.data.editions).toHaveLength(0);
  });

  it('predatory_score 미지정 candidate → discovery_meta.predatory_score=medium 폴백', async () => {
    loadConferences.mockResolvedValue({ data: makeData([], []), sha: null });
    const { result } = renderHook(() => useConferences());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const candidate = { full_name: 'Test Conf', abbreviation: 'TC' };
    act(() => {
      result.current.addConferenceFromDiscovery(candidate);
    });

    const m = result.current.data.conferences[0];
    expect(m.discovery_meta.predatory_score).toBe('medium');
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
