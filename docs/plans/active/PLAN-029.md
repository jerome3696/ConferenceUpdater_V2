# PLAN-029: 클라이언트 이관 — Supabase Auth + claude-proxy 호출

> **상태**: active (스펙 확정, 구현 대기 — Supabase 프로젝트 생성 이후 착수)
> **생성일**: 2026-04-22
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-029-client-migration` (PLAN-028 merge 이후 생성)
> **연관 PR**: #
> **트랙**: A(체계화) — Phase **A.2 클라이언트 이관** (`docs/roadmap.md` §3 A.2)
> **의존**:
> - `PLAN-028-api-proxy-mvp` — Edge Function·쿼터 RPC·DB 배포 선행
> - 사용자 수동: Supabase 프로젝트 생성 + env 배포 (`docs/supabase-deploy.md` §1~5)

---

## 1. 목표 (What)

브라우저 SPA 가 Anthropic API 를 **직접 호출하지 않고** `claude-proxy` Edge Function 만을 경유하도록 전환한다. 완료 조건:

1. `src/services/claudeApi.js` → 내부적으로 `claudeApiServer.js` (Edge Function 호출) 로 교체. 기존 public signature 유지 (`callClaude({prompt,system,webSearch,...})`) 로 호출부 수정 최소화.
2. Supabase Auth magic link 로그인 UI 추가 (`LoginScreen.jsx`).
3. 헤더 우측 쿼터 인디케이터 `[업데이트 X/10 · 발굴 Y/3]` (PLAN-P0-quota-policy §4.4).
4. 환경변수 키 입력 UI (설정 모달의 API key input) 제거.
5. 로그인 없는 상태에서는 데이터 조회만 가능, AI 호출은 차단.
6. `dataManager.js` 가 JSON 파일 대신 `conferences_upstream` + `user_conferences` 머지 결과를 읽도록 어댑터 교체.

## 2. 배경·동기 (Why)

- 현재 `claudeApi.js` 가 `anthropic-dangerous-direct-browser-access: true` 로 키를 브라우저에 노출. 30명 배포 시 키 누출 리스크.
- PLAN-028 완료 후 Edge Function 이 쿼터·로그·예산·캐시를 처리 → 클라이언트는 단순 POST 로 축소.
- `useConferences` / `UpdateCard` / `VerificationCard` / `DiscoveryPanel` 은 `callClaude` 응답 형상(`{content:[{type:'text',text:...}]}`)에 의존 → Edge Function 이 **원본 Anthropic response 를 그대로 반환**하면 호출부 수정 0 라인으로 가능 (signature 유지).
- `conferences.json` 파일 의존 제거 → 실시간 공용 DB 반영.

## 3. 범위 (Scope)

### 포함
- `src/services/supabaseClient.js` — 단일 인스턴스 export (anon key)
- `src/services/claudeApiServer.js` — Edge Function 호출 + JWT 부착 + `quota_after` 후처리
- `src/services/claudeApi.js` 교체 (기존 파일을 서버 래퍼로 재작성, export 동일)
- `src/services/dataManager.js` 어댑터 변경 — fetch JSON → Supabase client 조회 + merge
- `src/hooks/useAuth.js` — Supabase auth state subscription
- `src/hooks/useQuota.js` — `quotas` row 실시간 구독 (Realtime 옵셔널, 우선은 응답 후 갱신)
- `src/components/LoginScreen.jsx` + 라우팅 가드
- `src/components/QuotaBadge.jsx` + 헤더 통합
- 설정 모달에서 API key 입력 UI 제거
- 테스트 추가: `useAuth`, `claudeApiServer` mock 시나리오 3건 (정상·쿼터초과·예산초과)
- 기존 `claudeApi.test.js` 는 새 signature 로 갱신

### 제외 (Non-goals)
- Realtime subscriptions (Phase B — Quota 는 우선 응답 후 갱신)
- `conferences.json` 완전 삭제 (파일은 Phase A 동안 읽기 전용 백업으로 유지, Phase B 삭제)
- 분야 온보딩 UI (Phase B, PLAN-030)
- 공용값 수동 편집 UI (Phase B)
- 오프라인 모드 / 캐시 persistence — Phase B 이후
- OAuth 소셜 로그인 (PLAN-P0-auth-flow §3 제외 명시)

## 4. 설계 결정

### 4.1 signature 유지 → 호출부 수정 0
- `callClaude(opts)` 의 기존 인자 `{apiKey, prompt, system, webSearch, webFetch, maxTokens, maxWebSearches, model, signal}` 그대로 수용.
- 신규 변경: `apiKey` 인자 무시 + JWT 을 supabase client 세션에서 자동 부착.
- Edge Function 응답 `{response, cost_usd, quota_after}` 중 `response` 를 기존 동일 포맷으로 반환하여 `responseParser.js` 무수정.
- `ClaudeApiError` kind 매핑: `401` → `auth`, `429 quota_exceeded` → `rate_limit` (메시지 `quota_exceeded` 포함), `429 budget_cap` → `rate_limit` (메시지 `budget_cap`), `502` → `server`.

### 4.2 `dataManager.js` 어댑터 — JSON ↔ Supabase 공존
- 환경변수 `VITE_SUPABASE_URL` 존재 여부로 런타임 분기.
  - 있음: Supabase 읽기 (`conferences_upstream` + `editions_upstream` LEFT JOIN `user_conferences`)
  - 없음: 기존 `public/data/conferences.json` fetch (로컬 개발·fallback)
- merge 규칙: PLAN-P0-multitenant-schema §4.3 `mergeConference()` 순수 함수 재사용 (새 파일 `src/utils/mergeConference.js`).

### 4.3 로그인 게이트
- 앱 루트에 `useAuth()` — `session` 이 null 이면 `<LoginScreen />` 만 렌더.
- `<LoginScreen />` — 이메일 입력 → `supabase.auth.signInWithOtp({email})` → "메일함을 확인하세요" 안내.
- 링크 클릭 후 리디렉트 → Supabase 세션 복원 → 앱 진입.
- **조회 전용 모드**: 본 플랜 범위 밖 (Phase B 에서 공개 URL 결정).

### 4.4 쿼터 UI
- 헤더 우측: `<QuotaBadge used={..} limit={..} kind="update" />` × 2
- 색상 4단계 (PLAN-P0-quota-policy §4.4): 0-59% 회색 / 60-79% 노랑 / 80-99% 주황 / 100% 빨강
- 쿼터 값 소스: 앱 시작 시 `quotas` SELECT 1회 + 모든 `claudeApi` 호출 응답의 `quota_after` 로 즉시 덮어쓰기.
- 100% 도달 시 클릭 시 모달: 최근 5건 `api_usage_log` 목록 + 다음 달 1일 리셋 안내.

### 4.5 배포 후 롤백 계획
- `VITE_EDGE_FUNCTION_URL` env 를 비우면 런타임이 **레거시 `claudeApi.js` 직접 호출 로직** 으로 자동 폴백 (옵션 A). 또는 git revert (옵션 B).
- Phase A.2 완료 직후 파일럿 배포 → 이상 시 revert 우선 (레거시 폴백 로직은 Phase A 말 삭제).

## 5. 단계 (Steps)

- [ ] **S1** — `feature/PLAN-029-client-migration` 브랜치 생성 (PLAN-028 merge 후)
- [ ] **S2** — `src/services/supabaseClient.js` + `useAuth` + `LoginScreen`
- [ ] **S3** — `claudeApiServer.js` + `claudeApi.js` 교체 + 에러 매핑 테스트
- [ ] **S4** — `dataManager.js` 어댑터 분기 + `mergeConference.js` 추출·테스트
- [ ] **S5** — `QuotaBadge` + 헤더 통합 + 쿼터 소진 모달
- [ ] **S6** — 설정 모달 API key 입력 제거
- [ ] **S7** — `npm run test` 전 통과 · 브라우저 수동 검증 4 시나리오 (로그인·업데이트·쿼터소진·예산초과)
- [ ] **S8** — `bash scripts/verify-task.sh` 통과
- [ ] **S9** — commit 단위 atomic (S2→S6 순)
- [ ] **S10** — push + PR → 사용자 승인 후 merge → GitHub Pages 배포

## 6. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 통과
- [ ] `npm run test` 기존 364건 유지 + 신규 auth/quota/server 테스트 +10건 이상
- [ ] 브라우저 수동:
  - (a) 로그인 전: LoginScreen 만 표시, AI 호출 버튼 없음
  - (b) 로그인 후: 기존 UI 복원 + 쿼터 인디케이터 0/10
  - (c) update 1회 호출: 쿼터 1/10 즉시 갱신, `api_usage_log` 증가 (대시보드)
  - (d) 쿼터 소진 시나리오 (admin 계정 limit=2 로 임시 조정 후 3회 시도): 3번째가 429 + 소진 모달
- [ ] 배포 후 DevTools Network 에서 `api.anthropic.com` 직접 요청 0건 확인

## 7. 리스크·롤백

**리스크**:
- **Edge Function 응답 포맷 drift**: `response` 가 Anthropic 원본과 달라지면 `responseParser.js` 파싱 실패 → Edge Function 에서 변형 금지 (현재 index.ts §6 준수)
- **JWT 만료**: 토큰 만료 시 401 → `supabase.auth.refreshSession()` 자동 재시도 1회, 실패 시 로그인 재유도
- **env 미설정 배포**: `VITE_SUPABASE_URL` 없이 빌드 → 레거시 JSON 폴백 (의도) 또는 명시적 에러 배너 (결정 S2 에서 확정)

**롤백**:
- env 에서 `VITE_EDGE_FUNCTION_URL` 제거 → 자동 레거시 폴백 (Phase A 기간 한정)
- git revert of merge commit

## 8. 후속 (Follow-ups)

- **Phase B Realtime 구독**: `quotas` row change → `QuotaBadge` 즉시 갱신
- **Phase B 공개 URL**: 비로그인 사용자 조회 전용 모드 (subset read-only)
- **Phase B 분야 온보딩 UI**: PLAN-030
- **레거시 폴백 제거**: Phase A 말 (30명 전원 이관 확인 후)

## 9. 작업 로그

- **2026-04-22 (v1 스펙 확정)**: PLAN-028 과 병행 작성. 구현은 Supabase 프로젝트 생성·env 설정 후.
