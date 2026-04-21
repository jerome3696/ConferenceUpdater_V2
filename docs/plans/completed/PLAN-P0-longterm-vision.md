# PLAN-P0-longterm-vision: 3채널 기여 모델 · 공용 DB 선참조 · 신뢰 단계화

> **상태**: active (v1 본문 확정)
> **생성일**: 2026-04-22
> **완료일**: (Phase C 진입 시점에 아카이브)
> **브랜치**: `chore/longterm-vision-align`
> **연관 PR**: #
> **트랙**: A(체계화) — Phase A.0 준비기 (`docs/roadmap.md` §3 A.0.5)
> **의존·정합 대상**:
> - `PLAN-P0-multitenant-schema` v1.1 (editor 폐기, 3채널 write 정책, Edge Function 독점)
> - `PLAN-P0-quota-policy` v1.1 (user·admin 2-tier, discovery 예산 공용 DB 히트로 재계산)
> - `PLAN-P0-auth-flow` v1.1 (기본 role=`user`, 승격 user→admin)
> - `docs/roadmap.md` §3 A.1 · §4 B.1·B.2·B.3 · §6.3

---

## 1. 목표 (What)

ConferenceFinder 의 **장기 기여·비용·신뢰 구조를 하나의 문서에서 정합**. v1 단계에서 해결해야 할 것은 "어떤 경로로 데이터가 공용 DB 에 쌓이는가", "사용자 규모 증가가 왜 API 비용 증가로 직결되지 않는가", "사용자 기여를 어느 시점부터 어느 수준까지 신뢰할 것인가" 이 세 가지. 본 플랜은 이 질문들에 **Phase 매핑**까지 포함한 답을 제공.

## 2. 배경 (Why)

- 이전 준비기(A.0.1~A.0.4) 는 스택 선택·스키마·쿼터·인증까지만 확정. 그러나 **기여 경로**(누가 어떻게 공용 DB 를 채우는가) 와 **규모 경제**(사용자가 늘면 비용이 어떻게 움직이는가) 가 불명확하면 B·C Phase 목표가 흔들림.
- 2026-04-22 사용자 확정 비전: 공용 DB 는 **운영자 시드 + AI 자동검색 + 수동입력** 세 채널로만 채워짐. AI 자동검색은 **공용 DB 선참조** 로 중복 API 콜 제거 → "사용자가 늘어도 API 비용은 줄어드는" 구조.
- 위 비전은 editor 역할의 존재 이유를 지움 (모든 `user` 가 쿼터 내에서 3채널 모두 이용) → schema·quota·auth v1.1 정합 수정의 논리적 근거.

## 3. 범위 (Scope)

### 포함 (v1 본문 확정 대상)
- 4.1 3채널 기여 모델 정의
- 4.2 공용 DB 선참조 메커니즘·경제학
- 4.3 신뢰 모델 단계화 (trust-all → flag → reputation)
- 4.4 Role 2-tier 확정 (`user`, `admin`)
- 4.5 Phase 매핑 (어느 채널·신뢰 단계가 어느 Phase 에서 구현되는가)

### 제외 (Non-goals)
- 구체적 UI 와이어프레임 (분야 온보딩 UI 는 PLAN-B1 에서)
- Flag/신고 UI 플로우 (PLAN-B3 에서)
- 평판 점수 알고리즘 (Phase C 에서)
- 결제·유료 티어 모델 (Phase C 에서)

## 4. 설계 결정

### 4.1 3채널 기여 모델

공용 DB (`public.conferences_upstream`) 는 아래 **세 경로로만** 기록. 사용자 개별 뷰는 `user_conferences.overrides` sparse JSON 으로 분리.

| # | 채널 | 주체 | 저장 경로 | 신뢰 수준 (v1) |
|---|---|---|---|---|
| 1 | **운영자 큐레이션 시드** | admin (본인 1명) | Edge Function `POST /api/seed` 또는 DB 직접 INSERT | ★★★ (정답 취급) |
| 2 | **AI 자동 검색** | user (쿼터 소비) | Edge Function `POST /api/discovery` · 공용 DB **선참조 후** upsert | ★★ (모델 응답 + source_confidence) |
| 3 | **수동 입력** | user (쿼터 소비) | Edge Function `POST /api/conference` + `edit_log` | ★ (v1: trust-all, Phase B.3: flag, Phase C: reputation) |

**공통 규칙**:
- 모든 public write 는 **Edge Function 독점** (service_role 전용). 클라이언트 직접 INSERT/UPDATE 금지 → audit log 보장.
- 각 경로마다 `api_usage_log` / `edit_log` / `seed_log` 에 이벤트 기록 (RLS: admin 만 조회).
- 사용자 개인 변형(제목 별칭·메모)은 `user_conferences.overrides` 에 저장 → 공용 DB 는 "객관적 사실" 만.

### 4.2 공용 DB 선참조 — "사용자 증가 = API 비용 감소"

**메커니즘** (AI 자동검색 채널 처리 순서):

1. 사용자가 "업데이트" 또는 "발굴" 요청.
2. Edge Function 이 먼저 **공용 DB 선참조**:
   - `conferences_upstream` 에서 `slug` 매칭 시, `fetched_at` 과 현재 시각 비교.
   - TTL 이내 (v1: 고정 7일, B.2: 분야별 동적) → 캐시 반환. **API 콜 0회**.
   - TTL 초과 또는 없음 → Claude API 호출 → upsert + `api_usage_log` 기록.
3. 반환 페이로드에 `source: "cache" | "fresh"` 표시 → UI 에서 투명성 확보.

**경제학 (규모 효과)**:

| 규모 | 월 총 요청 | 캐시 히트율 가정 | 실제 API 콜 | user 1인당 API 콜 |
|---|---|---|---|---|
| 파일럿 30명 | 30 × 10 = 300 | 30% (B.2 전) | 210 | 7 |
| Phase B 100명 | 100 × 10 = 1,000 | 50% (B.2 동적 TTL) | 500 | 5 |
| Phase C 500명 | 500 × 10 = 5,000 | 70% (충분한 학회 커버리지) | 1,500 | 3 |

- **핵심**: 사용자가 늘수록 1인당 API 콜이 **감소** (한계비용 체감). 이는 "사용자가 많아질수록 비용이 는다" 는 일반 SaaS 직관의 반전.
- quota-policy §4.7 에서 파일럿 예산 $40.3/월 · 안전마진 40% 는 히트율 30% 전제. 히트율이 더 높아지면 마진 확대.
- 고정 원가: Supabase Pro $25/월. API 콜이 줄어도 Supabase 원가는 불변 → **B 이후부터 사용자당 단가 급락**.

**실패·오염 방지**:
- 캐시 오염(잘못된 upstream) 은 admin 의 DB 직접 UPDATE 또는 Phase B.3 flag 로 정정.
- 공용 DB 는 `updated_at`, `source` (model·url·seed), `source_confidence` 필드 유지 → 신선도 판단 근거.

### 4.3 신뢰 모델 단계화

사용자 기여(채널 2·3) 의 신뢰를 **Phase 에 걸쳐 점진적으로 강화**. v1 에 과잉 투자 금지.

| 단계 | Phase | 정책 | 운영 비용 | 전제 |
|---|---|---|---|---|
| **S0 trust-all** | A.1 | user 의 AI 검색·수동 입력을 곧바로 upstream 반영 | admin 이 이상치 수동 점검 | 파일럿 30명, 상호 아는 커뮤니티 |
| **S1 flag** | B.3 | 사용자가 "이상/중복/오류" flag 버튼 제출 → admin 대시보드에서 승인·반려 | flag 처리 수분/일 | 100~200명, flag 주 수 건 |
| **S2 reputation** | C | 과거 수정·flag 패턴으로 사용자별 신뢰 점수 → 일정 점수 이상만 즉시 반영, 이하는 pending | 점수 알고리즘 유지 | 500명+, admin 1인 처리 한계 |

**이행 조건**:
- S0 → S1: 월간 오염 이벤트(잘못된 upstream 반영) 2건 이상 / 또는 user 100명 돌파.
- S1 → S2: flag 월 20건 이상 또는 admin flag 큐 대기 3일+ 로 확대.

**v1 에 하지 않는 것**: 평판 DB·점수 UI·사용자별 신뢰 대시보드. A.1 은 trust-all 로 단순 가동.

### 4.4 Role 2-tier

| role | 권한 요약 | 기본 쿼터 (월) |
|---|---|---|
| `user` | 자신의 `overrides` CRUD · 공용 DB 읽기 · AI 검색 · 수동 입력 · (B.3~) flag 제출 | update 10 / discovery 3 |
| `admin` | 공용 DB 직접 쓰기 · seed 업로드 · user 쿼터 조정 · flag 승인 (B.3~) · reputation 조정 (C~) | update 999 / discovery 999 |

- `editor` 는 v1.1 에서 폐기. "업데이트 권한" 구분을 쿼터로만 통제.
- 파일럿은 admin = 본인 1명. Phase B 에서 공동 운영자 추가 시에도 최대 3명 내외 (대시보드 없이 DB 직접 UPDATE 감당 가능).

### 4.5 Phase 매핑 표

| Phase | 마일스톤 | 본 플랜이 영향 주는 작업 |
|---|---|---|
| **A.0** | 준비기 (현재) | v1.1 스키마·쿼터·Auth 정합 (완료) · 본 플랜 문서화 |
| **A.1** | 서버 최소 가동 | 공용 DB 기본 테이블 + 선참조 (고정 7일 TTL) + `api_usage_log` · S0 trust-all · admin·user 2-tier Trigger |
| **B.1** | 분야 온보딩 + 시드 | 가입 시 분야 선택 → 큐레이션 시드 일괄 적재 (채널 1) · `user_conferences` 에 분야 필드 반영 · 구독/해제 UI |
| **B.2** | 동적 TTL · 프롬프트 v2.0 | 학회 성격별 TTL 차등 (주기·임박도) → 히트율 50%+ 달성. 고정 7일에서 "임박 학회 1일 / 주기 내 7일 / 주기 밖 30일" 류로 세분화 |
| **B.3** | Flag 시스템 | S1 진입: flag 버튼·admin 승인 큐 · `flags` 테이블 · flag 기반 upstream 정정 경로 |
| **C** | 평판 · 결제 | S2 진입: user 평판 점수 · pending 큐 · 유료 티어 (쿼터 확장) · SSO |

## 5. 단계 (Steps)

- [x] Step 1 — 3채널 기여 모델 용어·경로 확정 (§4.1)
- [x] Step 2 — 공용 DB 선참조 경제학 수치 표 (§4.2) · quota-policy §4.7 와 정합
- [x] Step 3 — 신뢰 단계화 S0/S1/S2 + 이행 조건 (§4.3)
- [x] Step 4 — Role 2-tier 확정 (§4.4) · schema §4.1.1, auth §4.8 과 정합
- [x] Step 5 — Phase 매핑 표 작성 (§4.5) · roadmap §3·§4 와 정합
- [ ] Step 6 — PR 머지 후 `PLAN-028-api-proxy-mvp` 의 Edge Function 스펙에 공용 DB 선참조 분기 추가 (후속)

## 6. 검증 (Verification)

- [x] 5개 설계 결정(§4.1~4.5) 모두 "선택 근거 + Phase 위치 + v1 제외 범위" 기재
- [x] 3채널 모두 schema §4.3 write 정책에서 동일 Edge Function 독점 원칙으로 반영되어 있음 (v1.1 정합 완료)
- [x] quota-policy §4.7 의 predictor($40.3/월·마진 40%) 가 본 플랜 §4.2 히트율 30% 가정과 일치
- [x] auth-flow §4.8 Trigger 의 기본 role = `user` 가 §4.4 Role 표와 일치
- [x] roadmap §3 A.0.5 · §4 B.1/B.2/B.3 · §6.3 에 본 플랜 링크 반영
- [x] `bash scripts/verify-task.sh` 통과 (문서 변경만)

## 7. 리스크·롤백

**리스크**:
- **trust-all 오염**: 파일럿 사용자 중 1명의 실수/악의로 upstream 이 흐려질 수 있음. → admin 이 `updated_at` 최근값 일 1회 리뷰 (운영 부담 ~5분/일). 임계 초과 시 S1 진입 앞당김.
- **히트율 가정 실패**: §4.2 표의 30/50/70% 는 경험치가 없는 추정. 파일럿 2개월 후 실측으로 보정 (quota-policy §4.7 재계산 트리거).
- **채널 간 경쟁**: 수동 입력과 AI 검색이 같은 학회에 대해 충돌하는 정보 생성 → source_confidence · 최신 fetched_at 우선 규칙으로 결정. 충돌 감지는 B.3 flag 로 수렴.
- **Phase 역진**: S2 도입 후 운영 복잡도가 admin 한계 초과 시 S1 로 임시 회귀 가능 — 알고리즘은 남기되 즉시 반영 임계를 0 으로 낮춤.

**롤백**:
- 선참조 버그로 오염 가속 시: Edge Function 의 캐시 분기 플래그 OFF → 전 요청 fresh API 호출 (비용 증가, 임시). 정합 후 재활성.
- 3채널 중 하나(예: 수동 입력) 오남용 심각 시: 쿼터로 차단 (user.discovery_limit = 0 같은 극약 처방) — admin UPDATE 로 즉시.

## 8. 후속 (Follow-ups)

- **PLAN-028-api-proxy-mvp**: Edge Function 안에 §4.2 선참조 분기 구현.
- **PLAN-B1-field-onboarding** (신규 ID 확정 예정): 분야 선택 UI + 시드 큐레이션 도구.
- **PLAN-B2-dynamic-ttl** (신규 ID): 학회 성격별 TTL 튜닝 + 프롬프트 v2.0.
- **PLAN-B3-flag-system** (신규 ID): flag 테이블·admin 승인 UI.
- **Phase C**: 평판 점수 알고리즘 설계 (별도 장기 플랜).

## 9. 작업 로그

- **2026-04-22 (v1 본문)**: 사용자 확정 비전(3채널 + 공용 DB 선참조 + 분야 온보딩) 을 5개 결정으로 정리. schema·quota·auth v1.1 정합 수정(editor 폐기 → user 단일, period_start 정합, user→admin 승격) 의 **근거 문서** 로서 본 플랜 생성. Phase 매핑(A.1 trust-all, B.1 시드, B.2 동적 TTL, B.3 flag, C 평판) 확정. 히트율 30/50/70% 는 파일럿 2개월 후 실측 보정 대상.
