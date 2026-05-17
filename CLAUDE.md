# ConferenceFinder — Claude Code 가드레일

> 이 파일은 README 가 아니라 **가드레일**이다 — Claude 가 같은 실수를 반복하지 않게 하는 규칙만 적는다.
> 프로젝트 현황·로드맵·문서 지도는 **`docs/status.md`** (진입점). 코드로 알 수 있는 것은 여기 적지 않는다.

열유체·건물공조 분야 국제 학회 DB 관리 React SPA. Claude API 웹검색으로 학회 정보 자동 업데이트. 멀티테넌트 서버로 단계적 전환 중. 배포: https://jerome3696.github.io/ConferenceUpdater_V2/

## 명령어
- 빌드 `npm run build` · 테스트 `npm test` · 린트 `npm run lint`
- **작업 완료 후 반드시** `bash scripts/verify-task.sh` (lint+test+build+시크릿+doc-lint).
- 리팩토링 요청 시 `bash scripts/refactor-check.sh` 먼저 → 결과 기반 대상 선정.

## 작업 방식
- 협력자다. 지시에 객관·비판·건설적 의견을 견지.
- 새 기능·구조 변경은 의도·예상결과·진행방향을 먼저 요약·확인받기. 단순 버그/오타/스타일은 직진.
- 파일 수정 후 기존 기능 영향 확인.

## 작업 규칙
- **브랜치**: `feature/PLAN-xxx-설명` | `fix/설명` | `docs/설명` | `chore/설명` (main 직접 push 금지)
- **커밋**: Conventional Commits — `feat:` `fix:` `docs:` `refactor:` `test:` `chore:`
- 새 기능은 플랜 먼저: `docs/plans/active/PLAN-xxx.md` (`docs/plans/TEMPLATE.md` 양식) → feature 브랜치 → 구현 → verify-task → PR → merge.
- API 키 하드코딩 금지. AI 응답 파싱은 try-catch 필수.
- **파괴적 명령 금지**: `--overwrite` `--force` `rm -rf` `git reset --hard` `git clean -fd` 등은 사용자 명시 승인 없이 금지. 특히 루트·`docs/` 대상.
- 대화형 프롬프트 우회용으로 파괴 플래그 쓰지 말고 사용자에게 `!<command>` 직접 실행 요청.

## 작업 종류별 가드레일 (조건부 자동 로드)
파일을 편집하면 해당 `.claude/rules/` 규칙이 자동 로드된다 — 비자명한 코드 제약은 거기 있다.
- 축① 기능 (`src/pages`·`components`·`services`·`supabase`) → `axis-1-features.md`
- 축② 프롬프트 (`promptBuilder.js`·`docs/prompts/`·`claudeApi.js`) → `axis-2-prompts.md`
- 축③ 디자인 (`*.css`) → `axis-3-design.md`

## 단계 완료 시
- `docs/status.md` 갱신. 완료 PLAN 은 `docs/plans/completed/` 로 이동.
- blueprint v3 한 단계가 끝나면 사용자에게 status 정리·다음 단계 여부 질문. v3 전체 완료 시 v4 전환 질문.

## 자가 수정 금지
- **이 파일(CLAUDE.md) 자가 수정 금지**: 사용자 명시 요청·승인 없이 수정 불가. 갱신 제안은 자유.
- **이 파일은 60줄을 넘기지 말 것.** 넘으면 슬림화 우선.
