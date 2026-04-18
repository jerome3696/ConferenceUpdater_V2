import { useMemo } from 'react';
import { conferencesInYear, monthLabelsKo, daysInYear, shiftYear } from './calendarUtils';

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

export default function YearTimeline({ rows, year, onChangeYear }) {
  const items = useMemo(() => conferencesInYear(rows, year), [rows, year]);
  const total = daysInYear(year);
  const months = monthLabelsKo();

  // 월 경계선 위치(누적 일수 비율). Leap 연도에서도 2월=29일 반영.
  const monthBoundaries = useMemo(() => {
    const result = [];
    let acc = 0;
    for (let m = 0; m < 12; m += 1) {
      const daysInM = new Date(year, m + 1, 0).getDate();
      result.push({ month: m, startPct: (acc / total) * 100, widthPct: (daysInM / total) * 100 });
      acc += daysInM;
    }
    return result;
  }, [year, total]);

  return (
    <div className="border border-slate-300 rounded bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <NavButton onClick={() => onChangeYear(shiftYear(year, -1))} title="이전 연도">‹</NavButton>
          <div className="text-base font-semibold text-slate-800 min-w-[5rem] text-center">{year}년</div>
          <NavButton onClick={() => onChangeYear(shiftYear(year, 1))} title="다음 연도">›</NavButton>
          <NavButton onClick={() => onChangeYear(new Date().getFullYear())} title="올해">오늘</NavButton>
        </div>
        <div className="text-xs text-slate-500">{items.length}건</div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* 월 헤더 */}
          <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
            <div className="w-40 shrink-0 px-3 py-2 text-xs font-semibold text-slate-600 border-r border-slate-200">학회</div>
            <div className="relative flex-1 h-8">
              {monthBoundaries.map((b) => (
                <div
                  key={b.month}
                  className="absolute top-0 h-full border-r border-slate-200 text-xs text-slate-600 px-1 flex items-center"
                  style={{ left: `${b.startPct}%`, width: `${b.widthPct}%` }}
                >
                  {months[b.month]}
                </div>
              ))}
            </div>
          </div>

          {/* 학회 행 */}
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-400">해당 연도에 표시할 학회가 없습니다.</div>
          ) : (
            items.map((item) => {
              const leftPct = (item.startOffset / total) * 100;
              const widthPct = Math.max(((item.endOffset - item.startOffset + 1) / total) * 100, 0.4);
              const label = item.row.abbreviation || item.row.full_name;
              const u = item.row.upcoming;
              const title = `${item.row.full_name}\n${u?.start_date} ~ ${u?.end_date || u?.start_date}${u?.venue ? `\n${u.venue}` : ''}`;
              return (
                <div key={item.row.id} className="flex border-b border-slate-100 hover:bg-slate-50">
                  <div className="w-40 shrink-0 px-3 py-2 text-sm text-slate-800 border-r border-slate-200 truncate" title={item.row.full_name}>
                    {item.row.starred ? <span className="text-amber-500 mr-1">★</span> : null}
                    {label}
                  </div>
                  <div className="relative flex-1 h-10">
                    {/* 월 경계선 */}
                    {monthBoundaries.slice(1).map((b) => (
                      <div
                        key={`grid-${b.month}`}
                        className="absolute top-0 h-full border-l border-slate-100"
                        style={{ left: `${b.startPct}%` }}
                      />
                    ))}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-5 rounded bg-blue-500/80 border border-blue-700 cursor-default"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={title}
                    >
                      {u?.link ? (
                        <a
                          href={u.link}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-full h-full"
                          aria-label={`${label} 링크 열기`}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
