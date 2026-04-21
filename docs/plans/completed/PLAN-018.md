# PLAN-018: prompt-designer Skill + 문서 갱신 (PR-5)

> **상태**: completed
> **생성일**: 2026-04-20
> **완료일**: 2026-04-20
> **브랜치**: `feature/PLAN-018-prompt-designer`
> **연관 PR**: #24 (일괄 머지 e925a66 / 개별 커밋 9fd1e95)
> **트랙**: F.2 프롬프트 평가 체계화 · PR-5 (최종)

---

## 1. 목표 (What)

프롬프트 개선 루프의 **분석-설계 의례**를 Skill 한 장으로 고정하고, 관련 운영 문서를 새 파이프라인(XLSX 골든셋 + eval-loop + runs/) 기준으로 정리.

완료 시:
- `.claude/skills/prompt-designer.md` — 6섹션 출력 포맷 · "파일 쓰지 말 것, 본문만" 규약.
- `docs/prompteng.md` §1 현황판 — run.json 기반 포맷으로 갱신.
- `docs/eval/README.md` — XLSX 스키마·runs/ 포맷 최신화 (PR-2/3/4 에서 일부 반영, PR-5 에서 마무리).
- `CLAUDE.md` — `docs/prompts/v{N}.md` ↔ `promptBuilder.js` 동기화 제약 한 줄 추가.

## 2. 배경·동기 (Why)

상위 플랜 §핵심 작업 6·7. PR-1~4 로 인프라(MD 미러 · XLSX 골든 · 필드별 채점 · early-stop 루프) 는 완성됐지만, **분석 과정** 이 여전히 즉흥. 매 세션 메인 에이전트가 어디 봐야 할지·무엇을 비교할지 매번 새로 결정하면 재현성·누락 위험. Skill 은 sub-agent 가 아니라 **메인 에이전트용 체크리스트** — 컨텍스트 격리 없지만 의례 재현성은 확보.

사용자 결정:
- Skill 한 장 (sub-agent 등록 없음).
- Skill 출력은 **본문만**. 실제 `v{N+1}.md` 생성은 사용자가 "OK, 생성해"라고 한 뒤 다음 턴에.

## 3. 범위

### 포함
- `.claude/skills/prompt-designer.md` — 신규.
- `docs/prompteng.md` §1 현황판 — run.json 값 복사 구조로 재편.
- `docs/eval/README.md` — runs/ 설명 보강 (PR-4 에서 누락된 부분).
- `CLAUDE.md` — "비자명한 코드 제약" 에 한 줄 추가.

### 제외
- Skill 자동 파일 쓰기 (본문만 출력 유지).
- `run.json` → §1 현황판 자동 반영 (수동 복사 유지).

## 4. 설계 결정

- **Skill 본문 구조** (6섹션, 고정 순서):
  1. 최근 run 요약 — pass/partial/fail/persistent_failures.
  2. 실패 패턴 매핑 — §6 `P1~P10` 코드 연결.
  3. cycle_years 편향 — 1y/2y/4y 버킷 pass rate.
  4. 제안 레버 — 1~2개, §4 카탈로그 기준 (신규면 이름 부여).
  5. `v{N+1}` 초안 — `v{N}` 대비 diff (System/General/Precise 각각).
  6. 위험·열린 질문.
- **Skill 인자**: `<version>` 또는 `<version_from> vs <version_to>`.
- **암묵 참조**: `docs/prompts/<version>.md`, `docs/eval/runs/*` (최근 3개), `docs/eval/results/*` (최근 5개), `docs/prompteng.md` §4·§6.
- **파일 쓰기 금지**: Skill 본문에 명시. 사용자가 승인해야 다음 턴에 실제 `v{N+1}.md` 생성.
- **CLAUDE.md 제약**: "비자명한 코드 제약" 섹션에 1줄. 60줄 제한 유지 확인.

## 5. 단계

- [ ] Step 1 — `.claude/skills/prompt-designer.md` 작성
- [ ] Step 2 — `docs/prompteng.md` §1 현황판 포맷 갱신 (run.json 기반)
- [ ] Step 3 — `docs/eval/README.md` runs/ 섹션 보강
- [ ] Step 4 — `CLAUDE.md` 한 줄 추가 (60줄 제한 확인)
- [ ] Step 5 — `bash scripts/verify-task.sh`
- [ ] Step 6 — 커밋 + PR

## 6. 검증

- [ ] `bash scripts/verify-task.sh` 전항목 통과
- [ ] `CLAUDE.md` 60줄 이내 유지
- [ ] Skill 이 6섹션·"파일 쓰지 말 것" 규약 포함
- [ ] 수동 (선택): 다음 세션에서 `/prompt-designer v7` 호출 → 6섹션 포맷 출력 검수

## 7. 리스크·롤백

- **저**: Skill 출력이 장황해져 실제 설계보다 양식 채우기에 치우칠 가능성. 완화: 각 섹션 최대 200자 내외 가이드를 Skill 본문에 명시.
- **저**: CLAUDE.md 60줄 초과. 완화: 추가 시 슬림화 가능한 한 줄 찾아 조정.
- 롤백: PR revert.

## 8. 후속

- Stage 2 (후속 플랜): v8 작성 시 MD 먼저 → 코드 반영 순서로 운영 관행 전환.
- Stage 3 (먼 후속): Skill 출력을 `runs/<id>/analysis.md` 에 자동 기록하는 옵션.

## 9. 작업 로그

- 2026-04-20: PR-4 (PLAN-017) 로컬 완료 (41df95c). PR-5 착수.
