---
paths:
  - "src/**/*.css"
---

# 축③ 디자인·소규모 기능 — 가드레일

CSS·UI 디자인·소규모 개선 작업 시 적용. 진본 문서: `docs/qa-backlog.md` (축③ SSOT) · `docs/design.md` (UI 결정 로그).

## 워크플로우

- **소규모 이슈는 즉시 코딩하지 말 것** — `docs/qa-backlog.md` Active 에 `- [ ] 설명 (YYYY-MM-DD)` 한 줄로 누적.
- 5~10건 모이면 "qa-backlog 처리해줘" → 그룹핑 → `docs/plans/active/` 플랜 → feature branch 일괄 수정 → `bash scripts/verify-task.sh` → PR.
- 처리 완료 항목은 지우지 말고 `[x]` 체크 (패턴 추적용).
- **UI/디자인 결정**(색상·버튼·모달 크기 등)은 `docs/design.md` 결정 로그에 기록 — 왜 그렇게 정했는지가 핵심.
- 명백히 큰 작업이면 qa-backlog 거치지 말고 바로 `docs/plans/active/` 로 승격.
