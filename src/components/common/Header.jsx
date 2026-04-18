function formatTime(d) {
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function SyncBadge({ status, lastSavedAt, onRetry, hasToken }) {
  if (!hasToken) {
    return (
      <span className="text-xs text-slate-400" title="GitHub 미연결 — 변경사항은 이 브라우저에만 저장됩니다">
        미저장 (로컬)
      </span>
    );
  }
  switch (status) {
    case 'saving':
      return <span className="text-xs text-slate-500">저장 중...</span>;
    case 'saved':
      return <span className="text-xs text-green-600">저장됨 {formatTime(lastSavedAt)}</span>;
    case 'dirty':
      return <span className="text-xs text-slate-500">변경됨 (곧 저장)</span>;
    case 'error':
      return (
        <span className="text-xs text-red-600">
          저장 실패{' '}
          <button onClick={onRetry} className="underline hover:no-underline">재시도</button>
        </span>
      );
    case 'conflict':
      return (
        <span className="text-xs text-amber-700">
          충돌 — 새로고침 필요
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">대기</span>;
  }
}

function ViewToggle({ viewMode, onChangeViewMode }) {
  const base = 'px-3 py-1.5 text-sm border border-slate-300';
  const active = 'bg-slate-800 text-white hover:bg-slate-700';
  const inactive = 'bg-white text-slate-700 hover:bg-slate-50';
  return (
    <div className="inline-flex rounded overflow-hidden">
      <button
        type="button"
        onClick={() => onChangeViewMode('table')}
        className={`${base} rounded-l ${viewMode === 'table' ? active : inactive}`}
      >
        테이블
      </button>
      <button
        type="button"
        onClick={() => onChangeViewMode('calendar')}
        className={`${base} rounded-r border-l-0 ${viewMode === 'calendar' ? active : inactive}`}
      >
        캘린더
      </button>
    </div>
  );
}

function Header({
  hasKey, onOpenKeyModal,
  hasToken, onOpenTokenModal,
  syncStatus, lastSavedAt, onRetryCommit,
  pendingUpdateCount = 0, onOpenUpdatePanel,
  viewMode = 'table', onChangeViewMode,
  calendarScope = 'starred', onChangeCalendarScope,
}) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ConferenceFinder</h1>
        <p className="text-xs text-slate-500">열유체·건물공조 학회 DB</p>
      </div>
      <div className="flex items-center gap-3">
        {onChangeViewMode && (
          <ViewToggle viewMode={viewMode} onChangeViewMode={onChangeViewMode} />
        )}
        {viewMode === 'calendar' && onChangeCalendarScope && (
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 select-none">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={calendarScope === 'filter'}
              onChange={(e) => onChangeCalendarScope(e.target.checked ? 'filter' : 'starred')}
            />
            테이블 필터와 동기화
          </label>
        )}
        {hasKey && (
          <SyncBadge
            status={syncStatus}
            lastSavedAt={lastSavedAt}
            onRetry={onRetryCommit}
            hasToken={hasToken}
          />
        )}
        {hasKey ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-100 text-green-800">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            관리자 모드
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-100 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            열람자 모드
          </span>
        )}
        {hasKey && pendingUpdateCount > 0 && (
          <button
            onClick={onOpenUpdatePanel}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            업데이트 현황 ({pendingUpdateCount})
          </button>
        )}
        {hasKey && (
          <button
            onClick={onOpenTokenModal}
            className={`px-3 py-1.5 text-sm border rounded hover:bg-slate-50 ${hasToken ? 'border-green-300 text-green-700' : 'border-slate-300 text-slate-700'}`}
          >
            {hasToken ? 'GitHub 연결됨' : 'GitHub 연결'}
          </button>
        )}
        <button
          onClick={onOpenKeyModal}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
        >
          {hasKey ? 'API 키 관리' : 'API 키 설정'}
        </button>
      </div>
    </header>
  );
}

export default Header;
