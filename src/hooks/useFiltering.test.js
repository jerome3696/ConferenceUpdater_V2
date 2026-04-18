import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFiltering } from './useFiltering';

const ROWS = [
  { id: 1, full_name: 'Thermal Conf', abbreviation: 'TEC', category: 'heat', field: 'HT', region: 'Asia', starred: 1 },
  { id: 2, full_name: 'Fluid Dynamics', abbreviation: 'FD', category: 'fluid', field: 'FM', region: 'EU', starred: 0 },
  { id: 3, full_name: 'HVAC Intl', abbreviation: 'HVAC', category: 'heat', field: 'HT', region: 'NA', starred: 1 },
];

describe('useFiltering', () => {
  it('초기 상태: 모든 행 pass + 빈 필터', () => {
    const { result } = renderHook(() => useFiltering(ROWS));
    expect(result.current.filtered).toHaveLength(3);
    expect(result.current.filters).toEqual({ category: '', field: '', region: '', query: '', starredOnly: false });
  });

  it('options: category/field/region 유니크 + 정렬', () => {
    const { result } = renderHook(() => useFiltering(ROWS));
    expect(result.current.options.categories).toEqual(['fluid', 'heat']);
    expect(result.current.options.fields).toEqual(['FM', 'HT']);
    expect(result.current.options.regions).toEqual(['Asia', 'EU', 'NA']);
  });

  it('category 필터', () => {
    const { result } = renderHook(() => useFiltering(ROWS));
    act(() => result.current.setFilters({ category: 'heat', field: '', region: '', query: '' }));
    expect(result.current.filtered.map((r) => r.id)).toEqual([1, 3]);
  });

  it('query: full_name + abbreviation 양쪽 대상, 대소문자 무시', () => {
    const { result } = renderHook(() => useFiltering(ROWS));
    act(() => result.current.setFilters({ category: '', field: '', region: '', query: 'TEC' }));
    expect(result.current.filtered.map((r) => r.id)).toEqual([1]);

    act(() => result.current.setFilters({ category: '', field: '', region: '', query: 'thermal' }));
    expect(result.current.filtered.map((r) => r.id)).toEqual([1]);
  });

  it('복합 필터: category AND region', () => {
    const { result } = renderHook(() => useFiltering(ROWS));
    act(() => result.current.setFilters({ category: 'heat', field: '', region: 'Asia', query: '' }));
    expect(result.current.filtered.map((r) => r.id)).toEqual([1]);
  });

  it('null/undefined 필드 값은 options 에서 제외', () => {
    const rowsWithGaps = [
      ...ROWS,
      { id: 4, full_name: 'Edge', abbreviation: 'E', category: null, field: undefined, region: '', starred: 0 },
    ];
    const { result } = renderHook(() => useFiltering(rowsWithGaps));
    expect(result.current.options.categories).toEqual(['fluid', 'heat']);
    expect(result.current.options.regions).toEqual(['Asia', 'EU', 'NA']);
  });

  it('starredOnly: starred>=1 만 통과', () => {
    const { result } = renderHook(() => useFiltering(ROWS));
    act(() => result.current.setFilters({ starredOnly: true }));
    expect(result.current.filtered.map((r) => r.id)).toEqual([1, 3]);
  });

  it('starredOnly 는 부분 머지로 설정되어 기존 필터를 보존', () => {
    const { result } = renderHook(() => useFiltering(ROWS));
    act(() => result.current.setFilters({ category: 'heat', field: '', region: '', query: '' }));
    act(() => result.current.setFilters({ starredOnly: true }));
    expect(result.current.filters).toEqual({
      category: 'heat', field: '', region: '', query: '', starredOnly: true,
    });
    expect(result.current.filtered.map((r) => r.id)).toEqual([1, 3]);
  });

  it('FilterBar 부분 업데이트: {category,field,region,query} 전달 시 starredOnly 유지', () => {
    const { result } = renderHook(() => useFiltering(ROWS));
    act(() => result.current.setFilters({ starredOnly: true }));
    // FilterBar가 기존 4-key만 보내도 starredOnly 가 지워지지 않아야 함
    act(() => result.current.setFilters({ category: 'fluid', field: '', region: '', query: '' }));
    expect(result.current.filters.starredOnly).toBe(true);
    // starredOnly=true + category=fluid: FD는 starred=0 이므로 탈락, 결과 없음
    expect(result.current.filtered).toEqual([]);
  });
});
