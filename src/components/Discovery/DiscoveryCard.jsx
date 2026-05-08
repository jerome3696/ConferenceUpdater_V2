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

export default function DiscoveryCard({ candidate, onAccept, onAbsorb, onReject }) {
  const isHigh = candidate.predatory_score === 'high';
  const [confirmHigh, setConfirmHigh] = useState(false);
  // PLAN-039: 기존 upstream 학회와 매칭된 경우 absorb 흐름.
  const match = candidate._match || null;

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
        {/* PLAN-039: 기존 upstream 학회와 매칭됨 → 흡수/신규 선택 안내 */}
        {match && (
          <div className="border border-blue-300 bg-blue-50 rounded px-2 py-1.5 text-[11px] text-blue-800">
            <span className="font-semibold">이미 DB에 존재:</span>{' '}
            {match.abbreviation && <span className="font-mono mr-1">{match.abbreviation}</span>}
            <span className="text-blue-700">{match.full_name}</span>
            <div className="mt-0.5 text-[10px] text-blue-600">
              [기존 학회 별표] = 본인 라이브러리에 추가 · [새로 추가] = 별도 학회로 등록
            </div>
          </div>
        )}

        {/* 추천 분류 (PLAN-011-B.1) — field 한국어 + matched_keywords 페어 칩 */}
        {(candidate.field || candidate.matched_keywords?.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-200">
            <span className="text-[11px] text-slate-500 shrink-0">추천 분류</span>
            {candidate.field && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                {candidate.field}
              </span>
            )}
            {candidate.matched_keywords?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {candidate.matched_keywords.map((m, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200"
                    title={`${m.ko} / ${m.en}`}
                  >
                    {m.ko}
                    <span className="ml-1 text-slate-400">{m.en}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

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
          {match ? (
            <>
              <button
                onClick={onAccept}
                disabled={isHigh && !confirmHigh}
                className="px-3 py-1 text-xs border border-slate-400 rounded hover:bg-slate-100 text-slate-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                title="매칭 무시하고 별도 학회로 등록"
              >
                새로 추가
              </button>
              <button
                onClick={onAbsorb}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                title={`기존 학회 ${match.abbreviation || match.full_name} 에 별표 표시`}
              >
                기존 학회 별표
              </button>
            </>
          ) : (
            <button
              onClick={onAccept}
              disabled={isHigh && !confirmHigh}
              className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              승인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
