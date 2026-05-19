# 학회 DB 관리 웹앱 — dev-guide v3

> **체인 버전**: v3 — `docs/blueprint.md` v3 와 한 쌍 (버전 일치 규칙).
> **역할**: blueprint v3 의 **실행 보드** — 전 PLAN 분해·범위·의존·진행 상태. "무엇"은 blueprint, 여기는 "어떻게·순서·어디까지".
> **최종 수정일**: 2026-05-17
> **문서 관계**: `roadmap.md`(비전) → `blueprint.md`(무엇) → **이 문서(어떻게·진행)** → `plans/PLAN-xxx`(단계 상세). 3축 현황은 `status.md`.

---

## 1. 구현 단계 (상업화 Phase A)

blueprint v3 = 상업화 Phase A(30명 파일럿). 서버 도입 → 클라이언트 이관 → 라이브러리·운영 기반.

| 단계 | 내용 | PLAN | 상태 |
|---|---|---|---|
| A.0 준비 | 멀티테넌트 스키마·쿼터·인증·스택 결정 | P0-multitenant-schema/-quota-policy/-auth-flow/-longterm-vision, 026 | ✅ |
| A.1 서버 MVP | API 프록시 Edge Function·Prompt Caching·쿼터 | 028 | ✅ |
| A.2 클라이언트 이관 | claudeApi.js → 서버, 키 입력 제거, 로그인 UI | 029 | ✅ |
| A.3 라이브러리+운영 | 아래 §2 PLAN 보드 | 030·031·032·033·034·035·036·037·038·039 | 🔵 진행 중 |

(체계: PLAN-027 roadmap 체계 ✅)

---

## 2. A.3 PLAN 보드

범위의 §는 `blueprint.md` 절 번호. **plan 작성 시 이 표에 기록, 완료 시 상태 체크** (CLAUDE.md 워크플로우 3·5).

| PLAN | 범위 (blueprint §) | 의존 | 상태 |
|---|---|---|---|
| PLAN-038 | user_conferences write 경로 §2.1 | - | ✅ |
| PLAN-030 | 라이브러리 스키마+구독+옵트인 동기화 §1.5·§2.4 | PLAN-038 | ✅ (S11 게이팅 PR 머지로 완료) |
| PLAN-031 | audit_log+메타+위젯 §2.6·§5.2·§5.3 | PLAN-030 | ✅ |
| PLAN-032 | AI source_url 확장 §5.1 | - | ✅ |
| PLAN-033 | react-router 7페이지 §6 | - | ✅ |
| PLAN-034 | ICS 구독 URL §4.2 | - | ✅ |
| PLAN-035 | admin 대시보드 §4.3 | PLAN-030·031 | ✅ |
| PLAN-036 | 학회 정체성 매칭 §1.5.2·§2.3 | PLAN-030 | ✅ |
| PLAN-039 | D3 confirm 모달 (발굴 흡수/신규) | PLAN-036 | ✅ |
| PLAN-037 | 구글 OAuth 로그인 + 초대 게이팅 §3.3 | PLAN-033 | ✅ (2026-05-20 완료, PR #69) |
| PLAN-041 | "내 학회" 가상 라이브러리 완성 (발굴 적재+UI) | PLAN-030 | 🔵 active — S2·S3 완료(PR #70), S1(발굴 적재)은 PLAN-040 의존 |
| PLAN-040 | 관리자 기능 정비 — role 권한+마스터 큐레이팅 UI+GitHub 레거시 | PLAN-030·035·041 | 🔵 active (설계 확정 — 착수 대기) |

**작성 순서 권고**: 038 → 030 → 031 → 032 → 033 → 035 → 034 → 036 → 037. (PLAN-038 이 멀티테넌트 데이터 기반, PLAN-030 라이브러리가 이후 작업 기반, PLAN-033 라우터가 페이지 분리 전제.)

---

## 3. 남은 일 (A.3 마감 → 30명 초대)

0. **커스텀 도메인 전환** (`conf-tracker.com`) — 30명 초대 전 권장. 5단계, 30~60분. 상세: `status.md` §3.
1. **PLAN-041** — S2·S3(UI 노출) 완료(PR #70). S1(발굴 적재)은 PLAN-040 의 `conferences_upstream` write 경로 의존.
2. **PLAN-040** — 설계 확정, 착수 대기. 대형 구조 변경 — RLS 마이그레이션은 사용자 적용. 단계별 체크포인트 권장.
3. 사용자 검증·운영 준비 — `docs/status.md` §3 체크리스트.
4. 운영 견고성 (보안 audit + 배포 파이프라인) — blueprint §7.5, 후속 PLAN.

A.3 전체 완료 = blueprint v3 완료 → 사용자에게 v4 전환 질문.

---

## 4. v4 후보 (다음 체인)

Phase B(100명) 진입 시 `blueprint.md` v4 작성. 후보 PLAN: 알림 센터(040)·필터 저장(041)·AI judge 매칭(042)·셀프 계정 삭제(043), 분야 온보딩+프롬프트 v2.0 파라미터화, 공용 DB 동적 TTL, 어뷰즈 감지+flag. Phase C: 결제(050)·티어(051)·공개 댓글(052).

운영 원칙(브랜치·커밋·verify·완료 처리)은 `CLAUDE.md` "작업 워크플로우" 참조.
