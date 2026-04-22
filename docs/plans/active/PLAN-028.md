# PLAN-028-api-proxy-mvp: Supabase Edge Function 기반 API 프록시 MVP

> **상태**: active
> **생성일**: 2026-04-22
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-028-api-proxy-mvp`
> **연관 PR**: #
> **트랙**: A(체계화) — Phase **A.1 서버 MVP** (`docs/roadmap.md` §3 A.1)
> **의존** (모두 완료):
> - `PLAN-P0-multitenant-schema` §4.1 테이블·§4.2 RLS
> - `PLAN-P0-quota-policy` §4.3 원자적 차감·§4.5 예산 상한
> - `PLAN-P0-auth-flow` §4.1 Resend·§4.8 auth.users 트리거

---

## 1. 목표 (What)

A.0 에서 동결된 스키마·쿼터·인증·3채널 기여 설계를 **Supabase 프로젝트 + Edge Function 으로 실제로 이관**한다. 완료 조건:

1. Supabase 프로젝트에 6테이블 + RLS + 인덱스 적용
2. `claude-proxy` Edge Function 배포 — 로그인된 user 만 호출 가능, 쿼터 원자적 차감, Prompt Caching(cache_control) 활성, 공용 DB(`conferences_upstream`) TTL 선참조, 비용 `api_usage_log` 기록, 실패 시 보상 트랜잭션
3. `conferences.json` 32 conferences + 32 editions 이 DB 에 1회 마이그레이션됨 (idempotent)
4. 로컬 `curl` 통합 테스트 시나리오 3건 통과 (normal / quota exceeded / budget cap)

실제 브라우저 UI 이관은 PLAN-029 범위. 본 플랜은 **서버 측만**.

## 2. 배경·동기 (Why)

- `roadmap.md` §3 A.1: Phase A 첫 실집행 단계. A.0 5개 P0 플랜이 모두 merged → 이제 SQL·TypeScript 로 집행 가능.
- 현재 `src/services/claudeApi.js` 가 `x-api-key` 를 브라우저에서 직접 호출 → 파일럿 30명 배포 불가능 (키 노출).
- v1.1 정합 확정: viewer/editor 폐지 → user 단일 role → RLS 단순. 공용 쓰기는 Edge Function 독점.
- Prompt Caching 25% 절감·공용 DB TTL 선참조 30× 절감 → 월 $50 상한 내 안전마진 확보의 핵심.

## 3. 범위 (Scope)

### 포함
- `supabase/migrations/0001_initial_schema.sql` — 6테이블 + CHECK + FK + 인덱스 + RLS 정책 + trigger (`users` 자동 삽입, `quotas` 자동 생성)
- `supabase/functions/claude-proxy/index.ts` — 단일 Edge Function (update/discovery/verify 분기 포함)
- `supabase/functions/_shared/` — 쿼터 SQL wrapper, cost 계산, Anthropic client (Deno 호환)
- `scripts/migrate-json-to-supabase.mjs` — conferences.json → upstream 테이블 1회 이관
- `docs/supabase-deploy.md` — 사용자 수동 작업 체크리스트 (Supabase 프로젝트 생성·env 설정·함수 배포)
- `docs/roadmap.md`·`docs/dev-guide-v3.md` "현재 Phase" 갱신

### 제외 (Non-goals)
- 클라이언트(`src/`) 수정 — PLAN-029
- 관리자 대시보드 UI — Phase B
- Realtime 구독 — Phase B
- 분야 파라미터화·v2 프롬프트 — Phase B (PLAN-030)
- 공용 캐시 TTL 동적화 (주기 진행률 기반) — Phase B (PLAN-031)
- 결제·티어 — Phase C

## 4. 설계 결정

### 4.1 배포 모델 — Supabase CLI + GitHub Actions 수동 트리거 (Phase A)
- 개발: 로컬 `supabase start` + `supabase functions serve`
- 스테이지·프로덕션 분리 없음 (파일럿). 프로젝트 1개.
- CLI 인증·배포는 사용자 수동. 본 플랜에서는 스크립트·문서로 제공.
- 근거: 혼자 개발. Vercel·Netlify 같은 이중 인프라 추가 불요. Supabase CLI 가 secret·함수·DB 통합 관리.

### 4.2 Edge Function 단일 vs 분리 → **단일 `claude-proxy` + 내부 분기**
- 대안: `update-proxy`, `discovery-proxy`, `verify-proxy` 3개 함수
- 선택 근거: 공통 로직(auth 확인·쿼터 체크·로그 기록·보상) 이 80%. 분리 시 복붙 3회 → 버그 리스크. 본문 request body 의 `endpoint: 'update' | 'discovery_expand' | 'discovery_search' | 'verify'` 필드로 분기.
- 쿼터 카운터 매핑: update/verify → `update_used`, discovery_expand/discovery_search → `discovery_used`.

### 4.3 Prompt Caching 적용 지점 — system 프롬프트 + 대용량 컨텍스트
- Anthropic `cache_control: { type: 'ephemeral' }` 를 system 블록에 부착 → 시스템 프롬프트 재사용 시 25% 절감.
- `promptBuilder.js` 의 system 프롬프트는 고정 (v1_1 활성). Edge Function 가 server-side 에서 다시 조립.
- 단, `promptBuilder.js` 는 브라우저·Node 양쪽 호환 → Deno 호환도 필요. `docs/prompts/v1_1.md` raw text 를 Edge Function 이 `Deno.readTextFileSync` 로 로드 (PLAN-G.2 선행 시에만 가능 — 미선행이면 하드코딩된 export 유지).
- **현재 plan-028 구현 결정**: `promptBuilder.js` 를 ESM import 로 Edge Function 에서 그대로 사용(`esm.sh` 경유). Deno 는 ESM 네이티브. 조건: `src/utils/promptBuilder.js` 가 `window` · `process` 등 환경 의존 금지 (현재 조건 충족, CLAUDE.md 제약 명시).

### 4.4 공용 DB 선참조 TTL → **주기 진행률 기반 정적 규칙 (MVP)**
- 완전 동적 TTL 은 PLAN-031 (Phase B). MVP 는 다음 단순 규칙:
  - `conferences_upstream.last_ai_update_at` 이 **30일 이내** → 캐시 히트 (API 호출 skip)
  - 그 외 → API 호출 + 결과 upsert + `last_ai_update_at = now()`
- 쿼터 차감은 **캐시 히트 시 skip**. 히트율이 상승할수록 사용자는 쿼터가 덜 차감되는 UX → 공용 기여 인센티브.
- 근거: 30일 = 월 1회 업데이트 가정. 학회 정보 변동 주기(연 1~2회 공지) 보다 보수적.

### 4.5 비용 계산 공식 (hardcoded — Anthropic pricing 2026-04 기준)
```
input_usd  = input_tokens  * $3  / 1,000,000  (Sonnet 4)
output_usd = output_tokens * $15 / 1,000,000
cache_hit_usd = cache_hit_tokens * $0.3 / 1,000,000 (10% of input)
web_search_usd = web_searches * $0.01
cost_usd = input_usd + output_usd - cache_hit_usd * 0.75 + web_search_usd
```
- 응답 `usage.cache_read_input_tokens` 가 있으면 cache hit tokens 반영.
- Anthropic 가격 변경 시 본 파일 상수만 수정 + 로그 재계산 스크립트 제공(TODO-P0).

### 4.6 에러 처리 매트릭스

| 단계 | 실패 | 쿼터 차감 | 로그 기록 | 응답 |
|---|---|:-:|:-:|---|
| JWT 검증 | 401 | ❌ | ❌ | 401 `unauthorized` |
| 쿼터 차감 | 0 rows | ❌ | ✅ (status=quota_block) | 429 `quota_exceeded` |
| 예산 초과 | SUM > $50 | ❌ (차감 후 보상) | ✅ (status=quota_block) | 429 `budget_cap` |
| 캐시 히트 | 정상 | ❌ (skip) | ✅ (endpoint+cached) | 200 + `cached: true` |
| Anthropic 호출 | 네트워크·5xx | ✅ 보상 | ✅ (status=error) | 502 `upstream_error` |
| Anthropic 4xx | 400/401/429 | ✅ 보상 | ✅ (status=error) | 502 (키 문제는 운영자 알림) |
| 응답 파싱 | JSON 오류 | ✅ 보상 | ✅ (status=error) | 502 `parse_error` |

### 4.7 Supabase trigger 2개
- `on_auth_user_created` — `auth.users` INSERT 시 `public.users(id, email, role='user')` + `public.quotas(user_id, update_limit=10, discovery_limit=3)` 자동 생성
- `update_users_last_login` — `auth.users` UPDATE (last_sign_in_at) 시 `public.users.last_login_at` 갱신

## 5. 단계 (Steps)

- [x] **S1** — 브랜치 생성 `feature/PLAN-028-api-proxy-mvp`
- [x] **S2** — 본 플랜 문서 작성 (v1)
- [ ] **S3** — `supabase/migrations/0001_initial_schema.sql` 작성 (6 테이블 + RLS + trigger)
- [ ] **S4** — `supabase/functions/claude-proxy/index.ts` + `_shared/` 작성
- [ ] **S5** — `scripts/migrate-json-to-supabase.mjs` 작성 (dry-run + --commit)
- [ ] **S6** — `docs/supabase-deploy.md` 사용자 수동 작업 체크리스트
- [ ] **S7** — `docs/roadmap.md` §3 A.1 상태 갱신, `dev-guide-v3.md` 현재 Phase 갱신
- [ ] **S8** — `bash scripts/verify-task.sh` 통과 (src/ 수정 없으므로 lint/test/build 무영향 목표)
- [ ] **S9** — commit 단위 atomic (plan → migration → function → script → docs)
- [ ] **S10** — push + PR → 사용자 승인 후 merge

### 사용자 개입 필요 (PLAN-028 merge 이후)
- Supabase 프로젝트 생성 (대시보드)
- Project URL·anon key·service_role key 수취 → `.env.local`
- Resend 계정 생성 + API key → Supabase Dashboard > Auth > SMTP 설정
- Anthropic API key → Supabase secrets (`supabase secrets set ANTHROPIC_API_KEY=...`)
- `supabase db push` — migration 적용
- `node scripts/migrate-json-to-supabase.mjs --commit` — 데이터 마이그레이션
- `supabase functions deploy claude-proxy` — 함수 배포

이 단계는 `docs/supabase-deploy.md` 에 순서대로 명시.

## 6. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 통과 (src/ 무변경이므로 영향 0 목표)
- [ ] migration SQL 을 로컬 Supabase(`supabase start`) 에 apply 했을 때 에러 0
- [ ] 6 테이블 `\d` 출력이 PLAN-P0-multitenant-schema §4.1 컬럼과 100% 일치
- [ ] RLS 정책 수 = 매트릭스 표의 허용 셀 수와 일치
- [ ] Edge Function 로컬 serve 후 curl 테스트 3건:
  - (a) 정상 호출 → 200 + `quota_after` 필드 + `api_usage_log` 1건 삽입
  - (b) 쿼터 소진 직후 호출 → 429 + `quota_block` 로그
  - (c) 만료된 JWT → 401
- [ ] 마이그레이션 스크립트 dry-run 이 32 conferences + 32 editions 감지
- [ ] `--commit` 실행 후 `SELECT count(*) FROM conferences_upstream` = 32

## 7. 리스크·롤백

**리스크**:
- **Deno ESM 호환**: `promptBuilder.js` import 경로가 `esm.sh` 에서 실패 가능. → 대체: 함수 내부에 프롬프트 상수 직접 복사 (PLAN-G.2 후 통합).
- **마이그레이션 재실행 중복 키**: 이미 있는 conf_* 재삽입 시 오류. → `ON CONFLICT (id) DO UPDATE` idempotent 보장.
- **RLS 누락 → 데이터 노출**: 테스트 계정 2개로 cross-read POC 필수 (S4 이후 수동 검증).
- **비용 계산 drift**: Anthropic 가격 변동 시 누적 오차. → §4.5 상수 단일 파일 + 로그 재계산 스크립트 follow-up.

**롤백**:
- migration 롤백: `supabase/migrations/0002_rollback_0001.sql` 준비 (DROP TABLE CASCADE 6개)
- Edge Function 롤백: `supabase functions delete claude-proxy`
- 데이터 롤백: Supabase 대시보드 backup restore (Pro 플랜 기본)
- 본 브랜치 revert 로 코드 원복

## 8. 후속 (Follow-ups)

- **PLAN-029-client-migration**: `src/services/claudeApi.js` → `claudeApi.server.js` 로 분기, 로그인·쿼터 UI 추가
- **PLAN-030-field-onboarding-prompt-v2** (Phase B): 분야 파라미터화
- **PLAN-031-upstream-cache-dynamic-ttl** (Phase B): §4.4 정적 → 주기 진행률 동적
- **PLAN-G.2 선행 후 재방문**: `promptBuilder.js` 외부화 후 Edge Function 에서 공통 사용
- 비용 가격 변동 대응 재계산 스크립트

## 9. 작업 로그

- **2026-04-22 (v1)**: A.0 5개 P0 플랜 완료 직후 A.1 착수. 단일 Edge Function + 정적 TTL + Prompt Caching MVP 확정. 사용자 자리비움 동안 자율 실행(승인 받음).
