# PLAN-038: user_conferences write 경로 통합

> **상태**: active
> **생성일**: 2026-05-02
> **브랜치**: `feature/PLAN-038-user-conferences-write`
> **연관 PR**: #
> **트랙**: A(체계화)

---

## 1. 목표 (What)

starred 토글·편집 저장·삭제 시 Supabase `user_conferences` 테이블에 동시 write하여 멀티 디바이스 동기화를 가능하게 한다. localStorage는 캐시·오프라인 폴백으로 유지.

## 2. 배경·동기 (Why)

PLAN-029에서 Supabase read 경로는 완성됐으나 write 경로가 없어 편집 사항이 단일 디바이스 localStorage에만 저장된다. blueprint v2 §2.1 멀티 디바이스 동기화 핵심.

## 3. 범위 (Scope)

### 포함
- `dataManager.upsertUserConference` / `deleteUserConference` 함수 추가
- `useConferences` — starred·saveConferenceEdit·deleteConference·addConferenceFromDiscovery Supabase 사이드이펙트
- `App.jsx` — userId prop 전달
- 신규 mock 시나리오 6+ 추가

### 제외 (Non-goals)
- personal_note 편집 UI (별도 플랜)
- 라이브러리 등록 (PLAN-030 의존)
- 오프라인 큐·재시도 로직

## 4. 설계 결정

- Supabase write는 persist() 이후 fire-and-forget (.catch(console.warn)) — UI 즉시 반영, 네트워크 실패 시 graceful 저하
- supabaseConfigured=false면 noop — 기존 legacy 경로 완전 보존
- upsert onConflict='user_id,conference_id' — PK 기반 부분 갱신

## 5. 단계 (Steps)

- [x] Step 1 — dataManager에 upsertUserConference / deleteUserConference 추가
- [x] Step 2 — useConferences에 userId prop + 4개 mutator Supabase 연동
- [x] Step 3 — App.jsx userId 전달
- [x] Step 4 — dataManager.test.js 신규 시나리오 6개 추가
- [x] Step 5 — verify-task.sh 5/5 통과

## 6. 검증 (Verification)

- [x] `bash scripts/verify-task.sh` 5/5 통과
- [x] 신규 테스트 6개 + 기존 400+ 회귀 보존
- [ ] 멀티 디바이스 시나리오 수동 검증 (PR 본문 명시)

## 7. 리스크·롤백

- useConferences 핵심 모듈 — 기존 mutator 동작 보존 확인 완료
- Supabase write 실패 시 localStorage·GitHub commit 폴백 유지
- 롤백: revert 커밋 1개

## 8. 후속 (Follow-ups)

- PLAN-030: 라이브러리 등록 (addConferenceFromDiscovery library_id)
- personal_note 편집 UI

## 9. 작업 로그

- 2026-05-02: 구현 완료, verify-task.sh 5/5, 테스트 406개 통과
