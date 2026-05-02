# PLAN-036: 학회 정체성 매칭 유틸 + D3 confirm 모달

> **상태**: active
> **생성일**: 2026-05-03
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-036-matching-util`
> **연관 PR**: #
> **트랙**: A(체계화) — Phase **A.3** (`docs/blueprint-v2.md` §2.3, §9 Q9)
> **의존**: PLAN-038 (수동입력 흐름) — UI 부분만 후행

---

## 1. 목표 (What)

학회 dedup 매칭을 단일 유틸 함수로 통합하고, D3 수동 빈 카드 입력 시 공용 DB 매칭 발견을 사용자에게 confirm 받는 흐름 도입. 완료 조건:
1. `src/utils/conferenceMatch.js` — `findUpstreamMatch(candidate, upstreamConferences)` — URL 정규화 1차 + 이름 fuzzy 2차
2. 기존 `nameMatch.js` + `urlMatch.js` 의 호출처를 conferenceMatch 로 일원화
3. D3 수동 입력 직후 매칭 발견 시 confirm 모달 ("공용 DB 의 X 와 같은 학회인가요?")
4. 사용자 [예] → 본인 라이브러리의 conference_id 를 공용 row id 로 교체, override 보존

## 2. 배경·동기 (Why)

- 현재 `findExistingMatch` 가 useDiscoveryState 내에서만 사용 — 다른 흐름 (D2 import, D3 수동) 에서 재사용 불가
- 멀티 사용자 시 dedup 미작동 시 IHTC 같은 학회가 N번 등장 → cache hit 불가, UX 망가짐
- D3 수동 학회는 검증 안 된 입력이라 공용 DB 흘러가면 안 되지만, 사용자 본인 의도 반영해 합칠 기회 제공 필요

## 3. 범위 (Scope)

### 포함
- `src/utils/conferenceMatch.js` — 순수 함수 모듈
- `src/utils/conferenceMatch.test.js` — 5+ 시나리오
- `useDiscoveryState.js` 의 `findExistingMatch` 호출 → conferenceMatch 로 교체 (기존 동작 보존)
- D3 confirm 모달 컴포넌트: `src/components/MainTable/MatchConfirmModal.jsx`
- D3 흐름 통합 — 수동 입력 모달 (ConferenceFormModal) 의 [저장] 후 매칭 발견 시 confirm 단계

### 제외 (Non-goals)
- AI judge (A3) — Phase B (PLAN-042)
- 수동 매칭 트리거 (사용자가 "이거 공용의 X 야" 명시) — UX 보강은 후속
- 매칭 결과 사후 보정 (admin 도구) — Phase B

## 4. 설계 결정

### 4.1 매칭 우선순위
1. `official_url` 정규화: `urlMatch.js` 기반 — host lower / trailing slash 제거 / query 제거 / `www.` 제거
2. `full_name` fuzzy: `nameMatch.js` 기반 — exact substring + Levenshtein ratio threshold

### 4.2 함수 시그니처
```js
/**
 * @param {object} candidate — { official_url, full_name, ... }
 * @param {array}  upstream  — conferences_upstream 행 배열
 * @returns {object|null}    — 매치된 upstream row, 없으면 null
 */
export function findUpstreamMatch(candidate, upstream) { ... }
```

### 4.3 D3 confirm 모달
- ConferenceFormModal 의 onSave → conferenceMatch 검사
- 매치 있으면 onSave 보류 + MatchConfirmModal 표시
- 모달: "공용 DB 에 같은 학회로 보이는 항목이 있습니다. [매치된 학회 미리보기] [예, 합치기] [아니오, 별개로 저장]"
- [예] → 사용자 라이브러리에 공용 row id 로 추가 + 본인 입력값을 overrides 에 저장
- [아니오] → 별도 conference_id 로 저장 (현 동작)

## 5. 단계 (Steps)

- [ ] **S1** — 브랜치 + `conferenceMatch.js` + 테스트 (TDD)
- [ ] **S2** — `useDiscoveryState.js` 호출처 교체 (호환 검증)
- [ ] **S3** — `MatchConfirmModal` 컴포넌트
- [ ] **S4** — `ConferenceFormModal` onSave 후 매칭 검사 통합
- [ ] **S5** — useConferences 의 add 흐름에 합치기 동작 추가 (PLAN-038 머지 후)
- [ ] **S6** — verify-task.sh 통과
- [ ] **S7** — PR

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] 단위 테스트 5+ 케이스 (URL match, name fuzzy, no match, partial URL, www prefix 등)
- [ ] 기존 useDiscoveryState 동작 회귀 0 (Discovery dedup 그대로)
- [ ] 수동 입력 시 매치 발견 → 모달 표시 → 사용자 [예] → 합치기 / [아니오] → 별개 저장

## 7. 리스크·롤백

- **리스크**: nameMatch fuzzy threshold 너무 느슨하면 거짓 양성 증가. 기존 임계값 보존.
- **롤백**: util 호출처를 원본 함수로 되돌림 (1줄)

## 8. 후속

- AI judge 통합 (PLAN-042 Phase B)
- 매칭 history 저장 (admin 검수용) — Phase B
- D2 import 페이지에서도 동일 모달 활용

## 9. 작업 로그

- **2026-05-03**: blueprint v2 §2.3, Q9 기반 스펙 확정.
