import { useState } from 'react';
import MainTable from './components/MainTable/MainTable';
import UpdatePanel from './components/UpdatePanel/UpdatePanel';
import Header from './components/common/Header';
import ApiKeyModal from './components/common/ApiKeyModal';
import GitHubTokenModal from './components/common/GitHubTokenModal';
import { useApiKey } from './hooks/useApiKey';
import { useGitHubToken } from './hooks/useGitHubToken';
import { useConferences } from './hooks/useConferences';
import { useUpdateQueue } from './hooks/useUpdateQueue';
import { filterSearchTargets } from './services/updateLogic';

function App() {
  const { apiKey, setApiKey, clearApiKey, hasKey } = useApiKey();
  const { token, setToken, clearToken, hasToken } = useGitHubToken();
  const conferences = useConferences({ token });
  const updateQueue = useUpdateQueue({ apiKey, applyAiUpdate: conferences.applyAiUpdate });

  const [isKeyModalOpen, setKeyModalOpen] = useState(false);
  const [isTokenModalOpen, setTokenModalOpen] = useState(false);
  const [view, setView] = useState('main'); // 'main' | 'update'

  const handleRequestUpdate = (row) => {
    if (!hasKey) {
      alert('API 키를 먼저 입력해주세요.');
      setKeyModalOpen(true);
      return;
    }
    updateQueue.enqueue([row]);
    setView('update');
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
    updateQueue.enqueue(targets);
    setView('update');
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
        onOpenUpdatePanel={() => setView('update')}
        view={view}
      />
      <main className="p-4">
        {view === 'main' ? (
          <MainTable
            isAdmin={hasKey}
            conferences={conferences}
            onRequestUpdate={hasKey ? handleRequestUpdate : undefined}
            onRequestUpdateAll={hasKey ? handleRequestUpdateAll : undefined}
          />
        ) : (
          <UpdatePanel queue={updateQueue} onBack={() => setView('main')} />
        )}
      </main>
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        currentKey={apiKey}
        onSave={(k) => { setApiKey(k); setKeyModalOpen(false); }}
        onClear={() => { clearApiKey(); setKeyModalOpen(false); }}
        onClose={() => setKeyModalOpen(false)}
      />
      <GitHubTokenModal
        isOpen={isTokenModalOpen}
        currentToken={token}
        onSave={(t) => { setToken(t); setTokenModalOpen(false); }}
        onClear={() => { clearToken(); setTokenModalOpen(false); }}
        onClose={() => setTokenModalOpen(false)}
      />
    </div>
  );
}

export default App;
