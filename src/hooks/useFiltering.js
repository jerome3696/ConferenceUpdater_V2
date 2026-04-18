import { useMemo, useState } from 'react';

const INITIAL_FILTERS = { category: '', field: '', region: '', query: '' };

export function useFiltering(rows) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);

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
      if (q) {
        const hay = `${r.full_name || ''} ${r.abbreviation || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  return { filters, setFilters, filtered, options };
}
