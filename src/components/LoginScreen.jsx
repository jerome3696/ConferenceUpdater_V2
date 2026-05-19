import { useState } from 'react';
import { supabase, supabaseConfigured } from '../services/supabaseClient';

// GitHub Pages 프로젝트 사이트는 BASE_URL(`/ConferenceUpdater_V2/`) 아래 서빙되므로
// OAuth·매직링크 리디렉션 경로에 BASE_URL 포함 필수.
const REDIRECT_TO = `${window.location.origin}${import.meta.env.BASE_URL}`;

// PLAN-037: 자율가입 차단(Supabase "Allow signups" OFF) 시 비초대 이메일은
// 가입이 막힌다. Supabase 가 돌려주는 에러를 사용자 친화 메시지로 치환.
function friendlyAuthError(message) {
  const m = (message || '').toLowerCase();
  if (m.includes('signup') && (m.includes('disabled') || m.includes('not allowed'))) {
    return '초대된 계정만 로그인할 수 있습니다. 관리자에게 초대를 요청하세요.';
  }
  return message || '로그인에 실패했습니다.';
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState('');

  const signInWithGoogle = async () => {
    setError('');
    if (!supabase) {
      setError('Supabase 가 설정되지 않았습니다 (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
      return;
    }
    // signInWithOAuth 는 구글 동의 화면으로 즉시 이동시킨다(아래 코드는 보통 도달 전).
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT_TO },
    });
    if (err) setError(friendlyAuthError(err.message));
  };

  const submitMagicLink = async (e) => {
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
      options: { emailRedirectTo: REDIRECT_TO },
    });
    if (err) {
      setStatus('idle');
      setError(friendlyAuthError(err.message));
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
            <>
              {/* PLAN-037: 구글 OAuth — 메인 로그인 수단 */}
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={!supabaseConfigured}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-slate-300 rounded hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Google로 로그인
              </button>

              <div className="flex items-center gap-3 my-4">
                <span className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">또는</span>
                <span className="flex-1 h-px bg-slate-200" />
              </div>

              {/* 매직링크 — 폴백 */}
              <form onSubmit={submitMagicLink} className="space-y-3">
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
                  이메일로 로그인 링크 받기
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
                <button
                  type="submit"
                  disabled={status === 'sending' || !supabaseConfigured}
                  className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300"
                >
                  {status === 'sending' ? '발송 중...' : '로그인 링크 받기'}
                </button>
              </form>
            </>
          )}

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          <p className="mt-4 text-xs text-slate-400">
            초대된 계정만 로그인할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
