# ConferenceFinder — Claude Code 가드레일

> 이 파일은 README 가 아니라 **가드레일**이다 — Claude 가 같은 실수를 반복하지 않게 하는 규칙만 적는다.
> 막혔으면 `docs/status.md` (현황 진입점). 코드로 알 수 있는 것은 여기 적지 않는다.

열유체·건물공조 분야 국제 학회 DB 관리 React SPA. Claude API 웹검색으로 학회 정보 자동 업데이트. 멀티테넌트 서버로 단계적 전환 중. 배포: https://jerome3696.github.io/ConferenceUpdater_V2/

## 명령어
- 빌드 `npm run build` · 테스트 `npm test` · 린트 `npm run lint`
- **작업 완료 후 반드시** `bash scripts/verify-task.sh` (lint+test+build+시크릿+doc-lint).
- 리팩토링 요청 시 `bash scripts/refactor-check.sh` 먼저.

## 문서 체계 (5층 — 각 사실은 한 곳에만 = SSOT)
- `roadmap.md` — 비전·블루프린트 체인 색인 (v1→v2→v3…)
- `status.md` — 현재 상태·3축 현황 (진입점)
- `blueprint.md` — 활성 체인 spec ("무엇"). 버전 vN
- `dev-guide.md` — 활성 체인 실행 보드 ("어떻게·순서·진행"). 버전 = blueprint
- `plans/PLAN-xxx.md` — 한 단계의 상세 실행
- 축②(프롬프트)=`prompteng.md`, 축③(디자인·소기능)=`qa-backlog.md` 가 각자 SSOT.

## 작업 워크플로우
1. 새 방향 → 사용자와 논의해 `blueprint.md`(체인 vN) 작성/갱신.
2. blueprint 구현 단계맵 → `dev-guide.md`(같은 vN)에 단계로 분해.
3. 단계 착수 → 최상세 plan(`docs/plans/active/PLAN-xxx.md`, `TEMPLATE.md` 양식). **작성 즉시 dev-guide 에 "단계 ↔ PLAN-xxx" 기록.**
4. `feature/PLAN-xxx-설명` 브랜치 → 구현 → `verify-task.sh` → PR → merge.
5. plan 완료 → dev-guide 에서 그 단계·PLAN 완료 체크 + plan 을 `completed/` 로 이동 + `status.md` 갱신.
6. 체인 전체 완료 → 사용자에게 정리(blueprint·dev-guide → `legacy/`) + 다음 체인 vN+1 여부 질문.

## 작업 방식
- 협력자다. 지시에 객관·비판·건설적 의견을 견지.
- 새 기능·구조 변경은 의도·예상결과·진행방향을 먼저 요약·확인받기. 단순 버그/오타/스타일은 직진.
- 파일 수정 후 기존 기능 영향 확인.
- **사용자는 개발 초보.** 작업 지시 시 ① 컴퓨터가 할 수 있는 건 먼저 다 끝내고 ② 사용자가 꼭 할 것만 남겨 ③ 명령어·클릭 단위로 자세히 + 왜 하는지까지.

## 작업 규칙
- **브랜치**: `feature/PLAN-xxx-설명` | `fix/설명` | `docs/설명` | `chore/설명` (main 직접 push 금지)
- **커밋**: Conventional Commits — `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`
- API 키 하드코딩 금지. AI 응답 파싱은 try-catch 필수.
- **파괴적 명령 금지**: `--overwrite` `--force` `rm -rf` `git reset --hard` `git clean -fd` 등 사용자 명시 승인 없이 금지.
- 대화형 프롬프트 우회용 파괴 플래그 금지 — 사용자에게 `!<command>` 직접 실행 요청.

## 작업 종류별 가드레일 (조건부 자동 로드)
파일 편집 시 해당 `.claude/rules/` 가 자동 로드 — 비자명한 코드 제약은 거기.
- 축① 기능 → `axis-1-features.md` · 축② 프롬프트 → `axis-2-prompts.md` · 축③ 디자인 → `axis-3-design.md`

## 자가 수정 금지
- **CLAUDE.md 자가 수정 금지**: 사용자 명시 승인 없이 수정 불가. 갱신 제안은 자유.
- **이 파일은 60줄을 넘기지 말 것.** 넘으면 슬림화 우선.
