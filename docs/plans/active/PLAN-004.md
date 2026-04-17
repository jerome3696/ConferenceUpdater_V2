# PLAN-004: QA 백로그 4건 일괄 처리 (Batch 2)

> **상태**: active
> **생성일**: 2026-04-17
> **브랜치**: `feature/PLAN-004-qa-batch2`
> **트랙**: QA(qa-backlog 일괄)

---

## 1. 목표 (What)

`docs/qa-backlog.md` Active 4건을 단일 브랜치에서 처리하고 1 PR로 merge. 완료 기준: `bash scripts/verify-task.sh` 통과, 4건 `[x]` + Completed 이동, 좁은 폭 브라우저 수동 확인 통과.

## 2. 배경·동기 (Why)

PLAN-003 (Batch 1)에서 처리한 word-break 수정이 **좁은 폭**에서 재발 (`overflow-wrap: anywhere` 폴백이 셀 폭 < 단어 폭 조건에서 작동). LinkCell "열기"도 동일 증상. 겸사겸사 이중 헤더 표기·정렬 미세 조정과, 개별 '검증' 버튼 직관성 문제도 함께 정리.

## 3. 범위 (Scope)

### 포함

1. **word-break 재오픈**: `.cell-text`의 `overflow-wrap: anywhere` 제거 + 분류·지역 열 `min-width` 지정 (한글 3자 수용)
2. **LinkCell 보호**: `.cell-text-link` 전용 클래스 or `whitespace-nowrap`으로 "열기" 절단 방지
3. **하위 헤더 표기·정렬**: "기간(일)" → 두 줄 "기간<br>(일)", "주기" → "주기(년)", 모든 하위 헤더 `text-center`
4. **개별 '검증' 버튼 제거**: `MainTable.jsx` 버튼·prop, `App.jsx` `handleRequestVerify` 제거. 전체 검증만 유지

### 제외

- 개별 '업데이트' 버튼 (유지 — 사용자 지시)
- 검증 프롬프트·파서·VerificationCard·큐 로직 (유지)
- PLAN-003 Completed 섹션 원본 항목 (재오픈 표시로 보존 — 패턴 추적)

## 4. 설계 결정

### Item 1 — `overflow-wrap: anywhere` 통째로 제거

- **대안 A**: `overflow-wrap: break-word`로 완화 — 효과 미미, Korean은 여전히 깨짐.
- **대안 B (채택)**: 제거 + 분류·지역 열 `min-width` 지정. 긴 영문 URL은 LinkCell("열기") 아이콘 처리로 이미 우회됨(raw URL을 셀에 쓰지 않음). 메모·학회명은 공백으로 끊기므로 영향 없음.
- **min-width 값**: 한글 3자 + 좌우 패딩(`px-3`=24px) 고려 → `min-w-[4.5rem]` (72px, 한글 기본 글자폭 20~22px 기준).

### Item 3 — 두 줄 표기 방식

- `<br>`로 하드 개행. CSS `white-space: pre-line` 대안은 label 문자열에 `\n`을 넣어야 해서 객체 리터럴이 번잡. `<br>` 직접 JSX 삽입이 간결 — label을 ReactNode로 확장.

### Item 4 — 제거 후 잔여물

- `onRequestVerify` prop은 `MainTable` 시그니처에서 삭제. `App.jsx` 호출부도 삭제. 테스트(`MainTable.test.jsx`)가 `onRequestVerify`에 의존하면 해당 케이스 제거.
- **전체 검증** 기능은 그대로 유지 (`onRequestVerifyAll`, `handleRequestVerifyAll`).

## 5. 단계 (Steps)

- [x] Step 0 — 브랜치 생성, PLAN-004.md 작성
- [x] Step 1 — Item 1: `src/index.css`에서 `overflow-wrap: anywhere` 제거 + `MainTable.jsx`의 분류·지역 열 `min-w-[4.5rem]` (th·td 양쪽, `cellClass` 프로퍼티 도입)
- [x] Step 2 — Item 2: LinkCell 렌더 td에 `whitespace-nowrap` (official/upcoming/last 3곳)
- [x] Step 3 — Item 3: "기간(일)" → `<>기간<br />(일)</>`, "주기" → "주기(년)", 하위 헤더 `text-left` → `text-center`
- [x] Step 4 — Item 4: 개별 '검증' 버튼 + `onRequestVerify` prop, `App.jsx` `handleRequestVerify` 제거. 기존 테스트 90건 그대로 통과
- [x] Step 5 — `verify-task.sh` 5/5 통과 (lint/test 90건/build/secret/size)
- [x] Step 6 — `qa-backlog.md` 4건 [x] + Completed 이동
- [ ] Step 7 — PR 생성

## 6. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 5/5 통과
- [ ] `npm test` 90건(PLAN-003 후) 유지 (Item 4로 1~2건 제거될 수 있음)
- [ ] 브라우저 수동 (`npm run dev`, **좁은 폭** 필수):
  - 분류·지역 셀에서 '박람회'·'전세계'·'아시아' 중간 절단 없음
  - LinkCell "열기" 중간 절단 없음 (세 위치: official_url, upcoming.link, last.link)
  - 이중 헤더 상위는 가운데, 하위도 가운데
  - "기간" / "(일)" 두 줄, "주기(년)" 표기
  - 행 액션: [편집, 업데이트]만 (검증 없음). 전체 검증 버튼은 상단에 그대로
  - 필터 후 전체 검증 → 필터된 rows만 대상

## 7. 리스크·롤백

- **min-width로 인한 가로 스크롤 증가**: 의도된 트레이드오프. 문제 시 `min-w-[4rem]`으로 축소.
- **Item 4 — 기존 사용자 워크플로**: 개별 검증으로 익숙한 사용자는 한 건만 확인할 때 필터를 걸어야 함. 약간의 마찰.
- **테스트 깨짐**: `MainTable.test.jsx`가 onRequestVerify에 의존하는 케이스 있으면 같은 커밋에 갱신.

## 8. 후속 (Follow-ups)

- 해당사항 없음

## 9. 작업 로그

- 2026-04-17: 플랜 작성. QA 4건 누적 후 즉시 배치 처리 요청.
- 2026-04-18: 구현 완료. (1) `.cell-text`에서 `overflow-wrap: anywhere` 제거, 분류·분야·지역 td·th에 `min-w-[4.5rem]`. (2) LinkCell 담는 td 3곳(official/upcoming/last)에 `whitespace-nowrap`. (3) 컬럼 label을 ReactNode 허용으로 확장, "기간(일)" → 두 줄 JSX, "주기" → "주기(년)". 하위 헤더 `text-left` → `text-center`. (4) MainTable에서 `onRequestVerify` prop 삭제 + 개별 검증 버튼 렌더 제거, App.jsx `handleRequestVerify`·prop 전달 제거. verify-task 5/5, 90 테스트 유지.
