import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';

function nextResetDateLabel() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

const ENDPOINT_LABEL = {
  update: '업데이트',
  verify: '검증',
  discovery_expand: '발굴(확장)',
  discovery_search: '발굴(검색)',
};

function QuotaExhaustedModal({ kind = 'update', userId, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!supabase || !userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return undefined;
    }
    const allowed = kind === 'update' ? ['update', 'verify'] : ['discovery_expand', 'discovery_search'];
    supabase
      .from('api_usage_log')
      .select('id, ts, endpoint, status, cost_usd')
      .eq('user_id', userId)
      .in('endpoint', allowed)
      .order('ts', { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error) setLogs(data || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [kind, userId]);

  const title = kind === 'update' ? '업데이트/검증 쿼터 소진' : '발굴 쿼터 소진';
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-sm text-slate-600 mb-4">
          이번 달 한도를 모두 사용했습니다. 다음 리셋: <span className="font-mono">{nextResetDateLabel()}</span>
        </p>
        <div className="border-t border-slate-200 pt-3">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">최근 호출 5건</h3>
          {loading ? (
            <p className="text-xs text-slate-500">불러오는 중...</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-slate-500">기록이 없습니다.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {logs.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="truncate">
                    {ENDPOINT_LABEL[row.endpoint] || row.endpoint}
                    <span className="ml-2 text-slate-400">({row.status})</span>
                  </span>
                  <span className="font-mono text-slate-500">{new Date(row.ts).toLocaleString('ko-KR')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-slate-700 text-white rounded hover:bg-slate-800"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuotaExhaustedModal;
