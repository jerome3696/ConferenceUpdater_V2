import MainTable from '../components/MainTable/MainTable';
import CalendarView from '../components/Calendar/CalendarView';

// PLAN-033: 기존 App.jsx 의 메인 뷰 (테이블/캘린더 토글) 를 페이지로 추출.
// 보조 모달 (UpdatePanel, GitHubToken, QuotaExhausted, UpdateMode) 은
// AppShell 에서 라우트 무관하게 렌더링.
export default function MainPage({
  isAuthenticated,
  conferences,
  filtering,
  viewMode,
  calendarScope,
  calendarSubView,
  onChangeCalendarSubView,
  onRequestUpdate,
  onRequestUpdateAll,
  onRequestVerifyAll,
}) {
  if (viewMode === 'calendar') {
    return (
      <CalendarView
        rows={conferences.rows}
        filtering={filtering}
        scope={calendarScope}
        subView={calendarSubView}
        onChangeSubView={onChangeCalendarSubView}
      />
    );
  }
  return (
    <MainTable
      isAdmin={isAuthenticated}
      conferences={conferences}
      filtering={filtering}
      onRequestUpdate={onRequestUpdate}
      onRequestUpdateAll={onRequestUpdateAll}
      onRequestVerifyAll={onRequestVerifyAll}
    />
  );
}
