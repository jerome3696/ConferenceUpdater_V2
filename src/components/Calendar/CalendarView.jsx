import { useMemo, useState } from 'react';
import YearTimeline from './YearTimeline';
import MonthGrid from './MonthGrid';
import { buildIcs, toIcsFilename, downloadIcs } from '../../utils/icsExport';

function SubViewToggle({ subView, onChange }) {
  const base = 'px-3 py-1 text-sm border border-slate-300';
  const active = 'bg-slate-800 text-white';
  const inactive = 'bg-white text-slate-700 hover:bg-slate-50';
  return (
    <div className="inline-flex rounded overflow-hidden">
      <button
        type="button"
        onClick={() => onChange('year')}
        className={`${base} rounded-l ${subView === 'year' ? active : inactive}`}
      >
        연간
      </button>
      <button
        type="button"
        onClick={() => onChange('month')}
        className={`${base} rounded-r border-l-0 ${subView === 'month' ? active : inactive}`}
      >
        월간
      </button>
    </div>
  );
}

export default function CalendarView({ rows, filtering, scope, subView, onChangeSubView }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthYear, setMonthYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());

  const sourceRows = useMemo(() => {
    if (scope === 'filter' && filtering?.filtered) return filtering.filtered;
    if (scope === 'all') return rows;
    return rows.filter((r) => r.starred);
  }, [rows, filtering, scope]);

  const scopeLabel = scope === 'filter' ? '테이블 필터 결과'
    : scope === 'all' ? '전체 학회'
    : '즐겨찾기(★)';
  const scopeSlug = scope === 'filter' ? 'filter' : scope === 'all' ? 'all' : 'starred';

  const handleExportIcs = () => {
    const ics = buildIcs(sourceRows, { calName: `ConferenceFinder — ${scopeLabel}` });
    downloadIcs(ics, toIcsFilename(scopeSlug));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SubViewToggle subView={subView} onChange={onChangeSubView} />
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">
            {scopeLabel} · {sourceRows.length}건
          </div>
          <button
            type="button"
            onClick={handleExportIcs}
            disabled={sourceRows.length === 0}
            className="px-3 py-1 text-xs border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="현재 범위의 학회 일정을 .ics 파일로 내려받아 구글/애플/아웃룩 캘린더에 가져올 수 있습니다."
          >
            캘린더로 내보내기 (.ics)
          </button>
        </div>
      </div>
      {subView === 'year' ? (
        <YearTimeline rows={sourceRows} year={year} onChangeYear={setYear} />
      ) : (
        <MonthGrid
          rows={sourceRows}
          year={monthYear}
          monthIndex={monthIndex}
          onChangeMonth={(y, m) => { setMonthYear(y); setMonthIndex(m); }}
        />
      )}
    </div>
  );
}
