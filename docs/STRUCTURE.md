# 코드 구조 맵

> 어떤 기능을 바꾸려면 어느 파일을 열어야 하는지 빠르게 찾기 위한 문서.

## 화면/컴포넌트

| 파일 | 역할 |
|---|---|
| `src/App.jsx` | 최상위 레이아웃 + 헤더 |
| `src/components/MainTable/MainTable.jsx` | 메인 테이블 (정렬, 필터 적용, 이중 헤더) |
| `src/components/MainTable/FilterBar.jsx` | 분류/분야/지역 드롭다운 + 텍스트 검색 |

## 데이터/상태

| 파일 | 역할 |
|---|---|
| `public/data/conferences.json` | 학회 마스터 + editions 원본 데이터 |
| `src/hooks/useConferences.js` | JSON 로드, upcoming/past edition 매칭, 날짜 자동 전환 |

## 유틸

| 파일 | 역할 |
|---|---|
| `src/utils/dateUtils.js` | 날짜 포맷, 오늘 날짜(ISO), 만료 판정 |

## 설정/배포

| 파일 | 역할 |
|---|---|
| `vite.config.js` | Vite 빌드 설정 (`base` = GitHub Pages 경로) |
| `.github/workflows/deploy.yml` | main 브랜치 push 시 GitHub Pages 자동 배포 |
| `tailwind.config.js` / `postcss.config.js` | Tailwind 설정 |

## 앞으로 추가될 위치 (Phase 2~3)

| 기능 | 위치 예정 |
|---|---|
| Claude API 호출 | `src/services/claudeApi.js` |
| 프롬프트 생성 | `src/utils/promptBuilder.js` |
| pass/검색 판단 | `src/services/updateLogic.js` |
| API 키 관리 | `src/hooks/useApiKey.js` + `src/components/common/ApiKeyModal.jsx` |
| 업데이트 페이지 | `src/components/UpdatePanel/` |
