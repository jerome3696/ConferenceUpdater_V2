# 코드 구조 맵

> 어떤 기능을 바꾸려면 어느 파일을 열어야 하는지 빠르게 찾기 위한 문서.

## 화면/컴포넌트

| 파일 | 역할 |
|---|---|
| `src/App.jsx` | 최상위 레이아웃 + 뷰 전환(메인/업데이트) + 업데이트/검증 핸들러 |
| `src/components/common/Header.jsx` | 상단 헤더 (저장 상태, API 키/GitHub 토큰 모달 열기) |
| `src/components/common/ApiKeyModal.jsx` / `GitHubTokenModal.jsx` | 각종 토큰/키 입력 모달 |
| `src/components/MainTable/MainTable.jsx` | 메인 테이블 (정렬, 필터, 이중 헤더, 행별 편집/업데이트/검증 버튼) |
| `src/components/MainTable/FilterBar.jsx` | 분류/분야/지역 드롭다운 + 텍스트 검색 |
| `src/components/MainTable/ConferenceFormModal.jsx` | 학회 추가/편집 모달 |
| `src/components/UpdatePanel/UpdatePanel.jsx` | 업데이트/검증 현황 페이지 (진행률, pending 카드 분기 렌더) |
| `src/components/UpdatePanel/UpdateCard.jsx` | 업데이트 결과 카드 (upcoming 필드 diff, 수용/리젝) |
| `src/components/UpdatePanel/VerificationCard.jsx` | 정합성 검증 카드 (필드별 일치/불일치/확인불가 뱃지, 수정 제안 수용/무시) |
| `src/components/UpdatePanel/UpdateLog.jsx` | 처리 로그 (kind 뱃지로 업데이트/검증 구분) |

## 데이터/상태

| 파일 | 역할 |
|---|---|
| `public/data/conferences.json` | 학회 마스터 + editions 원본 데이터 |
| `src/hooks/useConferences.js` | JSON 로드, upcoming/past edition 매칭, 날짜 자동 전환, `applyAiUpdate`/`applyVerifyUpdate` |
| `src/hooks/useUpdateQueue.js` | AI 큐 (업데이트/검증 공용 — item.kind로 분기) |
| `src/hooks/useApiKey.js` / `useGitHubToken.js` | 토큰/키 localStorage 관리 |
| `src/services/claudeApi.js` | Claude messages API 호출 + `ClaudeApiError` |
| `src/services/dataManager.js` | JSON 로드·저장·GitHub 커밋 |
| `src/services/exportService.js` | xlsx/JSON 내보내기 |
| `src/services/responseParser.js` | 업데이트/검증 응답 파싱 (`parseUpdateResponse`, `parseVerifyResponse`) |
| `src/services/updateLogic.js` | 전체 업데이트 pass/검색 판단 |
| `src/utils/promptBuilder.js` | 프롬프트 템플릿 (버전 기반, update/verify 각각 v1) |

## 유틸

| 파일 | 역할 |
|---|---|
| `src/utils/dateUtils.js` | 날짜 포맷, 오늘 날짜(ISO), 만료 판정 |
| `src/config/models.js` | 업데이트/검증 별 Claude 모델 지정 |

## 설정/배포

| 파일 | 역할 |
|---|---|
| `vite.config.js` | Vite 빌드 설정 (`base` = GitHub Pages 경로) |
| `.github/workflows/deploy.yml` | main 브랜치 push 시 GitHub Pages 자동 배포 |
| `tailwind.config.js` / `postcss.config.js` | Tailwind 설정 |

## 평가/스크립트

| 파일 | 역할 |
|---|---|
| `scripts/eval-prompt.js` | 골든셋 기반 프롬프트 평가 러너 |
| `scripts/csv-to-golden.js` / `refresh-golden.js` | 골든셋 CSV↔JSON 동기화 |
| `docs/eval/golden-set.json` / `.csv` | 평가 정답지 |

## 문서

| 파일 | 역할 |
|---|---|
| `README.md` | 프로젝트 소개, 사용법, API 키/PAT 안내 (프로젝트 루트) |
| `CLAUDE.md` | Claude Code 작업 지침 + 현재 상태 + 문서 업데이트 규칙 |
| `docs/blueprint.md` | 프로그램 설계 (What) |
| `docs/dev-guide.md` | 개발 순서 (How) — MVP까지 |
| `docs/DESIGN.md` | UI 디자인 결정 로그. UI 수정 시 갱신 |
| `docs/CHANGELOG.md` | 변경 이력 (v1.0 MVP 이후). 디자인 *이유*는 DESIGN.md, 프롬프트 *실행*은 PROMPT_LOG.md |
| `docs/PROMPT_LOG.md` / `PROMPT_STRATEGY.md` | 프롬프트 실행 이력 / 개선 전략 |
| `docs/RATE_LIMIT_STRATEGY.md` | API rate limit 대응 로드맵 |
