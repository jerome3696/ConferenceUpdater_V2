# 학회 DB 관리 웹앱 — 개발 가이드 v3

> **상위 문서**: `docs/roadmap.md` (장기 Phase·상업화 로드맵)
> **현재 Phase**: **A.1 서버 MVP** — A.0 5개 P0 플랜 완료 (스키마·쿼터·Auth·장기비전). PLAN-028 migration SQL + Edge Function 작성 중.
> **하위 문서**: `docs/plans/active/PLAN-xxx.md` (개별 과제)
>
> **문서 버전**: v3.2 (pending-only 슬림화)
> **최종 수정일**: 2026-04-21
> **전임자**: `docs/legacy/dev-guide-v2.md` (Post-MVP Track A/B/C 완료)
> **완료된 v3 작업**: `docs/plans/completed/` (PLAN-009~019 + PR pending PLAN-024/025)
> **배경 자료**: `docs/blueprint.md` §7.2.1 Option 2/4 아키텍처, `docs/reference/HARNESS_MASTER.md`

---

## 1. 현재 상태

**모든 능동 작업 일시 보류.** oh-my-claudecode + Serena MCP 환경 정리 중. 정리 완료 후 아래 pending 항목 중 선택.

- **(A) v1_2 프롬프트 튜닝 — 보류**: PLAN-019 v1_1 측정(19/27, persistent 9→5) 완료. 추가 튜닝은 보류.
- **(B) D.1 Cloudflare Worker — 보류**: 다른 항목이 모두 정교화된 후 실행.
- **(C) Track G 리팩토링 — 보류**: refactor-baseline 2026-04-21 기록만 유지.

Active 플랜: 없음. 모든 후보는 skeleton. 착수 시 `docs/plans/active/PLAN-xxx.md` 신설.

---

## 2. Pending 트랙 (모두 보류 중)

### Track D: Infra 전환 — 제품화 궤도 (시퀀스 의존)
Option 2 → 2.5 → Option 4 순서. 각 단계가 다음 단계의 전제.

- [ ] **D.1** **Option 2 — Cloudflare Worker 프록시** (blueprint §7.2 우선순위 2) — **(B) 보류**
  - GitHub PAT를 Worker 환경변수로 이관. 브라우저는 비밀번호 하나로 Worker 경유 커밋
  - 공용 PC·타 기기에서도 편집 가능 → "본인 소유 기기 한정" 제약 해소
  - 프론트 변경은 `dataManager.js` 인터페이스 재활용으로 최소화
- [ ] **D.2** **사용자별 ICS 구독 URL** (blueprint §7.2 우선순위 2.5)
  - `/u/{token}/calendar.ics` 엔드포인트 — 구글/애플/아웃룩 자동 동기화
  - `src/utils/icsExport.js`의 `buildIcs` 를 서버에서 그대로 재사용
  - **상업화 코어 기능** — D.1 위에서 활성화
- [ ] **D.3** **Option 4 — Firebase/Supabase 전환** (blueprint §7.2 우선순위 4)
  - 클라우드 DB 전환. 실시간 동기화, 사용자별 DB, 다중 편집·권한 관리
  - `dataManager.js` 인터페이스 교체로 전환 설계됨

### Track E: 기능 확장 (Track D와 독립 병렬)
- [ ] **E.4** **discovery 프롬프트 fine-tuning** (PLAN-012 후보)
  - update v1_0→v1_1 진화와 동일 트랙. eval 인프라 이미 준비 완료

### Track F: 운영 품질 (상시 병행)
- [ ] **F.2 next** **v1_2 update 프롬프트 튜닝** — **(A) 보류**
  - v1_1 실패 패턴: 4년 주기 케이스, draft site confidence, ICMF JSON 안정성
- [ ] **F.3** **E2E 테스트 도입 (Playwright)**
  - 캘린더 뷰·ICS 다운로드·폼 모달·업데이트 큐 회귀 방지
  - 유닛 테스트(326+건)는 코드 정합만 확인 — 브라우저 UX 회귀는 수동 확인 의존
- [ ] **F.4** **qa-backlog 주기적 처리** — **현재 Active 0건 (대기)**
  - 실사용에서 누적된 `docs/qa-backlog.md` 를 5~10건 단위 batch 플랜화
  - 누적 전까지 트리거 없음. 체감 이슈 발생 시 먼저 qa-backlog 에 추가
- [ ] **F.5** **프롬프트 실패 로그 analyzer**
  - eval 결과 10회+ 축적 시점에 트리거. 공통 실패 패턴 자동 추출 → 다음 버전 레버 후보

### Track G: 리팩토링 후보 — **(C) 보류** (2026-04-21 refactor-check 기준선 기반)
`bash scripts/refactor-check.sh` Critical 1건 + Warning 5건. 착수 전 `docs/refactor-baseline-2026-04-21.md` 참조.

- [ ] **G.1** **PLAN-020 — useUpdateQueue last-edition 추출** (S 공수, 저위험)
  - `fetchLastEditionIfNeeded()` 헬퍼 추출. 278줄 → 250줄 목표
- [ ] **G.2** **PLAN-021 — promptBuilder.js 외부화** (M 공수, 저위험) — v1_2 튜닝 **전에** 완료 권장
  - 684줄 (Critical). system/user 템플릿 raw text를 `docs/prompts/v*.md` 로 이관
  - **목표 684 → ~450** (v1_0+v1_1 × 4 kind × system/user 분기 로직 잔존)
- [ ] **G.3** **PLAN-022 — responseParser 통합** (M 공수, 중간 위험)
  - 5개 파서의 공통 JSON 추출/검증을 `BaseParser` 로 추상화. 305줄 → 250줄 목표
- [ ] **G.4** **PLAN-023 — DiscoveryPanel 상태 분해** (L 공수, 높은 위험)
  - 14 useState → `useDiscoveryExpand` / `useDiscoverySearch` / `useDiscoveryResult` 3개 훅으로 분리

---

## 3. 트랙 의존성

```
Track D (INFRA — 시퀀스 의존) [보류]
  D.1 Option 2 (Worker) ──→ D.2 구독 URL ──→ D.3 Option 4 (DB)

Track E (EXTEND)
  E.4 discovery 프롬프트 튜닝 (v1_2 이후)

Track F (OPS)
  F.2-next v1_2 튜닝 [보류]   F.3 E2E   F.4 qa-backlog   F.5 log analyzer

Track G (REFACTOR) [보류]
  G.1 useUpdateQueue   G.2 promptBuilder (v1_2 전 권장)   G.3 responseParser   G.4 DiscoveryPanel
```

---

## 4. 완료 작업 참고 (상세는 `docs/plans/completed/`)

- **v1 MVP / v2 Post-MVP (Track A/B/C)** → `docs/legacy/dev-guide.md`, `docs/legacy/dev-guide-v2.md`
- **v3 완료 트랙**
  - Track E.1 신규 학회 자동 발굴 (PLAN-011, PR #20) — E.2·E.3 흡수 완료
  - Track F.1 Update 기능 종합 개선 (Phase 1 backfill + PLAN-013 Phase 2, PR #21·#22·#23)
  - Track F.2 프롬프트 평가 체계화 (PLAN-014·015·016·017·018 + PLAN-019 v1_0→v1_1, PR #24)
- **v3 운영 개선 (PR pending)**
  - PLAN-024 — useConferences stale closure 방지 (dataRef.current 단일 소스)
  - PLAN-025 — cycle_years 전수 감사 (33건, conf_020 3→2 정정 포함)

---

## 5. v3 운영 원칙

- **플랜 먼저**: 각 Track 아이템 착수 전 `docs/plans/active/PLAN-xxx.md` 필수
- **브랜치**: `feature/PLAN-xxx-설명` · `fix/설명` · `docs/설명` · `chore/설명`
- **커밋**: Conventional Commits · **모든 커밋은 verify-task 게이트 통과** (`bash scripts/verify-task.sh`)
- **트랙 전환 자유**: 선형 강제 없음. 현재 블로커·의존성만 존중
- **Skeleton → 상세 전환**: 이 문서의 체크박스는 skeleton. 개별 PLAN 문서가 권위 있는 소스
