# Prompt Engineering — 운영 가이드 + 실행 로그

> 프롬프트 품질 개선 루프 (가설 → 변경 → 실행 → 분석 → 다음 가설)를 위한 **단일 운영 문서**.
> 정답지·실행 결과 원본은 `docs/eval/`, 코드는 `src/utils/promptBuilder.js` / `src/services/responseParser.js`.
> 통합 전 원본: `docs/legacy/PROMPT_LOG.md` (실행 서사) + `docs/legacy/PROMPT_STRATEGY.md` (전략).

---

## §0. 사용법 (사람용 팁)

이 문서는 AI와 사람이 같이 쓰는 운영 문서다. 사람이 효율적으로 다루기 위한 팁:

- **새 세션에 진입할 땐 §1 현황판부터 본다.** "지금 활성 버전 / 마지막 pass율 / 잔존 실패 / 다음 시도"가 한 화면에 있어야 한다. 매번 갱신될 것.
- **AI에게 지시할 땐 추상적으로 말하지 말 것.** "프롬프트 개선해줘"보다는 "**§4의 레버 B(도메인 블랙리스트)를 적용한 v2를 만들고 v1과 비교 실행**"이 훨씬 빠르다. 레버 카탈로그가 있는 이유.
- **같은 실패가 2회 이상 반복되면 §6 패턴 카탈로그에 등록.** 한 번은 우연, 두 번은 패턴. 패턴 카탈로그가 두꺼워질수록 자산이 된다 — 나중에 반자동 log analyzer가 들어올 때 그대로 인풋.
- **pass율 추이는 §3 인덱스 + §5 로그를 교차 확인.** 단발 숫자만 보면 우연 효과(예: max_uses 5의 부수 효과)에 속는다.
- **정답지(`docs/eval/golden-set.csv`)가 한 달 이상 안 바뀌면 의심하라.** 학회들이 다음 회차로 넘어가면 정답지도 stale. `npm run eval:refresh`로 stale 자동 감지.
- **버전이 5개를 넘어가면 §5 실행 로그 압축을 검토.** 오래된 버전 narrative는 legacy로 떼어내거나 한 줄 요약으로 줄인다. §3 인덱스 표만 살려도 충분.
- **신규 학회/도메인 패턴 한두 건은 우선 `qa-backlog.md`로.** 5~10건 모이면 여기로 합쳐서 일괄 패턴 분석.
- **편집 vs 검증 — 검증이 병목임을 잊지 말 것.** 프롬프트 한 줄 바꾸는 건 5분, 17건 eval 돌리는 건 비용·시간 다 든다. 한번 돌릴 때 가설을 분명히.
- **AI가 정답지를 만들게 하지 말 것.** "AI 채점 AI" 순환은 회귀 테스트의 의미를 파괴한다 (§7 메타 결정 참조).

---

## §1. 빠른 현황판 (Active)

> **현황판 갱신 절차**: 새 run 이 끝나면 `docs/eval/runs/<run-id>/run.json` 을 열어 아래 필드를 복사해 "마지막 측정" 블록에 반영한다. 자동화는 미적용 — 사람이 복사.
> - `run_id`, `version`, `stopped_by`, `iterations.length`
> - 최종 iter 의 `pass` / `partial` / `fail_or_error` / `total`
> - `persistent_failures` 배열 → "잔존 실패" 에 반영
> - `by_cycle_years_total` → cycle 버킷 편향 분석
>
> 단일 run (eval-loop 미사용) 시에는 `docs/eval/results/<timestamp>-<version>.json` 의 `summary` 블록을 사용.

### 활성 버전
- **앱 사용 중**: `v1_1` (Haiku 4.5 단일 · Sonnet 폴백 없음)
  - `web_search` `max_uses: 5` 캡 / `maxTokens: 1024` (kind=update)
  - **v1_1 변경 4건** (v1_0 측정 후): 축 A URL 3유형 분기 (연도형/회차번호형/불변형) · confidence 소스 신뢰도 재정의 (공식/준공식/외부) · 주기 초반 부정확 소스 허용 (null 대신 low) · iifiir.org 이벤트 슬러그 주기-임박 시 제외
  - 튜닝 상수 (`src/utils/promptBuilder.js` 상단 `V1_1_VARS`): `IIFIIR_STRICT_FROM=0.7`, `EARLY_INACCURATE_UNTIL=0.5`
  - PLAN-013-D `buildLastEditionPrompt` v1 사전 탐색 체인 연결

### 잔존 실패 (다음 개선 타겟)
- **v1_1 기준 (2026-04-21, run_id=20260421-082859)**: persistent_failures 5건 (v1_0 9건 → 5건, 골든셋 수정 4건 + 프롬프트 변경 4건 효과) —
  - `conf_006` (IIR Cryogenics): link=✓ (cryogenics-conference.eu), start/end=null (공식 미공개). 주기 진행률 초반 부정확 허용이 적용되었으나 AI 가 보수적으로 null. `fields.link=pass` 지만 iter 3 중 partial 2 회로 persistent_failures 포함
  - `conf_007` (ICMF): 3 iter 중 parse_fail 1 회 + score 0 2 회. JSON 출력 안정성 문제 (시스템 프롬프트 규격 재확인 필요)
  - `conf_010` (TPTPR): `no_expected` — 골든셋 미정답. pass 카운트에서 제외하는 구조적 처리 필요 (v1_2 논의)
  - `conf_017` (PRTEC, cycle=4y 초반): 주기 진행률 0.33 으로 초반이나 expected 2027-03-14 Honolulu 존재. 레버 부족 — 4년 주기 초반에도 expected 있는 케이스 커버 필요
  - `user_mo04ezfq` (BS 2027 framer): AI 가 `bs2027.framer.ai` (dates/venue 정확) 로 medium 반환했으나 골든셋 link 공란과 불일치 → link=fail. 골든셋 수정 방향 (link 허용) 고려 대상
- iter 별 변동: iter 1 → 17/27, iter 2 → 20/27, iter 3 → 19/27. cycle 2y 버킷이 5→7→7 로 개선 (축 A ① 연도형 추정이 적중)
- v1_0 대비 개선: THERMINIC · ICCFD · Hannover · ACRA 등 6건이 적어도 1 iter 이상 pass 로 전환. v1_0 persistent 9건 중 4건 (conf_005 · conf_012 · conf_015 · conf_019) 이탈

### 마지막 측정
- **v1_0** (2026-04-21): pass 16/27, stopped_by=max_iter, run_id=20260421-072101
- **v1_1** (2026-04-21): pass 19/27 (iter 3), stopped_by=max_iter, run_id=20260421-082859, avg in=42k out=1.1k · cycle=0y 1/3, 1y 19/21, 2y 19/33, 3y 11/12, 4y 6/12
- 레거시 v1~v7 이력: `docs/legacy/PROMPT_LOG_pre_v1.md`

### 다음 시도 (next levers)
- [ ] **cycle=4y 초반·후반 양쪽 저하 원인 분석** — PRTEC (초반) · IHTC (후반) 양 끝 모두 실패. 4년 주기 특성인지 소수 케이스 편향인지
- [ ] **draft site confidence 강제** — user_mo04ezfq 사례. framer/notion 류 high→low 강제로 골든셋 허용 폭 확보 (v1_1 백로그 DRAFT_SITE_CONFIDENCE)
- [ ] **ICMF JSON 출력 안정성** — parse_fail 1회. 시스템 프롬프트 JSON 규격 강화 검토
- [ ] **Dedicated vs Institutional 판별 실패 추적** — v1_1 에서 식별된 신규 실패 없음. 누적 시 `conferences.json` `domain_type` 힌트 검토
- [ ] **박람회 vs 학회 유형 분기** — category 별 pass rate 차이 분석 (v1_1 결과 raw 로 측정 가능)
- [ ] **E. 임박 학회 공식사이트 추종** — `updateLogic.shouldSearch` imminent 판단 확장 (MVP 후)

---

## §2. 개선 루프 (How to iterate)

매 이터레이션의 표준 절차:

1. §1 현황판의 **next levers**에서 1~2개 선정
2. `src/utils/promptBuilder.js`의 `TEMPLATES.update.{v신규}` 추가 — **이전 버전은 절대 변경 금지** (회귀 비교 가능성 보존)
3. `npm run eval` 로 v(이전) / v(신규) 교차 실행
4. 결과를 §5 실행 로그에 신규 항목으로 추가
5. §1 현황판 갱신 (활성 버전 / 잔존 실패 / next levers)
6. §3 버전 인덱스에 한 줄 추가
7. 새 실패 패턴이 보이면 §6에 등록, 가설이 검증되거나 폐기되면 §4 레버 표의 "실측" 칸 갱신
8. 미해결 과제(§8) 체크박스 갱신

**원칙**:
- 검증이 병목 (편집은 빠름) — 한 이터레이션의 가설은 명시적으로
- 한 번에 레버 1~2개씩 변경 (3개 이상 동시면 무엇이 효과를 냈는지 분리 불가)
- 결과는 우연 효과 가능성을 항상 고려 (예: Phase A의 max_uses 5는 토큰 절감 의도였으나 품질도 동반 상승했음 — §5 참조)

---

## §3. 버전 인덱스

| 버전 | 시점 | 환경 | pass | 평균 토큰 (in/out) | 비고 |
|---|---|---|---|---|---|
| v1_0 | 2026-04-21 | Haiku 4.5 + Phase A (Sonnet 폴백 없음) | 16/27 (pass rate 59%, stopped_by=max_iter) | in 1.1M / out 24k (3 iter 합) | PLAN-019 재시작. 소스 2축 분리 (탐색 A · 채택 B), 재사용 레버 A'·C·H·I + Draft 조건부. persistent_failures 9건 — 대부분 골든셋 엄격성 or URL 패턴 추정 미흡 |
| v1_1 | 2026-04-21 | Haiku 4.5 + Phase A | 19/27 (pass rate 70%, stopped_by=max_iter) | in 1.1M / out 30k (3 iter 합) | v1_0 후속. 축 A URL 3유형 / confidence 소스 재정의 / 주기 초반 부정확 허용 / iifiir 임박 제외. persistent_failures 9→5. cycle 2y 버킷 5→7 개선 |

> 레거시 v1~v7 이력은 `docs/legacy/PROMPT_LOG_pre_v1.md` (§3 동결) 참조.

---

## §4. 가설 카탈로그 (레버)

프롬프트 단독으로 품질·토큰을 움직일 수 있는 손잡이. 한번 정의되면 후속 버전에서 재사용.

| 레버 | 지시 예시 | 기대 효과 | 실측 |
|---|---|---|---|
| **A. today 앵커** | "오늘: YYYY-MM-DD. 시작일이 과거면 반환 금지" | past 회차 제거 (품질) | v2 적용: P1(ECOS) 해결 ✅. v2에서 P4(날짜 역전) 발생 → v3(레버 A')에서 부등호 명시·검증 예시로 완전 해소 ✅ |
| **B. 도메인 블랙리스트** | "금지 도메인: easychair, framer.ai, conferenceindex, waset, allconferencealert 류" | 비공식 URL 제거 (품질) | v2 적용: P2(ICCFD easychair) 해결 ✅. IIR 전용 사이트(cryogenics-conference.eu, iir-gl-2026.net)는 부분 미해결 |
| **C. 조기 종료** | "공식 페이지 찾으면 추가 검색 금지" | 검색 호출↓ → input 토큰↓ | `max_uses: 5` 캡으로 부분 검증 — 품질 상승 동반 |
| **D. JSON-only** | "JSON 블록 1개만. preamble/후기 금지" | output 토큰↓ | 미실측 |
| **E. 임박 학회 공식사이트 추종** | 시작일 ≤ N일(예: 90일)이면 link가 있어도 공식 도메인 재검증 | 리스팅 사이트 우회 (품질) | **프롬프트 단독 불가** — `updateLogic.shouldSearch`에 imminent 판단 확장 필요 |
| **F. Haiku→Sonnet 재시도** | 1차 Haiku 결과 `start_date=null` 이면 Sonnet 4.6 + `web_fetch` 로 1회 재호출 (동일 프롬프트) | 평문 날짜 누락 보정 (품질) | **프롬프트 밖** — `useUpdateQueue`에 구현 (PLAN-005). maxTokens=2048 |
| **G. dedicated_url 힌트** | `conferences.json` 에 `dedicated_url` 있으면 v5 user 프롬프트에 "회차 전용 사이트(힌트): …" + 사용 지침 1줄 주입 | 탐색 스텝 단축 (품질·토큰) | 옵트인: 필드 비면 v4와 동일. eval 측정 전 |
| **H. Link–Confidence 상호구속** | "confidence가 'high'/'medium' 이면 link는 non-null. link=null이면 confidence는 'low'" + user 프롬프트 자기검증 체크리스트 | `high + link=null` 자기모순 제거 (품질) | v6 + 파서 `normalizeUpdateData` 안전망 이중 방어. eval 측정 전 |
| **I. Venue 포맷 정규화** | US는 `City, State, USA` / Canada는 `City, Province, Canada` / 그 외는 `City, Country`. 국가명 고정(`USA`/`UK`/`Korea`) + 예시 4건 | 주(state) 누락·국가명 요동 제거 (품질) | v6. 예시 기반 지시는 v3 today 앵커 선례. 토큰 +3% 예상 |
| **J. Draft 연성화 + 3순위 색인 허용** | framer.ai 하드 금지 제거 → confidence=low + notes='draft/prototype' 조건 허용. 주관기관 컨퍼런스 색인 페이지(`ibpsa.org/conferences/` 등)는 3순위로 명시 허용 | `link=null` 오탐 감소, 초안 사이트 정보 회수 | v6. 레버 E(임박 재검증)와 상보적 |

> 새 레버를 추가할 땐 알파벳 다음 글자(F, G…)를 부여해 §6 패턴과 cross-ref 가능하게.

### 예상 범위 (v1 → v2 가설치)
- pass: 16/17 → 16~17/17 (B 레버로 conf_015 ICCFD 회복 기대)
- avg input tokens: -20~40% (C 레버 강화 시)
- avg output tokens: -30~50% (D 레버 적용 시)

---

## §5. 실행 로그 (Run Log)

각 실행은 시간순. 환경·결과·변경 케이스·가설 검증 여부를 기록.

> 2026-04-21 PLAN-019 로 로그 초기화. v1~v7 이력은 `docs/legacy/PROMPT_LOG_pre_v1.md`.
> 새 엔트리 포맷: **날짜 — v{N}**, "변경 내용 / 결과 (run.json) / 케이스별 변화 / 가설 검증 / 잔존 과제" 5소제목 권장.

### 2026-04-21 — v1_0 첫 측정 (PLAN-019 재시작 후)

**변경 내용**: PLAN-019 로 v1~v7 을 legacy/ 로 격리하고 v1_0 부터 재시작. 소스 2축 분리 (축 A 탐색 순서 / 축 B 채택 규칙), Dedicated (1:1) vs Institutional (1:N) 도메인 판별, Haiku 4.5 단일 (Sonnet 폴백 제거).

**결과** (`docs/eval/runs/20260421-072101/run.json`): pass 16/27 (59%), stopped_by=max_iter, persistent_failures 9건.

**케이스별 변화** (v7 → v1_0 중 직접 비교 의미 있는 것):
- 새 패턴 잘 작동: conf_016 IHTC (ihtc18.org), conf_018 ICR (icr2027.org), conf_009 ICC (cryocooler.org dedicated 인식)
- 실패: conf_005 Hannover (today=start 엣지), conf_006/015/019 URL 패턴 추정 미흡, conf_012 THERMINIC 부분일치 미허용, conf_007 ICMF 보수적 null

**가설 검증**: 소스 2축 분리는 URL 채택에서 깨끗한 rule → 7/27 케이스에서 ❌ link (기관 루트) 정확 거부. 그러나 ① URL 패턴 추정 규칙이 약해서 cryogenics2023 → cryogenics2027 같은 단순 연도 치환을 놓침.

**잔존 과제**: persistent_failures 9건 분석 → 4건 (conf_005/012/015, disc_mo520jhk7o IRACC) 은 골든셋 엄격성, 5건 (conf_006/019/020, user_mo04ezfq, conf_007) 은 프롬프트 약점. v1_1 에서 프롬프트 변경 4건 + 골든셋 수정으로 대응.

---

### 2026-04-21 — v1_1 (URL 3유형 / confidence 소스 / 주기 초반 허용 / iifiir 임박)

**변경 내용** (commit d1a549d): 튜닝 상수 2개 (`IIFIIR_STRICT_FROM=0.7`, `EARLY_INACCURATE_UNTIL=0.5`) + 내용 변경 4건.
- (a) 축 A ① URL 패턴 3유형 분기 (연도형/회차번호형/불변형) — `ecos2024`→`ecos2026`, `ihtc17`→`ihtc18`, 불변형은 루트 그대로
- (b) Confidence 3-level 소스 신뢰도 재정의 (공식=high / draft·준공식=medium / 외부 단신=low)
- (c) 주기 초반 (cycle_progress < 0.5) 부정확 소스 low 로 채택 허용 (null 보다 조기 탐지 우선)
- (d) iifiir 이벤트 슬러그 — 주기 ≥0.7 (임박) 금지 / <0.7 허용

**결과** (`docs/eval/runs/20260421-082859/run.json`): pass 19/27 (70%, iter 3), persistent_failures 5건. 평균 in=42k out=1.1k tokens (v1_0 유사).
- iter 1 → 17/27, iter 2 → 20/27, iter 3 → 19/27 — 노이즈 있으나 전반적 개선
- cycle 버킷: 0y 1/3 (conf_002 ASEAN, 2 iter pass / 1 iter fail), 1y 19/21, 2y 19/33 (v1_0 대비 크게 개선), 3y 11/12, 4y 6/12 (양극단 실패)

**케이스별 변화** (v1_0 → v1_1):
- 신규 pass (v1_0 persistent → v1_1 이탈): conf_005 Hannover · conf_012 THERMINIC · conf_015 ICCFD · conf_019 IIR Gustav Lorentzen (축 A ① 연도형 적중 + iifiir 임박 제외)
- 여전히 persistent: conf_006 (start/end null, 공식 미공개) · conf_007 ICMF (parse_fail 1회 + 보수적 null) · conf_010 (no_expected) · conf_017 PRTEC (4년 초반에도 expected 존재) · user_mo04ezfq BS2027 (framer link 골든셋 충돌)
- 신규 partial: conf_006 (link=pass, date=null) · disc_mo51rke0v1 IWCB (link=pass, venue=pass, date=null)

**가설 검증**:
- (a) URL 3유형 분기: ✅ 연도형 적중 다수 (conf_011 ecos2026, conf_015 iccfd13, conf_016 ihtc18)
- (b) confidence 재정의: ✅ 외부 단신 low, 공식 high 로 의도대로 분포. 다만 draft (framer) 는 여전히 medium 으로 AI 재량 판단 → DRAFT_SITE_CONFIDENCE 상수화 후보
- (c) 주기 초반 low 허용: ⚠️ 부분 효과 — AI 는 여전히 null 로 보수 회귀 (conf_006 · conf_017). 프롬프트 강도 부족 가능성
- (d) iifiir 임박 제외: ✅ conf_019 Gustav (iir-gl-2026.net 성공), conf_006 도 이벤트 루트가 아닌 cryogenics-conference.eu 로 이동

**잔존 과제**:
- 4년 주기 양극단 (conf_017 초반 · conf_016 후반 IHTC 는 pass 지만 cycle=4y 전체 6/12) — 소수 케이스 편향 확인 필요
- conf_007 ICMF JSON 출력 안정성 (3 iter 중 parse_fail 1 회)
- user_mo04ezfq — 골든셋 수정 방향 (draft link 허용) 논의 필요

<!-- 다음 엔트리 자리: 2026-MM-DD — v1_2 / 후보 변경 -->

---

## §6. 실패 패턴 카탈로그

루프를 돌릴수록 같은 패턴이 반복된다. 패턴 단위로 누적하여 다음 가설의 인풋으로 사용.

### P1. past 회차 반환
- **원인**: 모델이 검색 결과의 가장 가시적인 회차를 반환, today 인지 약함
- **사례**: conf_001 ASHRAE (v1 Sonnet 의심 pass), conf_010 TPTPR, conf_011 ECOS
- **대응 레버**: A
- **상태**: Phase A에서 우연히 해소 (max_uses 5 부수 효과). 명시 지시(레버 A)로 본격 검증 필요.

### P2. 비공식/리스팅 도메인 선호
- **원인**: 검색 상위 결과에 리스팅 플랫폼이 자주 노출됨 (SEO·플랫폼 효과)
- **사례**:
  - conf_015 ICCFD: easychair.org (eval+실전+2026-04-17 browser eval 반복) → 정답: iccfd.org
  - conf_019 IIR Gustav Lorentzen: iifiir.org/en/events/... (이벤트 리스팅) → 정답: iir-gl-2026.net (2026-04-17)
  - conf_006 IIR Cryogenics: iifiir.org/en/iir-conferences-series (집계 페이지) → 정답: cryogenics-conference.eu/cryogenics2027/ (2026-04-17)
  - conf_022 Building Sim: bs2027.framer.ai (v1 Sonnet에서만)
  - IIR GL 2026 (실전 브라우저): iifiir.org 리스팅
- **패턴 공통점**: 주관기관 도메인(iifiir.org)이라도 집계/리스팅 페이지(iir-conferences-series)는 전용 사이트 발굴을 막음
- **대응 레버**: B (도메인 블랙리스트 + 링크 우선순위 명시). 임박 학회는 E 병행
- **상태**: v2에서 레버 B 적용 중 — 결과 §5에 기록 예정

### P3. AI가 원본보다 정밀
- **원인**: 단순 일치 채점 한계
- **사례**: ICBCHT Boston → Cambridge, MA
- **의미**: 채점 로직 개선 여지 (정답지 자체에 "허용 범위" 기록 등). MVP 후.
- **상태**: 관찰만, 즉시 대응 불요

### P4. today 앵커 과잉 교정 (날짜 비교 역전)
- **원인**: "오늘 이후 회차만" 지시가 모호 → 모델이 일부 케이스에서 "시작일 > 오늘" 판별을 역방향으로 수행
- **사례**: conf_013 IEA HPC (5월 26일을 "이미 경과"), conf_014 ICBCHT (6월 14일을 "진행 중"), conf_016 IHTC (8월 2일을 "지나간 것") — v2, 2026-04-17
- **공통점**: 모두 2026년 내 학회 (4월 이후). 모델이 "같은 연도 = 이미 진행" 으로 단락할 가능성
- **대응 레버**: A' — "시작일(YYYY-MM-DD) > 오늘(YYYY-MM-DD)이면 upcoming" 부등호 명시. "이후/이전" 한국어보다 날짜 비교 식 표현이 더 명확
- **상태**: **v3에서 해소** ✅ (2026-04-17, 3/3 케이스 모두 upcoming 정확 인식)

### P5. 부분정보 신뢰도 과대 평가
- **원인**: confidence 판정 기준 미명시 → AI 재량으로 medium/high 사용
- **사례**: ICMF (날짜 미확인인데 confidence=medium, 출처 URL만 있는데 link=null) — 2026-04-17 브라우저
- **대응 레버**: confidence 기준 명시(low: start_date 미확인), link 4순위(출처 URL + confidence=low 강제)
- **상태**: v4에서 대응 ✅ (측정 대기)

### P6. 공식사이트 홈 탐색 후 하위 페이지 미진입
- **원인**: AI가 공식 홈에서 날짜를 못 찾으면 null 반환, 하위 페이지(Important Dates 등) 미탐색
- **사례**: ICCFD (iccfd.org 발견 후 날짜 미추출, Milan만 반환) — 2026-04-17 브라우저
- **대응 레버**: 공식사이트 발견 후 하위 페이지 탐색 의무 지침 + **F(Sonnet+web_fetch 재시도)** + **G(dedicated_url 힌트)**
- **상태**: v4 지침 + PLAN-005 다층 대응 (재시도·힌트·eval partial 가시화). 측정 대기

### P7. `official_url` 에 금지 도메인 등록 (자기 모순)
- **원인**: DB 마스터 링크가 v4 프롬프트 금지 리스트(`iifiir.org/en/iir-conferences-series` 등)인 상태로 저장되어 있음 → AI가 "공식사이트" 힌트를 신뢰하여 금지 도메인을 재사용
- **사례**: conf_006 IIR Cryogenics — 전용 사이트 `cryogenics-conference.eu` 존재함에도 금지 집계 페이지만 참조 (partial: 날짜 null)
- **대응**: DB 쪽 교정 (2026-04-18 conf_006 swap, PLAN-005 Part 1). 운영 규칙: `official_url` 에 금지 도메인 저장 금지
- **상태**: conf_006 해소 ✅. 다른 학회도 스크리닝 필요 (후속 QA)

### P8. `link=null` + `confidence=high/medium` 자기모순
- **원인**: v4 시스템 프롬프트에 link 와 confidence 상호 제약이 없음. LLM 비결정성으로 같은 입력에 서로 다른 응답 (conf_006 1차: high+link=null / 2차: 정상)
- **사례**: conf_006 IIR Cryogenics 1차 실행 (2026-04-18, v4 브라우저) — notes="공식 전용 페이지(1순위)에서 확인"이라 쓰면서 link=null
- **대응 레버**: H(Link–Confidence 상호구속, v6) + 파서 `normalizeUpdateData` 안전망 (백필 + 다운그레이드)
- **상태**: PLAN-006 에서 이중 방어 ✅ (측정 대기)

### P9. Venue 포맷 비일관 (US 주 누락·국가명 요동)
- **원인**: v4 에 venue 포맷 규칙 없음. 응답마다 `Orlando, Florida, United States` / `Orlando, United States` / `Chicago, USA` 처럼 주 유무·국가 표기가 요동
- **사례**:
  - conf_008 ITherm: `Orlando, Florida, United States` → `Orlando, United States` (주 누락)
  - conf_001 ASHRAE: `Chicago, Illinois, USA` → `Chicago, USA` (주 누락)
  - (잠재) UK/Korea 표기: `United Kingdom` / `South Korea` 도 혼재 가능
- **대응 레버**: I(Venue 포맷 엄격, v6) — US/Canada/기타 3분기 + 국가명 고정 + 예시 4건
- **상태**: v6 반영 ✅ (측정 대기). DB 잔여 오염은 다음 업데이트 시 자연 수렴

### P10. draft 사이트 하드 금지 과잉 일반화 + 3순위 허용 범위 모호
- **원인 (2축)**:
  - (a) v2 블랙리스트 등재 당시 framer.ai 는 v1 Sonnet 단 1건(conf_022 `bs2027.framer.ai`) 관찰의 과잉 일반화 — 주최측이 드래프트로 시작했다가 정식 도메인으로 이사하는 정상 패턴을 차단
  - (b) v4 "3순위 허용" 과 "**중요** 시리즈 목록 페이지 금지" 규칙이 충돌 — 주관기관 컨퍼런스 색인 페이지(`ibpsa.org/conferences/`, `astfe.org/conferences/`)가 회차를 명시하는 경우에도 AI가 안전한 `null` 선택
- **사례**: conf_022 BS 2027 (2026-04-18, v4 브라우저) — `source_url=https://ibpsa.org/conferences/` 면서 link=null
- **대응 레버**: J(draft 연성화 + 3순위 색인 허용 명료화, v6)
  - framer.ai 하드 금지 제거 → confidence=low + notes='draft/prototype' 조건부 허용
  - 3순위 색인 페이지는 해당 회차를 명시적으로 나열·언급하면 명시적으로 허용, confidence='medium' 이하
- **상태**: v6 반영 ✅ (측정 대기). 학회 직전 재검증(레버 E)과 상보적 — draft 링크는 임박 시 공식 도메인 재검색 우선

> 신규 패턴은 P{n}. 으로 추가하고, 사례에 [날짜·버전·id]를 함께 기록.

---

## §7. 메타 결정 (자동화 검토)

향후 같은 논의 재발 방지를 위해 결정 사유를 보존.

### 자동 prompt editor / log analyzer / crawler 분업 — 현 스케일 부적합

**결정**: MVP 시점에서는 도입하지 않음.

**이유 (요약)**:
1. **해결할 문제가 현재 스케일에 없음.** 실패 4건은 사람이 1분이면 분석. 수백건 쌓여야 log analyzer 가치.
2. **crawler가 정답지 생성 = 평가 독립성 파괴.** "AI 채점 AI" 순환, 회귀 테스트 의미 증발.
3. **편집은 병목이 아니고 검증이 병목.** 자동 편집은 정답지·시간·비용을 더 빨리 소진할 뿐.
4. **Goodhart's Law 위험**: 자동 편집이 pass율을 목표로 하면 정답지 과적합. 정답지 밖 케이스 품질 저하 가능.

### 단계적 적용 가이드라인
- **지금 (MVP/Post-MVP 초기)**: 수동. v2 가설 → 실행 → 기록 사이클 2~3회.
- **결과 10회+ 축적 후**: 반자동 log analyzer 1-shot (slash command). "실패 패턴 분류"만 시킴.
- **MVP 이후**: 반자동 prompt editor (후보 생성만). "실패 로그 보고 v3/v4 후보 3개 제안" → 사람이 diff 보고 승인. 자동 채택 금지.
- **절대 금지**: 정답지 AI 생성, 인간 개입 없는 자동 채택 루프.

> 상세 논의 원본: `docs/legacy/PROMPT_STRATEGY.md` §2.

---

## §8. 미해결 과제

- [x] v1_0 첫 eval-loop (27건, max-iter 3, threshold 0.9) 및 결과 기록 — 2026-04-21, run_id=20260421-072101, pass 16/27, stopped_by=max_iter
- [x] v1_1 첫 eval-loop — 2026-04-21, run_id=20260421-082859, pass 19/27, stopped_by=max_iter (persistent_failures 9→5)
- [ ] Dedicated vs Institutional 판별 실패 추적 — 누적 시 `conferences.json` `domain_type` 힌트 추가 검토
- [ ] 박람회 vs 학회 유형 분기 — v1_1 결과에서 category 별 pass rate 차이 확인 후 v1_2 결정
- [ ] 레버 E: `updateLogic.shouldSearch` imminent(임박) 판단 확장 (MVP 후)
- [ ] (장기) 결과 10회+ 축적 시 반자동 log analyzer 슬래시 커맨드 구성
- [ ] (장기) 정답지 채점 정밀화 — "허용 범위" 필드 추가 등 (P3 패턴 대응)

### v1_1 백로그 (현재 작업 범위 밖, 다음 이터레이션 후보)

v1_1 에서 튜닝 상수 2개 (`IIFIIR_STRICT_FROM=0.7`, `EARLY_INACCURATE_UNTIL=0.5`) + 내용 변경 4건 (축 A URL 3유형 / confidence 재정의 / 주기 초반 부정확 허용 / iifiir 주기-임박 제외) 도입. 이후 관찰 기반으로 추가 튜닝:

- [ ] **DRAFT_SITE_CONFIDENCE** 상수화 — framer/notion/wix 사이트의 default confidence. 현재 'medium' 로 AI 자가 판단에 맡김. v1_1 측정 후 'low' 로 강제하는 편이 나은지 데이터로 판단
- [ ] **MIN_LINK_SOURCES** 상수화 — link 를 high 로 판정하기 전 교차검증 최소 소스 수 (현재 기준 없음 · AI 직관 의존). 공식 사이트 외 독립 출처 1건 이상 교차확인 강제 검토
- [ ] **iifiir 외 institutional 색인 case-by-case** — ashrae.org/conferences, ibpsa.org/conferences 등 각 organizer 색인 페이지별로 주기-임박 시 배제 threshold 개별화 가능성. 현재는 iifiir 만 상수로 분리
- [ ] **주기 경과율 계산식 정교화** — 현재 `(today − last_end) / (cycle_years × 365)`. last_end 없을 때 fallback 정의 필요. 윤년·주기 비정수(0.5·1.5) 케이스도 확인
- [ ] **Y1/Y2 상수화 필요성 재검토** — v1_1 에서는 제거 (today 에서 파생). 만약 "특정 연도 예시" 를 프롬프트에 고정 필요한 요구 생기면 재도입

> 완료된 v1~v7 이력은 `docs/legacy/PROMPT_LOG_pre_v1.md`.
