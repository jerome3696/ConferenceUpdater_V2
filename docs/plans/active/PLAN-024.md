# PLAN-024: useConferences.persist stale closure 방어

> **상태**: active
> **생성일**: 2026-04-21
> **완료일**: —
> **브랜치**: `feature/PLAN-024-persist-safety`
> **연관 PR**: TBD
> **트랙**: G (리팩토링 / 안전성)

---

## 1. 목표 (What)

`useConferences` 의 mutator 들 (`addConference` / `updateConference` / `saveConferenceEdit` / `applyAiUpdate` / `applyLastDiscovery` / `applyVerifyUpdate` / `addConferenceFromDiscovery` / `deleteConference`) 이 한 렌더 틱 안에서 **연속 호출**되어도 앞선 호출의 변경이 유실되지 않도록 보장한다.

측정 기준: 동일 handler 안에서 `addConference(A); addConference(B);` 처럼 직렬 호출해도 `data.conferences` 에 A, B 모두 포함되는 회귀 테스트 통과.

## 2. 배경·동기 (Why)

2026-04-21 code-reviewer 에이전트 리뷰에서 🔴 Critical 로 지적된 항목.

현재 구현:
```js
const persist = (next) => {
  setData(next);
  dataRef.current = next;           // 동기 업데이트는 하지만
  saveConferencesLocal(next);
  scheduleCommit();
};
const addConference = (conf) => {
  persist({ ...data, conferences: [...data.conferences, conf] }); // ← closure 변수 data
};
```

`addConference` / `updateConference` / ... 는 모두 **closure 에 포착된 `data`** 를 읽는다. 같은 렌더 틱 안에서 두 번 호출되면:

1. 1차: `data={X}` → `persist({X,A})` → `dataRef.current={X,A}` + re-render 예약
2. 2차: `data={X}` (아직 re-render 전 → closure 는 과거 값 유지) → `persist({X,B})` → `{X,A}` 덮어씀
3. 결과: A 는 **영구 손실**. localStorage 로도 `{X,B}` 가 저장되고, 10초 debounce 후 GitHub 에도 `{X,B}` 가 커밋됨.

실제 가능 시나리오:
- 사용자가 한 handler 안에서 "discovery 승인 + 즐겨찾기 토글" 등 복수 action 을 직렬 실행
- `saveConferenceEdit` 안에서 여러 분기 경로 (이론상 현재는 한 번의 `persist` 로 합쳐 안전)
- 향후 훅 사용자가 bulk 승인 UI 를 구현할 때 — 이 경우 버그가 드러남

현재는 UI 가 mutator 를 한 번씩만 호출하는 패턴이라 **잠재**이지만, 셀프 문서화(안전 계약) 관점에서 지금 고쳐두는 것이 바람직함. 비용은 XS, 위험은 저, 효과는 "데이터 손실 불가능".

## 3. 범위 (Scope)

### 포함
- `src/hooks/useConferences.js` 의 모든 mutator가 `dataRef.current` 를 읽도록 전환
- `persist(next)` 는 기존대로 `setData(next) + dataRef.current = next` 동기 쌍을 유지
- 회귀 테스트 추가: `useConferences.test.js` 에 "연속 mutator 호출 시 상태 누적" 케이스 (신규 2개)
- `rows` / `normalized` 같은 render-time 파생값은 그대로 `data` 를 읽음 (이건 stale 이슈 없음)

### 제외 (Non-goals)
- `useState` 함수형 업데이트(`setData(prev => ...)`) 로의 전면 전환 — `saveConferencesLocal(next)` 가 즉시 값을 필요로 해서 함수형 setter 와 맞지 않음
- `useReducer` 로의 구조 전환 — 별도 플랜(PLAN-023 재설계)과 병합 여지
- `useUpdateQueue.js` 같은 다른 훅의 stale closure 검토 — PLAN-020 (G.1) 에서 함께 다룸

## 4. 설계 결정

**대안 A (채택)**: 모든 mutator가 `dataRef.current` 를 단일 소스로 읽는다.
- 장점: 최소 변경, 기존 테스트 영향 제로, 직렬 호출 안전
- 단점: render-time `data` 와 mutator-time `dataRef.current` 두 소스가 공존 → 문서화 필요 (주석 한 줄)

**대안 B (탈락)**: `setData(prev => computeNext(prev))` 함수형 업데이트.
- 탈락 이유: `saveConferencesLocal(next)` + `scheduleCommit()` 이 `next` 를 **즉시** 필요로 함. 함수형 setter 는 React 가 예약 실행하므로 해당 줄에서 `next` 를 얻을 수 없음. 억지로 맞추려면 localStorage 저장을 `useEffect([data])` 로 옮겨야 하는데, 그러면 debounce 타이밍 계약이 바뀌어 회귀 위험이 큼.

**대안 C (탈락)**: `useSyncExternalStore` / Zustand 도입.
- 탈락 이유: 수술 규모가 이 플랜의 "XS, 저위험" 전제를 깨뜨림.

## 5. 단계 (Steps)

- [ ] Step 1 — `useConferences.js` 내부 mutator 가 `data` 대신 `dataRef.current` 를 읽도록 교체 (한 커밋)
- [ ] Step 2 — `useConferences.test.js` 에 회귀 테스트 2건 추가
  - 연속 `addConference` 2회 → 두 학회 모두 보존
  - `deleteConference` 직후 `addConference` → 삭제 + 추가 둘 다 반영
- [ ] Step 3 — `bash scripts/verify-task.sh` 통과 확인

## 6. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 통과 (기존 326+ 테스트 + 신규 2건)
- [ ] 회귀 테스트: 동일 `act()` 안에서 mutator 2회 연속 호출 시 두 변경 모두 `result.current.data` 에 반영
- [ ] 브라우저 수동 확인 불요 (UI 계약 변경 없음)

## 7. 리스크·롤백

- 리스크: 매우 낮음. `dataRef.current` 는 이미 `persist` 와 `useEffect([data])` 양쪽에서 동기화됨
- 롤백: 커밋 하나 revert 로 원복

## 8. 후속 (Follow-ups)

- `useUpdateQueue.js` 의 유사 closure 점검 (PLAN-020 / G.1 에서 함께 처리)
- mutator 들의 반환값 표준화 (성공/실패, 신규 ID 등) — 별도

## 9. 작업 로그

- 2026-04-21: 플랜 작성. 4-agent 리뷰(`/team 4:`)에서 code-reviewer 가 Critical 로 지적한 항목을 PLAN-024 로 분리.
