import QuotaBadge from './QuotaBadge';

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

const SCOPE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'starred', label: '즐겨찾기' },
  { value: 'filter', label: '테이블필터' },
];

function ScopeToggle({ scope, onChange }) {
  const base = 'px-2.5 py-1 text-xs border border-slate-300';
  const active = 'bg-slate-700 text-white';
  const inactive = 'bg-white text-slate-700 hover:bg-slate-50';
  return (
    <div className="inline-flex rounded overflow-hidden" role="group" aria-label="캘린더 범위">
      {SCOPE_OPTIONS.map((opt, i) => {
        const on = scope === opt.value;
        const radius = i === 0 ? 'rounded-l' : i === SCOPE_OPTIONS.length - 1 ? 'rounded-r border-l-0' : 'border-l-0';
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`${base} ${radius} ${on ? active : inactive}`}
            aria-pressed={on}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Header({
  isAuthenticated,
  userEmail,
  onSignOut,
  hasToken, onOpenTokenModal,
  syncStatus, lastSavedAt, onRetryCommit,
  pendingUpdateCount = 0, onOpenUpdatePanel,
  onOpenDiscoveryPanel,
  viewMode = 'table', onChangeViewMode,
  calendarScope = 'starred', onChangeCalendarScope,
  quota,
  onShowQuotaDetail,
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
          <ScopeToggle scope={calendarScope} onChange={onChangeCalendarScope} />
        )}
        {isAuthenticated && (
          <SyncBadge
            status={syncStatus}
            lastSavedAt={lastSavedAt}
            onRetry={onRetryCommit}
            hasToken={hasToken}
          />
        )}
        {isAuthenticated && quota && (
          <div className="flex items-center gap-1.5">
            <QuotaBadge
              used={quota.update_used ?? 0}
              limit={quota.update_limit ?? 0}
              label="업데이트"
              onClick={onShowQuotaDetail ? () => onShowQuotaDetail('update') : undefined}
            />
            <QuotaBadge
              used={quota.discovery_used ?? 0}
              limit={quota.discovery_limit ?? 0}
              label="발굴"
              onClick={onShowQuotaDetail ? () => onShowQuotaDetail('discovery') : undefined}
            />
          </div>
        )}
        {isAuthenticated && pendingUpdateCount > 0 && (
          <button
            onClick={onOpenUpdatePanel}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            업데이트 현황 ({pendingUpdateCount})
          </button>
        )}
        {isAuthenticated && onOpenDiscoveryPanel && (
          <button
            onClick={onOpenDiscoveryPanel}
            className="px-3 py-1.5 text-sm border border-purple-300 text-purple-700 rounded hover:bg-purple-50"
            title="키워드 기반 신규 학회 발굴 (PLAN-011)"
          >
            🔍 발굴
          </button>
        )}
        {isAuthenticated && (
          <button
            onClick={onOpenTokenModal}
            className={`px-3 py-1.5 text-sm border rounded hover:bg-slate-50 ${hasToken ? 'border-green-300 text-green-700' : 'border-slate-300 text-slate-700'}`}
          >
            {hasToken ? 'GitHub 연결됨' : 'GitHub 연결'}
          </button>
        )}
        {isAuthenticated && (
          <button
            onClick={onSignOut}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
            title={userEmail ? `${userEmail} 로 로그인됨` : '로그아웃'}
          >
            로그아웃
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
