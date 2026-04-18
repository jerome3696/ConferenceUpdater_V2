import { useMemo } from 'react';
import { conferencesByDayInMonth, monthGridCells, shiftMonth, monthLabelsKo } from './calendarUtils';

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_CHIPS = 3;

function NavButton({ children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-2 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
    >
      {children}
    </button>
  );
}

function DayCell({ day, rowsForDay, isToday }) {
  if (day === null) {
    return <div className="border border-slate-100 bg-slate-50/50 min-h-[88px]" />;
  }
  const extra = rowsForDay.length - MAX_CHIPS;
  return (
    <div className={`border border-slate-200 min-h-[88px] p-1 ${isToday ? 'bg-blue-50' : 'bg-white'}`}>
      <div className={`text-xs mb-1 ${isToday ? 'font-bold text-blue-700' : 'text-slate-500'}`}>{day}</div>
      <div className="flex flex-col gap-0.5">
        {rowsForDay.slice(0, MAX_CHIPS).map((r) => {
          const label = r.abbreviation || r.full_name;
          const tooltip = `${r.full_name}${r.upcoming?.venue ? ` — ${r.upcoming.venue}` : ''}`;
          return (
            <div
              key={r.id}
              title={tooltip}
              className="text-[11px] px-1 py-0.5 rounded bg-blue-100 text-blue-800 truncate"
            >
              {r.starred ? '★ ' : ''}{label}
            </div>
          );
        })}
        {extra > 0 && (
          <div className="text-[11px] text-slate-500 px-1">+{extra}</div>
        )}
      </div>
    </div>
  );
}

export default function MonthGrid({ rows, year, monthIndex, onChangeMonth }) {
  const cells = useMemo(() => monthGridCells(year, monthIndex), [year, monthIndex]);
  const dayMap = useMemo(() => conferencesByDayInMonth(rows, year, monthIndex), [rows, year, monthIndex]);
  const months = monthLabelsKo();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
  const todayDate = today.getDate();

  const totalCount = useMemo(() => {
    const seen = new Set();
    for (const arr of dayMap.values()) for (const r of arr) seen.add(r.id);
    return seen.size;
  }, [dayMap]);

  const prev = () => {
    const s = shiftMonth(year, monthIndex, -1);
    onChangeMonth(s.year, s.monthIndex);
  };
  const next = () => {
    const s = shiftMonth(year, monthIndex, 1);
    onChangeMonth(s.year, s.monthIndex);
  };
  const goToday = () => onChangeMonth(today.getFullYear(), today.getMonth());

  return (
    <div className="border border-slate-300 rounded bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <NavButton onClick={prev} title="이전 달">‹</NavButton>
          <div className="text-base font-semibold text-slate-800 min-w-[7rem] text-center">
            {year}년 {months[monthIndex]}
          </div>
          <NavButton onClick={next} title="다음 달">›</NavButton>
          <NavButton onClick={goToday} title="이번 달">오늘</NavButton>
        </div>
        <div className="text-xs text-slate-500">{totalCount}건</div>
      </div>
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {WEEKDAYS_KO.map((w, i) => (
          <div
            key={w}
            className={`px-2 py-1.5 text-center text-xs font-semibold ${i === 0 ? 'text-rose-600' : i === 6 ? 'text-blue-600' : 'text-slate-600'}`}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => (
          <DayCell
            key={i}
            day={day}
            rowsForDay={day ? (dayMap.get(day) || []) : []}
            isToday={isCurrentMonth && day === todayDate}
          />
        ))}
      </div>
    </div>
  );
}
