# PLAN-009: 캘린더 뷰 (Track C.0 첫 기능)

> **상태**: completed
> **생성일**: 2026-04-18
> **완료일**: 2026-04-18
> **브랜치**: `feature/PLAN-009-calendar-view`
> **연관 PR**: #18, #19 (머지 d643382)
> **트랙**: C (제품화 확장)

---

## 1. 목표 (What)

MainTable과 동일 데이터를 캘린더 형태로 시각화한다. Header 우측의 "테이블 / 캘린더" 토글로 전환, 캘린더 내부 서브 토글로 **연간 타임라인 ↔ 월간 그리드** 전환. 기본 표시는 `starred=1` 학회, 옵션으로 "테이블 필터와 동기화"를 켜면 현재 useFiltering 결과를 따른다.

## 2. 배경·동기 (Why)

- Track A·B 완료 후 C.0(blueprint 갱신·1순위 기능 선정)에서 **후보 4개 중 캘린더 뷰를 1순위**로 확정.
- 이유: 공수 낮음, 서버 불요, UX 가시성 즉시 체감, 지금까지 활용처가 없던 `starred` 필드에 쓸 자리를 부여.
- blueprint.md §7.2는 "캘린더 뷰 | 학회 일정을 캘린더 형태로 시각화" 한 줄만 존재 — 이번 플랜이 구체 설계·구현 + 문서 역반영을 담당.

## 3. 범위 (Scope)

### 포함
- `src/hooks/useFiltering.js` — `starredOnly` 플래그 추가
- `src/App.jsx` — `useFiltering` 을 App 레벨로 리프팅. `viewMode: 'table'|'calendar'`, `calendarScope: 'starred'|'filter'`, `calendarSubView: 'year'|'month'` 상태
- `src/components/MainTable/MainTable.jsx` — 내부 `useFiltering` 호출 제거, `filtering` prop 수용
- `src/components/common/Header.jsx` — 테이블/캘린더 세그먼트 버튼, 캘린더 모드 시 "필터와 동기화" 체크박스
- `src/components/Calendar/CalendarView.jsx` (신규) — scope·subView 수신, 데이터 파생, 하위 뷰 렌더
- `src/components/Calendar/YearTimeline.jsx` (신규) — 12개월 가로축, 학회별 막대
- `src/components/Calendar/MonthGrid.jsx` (신규) — 7×N 그리드, 일자별 학회 칩
- `src/components/Calendar/calendarUtils.js` (신규) — 학회 에디션 범위 계산·월/연 이동
- 테스트: `useFiltering.test.js` (starredOnly 케이스), `calendarUtils.test.js`, `CalendarView.test.jsx`, `MainTable.test.jsx` (prop 전환에 따른 wrapper)
- `date-fns` 의존성 추가

### 제외 (Non-goals)
- 초록/논문 마감일 시각화 — 스키마 확장 선행 필요
- 캘린더 항목 클릭 시 편집 모달 연동 (향후)
- 외부 캘린더 export (iCal 등)
- 라우터 도입 — Track 후반 서버화와 함께 일괄 도입

## 4. 설계 결정

- **라이브러리**: `date-fns` + 자체 렌더. react-big-calendar/FullCalendar는 연간 지원 약함 + 번들 부담.
- **상태 리프팅**: `useFiltering` 을 App 으로 올려 MainTable·Calendar 양쪽이 동일 filter state 공유. "동기화" 체크박스가 자연스럽게 구현됨.
- **MainTable prop 전환**: 기존 내부 `useFiltering(rows)` 제거. filtering을 prop으로 받음. 테스트는 stateful wrapper로 감싸 기존 assertions 유지.
- **날짜 소스**: `row.upcoming.start_date/end_date` 만 사용 (useConferences 의 병합 결과). past/last 는 캘린더 기본 범위 밖.
- **연간 뷰**: 현재 연도 기본, 좌우 화살표 ±1년. 행당 1 학회. 월 경계는 date-fns로 계산.
- **월간 뷰**: 오늘 포함 월 기본, 좌우 화살표 ±1월. 각 날짜 셀에 해당일 열리는 학회 칩 최대 3개 + "+N".

## 5. 단계

- [ ] Step 1 — `useFiltering` starredOnly 플래그 + 테스트
- [ ] Step 2 — App.jsx 상태 리프팅 + viewMode/scope/subView
- [ ] Step 3 — MainTable filtering prop 전환 + 테스트 wrapper
- [ ] Step 4 — Header 뷰 토글·필터 동기화 체크박스
- [ ] Step 5 — calendarUtils + YearTimeline + MonthGrid + CalendarView
- [ ] Step 6 — 단위 테스트 (calendarUtils, CalendarView)
- [ ] Step 7 — `verify-task.sh` 5/0 + 수동 브라우저 확인
- [ ] Step 8 — blueprint.md §3 v1.0 구현 상태 마킹, §7 우선순위 숫자, design.md 캘린더 섹션, dev-guide-v2.md C.0 체크, CLAUDE.md 현재 상태, changelog

## 6. 검증

- `npm run test` — useFiltering/calendarUtils/CalendarView/MainTable 전건 통과
- `npm run dev` — 브라우저에서: 토글 전환, starred 기본/필터 동기화 on·off, 연/월 전환, 전/후 연·월 이동, 경계 걸친 학회, 기존 MainTable/UpdatePanel 회귀 없음
- `bash scripts/verify-task.sh` — 5/0

## 7. 리스크

- **중**: MainTable prop 전환으로 기존 테스트 회귀 가능 → 테스트를 stateful wrapper로 감싸 기존 assertion 유지하면 최소화.
- **저**: date-fns 번들 증가 (~20KB gzip) — tree-shaking 지원으로 실제 증가분은 사용 함수에 비례, 허용 범위.
- **저**: 월간 뷰의 여러 학회 겹침 UX — "+N" 요약으로 초기 공수 낮게 유지.
