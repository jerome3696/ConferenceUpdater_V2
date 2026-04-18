import { describe, it, expect } from 'vitest';
import {
  conferencesInYear,
  conferencesByDayInMonth,
  monthGridCells,
  shiftYear,
  shiftMonth,
  daysInYear,
} from './calendarUtils';

const ROWS = [
  {
    id: 'a',
    full_name: 'A Conf',
    abbreviation: 'A',
    starred: 1,
    upcoming: { start_date: '2026-03-05', end_date: '2026-03-08' },
  },
  {
    id: 'b',
    full_name: 'B Conf',
    abbreviation: 'B',
    starred: 0,
    upcoming: { start_date: '2026-12-28', end_date: '2027-01-02' }, // 연 경계 걸침
  },
  {
    id: 'c',
    full_name: 'C Conf',
    abbreviation: 'C',
    starred: 1,
    upcoming: null, // 에디션 없음
  },
  {
    id: 'd',
    full_name: 'D Conf',
    abbreviation: 'D',
    starred: 1,
    upcoming: { start_date: '2025-06-10', end_date: '2025-06-12' }, // 2026 범위 밖
  },
];

describe('conferencesInYear', () => {
  it('upcoming 없는 학회는 제외', () => {
    const items = conferencesInYear(ROWS, 2026);
    expect(items.map((i) => i.row.id)).not.toContain('c');
  });

  it('연도 범위 밖 학회는 제외', () => {
    const items = conferencesInYear(ROWS, 2026);
    expect(items.map((i) => i.row.id)).not.toContain('d');
  });

  it('연도 경계 걸친 학회: 시작은 해당 연도 내로 클립', () => {
    const items = conferencesInYear(ROWS, 2026);
    const b = items.find((i) => i.row.id === 'b');
    expect(b).toBeTruthy();
    // 12-28 ~ 12-31 로 클립 → startOffset 크고 endOffset = 364
    expect(b.endOffset).toBe(364);
  });

  it('시작일 오름차순 정렬', () => {
    const items = conferencesInYear(ROWS, 2026);
    expect(items.map((i) => i.row.id)).toEqual(['a', 'b']);
  });

  it('end_date 없으면 start_date 하루로 간주', () => {
    const rows = [{ id: 'x', full_name: 'X', starred: 0, upcoming: { start_date: '2026-07-15' } }];
    const items = conferencesInYear(rows, 2026);
    expect(items).toHaveLength(1);
    expect(items[0].startOffset).toBe(items[0].endOffset);
  });
});

describe('conferencesByDayInMonth', () => {
  it('기간 걸친 모든 날짜에 등장', () => {
    const map = conferencesByDayInMonth(ROWS, 2026, 2); // 3월
    expect(map.get(5).map((r) => r.id)).toContain('a');
    expect(map.get(6).map((r) => r.id)).toContain('a');
    expect(map.get(8).map((r) => r.id)).toContain('a');
    expect(map.get(9)).toBeUndefined();
  });

  it('월 경계 걸친 학회: 해당 월 범위만 포함', () => {
    const dec = conferencesByDayInMonth(ROWS, 2026, 11); // 12월
    expect(dec.get(28).map((r) => r.id)).toContain('b');
    expect(dec.get(31).map((r) => r.id)).toContain('b');
    const jan = conferencesByDayInMonth(ROWS, 2027, 0); // 1월
    expect(jan.get(1).map((r) => r.id)).toContain('b');
    expect(jan.get(2).map((r) => r.id)).toContain('b');
    expect(jan.get(3)).toBeUndefined();
  });

  it('해당 월에 학회 없으면 빈 맵', () => {
    const map = conferencesByDayInMonth(ROWS, 2026, 0); // 1월
    expect(map.size).toBe(0);
  });
});

describe('monthGridCells', () => {
  it('2026년 3월(일요일 시작 아님): leading null + 1..31 + trailing null', () => {
    const cells = monthGridCells(2026, 2);
    // 2026-03-01은 일요일 → leading 0
    expect(cells[0]).toBe(1);
    expect(cells.filter((c) => c !== null)).toHaveLength(31);
    expect(cells.length % 7).toBe(0);
  });

  it('2026년 2월(일요일=01 이전?): 2026-02-01은 일요일이므로 leading=0', () => {
    const cells = monthGridCells(2026, 1);
    expect(cells[0]).toBe(1);
    expect(cells.filter((c) => c !== null)).toHaveLength(28);
  });

  it('2026년 4월: 2026-04-01은 수요일 → leading 3개', () => {
    const cells = monthGridCells(2026, 3);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBeNull();
    expect(cells[2]).toBeNull();
    expect(cells[3]).toBe(1);
  });
});

describe('shiftYear/shiftMonth', () => {
  it('shiftYear', () => {
    expect(shiftYear(2026, 1)).toBe(2027);
    expect(shiftYear(2026, -3)).toBe(2023);
  });
  it('shiftMonth 연 경계', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 });
  });
});

describe('daysInYear', () => {
  it('평년 365', () => {
    expect(daysInYear(2026)).toBe(365);
  });
  it('윤년 366', () => {
    expect(daysInYear(2028)).toBe(366);
  });
});
