# ConferenceFinder — 현황 (STATUS)

> **막혔으면 여기부터.** 이 문서 = "지금 어디까지 왔나"의 단일 출처(SSOT).
> **진본 3종**: `roadmap.md`(비전·체인) · `blueprint.md`(무엇 만드나) · `dev-guide.md`(어떻게 만드나).
> **최종 수정일**: 2026-05-19

---

## 1. 지금 어디

- **활성 체인**: **v3** — 멀티테넌트 + 라이브러리 (상업화 Phase A, 30명 파일럿).
- **단계**: dev-guide v3 §A.3 라이브러리·운영 기반 **진행 중**. A.0~A.2 완료, PLAN-030(라이브러리) 완료.
- **다음**: PLAN-037(OAuth, 기획) · PLAN-040(관리자 기능 정비, 기획) · 아래 검증 5건.

---

## 2. 3축 현황

### 축① 핵심 기능 개발 — `blueprint.md` / `dev-guide.md`
- A.3 PLAN 대부분 머지 완료 (030·031·032·033·034·035·036·038·039).
- **active**: PLAN-037 (OAuth, 기획) · PLAN-040 (관리자 기능 정비, 기획).
- 규칙: `.claude/rules/axis-1-features.md`.

### 축② 학회검색·업데이트 프롬프트 — `prompteng.md`
- **활성 프롬프트 버전**: `v1_2` (PR #49 머지, `promptBuilder.js` `DEFAULT_UPDATE_VERSION`).
- v1_2 = v1_1 측정(19/27) 후 source_url·[근거] 보강판.
- 다음 레버·잔존 실패 패턴: `prompteng.md` §1 현황판 / §4 레버 / §6 패턴.
- 규칙: `.claude/rules/axis-2-prompts.md`.

### 축③ 디자인·소규모 기능 — `qa-backlog.md`
- 누적 이슈: **0건** (Active 비어 있음). 5~10건 모이면 일괄 플랜화.
- UI 결정 로그: `design.md`.
- 규칙: `.claude/rules/axis-3-design.md`.

---

## 3. 검증·운영 대기 (사용자 수동 — 코드로 처리 불가)

A.3 후반 머지분의 실측 검증. 출처: 구 `legacy/session-report-2026-05-09.md`.

- [ ] **PR #55 audit_log Edge Function 배포** — `supabase functions deploy claude-proxy` → 학회 1건 update 후 `audit_log` row 생성 + `edited_count` 증가 확인.
- [ ] **PR #57 react-router 회귀 테스트 (가장 중요)** — 재배포 후 별표·update·verify·GitHub 커밋·쿼터·캘린더·헤더 메뉴·로그아웃/재진입 전수 확인. 위험: App.jsx 모달↔페이지 분리 props 누락.
- [ ] **PR #56 발굴 흡수/신규 선택** — `/#/discovery` 에서 기존 학회 매칭 시 배너 + [기존 별표]/[새로 추가] 버튼 동작.
- [ ] **PR #49 v1_2 [근거] 링크 실측** — 카드 필드 옆 `[근거]` 노출 + claude-proxy 응답 `_sources` 확인. 실패 시 `promptBuilder.js` `DEFAULT_UPDATE_VERSION` → `v1_1` 롤백.
- [x] ~~Resend 도메인 verify~~ — 완료 (2026-05-19, `conf-tracker.com` 인증 + Supabase 발신주소 `noreply@conf-tracker.com`).
- [ ] **운영 준비 3건** — Google OAuth client 생성 / 라이브러리 시드 큐레이션(32학회) / admin 큐레이팅 UI(→ PLAN-040 으로 이관).

---

## 4. 문서 지도

문서 5층 체계(roadmap/status/blueprint/dev-guide/plan)와 작업 워크플로우는 **`CLAUDE.md`** 가 SSOT.

- 다음에 뭘 할까 / PLAN 진행 상태 → `dev-guide.md`
- 무엇을 만드나(설계) → `blueprint.md` · 장기 비전·체인 → `roadmap.md`
- 프롬프트(축②) → `prompteng.md` · 디자인·소규모(축③) → `qa-backlog.md` · 코드 맵 → `structure.md`
- 완료·대체된 과거 문서 → `docs/legacy/`

---

## 5. 갱신 규칙

- PLAN 완료·단계 전환 시 §1·§2 갱신.
- 검증 항목 완료 시 §3 체크박스 `[x]`.
- 이 문서는 **현재 상태만** — 코드로 알 수 있는 것(스택·파일 위치 등)은 적지 않는다.
- 문서 규율 자동 점검: `bash scripts/doc-lint.sh`.
