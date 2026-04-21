# PLAN-027: Ultra-Plan 로드맵 체계 구축 — docs/roadmap.md 신설

> **상태**: active
> **생성일**: 2026-04-21
> **완료일**: (완료 시 갱신)
> **브랜치**: `feature/PLAN-027-ultra-plan-roadmap`
> **연관 PR**: #
> **트랙**: A(체계화) — 문서 계층 재설계

---

## 1. 목표 (What)

장기 로드맵의 단일 출처 `docs/roadmap.md` 를 신설하고, 기존 문서(`CLAUDE.md` / `blueprint.md §7` / `dev-guide-v3.md` / `PLAN-026`)가 상향 참조하도록 연결한다. 세션 휘발성 `.claude/plans/3-spicy-manatee.md` v3 의 **전략 분석**(API 비용 절감 판정 + 3대 횡단 축 + Phase 정의)을 영구 흡수한다.

## 2. 배경·동기 (Why)

- 상업화 로드맵(P1 30명 → P2 100명 → P3 요금) 확정 후, 장기 계획을 담는 문서가 없어 매번 PLAN 착수 시 전략 컨텍스트 재조립이 필요했다.
- 전략 분석은 Claude 플랜 모드 파일(`.claude/plans/3-spicy-manatee.md`)에만 존재했고, 세션 종료·다음 플랜 작성 시 덮어써짐 → **영속성 없음**.
- `blueprint.md §7` 에는 일부 로드맵이 흩어져 있으나, 상업화 Phase·비용 모델·API 절감 판정은 포함되어 있지 않았다.
- 사용자 요청: "ultra-plan 을 md 로 관리. phase A/B/C + 30명/100명/n명 로드맵이 장기 플랜, dev-guide-v3 가 단기, PLAN-xxx 가 서브플랜."

## 3. 범위 (Scope)

### 포함
- `docs/roadmap.md` 신설 (300줄 이내, Phase A/B/C + API 판정표 + 3대 축 + PLAN 매핑 + 리스크)
- `CLAUDE.md` 문서 맵 최상단에 "장기 로드맵" 행 추가, "현재 상태" 갱신, §7 참조를 roadmap.md 로 교체
- `docs/blueprint.md §7.1·§7.2` 축약 → roadmap.md 링크. **§7.2.1 Option 2→4 기술 설계는 유지** (기능 설계)
- `docs/dev-guide-v3.md` 상단에 "상위/현재 Phase/하위" 3행 헤더
- `docs/plans/active/PLAN-026.md §2 배경` 의 `.claude/plans/...` 참조 → roadmap.md 로 교체 (PLAN-026 브랜치에서 별도 커밋)
- 본 PLAN-027 repo 문서 (이 파일)

### 제외 (Non-goals)
- 후속 PLAN(P0-schema / P0-quota-policy / P0-auth-flow) 착수 — roadmap 완성 후 별도 플랜
- blueprint.md §7 외 섹션 수정 (제품 설계 본문 불변)
- dev-guide-v3 Track 재편 — 구조 유지, 상단 헤더만 추가
- Phase별 상세 스펙(쿼터 수치·스키마 컬럼·SMTP 설정 등)은 후속 PLAN

## 4. 설계 결정

### 4.1 문서 3계층 구조
```
docs/roadmap.md            (장기 Phase, 북극성)
 └── docs/dev-guide-v3.md  (현재 sprint)
      └── docs/plans/active/PLAN-xxx.md (개별 과제)
```
각 하위 문서 상단에 상위 문서 링크 배치 → 어느 레이어를 읽든 상향 네비게이션 가능.

### 4.2 blueprint.md §7 축약 vs 삭제
- §7 **삭제 금지** — 외부(dev-guide-v3 D.1·D.2·D.3, 완료 PLAN 여러 개, changelog)에서 §7.2.1·§7.2·§7.2 등을 참조.
- 대신 §7.1(일반 future plans) 과 §7.2 우선순위 표를 축약/이관하고 **§7.2.1 번호 유지** → 외부 참조 깨짐 없음.

### 4.3 API 비용 절감 판정표 보존
- 12개 수단 × 판정 근거를 roadmap.md §7 에 표로 기록.
- 미래에 "왜 WikiCFP를 안 썼는가" 같은 질문이 재발하면 근거를 문서에서 즉시 확인 가능.

### 4.4 Phase A.0 = 준비기
- Phase A(P1, 30명)는 "서버 MVP 배포 완료 시점부터" 1-6개월.
- 그 전 **설계·스키마·쿼터 정책 확정 단계**는 Phase A.0 (준비기)로 분리.
- 현재 위치 = Phase A.0.

## 5. 단계 (Steps)

- [x] **S1** — `feature/PLAN-027-ultra-plan-roadmap` 브랜치 생성 (from main)
- [x] **S2** — `docs/roadmap.md` 작성 (189줄, 300줄 이내)
- [x] **S3** — `CLAUDE.md` 문서 맵 + 현재 상태 + §7 링크 갱신 (59줄, 60줄 이내)
- [x] **S4** — `docs/blueprint.md §7` 축약 + §7.2.1 보존
- [x] **S5** — `docs/dev-guide-v3.md` 상단 3줄 헤더
- [x] **S6** — 본 PLAN-027 repo 문서 작성
- [ ] **S7** — `bash scripts/verify-task.sh` 통과
- [ ] **S8** — `feature/PLAN-027` 커밋 + push + PR
- [ ] **S9** — `feature/PLAN-026-server-stack-comparison` 브랜치 스위치 → §2 참조 교체 → 추가 커밋
- [ ] **S10** — PR 2개(PLAN-026, PLAN-027) merge 후 PLAN-027 completed/ 이동

## 6. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 통과
- [ ] `docs/roadmap.md` 첫 화면(상단~§2)만 읽어도 현재 Phase·다음 할 일·월 비용 예측 파악 가능
- [ ] `CLAUDE.md` 문서 맵 스캔 시 로드맵 행이 첫 줄로 눈에 들어옴
- [ ] `blueprint.md §7.2.1` 외부 참조(dev-guide-v3 D.1 등) 깨지지 않음
- [ ] 3-spicy-manatee v3 의 판정표·3대 축·Phase 테이블이 roadmap.md 내에서 검색됨 (grep 기준)
- [ ] `docs/dev-guide-v3.md` 상단만 읽어도 상위 로드맵·현재 Phase·하위 PLAN 경로 파악 가능

## 7. 리스크·롤백

**리스크**
- `blueprint.md §7` 축약 시 외부 참조 깨짐 → 사전 grep 으로 §7.2.1 보존 필요성 확인, 번호 유지로 해소
- `roadmap.md` 가 또 다른 blueprint 로 비대화 → 300줄 이내 엄수, 초과 시 후속 PLAN 으로 이관
- Phase 정의 변경 시 `dev-guide-v3` + `blueprint` + PLAN 모두 갱신 필요 → 초기 확정 후 6개월 고정 합의

**롤백**
- 순수 문서 변경이므로 해당 커밋 `git revert` 로 원상복구 가능
- `.claude/plans/3-spicy-manatee.md` 원본은 git 히스토리 복구 가능 (이미 재작성되어 있어도 reflog 접근)

## 8. 후속 (Follow-ups)

roadmap.md 완성·승인 후 순차 착수:

1. **PLAN-P0-multitenant-schema.md** — `users`/`conferences_upstream`/`user_conferences`/`api_usage_log`/`quotas` 5테이블 + RLS 정책
2. **PLAN-P0-quota-policy.md** — 리셋 주기·초과 UX·카운터 원자성·어뷰즈 방지 상세 스펙
3. **PLAN-P0-auth-flow.md** — 로그인·회원가입 UX + Resend SMTP 연동 (Day 1)
4. **PLAN-028-api-proxy-mvp.md** — Supabase Edge Function `/api/claude/*` 프록시 + Prompt Caching
5. **PLAN-029-client-migration.md** — `src/services/claudeApi.js` → 서버 엔드포인트 전환

## 9. 작업 로그

- **2026-04-21**: 3-spicy-manatee v3 승인 직후 사용자가 "ultra-plan md 관리" 요청. 문서 3계층 재설계 + 전략 분석 영구 흡수 플랜 수립·착수.
- **2026-04-21**: roadmap.md(189줄) + CLAUDE.md(59줄) + blueprint.md §7 축약 + dev-guide-v3 헤더 + PLAN-027 repo 플랜 6건 작성 완료.
