# PLAN-P0-multitenant-schema: Supabase 멀티테넌트 DB 스키마 설계

> **상태**: active
> **생성일**: 2026-04-21
> **완료일**: (설계 승인 시 갱신)
> **브랜치**: `feature/PLAN-P0-multitenant-schema-<slug>` (실제 작업 시)
> **연관 PR**: #
> **트랙**: A(체계화) — Phase A.0 준비기 (roadmap.md §3 A.0.2)

---

## 1. 목표 (What)

Supabase PostgreSQL 위에서 **30명+ 동시 사용자**가 공용 학회 DB를 공유하면서도 **개인 편집·즐겨찾기·API 쿼터**가 격리되는 스키마를 설계한다. RLS(Row Level Security) 정책까지 포함. 본 플랜은 **스키마·RLS 스펙까지**만 확정하고, 실제 `CREATE TABLE` 마이그레이션은 후속 PLAN-028(API MVP)에서 실행.

## 2. 배경·동기 (Why)

- `PLAN-026` Supabase 채택 → PostgreSQL + 네이티브 RLS 전제
- 현재 `public/data/conferences.json` 단일 구조는 멀티테넌트·편집권한·쿼터 개념이 없음
- `roadmap.md` §6.3: `conferences_upstream`(공용 ground truth) ⊥ `user_conferences`(개인 편집) 분리 필요
- API 비용 공유·절감(§7: 공용 결과 캐시 채택)을 위해 **"30명×같은 학회 = 30× 낭비"** 방지 구조 필수

## 3. 범위 (Scope)

### 포함
- 5개 테이블 스키마: `users`, `conferences_upstream`, `user_conferences`, `api_usage_log`, `quotas`
- 각 테이블의 컬럼·타입·인덱스·외래키
- RLS 정책 (읽기/쓰기 격리 규칙)
- 공용값 ↔ 개인 override 레이어 merge 규칙
- 기존 `conferences.json` → DB 마이그레이션 전략 (1회성)
- TypeScript 타입 생성 명령 (`supabase gen types`)

### 제외 (Non-goals)
- 실제 `CREATE TABLE` SQL 작성·적용 (PLAN-028)
- 프론트 `dataManager.js` 어댑터 구현 (PLAN-029)
- 결제·구독 테이블 (Phase C 범위)
- Realtime 구독 설정 (Phase B 이후)
- 백업·복구 정책 (Supabase Pro 기본값으로 우선 진행)

## 4. 설계 결정 (확정 필요 항목)

### 4.1 테이블 구조 — 스케치 (검토·승인 대상)

**`users`** — Supabase `auth.users` 확장
- `id` (uuid, FK → auth.users)
- `email` (text)
- `role` (enum: 'viewer'|'editor'|'admin', default 'viewer')
- `created_at`, `last_login_at`

**`conferences_upstream`** — 공용 ground truth (기존 `conferences.json` 치환)
- `id` (text, 기존 "conf_001" 포맷 유지)
- 기존 conference 필드 + editions 임베딩 or 별도 `editions_upstream` 분리?
- `last_ai_update_at`, `last_editor_id` (감사 로그)

**`user_conferences`** — 개인 레이어
- `user_id` + `conference_id` (복합 PK)
- `starred` (0|1)
- `personal_note`
- `overrides` (jsonb) — 공용값 덮어쓸 때만 기록 (sparse)

**`api_usage_log`**
- `id`, `user_id`, `timestamp`, `endpoint`, `input_tokens`, `output_tokens`, `cost_usd`, `cache_hit` (bool), `conference_id` (nullable)

**`quotas`** — 사용자별 현재 사용량
- `user_id` (PK), `period_start`, `used_count`, `limit_count`

### 4.2 RLS 정책 결정 포인트
- `conferences_upstream`: 모든 로그인 유저 SELECT, editor+ INSERT/UPDATE/DELETE
- `user_conferences`: 본인 row만 CRUD (`user_id = auth.uid()`)
- `api_usage_log`: 본인 row SELECT, 서버만 INSERT (`service_role` key)
- `quotas`: 본인 row SELECT, 서버만 UPDATE (원자성 보장)

### 4.3 공용 ↔ 개인 merge 규칙
- 프론트 read 시: `conferences_upstream LEFT JOIN user_conferences ON user_id = $me`
- override 필드 sparse merge → 빈 필드는 공용값 사용
- 쓰기: 공용값 편집 권한 있을 때만 upstream 수정, 아니면 개인 layer에 override 기록

### 4.4 대안 검토 (결정 필요)
- editions를 `conferences_upstream`의 jsonb로 임베딩 vs 별도 `editions_upstream` 테이블
- starred·note를 `user_conferences` 단일 테이블에 묶을지, 분리할지
- 공용값 편집 권한: 'editor' role 필요 vs 누구나 가능 (admin 승인 필요?)

## 5. 단계 (Steps)

- [ ] Step 1 — 4.1 테이블 구조 1차 draft (ER 다이어그램 + SQL 의사코드)
- [ ] Step 2 — 4.2 RLS 정책 표 완성 (각 테이블 × 각 action × role)
- [ ] Step 3 — 4.3 merge 규칙 프론트 의사코드 (`dataManager.getConferencesForUser()` 시그니처)
- [ ] Step 4 — 4.4 대안 3건 각각 결정 + 근거 기록
- [ ] Step 5 — 기존 `conferences.json` → upstream 마이그레이션 SQL 스크립트 (1회성)
- [ ] Step 6 — 사용자 승인 → completed/ 이동

## 6. 검증 (Verification)

- [ ] 5개 테이블 모두 CRUD 시나리오별 RLS가 명시됨 (표 형식)
- [ ] 공용값·개인 override 충돌 시나리오 3개 이상 검증 (write-write, stale read, delete 전파)
- [ ] 30명 동시 API 호출 시 `quotas.used_count` 원자성 보장 확인 (UPDATE ... RETURNING 패턴)
- [ ] `api_usage_log` 집계 쿼리 (`SELECT user_id, SUM(cost_usd) GROUP BY period`) 성능 예측
- [ ] `bash scripts/verify-task.sh` 통과 (문서만)

## 7. 리스크·롤백

**리스크**:
- **RLS 실수**: 정책 하나 빠지면 다른 사용자 데이터 노출. → Step 2에서 **표 100% 채움** + Step 5 전에 Supabase 테스트 계정 2개로 cross-read 시도 POC
- **override 레이어 복잡도**: sparse merge는 프론트 로직 복잡. → 대안으로 전체 복사 후 모든 필드 저장 방식 검토
- **마이그레이션 실패**: 기존 32개 학회 누락·중복. → Step 5 스크립트 idempotent + dry-run 모드 필수

**롤백**:
- 본 플랜은 설계 레코드 — 롤백은 §4 재작성으로 처리
- 후속 PLAN-028에서 CREATE TABLE 적용 후 문제 발견 시 Supabase migration revert

## 8. 후속 (Follow-ups)

- **PLAN-028-api-proxy-mvp**: 본 스키마 기반 실제 `CREATE TABLE` + Edge Function 프록시
- **PLAN-029-client-migration**: `dataManager.js` Supabase 어댑터 교체
- **PLAN-P0-quota-policy**: `quotas` 테이블 세부 정책 (본 플랜과 상호 참조)
- Realtime 구독 (`conferences_upstream` 변경 브로드캐스트) — Phase B 이후

## 9. 작업 로그

- **2026-04-21**: 스켈레톤 생성. PLAN-026 승인 직후 후속 3건 중 하나로 분기. 구조는 roadmap.md §6.3 기반, 세부 결정 보류 상태.
