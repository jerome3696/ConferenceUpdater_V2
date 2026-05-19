import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../services/libraryService', () => ({
  fetchUserLibraries: vi.fn(),
  fetchSelectableLibraries: vi.fn(),
  fetchLibraryConferences: vi.fn(),
  fetchOwnedVirtualLibrary: vi.fn(),
  subscribeUserToLibraries: vi.fn(),
  unsubscribeFromLibrary: vi.fn(),
  markLibrarySeen: vi.fn(),
}));

import { useLibraries } from './useLibraries';
import {
  fetchUserLibraries,
  fetchSelectableLibraries,
  fetchLibraryConferences,
  fetchOwnedVirtualLibrary,
  subscribeUserToLibraries,
  unsubscribeFromLibrary,
  markLibrarySeen,
} from '../services/libraryService';

const SEEN = '2026-05-10T00:00:00Z';
// 구독 라이브러리: 마스터(2026-05-10 마지막 확인) + 공조.
const SUBSCRIBED = [
  { id: 'lib_master', name: '마스터', description: '메인', last_seen_at: SEEN },
  { id: 'lib_hvac', name: '공조', description: null, last_seen_at: SEEN },
];
const SELECTABLE = [
  { id: 'lib_master', name: '마스터', description: '메인' },
  { id: 'lib_hvac', name: '공조', description: null },
  { id: 'lib_dt', name: '디지털트윈', description: null },
];
// lib_master 에 last_seen_at 이후(c_new) 1건 + 이전(c_old) 1건 추가됨.
const LIB_CONFS = [
  { library_id: 'lib_master', conference_id: 'c_old', added_at: '2026-05-01T00:00:00Z' },
  { library_id: 'lib_master', conference_id: 'c_new', added_at: '2026-05-15T00:00:00Z' },
  { library_id: 'lib_hvac', conference_id: 'c_old', added_at: '2026-05-02T00:00:00Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  fetchUserLibraries.mockResolvedValue(SUBSCRIBED);
  fetchSelectableLibraries.mockResolvedValue(SELECTABLE);
  fetchLibraryConferences.mockResolvedValue(LIB_CONFS);
  fetchOwnedVirtualLibrary.mockResolvedValue({ id: 'lib_personal_u1', name: '내 학회', description: null });
  subscribeUserToLibraries.mockResolvedValue(undefined);
  unsubscribeFromLibrary.mockResolvedValue(undefined);
  markLibrarySeen.mockResolvedValue(undefined);
});

describe('useLibraries', () => {
  it('userId 없으면 loading 고정, 서비스 호출 안 함', () => {
    const { result } = renderHook(() => useLibraries(undefined));
    expect(result.current.loading).toBe(true);
    expect(fetchUserLibraries).not.toHaveBeenCalled();
  });

  it('로드 후 구독 목록 노출', async () => {
    const { result } = renderHook(() => useLibraries('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscribed.map((l) => l.id)).toEqual(['lib_master', 'lib_hvac']);
  });

  it('available: 선택 가능 라이브러리에서 구독 중인 것 제외', async () => {
    const { result } = renderHook(() => useLibraries('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.available.map((l) => l.id)).toEqual(['lib_dt']);
  });

  it('personalLibrary: 본인 가상 "내 학회" 노출 (PLAN-041)', async () => {
    const { result } = renderHook(() => useLibraries('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.personalLibrary).toEqual({
      id: 'lib_personal_u1', name: '내 학회', description: null,
    });
  });

  it('syncAlerts: last_seen_at 이후 추가된 학회만 묶음', async () => {
    const { result } = renderHook(() => useLibraries('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // lib_master 에 c_new(05-15)만 새 학회. lib_hvac 은 신규 없음 → 알림 1건.
    expect(result.current.syncAlerts).toEqual([
      { libraryId: 'lib_master', libraryName: '마스터', newConferenceIds: ['c_new'] },
    ]);
  });

  it('subscribe → 서비스 호출 + 재로드', async () => {
    const { result } = renderHook(() => useLibraries('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.subscribe('lib_dt'));
    expect(subscribeUserToLibraries).toHaveBeenCalledWith('u1', ['lib_dt']);
    expect(fetchUserLibraries).toHaveBeenCalledTimes(2); // 초기 + 재로드
  });

  it('unsubscribe → 서비스 호출 + 재로드', async () => {
    const { result } = renderHook(() => useLibraries('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.unsubscribe('lib_hvac'));
    expect(unsubscribeFromLibrary).toHaveBeenCalledWith('u1', 'lib_hvac');
    expect(fetchUserLibraries).toHaveBeenCalledTimes(2);
  });

  it('dismissAlert → markLibrarySeen 호출 + 재로드', async () => {
    const { result } = renderHook(() => useLibraries('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.dismissAlert('lib_master'));
    expect(markLibrarySeen).toHaveBeenCalledWith('u1', 'lib_master');
    expect(fetchLibraryConferences).toHaveBeenCalledTimes(2);
  });

  it('로드 실패 시 error 노출, loading 해제', async () => {
    fetchUserLibraries.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useLibraries('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
  });
});
