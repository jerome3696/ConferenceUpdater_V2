// PLAN-033: 라이브러리 페이지 placeholder.
// 실제 구현은 PLAN-030 (libraries + 구독 + 옵트인 동기화).
export default function LibrariesPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">라이브러리</h1>
      <p className="text-sm text-slate-500 mb-6">
        본인이 구독한 라이브러리 목록과 옵트인 동기화 알림 (준비 중 — PLAN-030).
      </p>
      <div className="border border-dashed border-slate-300 rounded-lg p-8 text-center text-sm text-slate-500">
        준비 중입니다.
      </div>
    </div>
  );
}
