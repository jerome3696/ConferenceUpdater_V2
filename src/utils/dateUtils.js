export function formatDate(iso) {
  if (!iso) return '';
  return iso;
}

export function formatDateRange(start, end) {
  if (!start) return '';
  if (!end || start === end) return start;
  return `${start} ~ ${end}`;
}

export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isExpired(endDate, today = todayIso()) {
  if (!endDate) return false;
  return endDate < today;
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.25;

function parseIsoDate(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * iso 날짜까지 남은 일수 (음수면 이미 지난 날).
 * 잘못된 입력이면 null.
 */
export function daysUntil(iso, today = todayIso()) {
  const target = parseIsoDate(iso);
  const base = parseIsoDate(today);
  if (!target || !base) return null;
  return Math.round((target.getTime() - base.getTime()) / MS_PER_DAY);
}

/**
 * cycleYears 주기의 학회에서 마지막 개최일(lastStartIso) 이후 사이클 진행도.
 * ratio: 1.0 = 직전 회차 직후, 0.0 = 다음 회차 임박(또는 이미 지남).
 * cycleYears 가 0/음수이거나 lastStartIso 누락이면 null.
 */
export function cycleProgress(cycleYears, lastStartIso, today = todayIso()) {
  const cycle = Number(cycleYears);
  if (!Number.isFinite(cycle) || cycle <= 0) return null;
  const last = parseIsoDate(lastStartIso);
  const base = parseIsoDate(today);
  if (!last || !base) return null;
  const totalDays = cycle * DAYS_PER_YEAR;
  const elapsed = (base.getTime() - last.getTime()) / MS_PER_DAY;
  const daysToNext = Math.round(totalDays - elapsed);
  const ratio = Math.max(0, Math.min(1, daysToNext / totalDays));
  return { daysToNext, ratio };
}
