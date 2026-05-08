# PLAN-039: D3 후보 confirm 모달 — 기존 학회 매칭 시 사용자 선택

> **상태**: active
> **생성일**: 2026-05-09
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-039-d3-confirm-modal`
> **연관 PR**: #
> **트랙**: A(체계화) — Phase **A.3** (PR #51 PLAN-036 의 후속 — 분리됐던 D3 모달 통합)
> **의존**: PLAN-036 (`conferenceMatch.js` 머지) ✅, PLAN-038 (`updateStarred` Supabase 동기화) ✅

---

## 1. 목표 (What)

발굴 후보가 기존 upstream 학회와 매칭될 때 **silent drop** 대신 사용자에게 명시적 선택을 제공.

1. `useDiscoverySearch` 의 `findExistingMatch` (이름만) → `findUpstreamMatch` (URL 1차 + 이름 2차) 로 매칭 신뢰도 강화
2. 매칭 후보를 필터링 대신 `_match` 필드로 어노테이션하여 검토 단계에 노출
3. `DiscoveryCard` 가 매칭 시 배너 + 2개 인라인 버튼 표시:
   - **[기존 학회 별표]** → `updateStarred(matchedId, 1)` (= 본인 라이브러리에 추가)
   - **[새 학회로 추가]** → 기존 흐름 (`addConferenceFromDiscovery`)

## 2. 배경·동기 (Why)

- PR #51 (PLAN-036) 으로 `findUpstreamMatch` 유틸 머지 완료. Discovery 통합은 후속 PR 로 분리 (PLAN-038 와 충돌 회피).
- 현재는 `findExistingMatch` (이름 fuzzy 만) 으로 매칭 시 silent drop. 사용자가 "왜 이 후보가 안 뜨지?" 알 수 없음.
- 새 학회로 잘못 추가되면 master 중복이 누적 (현재 `disc_xxx` 와 기존 `conf_xxx` 분리). 사용자가 의도적으로 결정해야 함.

## 3. 범위 (Scope)

### 포함
- `src/components/Discovery/useDiscoveryState.js`
  - `findExistingMatch` → `findUpstreamMatch` 교체
  - 매칭 후보를 필터링 대신 `_match` 필드로 어노테이션
  - `useCandidateReview.handleAbsorb(idx)` 추가 — `onAbsorb(matchedId)` 호출 후 acceptedIds 에 추가
- `src/components/Discovery/DiscoveryCard.jsx`
  - `candidate._match` 가 있으면: 매칭 배너 + [기존 학회 별표] / [새로 추가] 인라인 버튼
  - 없으면 기존 [거절] / [승인] 흐름 유지
- `src/components/Discovery/DiscoveryPanel.jsx`
  - `onAbsorb` prop 추가 → review.handleAbsorb 로 전달
- `src/App.jsx`
  - `onAbsorb={(id) => conferences.updateStarred(id, 1)}` 전달
- 테스트
  - `useDiscoveryState.test.js` (있는 경우) — handleAbsorb 시나리오
  - `DiscoveryCard` 렌더링 — `_match` 있을 때 배너 + 버튼 노출
  - 기존 회귀 — `_match` 없을 때 기존 동작 보존

### 제외 (Non-goals)
- 모달 컴포넌트 분리 — 인라인 버튼으로 충분 (UX 단순화)
- absorb 시 candidate 의 신규 정보로 기존 master 갱신 — Phase B (지금은 별표만)
- 여러 매칭 후보 중 선택 UI — `findUpstreamMatch` 가 단일 후보 반환

## 4. 설계 결정

### 4.1 인라인 버튼 vs 모달
**선택: 인라인 버튼.** 모달은 1단계 더 깊은 인터랙션을 만들고 컴포넌트 신설 비용이 큼. 카드 안에 배너 + 버튼 2개로 명확. 위험도 'high' 후보의 confirm checkbox 와도 자연스럽게 공존.

### 4.2 absorb 의 의미
**선택: `updateStarred(matchedId, 1)` 만 호출.** candidate 의 신규 필드(예: 새 organizer)로 기존 master 를 덮어쓰지 않는다 — 사용자가 의도하지 않은 마스터 변경을 막기 위함. 정보 추가는 별도 update 흐름에서.

### 4.3 silent drop 제거
기존 `duplicateCount` 표시 ("기존 DB 중복 N건 필터됨") 는 의미가 바뀐다. 이제 매칭 후보도 검토 목록에 노출되므로:
- `duplicateCount` 변수명 유지 (호출처 영향 최소화)
- UI 문구 "기존 DB 매칭 N건 — 카드에서 선택" 으로 갱신

## 5. 단계 (Steps)

- [x] **S1** — 브랜치 + 본 PLAN
- [x] **S2** — `useDiscoveryState.js` matcher 교체 + `_match` 어노테이션 + `handleAbsorb`
- [x] **S3** — `DiscoveryCard.jsx` 매칭 배너 + 인라인 버튼
- [x] **S4** — `DiscoveryPanel.jsx` `onAbsorb` prop pass-through
- [x] **S5** — `App.jsx` `onAbsorb` 전달
- [x] **S6** — `useDiscoveryState.test.js` 신설 (6 케이스: handleAccept 회귀 + handleAbsorb)
- [x] **S7** — `bash scripts/verify-task.sh` 통과 (412 tests, +6)
- [ ] **S8** — PR

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] 매칭 후보가 카드 목록에 노출 (silent drop 안 됨)
- [ ] [기존 학회 별표] 클릭 → `updateStarred` 호출, Supabase user_conferences upsert
- [ ] [새로 추가] 클릭 → 기존 `addConferenceFromDiscovery` 흐름
- [ ] `_match` 없는 후보는 기존 [거절] / [승인] 그대로

## 7. 리스크·롤백

- **리스크**: `findUpstreamMatch` 가 false-positive 매칭 시 사용자가 헷갈림. 대안: 매칭 신뢰도 표시 (Phase B).
- **롤백**: feature branch revert.

## 8. 후속

- 매칭 시 candidate 의 신규 정보를 기존 master 에 머지 제안 (Phase B)
- `duplicateCount` UI 정리 — Phase B
- 라이브러리 도입 후 absorb = "라이브러리에 추가" 의미로 확장 (PLAN-030)

## 9. 작업 로그

- **2026-05-09**: PR #51 (PLAN-036) 후속으로 D3 통합 분리됐던 작업. 자율 진행.
