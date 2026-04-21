# 학회 DB 관리 웹앱 — 개발 가이드 v3

> **문서 버전**: v3.1
> **최종 수정일**: 2026-04-21
> **전임자**: `docs/legacy/dev-guide-v2.md` (Post-MVP Track A/B/C 완료)
> **배경 자료**: `docs/blueprint.md` §7.2 우선순위, `docs/reference/HARNESS_MASTER.md`

---

## 1. 현재 상태

**PLAN-019 v1_1 측정 완료 (19/27, persistent 9→5). 다음: v1_2 튜닝 (4년 주기 케이스, draft site confidence, ICMF JSON 안정성).**

v2까지는 선형적이었다 — Track A(체계화) → B(품질) → C(확장) 순으로 Step 단위 시퀀스. v3는 **병렬 트랙 구조**를 전제로 한다. 인프라·기능·운영이 각자 리듬으로 돌면서, 릴리스·실사용 피드백에 따라 우선순위를 재조정.

각 Track 아이템은 **상세 플랜 수립 시 `docs/plans/active/PLAN-xxx.md` 파일로 전환**. 개별 PLAN 문서가 권위 있는 소스이며, 이 문서는 전체 조감도 역할만 한다.

---

## 2. 전임자 성과 (요약)

### v1 — MVP (`docs/legacy/dev-guide.md`)
- JSON + localStorage + GitHub Pages 정적 호스팅 베이스라인
- Claude API 기반 학회 업데이트 / 정합성 검증
- MainTable · UpdatePanel · ConferenceFormModal 등 뼈대

### v2 — Post-MVP 체계화·확장 (`docs/legacy/dev-guide-v2.md`)
- **Track A (체계화)**: Husky, Vitest, CI, verify-task, 플랜 hook, 브랜치 전략, CLAUDE.md 재편
- **Track B (품질)**: 테스트 168건, 프롬프트 v2~v6 이터레이션, 리팩토링 (PLAN-007·008)
- **Track C (확장)**: 캘린더 뷰 (PLAN-009), scope UX + ICS 내보내기 + 즐겨찾기 이진화 (PLAN-010)

---

## 3. v3 트랙 구조 (병렬)

### Track D: Infra 전환 — 제품화 궤도 (시퀀스 의존)
Option 2 → 2.5 → Option 4 순서. 각 단계가 다음 단계의 전제.

- [ ] **D.1** **Option 2 — Cloudflare Worker 프록시** (blueprint §7.2 우선순위 2)
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
- [x] **E.1** **신규 학회 자동 발굴** — **완료** (PLAN-011, PR #20 머지 2026-04-18): 시드 키워드 → Stage 1 확장 → Stage 2 웹검색 → 3중 안전망(`utils/predatoryScore.js` + `utils/nameMatch.js` + 도메인 블랙리스트) → DiscoveryPanel UI. 회당 $0.16. `docs/plans/completed/PLAN-011.md`
- [x] **E.2** **가짜 학회 필터링** — **E.1에 흡수 완료** (predatoryScore + 거절 토글)
- [x] **E.3** **키워드 추천** — **E.1에 흡수 완료** (KeywordExpansion Stage 1)
- [ ] **E.4** **discovery 프롬프트 fine-tuning** (PLAN-012, v1_2 update 튜닝 이후 검토)
  - update v1_0→v1_1 진화와 동일 트랙. eval 인프라(Track F.2)는 이미 준비 완료

### Track F: 운영 품질 (상시 병행)
- [x] **F.1** **Update 기능 종합 개선** — **완료** (Phase 1 + Phase 2)
  - [x] **Phase 1 — Last edition 1차 채움** (2026-04-19, PR #21): 28건 backfill (high 27 / medium 1), past 보유 master 2 → 29 전수. Claude Code WebSearch 활용 (API 비용 0). `scripts/export-review.cjs` / `import-review.cjs` 검수 도구 동반 추가
  - [x] **Phase 2 — 프롬프트/로직 정교화** (PLAN-013, PR #22·#23 머지 2026-04-20): 5개 서브플랜 + 326 tests 통과
    - [x] A — Edition `anchored` 필드 + UI 토글. 사용자 확정 upcoming 재검색 보호
    - [x] B1 — `src/utils/urlClassifier.js` 신규 (official_edition/series/org_event/news/listing 분류 → high/medium/low 신뢰도), `dateUtils.daysUntil`·`cycleProgress` 확장
    - [x] B2 — `shouldSearch(row, mode)` 전면 재작성, "전체 업데이트" 정밀/일반 모달
    - [x] C — Update prompt v7 (`formatLastEditionV2` last.link 노출). dedicated_url 제거
    - [x] D — `buildLastEditionPrompt` + `parseLastEditionResponse` + `applyLastDiscovery` + `useUpdateQueue` 분기
  - **Step E (v6 vs v7 eval) 대체**: PLAN-019 흐름으로 이관 — 소스 2축 재설계 + Haiku 단일 + v1_0 재시작. Track F.2 참조.
- [x] **F.2** **프롬프트 평가 체계화** — **완료** (PLAN-014~018 인프라 + PLAN-019 첫 주기, PR #24 머지 2026-04-20)
  - [x] PLAN-014 — `docs/prompts/v{N}.md` MD 미러 + drift 차단 동기화 테스트 (`promptBuilder.sync.test.js`)
  - [x] PLAN-015 — 골든셋 XLSX 일원화 (27건) + CSV 레거시 `docs/eval/legacy/`
  - [x] PLAN-016 — `scripts/eval-prompt.js` XLSX 입력 + 4필드 가중 채점
  - [x] PLAN-017 — `scripts/eval-loop.js` N회 반복 + early-stop 래퍼
  - [x] PLAN-018 — `.claude/skills/prompt-designer.md` Skill + 운영 문서 재정리
  - [x] PLAN-019 — v1_0(16/27) → v1_1(19/27, persistent 9→5) 측정. `DEFAULT_UPDATE_VERSION = v1_1`
  - **다음**: v1_2 튜닝 (4년 주기 / draft site confidence / ICMF JSON 안정성)
- [ ] **F.3** **E2E 테스트 도입 (Playwright)**
  - 캘린더 뷰·ICS 다운로드·폼 모달·업데이트 큐 회귀 방지
  - 유닛 테스트(326건)는 코드 정합만 확인 — 브라우저 UX 회귀는 아직 수동 확인 의존
- [ ] **F.4** **qa-backlog 주기적 처리**
  - 실사용에서 누적된 `docs/qa-backlog.md` 를 5~10건 단위 batch 플랜화
- [ ] **F.5** **프롬프트 실패 로그 analyzer** (기존 F.2 에서 이동)
  - eval 결과 10회+ 축적 시점에 트리거. 공통 실패 패턴 자동 추출 → 다음 버전 레버 후보

### Track G: 리팩토링 후보 (2026-04-21 refactor-check 기준선 기반)
`bash scripts/refactor-check.sh` Critical 1건 + Warning 5건. 착수 전 `docs/refactor-baseline-2026-04-21.md` 참조.

- [ ] **G.1** **PLAN-020 — useUpdateQueue last-edition 추출** (S 공수, 저위험)
  - `fetchLastEditionIfNeeded()` 헬퍼 추출. 278줄 → 250줄 목표
- [ ] **G.2** **PLAN-021 — promptBuilder.js 외부화** (M 공수, 저위험) — v1_2 튜닝 **전에** 완료 권장
  - 684줄 (Critical). system/user 템플릿 raw text를 `docs/prompts/v*.md` 로 이관, 빌더는 파일 로드 + 변수 주입만
- [ ] **G.3** **PLAN-022 — responseParser 통합** (M 공수, 중간 위험)
  - 5개 파서의 공통 JSON 추출/검증을 `BaseParser` 로 추상화. 305줄 → 250줄 목표
- [ ] **G.4** **PLAN-023 — DiscoveryPanel 상태 분해** (L 공수, 높은 위험)
  - 14 useState → `useDiscoveryExpand` / `useDiscoverySearch` / `useDiscoveryResult` 3개 훅으로 분리

---

## 4. 착수 순서 (가이드, 강제 아님)

1. **v1_2 프롬프트 튜닝** — PLAN-019 다음 사이클. 골든셋 실패 패턴 3종 정면 공략
2. **G.2 (promptBuilder 외부화)** — v1_2 착수 전에 깔면 튜닝이 깔끔
3. **F.4 qa-backlog** 상시 병행
4. **D.1** 공용 PC 편집 니즈가 실사용에서 체감되면 트리거
5. **D.2 → D.3** 는 D.1 정착 후 순차
6. **F.3 E2E** 는 UX 회귀가 체감되면 착수

> 병렬 트랙이므로 위 순서는 **의존성(D 시퀀스) + 추천**만 표현. 실제 착수는 그때 결정.

---

## 5. 트랙 의존성

```
Track D (INFRA — 시퀀스 의존)
  D.1 Option 2 (Worker) ──→ D.2 구독 URL ──→ D.3 Option 4 (DB)

Track E (EXTEND — D와 독립)
  E.1 신규 학회 발굴 [완료] ──→ E.4 discovery 프롬프트 튜닝 (PLAN-012, v1_2 이후)

Track F (OPS — 상시)
  F.1 Update 개선 [완료]   F.2 평가 체계화 [완료]
  F.3 E2E   F.4 qa-backlog   F.5 log analyzer

Track G (REFACTOR — 기회 비용)
  G.1 useUpdateQueue ┐
  G.2 promptBuilder  ┼ v1_2 전 권장   G.3 responseParser   G.4 DiscoveryPanel
```

---

## 6. v3 운영 원칙 (v2 승계 + 갱신)

- **플랜 먼저**: 각 Track 아이템 착수 전 `docs/plans/active/PLAN-xxx.md` 필수
- **브랜치**: `feature/PLAN-xxx-설명` · `fix/설명` · `docs/설명` · `chore/설명` (v2와 동일)
- **커밋**: Conventional Commits · **모든 커밋은 verify-task 게이트 통과** (`bash scripts/verify-task.sh`)
- **트랙 전환 자유**: 선형 강제 없음. 현재 블로커·의존성만 존중
- **Skeleton → 상세 전환**: 이 문서의 체크박스는 skeleton. 개별 PLAN 문서가 권위 있는 소스

---

## 7. 새 Track 추가 규칙

v3는 병렬을 전제로 하므로 필요 시 Track G, H 등을 자유롭게 추가한다. 추가 기준:

- 기존 D·E·F 어디에도 깔끔히 들어가지 않는 **독립된 작업 흐름**일 때
- 최소 2개 이상의 관련 아이템이 예상될 때 (단건은 기존 Track에 흡수)
- Track 이름은 나열 단위로 충분 (1글자 알파벳, 의미는 §3에서 명시)
