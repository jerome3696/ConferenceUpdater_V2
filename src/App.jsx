import { useState } from 'react';
import MainTable from './components/MainTable/MainTable';
import CalendarView from './components/Calendar/CalendarView';
import UpdatePanel from './components/UpdatePanel/UpdatePanel';
import Header from './components/common/Header';
import ApiKeyModal from './components/common/ApiKeyModal';
import GitHubTokenModal from './components/common/GitHubTokenModal';
import { useApiKey } from './hooks/useApiKey';
import { useGitHubToken } from './hooks/useGitHubToken';
import { useConferences } from './hooks/useConferences';
import { useUpdateQueue } from './hooks/useUpdateQueue';
import { useFiltering } from './hooks/useFiltering';
import { filterSearchTargets } from './services/updateLogic';

function App() {
  const { apiKey, setApiKey, clearApiKey, hasKey } = useApiKey();
  const { token, setToken, clearToken, hasToken } = useGitHubToken();
  const conferences = useConferences({ token });
  const updateQueue = useUpdateQueue({
    apiKey,
    applyAiUpdate: conferences.applyAiUpdate,
    applyVerifyUpdate: conferences.applyVerifyUpdate,
  });

  const [isKeyModalOpen, setKeyModalOpen] = useState(false);
  const [isTokenModalOpen, setTokenModalOpen] = useState(false);
  // 개별 업데이트는 큐에만 쌓고 메인 화면 유지(QA #11). 일괄 작업과 헤더 버튼은 overlay 자동 오픈.
  const [isUpdatePanelOpen, setUpdatePanelOpen] = useState(false);

  // PLAN-009: 테이블/캘린더 뷰 전환. useFiltering은 App 레벨에서 호출해 양쪽 뷰가 동일 필터 상태 공유.
  const filtering = useFiltering(conferences.rows);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'calendar'
  const [calendarScope, setCalendarScope] = useState('starred'); // 'starred' | 'filter'
  const [calendarSubView, setCalendarSubView] = useState('year'); // 'year' | 'month'

  const handleRequestUpdate = (row) => {
    if (!hasKey) {
      alert('API 키를 먼저 입력해주세요.');
      setKeyModalOpen(true);
      return;
    }
    updateQueue.enqueue([row]);
  };

  const handleRequestUpdateAll = (rows) => {
    if (!hasKey) {
      alert('API 키를 먼저 입력해주세요.');
      setKeyModalOpen(true);
      return;
    }
    const targets = filterSearchTargets(rows);
    const skipped = rows.length - targets.length;
    if (targets.length === 0) {
      alert(`업데이트 대상이 없습니다. (전체 ${rows.length}건 모두 최신 AI 정보 보유)`);
      return;
    }
    const ok = window.confirm(
      `전체 ${rows.length}건 중 ${targets.length}건이 업데이트 대상입니다.`
      + (skipped > 0 ? ` (${skipped}건은 pass)\n\n` : '\n\n')
      + `각 학회마다 Claude API 1회 호출이 발생합니다. 진행할까요?`
    );
    if (!ok) return;
    updateQueue.enqueue(targets, 'update');
    setUpdatePanelOpen(true);
  };

  const handleRequestVerifyAll = (rows) => {
    if (!hasKey) {
      alert('API 키를 먼저 입력해주세요.');
      setKeyModalOpen(true);
      return;
    }
    if (rows.length === 0) {
      alert('검증할 학회가 없습니다.');
      return;
    }
    const ok = window.confirm(
      `전체 ${rows.length}건의 학회 마스터 정보를 검증합니다.\n\n`
      + `각 학회마다 Claude API 1회 호출이 발생합니다. 진행할까요?`
    );
    if (!ok) return;
    updateQueue.enqueue(rows, 'verify');
    setUpdatePanelOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        hasKey={hasKey}
        onOpenKeyModal={() => setKeyModalOpen(true)}
        hasToken={hasToken}
        onOpenTokenModal={() => setTokenModalOpen(true)}
        syncStatus={conferences.syncStatus}
        lastSavedAt={conferences.lastSavedAt}
        onRetryCommit={conferences.retryCommit}
        pendingUpdateCount={updateQueue.totalRemaining}
        onOpenUpdatePanel={() => setUpdatePanelOpen(true)}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        calendarScope={calendarScope}
        onChangeCalendarScope={setCalendarScope}
      />
      <main className="p-4">
        {viewMode === 'table' ? (
          <MainTable
            isAdmin={hasKey}
            conferences={conferences}
            filtering={filtering}
            onRequestUpdate={hasKey ? handleRequestUpdate : undefined}
            onRequestUpdateAll={hasKey ? handleRequestUpdateAll : undefined}
            onRequestVerifyAll={hasKey ? handleRequestVerifyAll : undefined}
          />
        ) : (
          <CalendarView
            rows={conferences.rows}
            filtering={filtering}
            scope={calendarScope}
            subView={calendarSubView}
            onChangeSubView={setCalendarSubView}
          />
        )}
      </main>
      {isUpdatePanelOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-start justify-center z-40 p-4 overflow-y-auto"
          onClick={() => setUpdatePanelOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-5xl my-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <UpdatePanel queue={updateQueue} onBack={() => setUpdatePanelOpen(false)} />
          </div>
        </div>
      )}
      {isKeyModalOpen && (
        <ApiKeyModal
          currentKey={apiKey}
          onSave={(k) => { setApiKey(k); setKeyModalOpen(false); }}
          onClear={() => { clearApiKey(); setKeyModalOpen(false); }}
          onClose={() => setKeyModalOpen(false)}
        />
      )}
      {isTokenModalOpen && (
        <GitHubTokenModal
          currentToken={token}
          onSave={(t) => { setToken(t); setTokenModalOpen(false); }}
          onClear={() => { clearToken(); setTokenModalOpen(false); }}
          onClose={() => setTokenModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
