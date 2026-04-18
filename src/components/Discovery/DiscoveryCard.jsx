// 발굴 후보 카드. 마스터 미리보기 + upcoming(있으면) + 약탈 위험도.
// PLAN-011-B: 011-C 에서 onAccept 가 master+edition 동시 생성으로 연결.
// high 위험도는 빨간 배경 + "정말 승인" 명시적 토글 필요.

import { useState } from 'react';
import PredatoryBadge from './PredatoryBadge';

function Field({ label, value, mono = false }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2 py-0.5 text-xs">
      <div className="text-slate-500">{label}</div>
      <div className={`text-slate-700 ${mono ? 'font-mono break-all' : ''}`}>{value}</div>
    </div>
  );
}

export default function DiscoveryCard({ candidate, onAccept, onReject }) {
  const isHigh = candidate.predatory_score === 'high';
  const [confirmHigh, setConfirmHigh] = useState(false);

  const headerTone = isHigh
    ? 'bg-rose-50 border-rose-300'
    : candidate.predatory_score === 'medium'
      ? 'bg-amber-50 border-amber-300'
      : 'bg-white border-slate-300';

  const cycle = Number.isFinite(candidate.cycle_years) ? `${candidate.cycle_years}년` : '미상';

  return (
    <div className={`border rounded-lg shadow-sm ${headerTone}`}>
      <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-semibold text-sm text-slate-800 truncate">
            {candidate.abbreviation && (
              <span className="mr-1">{candidate.abbreviation}</span>
            )}
            <span className="text-slate-600 font-normal">— {candidate.full_name}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {candidate.field && <span>{candidate.field}</span>}
            {candidate.region && <><span className="text-slate-300">·</span><span>{candidate.region}</span></>}
            <span className="text-slate-300">·</span>
            <span>주기 {cycle}</span>
          </div>
        </div>
        <PredatoryBadge score={candidate.predatory_score} reasons={candidate.predatory_reasons} />
      </div>

      <div className="p-3 space-y-2">
        <div>
          <Field label="organizer" value={candidate.organizer} />
          {candidate.official_url && (
            <div className="grid grid-cols-[80px_1fr] gap-2 py-0.5 text-xs">
              <div className="text-slate-500">official</div>
              <a
                href={candidate.official_url} target="_blank" rel="noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {candidate.official_url} ↗
              </a>
            </div>
          )}
          {candidate.evidence_url && candidate.evidence_url !== candidate.official_url && (
            <div className="grid grid-cols-[80px_1fr] gap-2 py-0.5 text-xs">
              <div className="text-slate-500">evidence</div>
              <a
                href={candidate.evidence_url} target="_blank" rel="noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {candidate.evidence_url} ↗
              </a>
            </div>
          )}
        </div>

        {candidate.upcoming && (
          <div className="border-t border-slate-200 pt-2">
            <div className="text-[11px] font-semibold text-slate-500 mb-1">차기 회차 (AI 추정)</div>
            <Field label="시작일" value={candidate.upcoming.start_date} />
            <Field label="종료일" value={candidate.upcoming.end_date} />
            <Field label="장소" value={candidate.upcoming.venue} />
            {candidate.upcoming.link && (
              <div className="grid grid-cols-[80px_1fr] gap-2 py-0.5 text-xs">
                <div className="text-slate-500">링크</div>
                <a
                  href={candidate.upcoming.link} target="_blank" rel="noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {candidate.upcoming.link} ↗
                </a>
              </div>
            )}
          </div>
        )}

        {candidate.predatory_reasons?.length > 0 && (
          <div className="border-t border-slate-200 pt-2">
            <div className="text-[11px] font-semibold text-slate-500 mb-1">위험 사유</div>
            <ul className="text-[11px] text-slate-600 list-disc pl-4 space-y-0.5">
              {candidate.predatory_reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        {isHigh && (
          <label className="flex items-center gap-1.5 text-[11px] text-rose-700 pt-1">
            <input
              type="checkbox"
              checked={confirmHigh}
              onChange={(e) => setConfirmHigh(e.target.checked)}
            />
            위험 학회임을 인지하고 그래도 승인합니다
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onReject}
            className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
          >
            거절
          </button>
          <button
            onClick={onAccept}
            disabled={isHigh && !confirmHigh}
            className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            승인
          </button>
        </div>
      </div>
    </div>
  );
}
