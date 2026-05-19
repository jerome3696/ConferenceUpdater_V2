# PLAN-040: 관리자 기능 정비 — role 권한 분리 + 마스터 큐레이팅 UI + GitHub 레거시 정리

> **상태**: active (기획 — 착수 대기)
> **생성일**: 2026-05-19
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-040-admin`
> **연관 PR**: #
> **트랙**: A(체계화)

---

## 1. 목표 (What)

v3 멀티테넌트 구조에서 "진짜 관리자 기능"을 갖춘다. 완료 시:

1. UI 가 `users.role`('user'/'admin')을 실제로 사용 — 관리자만 보이는 기능이 분리됨
2. 관리자가 **앱 안에서** 공용 마스터(`conferences_upstream`)와 라이브러리(`library_conferences`·`libraries`)를 안전하게 편집·큐레이팅 가능
3. GitHub 토큰 연결 레거시가 제거되거나 명확한 관리자 백업 기능으로 재정의됨

## 2. 배경·동기 (Why)

2026-05-19 사용자 질문에서 드러난 3가지 미정리 사항:

- **role 미사용**: `MainTable isAdmin={isAuthenticated}` — 로그인한 누구나 학회 추가·전체 업데이트 버튼이 보인다. DB 의 `role` 컬럼이 UI 에 안 쓰임.
- **마스터 편집 경로 없음**: 앱의 편집 모달은 `user_conferences`(개인 override)만 건드린다. 공용 `conferences_upstream`·`library_conferences` 를 편집하려면 Supabase Dashboard Table Editor 직접 편집뿐 — 임시방편(되돌리기 없음·audit 미기록). PLAN-035 에서 "admin 라이브러리 큐레이팅 UI"로 미뤄둔 부분.
- **GitHub 연결 레거시**: v1·v2 의 `conferences.json` 커밋 방식. v3 Supabase 도입 후 의미를 잃었으나 UI·커밋 경로가 남아 모든 사용자에게 "GitHub 연결" 버튼이 노출됨.

blueprint §1.5.1 "공용 DB 는 AI·admin 만 변경" 원칙을 실제 UI 로 구현하는 작업.

## 3. 범위 (Scope)

### 포함
- `role` 기반 권한 게이팅 — `isAdmin` 을 `users.role==='admin'` 으로 치환 (`MainTable`·Header·admin 진입 등)
- admin 마스터 큐레이팅 UI — `conferences_upstream`·`editions_upstream` 편집, `library_conferences` 멤버십 추가/제거, `libraries` 생성 (RLS 정책에 admin write 추가 필요)
- GitHub 레거시 처리 — 제거 또는 관리자 전용 백업/내보내기로 재정의 + role 게이팅

### 제외 (Non-goals)
- OAuth·비밀번호 로그인 — PLAN-037
- 운영기 자동화(cron 갱신 등) — 별도 후속 PLAN (blueprint §1.5.6)

## 4. 설계 결정

(착수 시 확정) — 핵심 미결정 사항:
- GitHub 레거시: **완전 제거** vs **관리자 백업 기능으로 재정의** — 둘 중 택1
- 마스터 편집 UI 위치: AdminPage 확장 vs 별도 큐레이팅 페이지
- `conferences_upstream` write 의 RLS: admin role 정책 추가 + audit_log 연동 여부

## 5. 단계 (Steps)

- [ ] S1 — `role` 조회 훅/컨텍스트 + `isAdmin` 치환
- [ ] S2 — admin 마스터/라이브러리 큐레이팅 UI + RLS admin write 정책
- [ ] S3 — GitHub 레거시 제거 또는 재정의
- [ ] S4 — 테스트 + verify-task.sh
- [ ] S5 — PR

## 6. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 통과
- [ ] 일반 사용자 계정: 관리자 전용 버튼 미노출 확인
- [ ] 관리자 계정: 마스터 학회·라이브러리 멤버십 편집 → 전 사용자 반영 확인
- [ ] `structure.md` 갱신 (구조 변경 시)

## 7. 리스크·롤백

- **리스크**: `conferences_upstream` write 경로 신설 — RLS 실수 시 일반 사용자가 공용 데이터 훼손 가능. RLS 정책 신중히 + 로컬 supabase 사전 테스트.
- **롤백**: 기능별 revert 커밋. RLS 정책은 마이그레이션 롤백 SQL 동시 작성.

## 8. 후속 (Follow-ups)

- 운영기 자동화(cron·신뢰도 게이팅) — blueprint §1.5.6
- audit_log 에 직접 편집 기록 연동

## 9. 작업 로그

- **2026-05-19**: 사용자 질문(마스터 편집 방안·GitHub 연결 의미)에서 미정리 3건 식별 → PLAN 으로 기록. 착수 시점 미정 — PLAN-037(OAuth) 와 우선순위 조율 필요.
