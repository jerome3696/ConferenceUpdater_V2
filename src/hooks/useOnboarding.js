import { useCallback, useEffect, useState } from 'react';
import { fetchUserLibraryIds } from '../services/libraryService';

/**
 * PLAN-030 S4: 가입 후 라이브러리 선택 온보딩 게이팅.
 *
 * `user_libraries` 구독이 0건이면 온보딩 필요('needed'). 온보딩은 ≥1 라이브러리
 * 구독을 강제하므로 "구독 ≥1 = 온보딩 완료('done')" 로 파생한다 — 별도 컬럼 불요.
 *
 * @param {string|undefined} userId 비로그인이면 undefined → 'loading' 고정 (effect noop).
 * @returns {{status:'loading'|'needed'|'done', error:Error|null, markDone:()=>void}}
 */
export function useOnboarding(userId) {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    fetchUserLibraryIds(userId)
      .then((ids) => {
        if (!cancelled) setStatus(ids.length > 0 ? 'done' : 'needed');
      })
      .catch((e) => {
        if (cancelled) return;
        // 조회 실패 시 앱을 막지 않는다 — 온보딩 통과시켜 메인으로 보낸다.
        setError(e);
        setStatus('done');
      });
    return () => { cancelled = true; };
  }, [userId]);

  const markDone = useCallback(() => setStatus('done'), []);

  return { status, error, markDone };
}
