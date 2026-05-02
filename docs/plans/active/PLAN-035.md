# PLAN-035: admin 대시보드 (사용량·비용·라이브러리 큐레이팅·초대 코드)

> **상태**: active
> **생성일**: 2026-05-03
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-035-admin-dashboard`
> **연관 PR**: #
> **트랙**: C(기능) — Phase **A.3** (`docs/blueprint-v2.md` §4.3)
> **의존**: PLAN-030 (libraries), PLAN-031 (audit_log), PLAN-033 (router)

---

## 1. 목표 (What)

`/admin` 페이지에 30명 운영용 모니터링·도구 위젯 배치. 완료 조건:
1. 사용량 / 비용 / 활성 사용자 / 어뷰즈 신호 위젯
2. 라이브러리 큐레이팅 UI (학회 ↔ 라이브러리 태깅)
3. 초대 코드 발급 (Q5-a A2 의 핵심 도구)
4. 자주 편집된 학회 TOP10 (PLAN-031 audit_log 활용)
5. RouteGuard 로 admin role 만 접근 가능

## 2. 배경·동기 (Why)

- 30명 운영 시작 = 본인 책임 모니터링 시작점
- $50 월 예산 사고 위험 — 실시간 추세 위젯 없으면 못 잡음
- 라이브러리 큐레이팅 UI 가 admin 만의 권한이라 별도 페이지 필수
- 초대 코드 흐름 (Q5-a A2) 의 발급 도구 필요

## 3. 범위 (Scope)

### 포함

#### 위젯
- **사용량 표** — 사용자별 (current month update_used / discovery_used / 누적 cost_usd / 활동 일자)
- **월 비용 추세** — sparkline (지난 6개월), $50 마지노선 표시
- **라이브러리 통계** — 라이브러리별 학회 수 + 구독자 수
- **자주 편집 학회 TOP10** — 지난 30일 기준
- **어뷰즈 신호** — 시간당 호출 5회 이상 / status=error 비율 ≥ 30% 사용자

#### 도구
- **초대 코드 발급**: 코드 생성 + 의도 사용자 이메일 메모 + 발급 상태 (사용됨 / 미사용)
- **라이브러리 큐레이팅**: 라이브러리 선택 → 학회 추가/제거 (`library_conferences` UPSERT/DELETE)
- **사용자 한도 조정**: SELECT 사용자 → update_limit / discovery_limit 변경 (admin RLS 정책 활용)

#### 신규 테이블
- `invitations` (code, intended_email, created_by, used_by, used_at, expires_at)

### 제외 (Non-goals)
- 자동 비용 알림 (`Phase B`) — 위젯에 표시만
- 사용자 차단·계정 비활성 — 별도 PLAN
- 라이브러리 lifecycle (폐기) — Phase C

## 4. 설계 결정

### 4.1 RLS·접근
- `invitations` 테이블 RLS: admin 만 SELECT/INSERT
- 사용량 위젯은 모두 admin 의 `is_admin()` 가드 통과 후 service_role 우회 SQL 가능. 하지만 RLS 친화적으로:
  - `users` / `quotas` / `api_usage_log` 모두 admin SELECT 정책 이미 있음 (PLAN-029 hotfix 후)
  - 그냥 본인 admin role 일 때 SELECT 직접 호출

### 4.2 초대 코드
- 16자 hex 랜덤. `created_at` + 만료 30일.
- 가입 흐름 (LoginScreen) 에서 `?invite=CODE` 쿼리 또는 입력 필드.
- 가입 직후 trigger 가 `invitations.used_by=NEW.id, used_at=now()` 갱신.

### 4.3 라이브러리 큐레이팅 UI
- 좌측 라이브러리 리스트, 우측 학회 목록 (체크박스).
- 학회 검색·필터링 (분류·분야·지역) 재사용 (`useFiltering`).
- 변경 즉시 저장 (auto-save) + 토스트 피드백.

## 5. 단계 (Steps)

- [ ] **S1** — 브랜치 + migration (invitations 테이블 + RLS + trigger)
- [ ] **S2** — `src/pages/AdminPage.jsx` 골격 + RouteGuard 활용
- [ ] **S3** — 위젯 5개 (사용량 / 비용 / 라이브러리 / 자주 편집 / 어뷰즈)
- [ ] **S4** — 초대 코드 발급 UI
- [ ] **S5** — 라이브러리 큐레이팅 UI
- [ ] **S6** — 사용자 한도 조정 UI
- [ ] **S7** — 테스트 (각 위젯 mock 시나리오)
- [ ] **S8** — verify-task.sh 통과
- [ ] **S9** — PR

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] non-admin 직접 접근 시 `/` 리다이렉트
- [ ] admin 로그인 후 위젯 모두 정상 로드
- [ ] 초대 코드 발급 → 다른 브라우저 가입 시 코드 입력 → 가입 성공 → invitations.used_by 갱신
- [ ] 라이브러리 큐레이팅 → 학회 추가 → mergeAll 결과에 반영

## 7. 리스크·롤백

- **리스크**: 위젯 SQL 이 무거우면 admin 페이지 로딩 느림. limit + index 활용.
- **롤백**: 페이지 단위 revert

## 8. 후속

- 자동 비용 알림 (이메일·Slack) — Phase B
- 사용자 차단·기록 — Phase B (어뷰즈 감지)

## 9. 작업 로그

- **2026-05-03**: blueprint v2 §4.3 기반 스펙 확정.
