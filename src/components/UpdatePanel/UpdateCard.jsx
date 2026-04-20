import { useState } from 'react';

const DIFF_FIELDS = ['start_date', 'end_date', 'venue', 'link'];

function isEmpty(obj) {
  return DIFF_FIELDS.every((k) => !obj?.[k]);
}

function noChange(oldObj, newObj) {
  return DIFF_FIELDS.every((k) => (oldObj?.[k] || '') === (newObj?.[k] || ''));
}

function ConfidenceBadge({ value }) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  let cls = 'bg-slate-100 text-slate-600';
  if (v === '고' || v === 'high') cls = 'bg-emerald-100 text-emerald-700';
  else if (v === '중' || v === 'medium' || v === 'med') cls = 'bg-amber-100 text-amber-700';
  else if (v === '저' || v === 'low') cls = 'bg-rose-100 text-rose-700';
  return <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${cls}`}>신뢰도 {value}</span>;
}

function DiffRow({ label, oldValue, newValue }) {
  const changed = (oldValue || '') !== (newValue || '');
  return (
    <div className="grid grid-cols-[80px_1fr_1fr] gap-2 py-1 border-b border-slate-100 last:border-0 text-xs">
      <div className="text-slate-500">{label}</div>
      <div className={`text-slate-600 ${changed ? 'line-through' : ''}`}>{oldValue || <span className="text-slate-300">없음</span>}</div>
      <div className={changed ? 'font-semibold text-emerald-700' : 'text-slate-600'}>
        {newValue || <span className="text-slate-300">없음</span>}
      </div>
    </div>
  );
}

export default function UpdateCard({ current, onAccept, onReject, onCancel }) {
  const { row, status, result, error } = current;
  const oldUpcoming = row.upcoming || {};
  const [anchor, setAnchor] = useState(false);

  // 변경없음 카드: 한 줄 배너 + 닫기만 (Item 4)
  if (status === 'ready' && result) {
    const oldEmpty = isEmpty(oldUpcoming);
    const newEmpty = isEmpty(result);
    if (oldEmpty && newEmpty) {
      return (
        <CompactBanner
          row={row}
          tone="slate"
          message="정보 미공개 — 업데이트 없음"
          confidence={result.confidence}
          onClose={onReject}
        />
      );
    }
    if (noChange(oldUpcoming, result)) {
      return (
        <CompactBanner
          row={row}
          tone="emerald"
          message="변경사항 없음"
          confidence={result.confidence}
          onClose={onReject}
        />
      );
    }
  }

  return (
    <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm text-slate-800">
            {row.abbreviation} <span className="text-slate-500 font-normal">— {row.full_name}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {row.category} / {row.field} / {row.region}
          </div>
        </div>
        <div className="text-xs">
          {status === 'loading' && <span className="text-blue-600">검색 중...</span>}
          {status === 'ready' && <span className="text-emerald-600">승인 대기</span>}
          {status === 'error' && <span className="text-red-600">오류</span>}
        </div>
      </div>

      <div className="p-3">
        {status === 'loading' && (
          <div className="py-6 text-center text-xs text-slate-500">
            <div className="inline-block animate-spin mr-2">⟳</div>
            Claude API로 검색 중입니다. 보통 10~30초 소요됩니다.
            <div className="mt-3">
              <button
                onClick={onCancel}
                className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100"
              >
                중단
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 whitespace-pre-wrap">
              {error}
            </div>
            <div className="flex justify-end mt-2">
              <button
                onClick={onReject}
                className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {status === 'ready' && result && (
          <>
            <div className="grid grid-cols-[80px_1fr_1fr] gap-2 pb-1.5 border-b-2 border-slate-300 text-[11px] font-semibold text-slate-500">
              <div>필드</div>
              <div>현재</div>
              <div>제안</div>
            </div>
            <DiffRow label="시작일" oldValue={oldUpcoming.start_date} newValue={result.start_date} />
            <DiffRow label="종료일" oldValue={oldUpcoming.end_date} newValue={result.end_date} />
            <DiffRow label="장소" oldValue={oldUpcoming.venue} newValue={result.venue} />
            <DiffRow label="링크" oldValue={oldUpcoming.link} newValue={result.link} />

            {(result.confidence || result.source_url || result.notes) && (
              <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <ConfidenceBadge value={result.confidence} />
                  {result.source_url && (
                    <a
                      href={result.source_url} target="_blank" rel="noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      출처 ↗
                    </a>
                  )}
                </div>
                {result.notes && <div>비고: {result.notes}</div>}
              </div>
            )}

            <div className="flex justify-between items-center gap-2 mt-3">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={anchor}
                  onChange={(e) => setAnchor(e.target.checked)}
                  className="accent-emerald-600"
                />
                확정으로 표시 (회차 종료까지 재검색 안 함)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={onReject}
                  className="px-3 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
                >
                  리젝
                </button>
                <button
                  onClick={() => onAccept({ anchor })}
                  className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                >
                  {anchor ? '수용 (확정)' : '수용'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CompactBanner({ row, tone, message, confidence, onClose }) {
  const toneClass = tone === 'emerald'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : 'bg-slate-50 border-slate-200 text-slate-700';
  return (
    <div className={`border rounded px-3 py-2 flex items-center justify-between text-xs ${toneClass}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold truncate">
          {row.abbreviation || row.full_name}
        </span>
        <span className="text-slate-400">·</span>
        <span className="truncate">{message}</span>
        <ConfidenceBadge value={confidence} />
      </div>
      <button
        onClick={onClose}
        className="ml-3 px-2 py-0.5 text-[11px] border border-slate-300 rounded hover:bg-white/50 text-slate-600 shrink-0"
      >
        닫기
      </button>
    </div>
  );
}
