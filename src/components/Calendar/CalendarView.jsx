import { useMemo, useState } from 'react';
import YearTimeline from './YearTimeline';
import MonthGrid from './MonthGrid';

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
    // starred 기본: rows 중 starred>=1
    return rows.filter((r) => r.starred);
  }, [rows, filtering, scope]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SubViewToggle subView={subView} onChange={onChangeSubView} />
        <div className="text-xs text-slate-500">
          {scope === 'filter' ? '테이블 필터 결과' : '즐겨찾기(★)'} · {sourceRows.length}건
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
