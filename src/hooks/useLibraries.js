import { useCallback, useEffect, useState } from 'react';
import {
  fetchUserLibraries,
  fetchSelectableLibraries,
  fetchLibraryConferences,
  subscribeUserToLibraries,
  unsubscribeFromLibrary,
  markLibrarySeen,
} from '../services/libraryService';

/**
 * PLAN-030 S5/S7: /libraries 페이지 데이터 — 구독 목록·추가 가능 목록·동기화 알림.
 *
 * 동기화 알림(§4.3): 구독 라이브러리에 `last_seen_at` 이후 추가된(`added_at`) 학회를
 * 라이브러리 단위로 묶어 알림 카드로 노출. [확인] → `last_seen_at = now()` 로 dismiss.
 *
 * @param {string|undefined} userId 비로그인이면 undefined → 'loading' 고정.
 */
export function useLibraries(userId) {
  const [subscribed, setSubscribed] = useState([]);
  const [allSelectable, setAllSelectable] = useState([]);
  const [libConfs, setLibConfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!userId) return Promise.resolve();
    return Promise.all([
      fetchUserLibraries(userId),
      fetchSelectableLibraries(),
      fetchLibraryConferences(),
    ]).then(([subs, selectable, lc]) => {
      setSubscribed(subs);
      setAllSelectable(selectable);
      setLibConfs(lc);
      setError(null);
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    // userId 변경 시 즉시 로딩 표시 — useConferences 와 동일 패턴.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load()
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, load]);

  const subscribe = useCallback(async (libraryId) => {
    await subscribeUserToLibraries(userId, [libraryId]);
    await load();
  }, [userId, load]);

  const unsubscribe = useCallback(async (libraryId) => {
    await unsubscribeFromLibrary(userId, libraryId);
    await load();
  }, [userId, load]);

  const dismissAlert = useCallback(async (libraryId) => {
    await markLibrarySeen(userId, libraryId);
    await load();
  }, [userId, load]);

  // 파생: 아직 구독하지 않은 추가 가능 라이브러리
  const subscribedIds = new Set(subscribed.map((s) => s.id));
  const available = allSelectable.filter((l) => !subscribedIds.has(l.id));

  // 파생: 동기화 알림 — 구독 라이브러리별 last_seen_at 이후 추가된 학회 묶음.
  // 갓 구독한 라이브러리는 last_seen_at = 구독시각이라 기존 학회는 알림에 안 뜬다.
  const syncAlerts = subscribed
    .map((lib) => {
      const seen = lib.last_seen_at ? Date.parse(lib.last_seen_at) : 0;
      const newConferenceIds = libConfs
        .filter((lc) => lc.library_id === lib.id
          && lc.added_at && Date.parse(lc.added_at) > seen)
        .map((lc) => lc.conference_id);
      return { libraryId: lib.id, libraryName: lib.name, newConferenceIds };
    })
    .filter((a) => a.newConferenceIds.length > 0);

  return {
    loading, error,
    subscribed, available, syncAlerts,
    subscribe, unsubscribe, dismissAlert,
    refresh: load,
  };
}
