import { useState } from 'react';
import FilterBar from './FilterBar';
import ConferenceFormModal from './ConferenceFormModal';
import StarRating from '../common/StarRating';
import { exportAsJson, exportAsXlsx } from '../../services/exportService';
import { formatLocation } from '../../utils/locationFormatter';
import { useSorting } from '../../hooks/useSorting';
import { useFiltering } from '../../hooks/useFiltering';

// filtering 이 prop 으로 주어지지 않은 경우(테스트·독립 사용) 내부에서 자체 훅 호출.
// 실 앱에서는 App.jsx 가 리프팅된 filtering 을 내려 Calendar 와 공유한다.
function useFilteringFallback(rows, external) {
  const internal = useFiltering(rows);
  return external || internal;
}

// 그룹별 컬럼 정의 (이중 헤더용). Last/참고는 기본 접힘(QA #7).
// cellClass: th·td에 공통 적용할 클래스 (예: min-w로 좁은 폭에서 한글 절단 방지).
const GROUPS = [
  {
    label: '학회 마스터',
    className: 'bg-slate-200',
    columns: [
      { key: 'starred', label: '★' },
      { key: 'category', label: '분류', cellClass: 'min-w-[4.5rem]' },
      { key: 'field', label: '분야', cellClass: 'min-w-[4.5rem]' },
      { key: 'abbreviation', label: '약칭' },
      { key: 'full_name', label: '학회명' },
      { key: 'cycle_years', label: <>주기<br />(년)</> },
      { key: 'duration_days', label: <>기간<br />(일)</> },
      { key: 'region', label: '지역', cellClass: 'min-w-[4.5rem]' },
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
    collapsible: true,
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
    collapsible: true,
    columns: [{ key: 'note', label: '메모' }],
  },
];

const ACTION_GROUP = {
  label: '작업',
  className: 'bg-slate-50',
  columns: [{ key: 'actions', label: '작업' }],
};

const CONFIDENCE_LABEL = { 고: '고', 중: '중', 저: '저', high: '고', medium: '중', med: '중', low: '저' };

function formatSourceLabel(source, confidence) {
  if (source === 'ai_search') {
    const c = confidence ? CONFIDENCE_LABEL[String(confidence).toLowerCase()] || CONFIDENCE_LABEL[confidence] : null;
    return c ? `AI검색 (${c})` : 'AI검색';
  }
  if (source === 'user_input') return '수동입력';
  if (source === 'ai_discovery') return 'AI발굴';
  return source || '';
}

function sourceBadgeClass(source) {
  if (source === 'ai_search') return 'bg-purple-100 text-purple-700';
  if (source === 'ai_discovery') return 'bg-blue-100 text-blue-700';
  return 'bg-green-100 text-green-700'; // user_input 등
}

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

export default function MainTable({ isAdmin = false, conferences, filtering, onRequestUpdate, onRequestUpdateAll, onRequestVerifyAll }) {
  const { rows, loading, error, data, addConference, updateStarred, saveConferenceEdit, deleteConference } = conferences;
  const [modalMode, setModalMode] = useState(null); // 'add' | 'edit' | null
  const [editingRow, setEditingRow] = useState(null);
  // QA #7: Last/참고는 기본 접힘. 사용자가 그룹 헤더 클릭으로 토글.
  const [collapsed, setCollapsed] = useState(() => new Set(['Last', '참고']));
  const toggleGroup = (label) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  const { filters, setFilters, filtered, options: { categories, fields, regions } } = useFilteringFallback(rows, filtering);
  const { sortKey, sortDir, onSort, sorted } = useSorting(filtered, getSortValue, 'upcoming_start');

  if (loading) return <div className="p-8 text-slate-500">로딩 중...</div>;
  if (error) return <div className="p-8 text-red-600">오류: {error.message}</div>;

  // QA #6: 작업 컬럼을 첫 열로(★ 앞).
  const groups = isAdmin ? [ACTION_GROUP, ...GROUPS] : GROUPS;
  // 접힘 그룹은 columns를 단일 토글 컬럼으로 치환.
  const renderedGroups = groups.map((g) => {
    if (g.collapsible && collapsed.has(g.label)) {
      return { ...g, _collapsed: true, columns: [{ key: `_toggle_${g.label}`, label: '▶' }] };
    }
    return { ...g, _collapsed: false };
  });

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
            {renderedGroups.map((g) => (
              <th
                key={g.label}
                colSpan={g.columns.length}
                onClick={g.collapsible ? () => toggleGroup(g.label) : undefined}
                className={`px-3 py-2 text-center font-bold text-slate-700 border border-slate-300 ${g.className} ${g.collapsible ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
                title={g.collapsible ? (g._collapsed ? '펼치기' : '접기') : undefined}
              >
                {g.label}
                {g.collapsible && <span className="ml-1 text-xs">{g._collapsed ? '▶' : '▼'}</span>}
              </th>
            ))}
          </tr>
          <tr>
            {renderedGroups.flatMap((g) => {
              if (g._collapsed) {
                return [(
                  <th
                    key={g.columns[0].key}
                    onClick={() => toggleGroup(g.label)}
                    className={`px-2 py-2 text-center font-semibold text-slate-500 border border-slate-300 cursor-pointer select-none hover:bg-slate-200 ${g.className}`}
                  >
                    ▶
                  </th>
                )];
              }
              return g.columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => onSort(c.key)}
                  className={`px-3 py-2 text-center font-semibold text-slate-700 border border-slate-300 cursor-pointer select-none hover:bg-slate-200 whitespace-nowrap ${c.cellClass || ''} ${g.className}`}
                >
                  {c.label}
                  {sortKey === c.key && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ));
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50 border-b border-slate-200">
              {/* 작업 (admin: 첫 열, QA #6) */}
              {isAdmin && (
                <td className="px-3 py-2 whitespace-nowrap border-r-2 border-slate-400">
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
                  </div>
                </td>
              )}
              {/* 마스터 */}
              <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                <StarRating
                  value={r.starred || 0}
                  readOnly={!isAdmin}
                  onChange={(v) => updateStarred(r.id, v)}
                />
              </td>
              <td className="px-3 py-2 border-r border-slate-200 cell-text min-w-[4.5rem]">{r.category}</td>
              <td className="px-3 py-2 border-r border-slate-200 cell-text min-w-[4.5rem]">{r.field}</td>
              <td className="px-3 py-2 font-mono border-r border-slate-200">{r.abbreviation}</td>
              <td className="px-3 py-2 border-r border-slate-200 cell-text max-w-xs">
                <div className="line-clamp-5" title={r.full_name}>{r.full_name}</div>
              </td>
              <td className="px-3 py-2 text-center border-r border-slate-200">{r.cycle_years || ''}</td>
              <td className="px-3 py-2 text-center border-r border-slate-200">{r.duration_days || ''}</td>
              <td className="px-3 py-2 border-r border-slate-200 cell-text min-w-[4.5rem]">{r.region}</td>
              <td className="px-3 py-2 border-r-2 border-slate-400 whitespace-nowrap"><LinkCell href={r.official_url} /></td>
              {/* Upcoming */}
              <td className="px-3 py-2 whitespace-nowrap border-r border-slate-200">{r.upcoming?.start_date || ''}</td>
              <td className="px-3 py-2 whitespace-nowrap border-r border-slate-200">{r.upcoming?.end_date || ''}</td>
              <td className="px-3 py-2 border-r border-slate-200 cell-text">{formatLocation(r.upcoming?.venue)}</td>
              <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap"><LinkCell href={r.upcoming?.link} /></td>
              <td className="px-3 py-2 border-r-2 border-slate-400">
                {r.upcoming?.source && (
                  <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${sourceBadgeClass(r.upcoming.source)}`}>
                    {formatSourceLabel(r.upcoming.source, r.upcoming.confidence)}
                  </span>
                )}
              </td>
              {/* Last (collapsible) */}
              {collapsed.has('Last') ? (
                <td
                  className="px-2 py-2 text-center text-slate-300 border-r-2 border-slate-400 cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleGroup('Last')}
                  title="펼치기"
                >▶</td>
              ) : (
                <>
                  <td className="px-3 py-2 whitespace-nowrap border-r border-slate-200 text-slate-500">{r.last?.start_date || ''}</td>
                  <td className="px-3 py-2 whitespace-nowrap border-r border-slate-200 text-slate-500">{r.last?.end_date || ''}</td>
                  <td className="px-3 py-2 border-r border-slate-200 text-slate-500 cell-text">{formatLocation(r.last?.venue)}</td>
                  <td className="px-3 py-2 border-r-2 border-slate-400 whitespace-nowrap"><LinkCell href={r.last?.link} /></td>
                </>
              )}
              {/* 메모 (collapsible) */}
              {collapsed.has('참고') ? (
                <td
                  className="px-2 py-2 text-center text-slate-300 cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleGroup('참고')}
                  title="펼치기"
                >▶</td>
              ) : (
                <td className="px-3 py-2 text-slate-500 cell-text max-w-xs">
                  <div className="line-clamp-5" title={r.note}>{r.note}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 text-xs text-slate-400">총 {sorted.length}건</div>
    </div>
    {modalMode !== null && (
      <ConferenceFormModal
        key={editingRow?.id ?? 'new'}
        mode={modalMode}
        initial={editingRow}
        onClose={() => { setModalMode(null); setEditingRow(null); }}
        onSubmit={handleSubmit}
        onDelete={editingRow ? () => deleteConference(editingRow.id) : undefined}
        existingFields={fields}
      />
    )}
    </>
  );
}
