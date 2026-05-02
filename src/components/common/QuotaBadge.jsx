// PLAN-029 §4.4: 쿼터 인디케이터. 0-59% 회색 / 60-79% 노랑 / 80-99% 주황 / 100% 빨강.
function getColor(used, limit) {
  if (!limit || limit <= 0) return 'bg-slate-100 text-slate-600 border-slate-200';
  const ratio = used / limit;
  if (ratio >= 1) return 'bg-red-100 text-red-700 border-red-300';
  if (ratio >= 0.8) return 'bg-orange-100 text-orange-700 border-orange-300';
  if (ratio >= 0.6) return 'bg-amber-100 text-amber-700 border-amber-300';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function QuotaBadge({ used = 0, limit = 0, label, onClick }) {
  const color = getColor(used, limit);
  const exhausted = limit > 0 && used >= limit;
  const handleClick = exhausted && onClick ? onClick : undefined;
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!handleClick}
      className={`inline-flex items-center px-2 py-1 rounded border text-xs ${color} ${handleClick ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
      title={`${label} 쿼터 ${used}/${limit}${exhausted ? ' — 클릭하여 자세히' : ''}`}
    >
      {label} {used}/{limit}
    </button>
  );
}

export default QuotaBadge;
