# PLAN-001: 테스트 커버리지 확대 (Track B.1)

> **상태**: completed
> **생성일**: 2026-04-17
> **브랜치**: `feature/PLAN-001-test-coverage`
> **트랙**: B(품질)

---

## 1. 목표 (What)

컴포넌트·훅·서비스 레이어에 테스트를 추가해 핵심 로직의 회귀를 자동으로 감지할 수 있도록 한다.
완료 기준: `npm test` 전건 통과, MainTable 필터·정렬, useConferences 주요 함수, dataManager 3경로(로드/저장/GitHub) 커버.

## 2. 배경·동기 (Why)

Step A.3에서 순수 유틸(`responseParser`, `updateLogic`, `dateUtils`) 테스트를 완료했으나,
실제 핵심 로직인 컴포넌트 필터링·훅 상태 전환·서비스 I/O는 아직 무방비 상태.
dev-guide-v2.md Step B.1에서 이 레이어 추가를 명시.

## 3. 범위 (Scope)

### 포함
- `@testing-library/react` + `jsdom` 설치 및 vitest 환경 설정
- `src/components/MainTable/MainTable.test.jsx` — 렌더링, 필터(category/field/region/query), 정렬
- `src/hooks/useConferences.test.js` — 데이터 로드, 날짜 자동 전환, applyAiUpdate
- `src/services/dataManager.test.js` — 로드(GitHub/localStorage/공개JSON), 저장, GitHub 커밋 mock

### 제외 (Non-goals)
- ConferenceFormModal, FilterBar, githubStorage, claudeApi, useUpdateQueue 테스트 (후속 B.1 확장 또는 별도 플랜)
- E2E 테스트 (Track C 범위)
- 기존 40건 테스트 변경

## 4. 설계 결정

- **jsdom**: Vitest 브라우저 환경 시뮬레이션. `@vitest/browser` 대신 jsdom — CI에서 headless 실행 단순화.
- **vi.mock()로 모듈 경계 차단**: useConferences는 dataManager를, dataManager는 githubStorage를 mock. 실제 네트워크 없이 모든 경로 테스트.
- **MainTable 필터 로직**: 컴포넌트 내 useMemo이므로 렌더링 후 화면에 표시된 행 수로 검증.
- **useConferences debounce**: `vi.useFakeTimers()` + `vi.runAllTimersAsync()`로 10초 타이머 제어.

## 5. 단계 (Steps)

- [x] Step 1 — @testing-library/react, @testing-library/user-event, jsdom 설치 + vite.config.js test 환경 설정
- [x] Step 2 — `src/services/dataManager.test.js` 작성 (3경로 + 저장 + GitHub 커밋 mock)
- [x] Step 3 — `src/hooks/useConferences.test.js` 작성 (로드, 날짜 전환, applyAiUpdate)
- [x] Step 4 — `src/components/MainTable/MainTable.test.jsx` 작성 (렌더링, 필터, 정렬)
- [x] Step 5 — `bash scripts/verify-task.sh` 전건 통과 확인

## 6. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 통과
- [ ] `npm test` 신규 테스트 포함 전건 통과
- [ ] dataManager: GitHub 성공/실패/localStorage fallback 경로 커버
- [ ] useConferences: applyAiUpdate 후 rows에 반영 확인
- [ ] MainTable: 필터 4가지 + 정렬 토글 검증

## 7. 리스크·롤백

- jsdom 환경 설정이 기존 40건 테스트에 영향 줄 수 있음 → 기존 테스트 먼저 통과 확인 후 진행
- vite.config.js 수정 시 빌드 영향 없는지 `npm run build` 확인 필수

## 8. 후속 (Follow-ups)

- ConferenceFormModal, FilterBar 컴포넌트 테스트 (범위 확장)
- githubStorage, claudeApi 단위 테스트
- 커버리지 리포트 (`@vitest/coverage-v8`) 도입

## 9. 작업 로그

- 2026-04-17: 플랜 작성. @testing-library/react 미설치 확인, jsdom 환경 추가 필요.
