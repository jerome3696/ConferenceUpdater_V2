# PLAN-031: audit_log + 학회 메타 + 자주 편집 학회 신호

> **상태**: active
> **생성일**: 2026-05-03
> **완료일**: (미완)
> **브랜치**: `feature/PLAN-031-audit-log`
> **연관 PR**: #
> **트랙**: A(체계화) — Phase **A.3** (`docs/blueprint-v2.md` §5.2~§5.3)
> **의존**: PLAN-030 권장 (라이브러리 컨텍스트 활용 시), 단 단독 머지 가능

---

## 1. 목표 (What)

공용 DB (`conferences_upstream`) 의 변경 추적 인프라를 도입한다. 완료 조건:
1. `conferences_upstream` 메타 컬럼 (`edited_count`, `last_edited_at`) 추가
2. `audit_log` 테이블 + RLS 적용
3. Edge Function 의 AI 흐름이 audit_log 에 기록 (source='ai_search')
4. admin 대시보드 (PLAN-035) 에 "최근 30일 N회 이상 편집된 학회 TOP10" 위젯 데이터 소스 제공

## 2. 배경·동기 (Why)

- /grill-me Q7 사용자 우려 — AI 무분별 수용 + 자주 편집 학회 신호 추적 필요
- 30명 운영 시작 후 데이터 품질 저하 조기 감지 도구 부재
- audit_log 가 있어야 Phase B 의 어뷰즈 감지·자동 verify 트리거 가능

## 3. 범위 (Scope)

### 포함
- migration SQL (`20260503000003_audit_log_and_meta.sql`)
  - `conferences_upstream` 에 `edited_count int NOT NULL DEFAULT 0`, `last_edited_at timestamptz`
  - `audit_log` 테이블 신설 + RLS
  - service_role 만 INSERT 허용
- Edge Function `claude-proxy` — AI 결과 INSERT 시 audit_log 동시 기록
- 메타 컬럼 자동 갱신 trigger (audit_log INSERT → conferences_upstream.edited_count++ )
- TypeScript 타입 정의 갱신

### 제외 (Non-goals)
- admin 대시보드 위젯 UI — PLAN-035 범위. 본 PLAN 은 데이터 소스만.
- audit_log 기반 자동 verify (C4) — Phase C
- 사용자 수동 편집 audit (현재 user_conferences write 경로 PLAN-038 의 영역, 선택사항)

## 4. 설계 결정

### 4.1 스키마
```sql
ALTER TABLE public.conferences_upstream
  ADD COLUMN edited_count   int  NOT NULL DEFAULT 0,
  ADD COLUMN last_edited_at timestamptz;

CREATE TABLE public.audit_log (
  id            bigserial PRIMARY KEY,
  user_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  conference_id text NOT NULL REFERENCES public.conferences_upstream(id) ON DELETE CASCADE,
  field         text NOT NULL,
  old_value     text,
  new_value     text,
  ts            timestamptz NOT NULL DEFAULT now(),
  source        text NOT NULL CHECK (source IN ('manual','ai_search','admin')),
  endpoint      text
);
CREATE INDEX audit_log_conf_ts_idx ON public.audit_log(conference_id, ts DESC);
CREATE INDEX audit_log_user_ts_idx ON public.audit_log(user_id, ts DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY al_self_read  ON public.audit_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY al_admin_read ON public.audit_log FOR SELECT USING (public.is_admin(auth.uid()));
-- INSERT 정책 없음 → service_role 만 가능
```

### 4.2 메타 자동 갱신 trigger
```sql
CREATE OR REPLACE FUNCTION public.bump_edit_meta() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conferences_upstream
    SET edited_count = edited_count + 1,
        last_edited_at = NEW.ts,
        last_editor_id = NEW.user_id
    WHERE id = NEW.conference_id;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_log_bump_meta
  AFTER INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.bump_edit_meta();
```

### 4.3 Edge Function 통합
- `claude-proxy` 의 AI 응답 처리 후 audit_log INSERT 추가
- 변경된 필드들마다 row 1개 (start_date / end_date / venue / link)
- old_value 는 INSERT 전 SELECT 로 가져옴 (간단 구현; 추후 update 직전 RETURNING 활용 가능)

## 5. 단계 (Steps)

- [ ] **S1** — `feature/PLAN-031-audit-log` 브랜치
- [ ] **S2** — migration SQL 작성 (메타 컬럼 + 테이블 + RLS + trigger)
- [ ] **S3** — Edge Function `claude-proxy/index.ts` 의 AI 흐름에 audit_log INSERT 통합
- [ ] **S4** — 통합 테스트 (curl 시나리오: AI 호출 → audit_log row 생성 + edited_count++ 확인)
- [ ] **S5** — TypeScript 타입 정의 갱신
- [ ] **S6** — verify-task.sh 통과
- [ ] **S7** — PR

## 6. 검증

- [ ] verify-task.sh 통과
- [ ] migration 로컬 supabase 적용 시 에러 0
- [ ] curl 로 AI update 호출 → audit_log row 4개(필드별), edited_count = 1, last_edited_at 갱신
- [ ] RLS: 본인 audit_log 만 SELECT, 다른 사용자 행은 노출 안 됨

## 7. 리스크·롤백

- **리스크**: trigger 가 모든 INSERT 마다 UPDATE → 대용량 시 성능 우려. 30명 단계는 무시.
- **롤백**: `DROP TRIGGER audit_log_bump_meta`, `DROP TABLE audit_log`, `ALTER TABLE conferences_upstream DROP COLUMN ...`

## 8. 후속

- C3 프롬프트 보강 (자주 편집 학회 → AI 호출 시 hint) — Phase B
- C4 자동 verify 트리거 — Phase C
- 사용자 수동 편집 audit (PLAN-038 와 통합 가능)

## 9. 작업 로그

- **2026-05-03**: blueprint v2 §5.2~§5.3 기반 스펙 확정.
