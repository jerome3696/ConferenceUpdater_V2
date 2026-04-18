// 약탈 학회 위험도 배지. low/medium/high 3단계 + 사유 툴팁.
// PLAN-011-B: AI predatory_score + reasons 노출 (UI 최종 확인 레이어).

const STYLES = {
  low: {
    bg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    label: '안전',
    dot: 'bg-emerald-500',
  },
  medium: {
    bg: 'bg-amber-100 text-amber-700 border-amber-200',
    label: '주의',
    dot: 'bg-amber-500',
  },
  high: {
    bg: 'bg-rose-100 text-rose-700 border-rose-200',
    label: '위험',
    dot: 'bg-rose-500',
  },
};

export default function PredatoryBadge({ score, reasons = [] }) {
  const key = ['low', 'medium', 'high'].includes(score) ? score : 'medium';
  const s = STYLES[key];
  const tip = reasons.length ? `사유:\n- ${reasons.join('\n- ')}` : '판정 사유 미제공';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${s.bg}`}
      title={tip}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
