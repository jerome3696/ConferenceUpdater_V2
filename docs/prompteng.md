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
- **앱 사용 중**: `v1` (Haiku 4.5 + Phase A 적용)
  - `web_search` `max_uses: 5` 캡 / `maxTokens: 1024` (kind=update)
- **마지막 측정**: 2026-04-16 / pass **16/17 (94%)** / avg input 34,510 · output 649 토큰
  - 결과 파일: `docs/eval/results/2026-04-16T13-14-08-v1.json`

### 잔존 실패 (다음 개선 타겟)
- **conf_015 ICCFD** — easychair.org 선호. v1 WASET 블랙리스트가 easychair까지 포괄 못함. → 레버 B
- **리스팅 사이트 선호 (실전 관찰)** — IIR GL 2026 → iifiir.org. eval과 별개로 앱 사용 중 반복 관찰. → 레버 B + E

### 다음 시도 (next levers)
- [ ] **A. today 앵커** + **B. 도메인 블랙리스트** — v2로 묶어 우선 적용
- [ ] **E. 임박 학회 공식사이트 추종** — `updateLogic.shouldSearch` imminent 판단 확장 필요. MVP 후 본격 검토

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
| v2 | 미실행 | (예정) | — | — | 레버 A(today 앵커) + B(도메인 블랙리스트) 적용 예정 |

---

## §4. 가설 카탈로그 (레버)

프롬프트 단독으로 품질·토큰을 움직일 수 있는 손잡이. 한번 정의되면 후속 버전에서 재사용.

| 레버 | 지시 예시 | 기대 효과 | 실측 |
|---|---|---|---|
| **A. today 앵커** | "오늘: YYYY-MM-DD. 시작일이 과거면 반환 금지" | past 회차 제거 (품질) | 미실측 (Phase A 부수 효과로 일부 해소된 듯) |
| **B. 도메인 블랙리스트** | "금지 도메인: easychair, framer.ai, conferenceindex, waset, allconferencealert 류" | 비공식 URL 제거 (품질) | 미실측 (v2 우선 대상) |
| **C. 조기 종료** | "공식 페이지 찾으면 추가 검색 금지" | 검색 호출↓ → input 토큰↓ | `max_uses: 5` 캡으로 부분 검증 — 품질 상승 동반 |
| **D. JSON-only** | "JSON 블록 1개만. preamble/후기 금지" | output 토큰↓ | 미실측 |
| **E. 임박 학회 공식사이트 추종** | 시작일 ≤ N일(예: 90일)이면 link가 있어도 공식 도메인 재검증 | 리스팅 사이트 우회 (품질) | **프롬프트 단독 불가** — `updateLogic.shouldSearch`에 imminent 판단 확장 필요 |

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

## §6. 실패 패턴 카탈로그

루프를 돌릴수록 같은 패턴이 반복된다. 패턴 단위로 누적하여 다음 가설의 인풋으로 사용.

### P1. past 회차 반환
- **원인**: 모델이 검색 결과의 가장 가시적인 회차를 반환, today 인지 약함
- **사례**: conf_001 ASHRAE (v1 Sonnet 의심 pass), conf_010 TPTPR, conf_011 ECOS
- **대응 레버**: A
- **상태**: Phase A에서 우연히 해소 (max_uses 5 부수 효과). 명시 지시(레버 A)로 본격 검증 필요.

### P2. 비공식/리스팅 도메인 선호
- **원인**: 검색 상위 결과에 리스팅 플랫폼이 자주 노출됨 (SEO·플랫폼 효과)
- **사례**: conf_015 ICCFD (easychair, eval+실전 양쪽), conf_022 Building Sim (framer, v1 Sonnet에서만), IIR GL 2026 (iifiir.org, 실전)
- **대응 레버**: B (블랙리스트). 임박 학회는 E 병행
- **상태**: 미해결, v2 우선 대상

### P3. AI가 원본보다 정밀
- **원인**: 단순 일치 채점 한계
- **사례**: ICBCHT Boston → Cambridge, MA
- **의미**: 채점 로직 개선 여지 (정답지 자체에 "허용 범위" 기록 등). MVP 후.
- **상태**: 관찰만, 즉시 대응 불요

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

- [ ] v2 프롬프트 구현 (레버 A + B 우선) 및 v1/v2 비교 실행
- [x] eval 러너에 `usage.input_tokens/output_tokens` 기록 추가 (2026-04-16)
- [ ] 레버 E: `updateLogic.shouldSearch` imminent(임박) 판단 확장 (MVP 후)
- [ ] (장기) 결과 10회+ 축적 시 반자동 log analyzer 슬래시 커맨드 구성
- [ ] (장기) 정답지 채점 정밀화 — "허용 범위" 필드 추가 등 (P3 패턴 대응)
