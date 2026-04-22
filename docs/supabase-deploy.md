# Supabase 배포 체크리스트 — PLAN-028 A.1 서버 MVP

> **대상**: 사용자(운영자) 수동 작업 순서
> **선행**: `feature/PLAN-028-api-proxy-mvp` merge 완료
> **소요**: 45~60분 (Resend·Anthropic 계정 이미 있으면 30분)

모든 단계는 로컬에서 1회, 프로덕션에서 1회 실행. 각 단계 끝에 **검증** 섹션 필수 수행.

---

## 0. 사전 준비 (각 5분)

- [ ] Supabase CLI 설치: `brew install supabase/tap/supabase` 또는 `npm install -g supabase`
- [ ] Resend 계정 (https://resend.com) — GitHub OAuth 가입 무료
- [ ] Anthropic Console — `console.anthropic.com` → 예산 한도 **월 $60** 설정 (하드캡)

---

## 1. Supabase 프로젝트 생성

1. https://supabase.com/dashboard → "New project"
2. 이름: `conference-finder-pilot`
3. 데이터베이스 비밀번호 설정 (비밀번호 매니저에 저장)
4. 지역: `Northeast Asia (Seoul)` 권장
5. 생성 후 대시보드에서 **Project URL**, **anon key**, **service_role key** 기록
6. Settings > API > **URL Configuration** 에 redirect URL 추가:
   - `http://localhost:5173`
   - `https://jerome3696.github.io/ConferenceUpdater_V2`

**검증**: `supabase projects list` 에서 프로젝트 표시

---

## 2. 로컬 연결 + env 파일 작성

```bash
cd ~/ConferenceFinder
supabase link --project-ref <YOUR_PROJECT_REF>
# supabase/config.toml 의 project_id 를 업데이트 (자동으로 됨)
```

`.env.local` 생성 (절대 커밋 금지 — `.gitignore` 에 포함됨):
```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

**검증**: `supabase status` 실행 시 project_id 표시

---

## 3. DB 마이그레이션 적용

```bash
supabase db push
# supabase/migrations/20260422000001_initial_schema.sql 이 적용됨
```

**검증**:
```bash
supabase db diff  # 빈 diff (schema 일치)
```

대시보드 SQL Editor 에서:
```sql
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' ORDER BY table_name;
-- 기대: api_usage_log, conferences_upstream, editions_upstream,
--       quotas, user_conferences, users
```

---

## 4. 초기 데이터 마이그레이션

```bash
# dry-run — 삽입 대상 확인 (orphan 3건 skip 은 의도된 동작)
node scripts/migrate-json-to-supabase.mjs

# --commit 실제 삽입
node scripts/migrate-json-to-supabase.mjs --commit
```

**검증** (SQL Editor):
```sql
SELECT count(*) FROM conferences_upstream;  -- 기대: 32
SELECT count(*) FROM editions_upstream;     -- 기대: 61 (64 - 3 orphan)
```

---

## 5. Resend SMTP 연동

1. Resend 대시보드 → API Keys → "Create API Key" (이름: `supabase-smtp`, 권한: `Sending access`)
2. Supabase 대시보드 → Auth > Email Templates > **Enable Custom SMTP**
3. 입력:
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Password: `<발급받은 API key>`
   - Sender email: `onboarding@resend.dev` (파일럿), Phase B 에 자체 도메인
   - Sender name: `ConferenceFinder`
4. 이메일 템플릿(한국어) — `docs/plans/completed/PLAN-P0-auth-flow.md` §4.6 참조

**검증**: Dashboard > Auth > Users > "Invite user" 로 본인에게 초대 발송 → 메일함 수신 확인

---

## 6. Edge Function 배포

```bash
# Anthropic API key 를 Supabase secrets 에 등록
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set MONTHLY_BUDGET_CAP_USD=50
supabase secrets set CACHE_TTL_DAYS=30

# 함수 배포
supabase functions deploy claude-proxy --no-verify-jwt
# (--no-verify-jwt: 함수 내부에서 수동 검증 — service_role 분기 처리 때문)
```

**검증**:
```bash
# 테스트 1: 미인증 호출 → 401
curl -X POST "https://<project-ref>.supabase.co/functions/v1/claude-proxy" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"update","prompt":"test"}'
# 기대: {"error":"unauthorized"}

# 테스트 2: 정상 호출 (본인 로그인 JWT 필요)
# 브라우저 DevTools > Application > Local Storage 에서 JWT 복사
curl -X POST "https://<project-ref>.supabase.co/functions/v1/claude-proxy" \
  -H "Authorization: Bearer <YOUR_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"update","prompt":"hello","maxTokens":64}'
# 기대: 200 + quota_after 필드
```

---

## 7. 본인 계정 admin 승격

```sql
-- 본인 가입 후 (magic link 로 1회 로그인)
UPDATE public.users SET role = 'admin', update_limit = 999, discovery_limit = 999
 WHERE email = 'jerome3696@gmail.com';
```

**검증**: `SELECT * FROM users WHERE role='admin';` → 1 row

---

## 8. 파일럿 사용자 초대 (A.3)

- Dashboard > Auth > Users > "Invite user" 반복 (30명)
- 초대 링크 수신 후 클릭 → magic link 로 로그인 → 자동으로 `users` · `quotas` 생성 (trigger)

**검증**: `SELECT count(*) FROM users WHERE role='user';`

---

## 9. 비용 모니터링 (상시)

매일 1회 대시보드 SQL Editor 에서:
```sql
-- 이번 달 사용자별 비용
SELECT
  u.email,
  count(*) as calls,
  sum(a.cost_usd) as cost,
  sum(a.input_tokens) as in_tok,
  sum(a.cache_hit_tokens) as cache_tok
FROM api_usage_log a JOIN users u ON u.id=a.user_id
WHERE a.ts >= date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')
GROUP BY u.email ORDER BY cost DESC;

-- 이번 달 총합 (예산 대비)
SELECT monthly_budget_used();
```

**경보 기준** (PLAN-P0-quota-policy §4.5):
- $40 도달 (80%) → 본인 email 경보 (Supabase scheduled function 추후 추가)
- $45 도달 (90%) → 전 사용자 배너
- $50 도달 (100%) → user 호출 차단 (자동)

---

## 10. 롤백 (긴급)

```bash
# Edge Function 삭제
supabase functions delete claude-proxy

# DB 롤백 (데이터 유실 — 백업 확인 후)
psql "$DATABASE_URL" -f supabase/rollbacks/rollback_0001.sql
```

브라우저 클라이언트는 PLAN-029 이전까지 기존 `claudeApi.js` 경로 유지 → 서버 장애 시 즉시 구버전 사용 가능.

---

## 참조

- `docs/plans/active/PLAN-028-api-proxy-mvp.md` — 설계 근거
- `docs/plans/completed/PLAN-P0-multitenant-schema.md` — 스키마 명세
- `docs/plans/completed/PLAN-P0-quota-policy.md` — 쿼터·예산 정책
- `docs/plans/completed/PLAN-P0-auth-flow.md` — 인증 UX
- `supabase/migrations/20260422000001_initial_schema.sql` — 실제 SQL
