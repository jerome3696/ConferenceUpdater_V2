import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./githubStorage', () => ({
  fetchFile: vi.fn(),
  commitFile: vi.fn(),
  ConflictError: class ConflictError extends Error {
    constructor(msg) { super(msg); this.name = 'ConflictError'; }
  },
}));

// 기본은 supabase 미설정 상태로 가정. 일부 테스트에서 doMock 으로 재설정.
vi.mock('./supabaseClient', () => ({
  supabase: null,
  supabaseConfigured: false,
}));

import {
  loadConferences,
  saveConferencesLocal,
  commitToGitHub,
  getCachedSha,
  ConflictError,
} from './dataManager';
import { fetchFile, commitFile } from './githubStorage';

const STORAGE_KEY = 'conferenceFinder.data';
const SHA_KEY = 'conferenceFinder.githubSha';

const SAMPLE_DATA = { conferences: [{ id: 'c1', full_name: 'Test Conf' }], editions: [] };

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();

  // fetch 기본 mock (공개 JSON)
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(SAMPLE_DATA),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- loadConferences (legacy 경로 — supabase 미설정) ---

describe('loadConferences (legacy)', () => {
  it('token 있음 → GitHub에서 로드하고 localStorage에 저장', async () => {
    fetchFile.mockResolvedValue({ content: SAMPLE_DATA, sha: 'sha-abc' });

    const result = await loadConferences({ token: 'tok' });

    expect(fetchFile).toHaveBeenCalledWith('tok');
    expect(result.data).toEqual(SAMPLE_DATA);
    expect(result.sha).toBe('sha-abc');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(SAMPLE_DATA));
    expect(localStorage.getItem(SHA_KEY)).toBe('sha-abc');
  });

  it('token 있음 + GitHub 실패 → localStorage fallback', async () => {
    fetchFile.mockRejectedValue(new Error('network error'));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_DATA));
    localStorage.setItem(SHA_KEY, 'cached-sha');

    const result = await loadConferences({ token: 'tok' });

    expect(result.data).toEqual(SAMPLE_DATA);
    expect(result.sha).toBe('cached-sha');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('token 없음 + localStorage 있음 → localStorage 반환', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_DATA));
    localStorage.setItem(SHA_KEY, 'local-sha');

    const result = await loadConferences();

    expect(fetchFile).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.data).toEqual(SAMPLE_DATA);
    expect(result.sha).toBe('local-sha');
  });

  it('token 없음 + localStorage 없음 → 공개 JSON fetch', async () => {
    const result = await loadConferences();

    expect(globalThis.fetch).toHaveBeenCalled();
    expect(result.data).toEqual(SAMPLE_DATA);
    expect(result.sha).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(SAMPLE_DATA));
  });

  it('공개 JSON fetch 실패(HTTP 오류) → 에러 throw', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(loadConferences()).rejects.toThrow('HTTP 404');
  });
});

// --- saveConferencesLocal ---

describe('saveConferencesLocal', () => {
  it('데이터를 localStorage에 JSON 직렬화해 저장', () => {
    saveConferencesLocal(SAMPLE_DATA);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(SAMPLE_DATA));
  });
});

// --- commitToGitHub ---

describe('commitToGitHub', () => {
  it('성공 시 새 sha 반환 + localStorage 갱신', async () => {
    commitFile.mockResolvedValue('new-sha');

    const result = await commitToGitHub('tok', SAMPLE_DATA, 'old-sha');

    expect(commitFile).toHaveBeenCalledWith('tok', SAMPLE_DATA, 'old-sha',
      `Update conferences.json via webapp (${SAMPLE_DATA.conferences.length} conferences)`);
    expect(result).toBe('new-sha');
    expect(localStorage.getItem(SHA_KEY)).toBe('new-sha');
  });

  it('ConflictError 발생 시 그대로 throw', async () => {
    const err = new ConflictError('conflict');
    commitFile.mockRejectedValue(err);

    await expect(commitToGitHub('tok', SAMPLE_DATA, 'old-sha')).rejects.toThrow('conflict');
  });
});

// --- getCachedSha ---

describe('getCachedSha', () => {
  it('저장된 sha 반환', () => {
    localStorage.setItem(SHA_KEY, 'stored-sha');
    expect(getCachedSha()).toBe('stored-sha');
  });

  it('없으면 null 반환', () => {
    expect(getCachedSha()).toBeNull();
  });
});

// --- loadConferences (Supabase 경로) ---

describe('loadConferences (Supabase)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('supabaseConfigured=true 일 때 3 테이블 조회 후 mergeAll', async () => {
    const upstream = [{ id: 'a', full_name: 'A', cycle_years: 1, duration_days: 1 }];
    const editions = [{ id: 'e1', conference_id: 'a', status: 'upcoming', source: 'ai_search', updated_at: 't' }];
    const userRows = [{ conference_id: 'a', starred: 1, overrides: { full_name: 'A!' } }];

    const supabaseMock = {
      from: vi.fn((table) => ({
        select: vi.fn().mockResolvedValue({
          data: table === 'conferences_upstream' ? upstream
            : table === 'editions_upstream' ? editions
            : userRows,
          error: null,
        }),
      })),
    };

    vi.doMock('./supabaseClient', () => ({
      supabase: supabaseMock,
      supabaseConfigured: true,
    }));

    const { loadConferences: load } = await import('./dataManager');
    const result = await load();

    expect(supabaseMock.from).toHaveBeenCalledWith('conferences_upstream');
    expect(supabaseMock.from).toHaveBeenCalledWith('editions_upstream');
    expect(supabaseMock.from).toHaveBeenCalledWith('user_conferences');
    expect(result.data.conferences[0].full_name).toBe('A!');
    expect(result.data.conferences[0].starred).toBe(1);
    expect(result.data.editions[0].id).toBe('e1');
    expect(result.sha).toBeNull();
  });

  it('Supabase 호출 실패 시 legacy path 로 폴백', async () => {
    const supabaseMock = {
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({ data: null, error: new Error('boom') }),
      })),
    };

    vi.doMock('./supabaseClient', () => ({
      supabase: supabaseMock,
      supabaseConfigured: true,
    }));

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_DATA));
    localStorage.setItem(SHA_KEY, 'local-sha');

    const { loadConferences: load } = await import('./dataManager');
    const result = await load();

    expect(result.data).toEqual(SAMPLE_DATA);
    expect(result.sha).toBe('local-sha');
    expect(warn).toHaveBeenCalled();
  });
});
