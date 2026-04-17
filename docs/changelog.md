# CHANGELOG

ConferenceFinder의 변경 이력. [Keep a Changelog](https://keepachangelog.com/) 형식.

MVP 완성 시점(v1.0.0)을 기준으로 이후의 버그 수정·기능 변경·디자인 변경을 기록.
디자인 결정의 *이유*는 `docs/design.md`, 프롬프트 실행 이력은 `docs/prompteng.md` 참조.

---

## [Unreleased] — Post-MVP

### Changed (QA Batch 2 — PLAN-004, 2026-04-18)

- `.cell-text`에서 `overflow-wrap: anywhere` 폴백 제거 — 좁은 폭에서 '박람/회'·'아시/아' 재발 차단. 대신 분류·분야·지역 열에 `min-w-[4.5rem]`로 한글 3자 수용 보장
- LinkCell("열기") 담는 td 3곳(official_url/upcoming.link/last.link)에 `whitespace-nowrap` — '열/기' 절단 방지
- 이중 헤더 하위: "기간(일)" → 두 줄 "기간<br>(일)", "주기" → "주기(년)", 하위 헤더 정렬 `text-left` → `text-center`

### Removed (QA Batch 2 — PLAN-004)

- 메인 테이블 행별 '검증' 버튼 — 개별/전체의 프롬프트·모델·파서·적용 로직이 동일하고 직관성이 낮아 상단 '전체 검증'만 유지. 부분집합 검증은 필터 후 전체 검증으로 대체 (App.jsx `handleRequestVerify`, MainTable `onRequestVerify` prop 삭제)

### Added (Track B / QA Batch 1)

**프롬프트 v2~v4 (PLAN-002, 2026-04-17)**
- v2: today 앵커 + 도메인 블랙리스트 — pass 16/19 (84%)
- v3: today 앵커 정밀화 — pass 19/19 (100%), P4 완전 해소
- v4: 부분정보 처리 규칙 (confidence 기준 명시 + link 4순위 + 시리즈 null 강화) — 활성 전환 후 eval 결과 불만족, 추가 이터레이션 보류
- `src/utils/promptBuilder.js`에 v1·v2·v3·v4 공존, `DEFAULT_UPDATE_VERSION = 'v4'`

**테스트 커버리지 확대 (PLAN-001 / Step B.1, 2026-04-17)**
- MainTable 컴포넌트 / useConferences 훅 / dataManager 서비스 단위 테스트 73건
- 총 90건 (이전 17 + 신규 73), verify-task 5/5 통과

**QA Batch 1 — UI/UX 일괄 (PLAN-003, 2026-04-17)**
- UpdateCard: confidence badge(고/중/저 색상), source_url 링크, 변경없음·정보없음 한 줄 배너, 폰트·패딩 컴팩트화
- UpdatePanel: '전체 승인' / '전체 거절' 일괄 버튼
- 개별 업데이트 흐름: 메인 화면 유지 + UpdatePanel을 overlay로 띄움 (즉시 페이지 전환 제거)
- MainTable: 작업 버튼 → 첫 열(★ 앞), Last·참고 그룹 기본 접힘 + 토글, 출처 셀에 신뢰도 inline ("AI검색 (고/중/저)")
- 한글 word-break 교정 (`keep-all` + `overflow-wrap: anywhere`) — '박람/회'·'아시/아' 음절 절단 방지
- 학회명·메모 5줄 line-clamp + ellipsis
- `src/utils/locationFormatter.js` 신규 — US "City, State, USA" / 그 외 "City, Country"
- 지역 워딩 '세계' → '전세계' + 데이터 마이그레이션
- React 19 advisory 룰 3종(`react-hooks/set-state-in-effect`·`purity`·`react-refresh/only-export-components`) 24건 cleanup → `error` 등급 복귀

### Fixed

- 편집 모달 저장 시 `ai_search` source가 `user_input`으로 덮어써지던 버그 — Upcoming 필드 실제 변경 시에만 source 갱신 (PLAN-003 #13)

### Infrastructure (Track A)

- Husky pre-commit hook + lint-staged + secret pattern 차단
- Vitest 도입
- GitHub Actions CI (lint/test/build) + main 브랜치 보호
- `scripts/verify-task.sh` 5-gate 검증
- 브랜치 전략 (`feature/PLAN-xxx-*`, `fix/*`, `docs/*`, `chore/*`) + Conventional Commits
- 플랜 강제 hook (`scripts/check-plan.sh`) + post-merge auto-archive

---

## [1.0.0] — 2026-04-16 — MVP 완성

### Added

**Phase 1: 기반 구축 (읽기 전용 테이블)**
- React 18 + Vite + Tailwind CSS 프로젝트 초기화
- `public/data/conferences.json` 학회 21건 초기 데이터
- 메인 테이블 (이중 헤더: 마스터 / Upcoming / Last / 참고), 컬럼 정렬
- upcoming 시작일 기준 기본 정렬
- 분류 / 분야 / 지역 드롭다운 필터 + 학회명·약칭 텍스트 검색
- 종료일 지난 upcoming의 past 자동 전환
- GitHub Pages 배포 설정 (`.github/workflows/deploy.yml`)

**Phase 2: 관리 기능 (편집 + 데이터 관리)**
- API 키 입력 모달 + localStorage 저장 → 관리자/열람자 모드 분기
- 학회 추가 / 편집(인라인 + 모달) / 삭제(확인 대화상자)
- 중요도(별 0~3) 마킹, 메모 편집
- JSON / xlsx 내보내기
- GitHub PAT 기반 `conferences.json` 자동 커밋 (디바운스 10초) + 저장 상태 UI + 재시도

**Phase 3: AI 업데이트 (핵심 기능)**
- Claude API 직접 호출 (`anthropic-dangerous-direct-browser-access`), `ClaudeApiError` 클래스로 에러 kind 구분
- `web_search` 도구 연동 + `max_uses: 5` 토큰 캡 (rate limit 대응)
- 프롬프트 빌더 (`promptBuilder.js`, v1 버전) — 업데이트 / 검증용 프롬프트 분리
- 응답 파서 (`responseParser.js`) — `parseUpdateResponse`, `parseVerifyResponse`
- 개별 업데이트: 행별 버튼 → 페이지 2 이동 → 결과 카드 → 수용/리젝
- 전체 업데이트: pass 판단 로직 (`updateLogic.js`) + 순차 큐 + 진행률 + 중단 버튼
- 정합성 검증: 학회 기본 정보 필드별 일치/불일치/확인불가 뱃지 + 불일치 필드만 수정 제안
- AI 큐 (`useUpdateQueue.js`) — 업데이트/검증 공용, `kind` 분기
- 프롬프트 평가 러너 (`scripts/eval-prompt.js`) + 골든셋 17건 (`docs/eval/`)
- 실전 검증 4건(IIR GL / IHTC / ICCFD / ICBCHT) — 100% pass

**Phase 4: 마무리 및 배포**
- UI 폴리싱: 전체 검증 버튼 색상 통일 (indigo → blue), 모달 좁은 화면 대응 (`mx-4`), 메인 테이블 뷰포트 가로 스크롤 상시 노출 (`max-h-[calc(100vh-220px)]`)
- `docs/DESIGN.md` 최초 작성 — 디자인 결정 로그
- `README.md`, `docs/CHANGELOG.md` 최초 작성
- `docs/STRUCTURE.md` 최종 업데이트

### Infrastructure

- **Rate limit 대응 (Phase A)**: `web_search` `max_uses: 5` 캡 + `maxTokens` kind별 분기 (update=1024 / verify=1536). eval 17건 rate_limit 0건 달성.
- **프롬프트 v1 기준선**: eval pass 16/17 (94%). 잔존 실패는 v2 프롬프트 과제 (`docs/PROMPT_STRATEGY.md`).

### Known Issues

- 비공식/리스팅 도메인 선호 (ICCFD easychair, IIR GL iifiir.org) — v2 프롬프트 도메인 블랙리스트로 해결 예정 (MVP 후).
- Tier 1 rate limit: 단일 호출 avg 34,510 input tokens. 병렬 / 고빈도 상황에서 위험.
- Step 4.1 UI/UX 수정은 MVP 후 QA로 이관 (실전 4건에서 UX 문제 관찰되지 않음).

### Deferred to Post-MVP

- v2 프롬프트 (도메인 블랙리스트, today 앵커, 조기 종료, JSON-only, 임박 학회 공식사이트 추종)
- Flex 레이아웃 리팩토링 (MainTable magic number 제거)
- `ConfirmDialog` 컴포넌트화 (현재는 `window.confirm` 사용)
- Rate limit Phase B (응답 헤더 proactive 스로틀) — 필요 시
- Message Batches API + `web_search` 호환성 재조사
