# PLAN-034: ICS 캘린더 구독 URL Edge Function

> **상태**: active
> **생성일**: 2026-05-03
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-034-ics-feed`
> **연관 PR**: #
> **트랙**: C(기능) — Phase **A.3** (`docs/blueprint-v2.md` §4.2)
> **의존**: PLAN-038 (user_conferences write 경로), PLAN-033 (settings 페이지 — 토큰 표시)

---

## 1. 목표 (What)

사용자별 ICS 구독 URL 을 발급하여 구글캘린더·애플캘린더·아웃룩 자동 동기화. 완료 조건:
1. 새 Edge Function `calendar-feed` — `GET /functions/v1/calendar-feed?token={user_token}`
2. 응답: `Content-Type: text/calendar`, RFC 5545 iCalendar 형식
3. 사용자별 토큰 발급 + DB 저장 (sha256 hex, 32자)
4. 사용자 설정 페이지 (PLAN-033) 에 "내 캘린더 구독 URL" + 복사 버튼 + 재발급
5. 기존 `src/utils/icsExport.js` 의 `buildIcs(rows, opts)` 순수 함수 Edge Function 측 재사용 (Deno ESM)

## 2. 배경·동기 (Why)

- blueprint v2 §4.2: 가장 끈적한 사용자 락인 후크
- 구글/애플/아웃룩 모두 native 구독 지원 — 플랫폼 락인 없음
- 학회 정보 갱신 시 자동 반영 (ics 다운로드 vs 구독의 결정적 차이)

## 3. 범위 (Scope)

### 포함
- `users` 테이블에 `calendar_token text UNIQUE` 컬럼 추가 (NULL 가능, 발급 전)
- `supabase/functions/calendar-feed/index.ts` 신설:
  - 토큰으로 user 조회
  - user 의 starred upcoming 학회 row 들 join
  - `buildIcs` 호출 → text/calendar 응답
- `src/utils/icsExport.js` 가 Deno 호환되도록 검증 (window 등 브라우저 의존 없음)
- 사용자 설정 페이지에 토큰 발급/재발급/복사 UI
- RPC `regenerate_calendar_token(p_user_id uuid)` — service_role 만 호출 가능 (Edge Function 또는 직접 호출)

### 제외 (Non-goals)
- 토큰 만료·revoke (Phase B)
- 라이브러리별·필터별 ICS feed (Phase B)
- 논문 마감일 / 초록 일정 — 스키마 미지원 (blueprint v1.2 §3.4 동일)

## 4. 설계 결정

### 4.1 인증
- URL 의 `token` 쿼리만으로 인증 (구글캘린더가 OAuth 못 씀)
- 토큰은 sha256(random 16바이트 + user_id) 형식, 32자 hex
- 노출 시 재발급으로 무효화

### 4.2 캐시
- Edge Function 응답에 `Cache-Control: max-age=3600` (1시간)
- 사용자 즐겨찾기·학회 변경 직후 동기화 늦을 수 있음 — 트레이드오프 OK

### 4.3 스코프
- 본인 starred=1 학회의 upcoming edition 만 export
- 라이브러리 모든 학회는 X — 스팸성 캘린더 방지

## 5. 단계 (Steps)

- [ ] **S1** — 브랜치 + migration (calendar_token 컬럼 + RPC + INDEX)
- [ ] **S2** — `supabase/functions/calendar-feed/index.ts` + buildIcs 호환
- [ ] **S3** — 사용자 설정 페이지 토큰 UI (PLAN-033 머지 후)
- [ ] **S4** — 통합 테스트 (curl 시나리오: 발급 → URL 호출 → ICS 응답 → 구글캘린더 import)
- [ ] **S5** — verify-task.sh 통과
- [ ] **S6** — PR

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] curl 응답 Content-Type: text/calendar
- [ ] 응답 본문 RFC 5545 호환 (`BEGIN:VCALENDAR` ~ `END:VCALENDAR`)
- [ ] 구글캘린더 "URL 로 추가" 동작
- [ ] starred 변경 후 1시간 내 캘린더 반영

## 7. 리스크·롤백

- **리스크**: Edge Function 의 buildIcs ESM import 실패 — supabaseClient.js 처럼 esm.sh 경유 또는 raw 복사
- **롤백**: Edge Function delete + DB 컬럼 drop

## 8. 후속

- 토큰 만료·rotate (Phase B)
- 라이브러리 단위 feed (Phase B)
- 알림 (D-N day) — PLAN-040

## 9. 작업 로그

- **2026-05-03**: blueprint v2 §4.2 기반 스펙 확정.
