# PLAN-030: 라이브러리 스키마 + 사용자 구독 + 옵트인 동기화

> **상태**: active (스펙 확정, 구현 대기)
> **생성일**: 2026-05-03
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-030-libraries`
> **연관 PR**: #
> **트랙**: A(체계화) — Phase **A.3 직전** (`docs/blueprint-v2.md` §2.4)
> **의존**: PLAN-038 (user_conferences write 경로) 선행 권장

---

## 1. 목표 (What)

블루프린트 v2 §2.4 의 라이브러리 모델을 DB·UI 로 구현. 완료 조건:

1. `libraries` / `library_conferences` / `user_libraries` 3 테이블 + RLS 적용
2. 가입 흐름에 라이브러리 다중 선택 UI 추가 (LoginScreen 확장 또는 별도 onboarding 페이지)
3. `/libraries` 페이지 (PLAN-033 라우터 도입 후) — 본인 구독 목록 + 추가/제거 + 옵트인 동기화 알림
4. 학회 행에 라이브러리 뱃지 컬럼
5. "내 학회" 가상 라이브러리 (사용자별 1개 자동 생성, Discovery·D3 적재)

## 2. 배경·동기 (Why)

- v2 핵심 컨셉: 사용자가 가입 시 1+ 라이브러리 선택 → 본인 라이브러리 fork
- 현재는 모든 학회가 한 묶음으로 보임 — 라이브러리 단위 큐레이션 없음
- 분야 다양화 (Phase B) 의 전제 — 공조·디지털트윈 라이브러리 분리 필요

## 3. 범위 (Scope)

### 포함
- `supabase/migrations/2026...._libraries.sql` — 3 테이블 + RLS + 가상 라이브러리 자동 생성 trigger
- 가입 후 onboarding 흐름 — 라이브러리 다중 선택 → user_libraries INSERT
- `/libraries` 페이지 — 구독 목록 + 추가/제거 + 동기화 알림 카드
- 메인 테이블에 라이브러리 뱃지 컬럼 + 라이브러리 필터 체크박스
- mergeConference 의 user_conferences merge 시 library 정보 join
- master 라이브러리 시드 (현재 32 학회) — admin 페이지(PLAN-035) 또는 별도 시드 스크립트

### 제외 (Non-goals)
- admin 의 라이브러리 큐레이팅 UI — PLAN-035 admin 대시보드 범위
- 라이브러리 자동 동기화 (C2) — C3 옵트인만 구현
- "내 학회" 가상 라이브러리에서 master 흡수 환원 경로 — 후속

## 4. 설계 결정

### 4.1 스키마
```sql
CREATE TABLE libraries (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  description  text,
  is_virtual   boolean NOT NULL DEFAULT false,  -- "내 학회" 인 경우 true
  owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE, -- 가상 라이브러리만 NULL 아님
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE library_conferences (
  library_id    text REFERENCES libraries(id) ON DELETE CASCADE,
  conference_id text REFERENCES conferences_upstream(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (library_id, conference_id)
);
CREATE TABLE user_libraries (
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  library_id    text REFERENCES libraries(id) ON DELETE CASCADE,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),  -- 옵트인 동기화 baseline
  PRIMARY KEY (user_id, library_id)
);
```

### 4.2 가상 라이브러리 자동 생성
- `handle_new_auth_user` trigger 확장 — 사용자별 `lib_personal_<user_id>` 라이브러리 1개 자동 INSERT (`is_virtual=true`, `owner_user_id=user_id`)

### 4.3 옵트인 동기화 (C3)
- 사용자 `last_seen_at` 이후 라이브러리에 INSERT 된 학회를 알림 카드로 표시
- 사용자가 [수락] 누르면 `user_conferences` 에 INSERT + `last_seen_at = now()` 갱신
- [무시] 누르면 `last_seen_at = now()` 갱신 (다시 안 뜸)

### 4.4 RLS
- libraries: SELECT 전원 (admin 큐레이팅 + 본인 가상)
- library_conferences: SELECT 전원
- user_libraries: 본인 CRUD

### 4.5 시드
- `lib_master` (관리자 메인) + 32 학회 매핑은 마이그레이션에 INSERT
- Phase B 추가 라이브러리 (공조·디지털트윈 등) 는 admin 페이지에서 추가

## 5. 단계 (Steps)

- [ ] **S1** — `feature/PLAN-030-libraries` 브랜치
- [ ] **S2** — migration SQL (3 테이블 + RLS + trigger 확장 + master 시드)
- [ ] **S3** — `src/utils/mergeConference.js` 확장 — library 정보 join
- [ ] **S4** — Onboarding 페이지 (가입 후 라이브러리 선택)
- [ ] **S5** — `/libraries` 페이지 (router PLAN-033 머지 후)
- [ ] **S6** — 메인 테이블 라이브러리 뱃지 + 필터
- [ ] **S7** — 동기화 알림 카드 UI
- [ ] **S8** — 테스트 추가 (mergeConference 확장 테스트, library hook)
- [ ] **S9** — verify-task.sh 통과
- [ ] **S10** — PR

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] migration 적용 후 신규 가입 시 자동 가상 라이브러리 생성 확인
- [ ] 다중 구독 → 메인 테이블에 학회 1행 + 뱃지 [master, 공조] 표시
- [ ] 라이브러리에 학회 추가 → 알림 카드 표시 → 수락 동작

## 7. 리스크·롤백

- **리스크**: trigger 확장 실수로 가입 깨질 수 있음 → 별도 migration 분리 + 로컬 supabase 에서 사전 테스트
- **롤백**: migration 롤백 SQL 동시 작성 (DROP 3테이블 + trigger 원복)

## 8. 후속

- admin 라이브러리 큐레이팅 UI (PLAN-035)
- 가상 라이브러리 → master 흡수 환원 경로
- 라이브러리 lifecycle (폐기·비공개) — Phase C

## 9. 작업 로그

- **2026-05-03**: blueprint v2 §2.4 기반 스펙 확정. PLAN-038 (user_conferences write) 선행 권장.
