import { useMemo, useState } from 'react';

const INITIAL_FILTERS = { category: '', field: '', region: '', query: '', starredOnly: false };

export function useFiltering(rows) {
  const [filters, _setFilters] = useState(INITIAL_FILTERS);
  // FilterBar(onChange)는 {category, field, region, query}만 넘겨주는 기존 계약이라 부분 머지로 받는다.
  // starredOnly가 상태에 섞여도 FilterBar 변경이 그 값을 지우지 않도록.
  const setFilters = (patch) => _setFilters((prev) => ({ ...prev, ...patch }));

  const options = useMemo(() => {
    const uniq = (key) => [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort();
    return {
      categories: uniq('category'),
      fields: uniq('field'),
      regions: uniq('region'),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.category && r.category !== filters.category) return false;
      if (filters.field && r.field !== filters.field) return false;
      if (filters.region && r.region !== filters.region) return false;
      if (filters.starredOnly && !r.starred) return false;
      if (q) {
        const hay = `${r.full_name || ''} ${r.abbreviation || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  return { filters, setFilters, filtered, options };
}
