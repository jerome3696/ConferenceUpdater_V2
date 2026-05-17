---
paths:
  - "src/utils/promptBuilder.js"
  - "src/services/claudeApi.js"
  - "src/services/responseParser.js"
  - "docs/prompts/**"
  - "scripts/eval-*.js"
---

# 축② 학회검색·업데이트 프롬프트 — 가드레일

프롬프트 개선 작업 시 적용. 진본 문서: `docs/prompteng.md` (축② SSOT). 버전은 프롬프트 버전(v1_x)으로 독립 관리 — blueprint 체인 버전과 무관.

## 비자명한 제약

- **프롬프트 변경은 `src/utils/promptBuilder.js` + `docs/prompts/v{N}_{M}.md` 양쪽 동기 필수** — 동기화 테스트로 묶임. 한쪽만 고치면 CI 실패.
- **이전 프롬프트 버전은 불변(immutable)** — 새 버전 추가만. 현재 활성: `v1_2`.
- **`src/services/claudeApi.js` 는 브라우저·Node 양쪽에서 사용** — 브라우저 전용 API 금지.
- **`responseParser.js` ↔ `UpdateCard.jsx`/`VerificationCard.jsx` JSON 구조 일치 필수.**

## 워크플로우

- 프롬프트 분석·설계는 `prompt-designer` skill 호출 (6섹션 포맷, 분석만 — 파일 생성은 사용자 승인 후 다음 턴).
- 프롬프트 변경 후 `docs/prompteng.md` §5 실행 로그 + §1 현황판 갱신.
- eval 실행 결과는 `docs/eval/runs/` (gitignore 됨, 로컬 재생성).
- 신규 학회/도메인 패턴 한두 건은 우선 `docs/qa-backlog.md` — 5~10건 모이면 일괄 분석.
