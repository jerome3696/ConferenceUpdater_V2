// PLAN-030 S5/S7: 라이브러리 페이지 — 구독 목록 + 추가/해제 + 옵트인 동기화 알림.
import { useState } from 'react';
import { useLibraries } from '../hooks/useLibraries';

/**
 * @param {{userId:string, conferences:object}} props
 *   conferences: useConferences 반환값 (동기화 알림에 학회명 표시용).
 */
export default function LibrariesPage({ userId, conferences }) {
  const lib = useLibraries(userId);
  const [actingId, setActingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // 학회 id → 표시명 (약칭 우선, 없으면 학회명).
  const nameById = new Map(
    (conferences?.rows ?? []).map((r) => [r.id, r.abbreviation || r.full_name || r.id])
  );

  // 비동기 동작 공통 래퍼 — 동작 중 버튼 비활성화 + 에러 표시.
  // reloadConferences=true: 구독 변경은 메인 테이블 게이팅에 영향 → 학회 데이터 재로드.
  const run = async (id, fn, reloadConferences = false) => {
    setActingId(id);
    setActionError(null);
    try {
      await fn();
      if (reloadConferences) conferences?.reload?.();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">라이브러리</h1>
      <p className="text-sm text-slate-500 mb-6">
        구독한 라이브러리의 학회가 내 목록에 표시됩니다. 언제든 추가·해제할 수 있습니다.
      </p>

      {lib.loading && <p className="text-sm text-slate-400">불러오는 중...</p>}
      {lib.error && (
        <p className="text-sm text-red-600 mb-4">라이브러리 로드 실패: {lib.error.message}</p>
      )}
      {actionError && <p className="text-sm text-red-600 mb-4">{actionError}</p>}

      {!lib.loading && (
        <>
          {/* 동기화 알림 (S7) — 라이브러리 단위 일괄 확인 */}
          {lib.syncAlerts.length > 0 && (
            <section className="mb-8 space-y-3">
              {lib.syncAlerts.map((alert) => (
                <div
                  key={alert.libraryId}
                  className="border border-blue-200 bg-blue-50 rounded-lg p-4"
                >
                  <p className="text-sm font-medium text-blue-800">📚 {alert.libraryName}</p>
                  <p className="text-sm text-blue-700 mt-1">
                    새 학회 {alert.newConferenceIds.length}개가 추가됐습니다.
                  </p>
                  <ul className="mt-2 text-xs text-blue-600 space-y-0.5">
                    {alert.newConferenceIds.slice(0, 3).map((id) => (
                      <li key={id}>· {nameById.get(id) || id}</li>
                    ))}
                    {alert.newConferenceIds.length > 3 && (
                      <li>· ... 외 {alert.newConferenceIds.length - 3}건</li>
                    )}
                  </ul>
                  <button
                    type="button"
                    onClick={() => run(alert.libraryId, () => lib.dismissAlert(alert.libraryId))}
                    disabled={actingId === alert.libraryId}
                    className="mt-3 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300"
                  >
                    {actingId === alert.libraryId ? '처리 중...' : '확인'}
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* 내 라이브러리 — 가입 시 자동 생성, 해제 불가 (PLAN-041) */}
          {lib.personalLibrary && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">내 라이브러리</h2>
              <div className="flex items-start justify-between gap-3 border border-slate-200 rounded p-3 bg-slate-50">
                <span>
                  <span className="block text-sm font-medium text-slate-800">
                    {lib.personalLibrary.name}
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    내가 발굴·추가한 학회가 모이는 공간입니다. 자동 생성되며 해제할 수 없습니다.
                  </span>
                </span>
                <span className="shrink-0 px-2 py-1 text-xs text-slate-400">🔒 기본</span>
              </div>
            </section>
          )}

          {/* 구독 중인 라이브러리 */}
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">
              구독 중 ({lib.subscribed.length})
            </h2>
            {lib.subscribed.length === 0 ? (
              <p className="text-sm text-slate-400">구독 중인 라이브러리가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {lib.subscribed.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-start justify-between gap-3 border border-slate-200 rounded p-3"
                  >
                    <span>
                      <span className="block text-sm font-medium text-slate-800">{l.name}</span>
                      {l.description && (
                        <span className="block text-xs text-slate-500 mt-0.5">{l.description}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => run(l.id, () => lib.unsubscribe(l.id), true)}
                      disabled={actingId === l.id}
                      className="shrink-0 px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded hover:bg-slate-50 disabled:opacity-50"
                    >
                      {actingId === l.id ? '...' : '해제'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 추가 가능한 라이브러리 */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-2">
              추가 가능 ({lib.available.length})
            </h2>
            {lib.available.length === 0 ? (
              <p className="text-sm text-slate-400">추가할 수 있는 라이브러리가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {lib.available.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-start justify-between gap-3 border border-slate-200 rounded p-3"
                  >
                    <span>
                      <span className="block text-sm font-medium text-slate-800">{l.name}</span>
                      {l.description && (
                        <span className="block text-xs text-slate-500 mt-0.5">{l.description}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => run(l.id, () => lib.subscribe(l.id), true)}
                      disabled={actingId === l.id}
                      className="shrink-0 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300"
                    >
                      {actingId === l.id ? '...' : '추가'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
