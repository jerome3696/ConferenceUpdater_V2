import { useState } from 'react';
import { supabase, supabaseConfigured } from '../services/supabaseClient';

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!trimmed) {
      setError('이메일을 입력해주세요.');
      return;
    }
    if (!supabase) {
      setError('Supabase 가 설정되지 않았습니다 (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
      return;
    }
    setStatus('sending');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      // GitHub Pages 프로젝트 사이트는 BASE_URL(`/ConferenceUpdater_V2/`) 아래 서빙되므로 경로 포함 필수.
      options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
    });
    if (err) {
      setStatus('idle');
      setError(err.message || '메일 발송에 실패했습니다.');
      return;
    }
    setStatus('sent');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md w-full max-w-md p-6">
        <h1 className="text-xl font-bold text-slate-800">ConferenceFinder</h1>
        <p className="text-xs text-slate-500 mt-1">열유체·건물공조 학회 DB</p>
        <div className="mt-6 border-t border-slate-200 pt-6">
          {!supabaseConfigured && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              서버가 설정되지 않았습니다. 관리자에게 문의하세요.
            </div>
          )}
          {status === 'sent' ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                <span className="font-mono">{email.trim()}</span> 으로 로그인 링크를 발송했습니다.
              </p>
              <p className="text-xs text-slate-500">
                메일함의 링크를 클릭하면 자동으로 로그인됩니다. (스팸함도 확인해주세요)
              </p>
              <button
                type="button"
                onClick={() => { setStatus('idle'); setEmail(''); }}
                className="text-xs text-slate-500 underline hover:text-slate-700"
              >
                다른 이메일로 다시 시도
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
                이메일
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={status === 'sending' || !supabaseConfigured}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={status === 'sending' || !supabaseConfigured}
                className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300"
              >
                {status === 'sending' ? '발송 중...' : '로그인 링크 받기'}
              </button>
              <p className="text-xs text-slate-500">
                비밀번호 없이 이메일로 받은 링크 1회 클릭으로 로그인합니다.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
