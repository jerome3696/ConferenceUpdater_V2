// 전체 업데이트 시 pass/검색 판별 로직.
// blueprint.md §3.2.2 참조.

/**
 * 해당 학회를 AI 검색 대상으로 삼아야 하는지.
 * pass 조건(모두 만족 시 검색 안 함):
 *   1. upcoming edition 존재
 *   2. start_date, end_date, venue, link 모두 채워짐
 *   3. source === 'ai_search' (user_input이면 링크 보완 위해 검색)
 */
export function shouldSearch(row) {
  const u = row.upcoming;
  if (!u) return true;
  if (!u.start_date || !u.end_date || !u.venue || !u.link) return true;
  if (u.source !== 'ai_search') return true;
  return false;
}

export function filterSearchTargets(rows) {
  return rows.filter(shouldSearch);
}
