# ConferenceFinder

- 열유체·건물공조 분야 국제 학회 DB 관리 React SPA. 
- Claude API 웹검색으로 학회 정보 자동 업데이트. 
- **아키텍처는 단계적 전환 중** — 현재: GitHub Pages 정적 + JSON/localStorage 단일 사용자 / 향후: 서버 도입 → 개인 DB 제공 제품화 (`docs/blueprint.md` §7).
- 배포: https://jerome3696.github.io/ConferenceUpdater_V2/

## 현재 상태

MVP v1.0.0 완료 → Post-MVP (dev-guide v2) Track A·B·C 완료 — PLAN-009(캘린더) + PLAN-010(scope 3-option + ICS + 즐겨찾기 이진화) + QA Batch 1~2. **현재: dev-guide v3. F.1 Phase 1 Last-edition 1차 채움 완료 (PR #21, 2026-04-20) — past 보유 master 2→29 전수. 다음: F.1 Phase 2 (update 프롬프트/로직 정교화).** 상세: `docs/dev-guide-v3.md`, `docs/plans/active/PLAN-011.md`.

## 문서 맵 (작업 종류별)

| 언제 | 무엇을 읽어라 |
|---|---|
| Step·트랙 진행 / 진행 상황 확인 | `docs/dev-guide-v3.md` (완료된 v1·v2는 `docs/legacy/`) |
| 기능 설계 / 구현 가능성 판단 | `docs/blueprint.md` |
| 프롬프트 변경·평가 | `docs/prompteng.md` (현황판 §1, 레버 §4, 패턴 §6) |
| UI/디자인 결정 | `docs/design.md` |
| 코드 구조 탐색 | `docs/structure.md` |
| 사용 중 이슈 수집·일괄 처리 | `docs/qa-backlog.md` |
| 새 기능 플랜 작성 | `docs/plans/TEMPLATE.md` |

`docs/legacy/`·`docs/reference/`는 명시 요청 없으면 진입 불요.

## 작업 흐름
1. 플랜 작성 → `docs/plans/active/PLAN-xxx.md`
2. `feature/PLAN-xxx-설명` 브랜치 생성
3. 코드 구현 (feature branch에서만)
4. `bash scripts/verify-task.sh` → 전항목 통과
5. 커밋 (Conventional Commits)
6. PR → CI 통과 확인
7. merge → 플랜 `completed/`로 자동 이동

## 작업 방식
- 협력자다. 지시에 객관·비판·건설적 의견을 견지.
- 새 기능·구조 변경은 의도·예상결과·진행방향을 먼저 요약·확인받기. 단순 버그/오타/스타일은 직진.
- 파일 수정 후 기존 기능 영향 확인.
- **이 파일(CLAUDE.md) 자가 수정 금지**: 사용자 명시 요청·승인 없이 수정 불가. 갱신 제안은 자유 (요청·승인 후 수정). 단, "현재 상태" 한 줄 갱신은 자동 허용.
- **이 파일은 60줄을 넘기지 말 것.** 넘으면 슬림화 우선.

## 작업 규칙
- **작업 완료 후 반드시 `bash scripts/verify-task.sh` 실행할 것.**
- **리팩토링 요청 시** `bash scripts/refactor-check.sh` 먼저 실행 → 결과 기반 대상 선정·제안.
- **브랜치**: `feature/PLAN-xxx-설명` | `fix/설명` | `docs/설명` | `chore/설명` (main 직접 push 금지)
- **커밋**: Conventional Commits — `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`
- API 키 하드코딩 금지. AI 응답 파싱은 try-catch 필수.
- **파괴적 명령 금지**: `--overwrite`, `--force`, `rm -rf`, `git reset --hard`, `git clean -fd` 등은 사용자 명시 승인 없이 실행 금지. 특히 루트·`docs/` 대상은 더더욱.
- 대화형 프롬프트 우회용으로 파괴 플래그 쓰지 말고 사용자에게 `!<command>` 직접 실행 요청.

## 비자명한 코드 제약
- 프롬프트 변경은 `src/utils/promptBuilder.js` + `docs/prompts/v{N}.md` **양쪽 동기** (동기화 테스트로 묶임 — 한쪽만 고치면 CI 실패). 이전 버전 불변, 활성: v4
- `src/services/claudeApi.js`는 브라우저·Node 양쪽에서 사용 (브라우저 전용 API 금지)
- `responseParser.js` ↔ `UpdateCard.jsx`/`VerificationCard.jsx`의 JSON 구조 일치 필수 — 하나 바꾸면 나머지 확인

## 문서 갱신 트리거
- Step 완료: `docs/dev-guide-v2.md` 체크박스 [x], CLAUDE.md "현재 상태" 한 줄 갱신
- 프롬프트 변경: `docs/prompteng.md` §5 로그 + §1 현황판
- 구조/디자인/기능설계 변경: `structure.md` / `design.md` / `blueprint.md` 해당 섹션
- 버그·기능 변경: `docs/changelog.md`
