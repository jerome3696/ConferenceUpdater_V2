import { useEffect, useState } from 'react';
import UpdateCard from './UpdateCard';
import VerificationCard from './VerificationCard';
import UpdateLog from './UpdateLog';

function RateLimitBanner({ until }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remain = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <div className="mb-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded flex items-center gap-3 text-sm text-amber-800">
      <span>⏳</span>
      <span>
        API rate limit — <span className="font-semibold">{remain}초</span> 뒤 자동 재개됩니다.
      </span>
    </div>
  );
}

export default function UpdatePanel({ queue, onBack }) {
  const {
    queue: waiting,
    searching,
    pending,
    log,
    queuedCount,
    pendingCount,
    rateLimitUntil,
    accept,
    reject,
    acceptAll,
    rejectAll,
    stopAll,
  } = queue;

  const readyCount = pending.filter((c) => c.status === 'ready' && c.result).length;

  const handleAcceptAll = () => {
    if (readyCount === 0) return;
    if (window.confirm(`승인 대기 중인 ${readyCount}건을 모두 수용할까요?`)) {
      acceptAll();
    }
  };

  const handleRejectAll = () => {
    if (pending.length === 0) return;
    if (window.confirm(`승인 대기 중인 ${pending.length}건을 모두 거절할까요?`)) {
      rejectAll();
    }
  };

  const doneCount = log.length;
  const total = doneCount + pendingCount + queuedCount + (searching ? 1 : 0);
  const inBatch = total > 1;
  const searchingDone = doneCount + pendingCount + (searching ? 1 : 0);
  const searchProgressPct = total > 0 ? Math.round(((doneCount + pendingCount) / total) * 100) : 0;

  const handleStopAll = () => {
    if (window.confirm(`검색 대기 ${queuedCount}건과 현재 검색 중 1건을 중단할까요? (이미 찾은 ${pendingCount}건은 유지됩니다)`)) {
      stopAll();
    }
  };

  const nothing = !searching && waiting.length === 0 && pending.length === 0 && log.length === 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-100"
            aria-label="닫기"
          >
            ✕ 닫기
          </button>
          <h2 className="text-lg font-bold text-slate-800">업데이트 현황</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-600">
            검색 대기 <span className="font-semibold text-slate-800">{queuedCount}</span>
            {' · '}
            승인 대기 <span className="font-semibold text-slate-800">{pendingCount}</span>
            {' · '}
            완료 <span className="font-semibold text-slate-800">{doneCount}</span>
          </div>
          {(queuedCount > 0 || searching) && (
            <button
              onClick={handleStopAll}
              className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50"
            >
              검색 중단
            </button>
          )}
        </div>
      </div>

      {inBatch && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>검색 진행 {searchingDone - (searching ? 1 : 0) + (searching ? 0 : 0)} / {total}</span>
            <span>{searchProgressPct}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${searchProgressPct}%` }} />
          </div>
        </div>
      )}

      {nothing && (
        <div className="p-12 text-center text-slate-400 border border-dashed border-slate-300 rounded bg-white">
          대기 중인 업데이트가 없습니다.
          <div className="mt-2 text-xs">메인 테이블에서 [업데이트] 또는 [전체 업데이트] 버튼을 눌러주세요.</div>
        </div>
      )}

      {rateLimitUntil && <RateLimitBanner until={rateLimitUntil} />}

      {searching && (
        <div className="mb-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded flex items-center gap-3 text-sm">
          <span className="inline-block animate-spin text-blue-600">⟳</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${searching.kind === 'verify' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
            {searching.kind === 'verify' ? '검증' : '업데이트'}
          </span>
          <span className="text-blue-800">
            {searching.kind === 'verify' ? '검증' : '검색'} 중: <span className="font-semibold">{searching.row.abbreviation || searching.row.full_name}</span>
          </span>
          {waiting.length > 0 && (
            <span className="text-xs text-blue-600 ml-auto">다음 대기 {waiting.length}건</span>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">승인 대기 ({pending.length})</h3>
            <div className="flex gap-2">
              <button
                onClick={handleAcceptAll}
                disabled={readyCount === 0}
                className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                전체 승인 ({readyCount})
              </button>
              <button
                onClick={handleRejectAll}
                className="px-3 py-1 text-xs border border-slate-300 text-slate-700 rounded hover:bg-slate-100"
              >
                전체 거절 ({pending.length})
              </button>
            </div>
          </div>
          {pending.map((card) => {
            const Card = card.kind === 'verify' ? VerificationCard : UpdateCard;
            return (
              <Card
                key={card.id}
                current={card}
                onAccept={(opts) => accept(card.id, opts)}
                onReject={() => reject(card.id)}
              />
            );
          })}
        </div>
      )}

      {waiting.length > 0 && !searching && (
        <div className="mt-4 p-3 bg-slate-100 border border-slate-200 rounded text-sm text-slate-600">
          다음 검색 대기: {waiting.map((w) => w.row.abbreviation || w.row.full_name).join(', ')}
        </div>
      )}

      <UpdateLog log={log} />
    </div>
  );
}
