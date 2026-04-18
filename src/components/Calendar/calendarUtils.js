import {
  parseISO,
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
  getDay,
  max,
  min,
  differenceInCalendarDays,
  isValid,
  addMonths,
  addYears,
  format,
} from 'date-fns';

const MONTH_LABELS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

export function monthLabelsKo() {
  return MONTH_LABELS_KO;
}

function parseEditionDates(row) {
  const u = row.upcoming;
  if (!u || !u.start_date) return null;
  const start = parseISO(u.start_date);
  if (!isValid(start)) return null;
  const end = u.end_date ? parseISO(u.end_date) : start;
  return { start, end: isValid(end) ? end : start };
}

// 주어진 연도에 걸치는 학회들을 (시작·종료가 연 경계로 자른 오프셋과 함께) 반환.
// 오프셋은 해당 연도 1월 1일 기준 일수(0-base).
export function conferencesInYear(rows, year) {
  const yStart = startOfYear(new Date(year, 0, 1));
  const yEnd = endOfYear(yStart);
  const items = [];
  for (const row of rows) {
    const dates = parseEditionDates(row);
    if (!dates) continue;
    if (dates.end < yStart || dates.start > yEnd) continue;
    const clippedStart = max([dates.start, yStart]);
    const clippedEnd = min([dates.end, yEnd]);
    const startOffset = differenceInCalendarDays(clippedStart, yStart); // 0..364/365
    const endOffset = differenceInCalendarDays(clippedEnd, yStart);
    items.push({ row, start: dates.start, end: dates.end, startOffset, endOffset });
  }
  // 시작일 오름차순, 동률이면 학회명
  items.sort((a, b) => {
    if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset;
    return (a.row.full_name || '').localeCompare(b.row.full_name || '');
  });
  return items;
}

// 주어진 (year, monthIndex 0~11)에 열리는 학회를 일자→[row]로 매핑.
// 여러 날 걸친 학회는 해당되는 모든 날짜에 등장.
export function conferencesByDayInMonth(rows, year, monthIndex) {
  const mStart = startOfMonth(new Date(year, monthIndex, 1));
  const mEnd = endOfMonth(mStart);
  const map = new Map();
  for (const row of rows) {
    const dates = parseEditionDates(row);
    if (!dates) continue;
    if (dates.end < mStart || dates.start > mEnd) continue;
    const clippedStart = max([dates.start, mStart]);
    const clippedEnd = min([dates.end, mEnd]);
    const startDay = clippedStart.getDate();
    const endDay = clippedEnd.getDate();
    for (let d = startDay; d <= endDay; d += 1) {
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(row);
    }
  }
  return map;
}

// 월 달력 그리드용 셀 배열 생성. 월 시작 이전·이후의 빈칸은 null.
// 결과는 7의 배수 길이(5주 또는 6주).
export function monthGridCells(year, monthIndex) {
  const mStart = startOfMonth(new Date(year, monthIndex, 1));
  const daysIn = getDaysInMonth(mStart);
  const leading = getDay(mStart); // 0=일 ~ 6=토
  const cells = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let d = 1; d <= daysIn; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function shiftYear(year, delta) {
  const d = addYears(new Date(year, 0, 1), delta);
  return d.getFullYear();
}

export function shiftMonth(year, monthIndex, delta) {
  const d = addMonths(new Date(year, monthIndex, 1), delta);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

export function formatIsoShort(date) {
  return format(date, 'yyyy-MM-dd');
}

// 해당 연도의 총 일수(윤년 처리)
export function daysInYear(year) {
  return differenceInCalendarDays(endOfYear(new Date(year, 0, 1)), startOfYear(new Date(year, 0, 1))) + 1;
}
