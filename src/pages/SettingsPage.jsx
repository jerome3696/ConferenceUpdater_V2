// PLAN-034: ICS 캘린더 구독 URL 발급/재발급/복사 UI.
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const EDGE_BASE = import.meta.env.VITE_SUPABASE_URL
  ? import.meta.env.VITE_SUPABASE_URL.replace(/^(https?:\/\/[^/]+).*$/, '$1') + '/functions/v1'
  : '';

function buildFeedUrl(token) {
  return `${EDGE_BASE}/calendar-feed?token=${token}`;
}

export default function SettingsPage() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadToken() {
      setLoading(true);
      setError(null);
      try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;
        if (!userId) { setLoading(false); return; }

        const { data, error: dbErr } = await supabase
          .from('users')
          .select('calendar_token')
          .eq('id', userId)
          .maybeSingle();

        if (!cancelled) {
          if (dbErr) setError(dbErr.message);
          else setToken(data?.calendar_token ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadToken();
    return () => { cancelled = true; };
  }, []);

  async function handleGenerate(isRegen) {
    if (isRegen && !window.confirm('재발급하면 기존 URL로는 구독할 수 없게 됩니다. 계속할까요?')) return;
    setGenerating(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('로그인이 필요합니다.');

      const { data, error: rpcErr } = await supabase.rpc('regenerate_calendar_token', {
        p_user_id: userId,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      setToken(data);
      setCopied(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(buildFeedUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('클립보드 복사에 실패했습니다.');
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">설정</h1>
      <p className="text-sm text-slate-500 mb-6">
        캘린더 구독 URL, 비밀번호, OAuth 연동 (준비 중).
      </p>

      <section className="border border-slate-200 rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1">캘린더 구독 URL</h2>
        <p className="text-xs text-slate-500 mb-4">
          이 URL을 Apple 캘린더·Google 캘린더·Outlook 등에 추가하면 즐겨찾기 학회 일정이 자동 동기화됩니다.
        </p>

        {loading && (
          <p className="text-sm text-slate-400">불러오는 중...</p>
        )}

        {!loading && !token && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">캘린더 구독 URL이 없습니다.</p>
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating}
              className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? '발급 중...' : '발급'}
            </button>
          </div>
        )}

        {!loading && token && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={buildFeedUrl(token)}
                className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-700 select-all"
              />
              <button
                onClick={handleCopy}
                className="shrink-0 px-3 py-2 text-xs font-medium rounded border border-slate-300 bg-white hover:bg-slate-50"
              >
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
            <button
              onClick={() => handleGenerate(true)}
              disabled={generating}
              className="text-xs text-slate-400 hover:text-red-500 underline disabled:opacity-50"
            >
              {generating ? '재발급 중...' : '재발급 (기존 URL 무효화)'}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-500">{error}</p>
        )}
      </section>

      <div className="border border-dashed border-slate-300 rounded-lg p-8 text-center text-sm text-slate-500">
        비밀번호·OAuth 설정은 준비 중입니다 (PLAN-037).
      </div>
    </div>
  );
}
