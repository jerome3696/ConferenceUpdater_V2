# PLAN-033: react-router 도입 + 페이지 5개 분리

> **상태**: active
> **생성일**: 2026-05-03
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-033-react-router`
> **연관 PR**: #
> **트랙**: A(체계화) — Phase **A.3 후반** (`docs/blueprint-v2.md` §6)
> **의존**: PLAN-035 (admin), PLAN-030 (libraries) 와 **머지 순서 조율 필요** (라우터 먼저 가는 게 깔끔)

---

## 1. 목표 (What)

`react-router-dom` 도입 + 페이지 분할로 SPA 구조 정리. 완료 조건:
1. `/`, `/libraries`, `/db`, `/discovery`, `/settings`, `/admin`, `/login` 7개 URL 라우팅
2. App.jsx 의 모달 라우팅을 페이지 라우팅으로 교체 (Discovery 모달 → `/discovery` 페이지)
3. 헤더 사용자 메뉴를 드롭다운으로 (현재 평면 → 클릭 시 펼침)
4. admin role 만 `/admin` 메뉴 노출 + RouteGuard
5. 비로그인 시 `/login` 외 모든 URL 이 `/login` 으로 리다이렉트

## 2. 배경·동기 (Why)

- blueprint v2 §6 결정: 페이지 5개 추가 → 라우터 없으면 상태 카오스
- URL 공유 가능성 (학회 detail 링크 등) 부수 이득
- admin 대시보드 (PLAN-035) / 라이브러리 (PLAN-030) / 설정 페이지가 모달로 끼워 넣기엔 너무 큼

## 3. 범위 (Scope)

### 포함
- `react-router-dom` v6+ 의존성 추가
- `src/App.jsx` 를 라우터 컨테이너로 재구성
- 신규 페이지 컴포넌트 빈 껍데기 (실 구현은 각 PLAN):
  - `src/pages/MainPage.jsx` — 현 메인 테이블/캘린더
  - `src/pages/LibrariesPage.jsx` — 빈 placeholder
  - `src/pages/DBSearchPage.jsx` — 빈 placeholder
  - `src/pages/DiscoveryPage.jsx` — 기존 DiscoveryPanel 이관
  - `src/pages/SettingsPage.jsx` — 빈 placeholder
  - `src/pages/AdminPage.jsx` — 빈 placeholder, role guard
  - `src/pages/LoginPage.jsx` — 기존 LoginScreen 이관
- `src/components/common/UserMenu.jsx` — 헤더 드롭다운
- `src/components/common/RouteGuard.jsx` — auth + admin guard
- 기존 모달 (UpdatePanel, GitHubTokenModal, QuotaExhaustedModal) 은 각 페이지에 inline 유지

### 제외 (Non-goals)
- 각 페이지 실제 구현 — 각 PLAN
- 학회 detail URL (`/conferences/:id`) — Phase B

## 4. 설계 결정

### 4.1 BrowserRouter vs HashRouter
**선택**: `HashRouter` — GitHub Pages 의 base path 변경 시 BrowserRouter 는 404 처리 따로 (404.html SPA fallback) 필요. HashRouter 가 정적 호스팅 친화. 단점은 URL `#/foo` 가 보기 좀 못생김.

### 4.2 페이지 분할 vs 단일 페이지 토글
**선택**: 분할. 메인 (테이블/캘린더 토글) 은 그대로 1 페이지 안에 두 뷰 — 라우터로 관리하지 않음. 다른 5개는 분할.

### 4.3 모바일 대응
- blueprint v1.2 §1.2 그대로: PC 중심, 모바일 대상 아님. 라우터 도입해도 변경 없음.

## 5. 단계 (Steps)

- [ ] **S1** — `npm install react-router-dom` + 브랜치
- [ ] **S2** — `App.jsx` 를 라우터 + 7개 Route 로 재구성
- [ ] **S3** — `src/pages/` 디렉토리 + 7개 페이지 컴포넌트 (placeholder + 기존 컴포넌트 이관)
- [ ] **S4** — `RouteGuard` (auth/admin)
- [ ] **S5** — `UserMenu` 드롭다운 + 헤더 통합
- [ ] **S6** — Discovery 모달 → `/discovery` 페이지 이관
- [ ] **S7** — 기존 테스트 (App.test.jsx 등) 갱신
- [ ] **S8** — verify-task.sh 통과
- [ ] **S9** — PR

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] 기존 모든 기능 (메인 테이블, 캘린더, 발굴, GitHub commit, 쿼터 표시) 회귀 0
- [ ] 비로그인 시 모든 URL → `/login`
- [ ] non-admin 사용자가 `/admin` 직접 접근 시 `/` 리다이렉트
- [ ] 브라우저 뒤로가기·새로고침 정상 동작 (HashRouter)

## 7. 리스크·롤백

- **리스크**: App.jsx 가 핵심 모듈, 회귀 위험 큼 → 단계별 작은 커밋 + 기존 기능 회귀 테스트 필수
- **롤백**: feature branch revert

## 8. 후속

- 학회 detail URL (Phase B)
- 모바일 대응 (Phase C)

## 9. 작업 로그

- **2026-05-03**: blueprint v2 §6 기반 스펙 확정. PLAN-035/030 보다 라우터 먼저 머지 권장.
