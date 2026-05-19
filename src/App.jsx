import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import UpdatePanel from './components/UpdatePanel/UpdatePanel';
import UpdateModeModal from './components/UpdatePanel/UpdateModeModal';
import Header from './components/common/Header';
import GitHubTokenModal from './components/common/GitHubTokenModal';
import QuotaExhaustedModal from './components/common/QuotaExhaustedModal';
import RouteGuard from './components/common/RouteGuard';
import { useAuth } from './hooks/useAuth';
import { useOnboarding } from './hooks/useOnboarding';
import { useQuota } from './hooks/useQuota';
import { useGitHubToken } from './hooks/useGitHubToken';
import { useConferences } from './hooks/useConferences';
import { useUpdateQueue } from './hooks/useUpdateQueue';
import { useFiltering } from './hooks/useFiltering';
import { filterSearchTargets } from './services/updateLogic';

import MainPage from './pages/MainPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import LibrariesPage from './pages/LibrariesPage';
import DBSearchPage from './pages/DBSearchPage';
import DiscoveryPage from './pages/DiscoveryPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';

// PLAN-033: HashRouter 도입. GitHub Pages 의 base path 변경 시 BrowserRouter 는
// 404 처리(404.html SPA fallback) 가 필요. HashRouter 는 정적 호스팅 친화.
function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}

function AppShell() {
  const auth = useAuth();
  const onboarding = useOnboarding(auth.user?.id);
  const { token, setToken, clearToken, hasToken } = useGitHubToken();
  const { quota } = useQuota({ userId: auth.user?.id });
  const conferences = useConferences({ token, userId: auth.user?.id });
  const updateQueue = useUpdateQueue({
    applyAiUpdate: conferences.applyAiUpdate,
    applyLastDiscovery: conferences.applyLastDiscovery,
    applyVerifyUpdate: conferences.applyVerifyUpdate,
  });

  const filtering = useFiltering(conferences.rows);
  const [viewMode, setViewMode] = useState('table');
  const [calendarScope, setCalendarScope] = useState('starred');
  const [calendarSubView, setCalendarSubView] = useState('year');

  const [isTokenModalOpen, setTokenModalOpen] = useState(false);
  const [isUpdatePanelOpen, setUpdatePanelOpen] = useState(false);
  const [updateModeModal, setUpdateModeModal] = useState(null);
  const [quotaDetailKind, setQuotaDetailKind] = useState(null);

  const navigate = useNavigate();

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">로딩 중...</p>
      </div>
    );
  }

  const handleRequestUpdate = (row) => {
    updateQueue.enqueue([row]);
  };

  const handleRequestUpdateAll = (rows) => {
    setUpdateModeModal({ rows });
  };

  const handleConfirmUpdateMode = (mode) => {
    const rows = updateModeModal?.rows || [];
    setUpdateModeModal(null);
    const targets = filterSearchTargets(rows, mode);
    const skipped = rows.length - targets.length;
    if (targets.length === 0) {
      alert(`업데이트 대상이 없습니다. (전체 ${rows.length}건 모두 최신 AI 정보 보유)`);
      return;
    }
    const modeLabel = mode === 'precise' ? '정밀' : '일반';
    const ok = window.confirm(
      `[${modeLabel} 모드] 전체 ${rows.length}건 중 ${targets.length}건이 업데이트 대상입니다.`
      + (skipped > 0 ? ` (${skipped}건은 pass)\n\n` : '\n\n')
      + `각 학회마다 Claude API 1회 호출이 발생합니다. 진행할까요?`
    );
    if (!ok) return;
    updateQueue.enqueue(targets, 'update');
    setUpdatePanelOpen(true);
  };

  const handleRequestVerifyAll = (rows) => {
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

  // 비로그인: /login 외 모든 경로를 /login 으로.
  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  // PLAN-030 S4: 로그인했으나 라이브러리 미구독(온보딩 전)이면 라이브러리 선택 화면.
  if (onboarding.status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">로딩 중...</p>
      </div>
    );
  }
  if (onboarding.status === 'needed') {
    // PLAN-030: 온보딩 완료 시 학회 데이터 재로드 필수.
    // useConferences 는 구독 0건 상태(온보딩 전)에 로드됐으므로, 구독 게이팅 결과가
    // 빈 목록이다. 구독 직후 reload 해야 선택한 라이브러리 학회가 메인에 나타난다.
    return (
      <OnboardingPage
        userId={auth.user.id}
        onComplete={() => { onboarding.markDone(); conferences.reload(); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        isAuthenticated={auth.isAuthenticated}
        userEmail={auth.user?.email}
        onSignOut={auth.signOut}
        hasToken={hasToken}
        onOpenTokenModal={() => setTokenModalOpen(true)}
        syncStatus={conferences.syncStatus}
        lastSavedAt={conferences.lastSavedAt}
        onRetryCommit={conferences.retryCommit}
        pendingUpdateCount={updateQueue.totalRemaining}
        onOpenUpdatePanel={() => setUpdatePanelOpen(true)}
        onOpenDiscoveryPanel={() => navigate('/discovery')}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        calendarScope={calendarScope}
        onChangeCalendarScope={setCalendarScope}
        quota={quota}
        onShowQuotaDetail={setQuotaDetailKind}
      />
      <main className="p-4">
        <Routes>
          <Route element={<RouteGuard authenticated={auth.isAuthenticated} />}>
            <Route
              path="/"
              element={(
                <MainPage
                  isAuthenticated={auth.isAuthenticated}
                  conferences={conferences}
                  filtering={filtering}
                  viewMode={viewMode}
                  calendarScope={calendarScope}
                  calendarSubView={calendarSubView}
                  onChangeCalendarSubView={setCalendarSubView}
                  onRequestUpdate={handleRequestUpdate}
                  onRequestUpdateAll={handleRequestUpdateAll}
                  onRequestVerifyAll={handleRequestVerifyAll}
                />
              )}
            />
            <Route
              path="/discovery"
              element={(
                <DiscoveryPage
                  existingConferences={conferences.rows}
                  onAccept={conferences.addConferenceFromDiscovery}
                  onAbsorb={(matchedId) => conferences.updateStarred(matchedId, 1)}
                />
              )}
            />
            <Route
              path="/libraries"
              element={<LibrariesPage userId={auth.user.id} conferences={conferences} />}
            />
            <Route path="/db" element={<DBSearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
      {isTokenModalOpen && (
        <GitHubTokenModal
          currentToken={token}
          onSave={(t) => { setToken(t); setTokenModalOpen(false); }}
          onClear={() => { clearToken(); setTokenModalOpen(false); }}
          onClose={() => setTokenModalOpen(false)}
        />
      )}
      {updateModeModal && (
        <UpdateModeModal
          totalCount={updateModeModal.rows.length}
          onSelect={handleConfirmUpdateMode}
          onClose={() => setUpdateModeModal(null)}
        />
      )}
      {quotaDetailKind && (
        <QuotaExhaustedModal
          kind={quotaDetailKind}
          userId={auth.user?.id}
          onClose={() => setQuotaDetailKind(null)}
        />
      )}
    </div>
  );
}

export default App;
