// PLAN-030 S4: 가입 후 라이브러리 선택 온보딩.
// 비가상 라이브러리를 다중 선택 → user_libraries 구독 INSERT.
import { useEffect, useState } from 'react';
import { fetchSelectableLibraries, subscribeUserToLibraries } from '../services/libraryService';

/**
 * @param {{userId:string, onComplete:()=>void}} props
 *   onComplete: 구독 INSERT 성공 시 호출 (useOnboarding.markDone).
 */
export default function OnboardingPage({ userId, onComplete }) {
  const [libraries, setLibraries] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchSelectableLibraries()
      .then((libs) => {
        if (cancelled) return;
        setLibraries(libs);
        // 마스터 라이브러리는 모든 사용자 공통 베이스 — 기본 선택.
        const master = libs.find((l) => l.id === 'lib_master');
        if (master) setSelected(new Set([master.id]));
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await subscribeUserToLibraries(userId, [...selected]);
      onComplete();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md w-full max-w-md p-6">
        <h1 className="text-xl font-bold text-slate-800">환영합니다 👋</h1>
        <p className="text-sm text-slate-600 mt-2">
          구독할 라이브러리를 선택하세요. 선택한 라이브러리의 학회들이 내 목록에 추가됩니다.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          라이브러리는 나중에 [라이브러리] 페이지에서 언제든 추가·해제할 수 있습니다.
        </p>

        <div className="mt-6 border-t border-slate-200 pt-6">
          {loading && (
            <p className="text-sm text-slate-400">라이브러리를 불러오는 중...</p>
          )}

          {!loading && libraries.length === 0 && (
            <p className="text-sm text-slate-500">
              선택 가능한 라이브러리가 없습니다. 관리자에게 문의하세요.
            </p>
          )}

          {!loading && libraries.length > 0 && (
            <ul className="space-y-2">
              {libraries.map((lib) => (
                <li key={lib.id}>
                  <label
                    className="flex items-start gap-3 border border-slate-200 rounded p-3 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(lib.id)}
                      onChange={() => toggle(lib.id)}
                      disabled={submitting}
                      className="mt-0.5 h-4 w-4 accent-blue-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">{lib.name}</span>
                      {lib.description && (
                        <span className="block text-xs text-slate-500 mt-0.5">{lib.description}</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loading || selected.size === 0}
            className="mt-6 w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300"
          >
            {submitting ? '설정 중...' : `시작하기 (${selected.size}개 선택)`}
          </button>
        </div>
      </div>
    </div>
  );
}
