import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSorting } from './useSorting';

const getValue = (r, k) => r[k];

const ROWS = [
  { id: 1, full_name: 'B Conf', start: '2026-05-01' },
  { id: 2, full_name: 'A Conf', start: '2026-03-01' },
  { id: 3, full_name: 'C Conf', start: '' },       // empty-last
  { id: 4, full_name: 'D Conf', start: null },     // empty-last
];

describe('useSorting', () => {
  it('초기 정렬: asc + empty-last + empty tie 시 full_name', () => {
    const { result } = renderHook(() => useSorting(ROWS, getValue, 'start'));
    const ids = result.current.sorted.map((r) => r.id);
    // 2(03-01) < 1(05-01) < 3(empty, C) < 4(empty, D)
    expect(ids).toEqual([2, 1, 3, 4]);
    expect(result.current.sortKey).toBe('start');
    expect(result.current.sortDir).toBe('asc');
  });

  it('onSort 같은 키: asc → desc 토글 (빈값은 여전히 마지막)', () => {
    const { result } = renderHook(() => useSorting(ROWS, getValue, 'start'));
    act(() => result.current.onSort('start'));
    expect(result.current.sortDir).toBe('desc');
    const ids = result.current.sorted.map((r) => r.id);
    // 1(05-01) > 2(03-01) 먼저, empty 는 여전히 뒤
    expect(ids.slice(0, 2)).toEqual([1, 2]);
    expect(ids.slice(2).sort()).toEqual([3, 4]);
  });

  it('onSort 다른 키: asc 리셋', () => {
    const { result } = renderHook(() => useSorting(ROWS, getValue, 'start'));
    act(() => result.current.onSort('start')); // desc
    act(() => result.current.onSort('full_name'));
    expect(result.current.sortKey).toBe('full_name');
    expect(result.current.sortDir).toBe('asc');
    const names = result.current.sorted.map((r) => r.full_name);
    expect(names).toEqual(['A Conf', 'B Conf', 'C Conf', 'D Conf']);
  });

  it('숫자 비교: 문자열 아니라 수치로', () => {
    const numRows = [{ id: 1, n: 10 }, { id: 2, n: 2 }, { id: 3, n: 100 }];
    const { result } = renderHook(() => useSorting(numRows, (r, k) => r[k], 'n'));
    expect(result.current.sorted.map((r) => r.n)).toEqual([2, 10, 100]);
  });
});
