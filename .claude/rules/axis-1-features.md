---
paths:
  - "src/pages/**"
  - "src/components/**"
  - "src/hooks/**"
  - "src/services/**"
  - "supabase/**"
---

# 축① 핵심 기능 개발 — 가드레일

메이저 기능 개발·개선 작업 시 적용. 진본 문서: `docs/blueprint.md`(무엇) · `docs/dev-guide.md`(어떻게) · `docs/status.md`(현황).

## 비자명한 제약

- **`responseParser.js` ↔ `UpdateCard.jsx`/`VerificationCard.jsx` JSON 구조 일치 필수** — 한쪽 바꾸면 나머지 확인. 어긋나면 런타임 파싱 실패.
- **App.jsx 모달 ↔ react-router 페이지 분리 주의** — PLAN-033 이후 페이지 분리됨. props 전달 누락이 가장 흔한 회귀 지점. 페이지에 상태/콜백 넘길 때 누락 확인.
- **Supabase migration·Edge Function 파괴적 작업**(DROP TABLE, 데이터 삭제, RLS 정책 제거)은 **사용자 명시 승인 없이 금지**.
- AI 응답 파싱은 try-catch 필수. API 키 하드코딩 금지.

## 워크플로우

- 새 기능은 **플랜 먼저**: `docs/plans/active/PLAN-xxx.md` (`docs/plans/TEMPLATE.md` 양식).
- 기능 설계가 바뀌면 `docs/blueprint.md` 해당 섹션 갱신. 구조 변경은 `docs/structure.md`.
- 단계 완료 시 `docs/status.md` 갱신 + PLAN 을 `completed/` 로 이동. 버그·기능 변경은 `docs/changelog.md`.
- 한 단계가 끝나 blueprint v3 전체가 완료되면 사용자에게 v4 전환 여부 질문.
