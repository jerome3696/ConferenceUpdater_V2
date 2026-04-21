# PLAN-P0-auth-flow: Supabase 인증 플로우 + Resend SMTP 연동

> **상태**: active (v1 본문 작성 중)
> **생성일**: 2026-04-21
> **완료일**: (UX·연동 승인 시 갱신)
> **브랜치**: `feature/PLAN-P0-auth-flow-v1`
> **연관 PR**: #
> **트랙**: A(체계화) — Phase A.0 준비기 (`docs/roadmap.md` §3 A.0.4)
> **의존**:
> - `PLAN-P0-multitenant-schema` §4.1.1 `users` 테이블 (Supabase `auth.users` ↔ `public.users` 동기)
> - `PLAN-P0-quota-policy` §4.7 role 기본값 (신규 가입자 = `viewer`, 쿼터 10/3)

---

## 1. 목표 (What)

Supabase **magic link 인증 + Resend SMTP** 를 Phase A.1 Day 1 작업으로 확정하고, 로그인·초대·세션·로그아웃 UX 와 `auth.users` ↔ `public.users` 동기 규칙을 **결정 레벨까지** 확정. 실제 React 컴포넌트·Edge Function 구현은 PLAN-028/029 에서 집행.

## 2. 배경·동기 (Why)

- `PLAN-026` §4.4: Supabase 의 유일한 구조적 약점 = 내장 SMTP 시간당 3통 제한 → **Day 1 Resend 연동** 확정 (5분 설정)
- `roadmap.md` §3 A.0.4: A.0 마지막 준비 단계. 인증이 없으면 멀티테넌트·쿼터·API 프록시 모두 "누가" 가 정의되지 않아 동작 불가.
- `PLAN-P0-multitenant-schema` §4.2 RLS 행렬 전체가 `auth.uid()` 기반 → 인증 동작이 전제.
- `PLAN-P0-quota-policy` §4.6 어뷰즈 방지: "로그인 필수" 가 첫 번째 방어선 — 익명 접근 자체를 차단.
- 비밀번호 로그인 배제 (magic link 전용) → 해싱·재설정·BCrypt 의존 제거로 보안 표면 최소화.

## 3. 범위 (Scope)

### 포함 (v1 본문 확정 대상)
- 4.1 Resend 계정·도메인·SPF/DKIM 전략
- 4.2 회원가입 흐름 (화이트리스트 A안 확정)
- 4.3 세션 유지 정책 (Supabase 기본값 채택 근거)
- 4.4 UX 플로우 5단계 상세 + 와이어프레임 (텍스트)
- 4.5 에러 처리 5종 매트릭스
- 4.6 이메일 템플릿 한국어 확정
- 4.7 보안 파라미터 (링크 유효 시간·1회용·rate limit)
- 4.8 `auth.users` ↔ `public.users` 동기 (신규)

### 제외 (Non-goals)
- 소셜 로그인 (Google·GitHub) — Phase B 이후
- 2FA · TOTP — Phase C
- SSO · SAML — 해당 없음
- 비밀번호 로그인 — magic link 전용 (PLAN-026 §4.4 약속, 번복 불가)
- 추가 프로필 수집 (이름·기관 등) — 파일럿은 email 단독

## 4. 설계 결정

### 4.1 Resend 설정 — 파일럿은 기본 도메인, Phase B 전 자체 도메인

**결정**: 파일럿 (~30명·6개월) 은 Resend 기본 도메인 `onboarding@resend.dev` 사용. Phase B 진입 전 `conferencefinder.app` 류 도메인 $10~15/년 구매 후 전환.

**근거**:
- GitHub Pages 는 DNS 제어권 없음 → SPF/DKIM 설정 불가 → `jerome3696.github.io` 서브도메인 활용 불가.
- Resend 기본 도메인은 Gmail 에서 "프로모션" 탭에 분류될 수 있으나 **스팸함 직행은 아님** (30명 파일럿은 "메일함 확인하세요" 안내로 해결 가능).
- 도메인 구매·DNS 전파 (24~48h) 가 파일럿 시작을 지연시킬 이유 없음. Phase B 100명 확대 시 신뢰도 필수 → 그때 일괄 처리.
- 무료 한도 100통/일 (월 3,000통) — 30명 × 평균 2회 로그인/월 = 60통, 여유 50배.

**작업 순서 (PLAN-028 Step 1 내 처리)**:
1. Resend 계정 개설 (GitHub OAuth)
2. API key 발급 (Full access)
3. Supabase Dashboard → Auth → SMTP Settings → Resend 정보 입력
4. 본인 email 로 테스트 링크 발송 → Gmail·Outlook 수신 확인

**Phase B 전 도메인 전환 트리거**: 월 발송량 500통 돌파 또는 스팸 신고 1건 발생.

### 4.2 회원가입 흐름 — 화이트리스트 (A안) 확정

**결정**: Supabase Auth 설정 `Disable signup = ON`. 관리자가 email 리스트를 `Admin API` 로 일괄 invite. 초대받은 email 만 magic link 수신 가능.

**근거**:
- 파일럿은 "열유체·공조 분야 30명 평가 사용자" 로 **모집 대상 특정됨** → 자동 승인할 이유 없음.
- 어뷰즈 위험 (§4.6) 1차 방어선. `api_usage_log` 에 미검증 계정이 쌓이면 `conferences_upstream` 공용 캐시 품질도 저하.
- 수동 invite 비용: 30건 × 30초 = 15분. Phase B 100명 확대 시 `admin.users.list` 대시보드 UI 필요 (PLAN-028 Step 외 추가 고려).
- 거부된 가입 시도는 로그에 남음 → 누가 접근 시도했는지 가시화.

**대안 탈락**:
- **B안 자동 승인**: 운영 편의 대비 스팸·크롤러 위험 너무 큼. 30명 규모에서 자동화 이득 거의 없음.

**UX**:
- 로그인 페이지에 "초대받은 email 만 이용 가능. 참여 문의: jerome3696@gmail.com" 문구 명시.
- 비초대 email 입력 시: Supabase 는 200 OK 를 반환하지만 실제 메일 미발송 (보안상 "가입 여부 탐색" 방지). UX 는 "메일을 보냈습니다" 로 일관되게 표시.

### 4.3 세션 유지 — Supabase 기본값 채택

**결정**: Access token 1시간 / Refresh token 30일 (Supabase Auth 기본값). 쿼터 관리·개인 편집 UI 모두 재인증 불필요.

**근거**:
- 파일럿 사용자는 PC 중심 (대학·연구소 환경). 모바일 세션 유지 요구 적음.
- 30일 refresh 는 "매번 로그인" 스트레스와 "세션 탈취 위험" 사이 표준 절충.
- 민감 작업 (결제·권한 변경) 없음 → 재인증 step-up 불필요. Phase C 결제 도입 시 별도 PLAN.
- localStorage 저장 → 브라우저 종료 후에도 유지. 공용 PC 는 "로그아웃" 버튼 가시성 확보로 대응.

**로그아웃 UX**:
- 헤더 우측 email 클릭 → 드롭다운 ["쿼터 상세", "로그아웃"]
- 로그아웃 시: Supabase `signOut()` + localStorage 세션 삭제 + 로그인 페이지 리다이렉트.

### 4.4 UX 플로우 상세 — 5단계

```
[1] /login (비로그인 진입 시 강제 리다이렉트)
    ┌─────────────────────────────────────────┐
    │  ConferenceFinder                       │
    │  ─────────────────                      │
    │  [email 입력: _______________]          │
    │  [로그인 링크 보내기]                    │
    │                                         │
    │  초대받은 email만 이용 가능.             │
    │  문의: jerome3696@gmail.com             │
    └─────────────────────────────────────────┘

[2] /login/sent (링크 발송 직후)
    ┌─────────────────────────────────────────┐
    │  ✉️  메일을 보냈습니다                   │
    │  OO@gmail.com 메일함을 확인하세요.       │
    │  (1시간 내 유효)                         │
    │                                         │
    │  [다시 보내기] (5분 뒤 활성화)           │
    └─────────────────────────────────────────┘

[3] 사용자 메일 수신 → "로그인" 버튼 클릭

[4] /auth/callback (Supabase 자동 처리)
    - 토큰 검증 → 세션 발급 → localStorage 저장
    - 성공 시: / 로 리다이렉트
    - 실패 시: /login/error (§4.5)

[5] / (홈, 로그인 상태)
    헤더: [ConferenceFinder] ... [업데이트 7/10 · 발굴 1/3] [user@ex.com ▾]
                                                              └ [쿼터 상세] [로그아웃]
```

### 4.5 에러 처리 — 5종 매트릭스

| 시나리오 | 트리거 | UI 반응 | 사용자 액션 |
|---|---|---|---|
| 메일 미도착 | §4.4[2] 에서 5분 경과 | "다시 보내기" 버튼 활성화 | 클릭 → Supabase `resend` API |
| 링크 만료 (1h+) | callback 에서 token expired | `/login/error?code=expired` "링크가 만료됐습니다" | "새 링크 받기" 버튼 → /login |
| 이미 사용된 링크 | callback 에서 token already used | `/login/error?code=used` "이 링크는 이미 사용됐습니다" + 보안 경고 문구 | "새 링크 받기" 또는 본인 아닐 시 관리자 문의 |
| Resend API 실패 | /login POST 500 | 인라인 에러 "일시 장애. 잠시 후 재시도" + 운영자 email 자동 알림 | 재시도 (5분 뒤) |
| 네트워크 오류 | fetch throw | 토스트 "인터넷 연결 확인" | 재시도 |

**운영자 self-monitoring**: Supabase `auth.audit_log_entries` + Resend Dashboard 일 1회 점검 (Phase B 에서 Slack 웹훅 자동화).

### 4.6 이메일 템플릿 (한국어)

**Supabase Auth → Email Templates → "Magic Link"**:

- **보낸 사람**: `ConferenceFinder <onboarding@resend.dev>` (Phase B: `noreply@conferencefinder.app`)
- **제목**: `[ConferenceFinder] 로그인 링크`
- **본문 (HTML, 최소 스타일)**:
  ```html
  <p>안녕하세요,</p>
  <p>아래 버튼을 클릭해 ConferenceFinder 에 로그인하세요.</p>
  <p><a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:10px 20px;
            background:#2563eb;color:#fff;text-decoration:none;border-radius:4px;">
     로그인
  </a></p>
  <p>이 링크는 <strong>1시간</strong> 안에만 유효하며, 한 번만 사용할 수 있습니다.</p>
  <p style="color:#666;font-size:12px">
    요청하지 않으셨다면 이 메일을 무시하세요.<br>
    문의: jerome3696@gmail.com
  </p>
  ```

**스팸 점수 목표**: Resend preview tool 에서 **Spam Score < 3.0** (공식 권장치). 넘을 시 본문 단어 조정.

### 4.7 보안 결정

| 파라미터 | 값 | 근거 |
|---|---|---|
| 링크 유효 시간 | 1시간 (Supabase 기본) | 짧을수록 탈취 위험 감소 / 사용자 메일 확인 지연 허용 |
| 1회용 | ✅ 기본 | 재사용 차단 (§4.5 "이미 사용된 링크" 분기) |
| IP 바인딩 | ❌ | PC ↔ 모바일 전환 / 대학망 NAT 환경 고려 |
| Rate limit (발송) | 5 req / email / hour (Supabase 기본) | 메일 폭탄 방지 |
| Rate limit (callback) | IP 기반 10 req / min (Supabase 기본) | 토큰 brute-force 방지 |
| HTTPS 강제 | ✅ (GitHub Pages + Supabase 모두 기본) | MITM 차단 |

### 4.8 `auth.users` ↔ `public.users` 동기 (신규)

**배경**: Supabase Auth 는 자체 `auth.users` 테이블을 관리. `PLAN-P0-multitenant-schema` §4.1.1 의 `public.users` 는 역할(`role`)·쿼터 등 앱 로직용 필드 포함. 두 테이블 동기화 필요.

**결정**: PostgreSQL **Trigger** 로 `auth.users` INSERT 시 `public.users` 자동 삽입. 기본 role = `viewer`.

```sql
-- PLAN-028 Step 내 Supabase 마이그레이션으로 적용
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role, created_at)
  values (new.id, new.email, 'viewer', now())
  on conflict (id) do nothing;

  insert into public.quotas (user_id, month_key, update_used, update_limit,
                             discovery_used, discovery_limit)
  values (new.id, to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM'),
          0, 10, 0, 3)
  on conflict (user_id, month_key) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Role 승격**: viewer → editor / admin 은 **DB 직접 UPDATE** (파일럿 규모). Phase B 에서 관리자 대시보드 도입 시 자동화.

**삭제 동기**: `auth.users` DELETE 시 `public.users` CASCADE 로 연쇄 삭제 (`users.id` FK `references auth.users on delete cascade`) — schema §4.1.1 이미 반영됨.

## 5. 단계 (Steps)

- [x] Step 1 — §4.1 Resend 도메인 전략 결정 (파일럿 기본 도메인, Phase B 전 자체 도메인)
- [x] Step 2 — §4.2 화이트리스트 A안 확정
- [x] Step 3 — §4.4 UX 플로우 5단계 + 와이어프레임 (텍스트)
- [x] Step 4 — §4.5 에러 매트릭스 5종
- [x] Step 5 — §4.6 이메일 템플릿 HTML 1안
- [x] Step 6 — §4.8 `auth.users` ↔ `public.users` Trigger SQL
- [ ] Step 7 — PR v1 머지 → `PLAN-028-api-proxy-mvp` 에서 POC 발송 실측

## 6. 검증 (Verification)

- [x] §4.1~4.8 8개 결정 항목 모두 "선택·대안 탈락 이유" 기재
- [x] UX 플로우가 5개 에러 시나리오(미도착·만료·재사용·Resend 실패·네트워크)를 모두 처리하는 표 포함
- [x] 이메일 템플릿 HTML 1안 작성 (Spam Score 실측은 PLAN-028 Step 에서)
- [x] `public.users`·`public.quotas` 삽입 Trigger SQL 작성, multitenant-schema·quota-policy 의 스키마 정합
- [x] `bash scripts/verify-task.sh` 통과 (문서 변경만이라도 테스트·빌드 영향 없음 확인)

## 7. 리스크·롤백

**리스크**:
- **Resend 기본 도메인 스팸 분류**: Gmail 프로모션 탭 위험. → `/login/sent` 에 "스팸함도 확인해 주세요" 안내 추가 권고 (PLAN-029 UX 지시사항).
- **화이트리스트 운영 부담**: 가입 문의마다 운영자 수동 invite. → 파일럿 종료 시점 (6개월 후) 자동화 여부 재평가.
- **Trigger SQL 실패 케이스**: Supabase 는 Auth 이벤트 시 Trigger 실패 시 전체 가입 rollback. → Step 7 POC 에서 강제 실패 (예: `quotas` 중복) 시 `auth.users` 에 유령 행 남지 않음 확인.
- **링크 클릭 유실**: 사용자가 다른 브라우저/기기에서 열면 세션 시작이 의도한 기기와 다를 수 있음. → §4.6 본문에 "이 링크는 요청한 기기에서 열어 주세요" 문구 추가 권고.

**롤백**:
- SMTP 연동 실패 시: Supabase 내장 SMTP 로 임시 복귀 (Dashboard 1줄 변경). 시간당 3통 제한 하에 파일럿은 최소 가동.
- 매직 링크 UX 불만 → 비밀번호 로그인 추가는 **별도 PLAN** 으로 분기 (본 플랜 번복 금지).

## 8. 후속 (Follow-ups)

- `PLAN-028-api-proxy-mvp`: Supabase 프로젝트 생성·Resend 연동 실측·Trigger 배포·본인 email 로그인 POC
- `PLAN-029-client-migration`: `/login`, `/login/sent`, `/login/error`, `/auth/callback` React 컴포넌트 구현 + 헤더 UI
- Phase B 전 자체 도메인 구매 chore 플랜 (트리거: 월 발송 500통 / 스팸 신고 1건)
- 관리자 대시보드 (Phase B): role 승격·invite 배치·audit log 조회

## 9. 작업 로그

- **2026-04-21 (skeleton)**: PLAN-026 §4.4 "Day 1 Resend 필수" 전제 반영. 7개 결정 항목 초안.
- **2026-04-21 (v1 본문)**: §4.1~4.8 8개 결정 확정. multitenant-schema §4.1.1 `users` + quota-policy §4.7 role 기본값 과 정합 맞춤. Trigger SQL (§4.8) 추가로 Auth ↔ DB 동기 스펙 종결. POC 발송 실측은 PLAN-028 Step 으로 이관.
