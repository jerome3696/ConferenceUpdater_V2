import { useMemo, useState } from 'react';
import FilterBar from './FilterBar';
import ConferenceFormModal from './ConferenceFormModal';
import StarRating from '../common/StarRating';
import { exportAsJson, exportAsXlsx } from '../../services/exportService';

// 그룹별 컬럼 정의 (이중 헤더용)
const GROUPS = [
  {
    label: '학회 마스터',
    className: 'bg-slate-200',
    columns: [
      { key: 'starred', label: '★' },
      { key: 'category', label: '분류' },
      { key: 'field', label: '분야' },
      { key: 'abbreviation', label: '약칭' },
      { key: 'full_name', label: '학회명' },
      { key: 'cycle_years', label: '주기' },
      { key: 'duration_days', label: '기간(일)' },
      { key: 'region', label: '지역' },
      { key: 'official_url', label: '링크' },
    ],
  },
  {
    label: 'Upcoming',
    className: 'bg-blue-100',
    columns: [
      { key: 'upcoming_start', label: '시작일' },
      { key: 'upcoming_end', label: '종료일' },
      { key: 'upcoming_venue', label: '장소' },
      { key: 'upcoming_link', label: '링크' },
      { key: 'upcoming_source', label: '출처' },
    ],
  },
  {
    label: 'Last',
    className: 'bg-slate-100',
    columns: [
      { key: 'last_start', label: '시작일' },
      { key: 'last_end', label: '종료일' },
      { key: 'last_venue', label: '장소' },
      { key: 'last_link', label: '링크' },
    ],
  },
  {
    label: '참고',
    className: 'bg-amber-50',
    columns: [{ key: 'note', label: '메모' }],
  },
];

const ACTION_GROUP = {
  label: '작업',
  className: 'bg-slate-50',
  columns: [{ key: 'actions', label: '작업' }],
};

function getSortValue(row, key) {
  switch (key) {
    case 'upcoming_start': return row.upcoming?.start_date || '';
    case 'upcoming_end': return row.upcoming?.end_date || '';
    case 'upcoming_venue': return row.upcoming?.venue || '';
    case 'upcoming_link': return row.upcoming?.link || '';
    case 'upcoming_source': return row.upcoming?.source || '';
    case 'last_start': return row.last?.start_date || '';
    case 'last_end': return row.last?.end_date || '';
    case 'last_venue': return row.last?.venue || '';
    case 'last_link': return row.last?.link || '';
    default: return row[key] ?? '';
  }
}

function LinkCell({ href }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
      열기
    </a>
  );
}

export default function MainTable({ isAdmin = false, conferences, onRequestUpdate, onRequestUpdateAll, onRequestVerify, onRequestVerifyAll }) {
  const { rows, loading, error, data, addConference, updateStarred, saveConferenceEdit, deleteConference } = conferences;
  const [sortKey, setSortKey] = useState('upcoming_start');
  const [sortDir, setSortDir] = useState('asc');
  const [filters, setFilters] = useState({ category: '', field: '', region: '', query: '' });
  const [modalMode, setModalMode] = useState(null); // 'add' | 'edit' | null
  const [editingRow, setEditingRow] = useState(null);

  const { categories, fields, regions } = useMemo(() => {
    const uniq = (key) => [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort();
    return { categories: uniq('category'), fields: uniq('field'), regions: uniq('region') };
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

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      const aEmpty = av === '' || av == null;
      const bEmpty = bv === '' || bv == null;
      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;
      if (aEmpty && bEmpty) return a.full_name.localeCompare(b.full_name);
      let cmp;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const onSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  if (loading) return <div className="p-8 text-slate-500">로딩 중...</div>;
  if (error) return <div className="p-8 text-red-600">오류: {error.message}</div>;

  const groups = isAdmin ? [...GROUPS, ACTION_GROUP] : GROUPS;

  const handleSubmit = (payload) => {
    if (modalMode === 'add') {
      addConference(payload.conference);
    } else if (modalMode === 'edit' && editingRow) {
      saveConferenceEdit(
        editingRow.id,
        payload,
        editingRow.upcoming?.id || null,
        editingRow.last?.id || null,
      );
    }
  };

  return (
    <>
    {isAdmin && (
      <div className="flex justify-end gap-2 mb-2">
        {onRequestUpdateAll && (
          <button
            onClick={() => onRequestUpdateAll(rows)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
          >
            전체 업데이트
          </button>
        )}
        {onRequestVerifyAll && (
          <button
            onClick={() => onRequestVerifyAll(rows)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
          >
            전체 검증
          </button>
        )}
        <button
          onClick={() => exportAsXlsx(sorted)}
          className="px-3 py-1.5 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 rounded"
        >
          엑셀 내보내기
        </button>
        <button
          onClick={() => exportAsJson(data)}
          className="px-3 py-1.5 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 rounded"
        >
          JSON 내보내기
        </button>
        <button
          onClick={() => { setEditingRow(null); setModalMode('add'); }}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
        >
          + 학회 추가
        </button>
      </div>
    )}
    <FilterBar
      categories={categories} fields={fields} regions={regions}
      category={filters.category} field={filters.field}
      region={filters.region} query={filters.query}
      onChange={setFilters}
      total={rows.length} filtered={sorted.length}
    />
    <div className="overflow-auto border border-slate-300 rounded bg-white max-h-[calc(100vh-220px)]">
      <table className="min-w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            {groups.map((g) => (
              <th
                key={g.label}
                colSpan={g.columns.length}
                className={`px-3 py-2 text-center font-bold text-slate-700 border border-slate-300 ${g.className}`}
              >
                {g.label}
              </th>
            ))}
          </tr>
          <tr>
            {groups.flatMap((g) =>
              g.columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => onSort(c.key)}
                  className={`px-3 py-2 text-left font-semibold text-slate-700 border border-slate-300 cursor-pointer select-none hover:bg-slate-200 whitespace-nowrap ${g.className}`}
                >
                  {c.label}
                  {sortKey === c.key && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50 border-b border-slate-200">
              {/* 마스터 */}
              <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                <StarRating
                  value={r.starred || 0}
                  readOnly={!isAdmin}
                  onChange={(v) => updateStarred(r.id, v)}
                />
              </td>
              <td className="px-3 py-2 border-r border-slate-200">{r.category}</td>
              <td className="px-3 py-2 border-r border-slate-200">{r.field}</td>
              <td className="px-3 py-2 font-mono border-r border-slate-200">{r.abbreviation}</td>
              <td className="px-3 py-2 border-r border-slate-200">{r.full_name}</td>
              <td className="px-3 py-2 text-center border-r border-slate-200">{r.cycle_years || ''}</td>
              <td className="px-3 py-2 text-center border-r border-slate-200">{r.duration_days || ''}</td>
              <td className="px-3 py-2 border-r border-slate-200">{r.region}</td>
              <td className="px-3 py-2 border-r-2 border-slate-400"><LinkCell href={r.official_url} /></td>
              {/* Upcoming */}
              <td className="px-3 py-2 whitespace-nowrap border-r border-slate-200">{r.upcoming?.start_date || ''}</td>
              <td className="px-3 py-2 whitespace-nowrap border-r border-slate-200">{r.upcoming?.end_date || ''}</td>
              <td className="px-3 py-2 border-r border-slate-200">{r.upcoming?.venue || ''}</td>
              <td className="px-3 py-2 border-r border-slate-200"><LinkCell href={r.upcoming?.link} /></td>
              <td className="px-3 py-2 border-r-2 border-slate-400">
                {r.upcoming?.source && (
                  <span className={`px-2 py-0.5 rounded text-xs ${r.upcoming.source === 'ai_search' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                    {r.upcoming.source === 'ai_search' ? 'AI검색' : '수동입력'}
                  </span>
                )}
              </td>
              {/* Last */}
              <td className="px-3 py-2 whitespace-nowrap border-r border-slate-200 text-slate-500">{r.last?.start_date || ''}</td>
              <td className="px-3 py-2 whitespace-nowrap border-r border-slate-200 text-slate-500">{r.last?.end_date || ''}</td>
              <td className="px-3 py-2 border-r border-slate-200 text-slate-500">{r.last?.venue || ''}</td>
              <td className="px-3 py-2 border-r-2 border-slate-400"><LinkCell href={r.last?.link} /></td>
              {/* 메모 */}
              <td className="px-3 py-2 text-slate-500">{r.note}</td>
              {/* 작업 */}
              {isAdmin && (
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingRow(r); setModalMode('edit'); }}
                      className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
                    >
                      편집
                    </button>
                    {onRequestUpdate && (
                      <button
                        onClick={() => onRequestUpdate(r)}
                        className="px-2 py-1 text-xs border border-blue-300 rounded hover:bg-blue-50 text-blue-700"
                      >
                        업데이트
                      </button>
                    )}
                    {onRequestVerify && (
                      <button
                        onClick={() => onRequestVerify(r)}
                        className="px-2 py-1 text-xs border border-indigo-300 rounded hover:bg-indigo-50 text-indigo-700"
                      >
                        검증
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 text-xs text-slate-400">총 {sorted.length}건</div>
    </div>
    <ConferenceFormModal
      isOpen={modalMode !== null}
      mode={modalMode || 'add'}
      initial={editingRow}
      onClose={() => { setModalMode(null); setEditingRow(null); }}
      onSubmit={handleSubmit}
      onDelete={editingRow ? () => deleteConference(editingRow.id) : undefined}
      existingFields={fields}
    />
    </>
  );
}
