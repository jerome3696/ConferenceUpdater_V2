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

### 활성 버전
- **앱 사용 중**: `v4` (Haiku 4.5 + Phase A 적용)
  - `web_search` `max_uses: 5` 캡 / `maxTokens: 1024` (kind=update)
  - **Haiku→Sonnet 재시도** (PLAN-005, 2026-04-18): 1차 Haiku 결과 `start_date=null`이면 Sonnet 4.6 + `web_fetch` 로 1회 재시도
- **v5 휴면**: `dedicated_url` 힌트 라인 추가 버전. `DEFAULT_UPDATE_VERSION=v4` 유지. eval 통과 후 활성 검토
- **마지막 측정(v3)**: 2026-04-17 / pass **19/19 (100%)** / avg input 41,651 · output 722 토큰
  - 결과 파일: `docs/eval/results/2026-04-17T12-42-33-v3.json`
- **v4 / v5 eval**: 미실행 — `npm run eval -- --version v4` / `--version v5` 로 확인 필요. 3-tier 채점(pass/partial/fail) 적용됨 — URL만 맞고 `start_date=null` 은 partial로 드러남

### 잔존 실패 (다음 개선 타겟)
- **[P2 해소] conf_006 IIR Cryogenics** — `official_url` 이 금지 도메인(iir-conferences-series)이었음. 2026-04-18 `cryogenics-conference.eu` 로 교체 (PLAN-005 Part 1). 브라우저 확인 필요
- **[P6 대응] conf_015 ICCFD** — Haiku `web_search` 가 홈페이지 평문 날짜 누락 → Sonnet 4.6 + `web_fetch` 재시도로 보정 (PLAN-005 Part 3). `dedicated_url=https://iccfd13.polimi.it` 힌트도 v5 에 추가
- **[P2 부분 미해결] conf_019 Gustav** — eval에서는 source_url 매칭으로 pass지만 전용 사이트(iir-gl-2026.net) 미발굴. 레버 E(임박 학회 재검증) 필요

### 다음 시도 (next levers)
- [x] **A. today 앵커** + **B. 도메인 블랙리스트** — v2 적용 완료 (2026-04-17)
- [x] **A'. today 앵커 정밀화** — v3 적용 완료 (2026-04-17). 19/19 pass, P4 완전 해소
- [x] **활성 전환**: `DEFAULT_UPDATE_VERSION` v3 → v4 (2026-04-17)
- [x] **C. 부분정보 처리 규칙** — v4: confidence 기준 명시 + link 4순위 + 날짜 탐색 강화 + 시리즈 null 강화
- [x] **F. Haiku→Sonnet 재시도** — PLAN-005: `start_date=null` 트리거, 1회 제한 (2026-04-18)
- [x] **G. dedicated_url 힌트** — v5 옵션: `conferences.json` 에 `dedicated_url` 있으면 프롬프트에 한 줄 주입 (2026-04-18)
- [ ] **v4 / v5 eval 확인**: 3-tier 채점 → 이전 "19/19 pass" 착시 해소, partial 분리 측정
- [ ] **E. 임박 학회 공식사이트 추종** — `updateLogic.shouldSearch` imminent 판단 확장. MVP 후 본격 검토

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
| v1 | 2026-04-15 | Sonnet 4 | 13/17 (76%) | (미계측) | 초기. past 회차 + 비공식 도메인 4건 fail |
| v1 | 2026-04-16 | Haiku 4.5 + Phase A | **16/17 (94%)** | 34,510 / 649 | `max_uses 5` 캡 효과로 품질 상승 (의외) |
| v2 | 2026-04-17 | Haiku 4.5 + Phase A | **16/19 (84%)** | 39,954 / 677 | 레버 A+B 적용. P1·P2 일부 해결. P4(today 앵커 과잉 교정) 신규 발생 |
| v3 | 2026-04-17 | Haiku 4.5 + Phase A | **19/19 (100%)** | 41,651 / 722 | 레버 A' 적용. P4 3건 완전 해소 (IEA HPC·ICBCHT·IHTC), P1·P2 유지 |
| v4 | 2026-04-17 | Haiku 4.5 + Phase A | (미측정) | — | 레버 C: confidence 기준·link 4순위·하위 페이지 탐색 의무 |
| v5 | 2026-04-18 | Haiku + Phase A + (`dedicated_url` 힌트) + Sonnet 4.6 폴백 | (미측정) | — | 레버 F·G. v4 system 동일, user에 `dedicated_url` 있을 때만 힌트 1줄 + 사용 지침 추가 |

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

> 새 레버를 추가할 땐 알파벳 다음 글자(F, G…)를 부여해 §6 패턴과 cross-ref 가능하게.

### 예상 범위 (v1 → v2 가설치)
- pass: 16/17 → 16~17/17 (B 레버로 conf_015 ICCFD 회복 기대)
- avg input tokens: -20~40% (C 레버 강화 시)
- avg output tokens: -30~50% (D 레버 적용 시)

---

## §5. 실행 로그 (Run Log)

각 실행은 시간순. 환경·결과·변경 케이스·가설 검증 여부를 기록.

### 2026-04-15 — v1 / Sonnet 4 (초기 검증)

#### 작성 의도
- `blueprint.md` §5.3 / §5.4 초안을 거의 그대로 구현
- 구조화된 JSON 응답을 강제하기 위해 ` ```json ` 코드펜스 예시를 프롬프트에 포함
- 확인 불가 필드는 `null`로 두게 유도 (fabrication 방지)
- `source_url`, `confidence` 필드 추가 (blueprint 원문에는 없음 — 실패 원인 분석용)
- 시스템 프롬프트에 WASET 등 약탈적 학회 출처 배제 명시

#### 구현 위치
- `src/utils/promptBuilder.js` — `buildUpdatePrompt` / `buildVerifyPrompt` (v1)
- `src/services/responseParser.js` — `parseUpdateResponse`, `parseVerifyResponse`

#### 결과 — 17건 전체 실행
- pass **13 / fail 4 (76%)**
- 결과 파일: `docs/eval/results/2026-04-15T22-38-24-v1.json`
- 인프라 이슈 0건 (초기엔 17건 중 14건이 429였으나 `claudeApi.js` retry-after 파싱 + `eval-prompt.js` 단발 재시도 추가 후 전건 완주)

#### 실패 4건 패턴
| id | AI link | 기대 | 분류 |
|---|---|---|---|
| conf_010 | ceee.umd.edu/tptpr2025 (2025 과거 회차) | iifiir.org/en | past 회차 반환 |
| conf_011 | ecos2025.org/ (2025 Paris, 종료) | ecos2026.insae.ro | past 회차 반환 |
| conf_015 | easychair.org/smart-program/ICCFD13 | iccfd.org | 비공식/총합 사이트 선호 |
| conf_022 | bs2027.framer.ai (프로토타입) | bs2027.org | 드래프트/비공식 도메인 선호 |

추가 의심 (pass 처리됐지만): conf_001 ASHRAE — 2025 Orlando(이미 종료) 반환. URL은 ashrae.org 하위라 매칭됐을 뿐 사실상 past.

---

### 2026-04-16 — v1 / Haiku 4.5 + Phase A

#### 변경 내용 (프롬프트 텍스트는 v1 그대로)
주변 호출 조건만 변경:
1. **eval 러너 모델 일치** — 이전 측정은 Sonnet 4. `scripts/eval-prompt.js`가 `MODELS.update`(Haiku 4.5)를 import해 앱과 동일 조건으로 측정.
2. **Phase A** (`docs/legacy/rate_limit_strategy.md` §4):
   - `src/services/claudeApi.js` — `web_search` 도구에 `max_uses: 5` 캡
   - `src/hooks/useUpdateQueue.js` — `maxTokens` 2048 → 1024 (kind=update)
3. **eval 러너 계측 추가** — 결과 JSON에 `response.usage` 기록.

#### 결과 — 17건 전체 실행
- pass **16/17 (94%)** — 결과 파일: `docs/eval/results/2026-04-16T13-14-08-v1.json`
- rate_limit 0건 (이전엔 14건 발생 후 재시도로 회복)
- 토큰 소비: total input 586,669 / output 11,033 / **avg input 34,510 / output 649 per call**
- `stop_reason=max_tokens` 0/17 (maxTokens 1024 축소로 인한 JSON 잘림 없음)

#### 케이스별 변화 (Sonnet → Haiku + Phase A)
| id | 2026-04-15 (Sonnet) | 2026-04-16 (Haiku + Phase A) |
|---|---|---|
| conf_001 ASHRAE | past 회차(2025 Orlando), 의심 pass | 2026 Winter 정답 |
| conf_010 TPTPR | past 회차 fail | iifiir.org 정답 |
| conf_011 ECOS | past 회차(2025 Paris) fail | ecos2026.insae.ro 정답 |
| conf_015 ICCFD | easychair.org fail | **여전히 easychair.org fail** |
| conf_022 Building Sim | bs2027.framer.ai fail | ibpsa.org 정답 |

#### 가설 — 왜 품질이 올라갔나
`max_uses: 5` 캡이 의도치 않게 **검색 범위 수렴 효과**를 냈다. Sonnet은 검색을 확장하다 비공식·past 도메인에 걸려 자기 함정에 빠졌으나, 5회 제한은 공식 도메인 발견 직후 종료를 유도. 모델 다운그레이드(Sonnet → Haiku)에도 품질이 오른 건 이 효과가 모델 차이를 상쇄했음을 시사.

#### 잔존 실패
- **conf_015 ICCFD**: v1의 비공식 도메인 배제 지시(WASET 등)가 easychair까지 커버 못함. v2 도메인 블랙리스트(레버 B) 과제.

#### Rate limit 시사점
- Tier 1 한도 30k ITPM 대비 단일 호출 avg 34,510 → sequential은 통과하나 병렬·고빈도 상황에선 위험
- 앱 sequential 흐름 한정으로는 Phase B/C 불필요. 상세는 `docs/legacy/rate_limit_strategy.md` §4.5, §8.

---

### 2026-04-16 — Step 3.6 실전 검증 (앱 브라우저, 4건)

#### 조건
- Phase A 적용 (max_uses 5, maxTokens 1024, Haiku 4.5)
- 앱 UI에서 개별 [업데이트] 버튼으로 실행, 공식사이트 수동 대조
- eval 17건과 별개. 앱 큐 흐름(승인 대기 → 수용 → 테이블 반영 → GitHub 저장) 검증 포함

#### 결과
| 학회 | 결과 | AI 반환 | 관찰 |
|---|---|---|---|
| IIR GL 2026 (열물성/냉매) | pass | iifiir.org 리스팅 페이지 | 공식 `iir-gl-2026.net` 대비 리스팅 사이트 선호. 정보는 정확 |
| IHTC | pass | 2026-08-02~07 / Rio de Janeiro | 완벽 |
| ICCFD | pass | easychair.org/smart-program/iccfd13 | **eval conf_015과 동일 실패 패턴 재현** — 공식 `iccfd.org` 대신 easychair |
| ICBCHT | pass | Cambridge, USA / 2026-06-14~17 / sites.mit.edu/icbcht12 | 기존 "Boston" → AI가 Cambridge로 정밀화 (MIT는 Cambridge, MA) — AI가 원본보다 정확 |

#### 새 관찰
1. **리스팅/플랫폼 사이트 선호 (반복 패턴)** — ICCFD easychair, IIR GL iifiir.org. v1의 WASET 블랙리스트 미커버. 레버 B 재확인.
2. **AI가 원본보다 정밀한 케이스** — ICBCHT Cambridge. 단순 일치 검사로는 이런 개선을 pass로만 뭉뚱그림. 정답지 채점 정밀화 여지 (MVP 후).
3. **임박 학회 공식사이트 추종 아이디어** — 시작일까지 N일 이내면 link가 있어도 공식 도메인 재검증. 레버 E로 이관.

#### 결론
- 4건 100% pass, UX 흐름 정상 동작
- 품질 개선은 v2 프롬프트로 이월

---

### 2026-04-17 — v2 / Haiku 4.5 + Phase A

#### 변경 내용 (v1 → v2)
- `UPDATE_SYSTEM_V2` 신규: 날짜 규칙·링크 우선순위·이름 매칭 섹션 구조화
- `buildUpdateUserV2`: `const today = new Date().toISOString().slice(0, 10)` 런타임 주입, 금일 명시
- 레버 A: "오늘 이후 회차만 반환" 명시 / 레버 B: easychair·framer·wikicfp 등 블랙리스트 + 링크 우선순위(1·2·3순위) 명시

#### 결과 — 19건 실행 (golden-set 3건 신규 추가 반영)
- pass **16/19 (84%)** — 결과 파일: `docs/eval/results/2026-04-17T05-46-34-v2.json`
- 토큰: avg input 39,954 / output 677 (v1 대비 input +16% — 시스템 프롬프트 증가 영향)
- `stop_reason=max_tokens` 0/19

#### 케이스별 변화 (v1 → v2)
| id | v1 | v2 | 비고 |
|---|---|---|---|
| conf_011 ECOS | ecos2025.org ❌ | ecos2026.insae.ro ✅ | **P1 수정** — today 앵커 효과 |
| conf_015 ICCFD | easychair.org ❌ | iccfd.org ✅ | **P2 수정** — 블랙리스트 효과 |
| conf_013 IEA HPC | hpc2026.org ✅ | heatpumpingtechnologies.org ❌ | **신규 회귀 (P4)** — AI가 5월 26일을 "이미 경과"로 오인 |
| conf_016 IHTC | ihtc18.org ✅ | astfe.org ❌ | **신규 회귀 (P4)** — AI가 8월 2일을 "이미 지나간 것"으로 오인 |
| conf_014 ICBCHT | (신규 golden-set) | null ❌ | **P4** — AI가 6월 14일을 "이미 진행 중"으로 오인, ICBCHT13(2029) 탐색 |

#### 가설 검증
- **레버 A 효과**: P1(past 회차) 수정 확인 ✅. 단, 날짜 비교 지시 표현이 모호해 역방향 오인 유발(P4). "시작일이 과거면 금지" → "시작일 > 오늘이어야 upcoming" 로 표현 정밀화 필요
- **레버 B 효과**: easychair 블랙리스트 효과 확인 ✅. 그러나 iifiir.org는 2순위(주관기관 이벤트 페이지) 허용 범위라 eval pass. 전용 사이트(cryogenics-conference.eu) 미발굴은 아직 미해결.

#### 잔존 과제
- P4 해결: v3에서 today 앵커 표현 명확화 — "시작일이 YYYY-MM-DD 보다 **이후**인 경우만 upcoming" 부등호 명시

---

### 2026-04-17 — v3 / Haiku 4.5 + Phase A

#### 변경 내용 (v2 → v3)
- `UPDATE_SYSTEM_V3` 신규: 날짜 규칙을 **부등호 명시**로 교체 — "`start_date` 문자열이 오늘(`YYYY-MM-DD`) 문자열보다 크면 upcoming"
- `buildUpdateUserV3`: 반환 직전 **필수 검증 블록** 추가 — "같은 연도니까 이미 지났다" 같은 연도 기반 단락 추론 명시적 금지
- 검증 예시 7건(오늘 기준 전·후 분기 점검)을 프롬프트에 포함. 월/일 자릿수 단위 비교 규칙으로 일반화

#### 결과 — 19건 실행 (golden-set 유지)
- pass **19/19 (100%)** 🎯 — 결과 파일: `docs/eval/results/2026-04-17T12-42-33-v3.json`
- 토큰: avg input **41,651** / output **722** (v2 대비 input +4% / output +7% — 검증 예시 블록 비용)
- `stop_reason=max_tokens` 0/19

#### 케이스별 변화 (v2 → v3)
| id | v2 | v3 | 비고 |
|---|---|---|---|
| conf_013 IEA HPC | heatpumpingtechnologies.org ❌ | hpc2026.org ✅ | **P4 해소** — 5월 26일을 upcoming으로 정확히 인식 |
| conf_014 ICBCHT | null ❌ | sites.mit.edu/icbcht12/ ✅ | **P4 해소** — 6월 14일을 upcoming으로 정확히 인식 |
| conf_016 IHTC | astfe.org ❌ | ihtc18.org ✅ | **P4 해소** — 8월 2일을 upcoming으로 정확히 인식 |
| 나머지 16건 | 유지 | 유지 | P1·P2 수정 케이스 모두 유지 |

#### 가설 검증
- **레버 A' 효과**: 부등호 명시 + 검증 예시 7건으로 P4 **완전 해소** ✅. "이후/이전" 한국어 표현의 모호성이 단일 실패 축이었음 재확인
- **토큰 비용**: 검증 블록의 +4% input / +7% output은 허용 범위. 100% pass 달성 대비 충분히 수용 가능

#### 잔존 과제
- **P2 부분 미해결**: conf_006 IIR Cryogenics, conf_019 Gustav Lorentzen — 전용 사이트 미발굴 상태(source_url 매칭으로 pass). 레버 E(임박 학회 공식사이트 재검증)로 대응 예정
- **활성 전환 의사결정**: `DEFAULT_UPDATE_VERSION` v1 → v3

---

### 2026-04-17 — v4 / Haiku 4.5 + Phase A

#### 변경 내용 (v3 → v4)
- `UPDATE_SYSTEM_V4`: `[신뢰도 기준]` 섹션 신규 — high/medium/low 판정 기준 명시
- `UPDATE_SYSTEM_V4`: `[링크 우선순위]` 4순위 추가 — 공식 회차 페이지 없을 때 출처 URL 허용 (confidence=low 강제)
- `UPDATE_SYSTEM_V4`: 시리즈/일반 페이지 link=null 강화 — "회차 specific 없으면 link=null" 명시, 금지 예시 2건 추가
- `buildUpdateUserV4`: `[기타 주의]` 공식사이트 내 하위 페이지 탐색 의무 추가

#### 결과
- eval: **미실행** — `npm run eval -- --version v4` 실행 후 기록 예정
- 브라우저 수동 확인: ICMF / ICCFD / TPTPR 3케이스 확인 필요

#### 배경 패턴
- **P5** ICMF: 날짜 미확인인데 confidence=medium, 출처 URL link 미반영
- **P6** ICCFD: 공식사이트 홈에 날짜 없어서 하위 페이지 미탐색
- **P2 재발** TPTPR: 금지 도메인 명시에도 시리즈 페이지 link 사용

---

### 2026-04-18 — PLAN-005: eval 3-tier + Haiku→Sonnet 재시도 + v5 (dedicated_url 힌트)

#### 변경 내용
1. **Part 1: conf_006 `official_url` 교체** — `iifiir.org/en/iir-conferences-series`(v4 금지 도메인) → `cryogenics-conference.eu/`. 금지 도메인을 마스터 링크로 보관하던 모순 제거. golden-set.csv 도 동기화
2. **Part 2: eval 3-tier 채점 (`scripts/eval-prompt.js` `scoreUrl`)** — URL 매치 + `aiData.start_date` 있음 → `pass` / URL 매치 but `start_date=null` → **`partial`** / URL 불일치 → `fail`. 이전 "19/19 pass" 착시 제거. 결과 JSON에 `summary.partial` 추가
3. **Part 3-a: `MODELS.updateFallback='claude-sonnet-4-6'`** 신규 (`src/config/models.js`)
4. **Part 3-b: `callClaude` `webFetch` 옵션** — `web_fetch_20250910` tool push (`src/services/claudeApi.js`). Haiku는 호출 금지 (책임은 호출부)
5. **Part 3-c: `useUpdateQueue` 재시도 블록** — `parsed.ok && !parsed.data.start_date` 조건에서 Sonnet 4.6 + `web_fetch` 로 1회 재호출. 2차 파싱 성공 시 결과 교체, 실패면 1차 유지. `retry` 필드로 관찰성 확보(`'sonnet' | 'sonnet_parse_fail' | 'sonnet_error:<kind>'`)
6. **Part 3-d: v5 템플릿 + `dedicated_url` 필드** — `UPDATE_SYSTEM_V5=UPDATE_SYSTEM_V4` 복사, `buildUpdateUserV5` 에서 `conference.dedicated_url` 있을 때만 "회차 전용 사이트(힌트): …" + 사용 지침 1줄 주입. `conferences.json` conf_015 에 `https://iccfd13.polimi.it` 기록. `DEFAULT_UPDATE_VERSION=v4` 유지

#### 결과
- eval: **미실행** — v4·v5 각각 측정 필요 (3-tier 집계 확인)
- 단위 테스트: v5 힌트 주입 + Haiku/Sonnet 재시도 분기 5종 (`useUpdateQueue.test.js` 신규, 100/100 통과)

#### 가설 (측정 대기)
- Part 1 효과: conf_006 `partial` → `pass` 전환 (cryogenics-conference.eu 에서 날짜 직접 추출)
- Part 3 효과: conf_015 가 1차 Haiku에서 `start_date=null` 이어도 Sonnet+web_fetch 재시도로 2026-07-06 추출 → `pass`
- 비용: Sonnet 재시도 호출만 Sonnet 요금 (1M token 기준 입력 $3 / 출력 $15). 대부분 Haiku로 끝나야 함

#### 잔존 과제
- P5 `ICMF`: 여전히 open — v4 confidence 지침이 충분한지 측정 필요
- P2 `conf_019 Gustav`: 전용 사이트 미발굴 문제. 필요하면 `dedicated_url` 로 보조하거나 레버 E 진행

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

- [x] v2 프롬프트 구현 (레버 A + B) 및 v1/v2 비교 실행 (2026-04-17) — 16/19(84%). P4 신규 발생
- [x] v3 프롬프트 구현: 레버 A' (today 앵커 정밀화 — 부등호 + 검증 예시) (2026-04-17)
- [x] v3 eval 실행 → P4 해결 여부 검증 (2026-04-17) — 19/19 (100%), P4 3건 완전 해소
- [x] 활성 전환 의사결정: `DEFAULT_UPDATE_VERSION` v3 → v4 (2026-04-17)
- [x] eval 러너에 `usage.input_tokens/output_tokens` 기록 추가 (2026-04-16)
- [x] eval 3-tier 채점(pass/partial/fail) (PLAN-005, 2026-04-18) — URL만 맞고 start_date=null인 착시 드러냄
- [x] Haiku→Sonnet 재시도 인프라 (PLAN-005, 2026-04-18)
- [x] v5 `dedicated_url` 힌트 옵션 (PLAN-005, 2026-04-18) — `DEFAULT_UPDATE_VERSION=v4` 유지, 측정 후 활성 전환 검토
- [ ] v4·v5 eval 실행 및 3-tier 결과 기록
- [ ] conf_006 외 `official_url`에 금지 도메인 저장된 학회 스크리닝 (P7 확장)
- [ ] 레버 E: `updateLogic.shouldSearch` imminent(임박) 판단 확장 (MVP 후)
- [ ] (장기) 결과 10회+ 축적 시 반자동 log analyzer 슬래시 커맨드 구성
- [ ] (장기) 정답지 채점 정밀화 — "허용 범위" 필드 추가 등 (P3 패턴 대응)
