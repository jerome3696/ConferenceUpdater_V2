# ConferenceFinder

## 프로젝트 요약

열유체·건물공조 분야 국제 학회 DB 관리 웹앱 (React SPA).
Claude API 웹 검색으로 학회 정보를 자동 업데이트하는 것이 핵심 기능.
서버 없는 정적 호스팅(GitHub Pages) 구조이며, 유료 서비스는 Claude API만 사용.

## 필수 참조 문서

작업 시작 전에 반드시 아래 문서를 읽을 것.

- docs/blueprint.md: 프로그램의 "무엇(What)" — 데이터 구조, 기능 정의, 화면 구성
- docs/dev-guide.md: 개발의 "어떻게(How)" — 기술 스택, 개발 순서, 주의사항 (MVP까지)
- docs/CHANGELOG.md: 변경 이력 (MVP 완성 후 생성)
- docs/PROMPT_LOG.md: 프롬프트 최적화 시도 이력 (Phase 3부터 생성)
- docs/STRUCTURE.md: 사용자를 위한 코드 구조 맵 (Phase 1 완료 후 생성)

## 현재 상태

- Phase 3 Step 3.4 완료 (전체 업데이트 — pass 로직, 진행률, 중단) / 다음: Step 3.5 (정합성 검증)
- 프롬프트 최적화(v2, 토큰 절감 등)는 MVP 외 별도 과업으로 `docs/PROMPT_STRATEGY.md` 참조
- 알려진 이슈: 없음

## 기술 스택

- React 18 + Vite + Tailwind CSS
- 데이터: JSON 파일 + localStorage (서버 없음)
- AI: Claude API (claude-sonnet-4-20250514) + web_search 도구
- 배포: GitHub Pages

## 작업 방식

- 당신은 실행자가 아니라 협력자다. 지시에 대해 객관적, 비판적, 건설적 의견을 견지하라.
- 새로운 기능 구현이나 구조 변경 시에는 바로 코딩하지 말고, 의도·예상 결과·진행 방향을 먼저 요약하여 확인을 받아라.
- 단순 버그 수정, 오타 수정, 스타일 변경 등 명확한 작업은 바로 진행해도 된다.
- 한 번에 하나의 Step만 작업할 것.
- 파일 수정 후 기존 기능이 깨지지 않는지 확인할 것.

## 작업 규칙

- API 키를 코드에 하드코딩하지 말 것.
- AI 응답 파싱은 반드시 try-catch로 감쌀 것.
- **파괴적 명령 절대 금지**: `--overwrite`, `--force`, `rm -rf`, `git reset --hard`, `git clean -fd` 등은 사용자 명시 승인 없이 절대 실행하지 말 것. 특히 프로젝트 루트나 docs/ 디렉토리 대상으로는 더더욱.
- 스캐폴딩 도구(`npm create`, `npx create-*` 등) 실행 전, 대상 디렉토리에 기존 파일(특히 docs/, CLAUDE.md)이 있으면 반드시 먼저 사용자에게 확인할 것.
- 대화형 프롬프트를 우회하려고 파괴적 플래그를 쓰지 말 것. 대신 사용자에게 `!<command>`로 직접 실행을 요청할 것.

## 문서 업데이트 규칙 (작업 완료 시 자동 수행)

아래 규칙은 해당 조건이 충족될 때 **매번 반드시** 수행할 것. 사용자가 별도로 요청하지 않아도 자동으로.

- Step 완료 시: docs/dev-guide.md의 해당 체크박스를 [x]로 표시
- Step 완료 시: 이 파일(CLAUDE.md)의 "현재 상태"를 다음 Step으로 갱신
- 프롬프트 변경 시: docs/PROMPT_LOG.md에 시도 내용과 결과 기록
- 큰 구조 변경 시: docs/STRUCTURE.md 업데이트
- 버그 수정/기능 변경 시 (MVP 이후): docs/CHANGELOG.md에 기록
- 기능 설계가 바뀐 경우 (MVP 이후): docs/blueprint.md 해당 섹션 업데이트

## 코드 컨벤션

- 함수형 컴포넌트 + Hooks
- 파일명: PascalCase (컴포넌트), camelCase (유틸/서비스)
- 한국어 주석 사용 가능

## 코드 구조 참고

- 프롬프트 변경은 src/utils/promptBuilder.js만 수정 (버전 기반 — v1, v2 공존)
- API 호출 로직은 src/services/claudeApi.js (브라우저·Node 양쪽에서 사용)
- 응답 파싱/스키마는 src/services/responseParser.js
- pass/검색 판단 로직은 src/services/updateLogic.js (Step 3.4에서 생성 예정)
- 이 파일들의 JSON 응답 구조가 서로 맞아야 함 — 하나를 바꾸면 나머지도 확인할 것
- 프롬프트 평가: scripts/eval-prompt.js + docs/eval/golden-set.json. 프롬프트 바꾸면 반드시 재실행 후 docs/PROMPT_LOG.md에 결과 기록
