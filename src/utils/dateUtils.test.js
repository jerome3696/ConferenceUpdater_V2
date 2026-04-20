import { describe, it, expect } from 'vitest';
import { formatDate, formatDateRange, todayIso, isExpired, daysUntil, cycleProgress } from './dateUtils.js';

describe('formatDate', () => {
  it('ISO 문자열을 그대로 반환', () => {
    expect(formatDate('2026-09-01')).toBe('2026-09-01');
  });

  it('빈 값은 빈 문자열', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('formatDateRange', () => {
  it('start만 있으면 start만 반환', () => {
    expect(formatDateRange('2026-09-01', null)).toBe('2026-09-01');
    expect(formatDateRange('2026-09-01', '')).toBe('2026-09-01');
  });

  it('start === end면 start만 반환 (당일 학회)', () => {
    expect(formatDateRange('2026-09-01', '2026-09-01')).toBe('2026-09-01');
  });

  it('서로 다르면 ~ 로 연결', () => {
    expect(formatDateRange('2026-09-01', '2026-09-04')).toBe('2026-09-01 ~ 2026-09-04');
  });

  it('start가 없으면 빈 문자열', () => {
    expect(formatDateRange('', '2026-09-04')).toBe('');
    expect(formatDateRange(null, '2026-09-04')).toBe('');
  });
});

describe('todayIso', () => {
  it('YYYY-MM-DD 형식이다', () => {
    const result = todayIso();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('월·일이 zero-pad 된다', () => {
    const result = todayIso();
    const [, m, d] = result.split('-');
    expect(m).toHaveLength(2);
    expect(d).toHaveLength(2);
  });
});

describe('isExpired', () => {
  it('end_date가 today보다 과거면 true', () => {
    expect(isExpired('2025-01-01', '2026-04-17')).toBe(true);
  });

  it('end_date가 today와 같으면 false (당일은 진행중)', () => {
    expect(isExpired('2026-04-17', '2026-04-17')).toBe(false);
  });

  it('end_date가 today보다 미래면 false', () => {
    expect(isExpired('2026-12-31', '2026-04-17')).toBe(false);
  });

  it('end_date가 비어있으면 false', () => {
    expect(isExpired('', '2026-04-17')).toBe(false);
    expect(isExpired(null, '2026-04-17')).toBe(false);
  });

  it('today 인자 생략 시 todayIso() 사용', () => {
    // 옛 날짜는 무조건 만료
    expect(isExpired('2000-01-01')).toBe(true);
  });
});

describe('daysUntil', () => {
  it('미래 날짜는 양수', () => {
    expect(daysUntil('2026-04-30', '2026-04-20')).toBe(10);
  });

  it('과거 날짜는 음수', () => {
    expect(daysUntil('2026-04-10', '2026-04-20')).toBe(-10);
  });

  it('같은 날은 0', () => {
    expect(daysUntil('2026-04-20', '2026-04-20')).toBe(0);
  });

  it('잘못된 입력은 null', () => {
    expect(daysUntil('', '2026-04-20')).toBeNull();
    expect(daysUntil('2026/04/30', '2026-04-20')).toBeNull();
    expect(daysUntil(null, '2026-04-20')).toBeNull();
  });

  it('2년 차이 (윤일 미포함) — 2026-02-28 → 2028-02-28 = 730일', () => {
    // 2028-02-29 는 범위 밖이므로 두 해 모두 365일씩.
    const days = daysUntil('2028-02-28', '2026-02-28');
    expect(days).toBe(730);
  });

  it('윤일 포함 — 2024-02-28 → 2024-03-01 = 2일 (2024 윤년)', () => {
    const days = daysUntil('2024-03-01', '2024-02-28');
    expect(days).toBe(2);
  });
});

describe('cycleProgress', () => {
  it('1년 주기, 마지막 개최 6개월 전 → ratio 약 0.5', () => {
    const r = cycleProgress(1, '2025-10-20', '2026-04-20');
    expect(r).not.toBeNull();
    expect(r.ratio).toBeGreaterThan(0.45);
    expect(r.ratio).toBeLessThan(0.55);
  });

  it('4년 주기, 마지막 개최 1년 전 → ratio 약 0.75', () => {
    const r = cycleProgress(4, '2025-04-20', '2026-04-20');
    expect(r.ratio).toBeGreaterThan(0.7);
    expect(r.ratio).toBeLessThan(0.8);
  });

  it('직전 회차 직후 → ratio 1.0 근처', () => {
    const r = cycleProgress(2, '2026-04-19', '2026-04-20');
    expect(r.ratio).toBeGreaterThan(0.99);
  });

  it('다음 회차 도래 후 (주기 초과) → ratio 0 으로 clamp', () => {
    const r = cycleProgress(1, '2024-01-01', '2026-04-20');
    expect(r.ratio).toBe(0);
    expect(r.daysToNext).toBeLessThan(0);
  });

  it('cycleYears ≤ 0 또는 lastStart 누락이면 null', () => {
    expect(cycleProgress(0, '2025-01-01', '2026-04-20')).toBeNull();
    expect(cycleProgress(-1, '2025-01-01', '2026-04-20')).toBeNull();
    expect(cycleProgress(2, '', '2026-04-20')).toBeNull();
    expect(cycleProgress(2, null, '2026-04-20')).toBeNull();
  });
});
