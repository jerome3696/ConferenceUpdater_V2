// PLAN-033: 설정 페이지 placeholder.
// 실제 구현: PLAN-034 (ICS 토큰), PLAN-037 (비밀번호·OAuth 관리).
export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">설정</h1>
      <p className="text-sm text-slate-500 mb-6">
        캘린더 구독 URL, 비밀번호, OAuth 연동 (준비 중).
      </p>
      <div className="border border-dashed border-slate-300 rounded-lg p-8 text-center text-sm text-slate-500">
        준비 중입니다.
      </div>
    </div>
  );
}
