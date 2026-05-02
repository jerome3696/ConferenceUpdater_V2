# PLAN-037: 비밀번호 + 구글 OAuth 인증 추가

> **상태**: active
> **생성일**: 2026-05-03
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-037-password-oauth`
> **연관 PR**: #
> **트랙**: C(기능) — Phase **A.3 후반** (`docs/blueprint-v2.md` §3.3)
> **의존**: PLAN-033 (router) — 설정 페이지 등 진입 경로 필요

---

## 1. 목표 (What)

매직링크 외 추가 인증 수단 도입. 완료 조건:
1. 이메일 + 비밀번호 가입·로그인 흐름 (Supabase Auth password grant)
2. 구글 OAuth 로그인 (Supabase Auth provider)
3. LoginScreen 재구성 — 메일 입력 + [비밀번호로 로그인 / 매직링크 / 구글] 3 경로
4. 사용자 설정 페이지 — 비밀번호 변경 / OAuth 연동 해제

## 2. 배경·동기 (Why)

- /grill-me Q5-c: 사용자가 메인 진입 시 빠른 로그인 원함. 매직링크 만 쓰면 이메일 왕복 1분 마찰.
- 30명 파일럿 단계 운영 안정성 ↑ — 매직링크 SMTP 장애 시에도 비밀번호 폴백 가능
- 구글 OAuth = 학교 도메인 사용자 즉시 로그인 (편의성 ↑)

## 3. 범위 (Scope)

### 포함
- Supabase Auth 설정 — 비밀번호 활성, 구글 provider 활성 (사용자가 Google Cloud Console 작업 필요)
- LoginScreen 3 경로 UI:
  - 이메일 + 비밀번호 입력
  - [매직링크 보내기] 링크 (비밀번호 모르는 사용자)
  - [구글로 로그인] 버튼
- Sign-up 흐름 — 이메일 + 비밀번호 (초대 코드와 함께)
- 설정 페이지 — 비밀번호 변경 / OAuth 연동 보기·해제
- 신규 가입 시에만 admin 의 invite 코드 검증 (`POST /sign-up` 또는 trigger 검증)

### 제외 (Non-goals)
- Apple OAuth (Phase C)
- SSO·SAML (Phase C+)
- 2단계 인증 (Phase C)

## 4. 설계 결정

### 4.1 비밀번호 가입 흐름
- 사용자 가입 시 매직링크 path 처럼 invite 코드 검증
- Supabase Auth `signUp({email, password, options: {data: {invitation_code: '...'}}})`
- trigger 가 `data.invitation_code` 를 invitations 테이블에서 검증, 없으면 가입 차단

### 4.2 구글 OAuth
- Supabase Dashboard > Authentication > Providers > Google 활성화
- Google Cloud Console 에서 OAuth client ID 생성, redirect URI 등록
- LoginScreen 의 [구글] 버튼이 `signInWithOAuth({provider: 'google', options: {redirectTo: '...'}})` 호출
- 신규 사용자 OAuth 가입 시 invite 코드 검증 — challenge: OAuth callback 후에 코드 받기 어려움
  - 옵션: OAuth 가입은 admin 가 사후 limit 풀어주는 방식 (limit=0 으로 시작)
  - 또는: OAuth 진입 전 invite 코드 입력 화면 표시 → query 로 전달

### 4.3 LoginScreen UX
- 메인: 이메일 + 비밀번호 입력 + [로그인] 버튼
- 보조: [비밀번호 잊음? 매직링크로 받기] 링크
- 보조: [구글로 로그인] (별도 OAuth)
- 가입 토글: [계정 없음? 가입] → 같은 화면에서 비밀번호 + invite 코드 입력으로 전환

## 5. 단계 (Steps)

- [ ] **S1** — 브랜치 + LoginScreen 재구성
- [ ] **S2** — 비밀번호 가입 흐름 + invite 코드 검증 trigger
- [ ] **S3** — 구글 OAuth 통합 (사용자 Google Cloud + Supabase 콘솔 작업 별도)
- [ ] **S4** — 설정 페이지 비밀번호 변경 + OAuth 해제 UI
- [ ] **S5** — 테스트 (mock 시나리오)
- [ ] **S6** — verify-task.sh 통과
- [ ] **S7** — PR

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] 비밀번호 가입 → invite 검증 → users + quotas trigger 정상
- [ ] 비밀번호 로그인 후 헤더 쿼터 표시
- [ ] 구글 로그인 → 첫 진입 시 invite 검증 또는 limit=0 으로 시작
- [ ] 비밀번호 변경 후 새 비밀번호로 로그인

## 7. 리스크·롤백

- **리스크**: 구글 OAuth 의 invite 코드 검증 우회 가능성. limit=0 시작이 안전망.
- **롤백**: provider disable + LoginScreen 매직링크 only 로 회귀

## 8. 후속

- Apple OAuth (Phase C)
- 학교 도메인 화이트리스트 (Phase B 검토)

## 9. 작업 로그

- **2026-05-03**: blueprint v2 §3.3 기반 스펙 확정. Google Cloud Console 작업은 사용자 영역.
