# PLAN-P0-quota-policy: API 쿼터 정책 상세 스펙

> **상태**: active (v1 본문 작성 중)
> **생성일**: 2026-04-21
> **완료일**: (정책 승인 시 갱신)
> **브랜치**: `feature/PLAN-P0-quota-policy-v1`
> **연관 PR**: #
> **트랙**: A(체계화) — Phase A.0 준비기 (`docs/roadmap.md` §3 A.0.3, §6.1)
> **의존**: `PLAN-P0-multitenant-schema` §4.1.6 `quotas` 테이블 확정

---

## 1. 목표 (What)

30명 파일럿 운영 시 **개별 사용자 과소비·전체 예산 초과·카운터 경합**을 방지하는 쿼터 정책을 **결정 레벨까지 확정**한다. 스키마의 `quotas` 테이블(`update_used/limit`, `discovery_used/limit` 2종 카운터) 기반으로 원자성·리셋·UX·예산 상한·어뷰즈 방지 6개 영역을 스펙으로 확정. 실제 Edge Function 구현은 PLAN-028.

## 2. 배경·동기 (Why)

- `PLAN-P0-multitenant-schema` §4.1.6: `quotas` 테이블은 **update/discovery 2종 분리 카운터** 확정. 본 정책은 그 구조 위에 동작 규칙 정의.
- `roadmap.md` §2 비용 모델: 사용자당 100% 소진 시 $1.02/월 → 30명 전원 최대 소진 시 $30.6/월 (Phase A 내 부담 상한 $50 이내).
- `roadmap.md` §6.1 에 열거된 5개 결정 지점(리셋·초과 UX·원자성·투명성·예산 상한) + §10 리스크 "쿼터 공정성" + "정책 번복 시 신뢰 하락" → P1 시작 전 확정 필수.
- 30명 파일럿은 "admin 1명(본인) + user 다수" 구조 (v1.1 정합: viewer/editor 분리 폐지). admin 쿼터 무제한은 개발·QA 실효성 위해 필요하되 전체 예산 공유.

## 3. 범위 (Scope)

### 포함
- 4.1 리셋 주기 결정 (월초 일괄 vs rolling) + 근거
- 4.2 초과 UX 결정 (하드 vs 경고+대기 vs 긴급추가)
- 4.3 원자성 구현 SQL (dual counter 기준, 보상 트랜잭션 포함)
- 4.4 투명성 UI 요건 (표시 위치·갱신·문구)
- 4.5 전체 예산 상한 $50 도달 시 처리 흐름
- 4.6 어뷰즈 방지 Edge Function 레벨 (rate limit·복수 계정·봇)
- 4.7 역할별 기본값 (viewer/editor/admin 각 `update_limit`·`discovery_limit`)
- 4.8 정책 변경 관리 (조정 프로토콜·사용자 고지)

### 제외 (Non-goals)
- 유료 티어·Stripe 연동 (Phase C)
- 쿼터 증감 관리자 대시보드 UI (본 플랜은 스펙만, UI 는 PLAN-029)
- RFM·코호트 분석 (Phase B 이후)
- 쿼터 개인별 커스텀 한도 UI (admin 이 SQL 로 직접 조정 — PoC 단순화)

## 4. 설계 (확정안 + 근거)

### 4.1 리셋 주기 → **월초 일괄 (KST 기준 1일 00:00)**
- 대안 비교:

  | 안 | 구현 복잡도 | 공정성 | 크론 의존 |
  |---|---|---|---|
  | **월초 일괄** ✅ | 낮음 (lazy reset, 크론 불필요) | 말일 가입자 1회성 손해 수용 | 불요 |
  | 가입일 rolling | 중 (per-user reset_at 관리) | 완전 공정 | 불요 |
  | Sliding window 30d | 높음 (`COUNT(*) WHERE ts > now()-30d` 매 호출) | 완전 공정 | 불요 |

- **결정**: 월초 일괄. Phase A 30명 규모에서 공정성 손실은 마지막 주 가입자 한정 (월 1회). 구현·디버깅·UI("이번 달 X/10") 단순. **KST 기준** 채택 — 사용자가 한국 시간대라 월말 자정 스파이크 예측 가능.
- 구현: **Lazy reset** (크론 불요). 호출 시작 시 Edge Function 이 다음 SQL 실행:
  ```sql
  UPDATE quotas
  SET update_used = CASE WHEN period_start < $month_start THEN 0 ELSE update_used END,
      discovery_used = CASE WHEN period_start < $month_start THEN 0 ELSE discovery_used END,
      period_start = GREATEST(period_start, $month_start)
  WHERE user_id = $1
  RETURNING *;
  ```
  - `$month_start = date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date`.

### 4.2 초과 UX → **하드 차단 + "다음 달 X일 자동 재개" 안내**
- 대안 비교:

  | 안 | 비용 통제 | UX 만족 | Phase |
  |---|---|---|---|
  | **하드 차단 + 안내** ✅ | 강함 | 중 (리셋일 명시로 안심) | A |
  | 경고만 + 계속 허용 | 약함 | 높음 | - (파일럿 비적합) |
  | 긴급 추가 (+$) | 중 | 높음 | C (유료 티어) |

- **결정**: 하드 차단. 경고만 허용은 예산 통제 불가. 긴급 추가는 결제 인프라 없음 → Phase C.
- 문구(고정):
  - 소진 직전 (예: 8/10): 토스트 배너 "이번 달 업데이트 쿼터 8/10 사용 중 (잔여 2건)."
  - 소진 도달 (10/10): 모달 "이번 달 업데이트 쿼터 소진. **{다음 달 1일}에 자동으로 리셋**됩니다."
  - discovery 동일 패턴 (3/3 소진).

### 4.3 원자성 구현 — dual counter 기준 SQL

**단일 호출 시도** (Edge Function 트랜잭션 내):
```sql
-- update 호출 시 (discovery 도 컬럼명만 바꿔 동일)
WITH consumed AS (
  UPDATE quotas
  SET update_used = update_used + 1,
      updated_at = now()
  WHERE user_id = $1
    AND update_used < update_limit
    AND period_start = $month_start     -- 리셋 step 가 먼저 갱신됨
  RETURNING update_used, update_limit
)
SELECT * FROM consumed;
-- 0 rows returned → 쿼터 초과 OR stale period (재시도 불필요)
-- 1 row returned → 통과, API 호출 진행
```

**보상 트랜잭션** (API 호출 실패 시 — 네트워크/Anthropic 오류만, 클라이언트 에러는 보상 없음):
```sql
UPDATE quotas
SET update_used = GREATEST(update_used - 1, 0)
WHERE user_id = $1 AND period_start = $month_start;
```

**예산 상한 통합 체크** (§4.5 참조) — 개인 쿼터 차감 직후, API 호출 직전에 전역 예산 확인. 초과 시 차감 롤백.

### 4.4 투명성 UI 요건

- **위치**: 앱 헤더 우측 (기존 "신규 학회 발굴" 버튼 옆) 에 `[업데이트 7/10 · 발굴 1/3]` 형태 inline 표시
- **색상 단계**:
  - 0~59%: 회색 중립
  - 60~79%: 노랑
  - 80~99%: 주황
  - 100%: 빨강 + 클릭 시 소진 모달
- **갱신 주기**: API 호출 성공·실패 응답 직후 즉시 로컬 state 갱신 (낙관적 업데이트). 서버 실측값과 mismatch 시 응답 객체의 `quota_after` 값으로 덮어쓰기.
- **상세 모달** (쿼터 인디케이터 클릭 시): 최근 호출 5건 (timestamp·endpoint·성공여부·비용) + 리셋일 + 예산 상한 잔여.

### 4.5 전체 예산 상한 = $50/월

- **측정**: `SELECT SUM(cost_usd) FROM api_usage_log WHERE ts >= $month_start` (Edge Function 호출 직전 실행).
- **단계별 처리**:
  - 누적 < $40 (80%): 정상 처리
  - $40 ≤ 누적 < $45 (80~90%): 운영자(본인) email 경보 (Resend) "파일럿 예산 80% 도달"
  - $45 ≤ 누적 < $50 (90~100%): 모든 user 에게 "이번 달 남은 예산 $X — 리셋까지 절약 권장" 배너
  - 누적 ≥ $50: **user 호출 차단** (개인 쿼터 잔여와 무관). admin 은 계속 허용 (디버깅 목적).
  - 추가 안전장치: Anthropic Console 에 **월 $60 하드 캡** 설정 (이중 방어).
- **부작용 최소화**: 상한 도달 직전의 호출도 정상 처리 (race 방지). 체크를 "호출 직전 SUM" 으로 함 → ± $0.15 오차 수용.

### 4.6 어뷰즈 방지

| 위협 | 대응 | 구현 |
|---|---|---|
| 단일 계정 burst (쿼터 내 초단기 대량 호출) | IP + user_id 조합 분당 rate limit | Edge Function 내 Redis/Upstash 불요 — Supabase Postgres `pg_net`/`pg_cron` 또는 단순 SQL count:<br>`SELECT count(*) FROM api_usage_log WHERE user_id=$1 AND ts > now() - interval '1 minute'` 임계 10건 |
| 복수 계정 생성 (쿼터 우회) | Signup 도메인 블록리스트 + Auth rate limit | Supabase Auth 기본 IP rate limit 신뢰 + 의심 시 수동 승인 |
| 봇/스크래핑 | 로그인 필수 (모든 엔드포인트 JWT 요구) | Edge Function 에서 `auth.uid()` NULL 체크 |
| Prompt injection via keyword input | 서버 프롬프트 조립 시 user input 을 JSON value 로만 삽입 | `JSON.stringify` 래핑 (현 `promptBuilder.js` 관행 유지) |

Phase A 기간 파일럿은 초대 링크 기반 → 일반적 봇 문제는 제한적. 분당 rate limit 10건이 상한(개인 월 13회 상한) 보다 훨씬 크므로 정상 사용자에게 영향 없음.

### 4.7 역할별 기본값 (v1.1 — 2단계)

| 역할 | update_limit | discovery_limit | 비고 |
|---|:-:|:-:|---|
| `user` | 10 | 3 | 가입 기본값. 공용 DB 기여 권한 포함 (AI 호출·수동 입력 모두). 30명 × $1.01 = $30.3/월 |
| `admin` | 999 (실질 무제한) | 999 | 본인. 단 **$50 전체 예산에 본인 비용도 포함** |

계산 근거 (현 v1_1 실측):
- update 1회 ≈ $0.0564
- discovery (Stage1+2) 1회 ≈ $0.15
- user 100% 소진: 10×0.0564 + 3×0.15 = $1.014
- 30 user 전원 100% (극단): **$30.3/월** → $50 상한 내 **안전마진 40%** (viewer/editor 분리 폐지로 editor 예산 $7.3 절약)
- admin 본인: 추정 월 $5~10 (개발·QA)
- **전체 월 최악**: $30.3 + $10 = $40.3 → 여전히 $50 내

v1.1 개정 효과: 공용 DB 선참조 (PLAN-P0-longterm-vision) 로 실제 히트율 50%+ 기대 → 실측은 $15~20/월 수준 예상.

### 4.8 정책 변경 관리

- **한도 축소 (10→5 등) 금지 during 파일럿** — 신뢰 하락. 예외: 실측 비용이 예상 2배+ 초과 시에만 공지 후 다음 주기부터 적용.
- **한도 확대는 자유** (피드백 기반 상향).
- **한도 변경 시**:
  1. 운영자가 `UPDATE users SET role = ...` 또는 `UPDATE quotas SET update_limit = ...` 직접 실행
  2. 전체 공지 배너 1주일 유지
  3. 본 플랜 §4.7 테이블 갱신 + 변경 커밋
- **쿼터 정책 번복 프로토콜**: 새 PLAN (`PLAN-P0-quota-v2`) 으로 재개설, 기존 정책 completed/ 에 보존.

## 5. 단계 (Steps)

- [x] **S1** — 브랜치 + v1 본문 작성 (본 문서)
- [ ] **S2** — 사용자 리뷰 & §4 결정 8건 승인 (또는 수정)
- [ ] **S3** — `bash scripts/verify-task.sh` 통과
- [ ] **S4** — commit + push + PR
- [ ] **S5** — PR merge 후 completed/ 자동 이동 → `PLAN-P0-auth-flow` 착수

## 6. 검증 (Verification)

- [ ] §4.1~4.8 8개 영역 모두 **결정·근거·대안 탈락 이유** 3요소 기재
- [x] §4.7 기본값 총합이 월 $50 상한을 **user 30명 100% 소진** 시나리오에서도 넘지 않음 (현재 $30.3, 안전마진 40%)
- [ ] §4.3 SQL 이 schema 의 dual counter 컬럼명(`update_used/limit`, `discovery_used/limit`) 과 완전 일치
- [ ] §4.6 어뷰즈 rate limit 10/분 이 §4.7 개인 상한(13/월) 을 방해하지 않음
- [ ] §4.4 UI 갱신 주기가 §4.3 응답 객체 `quota_after` 와 호환 (PLAN-028 스펙 선제 정의)
- [ ] `bash scripts/verify-task.sh` 통과 (문서만이므로 lint/test/build 영향 0)

## 7. 리스크·롤백

**리스크**:
- **파일럿 중 예산 실측이 예측 2배 초과**: v1_1 실측 기반이지만 사용자 실사용 패턴이 골든셋과 다를 수 있음. → §4.5 80% 경보 + §4.8 축소 예외 조항으로 대응
- **보상 트랜잭션 누락**: Edge Function 에서 API 호출 실패 시 rollback 누락. → PLAN-028 구현 시 try-finally 패턴 필수, 단위 테스트 강제
- **월초 00:00 KST 동시 호출 race**: 리셋 SQL 이 여러 세션에서 동시 실행. → `GREATEST(period_start, $month_start)` idempotent 설계로 해소
- **admin 쿼터 999 가 예산을 혼자 소진**: 테스트 중 예기치 않은 루프. → §4.5 Anthropic Console $60 하드 캡 + 예산 80% email 경보

**롤백**:
- 본 플랜은 스펙 레코드 — 롤백은 §4 재작성
- 파일럿 중 정책 변경 시 새 PLAN (`PLAN-P0-quota-v2`) 개설

## 8. 후속 (Follow-ups)

- **PLAN-028-api-proxy-mvp**: §4.3 SQL + §4.5 예산 상한 체크 Edge Function 구현
- **PLAN-029-client-migration**: §4.4 UI 컴포넌트 (헤더 인디케이터 + 상세 모달)
- **PLAN-P0-auth-flow**: users 역할 배정·Resend 경보 연동
- 유료 티어 (§4.2 C안) — Phase C 분리 플랜
- 쿼터 관리자 대시보드 — Phase B 이후 (현재는 SQL 직접 조정)

## 9. 작업 로그

- **2026-04-21 (초안)**: 스켈레톤 생성. 5개 결정 지점 "권고 후보" 상태.
- **2026-04-21 (v1 본문)**: schema 의 dual counter 구조(`update/discovery` 분리) 에 맞춰 §4.3 SQL·§4.7 기본값 전면 재작성. 8개 결정 확정:
  1. 월초 일괄 KST + lazy reset
  2. 하드 차단 + 리셋일 안내
  3. dual counter 원자성 SQL + 보상 트랜잭션
  4. 헤더 인라인 인디케이터 + 색상 4단계
  5. 예산 $50 상한 + 80% email 경보 + Anthropic Console $60 이중 캡
  6. 분당 10건 rate limit + 로그인 강제
  7. viewer 10/3, editor 30/5, admin 999/999
  8. 파일럿 중 축소 금지, 확대 자유
- **2026-04-22 (v1.1 정합)**: PLAN-P0-longterm-vision 3채널 기여 모델 반영. viewer/editor 분리 폐지 → user 단일화. §4.7 테이블에서 editor 행 제거, 숫자 재계산 (30 user 100%: $30.3/월, 안전마진 40%). §4.5 예산 상한 문구 viewer/editor → user. §2 배경 문구 갱신.
