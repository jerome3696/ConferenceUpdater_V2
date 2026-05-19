# PLAN-037: 구글 OAuth 로그인 + 초대 게이팅

> **상태**: completed
> **생성일**: 2026-05-03
> **완료일**: 2026-05-20
> **브랜치**: `feature/PLAN-037-oauth`
> **연관 PR**: #69
> **트랙**: C(기능) — Phase **A.3 후반** (`docs/blueprint.md` §3.3)
> **의존**: PLAN-033 (router)

---

## 1. 목표 (What)

로그인 수단에 구글 OAuth 를 추가하고, 가입을 초대제로 게이팅한다. 완료 조건:

1. 구글 OAuth 로그인 (Supabase Auth provider) — LoginScreen 메인 버튼
2. 매직링크는 폴백으로 유지
3. 자율 가입 차단 — 초대된 계정만 로그인 가능 (Phase A·B)

## 2. 배경·동기 (Why)

- 2026-05-19 grill-me: 로그인 수단·게이팅 설계 확정.
- 현재 가입은 완전 자율 — 모르는 사람이 들어와 Claude API 비용을 소모할 위험. roadmap §4 "초대 기반 1차 방어".
- 비밀번호는 제외 — 매직링크(폴백)+구글이 전원을 커버, 비밀번호는 유지보수(재설정 등) 비용 대비 가치 낮음. Phase C(공개 전환) 때 재검토.

## 3. 범위 (Scope)

### 포함
- Supabase 구글 OAuth provider 활성화 (사용자가 Google Cloud OAuth client 생성 선행)
- LoginScreen 재구성 — [구글로 로그인] 버튼(메인) + 이메일 매직링크(폴백)
- 자율 가입 차단 — Supabase Auth "Allow new signups" OFF. 관리자가 Supabase 대시보드에서 사용자 초대
- `invitations` 테이블 + AdminPage InviteSection 폐기 (Supabase 기본 초대로 대체)
- 비초대 이메일 로그인 시도 → 친절한 안내 메시지

### 제외 (Non-goals)
- 이메일+비밀번호 로그인 — Phase C 재검토 (blueprint §3.3 수정)
- `/settings` 페이지 — 담을 내용 생길 때 별도
- Apple OAuth·SSO·2FA — Phase C+

## 4. 설계 결정 (2026-05-19 grill-me 확정)

### 4.1 로그인 수단 — 구글 OAuth + 매직링크 (비밀번호 없음)
초대제 게이팅 하에서 초대된 사용자는 매직링크(전원 가능)·구글(이메일 일치 시 자동 링크)로 충분. 비밀번호는 최고 유지보수 비용(재설정 플로우·강도 검증) 대비 가치 낮아 제외.

### 4.2 게이팅 — Supabase 기본 초대 (`invitations` 테이블 폐기)
- Supabase "Allow new signups" OFF → 신규 자율가입 불가.
- 관리자가 Supabase 대시보드(Authentication → Users → Invite user)에서 각 파일럿 사용자 초대 → Supabase 가 초대 메일 발송.
- 모든 로그인 수단에 균일 적용 — 계정이 미리 존재해야만 로그인 가능(수단 무관).
- 코드 기반 `invitations` 테이블·AdminPage 초대 UI 는 폐기 (절반 구현된 레거시 — 더 나쁜 설계를 완성하느니 제거).
- **Phase C 전환** = "Allow signups" 토글 ON 하나로 자율 가입 개방 (roadmap: Phase C "n명 랜덤").

### 4.3 OAuth ↔ 초대 상호작용
자율가입 OFF 상태에서 구글 로그인: 초대로 계정이 미리 생성된 이메일이면 OAuth 가 그 계정에 링크되어 로그인 성공, 미초대 이메일이면 차단. 별도 코드 불필요.

## 5. 단계 (Steps)

- [x] S1 — 브랜치 + LoginScreen 재구성 ([구글로 로그인] + 매직링크 폴백)
- [x] S2 — 구글 OAuth 통합 (`signInWithOAuth`) — Google Cloud OAuth client·Supabase provider 설정 완료(2026-05-19)
- [x] S3 — 비초대 로그인 시도 안내 메시지(`friendlyAuthError`). 자율가입 차단 토글은 사용자 작업(Supabase "Allow signups" OFF)
- [x] S4 — `invitations` 폐기 — DROP 마이그레이션(`20260519000001_drop_invitations.sql`) + AdminPage InviteSection 제거
- [x] S5 — blueprint §3.3 수정 (PR #68)
- [x] S6 — verify-task.sh 통과 (✅ 6, 테스트 438)
- [x] S7 — PR #69 머지·배포 완료

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] 초대된 이메일: 구글 로그인 → users + quotas trigger 정상, 헤더 쿼터 표시
- [ ] 초대된 이메일: 매직링크 로그인 정상
- [ ] 미초대 이메일: 로그인/가입 차단 + 안내 메시지
- [ ] 구조 변경 시 `structure.md` 갱신

## 7. 리스크·롤백

- **리스크**: 자율가입 OFF 후 기존 미초대 사용자(테스트 계정 등) 접근 불가 — 사전에 필요한 계정 정리.
- **롤백**: 구글 provider disable + LoginScreen 매직링크 only 회귀 + "Allow signups" ON.

## 8. 후속

- `/settings` 페이지 (담을 내용 생길 때)
- 비밀번호·Apple OAuth — Phase C

## 9. 작업 로그

- **2026-05-03**: blueprint v2 §3.3 기반 초기 스펙 (비밀번호+OAuth).
- **2026-05-19**: grill-me 재설계 — 비밀번호 제외(구글+매직링크), 게이팅을 Supabase 기본 초대로 확정, `invitations` 테이블 폐기, `/settings` 보류. blueprint §3.3 수정 필요.
- **2026-05-19 (구현)**: 사용자와 Google Cloud OAuth client 생성·Supabase provider 연결 완료. S1~S6 구현 — LoginScreen 에 구글 버튼+매직링크, AdminPage InviteSection 제거, DROP 마이그레이션 작성. PR #69 머지·배포.
- **2026-05-20 (완료)**: 사용자가 구글 로그인 동작 확인 ✅, DROP 마이그레이션 Supabase 적용 ✅, "Allow new signups" OFF ✅. PLAN-037 완료. 파일럿 사용자 초대는 운영 절차로 별도(Authentication → Users → Invite user).
