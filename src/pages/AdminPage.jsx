// PLAN-033: admin 대시보드 placeholder. RouteGuard adminOnly 가 비admin 차단.
// 실제 구현은 PLAN-035 (위젯·초대코드·라이브러리 큐레이팅).
export default function AdminPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">관리자</h1>
      <p className="text-sm text-slate-500 mb-6">
        사용량·비용·초대코드·라이브러리 큐레이팅 (준비 중 — PLAN-035).
      </p>
      <div className="border border-dashed border-slate-300 rounded-lg p-8 text-center text-sm text-slate-500">
        준비 중입니다.
      </div>
    </div>
  );
}
