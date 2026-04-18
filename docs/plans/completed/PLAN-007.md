# PLAN-007: ConferenceFormModal 슬림화

> **상태**: active
> **생성일**: 2026-04-18
> **완료일**: —
> **브랜치**: `feature/PLAN-007-form-modal-slim`
> **연관 PR**: TBD
> **트랙**: B (품질)

---

## 1. 목표 (What)

`ConferenceFormModal.jsx` 를 376줄 → 300줄 이하로 슬림화하고, form input className 중복 9회를 제거한다. 시각·동작 완전 불변.

## 2. 배경·동기 (Why)

2026-04-18 `bash scripts/refactor-check.sh` 결과:
- `ConferenceFormModal.jsx` 376줄 (warning tier)
- useState 6개 (warning — 5개 초과)
- `className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"` 전체 repo에서 9회 등장 → 대부분 이 파일

이미 `FixedSelect`, `ComboField`, `EditionSection` 3개 서브컴포넌트가 추출된 상태. 나머지 8개 인라인 input 패턴은 label+input 동일 구조. 상수 추출 + 내부 `TextField`/`TextArea` 헬퍼로 통합 여지.

## 3. 범위 (Scope)

### 포함
- 파일 상단에 `INPUT_CLASS`, `LABEL_CLASS` 상수 도입
- 내부 `TextField({ label, required, colSpan2, mono, ... })` 컴포넌트 추가
- 내부 `TextArea` 컴포넌트 추가 (메모 필드 전용)
- 기존 `FixedSelect`·`ComboField`·`EditionSection` 에서도 동일 상수 사용
- 8개 인라인 input 블록을 `TextField`/`TextArea` 호출로 교체

### 제외 (Non-goals)
- form state 구조 변경 (`useState` → `useReducer` 등 상태 모델 변경)
- 프로퍼티 시그니처 변경 — `ConferenceFormModal` 의 props/onSubmit payload 불변
- 새 파일 생성 (helper는 같은 파일 내 유지)
- 테스트 추가 (현재 이 컴포넌트 직접 테스트 없음 — 별도 작업)

## 4. 설계 결정

- **같은 파일 내 helper**: 외부 노출할 필요 없음. `form-classes.js` 같은 별도 파일은 overkill.
- **TextField 시그니처**: HTML input의 `...rest` spread로 type/value/onChange/placeholder 전달. `colSpan2`/`mono` 만 별도 flag.
- **리스크 최소화**: form state / submit 로직 / validation 전혀 손대지 않는다. JSX 치환만.

## 5. 단계

- [x] Step 1 — `INPUT_CLASS`, `SELECT_CLASS`, `LABEL_CLASS` 상수 + `FieldLabel` helper 도입, 기존 서브컴포넌트에 적용
- [x] Step 2 — `TextField`, `TextArea` 내부 컴포넌트 추가
- [x] Step 3 — 메인 폼 JSX의 인라인 input 블록 치환 + `EditionSection` 내부 4개 input 도 `TextField` 로 교체
- [x] Step 4 — `bash scripts/verify-task.sh` → ✅ 5 / ❌ 0 (122 tests)
- [x] Step 5 — `bash scripts/refactor-check.sh` → 아래 "달성도" 참조

## 6. 검증

- `npm run test` — 기존 122 tests 전건 통과 (FormModal 은 MainTable.test.jsx 에서 mock, 외부 계약만 지켜지면 영향 없음)
- `npm run build` — 빌드 성공
- `scripts/refactor-check.sh` — `ConferenceFormModal.jsx` 가 warning tier 에서 제거되거나, 중복 라인 top 10 에서 INPUT_CLASS 패턴 사라짐
- 시각 확인: 브라우저 열고 학회 추가·편집 모달 렌더·입력·저장 정상

## 6.1 달성도 (2026-04-18)

| 지표 | Before | After | 목표 | 판정 |
|---|---|---|---|---|
| `ConferenceFormModal.jsx` 줄 수 | 376 | 360 | <300 | 부분 (300 미달 — EditionSection 별도 파일 분리는 범위 외로 보류) |
| className 중복 (top 10 내 `w-full border ...`) | 9회 | 미등장 (3회 미만) | 제거 | ✅ |
| useState 개수 | 6 | 6 | 변경 없음 (범위 외) | - |

**평가**: 핵심 이득(중복 제거 + label/input 패턴 통일)은 달성. 사이즈 300 돌파는 EditionSection·FormField 별도 파일 분리가 필요해 범위 외로 판단. 후속 작업 대상.

## 7. 리스크

- **낮음**: JSX 구조 · 동작 불변. prop 계약 불변. 외부 호출부 영향 없음.
- 잠재 이슈: `colSpan2` flag 누락 시 레이아웃 깨짐 → 각 치환 시 원본 `col-span-2` 여부를 수동 대조할 것.
