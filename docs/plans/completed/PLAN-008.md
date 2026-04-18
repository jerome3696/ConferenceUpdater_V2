# PLAN-008: MainTable 훅 분리 (useSorting / useFiltering)

> **상태**: active
> **생성일**: 2026-04-18
> **완료일**: —
> **브랜치**: `feature/PLAN-008-maintable-hooks`
> **연관 PR**: TBD
> **트랙**: B (품질)

---

## 1. 목표 (What)

`MainTable.jsx` 의 정렬·필터 로직을 `src/hooks/useSorting.js`, `src/hooks/useFiltering.js` 로 추출해 MainTable 의 useState 밀도를 7 → 4 이하로 낮추고, 훅 단위 테스트로 경로 보증.

## 2. 배경·동기 (Why)

2026-04-18 `bash scripts/refactor-check.sh` 결과:
- `MainTable.jsx` 370줄 (warning)
- useState 7개 (warning) — sortKey / sortDir / filters / modalMode / editingRow / collapsed (+import)

구체적으로 sorting(sortKey+sortDir+onSort+`getSortValue`+`sorted` useMemo)과 filtering(filters+`filtered` useMemo+options useMemo) 로직이 테이블 렌더링과 혼재. 이 두 묶음은 서로 독립적이고, 테이블 외 다른 목록 화면에서도 재사용 가능성이 있다.

MainTable은 이미 `MainTable.test.jsx` 9건으로 정렬·필터 동작이 커버되어 있어 리팩토링 안전망이 확보됨.

## 3. 범위 (Scope)

### 포함
- `src/hooks/useSorting.js` 신규 — `useSorting(rows, getValue, initialKey, initialDir = 'asc')` → `{ sortKey, sortDir, onSort, sorted }`
- `src/hooks/useFiltering.js` 신규 — `useFiltering(rows)` → `{ filters, setFilters, filtered, options: { categories, fields, regions } }`
- `MainTable.jsx` 에서 두 훅 사용으로 교체 + 내부 useMemo/useState 제거
- `src/hooks/useSorting.test.js`, `src/hooks/useFiltering.test.js` 신규

### 제외 (Non-goals)
- 컬럼 정의(GROUPS 상수)·렌더링 로직 분리 — 별도 작업
- Modal state (`modalMode`, `editingRow`) / collapsed state 분리 — 로컬 UI 상태로 MainTable 유지
- `getSortValue` 함수 외부화 — MainTable 소유 유지 (컬럼 키→row 필드 매핑은 테이블 고유)

## 4. 설계 결정

- **getValue 주입**: `useSorting` 에 sort key→값 추출 함수를 주입해 훅을 컴포넌트 중립적으로 유지. MainTable 이 `getSortValue` 를 소유하고 훅에 전달.
- **empty-last 정렬**: 기존 `MainTable.jsx` 의 empty-last 로직(빈 값은 뒤로, 같으면 `full_name` fallback)을 훅에 그대로 이관. 이 정렬 규칙은 "미래 개최 일정이 확정된 학회부터 보이게" 라는 도메인 요구에서 유래 — 훅에 내재화해도 재사용성 해치지 않는 수준.
- **options 계산**: useFiltering 에 포함. MainTable 이 FilterBar 에 전달할 categories/fields/regions 를 훅에서 제공.
- **filters 구조**: 기존 `{ category, field, region, query }` 동일 유지. FilterBar 계약 불변.

## 5. 단계

- [x] Step 1 — `src/hooks/useSorting.js` 작성 (empty-last 비교자 포함)
- [x] Step 2 — `src/hooks/useFiltering.js` 작성 (options 포함)
- [x] Step 3 — `MainTable.jsx` 에서 훅 사용 + 중복 useMemo/useState 제거
- [x] Step 4 — `useSorting.test.js` (4 tests) · `useFiltering.test.js` (6 tests) 작성
- [x] Step 5 — verify-task ✅ 5/0 (132 tests), refactor-check 개선 확인

## 5.1 달성도 (2026-04-18)

| 지표 | Before | After | 목표 | 판정 |
|---|---|---|---|---|
| `MainTable.jsx` 줄 수 | 370 | 330 | <300 | 부분 (300 미달이나 40줄 감소) |
| `MainTable.jsx` useState | 7 | 4 | ≤4 | ✅ (warning tier 탈출) |
| 훅 단위 테스트 | 0 | 10 (useSorting 4 + useFiltering 6) | 있음 | ✅ |
| 기존 MainTable.test.jsx 9 tests | pass | pass 불변 | pass | ✅ |

**평가**: useState 밀도 목표 달성, 훅 재사용 경로 확보. 줄 수 <300 돌파는 GROUPS 상수 분리나 row 컴포넌트 추출이 필요 — 별도 작업.

## 6. 검증

- `npm run test` — 기존 122 tests + 추가 훅 tests 전건 통과
- 기존 `MainTable.test.jsx` 9 tests (정렬·필터·렌더링·레이아웃) 변경 없이 통과 — 이것이 최대 안전망
- `scripts/refactor-check.sh` — `MainTable.jsx` 줄 수 감소 + useState warning 해제

## 7. 리스크

- **중**: sorting/filtering 동작 변경 위험. 기존 테스트가 정렬(asc/desc 토글, empty-last), 필터(category/field/region/query/reset) 전부 커버 → 회귀 즉시 감지.
- 잠재 이슈: 훅 분리 과정에서 useMemo 의존성 누락 → 기존 테스트가 클릭→재렌더 경로를 검증하므로 감지 가능.
