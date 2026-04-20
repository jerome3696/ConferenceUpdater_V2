# 학회 DB 관리 웹앱 — 개발 가이드 v3

> **문서 버전**: v3.0-skeleton
> **최종 수정일**: 2026-04-18
> **전임자**: `docs/legacy/dev-guide-v2.md` (Post-MVP Track A/B/C 완료)
> **배경 자료**: `docs/blueprint.md` §7.2 우선순위, `docs/reference/HARNESS_MASTER.md`

---

## 1. 현재 상태

**v3 돌입. 할일 list up 및 상세 계획 수립 예정.**

v2까지는 선형적이었다 — Track A(체계화) → B(품질) → C(확장) 순으로 Step 단위 시퀀스. v3는 **병렬 트랙 구조**를 전제로 한다. 인프라·기능·운영이 각자 리듬으로 돌면서, 릴리스·실사용 피드백에 따라 우선순위를 재조정.

각 Track 아이템은 **상세 플랜 수립 시 `docs/plans/active/PLAN-xxx.md` 파일로 전환**. 현재 이 문서는 skeleton — 개별 PLAN 문서가 확정되면 그쪽이 권위 있는 소스가 된다.

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
- [ ] **E.1** **신규 학회 자동 발굴** (blueprint §7.2 우선순위 3) — **블루프린트 완료**: `docs/plans/active/PLAN-011.md` (2026-04-18). 서브플랜 011-A~E 분리, 회당 비용 $0.16 추정. E.2·E.3 흡수.
  - 키워드 기반 AI 웹검색으로 DB에 없는 학회 발굴
  - UpdateCard 수용/거절 패턴 재사용
- [ ] **E.2** **가짜 학회 필터링** — **PLAN-011에 흡수** (3중 안전망: 도메인 블랙리스트 + AI 자체 판정 + UI 거절 토글)
- [ ] **E.3** **키워드 추천** — **PLAN-011에 흡수** (Stage 1 키워드 확장 단계)
- [ ] **E.4** **discovery 프롬프트 fine-tuning** (PLAN-012, PLAN-011 머지 후)
  - update v1→v6 진화와 동일 트랙. eval 골든셋 + runner 별도 인프라

### Track F: 운영 품질 (상시 병행)
- [ ] **F.1** **Update 기능 종합 개선** (원래 "v6 활성 전환 평가" 에서 확장)
  - [x] **Phase 1 — Last edition 1차 채움 (2026-04-19, PR #21)**: 28건 backfill (high 27 / medium 1), past 보유 master 2 → 29 전수. Claude Code WebSearch 활용 (API 비용 0). `scripts/export-review.cjs` / `import-review.cjs` 검수 도구 동반 추가
  - [~] **Phase 2 — 프롬프트/로직 정교화 (PLAN-013, 2026-04-20 통합 PR 대기)** — 5개 서브플랜 구현 완료, 326 tests 통과, `feature/PLAN-013-integration` 푸시
    - [x] A (90feb99) — Edition `anchored` 필드 + UI 토글 (UpdateCard accept·EditionSection). 사용자 확정 upcoming 재검색 보호
    - [x] B1 (34dbb9b) — `src/utils/urlClassifier.js` 신규 (official_edition/series/org_event/news/listing 분류 → high/medium/low 신뢰도), `dateUtils.daysUntil`·`cycleProgress` 확장
    - [x] B2 (a1b201b) — `shouldSearch(row, mode)` 전면 재작성 (anchor > 필드 미비 > precise > URL×주기 임계값), "전체 업데이트" 시 정밀/일반 모달
    - [x] C (d8ac648) — Update prompt v7 (`formatLastEditionV2` last.link 노출 + 시리즈 도메인 패턴 추정 지시). dedicated_url 제거. `DEFAULT_UPDATE_VERSION` 은 여전히 v4 — eval 후 결정
    - [x] D (962dd31) — `buildLastEditionPrompt` + `parseLastEditionResponse` + `applyLastDiscovery` + `useUpdateQueue` 분기 (row.last 없으면 main update 전 선행 발굴)
    - [ ] **Step E — v6 vs v7 eval + `DEFAULT_UPDATE_VERSION` 결정** (별도 PR, API 비용 발생 작업) — 잔여
- [ ] **F.2** **프롬프트 반자동 log analyzer**
  - eval 결과 10회+ 축적 시점에 트리거. 공통 실패 패턴 자동 추출 → 다음 버전 레버 후보
- [ ] **F.3** **E2E 테스트 도입 (Playwright)**
  - 캘린더 뷰·ICS 다운로드·폼 모달·업데이트 큐 회귀 방지
  - 유닛 테스트(168건)는 코드 정합만 확인 — 브라우저 UX 회귀는 아직 수동 확인 의존
- [ ] **F.4** **qa-backlog 주기적 처리**
  - 실사용에서 누적된 `docs/qa-backlog.md` 를 5~10건 단위 batch 플랜화

---

## 4. 착수 순서 (가이드, 강제 아님)

1. **실사용 1주** — PLAN-009/010 병합 후 캘린더·ICS 실제 사용. `docs/qa-backlog.md` 에 축적
2. **F.1·F.4** 저비용 고효용 상시 작업 병행
3. **D.1** 공용 PC 편집 니즈가 실사용에서 체감되면 트리거
4. **D.2 → D.3** 는 D.1 정착 후 순차
5. **E.1** 은 D와 독립적 — DB 성장 필요성이 체감되면 언제든 시작

> 병렬 트랙이므로 위 순서는 **의존성(D 시퀀스) + 추천**만 표현. 실제 착수는 그때 결정.

---

## 5. 트랙 의존성

```
Track D (INFRA — 시퀀스 의존)
  D.1 Option 2 (Worker) ──→ D.2 구독 URL ──→ D.3 Option 4 (DB)

Track E (EXTEND — D와 독립)
  E.1 신규 학회 발굴 (PLAN-011, E.2·E.3 흡수) ──→ E.4 프롬프트 튜닝 (PLAN-012)

Track F (OPS — 상시)
  F.1 v6 평가   F.2 log analyzer   F.3 E2E   F.4 qa-backlog
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
