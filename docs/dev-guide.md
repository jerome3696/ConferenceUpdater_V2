# 학회 DB 관리 웹앱 — dev-guide v3

> **체인 버전**: v3 — `docs/blueprint.md` v3 와 한 쌍 (버전 일치 규칙).
> **역할**: blueprint v3(멀티테넌트+라이브러리)를 **어떤 순서로 구현하나** + 현재 진행 위치. "무엇"은 blueprint, 여기는 "어떻게·순서·진행".
> **최종 수정일**: 2026-05-17
> **문서 관계**: `roadmap.md`(비전·체인) → `blueprint.md`(무엇) → **이 문서(어떻게)** → `plans/PLAN-xxx`(실행). 검증 대기 등 현황 수치는 `docs/status.md`.

---

## 1. 구현 단계 (상업화 Phase A)

blueprint v3 = 상업화 Phase A(30명 파일럿). 서버 도입 → 클라이언트 이관 → 라이브러리·운영 기반 순.

### A.0 준비 ✅ 완료
멀티테넌트 스키마·쿼터 정책·인증 플로우·장기 비전 정합 + 서버 스택 결정.
PLAN-P0-multitenant-schema / -quota-policy / -auth-flow / -longterm-vision, PLAN-026.

### A.1 서버 MVP ✅ 완료
Supabase Auth + DB 스키마, Anthropic API 프록시 Edge Function(키 서버 보관), Prompt Caching, 공용 DB 선참조, 쿼터 카운터.
PLAN-028.

### A.2 클라이언트 이관 ✅ 완료
`claudeApi.js` → 서버 엔드포인트, 브라우저 키 입력 UI 제거, 로그인·쿼터 표시 UI.
PLAN-029.

### A.3 라이브러리 + 운영 기반 — 🔵 진행 중
blueprint v3 §7 PLAN 매핑이 범위 SSOT. 권장 작성 순서: 038 → 030 → 031 → 032 → 033 → 035 → 034 → 036 → 037.

| PLAN | 한 줄 | 상태 |
|---|---|---|
| PLAN-038 | user_conferences write 경로 (starred·overrides Supabase 저장) | ✅ |
| PLAN-030 | 라이브러리 스키마 + 사용자 구독 + 옵트인 동기화 | 🔵 active (구현 대기) |
| PLAN-031 | audit_log + 메타 컬럼 + 자주 편집 학회 위젯 | ✅ |
| PLAN-032 | AI 응답 source_url 확장 (promptBuilder v1_2 + 파서 + UI) | ✅ |
| PLAN-033 | react-router 도입 + 7페이지 분리 | ✅ |
| PLAN-034 | ICS 캘린더 구독 URL Edge Function | ✅ |
| PLAN-035 | admin 대시보드 (사용량·비용·큐레이팅·초대코드) | ✅ |
| PLAN-036 | 학회 정체성 매칭 | ✅ |
| PLAN-039 | D3 confirm 모달 (발굴 흡수/신규 선택) | ✅ |
| PLAN-037 | 비밀번호 + 구글 OAuth 인증 | 🔵 active (기획) |

(체계 작업: PLAN-027 roadmap 체계 ✅)

---

## 2. 남은 일 (A.3 마감 → 30명 초대)

1. **PLAN-030 라이브러리 구현** — 스펙 확정됨. 시드 큐레이션(운영 작업)은 `status.md` 체크리스트.
2. **PLAN-037 OAuth** — 기획 단계. Google Cloud Console OAuth client 선행 필요.
3. **라우터 페이지 콘텐츠 채우기** — PLAN-033 은 7페이지 placeholder 까지. 라이브러리/admin 등 실제 콘텐츠는 PLAN-030/035 흐름.
4. **사용자 검증 + 운영 준비** — `docs/status.md` §검증·운영 대기 체크리스트 참조.

A.3 전체 완료 = blueprint v3 완료 → 사용자에게 **v4(Phase B) 전환** 질문 (§4 규칙).

---

## 3. v4 후보 (다음 체인)

Phase B(100명) 진입 시 `blueprint.md` v4 작성. 후보: 분야 온보딩+프롬프트 v2.0 파라미터화, 공용 DB 선참조 고도화(동적 TTL), 어뷰즈 감지+flag, 알림 센터, 필터 저장, AI judge 매칭, 셀프 계정 삭제. 상세: blueprint v3 §7 Phase B PLAN 목록.

---

## 4. 운영 원칙

- **플랜 먼저**: 각 단계 착수 전 `docs/plans/active/PLAN-xxx.md` 신설 (`docs/plans/TEMPLATE.md`).
- **브랜치**: `feature/PLAN-xxx-설명` · `fix/설명` · `docs/설명` · `chore/설명` (main 직접 push 금지).
- **커밋**: Conventional Commits + 모든 커밋 `bash scripts/verify-task.sh` 게이트 통과.
- **단계 완료 시**: `docs/status.md` 갱신. PLAN 을 `completed/` 로 이동. 한 단계가 끝나 blueprint v3 전체가 완료되면 사용자에게 정리(legacy 이관 + v4 신설) 여부를 질문.
- **순서 강제 없음**: 의존성·블로커만 존중. 트랙 전환 자유.
