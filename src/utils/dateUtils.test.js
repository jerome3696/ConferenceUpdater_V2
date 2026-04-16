import { describe, it, expect } from 'vitest';
import { formatDate, formatDateRange, todayIso, isExpired } from './dateUtils.js';

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
