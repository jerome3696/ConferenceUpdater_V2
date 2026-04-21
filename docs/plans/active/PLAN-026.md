# PLAN-026: Phase 0 — 서버 스택 비교 분석 (Backend Stack Comparison)

> **상태**: active
> **생성일**: 2026-04-21
> **완료일**: (결정 시 갱신)
> **브랜치**: `feature/PLAN-026-server-stack-comparison`
> **연관 PR**: #
> **트랙**: A(체계화) — 서버 전환 사전 설계

---

## 1. 목표 (What)

ConferenceFinder V2의 **서버 백엔드 스택**을 선택한다. Cloudflare Workers+D1 / Supabase / Firebase 3개 후보를 다음 7축(인증·DB·함수·비용·개발경험·확장성·벤더락인)으로 비교해 **1개 스택 최종 권고**를 도출한다. 이 문서는 스택 결정 근거(의사결정 레코드)이며, 실제 구현은 별도 후속 PLAN에서.

## 2. 배경·동기 (Why)

- 상위 로드맵(`docs/roadmap.md` §3 Phase A, §9 스택 결정 참조)에서 상업화 3단계 확정: Phase A(30명/1-6개월) → Phase B(100명/6-12개월) → Phase C(요금 청구, 12개월~). 6개월 내 서버 전환 필수 결정.
- 현재 브라우저 SPA 구조는 (a) API 키 노출, (b) 쿼터 강제 불가, (c) 멀티테넌트 공용 캐시 불가 → 서버 없이는 P1 시작 불가.
- 스택 선택은 6개월 이상 수명을 가지는 결정. 충분한 비교 없이 시작하면 중간 이관 비용 큼.

## 3. 범위 (Scope)

### 포함
- 3개 스택의 2026-04 기준 **가격·한도·기능** 실측
- 프로젝트 요구(5개 테이블 관계형 DB, magic link Auth, Anthropic 30초 프록시, 월 쿼터 카운터, 멀티테넌트 RLS)에 대한 적합도 매트릭스
- P1·P2·P3 단계별 월 예상 비용
- 혼자 + Claude 협업 모델 기준 6개월 MVP 납기 추정
- 스택별 주요 리스크 3개씩
- **최종 1개 스택 권고 + 근거**

### 제외 (Non-goals)
- 실제 서버 코드 작성 (후속 PLAN)
- DB 스키마 상세 설계 (PLAN-P0-multitenant-schema로 분리)
- 쿼터 정책 상세 스펙 (PLAN-P0-quota-policy로 분리)
- 결제 시스템(Stripe 등) — Phase 4 범위
- 지금 당장 스택 전환 시작 — 본 문서는 결정까지만

## 4. 설계 결정

### 4.1 평가 축 (7가지)

| 축 | 항목 | 가중치 |
|---|---|---|
| A. 인증 | Magic link 품질, MAU 비용, SMTP 방식 | 중 |
| B. DB | 관계형·RLS·동시성·JOIN·집계 쿼리 | **상** |
| C. 함수 | Anthropic 30초 프록시 실행 가능성, cold start | 중 |
| D. 비용 | P1($0~?) / P2($?/월) / P3 스케일 | 중 |
| E. 개발경험 | 로컬 CLI, 에뮬레이터, TS 타입 생성, 문서 | **상** (혼자 개발) |
| F. 확장성 | 1000명+ 대응, 장기 병목 | 중 |
| G. 벤더락인 | 탈옥 경로, 데이터 이관 난이도 | 하 |

### 4.2 비교 매트릭스

| 축 | Cloudflare (Workers+D1+KV) | Supabase | Firebase |
|---|---|---|---|
| **A. 인증** | ❌ 내장 없음. Clerk 필요 (50K MAU 무료, 이후 $25~) | ✅ Magic link 내장, 50K MAU 무료. **외부 SMTP 필수** (Resend 무료 100통/일) | ✅ Email link 내장, 50K MAU 무료. Blaze 필수 |
| **B. DB 관계형** | ⚠️ D1 (SQLite). 5테이블 OK. **네이티브 RLS 없음** (앱층 `WHERE user_id=?` 강제). 멀티테이블 트랜잭션 불안정 보고 | ✅ PostgreSQL. **성숙한 RLS** (Supabase의 핵심 기능, 5ms 미만 오버헤드). JOIN/집계 완전 지원 | ❌ Firestore NoSQL. **JOIN 없음**. 집계 쿼리 별도 summary 문서 필요. 단일 문서 write 1 QPS 제한. Cloud SQL 대안 있으나 +$9/월 |
| **C. 함수** | ✅ Workers Paid: 기본 30초 CPU, 벽시계 무제한. `@anthropic-ai/sdk` 공식 지원. cold start 거의 없음 | ✅ Edge Functions (Deno). Wall 150s(Free)/400s(Pro), CPU 2s (async I/O 미포함). `@anthropic-ai/sdk` Deno 호환 필요 확인 | ✅ Gen 2: HTTP 60분, 최대 1000 req/인스턴스. cold start 있으나 `minInstances:1`로 회피 가능 |
| **D. 비용** | P1·P2·P3 모두 **$5/월 flat** (Workers Paid) | P1 **$0** (Free) → P2 **$25** (Pro, 7일 백업·자동 중단 없음) → P3 **$35+** (Compute add-on) | P1 **~$0-2** → P2 **~$3-6** (Blaze PAYG). 저비용이지만 Blaze 전환(결제 등록) 필수 |
| **E. 개발경험** | Wrangler v4 (2026-04 통합 CLI 발표). 로컬 D1 완전. 문서 우수. TS 우선 | Supabase CLI + 로컬 Docker 완전 에뮬레이트. DB→TS 타입 자동 생성. 마이그레이션 체계적 (`supabase db diff/push`). 통합 대시보드 | Firebase Emulator Suite 완비 (Auth/Firestore/Functions/Storage 로컬). TS 완전. 공식 문서·예제 풍부 |
| **F. 확장성** | 1000명까지 동일 요금. Egress 0원. Anthropic 레이트리밋이 진짜 병목 | Pro 100K MAU 한도. Compute add-on 필요 시점 분명. Self-hosted 탈옥 공식 지원 | PAYG 자연 확장. GCP 통합. 대규모 시 비용 예측 어려움 |
| **G. 벤더락인** | SQLite 표준 → PostgreSQL 이관 가능. Auth는 Clerk 독립 | **자유도 최고**: PostgreSQL 덤프 → 어디든. `supabase db dump` 공식 경로 | Firestore NoSQL → 관계형 이관은 스키마 재설계 필요. Auth 비밀번호 해시 이관 불가 (magic link만 쓰면 OK) |

### 4.3 요구사항 적합도 (프로젝트 관점)

| 요구 | Cloudflare | Supabase | Firebase |
|---|:-:|:-:|:-:|
| Magic link Auth | ⚠️ 외부 | ✅ 내장 | ✅ 내장 |
| 5테이블 관계형 + JOIN | ⚠️ SQLite | ✅ PG | ❌ NoSQL |
| 네이티브 RLS (멀티테넌트) | ❌ 앱층 | ✅ 최강 | ⚠️ Security Rules |
| `api_usage_log` 집계 | ⚠️ SQL OK | ✅ 쉬움 | ❌ 복잡 |
| 원자 쿼터 카운터 | ✅ UPDATE | ✅ MVCC | ✅ FieldValue.increment |
| Anthropic 30s 프록시 | ✅ | ✅ | ✅ |
| 혼자 개발·6개월 MVP | ✅ 3개월 | ✅ 2-3개월 | ✅ 3개월 |
| 1000명 확장 비용 | ✅ $5 | ✅ $35 | ⚠️ 비용 예측 어려움 |

### 4.4 결론 — **Supabase 권고**

**최우선 근거**: 이 프로젝트의 **가장 중요한 DB 요구(관계형 5테이블 + 네이티브 RLS + 집계 쿼리)**를 유일하게 "그대로" 만족.

- **Firebase 탈락**: Firestore NoSQL이 5테이블 관계형·집계에 부적합. Cloud SQL로 우회 시 복잡도↑·비용↑. 이 프로젝트는 `api_usage_log` 사용자별 집계, `user_conferences ⋈ conferences_upstream` JOIN이 핵심 — NoSQL 오버헤드가 구조적 비용이 됨.
- **Cloudflare 차점**: 가격·확장성·Egress 관점에선 최강($5 flat). 하지만 ① 네이티브 RLS 없음 → 앱층 `WHERE user_id=?` 강제 = 실수 한 번이 보안사고. 혼자 개발에 위험. ② Auth를 Clerk 외부 의존. ③ D1 트랜잭션 버그 보고.
- **Supabase 채택**:
  - PostgreSQL + RLS = 멀티테넌트 보안 레이어가 DB 내장. 실수 방지.
  - P1 $0 → P2 $25 비용 예측 가능. P3도 $35 선에서 관리.
  - CLI·타입생성·마이그레이션이 혼자 개발에 최적.
  - Self-hosted 탈옥 경로로 장기 락인 리스크 낮음.
  - **유일한 구조적 약점**: 내장 SMTP 시간당 3통 → **Day 1부터 Resend 연동 필수** (단, 5분 작업).

**대안 재검토 트리거** (스택 결정 번복 조건):
- Supabase 가격 인상 50%+ 또는 Free 티어 축소 시 → Cloudflare 재고
- 프로젝트 규모 급성장으로 Compute add-on 비용이 $100+/월 넘어서면 Self-hosted 또는 Cloudflare 이관
- Anthropic SDK Deno 호환 깨지면 → Node 기반 Cloudflare/Firebase 이관

## 5. 단계 (Steps)

- [ ] Step 1 — 이 문서 내 권고안(Supabase) 사용자 최종 승인
- [ ] Step 2 — Supabase 프로젝트 생성 + 로컬 CLI 초기화 (`supabase init`)
- [ ] Step 3 — Resend SMTP 계정 개설·연동 (Day 1 작업, magic link 테스트)
- [ ] Step 4 — 후속 플랜 분기:
  - `PLAN-P0-multitenant-schema.md` (DB 스키마)
  - `PLAN-P0-quota-policy.md` (쿼터 상세)
  - `PLAN-P0-auth-flow.md` (로그인 UX)
- [ ] Step 5 — 본 PLAN-026 completed/ 이동

## 6. 검증 (Verification)

- [ ] 3개 스택 비교 매트릭스가 정확한 수치·출처로 기재됨
- [ ] "왜 Supabase인가"의 근거가 반증 가능한 형태로 명시됨 (대안 재검토 트리거 포함)
- [ ] 사용자 승인 서명 — 스택 변경 시 본 문서 §4.4 재작성 요구
- [ ] `bash scripts/verify-task.sh` 통과 (문서 변경이므로 lint·test만)
- [ ] `docs/blueprint.md` §7.2 서버 전환 섹션에 선택 스택 기록 (본 플랜 완료 시점)

## 7. 리스크·롤백

**리스크**:
- **권고 번복 비용**: Supabase로 2개월 작업 후 Cloudflare로 전환 시 Auth·DB 완전 재작성. → **완화**: Step 2 이전에 반드시 승인. 스키마 설계 단계까지 최소 투자 유지.
- **Deno SDK 호환**: `@anthropic-ai/sdk` Deno 환경 동작을 사전 POC로 검증 필요. → Step 2 직후 최소 "hello world" Edge Function + Anthropic ping 테스트.
- **Free 티어 7일 자동 일시정지**: 개발 중 1주 이상 쉬면 중단. → Pro($25) 즉시 전환 또는 keepalive cron 설정.

**롤백**:
- 이 문서는 의사결정 레코드이므로 "롤백"은 §4.4 결론 재작성으로 처리.
- 구현 시작 후 전환이 필요하면 새 PLAN(PLAN-XXX-stack-migration) 개설.

## 8. 후속 (Follow-ups)

Step 4의 3개 분기 플랜 + Phase 1 구현 PLAN들:
- **PLAN-P0-multitenant-schema.md**: `users`, `conferences_upstream`, `user_conferences`, `api_usage_log`, `quotas` 스키마 + RLS 정책
- **PLAN-P0-quota-policy.md**: 리셋 주기, 초과 UX, 카운터 원자성, 어뷰즈 방지
- **PLAN-P0-auth-flow.md**: 로그인·회원가입 UX, Resend 연동
- **PLAN-027-api-proxy-mvp.md**: `/api/claude/*` 프록시 함수 + Prompt Caching 통합
- **PLAN-028-client-migration.md**: `src/services/claudeApi.js` → 서버 엔드포인트로 전환

## 9. 작업 로그

- **2026-04-21**: 상위 전략 플랜(3-spicy-manatee v3) 승인 직후 생성. 3개 스택을 document-specialist 3병렬 조사(2026-04 기준 최신). Supabase 권고. 사용자 최종 승인 대기.
