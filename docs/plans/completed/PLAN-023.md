# PLAN-023: DiscoveryPanel 상태 커스텀 훅 4개로 분해

> **상태**: active
> **생성일**: 2026-04-21
> **브랜치**: `feature/PLAN-023-discovery-state-decompose`
> **트랙**: G.4 (리팩토링, dev-guide-v3 §2)

---

## 1. 목표 (What)

`src/components/Discovery/DiscoveryPanel.jsx` (367줄, 13 useState → refactor-check ❌) 의 상태·핸들러를 4개 커스텀 훅으로 분해. 컴포넌트는 UI 렌더 + 훅 조립만 담당 (useState 0). 기능·시각 동작 불변.

## 2. 배경·동기 (Why)

- `bash scripts/refactor-check.sh`: `❌ 14 DiscoveryPanel.jsx (> 10, 상태 분리 필요)` — **현재 유일한 hard fail**
- 동시에 367줄 warning (> 300) 도 걸려있음
- 상태 13개가 3 stage (키워드 확장 → 학회 검색 → 후보 검토) 흐름대로 자연 분리됨 + 공용 usage 추적
- 본선 진입 (Phase A.0 서버 전환) 직전 refactor-check 를 warning-only 상태로 깎아두기

## 3. 범위

### 포함
- `src/components/Discovery/useDiscoveryState.js` 신설 — 4 훅 + 순수 helper 모음
- `DiscoveryPanel.jsx` 재작성: 훅 호출 + JSX 렌더만 (useState 0, helper 거의 없음)
- 파생값 (`visibleCandidates`, `totalCost`, `acceptedCount`) 는 훅에서 반환

### 제외
- `KeywordExpansion`, `DiscoveryCard` 하위 컴포넌트 변경
- 상호작용·시각 레이아웃 변경
- 에러 메시지 문구 변경
- 테스트 신규 작성 (기존 테스트 범위 유지)

## 4. 설계 결정

### 4.1 훅 구성

| 훅 | 내부 useState | 반환 |
|---|---|---|
| `useDiscoveryUsage()` | `usage` (1개) | `{ usage, addUsage, totalCost }` |
| `useKeywordExpansion({ apiKey, addUsage })` | seedInput, expanded, customKeywords, selected, expanding, expandError (6개) | state + handlers |
| `useDiscoverySearch({ apiKey, selected, existingConferences, addUsage })` | searching, searchError, candidates, duplicateCount (4개) | state + handlers |
| `useCandidateReview({ candidates, onAccept })` | acceptedIds, rejectedIds (2개) | state + handlers + `visibleCandidates` |

합계: 13 useState (기존과 동일). 분산되어 컴포넌트는 0. 훅 파일 각 영역 최대 6 (`useKeywordExpansion`) → refactor-check 임계값 미만.

### 4.2 의존 체인
```
useDiscoveryUsage → addUsage 노출
   ↓
useKeywordExpansion (addUsage 주입) → selected 노출
   ↓
useDiscoverySearch (selected + addUsage 주입) → candidates 노출
   ↓
useCandidateReview (candidates 주입)
```

### 4.3 파일 구조
```
src/components/Discovery/
  ├ DiscoveryPanel.jsx            (~180줄 — UI shell + 4 훅 조립)
  ├ useDiscoveryState.js          (~240줄 — 4 훅 + 순수 helper)
  ├ KeywordExpansion.jsx          (불변)
  └ DiscoveryCard.jsx             (불변)
```

### 4.4 순수 helper 이관
- `parseSeed`, `seedToPair`, `pairKey`, `dedupPairs`, `isSamePair`, `calcCost`, `extractUsage`, `fmtUSD`, `fmtKRW`, `PRICING` → `useDiscoveryState.js` 상단
- `DISCOVERY_MODEL` 상수도 같이 이동

## 5. 단계

- [x] Step 1 — 브랜치 + PLAN
- [x] Step 2 — `useDiscoveryState.js` 작성 (4 훅 + helper)
- [x] Step 3 — `DiscoveryPanel.jsx` 슬림화
- [x] Step 4 — `bash scripts/verify-task.sh` 5/5 통과
- [ ] Step 5 — commit + push + PR

## 6. 검증

- [ ] `DiscoveryPanel.jsx` useState 0개 (refactor-check ❌ 제거)
- [ ] `DiscoveryPanel.jsx` 줄 수 < 300
- [ ] 훅별 useState ≤ 6
- [ ] 기존 테스트 364+ 통과
- [ ] 빌드·lint 통과
- [ ] consumer (App.jsx → `onAccept` prop) 수정 없이 동작

## 7. 리스크·롤백

**리스크**:
- `setAcceptedIds`/`setRejectedIds` 에서 `candidates` 인덱스 사용 → 훅 경계 넘을 때 index 기반 식별 유지 여부 확인
- `addUsage` 클로저 — `setUsage(prev => ...)` 의 prev 의존 유지 필요
- useMemo `visibleCandidates` 의존성 배열 `[candidates, rejectedIds, acceptedIds]` 정확히 이관

**롤백**: 브랜치 폐기 또는 `git checkout main -- src/components/Discovery/DiscoveryPanel.jsx`

## 8. 후속

- PLAN-020 `useUpdateQueue` 278줄 (G.1, 현 임계 미만이라 후순위)
- `useConferences.js` 401줄, `ConferenceFormModal.jsx` 373줄, `MainTable.jsx` 344줄 — refactor-check warning 3건 남음 (Phase A.0 진입 전 추가 정리 여부는 사용자 결정)

## 9. 작업 로그

- 2026-04-21: 착수. PLAN-022 직후 이어서 곁가지 정리 마무리.
- 2026-04-21: 구현 완료. `useDiscoveryState.js` (286줄, 4 훅) + `DiscoveryPanel.jsx` (147줄, useState 0).
  - 원래 초안의 `useDiscoverySearch({ onResetReview })` → `useCandidateReview` 이중 호출 설계를
    폐기하고, 컴포넌트 레벨에서 `onSearchClick = () => { review.reset(); search.handleSearch(); }`
    래퍼로 의존 역전. 훅 간 순환 참조 제거.
  - verify-task 5/5 통과 (364 테스트). refactor-check: DiscoveryPanel 하드 fail 제거됨.
