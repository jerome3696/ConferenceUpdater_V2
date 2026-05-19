# PLAN-040: 관리자 기능 정비 — role 권한 분리 + 마스터 큐레이팅 UI + GitHub 레거시 정리

> **상태**: active (설계 확정 — 착수 대기)
> **생성일**: 2026-05-19
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-040-admin`
> **연관 PR**: #
> **트랙**: A(체계화)
> **의존**: PLAN-030 · PLAN-035 · PLAN-041 ("내 학회" 적재 — 승격 대상)

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

## 4. 설계 결정 (2026-05-19 grill-me 확정)

### 4.1 role 권한 분리
`isAdmin = isAuthenticated` → `users.role==='admin'` 으로 치환. 경계선:

| 기능 | 일반 사용자 | 관리자 |
|---|---|---|
| 별표·개인 메모·라이브러리 구독·AI 업데이트·발굴 | ✅ | ✅ |
| 학회 사실 편집·라이브러리 큐레이팅·사용자 관리 | ❌ | ✅ |

- `users.role` 은 Supabase 에서 수동 설정 (파일럿 = jerome3696). 별도 UI 불요.

### 4.2 사실 편집 = 관리자 전용 (blueprint §1.5.1 준수)
blueprint §1.5.1 "사실 필드 개인 override 금지, 개인 레이어는 메타데이터 전용"에 맞춰 [편집] 모달을 관리자 전용으로. 일반 사용자는 별표·메모만. **개인 override 코드 제거** (`mergeConference`·`saveConferenceEdit`·`useConferences` 의 `overrides` 경로). `user_conferences.overrides` 컬럼은 미사용화 (DROP 은 선택적 후속).

### 4.3 편집 UI — 기존 surface 재활용 (새 페이지 없음)
- **학회 사실 + 라이브러리 태그**: 메인 테이블 기존 [편집] 모달 재활용. 관리자가 쓰면 `conferences_upstream` 에 직접 write. 모달에 "이 학회가 속한 라이브러리" 다중선택 추가.
- **라이브러리 CRUD** (생성·이름·생애주기): AdminPage 에 "라이브러리 관리" 섹션 추가.
- **관리자는 구독 게이팅 무시** — 큐레이팅하려면 전체 학회가 보여야 하므로 `gateBySubscribedLibraries` 를 관리자에겐 건너뜀.
- **승격 흐름**: 사용자 "내 학회"(PLAN-041)에 쌓인 발굴 학회를 관리자가 중앙 라이브러리로 편입 (§1.5.7).

### 4.4 GitHub 레거시 완전 제거
`githubStorage.js`·`useGitHubToken`·`GitHubTokenModal`·useConferences 의 커밋·디바운스·`syncStatus`·SyncBadge·App.jsx 토큰 모달 — 전부 삭제. Supabase 단일 데이터 계층.

### 4.5 감사 로그 — DB 트리거
`conferences_upstream`·`editions_upstream` 에 UPDATE/INSERT/DELETE 트리거 → `audit_log` 자동 기록. 경로 무관(앱·대시보드·AI) 전부 포착. roadmap Phase A "trust-all + 감사로그" 모델 부합. admin role 의 마스터 테이블 write RLS 정책도 추가(필수).

## 5. 단계 (Steps)

- [ ] S1 — `role` 조회 + `isAdmin` 치환 (`users.role==='admin'`), 권한 경계 적용
- [ ] S2 — 개인 override 코드 제거 ([편집] 모달 관리자 전용화)
- [ ] S3 — admin write RLS 정책 + `audit_log` 트리거 (마이그레이션)
- [ ] S4 — [편집] 모달 → 관리자 시 `conferences_upstream` write + 라이브러리 태그 다중선택
- [ ] S5 — AdminPage "라이브러리 관리" 섹션 (라이브러리 CRUD + 발굴 학회 승격)
- [ ] S6 — GitHub 레거시 완전 제거
- [ ] S7 — 테스트 + verify-task.sh
- [ ] S8 — PR

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

- **2026-05-19**: 사용자 질문(마스터 편집 방안·GitHub 연결 의미)에서 미정리 3건 식별 → PLAN 으로 기록.
- **2026-05-19 (grill-me)**: 설계 확정 — §4 전면 작성. role 분리·사실편집 관리자전용(개인 override 제거)·기존 surface 재활용·GitHub 완전제거·audit 트리거. 구현 순서: PLAN-037 → PLAN-041 → PLAN-040.
