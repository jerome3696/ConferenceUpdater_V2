# PLAN-P0-auth-flow: Supabase 인증 플로우 + Resend SMTP 연동

> **상태**: active
> **생성일**: 2026-04-21
> **완료일**: (UX·연동 승인 시 갱신)
> **브랜치**: `feature/PLAN-P0-auth-flow-<slug>` (실제 작업 시)
> **연관 PR**: #
> **트랙**: A(체계화) — Phase A.0 준비기 (roadmap.md §3 A.0.4)

---

## 1. 목표 (What)

Supabase magic link 인증 + Resend SMTP를 **Day 1 작업**으로 확정하고, 로그인·회원가입·세션 관리·로그아웃 전체 UX를 스펙화한다. 본 플랜은 **UX 플로우·SMTP 설정·에러 처리까지**만 결정하고, 실제 컴포넌트 구현은 PLAN-029(클라이언트 이관)에서.

## 2. 배경·동기 (Why)

- `PLAN-026` §4.4 결론: Supabase 유일한 구조적 약점 = **내장 SMTP 시간당 3통 제한** → **Day 1부터 Resend 연동 필수** (5분 작업으로 단언)
- `roadmap.md` §3 A.0.4: 인증 플로우 + Resend SMTP 를 A.0 마지막 준비 단계로 명시
- 현재 앱에는 로그인 개념이 없음 (관리자 GitHub PAT 만). 멀티테넌트 전환 시 **"누가 접근했는가"** 가 모든 API·DB 호출의 전제가 됨
- 매직 링크는 비밀번호 해시·비밀번호 재설정·BCrypt 무관 → **보안 표면 최소화**

## 3. 범위 (Scope)

### 포함
- Resend 계정 개설·DNS 설정 (SPF·DKIM) 가이드
- Supabase Auth에 Resend SMTP 등록 절차
- 로그인 UX 플로우 (email 입력 → 메일 전송 → 링크 클릭 → 세션 시작)
- 회원가입 (파일럿은 email 화이트리스트 방식 vs 자동 승인 결정)
- 세션 유지 정책 (만료 시간, 자동 갱신)
- 로그아웃 UX
- 에러 처리 (메일 미도착·링크 만료·이미 사용된 링크)
- 이메일 템플릿 (한국어, 보낸 사람 표시)
- 보안: 링크 유효 시간·1회용·IP 바인딩 여부

### 제외 (Non-goals)
- 소셜 로그인 (Google·GitHub) — Phase B 이후
- 2FA · TOTP — Phase C
- SSO · SAML — 해당 없음
- 비밀번호 로그인 — magic link 만 사용 (PLAN-026 §4.4 약속)
- 회원가입 폼 (추가 프로필 필드 수집) — 초기에는 email만

## 4. 설계 결정 (확정 필요 항목)

### 4.1 Resend 설정 (가이드)
- 가입: resend.com → 계정 (GitHub 연동 가능)
- 도메인 등록: `jerome3696.github.io` 의 subdomain 사용 가능한가? 또는 별도 도메인 구매?
  - **검토 포인트**: GitHub Pages는 DNS 제어권 없음 → **별도 도메인 필요할 수 있음**
  - 대안: 초기엔 Resend 기본 도메인 (`onboarding@resend.dev`) 사용 — 파일럿은 OK
- API key 발급 → Supabase 대시보드 Auth → SMTP → Resend 설정
- 무료 한도 100통/일 (월 ~3000통) — 30명 파일럿 충분

### 4.2 회원가입 흐름 — 2안
| 안 | 설명 | 장점 | 단점 |
|---|---|---|---|
| A | **화이트리스트** (본인이 수동 등록한 email만 가입 가능) | 어뷰즈 차단 강력 | 30명 등록 수동 작업 |
| B | **자동 승인** (아무 email로 가입 가능) | 운영 편함 | 스팸·어뷰즈 위험 |

→ 권고 후보: **A** — Supabase Auth의 "signup disabled + admin invite" 모드 사용. 30명 email 리스트를 한 번에 invite.

### 4.3 세션 유지 — 옵션
- Supabase 기본: access token 1시간, refresh token 30일
- 파일럿 권고: **기본값 유지** — PC 중심 사용자이므로 30일 refresh OK
- 민감 작업(쿼터 관리 등)은 재인증 요구? → 파일럿은 불필요

### 4.4 UX 플로우 상세
```
1. 로그인 페이지 (/login)
   └ 입력: email
   └ 버튼: "로그인 링크 보내기"
2. 메일 전송 직후 페이지
   └ 문구: "OO@gmail.com 으로 링크를 보냈습니다. 메일함을 확인하세요."
   └ 리다이렉트: 홈으로 3초 대기 or 수동
3. 메일 수신 → 사용자가 링크 클릭
4. 리다이렉트 (/auth/callback)
   └ Supabase가 세션 발급 → localStorage 저장
   └ 홈으로 리다이렉트
5. 헤더 우측: 사용자 email + 쿼터 + 로그아웃 버튼
```

### 4.5 에러 처리
- 메일 미도착 (5분 경과): "다시 보내기" 버튼 — Supabase API `resend`
- 링크 만료 (1시간 경과): "로그인 링크가 만료됐습니다" 페이지 + 재요청 버튼
- 이미 사용된 링크: "이 링크는 이미 사용됐습니다" — 보안 경고
- Resend API 실패: 운영자 email 알림 (self-monitoring)

### 4.6 이메일 템플릿 (한국어)
- 제목: "[ConferenceFinder] 로그인 링크"
- 본문 (짧게):
  ```
  안녕하세요,
  아래 링크를 클릭해 로그인하세요. (1시간 안에만 유효)
  [로그인]
  요청하지 않으셨다면 이 메일을 무시하세요.
  ```
- 보낸 사람: "ConferenceFinder <noreply@resend.dev>" (도메인 미확정 시)

### 4.7 보안 결정
- 링크 유효 시간: **1시간** (Supabase 기본)
- 1회용: ✅ (Supabase 기본)
- IP 바인딩: ❌ (모바일 ↔ PC 전환 고려)
- Rate limit: 5req/email/hour (Supabase 기본)

## 5. 단계 (Steps)

- [ ] Step 1 — 4.1 Resend 가입·도메인 전략 결정 (자체 도메인 필요 여부)
- [ ] Step 2 — 4.2 회원가입 흐름 1안 확정 (화이트리스트 vs 자동)
- [ ] Step 3 — 4.4 UX 플로우 와이어프레임 (텍스트 OK, 페이지 3개)
- [ ] Step 4 — 4.5 에러 페이지 3종 문구 작성
- [ ] Step 5 — 4.6 이메일 템플릿 HTML 1안
- [ ] Step 6 — POC: Supabase 로컬 + Resend 테스트 계정으로 본인 email에 실제 발송 성공
- [ ] Step 7 — 사용자 승인 → completed/ 이동

## 6. 검증 (Verification)

- [ ] 4.1~4.7 7개 결정 항목 모두 "선택·대안 탈락 이유" 기재
- [ ] Step 6 POC 성공 스크린샷 또는 로그 첨부
- [ ] UX 플로우가 5개 에러 시나리오(미도착·만료·재사용·Resend 실패·네트워크)를 모두 처리하는지 표로 확인
- [ ] 이메일 템플릿이 Gmail·Outlook 스팸 필터 통과 (Resend의 preview tool로 score 확인)
- [ ] `bash scripts/verify-task.sh` 통과

## 7. 리스크·롤백

**리스크**:
- **Resend 도메인 DNS 제어권**: GitHub Pages 기본 도메인이면 SPF·DKIM 설정 불가 → 이메일 스팸함 직행 가능. → Step 1에서 결정: 초기엔 `resend.dev` 기본 도메인 사용 또는 별도 도메인 구매 ($10~15/년)
- **화이트리스트 과도**: 가입 문의마다 운영자 수동 처리 → 파일럿 30명 끝나면 자동화 필요 (Phase B).
- **링크 클릭 유실**: 사용자가 다른 탭에서 열면 세션 시작 페이지가 의도한 기기와 다름. → Step 4 UX에서 "같은 기기에서 열어주세요" 안내 명시

**롤백**:
- SMTP 연동 실패 시: Supabase 내장 SMTP(시간당 3통)로 임시 복귀 가능 — 설정 1줄 변경
- 매직 링크 UX 불만 시: 비밀번호 로그인 추가 도입 필요 → 새 PLAN 분기

## 8. 후속 (Follow-ups)

- **PLAN-029-client-migration**: §4.4 UX 실제 React 컴포넌트 (`LoginPage`, `AuthCallback`)
- **PLAN-P0-multitenant-schema**: `users` 테이블 (본 플랜의 magic link user를 DB에 동기)
- 소셜 로그인 (Google) — Phase B
- 도메인 구매 결정 시 별도 chore 플랜

## 9. 작업 로그

- **2026-04-21**: 스켈레톤 생성. PLAN-026 §4.4 "Day 1 Resend 필수" 전제 반영. 7개 결정 항목 중 핵심(도메인 전략·화이트리스트)은 후속 작업에서 결정 필요.
