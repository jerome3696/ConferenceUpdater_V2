# PLAN-041: "내 학회" 가상 라이브러리 완성

> **상태**: active (설계 확정 — 착수 대기)
> **생성일**: 2026-05-19
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-041-personal-library`
> **연관 PR**: #
> **트랙**: C(기능)
> **의존**: PLAN-030 (라이브러리 — 가상 라이브러리 스키마)

---

## 1. 목표 (What)

PLAN-030 이 남긴 "내 학회" 가상 라이브러리의 미완 부분을 완성한다. 완료 조건:

1. 발굴(Discovery)·수동입력 학회가 발굴자의 "내 학회" 가상 라이브러리에 실제로 적재됨
2. "내 학회" 가 `/libraries` 페이지·온보딩에 **잠긴 항목**(해제 불가)으로 노출됨

## 2. 배경·동기 (Why)

PLAN-030 에서 "내 학회" 가상 라이브러리는 스키마·트리거(가입 시 자동 생성)·게이팅 통과까지만 구현되고 두 가지가 미완으로 남음:

- **발굴 적재 배선 미완**: `useConferences.addConferenceFromDiscovery` 에 `// 가상 라이브러리 등록은 PLAN-030 의존 (TODO)` 주석으로 남음 — 학회를 발굴해도 "내 학회"의 `library_conferences` 에 안 들어감 (현재는 게이팅의 orphan 안전망으로만 노출됨).
- **UI 비노출**: "내 학회"가 온보딩·`/libraries` 어디에도 안 보여 사용자가 자기 라이브러리의 존재를 모름.

blueprint §1.5.7: 일반 사용자 발굴(D1)·수동입력(D3) 학회는 **본인 "내 학회"에만** 적재되고, 중앙 라이브러리 편입은 admin 승인(PLAN-040)을 거친다.

## 3. 범위 (Scope)

### 포함
- `addConferenceFromDiscovery` → `lib_personal_<userId>` 의 `library_conferences` INSERT 배선
- `/libraries` 페이지에 "내 학회" 를 [해제] 버튼 없는 **잠긴 항목**으로 항상 표시
- 온보딩 화면에 "내 학회" 를 잠긴(해제 불가) 사전선택 항목으로 표시
- 일반 사용자 발굴 학회는 라이브러리 선택 없이 무조건 "내 학회" 로 (§1.5.7)

### 제외 (Non-goals)
- admin 이 "내 학회" 학회를 중앙 라이브러리로 승격 — PLAN-040 (관리자 큐레이팅)
- "내 학회" → master 흡수 환원 경로 — 후속 (PLAN-030 §8)

## 4. 설계 결정

- **"내 학회"는 구독(`user_libraries`)이 아니다** — 소유(`libraries.owner_user_id`) 기반. 가입 트리거가 생성, 게이팅이 항상 통과. `/libraries` UI 는 구독 목록과 별개로 "내 학회"를 잠긴 항목으로 함께 렌더.
- **발굴 학회의 라이브러리 = 선택 불가** — 일반 사용자는 무조건 본인 "내 학회". 라이브러리 선택 UI 없음(§1.5.7). 중앙 라이브러리 편입은 admin 권한(PLAN-040).
- (착수 시 확정) `library_conferences` INSERT 시점 — 발굴 후보 승인 즉시 vs user_conferences UPSERT 와 동일 트랜잭션.

## 5. 단계 (Steps)

- [ ] S1 — 발굴 학회의 "내 학회" `library_conferences` INSERT — **차단됨** (아래 §9 참조)
- [x] S2 — `libraryService.fetchOwnedVirtualLibrary` + `useLibraries.personalLibrary` + `LibrariesPage` "내 라이브러리" 잠긴 항목
- [x] S3 — `OnboardingPage` — "내 학회" 잠긴 안내 항목
- [x] S4 — 테스트 (`useLibraries.test.js` personalLibrary) + verify-task.sh ✅ 6
- [ ] S5 — PR (S2·S3 분), S1 은 별도

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] 발굴 학회 추가 → `library_conferences` 에 `lib_personal_*` 행 생성 확인
- [ ] `/libraries` 에 "내 학회" 잠긴 항목 표시, [해제] 버튼 없음
- [ ] 신규 가입 온보딩 화면에 "내 학회" 잠긴 표시

## 7. 리스크·롤백

- **리스크**: 발굴 학회는 `conferences_upstream` 에 없을 수 있어(개인 추가분) `library_conferences` FK 제약 위반 가능 — 적재 시점·대상 테이블 정합 확인 필요.
- **롤백**: 기능별 revert. UI 변경은 독립적이라 부분 롤백 가능.

## 8. 후속

- admin 의 "내 학회" → 중앙 라이브러리 승격 (PLAN-040)

## 9. 작업 로그

- **2026-05-19**: grill-me 중 식별 — PLAN-030 이 "내 학회" 가상 라이브러리를 스키마까지만 만들고 발굴 적재·UI 노출을 미완으로 남김. 별도 PLAN 으로 분리.
- **2026-05-19 (구현)**: S2·S3(UI 노출) 완료 — `/libraries`·온보딩에 "내 학회" 잠긴 항목 표시.
  **S1 차단 발견**: 발굴 학회는 `addConferenceFromDiscovery` 가 로컬 state + `user_conferences` 에만 쓰고 `conferences_upstream` 에는 안 넣는다. `library_conferences.conference_id` 는 `conferences_upstream` 을 FK 참조 → 발굴 학회를 "내 학회"에 태그하려면 먼저 `conferences_upstream` 에 적재해야 함(blueprint §1.5.7 "공용 DB 에 pending 적재"). 이 write 경로는 PLAN-040(`conferences_upstream` write + RLS) 영역. **S1 은 PLAN-040 이후 또는 별도 발굴-영속화 보강과 함께** 진행. PLAN-041 의존 = PLAN-030 뿐이라 적었으나 S1 은 사실상 PLAN-040 의존.
