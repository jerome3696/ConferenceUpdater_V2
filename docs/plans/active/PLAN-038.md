# PLAN-038: user_conferences write 경로 (starred·overrides 실제 Supabase 저장)

> **상태**: active (코드 draft 작업 시작 가능)
> **생성일**: 2026-05-03
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-038-user-conferences-write`
> **연관 PR**: #
> **트랙**: A(체계화) — Phase **A.3 최우선** (`docs/blueprint-v2.md` §2.1)
> **의존**: 없음 (단독 가능, PLAN-030 보다 먼저 권장)

---

## 1. 목표 (What)

현재 starred·노트·overrides 가 localStorage + GitHub commit 으로만 저장되는 레거시 경로를 Supabase `user_conferences` 로 이관. 완료 조건:
1. `dataManager.js` 에 `upsertUserConference`, `deleteUserConference` 함수 추가
2. `useConferences.js` 의 starred 토글, master 편집, addConferenceFromDiscovery 가 Supabase write 동시 수행
3. localStorage 는 캐시·오프라인 폴백으로만 사용
4. 멀티 디바이스 동기화 검증 — 다른 기기 로그인 시 본인 starred·메모 동일하게 보임
5. 기존 GitHub commit 흐름은 admin 백업용으로 보존 (옵션)

## 2. 배경·동기 (Why)

- blueprint v2 §2.1: 멀티테넌트 모델 핵심 — 사용자별 데이터가 서버에 있어야 함
- 현재 PLAN-029 머지 후에도 starred 토글하면 로컬에만 저장 → 다른 PC 로그인 시 안 보임. 사용자가 최근 직접 raise 한 우려.
- 30명 파일럿 시작 전 가장 시급. PLAN-030 (libraries) 이 user_conferences 에 의존하므로 선행.

## 3. 범위 (Scope)

### 포함
- `src/services/dataManager.js`:
  - `upsertUserConference(userId, conferenceId, patch)` — { starred?, personal_note?, overrides? } 부분 갱신
  - `deleteUserConference(userId, conferenceId)`
- `src/hooks/useConferences.js`:
  - `updateStarred` → upsert + localStorage 캐시
  - `saveConferenceEdit` → user_conferences.overrides 갱신
  - `addConferenceFromDiscovery` → user_conferences INSERT (가상 라이브러리 등록 포함, PLAN-030 후)
  - `deleteConference` → user_conferences DELETE
- `src/services/dataManager.test.js` 확장:
  - upsert/delete 시나리오 mock
  - localStorage + Supabase 양쪽 검증
- 기존 `commitToGitHub` 흐름은 보존 (admin 만 사용, 백업용)
- 마이그레이션 스크립트 (옵션): 기존 localStorage 의 starred·overrides 를 첫 로그인 시 Supabase 로 이관

### 제외 (Non-goals)
- 라이브러리 모델 (PLAN-030 별도)
- 동시 수정 충돌 처리 (Phase B realtime subscription 후)
- 오프라인 모드 큐잉 (Phase B+)

## 4. 설계 결정

### 4.1 write 흐름
- 사용자가 starred 토글 → 즉시 setState (UI 반응) + localStorage write + Supabase upsert (background)
- Supabase 실패 시 errorState 표시 + retry button
- 실패해도 localStorage 는 업데이트되어 다음 새로고침까지 일관성 유지

### 4.2 read 흐름 (기존 dataManager `loadFromSupabase` 활용)
- 변경 없음 — 이미 mergeAll 이 user_conferences 를 join 함

### 4.3 RLS
- `user_conferences` 의 `uc_self_all` 정책이 이미 있음 (PLAN-029) — 별도 작업 없음

### 4.4 충돌 처리
- 동시 수정 처리: 마지막 write wins (현재). PLAN-040 의 realtime 도입 시 conflict UX 보강.

## 5. 단계 (Steps)

- [ ] **S1** — 브랜치 + dataManager `upsertUserConference` / `deleteUserConference` 추가 + 테스트
- [ ] **S2** — useConferences 의 starred 토글에 upsert 통합
- [ ] **S3** — useConferences 의 saveConferenceEdit 에 overrides upsert 통합
- [ ] **S4** — useConferences 의 addConferenceFromDiscovery + deleteConference 통합
- [ ] **S5** — useConferences.test.js 확장 (mock supabase scenarios)
- [ ] **S6** — verify-task.sh 통과
- [ ] **S7** — 멀티 디바이스 수동 검증 (PC 1 + PC 2 로그인 후 starred 토글 동기화)
- [ ] **S8** — PR

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] 기존 364 테스트 + 신규 ≥5 테스트 모두 그린
- [ ] 멀티 디바이스: PC 1 에서 starred 토글 → PC 2 새로고침 후 동일 표시
- [ ] Supabase 실패 시 UI errorState 표시 + retry 동작
- [ ] localStorage 캐시 유지 — 오프라인에서 로드 가능

## 7. 리스크·롤백

- **리스크**: useConferences 가 핵심 모듈, 회귀 위험 큼. 단계별 작은 커밋 + 기존 테스트 수정 최소화.
- **롤백**: feature branch revert. 기존 GitHub commit 흐름이 살아 있어 데이터 손실 없음.

## 8. 후속

- Realtime subscription (PLAN-040 Phase B) — quota·user_conferences row change 자동 갱신
- 충돌 처리 (Phase B)
- 오프라인 큐잉 (Phase C)

## 9. 작업 로그

- **2026-05-03**: blueprint v2 §2.1 기반 스펙 확정. PLAN-030 보다 선행 권장 — 라이브러리 모델 의 user_conferences 의존.
