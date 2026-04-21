// import-golden-xlsx.js 의 validateRow 단위 테스트.
// id 존재성 / 날짜 형식 / URL 스킴 검증이 올바르게 작동하는지.

import { describe, it, expect } from 'vitest';
import { validateRow } from './import-golden-xlsx.js';

const KNOWN = new Set(['conf_001', 'conf_002']);

describe('validateRow', () => {
  it('정상 행은 issues 0', () => {
    const row = {
      id: 'conf_001',
      full_name: 'Alpha',
      upcoming_start: '2027-01-23',
      upcoming_end: '2027-01-27',
      upcoming_link: 'https://a.example/',
      last_start: '2026-01-31',
      verified_at: '2026-04-20',
      source_url: 'https://src.example/',
    };
    expect(validateRow(row, KNOWN)).toEqual([]);
  });

  it('id 누락 감지', () => {
    const issues = validateRow({}, KNOWN);
    expect(issues.some((i) => i.includes('id'))).toBe(true);
  });

  it('모르는 id 감지', () => {
    const issues = validateRow({ id: 'conf_999' }, KNOWN);
    expect(issues.some((i) => i.includes('conf_999'))).toBe(true);
  });

  it('날짜 형식 오류 감지', () => {
    const issues = validateRow({ id: 'conf_001', upcoming_start: '2027/01/23' }, KNOWN);
    expect(issues.some((i) => i.includes('upcoming_start'))).toBe(true);
  });

  it('URL 스킴 오류 감지', () => {
    const issues = validateRow({ id: 'conf_001', upcoming_link: 'ftp://a.example/' }, KNOWN);
    expect(issues.some((i) => i.includes('upcoming_link'))).toBe(true);
  });

  it('빈 값은 통과', () => {
    const issues = validateRow({
      id: 'conf_001', upcoming_start: '', upcoming_link: '', verified_at: '',
    }, KNOWN);
    expect(issues).toEqual([]);
  });
});
