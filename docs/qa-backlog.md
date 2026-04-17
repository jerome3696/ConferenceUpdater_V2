# QA Backlog

사용 중 발견한 개선사항을 즉시 코딩하지 않고 누적 → 5~10건 모이면 일괄 처리.

## 사용법

- **추가**: 한 줄에 `- [ ] 설명 (YYYY-MM-DD)` 형식. 짧게. 재현 단서가 있으면 함께.
- **그룹화**: 추가 시점에 분류하지 말 것. 처리 시점에 AI가 그룹핑.
- **처리**: 5~10건 모이면 "qa-backlog 처리해줘" 요청 → AI가 유사 이슈 그룹핑 → 플랜 작성 (`docs/plans/active/`) → feature branch에서 일괄 수정 → verify → PR → merge.
- **완료**: 처리된 항목은 `[x]`로 체크 (지우지 말 것 — 패턴 추적용).
- **에스컬레이션**: 한 항목이 명백히 큰 작업이면 즉시 `docs/plans/active/`로 승격.

자세한 워크플로우: `docs/dev-guide-v2.md` §6.

---

## Active (미처리)

<!-- 아래에 한 줄씩 추가 -->

- [ ] 부분 정보 학회(장소만 있고 날짜 없는 케이스)에서 UpdateCard에 confidence badge + source_url 링크 표시 — ICMF처럼 신뢰도 낮은 초기 정보를 사용자가 판단하기 어려움 (2026-04-17)
- [ ] React 19 advisory 룰 cleanup — `react-hooks/set-state-in-effect` 다수 + `react-hooks/purity` 1건 + `react-refresh/only-export-components` 2건. Step A.2에서 warn으로 완화. 별도 PR로 일괄 fix 후 룰 등급 다시 error로 복귀 (2026-04-17)
- [ ] 업데이트 완료 후 UpdatePanel에 '전체 승인' / '전체 거절' 일괄 버튼 추가 — 전체 업데이트 결과가 많을 때 개별 수용/리젝 반복 부담 (2026-04-17)

---

## Completed

<!-- 처리 완료된 항목을 [x]로 옮김. 지우지 말 것. 처리한 PR/플랜 링크 함께. -->
