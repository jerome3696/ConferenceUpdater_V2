import { describe, it, expect } from 'vitest';
import { shouldSearch, filterSearchTargets } from './updateLogic.js';

const fullUpcoming = {
  start_date: '2026-09-01',
  end_date: '2026-09-04',
  venue: 'Seoul',
  link: 'https://example.org',
  source: 'ai_search',
};

describe('shouldSearch', () => {
  it('upcoming이 없으면 검색', () => {
    expect(shouldSearch({})).toBe(true);
    expect(shouldSearch({ upcoming: null })).toBe(true);
  });

  it('모든 필드가 채워지고 source=ai_search면 pass', () => {
    expect(shouldSearch({ upcoming: fullUpcoming })).toBe(false);
  });

  it('start_date 누락 시 검색', () => {
    expect(shouldSearch({ upcoming: { ...fullUpcoming, start_date: '' } })).toBe(true);
  });

  it('end_date 누락 시 검색', () => {
    expect(shouldSearch({ upcoming: { ...fullUpcoming, end_date: null } })).toBe(true);
  });

  it('venue 누락 시 검색', () => {
    expect(shouldSearch({ upcoming: { ...fullUpcoming, venue: '' } })).toBe(true);
  });

  it('link 누락 시 검색', () => {
    expect(shouldSearch({ upcoming: { ...fullUpcoming, link: undefined } })).toBe(true);
  });

  it('source가 user_input이면 검색 (링크 보완용)', () => {
    expect(shouldSearch({ upcoming: { ...fullUpcoming, source: 'user_input' } })).toBe(true);
  });

  it('source가 비어있으면 검색', () => {
    expect(shouldSearch({ upcoming: { ...fullUpcoming, source: '' } })).toBe(true);
  });
});

describe('filterSearchTargets', () => {
  it('검색 대상만 추려낸다', () => {
    const rows = [
      { id: 1, upcoming: fullUpcoming },                                    // pass
      { id: 2 },                                                            // 검색
      { id: 3, upcoming: { ...fullUpcoming, source: 'user_input' } },       // 검색
      { id: 4, upcoming: { ...fullUpcoming, venue: '' } },                  // 검색
    ];
    const result = filterSearchTargets(rows);
    expect(result.map(r => r.id)).toEqual([2, 3, 4]);
  });

  it('빈 배열은 빈 배열', () => {
    expect(filterSearchTargets([])).toEqual([]);
  });

  it('전부 pass면 빈 배열', () => {
    const rows = [{ upcoming: fullUpcoming }, { upcoming: fullUpcoming }];
    expect(filterSearchTargets(rows)).toEqual([]);
  });
});
