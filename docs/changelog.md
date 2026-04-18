# CHANGELOG

ConferenceFinder의 변경 이력. [Keep a Changelog](https://keepachangelog.com/) 형식.

MVP 완성 시점(v1.0.0)을 기준으로 이후의 버그 수정·기능 변경·디자인 변경을 기록.
디자인 결정의 *이유*는 `docs/design.md`, 프롬프트 실행 이력은 `docs/prompteng.md` 참조.

---

## [Unreleased] — Post-MVP

### Added (PLAN-010, 2026-04-18)

**캘린더 scope UX 3-option 전환 + ICS 외부 내보내기**
- Header 캘린더 모드의 "테이블 필터와 동기화" 체크박스 → **3단 세그먼트 토글** (`전체` / `즐겨찾기` / `테이블필터`). `src/components/common/Header.jsx`의 `ScopeToggle` 컴포넌트 신규
- `calendarScope` 상태 타입 `'starred' | 'filter'` → `'all' | 'starred' | 'filter'`. `CalendarView` `sourceRows` 에 `'all'` 분기 추가
- **`src/utils/icsExport.js` 신규** — RFC 5545 iCalendar 생성 순수 함수
  - `buildIcs(rows, opts)`: VCALENDAR 헤더/푸터 + VEVENT(UID·DTSTAMP·DTSTART/DTEND·SUMMARY·LOCATION·URL·DESCRIPTION). all-day 이벤트는 DTEND 배타적(+1일) 규약 준수. 텍스트 필드는 RFC 5545 §3.3.11 이스케이프(`\ ; ,` / 개행 `\n`), 75옥텟 folding 적용
  - `toIcsFilename(scope)`: `conferencefinder_{scope}_YYYYMMDD.ics`
  - `downloadIcs(ics, filename)`: Blob + `<a download>` 트리거 (브라우저 전용 얇은 래퍼)
- CalendarView 우상단 "캘린더로 내보내기 (.ics)" 버튼 추가 — 현재 scope의 학회만 내보냄. 빈 결과는 disabled

**단위 테스트 +11**
- `icsExport.test.js` 10건: 헤더·푸터·PRODID / upcoming 없는 행 스킵 / DTEND 배타적 / end_date 미기재 1일짜리 / 특수문자 이스케이프 / UID 형식 / DTSTAMP UTC ZULU / LOCATION·URL·DESCRIPTION 포함 / calName 옵션 / 빈 rows
- `CalendarView.test.jsx` +2건: `scope=all` 전체 전달 / 다운로드 버튼 rows 유무에 따른 enable·disable

### Changed (PLAN-010)

- `docs/blueprint.md` §3.4: scope 2옵션 → 3옵션 설명으로 교체, 외부 캘린더 내보내기(ICS) 섹션 신규, **상업화 방향의 캘린더 통합 전략** 3계층 서술 (현재=다운로드 / 서버 후 메인=구독 URL / 보조=pre-filled URL). §7.2 우선순위 표에 1.5(ICS 다운로드 완료)·2.5(구독 URL — 서버 도입 이후) 행 추가
- `docs/design.md`: PLAN-010 로그 — scope 3옵션 배경, ICS 버튼 위치/톤, 순수 함수 분리 이유(서버 재사용)

### Added (PLAN-009, 2026-04-18)

**캘린더 뷰 — 연간 타임라인 + 월간 그리드** (Track C.0 1순위)
- `src/components/Calendar/` 신규: `CalendarView.jsx` (상위), `YearTimeline.jsx` (연간 12개월 가로축 + 학회 막대), `MonthGrid.jsx` (7열 달력), `calendarUtils.js` (학회 에디션의 연/월 경계 클립, 월 그리드 셀 계산, year/month shift)
- Header 우측에 "테이블 / 캘린더" 세그먼트 토글 버튼 + 캘린더 모드 시 "테이블 필터와 동기화" 체크박스
- 표시 대상 scope: 기본 `starred` (즐겨찾기), 토글로 `filter` (현재 useFiltering 결과) 전환
- 서브 뷰: 연간(기본) / 월간. 연 경계 걸친 학회 자동 클립, 월간 셀은 학회 칩 최대 3 + "+N" 축약
- `date-fns` 의존성 추가. react-big-calendar/FullCalendar 대신 자체 렌더 (연간 지원·번들 이점)

**useFiltering `starredOnly` 플래그**
- `src/hooks/useFiltering.js`: `starredOnly: boolean` 추가 (기본 false). `setFilters` 를 부분 머지로 변경 — 기존 FilterBar 계약({category, field, region, query})을 유지하면서 starredOnly 상태 보존

**App 상태 리프팅**
- `src/App.jsx`: `useFiltering` 을 App 레벨에서 호출해 MainTable·CalendarView 양쪽이 동일 filter state 공유. `viewMode`, `calendarScope`, `calendarSubView` 상태 신규
- `src/components/MainTable/MainTable.jsx`: `filtering` prop 수용 (`useFilteringFallback` 으로 미전달 시 내부 자체 호출, 기존 테스트 경로 보존)

**단위 테스트 +22**
- `calendarUtils.test.js` 14건 (연 경계 클립·월별 day map·그리드 leading 셀·year/month shift·윤년)
- `CalendarView.test.jsx` 4건 (scope 분기·subView 렌더·토글 콜백)
- `useFiltering.test.js` +3건 (starredOnly 통과 / 부분 머지 보존 / FilterBar 계약 유지)

### Changed (PLAN-009)

- `docs/blueprint.md` v1.2: §0 구현 상태 표기 가이드 신규, §3 각 기능에 상태 뱃지, §3.4 캘린더 뷰 섹션 신규, §4.1 페이지 구조에 뷰 토글 반영, §7.2 우선순위 컬럼·캘린더 뷰 ✅ 완료 반영
- `docs/dev-guide-v2.md` §5: Step C.0 체크박스 [x], Step C.1 (캘린더 뷰 완료) 추가, "예정 기능"을 §7.2 우선순위 기준으로 재정리

### Added (PLAN-006, 2026-04-18)

**프롬프트 v6 — Link–Confidence 상호구속 + Venue 포맷 + draft 연성화** (휴면)
- `UPDATE_SYSTEM_V6` 신규: [Link–Confidence 상호구속] / [Venue 포맷 — 엄격] / [Draft/초안 사이트 처리] 3개 섹션 추가. 3순위(주관기관 컨퍼런스 색인 페이지) 허용 범위 명료화
- [Venue 포맷]: US `City, State, USA` / Canada `City, Province, Canada` / 기타 `City, Country`. 국가명 정규화(`USA`/`UK`/`Korea` 고정)
- [Draft 사이트]: framer.ai/notion.site/wix.com 등 빌더 페이지를 link로 사용 허용, confidence=low 강제 + notes='draft/prototype' 마커
- [Link–Confidence]: confidence `high|medium` 이면 link non-null, link=null이면 confidence=low 강제. user 프롬프트 반환 직전 자기검증 체크리스트 동봉
- `buildUpdateUserV6`: v5 dedicated_url 힌트 유지 + 자기검증 체크리스트. `DEFAULT_UPDATE_VERSION='v4'` 유지 — v6 는 eval 측정 후 활성 전환 검토

**파서 `normalizeUpdateData` 안전망**
- `src/services/responseParser.js`: `BANNED_LINK_DOMAINS` 상수 export (프롬프트와 공유하는 단일 공급원: easychair/wikicfp/conferenceindex/allconferencealert/waset/iifiir) + `normalizeUpdateData(data)` export
- 백필 조건: `link==null && source_url 유효(금지 미매칭) && start_date 존재` → `link=source_url` + confidence 1단계 다운그레이드(high→medium→low) + notes 에 `[파서 백필: source_url → link]` 마커
- `parseUpdateResponse` 마지막 단계에서 자동 호출 — 호출부 변경 없음. v4 활성 상태에서도 `link=null` 오탐 일부 자동 보정

**단위 테스트 +21**
- `responseParser.test.js`: `BANNED_LINK_DOMAINS` 2건 + `normalizeUpdateData` 12건 (백필 성공·차단 분기 / confidence 다운그레이드 3분기 / parseUpdateResponse 통합)
- `promptBuilder.test.js`: v6 분기 7건 (Link–Confidence / Venue 포맷 / Draft / framer.ai 미등장 / 3순위 색인 / 자기검증 체크리스트 / dedicated_url 힌트)

### Changed (PLAN-006)

- `BANNED_LINK_DOMAINS` 에서 `framer.ai` 제거 — v2 등재가 단일 사례(conf_022) 과잉 일반화였음을 반영. draft 사이트는 `[Draft/초안 사이트 처리]` 섹션에서 조건부 허용으로 연성화
- v6 금지 리스트는 `BANNED_LINK_DOMAINS` 상수를 템플릿 리터럴로 주입 — 프롬프트·파서 단일 공급원

### Added (PLAN-005, 2026-04-18)

**Haiku→Sonnet 폴백 재시도**
- `useUpdateQueue`: 1차 Haiku 결과가 `parsed.ok && start_date == null` 이면 Sonnet 4.6 + `web_fetch` 로 1회 재호출 (maxTokens 2048). 2차 파싱 성공 시 결과 교체, 실패면 1차 유지. 카드에 `retry` 필드로 관찰성 확보
- `claudeApi.callClaude`: `webFetch: boolean` 파라미터 — true 시 `web_fetch_20250910` tool push (Haiku 비호환 — 호출부 책임)
- `src/config/models.js`: `MODELS.updateFallback = 'claude-sonnet-4-6'` 신규

**프롬프트 v5 + `dedicated_url` 힌트 (옵트인)**
- `conferences.json` conf_015 에 `dedicated_url: https://iccfd13.polimi.it` 기록
- `promptBuilder.buildUpdateUserV5`: `dedicated_url` 있을 때만 "회차 전용 사이트(힌트): …" + 사용 지침 1줄 주입. 필드 비면 v4와 동일
- `DEFAULT_UPDATE_VERSION='v4'` 유지 — v5 는 eval 측정 후 활성 전환 검토

**eval 3-tier 채점**
- `scripts/eval-prompt.js` `scoreUrl`: URL 매치 + `start_date` 있음 → pass / URL 매치 but `start_date=null` → **partial** / URL 불일치 → fail. 결과 JSON `summary.partial` 추가
- 배경: 이전 v3 "19/19 pass"는 URL 매칭만 확인하여 conf_006·conf_015 `start_date=null` 를 숨기고 있던 착시

### Changed (PLAN-005)

- `public/data/conferences.json` conf_006 `official_url`: `https://iifiir.org/en/iir-conferences-series` (v4 금지 도메인) → `https://www.cryogenics-conference.eu/`. 금지 도메인을 마스터 링크로 보관하던 모순 제거
- `docs/eval/golden-set.csv` conf_006 `source_url`/`verified_at` 동기화 (2026-04-18)

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
