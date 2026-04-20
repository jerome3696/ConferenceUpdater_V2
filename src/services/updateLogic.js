// 전체 업데이트 시 pass/검색 판별 로직.
// blueprint.md §3.2.2 참조.
// PLAN-013-A: anchor 체크 추가. PLAN-013-B2 에서 전면 재설계 예정.

/**
 * 해당 학회를 AI 검색 대상으로 삼아야 하는지.
 * pass 조건(모두 만족 시 검색 안 함):
 *   1. upcoming.anchored === true  (사용자 확정 마크 — 회차 종료까지 보호)
 *   2. 또는 upcoming 존재 + 모든 필드 + source === 'ai_search'
 */
export function shouldSearch(row) {
  const u = row.upcoming;
  if (!u) return true;
  if (u.anchored) return false;
  if (!u.start_date || !u.end_date || !u.venue || !u.link) return true;
  if (u.source !== 'ai_search') return true;
  return false;
}

export function filterSearchTargets(rows) {
  return rows.filter(shouldSearch);
}
