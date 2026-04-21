# PLAN-P0-multitenant-schema: Supabase 멀티테넌트 DB 스키마 설계

> **상태**: active (v1 설계 본문 작성 중)
> **생성일**: 2026-04-21
> **완료일**: (설계 승인 시 갱신)
> **브랜치**: `feature/PLAN-P0-multitenant-schema-v1`
> **연관 PR**: #
> **트랙**: A(체계화) — Phase A.0 준비기 (`docs/roadmap.md` §3 A.0.2)

---

## 1. 목표 (What)

Supabase PostgreSQL 위에서 **30명+ 동시 사용자**가 공용 학회 DB를 공유하면서도 **개인 편집·즐겨찾기·API 쿼터**가 격리되는 스키마를 확정한다. RLS(Row Level Security) 정책·개인 override 머지 규칙·`conferences.json` → DB 1회성 마이그레이션 전략까지 본 플랜에서 설계 단계로 동결. 실제 `CREATE TABLE` 은 `PLAN-028-api-proxy-mvp` 에서 실행.

## 2. 배경·동기 (Why)

- `PLAN-026` Supabase 채택 → PostgreSQL + 네이티브 RLS 전제
- 현재 `public/data/conferences.json` (32 conferences + 32 editions) 단일 구조는 멀티테넌트·편집권한·쿼터 개념이 없음
- `roadmap.md` §6.3: `conferences_upstream`(공용 ground truth) ⊥ `user_conferences`(개인 편집) 분리 필요
- API 비용 공유·절감(§7: 공용 결과 캐시 채택) 위해 **"30명×같은 학회 = 30× 낭비"** 방지 구조 필수
- Phase A 쿼터(10 update + 3 discovery / 사용자 / 월) 를 원자적으로 추적할 별도 테이블 필요

## 3. 범위 (Scope)

### 포함
- 6개 테이블 스키마 (컬럼·타입·인덱스·FK): `users`, `conferences_upstream`, `editions_upstream`, `user_conferences`, `api_usage_log`, `quotas`
- RLS 정책 매트릭스 (테이블 × action × role)
- 공용값 ↔ 개인 override 레이어 merge 규칙 + 프론트 의사코드
- 기존 `conferences.json` → DB 마이그레이션 전략 (idempotent, dry-run 가능)
- TypeScript 타입 생성 명령 (`supabase gen types`)

### 제외 (Non-goals)
- 실제 `CREATE TABLE` SQL 작성·적용 (PLAN-028)
- 프론트 `dataManager.js` 어댑터 구현 (PLAN-029)
- 결제·구독 테이블 (Phase C)
- Realtime 구독 설정 (Phase B 이후)
- 백업·복구 정책 (Supabase Pro 기본값 채택)
- RLS 위반 감지 로깅 (Phase B.3 어뷰즈 감지에서 포함)

## 4. 설계 (확정안 + 근거)

### 4.0 ER 다이어그램

```mermaid
erDiagram
  auth_users ||--|| users : "extends"
  users ||--o{ user_conferences : "owns"
  users ||--o{ api_usage_log : "emits"
  users ||--|| quotas : "has"
  conferences_upstream ||--o{ editions_upstream : "has"
  conferences_upstream ||--o{ user_conferences : "referenced by"
  conferences_upstream ||--o{ api_usage_log : "targets"

  users {
    uuid id PK
    text email
    text role
    timestamptz last_login_at
  }
  conferences_upstream {
    text id PK
    text full_name
    smallint cycle_years
    uuid last_editor_id FK
  }
  editions_upstream {
    text id PK
    text conference_id FK
    date start_date
    text source
  }
  user_conferences {
    uuid user_id PK_FK
    text conference_id PK_FK
    smallint starred
    jsonb overrides
  }
  api_usage_log {
    bigserial id PK
    uuid user_id FK
    timestamptz ts
    text endpoint
    numeric cost_usd
  }
  quotas {
    uuid user_id PK_FK
    date period_start
    smallint update_used
    smallint discovery_used
  }
```

### 4.1 테이블 스키마

**4.1.1 `users`** — Supabase `auth.users` 1:1 확장

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | uuid | PK, FK → auth.users.id ON DELETE CASCADE | |
| `email` | text | NOT NULL, UNIQUE | `auth.users.email` 미러 (조회 편의) |
| `role` | text | NOT NULL, CHECK (role IN ('user','admin')), DEFAULT 'user' | 권한 — v1.1 정합: viewer/editor 분리 폐지, 모든 user 공용 DB 기여 가능 |
| `display_name` | text | NULL | UI 표시명 |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `last_login_at` | timestamptz | NULL | Auth trigger 로 갱신 |

**4.1.2 `conferences_upstream`** — 공용 ground truth

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | text | PK | 기존 "conf_001" 포맷 유지 → 마이그레이션 무손실 |
| `category` | text | NOT NULL, CHECK IN ('학회','박람회') | |
| `field` | text | NOT NULL | 도메인 |
| `abbreviation` | text | NULL | |
| `full_name` | text | NOT NULL | |
| `cycle_years` | smallint | NOT NULL, CHECK (cycle_years >= 0) | 0 = 비정기 |
| `duration_days` | smallint | NOT NULL, CHECK (duration_days >= 0) | |
| `region` | text | NULL | |
| `official_url` | text | NULL | |
| `note` | text | NULL | |
| `organizer` | text | NULL | 011-D 발굴 메타 |
| `found_at` | timestamptz | NULL | 발굴 시각 |
| `last_ai_update_at` | timestamptz | NULL | 마지막 AI 업데이트 |
| `last_editor_id` | uuid | NULL, FK → users.id ON DELETE SET NULL | 최근 수동 편집자 |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | 트리거로 자동 갱신 |

인덱스: `(field)`, `(last_ai_update_at)` — 필터·최신순 정렬에 사용.

**4.1.3 `editions_upstream`** — 공용 (editions 는 별도 테이블, §4.4.1 결정 참고)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | text | PK | "ed_001" 포맷 유지 |
| `conference_id` | text | NOT NULL, FK → conferences_upstream.id ON DELETE CASCADE | |
| `status` | text | NOT NULL, CHECK IN ('upcoming','past','unknown') | |
| `start_date` | date | NULL | |
| `end_date` | date | NULL | |
| `venue` | text | NULL | |
| `link` | text | NULL | |
| `source` | text | NOT NULL, CHECK IN ('ai_search','user_input','backfill','initial_import') | |
| `confidence` | text | NULL, CHECK IN ('high','medium','low') | AI 결과 신뢰도 |
| `notes` | text | NULL | 근거·참고 |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

인덱스: `(conference_id, status)`, `(start_date)`.

**4.1.4 `user_conferences`** — 개인 레이어 (sparse)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `user_id` | uuid | FK → users.id ON DELETE CASCADE | |
| `conference_id` | text | FK → conferences_upstream.id ON DELETE CASCADE | |
| `starred` | smallint | NOT NULL, DEFAULT 0, CHECK IN (0,1) | 즐겨찾기 |
| `personal_note` | text | NULL | |
| `overrides` | jsonb | NOT NULL, DEFAULT '{}' | 공용값 덮어쓸 때만 기록 (sparse) |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |
| PK | `(user_id, conference_id)` | | 복합 PK |

인덱스: `(user_id, starred) WHERE starred = 1` — 즐겨찾기 빠른 조회.

**4.1.5 `api_usage_log`** — 호출 이력 (append-only)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | bigserial | PK | |
| `user_id` | uuid | NOT NULL, FK → users.id ON DELETE CASCADE | |
| `ts` | timestamptz | NOT NULL, DEFAULT now() | |
| `endpoint` | text | NOT NULL, CHECK IN ('update','discovery_expand','discovery_search','verify') | |
| `conference_id` | text | NULL, FK → conferences_upstream.id ON DELETE SET NULL | update·verify 시 대상 |
| `input_tokens` | int | NOT NULL, DEFAULT 0 | |
| `output_tokens` | int | NOT NULL, DEFAULT 0 | |
| `web_searches` | int | NOT NULL, DEFAULT 0 | |
| `cache_hit_tokens` | int | NOT NULL, DEFAULT 0 | Prompt Caching 절감분 |
| `cost_usd` | numeric(10,6) | NOT NULL, DEFAULT 0 | 서버가 호출 직후 계산 |
| `status` | text | NOT NULL, CHECK IN ('success','error','quota_block') | |

인덱스: `(user_id, ts DESC)`, `(ts)` (전체 집계), `(user_id, endpoint, date_trunc('month', ts))` (쿼터 계산).

**4.1.6 `quotas`** — 사용자별 현재 주기 사용량

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `user_id` | uuid | PK, FK → users.id ON DELETE CASCADE | |
| `period_start` | date | NOT NULL | 이번 주기 시작 (월초 기준, §4.5 참고) |
| `update_used` | smallint | NOT NULL, DEFAULT 0 | |
| `update_limit` | smallint | NOT NULL, DEFAULT 10 | Phase A 기본값 |
| `discovery_used` | smallint | NOT NULL, DEFAULT 0 | |
| `discovery_limit` | smallint | NOT NULL, DEFAULT 3 | Phase A 기본값 |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

원자성 패턴: `UPDATE quotas SET update_used = update_used + 1 WHERE user_id = $1 AND update_used < update_limit RETURNING *`. 실패 시 쿼터 초과.

### 4.2 RLS 정책 매트릭스

표기: ✅ 허용, ❌ 거부, 🔧 서버(service_role)만, 🧪 조건부(본인 row 한정 `user_id = auth.uid()`).

**v1.1 정합**: role 2단계 (user·admin) — 모든 인증된 user 가 공용 DB 기여 가능. Edge Function 이 감사 로그 기록 후 service_role 로 upstream 쓰기 수행(RLS 우회). 클라이언트 직접 UPDATE 는 금지하여 감사 누락 방지.

| 테이블 | user SELECT | user INSERT | user UPDATE | user DELETE | admin 추가 |
|---|:-:|:-:|:-:|:-:|---|
| `users` | 🧪 본인 | ❌ (Auth trigger) | 🧪 본인 (role 제외) | ❌ | 모든 row SELECT + role UPDATE |
| `conferences_upstream` | ✅ 모두 | 🔧 서버(Edge Function) | 🔧 서버(Edge Function) | ❌ | DELETE + 직접 UPDATE |
| `editions_upstream` | ✅ 모두 | 🔧 서버(Edge Function) | 🔧 서버(Edge Function) | ❌ | DELETE + 직접 UPDATE |
| `user_conferences` | 🧪 본인 | 🧪 본인 | 🧪 본인 | 🧪 본인 | 전체 SELECT (지원용) |
| `api_usage_log` | 🧪 본인 | 🔧 서버만 | ❌ | ❌ | 전체 SELECT |
| `quotas` | 🧪 본인 | 🔧 서버만 | 🔧 서버만 | ❌ | 전체 SELECT + limit UPDATE |

정책 SQL 의사코드 (대표):
```sql
-- user_conferences 본인 row 만 CRUD
CREATE POLICY uc_self ON user_conferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- conferences_upstream 읽기 전원, 쓰기는 Edge Function (service_role) 독점
CREATE POLICY cu_read  ON conferences_upstream FOR SELECT USING (true);
-- INSERT/UPDATE 정책 없음 → service_role 만 통과. admin 은 DB 직접 수정 필요 시 service_role key 사용.

-- quotas 는 서버만 (service_role bypass RLS, client 는 SELECT 만)
CREATE POLICY q_self_read ON quotas FOR SELECT USING (user_id = auth.uid());
-- UPDATE/INSERT 는 RLS 로 막고, Edge Function 이 service_role 로 수행.
```

**왜 Edge Function 독점인가**: 직접 RLS 로 user 쓰기 허용 시 감사 로그 기록 누락 가능. Edge Function 이 한 트랜잭션에서 `INSERT INTO api_usage_log + UPSERT INTO conferences_upstream` 을 묶어 처리 → 모든 공용 변경이 추적됨 (Phase B flag 시스템·Phase C 평판 모델의 전제).

### 4.3 공용 ↔ 개인 override 머지 규칙

**Read (학회 목록 조회)**:
```
SELECT
  c.*,
  uc.starred,
  uc.personal_note,
  uc.overrides
FROM conferences_upstream c
LEFT JOIN user_conferences uc
  ON uc.conference_id = c.id AND uc.user_id = auth.uid()
```

프론트 merge (의사코드):
```js
function mergeConference(upstream, userLayer) {
  const overrides = userLayer?.overrides ?? {};
  // sparse merge: override 에 명시된 키만 덮어씀
  return {
    ...upstream,
    ...overrides,
    starred: userLayer?.starred ?? 0,
    personal_note: userLayer?.personal_note ?? '',
  };
}
```

**Write 정책** (v1.1 정합: 3채널 기여 모델):
- **starred / personal_note / overrides 편집** → `user_conferences` upsert (본인 RLS, 권한 불요)
- **공용 필드 편집** (cycle_years·full_name·회차 등) → 3채널 모두 **Edge Function 경유**:
  1. **운영자 큐레이션 시드** (admin, 마이그레이션 스크립트): `conferences_upstream` / `editions_upstream` 직접 upsert
  2. **AI 자동 검색 결과** (user·admin 공통): Edge Function 이 TTL 선참조 후 호출 → 결과를 `conferences_upstream` 에 저장 + `api_usage_log` 기록
  3. **수동 입력** (user·admin): Edge Function `POST /api/conference` → 입력값 검증 + `conferences_upstream` upsert + `edit_log` 기록 (append-only 감사 로그)
- **개인 override 레이어** (`user_conferences.overrides`): "나만 이 값이 다르게 보여야 함" 선언. 공용 수정과는 별개의 UX. 기본은 upstream 따라감.
- **충돌 해결 원칙**: overrides 는 항상 upstream 을 덮어씀. upstream 값이 override 와 같아지면 프론트에서 해당 override 키 삭제 권장 (stale cleanup).
- **감사 로그 (신규)**: 모든 공용 쓰기는 `api_usage_log` (AI 호출) 또는 `edit_log` (수동 입력) 에 user_id·대상·diff 기록. Phase B flag·Phase C 평판 모델의 데이터 기반.

### 4.4 대안 결정 (3건)

**4.4.1 editions: 임베딩 vs 별도 테이블 → 별도 테이블 `editions_upstream`**
- 근거: 현재 conferences.json 이 이미 별도 배열 → 1:1 이관 단순. JSON 임베딩은 edition 단일 업데이트 시 전체 row 재작성 비용. 쿼리(`WHERE status='upcoming' AND start_date BETWEEN ...`) 최적화 한계. Phase B 에서 edition 이력 축적 시 인덱스 활용 필수.

**4.4.2 starred·note 테이블: 단일 vs 분리 → 단일 `user_conferences`**
- 근거: 개인 레이어 자체가 희소(30명 × 32학회 = 최대 960 row, 실제론 ⅓ 수준). 분리 시 starred-only row / note-only row 를 각각 upsert → 조인 2배. 단일 테이블 + 기본값 0/''/'{}' 가 단순. starred 만 변경 시에도 row 하나.

**4.4.3 공용값 편집 권한: v1.1 — role 2단계 (user·admin), 모든 user 공용 DB 기여 가능 + Edge Function 독점 쓰기**

초기 v1 은 viewer/editor/admin 3단계였으나, v1.1 에서 다음 이유로 2단계로 단순화:

- Phase A 파일럿 = 초대 기반 30명 → 악의적 편집 동기 낮음 (C-2 화이트리스트).
- 3채널 기여 모델 (§4.3) 하에서 "AI 자동 검색 결과" 가 공용 DB 의 주요 소스 → AI 호출 권한과 공용 쓰기 권한을 viewer/editor 로 분리할 실익 적음.
- editor 역할 분리 시 "누구에게 editor 부여할지" 운영 부담 + 사용자 혼란 ("둘 다 업데이트 되는데 뭐가 다르죠?").
- Edge Function 이 모든 공용 쓰기 독점 → 감사 로그 빠짐없이 기록 + Phase B flag / Phase C 평판 모델의 데이터 기반 확보.
- admin 은 role UPDATE · service_role 직접 편집 권한 + 예산 초과 후 호출 유지 (디버깅).

개인 override (`user_conferences.overrides`) 는 유지: "나만 이 값이 다르게 보여야 함" 요구 (시각 차이 선호, 비표준 메타) 에 대응.

### 4.5 마이그레이션 전략 (1회성)

**원본**: `public/data/conferences.json` (1430 줄, 32 conferences + 32 editions)
**경로**:
1. `scripts/migrate-json-to-supabase.mjs` 작성 (dry-run + --commit 모드)
2. `SUPABASE_SERVICE_ROLE_KEY` env 필요 (로컬 개발만)
3. 실행 순서: users(seed admin 1건) → conferences_upstream(32) → editions_upstream(32)
4. Idempotent: `ON CONFLICT (id) DO UPDATE SET ... updated_at=now()`

의사코드:
```js
const data = JSON.parse(fs.readFileSync('public/data/conferences.json'));
for (const c of data.conferences) {
  await sb.from('conferences_upstream').upsert({
    id: c.id, category: c.category, field: c.field,
    abbreviation: c.abbreviation || null,
    full_name: c.full_name,
    cycle_years: c.cycle_years,
    duration_days: c.duration_days,
    region: c.region || null,
    official_url: c.official_url || null,
    note: c.note || null,
    // 일부 항목에만 존재하는 필드는 optional chain
    organizer: c.extra?.organizer ?? null,
    found_at: c.extra?.found_at ?? null,
  });
}
for (const e of data.editions) {
  await sb.from('editions_upstream').upsert({
    id: e.id, conference_id: e.conference_id,
    status: e.status,
    start_date: e.start_date,
    end_date: e.end_date,
    venue: e.venue,
    link: e.link,
    source: e.source ?? 'initial_import',
    confidence: e.confidence ?? null,
    notes: e.notes ?? null,
    updated_at: e.updated_at ?? new Date().toISOString(),
  });
}
```

검증: 마이그레이션 후 count + 샘플 3건 비교 (id, full_name, cycle_years).

### 4.6 쿼터 주기 정책 (요약, 상세는 `PLAN-P0-quota-policy`)

- **주기**: 월초 일괄 리셋 (`period_start = date_trunc('month', now())`). Phase A 단순성 우선.
- **리셋 방법**: 사용자 첫 호출 시 lazy — `quotas.period_start != date_trunc('month', now())` 이면 counters 0 초기화 + period_start 갱신 (서버 트랜잭션).
- **초과 UX**: 하드 차단 + "X/Y 소진, 다음 달 1일 리셋" 안내.
- 상세 (카운터 원자성·어뷰즈 감지·한도 변경 UX 등)는 `PLAN-P0-quota-policy` 에서.

## 5. 단계 (Steps)

- [x] **S1** — 브랜치 + v1 본문 작성 (본 문서)
- [x] **S2** — ER 다이어그램 (mermaid) 추가 → §4.0
- [ ] **S3** — 사용자 리뷰 & §4.4 결정 승인 (또는 번복)
- [ ] **S4** — `bash scripts/verify-task.sh` 통과 (문서만)
- [ ] **S5** — commit + push + PR (설계 문서)
- [ ] **S6** — PR merge 후 completed/ 자동 이동 → `PLAN-028-api-proxy-mvp` 착수

## 6. 검증 (Verification)

- [ ] 6 테이블 × CRUD × role 매트릭스 100% 채움 (§4.2)
- [ ] 공용값·개인 override 충돌 시나리오 3개 이상 검증:
  - (a) viewer 가 cycle_years override 등록 후 editor 가 upstream 수정 시 override 유지 확인
  - (b) editor 가 conference 삭제 시 user_conferences row CASCADE 정리
  - (c) 동일 conference 에 대한 viewer A·B 의 override 상호 독립
- [ ] 30명 동시 API 호출 시 `quotas.update_used` 원자성 (UPDATE ... WHERE used<limit RETURNING)
- [ ] `api_usage_log` 월 집계 쿼리 10만 row 기준 성능 <100ms (인덱스 활용)
- [ ] 마이그레이션 dry-run 로그 32+32 row 감지 + diff 3건 샘플 일치
- [ ] `bash scripts/verify-task.sh` 통과 (문서만이므로 lint/test/build 영향 0)

## 7. 리스크·롤백

**리스크**:
- **RLS 실수 → 데이터 노출**: 정책 하나 빠지면 타 사용자 row 읽힘. → Supabase 테스트 계정 2개로 cross-read POC 필수 (PLAN-028 첫 단계)
- **override 레이어 복잡도 → 프론트 버그**: sparse merge 실수로 기본값 누락. → 공통 `mergeConference()` 유틸 단일 진입점 + 단위 테스트 (PLAN-029)
- **마이그레이션 누락·중복**: 32 conferences + 32 editions 불일치. → idempotent upsert + 실행 후 count assertion
- **쿼터 race condition**: 두 호출 동시 도착 시 한도 초과 통과. → `UPDATE ... WHERE used<limit RETURNING` 로 한 트랜잭션에서 체크·차감

**롤백**:
- 본 플랜은 설계 레코드 — 롤백은 §4 재작성 (문서 revert)
- PLAN-028 실제 CREATE TABLE 후 문제 발견 시 Supabase migration revert

## 8. 후속 (Follow-ups)

- **PLAN-028-api-proxy-mvp**: 본 스키마 기반 실제 CREATE TABLE + Edge Function 프록시 + Prompt Caching
- **PLAN-029-client-migration**: `src/services/claudeApi.js` + `src/hooks/useConferences.js` Supabase 어댑터 교체
- **PLAN-P0-quota-policy**: `quotas` 세부 (카운터 원자성·리셋·어뷰즈)
- **PLAN-P0-auth-flow**: users 삽입 트리거 + Resend SMTP + 로그인 UX
- Realtime 구독 (`conferences_upstream` 변경 브로드캐스트) — Phase B 이후

## 9. 작업 로그

- **2026-04-21 (초안)**: 스켈레톤 생성. 구조는 roadmap.md §6.3 기반, 세부 결정 보류.
- **2026-04-21 (v1 본문)**: 6테이블 컬럼·인덱스 확정, RLS 매트릭스 작성, §4.4 대안 3건 결정, 마이그레이션 의사코드 추가. `editions_upstream` 를 §3 범위에 추가(5→6 테이블). 쿼터 주기 정책 요약(§4.6) — 상세는 `PLAN-P0-quota-policy` 로 위임.
- **2026-04-22 (v1.1 정합)**: PLAN-P0-longterm-vision 3채널 기여 모델 반영. role viewer/editor/admin → user/admin 2단계 단순화 (§4.1.1). RLS 매트릭스에서 editor 열 제거 + 공용 쓰기 Edge Function(service_role) 독점 (§4.2). §4.3 Write 정책 3채널(시드·AI·수동) 으로 재작성 + 감사 로그 도입. §4.4.3 결정 갱신.
