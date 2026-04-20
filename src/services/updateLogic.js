// 전체 업데이트 시 pass/검색 판별 로직.
// blueprint.md §3.2.2 + PLAN-013-B 참조.

import { daysUntil } from '../utils/dateUtils';
import { classifyUrlTrust } from '../utils/urlClassifier';

const DAYS_PER_YEAR = 365.25;

/**
 * 해당 학회를 AI 검색 대상으로 삼아야 하는지.
 *
 * 우선순위:
 *   1. upcoming.anchored === true → 절대 pass (정밀 모드에서도 보호)
 *   2. upcoming 없거나 필수 필드(start/end/venue/link) 미비 → 검색
 *   3. mode === 'precise' → 위 1·2 예외 밖이면 무조건 검색
 *   4. URL 신뢰도 + 다음 회차까지 남은 일수로 차등:
 *      - 1년 이내: high(official_edition/series) 만 pass
 *      - cycle/2 이내: low(news/listing) 만 재검색
 *      - 충분히 멂: 모두 pass
 *
 * @param {object} row
 * @param {'general' | 'precise'} [mode='general']
 */
export function shouldSearch(row, mode = 'general') {
  const u = row?.upcoming;

  if (u?.anchored) return false;

  if (!u) return true;
  if (!u.start_date || !u.end_date || !u.venue || !u.link) return true;

  if (mode === 'precise') return true;

  const { trust } = classifyUrlTrust(u.link, row);
  const days = daysUntil(u.start_date);

  // 날짜 파싱 실패 = 데이터 신뢰 불가 → 검색
  if (days == null) return true;

  if (days < 365) return trust !== 'high';

  const cycle = Number(row?.cycle_years);
  if (Number.isFinite(cycle) && cycle > 0) {
    const halfCycleDays = (cycle * DAYS_PER_YEAR) / 2;
    if (days < halfCycleDays) return trust === 'low';
  }

  return false;
}

export function filterSearchTargets(rows, mode = 'general') {
  return rows.filter((r) => shouldSearch(r, mode));
}
