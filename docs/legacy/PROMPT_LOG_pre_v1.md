# Prompt Log — Pre-v1.0 (v1~v7 재시작 이전 아카이브)

> 2026-04-21 PLAN-019 재시작 시점에 `docs/prompteng.md` §3 버전 인덱스 · §5 실행 로그를 이 파일로 분리.
> 신규 v1_0 루프는 `docs/prompteng.md` 에서 누적 재시작. 이 파일은 참조·롤백용.
> 레버 카탈로그 (§4) 와 실패 패턴 카탈로그 (§6) 는 자산이므로 `docs/prompteng.md` 에 보존됨.
> 구 프롬프트 본문은 `docs/prompts/legacy/v{4,5,6,7}.md` 참조.

---

## §3. 버전 인덱스 (동결)

| 버전 | 시점 | 환경 | pass | 평균 토큰 (in/out) | 비고 |
|---|---|---|---|---|---|
| v1 | 2026-04-15 | Sonnet 4 | 13/17 (76%) | (미계측) | 초기. past 회차 + 비공식 도메인 4건 fail |
| v1 | 2026-04-16 | Haiku 4.5 + Phase A | **16/17 (94%)** | 34,510 / 649 | `max_uses 5` 캡 효과로 품질 상승 (의외) |
| v2 | 2026-04-17 | Haiku 4.5 + Phase A | **16/19 (84%)** | 39,954 / 677 | 레버 A+B 적용. P1·P2 일부 해결. P4(today 앵커 과잉 교정) 신규 발생 |
| v3 | 2026-04-17 | Haiku 4.5 + Phase A | **19/19 (100%)** | 41,651 / 722 | 레버 A' 적용. P4 3건 완전 해소 (IEA HPC·ICBCHT·IHTC), P1·P2 유지 |
| v4 | 2026-04-17 | Haiku 4.5 + Phase A | (미측정) | — | 레버 C: confidence 기준·link 4순위·하위 페이지 탐색 의무 |
| v5 | 2026-04-18 | Haiku + Phase A + (`dedicated_url` 힌트) + Sonnet 4.6 폴백 | (미측정) | — | 레버 F·G. v4 system 동일, user에 `dedicated_url` 있을 때만 힌트 1줄 + 사용 지침 추가 |
| v6 | 2026-04-18 | Haiku + Phase A + Sonnet 4.6 폴백 + 파서 `normalizeUpdateData` | **15/19 pass + 1 partial + 3 fail (79%/5%/16%)** | 34,613 / 729 | 레버 H·I·J. v3 100% → v6 79% 회귀 표면적, 단 conf_010은 의도된 보수성(link 빈 반환)으로 추정. conf_012/015 진짜 회귀 |
| v7 | 2026-04-20 | Haiku + Phase A + Sonnet 폴백 + `last.link` 패턴 추정 | (미측정) | — | PLAN-013-C. `dedicated_url` 제거, `last.link` 기반 다음 회차 패턴 추정 지침. PLAN-013-D 사전 탐색 체인과 연결 |

---

## §5. 실행 로그 (동결)

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

### 2026-04-18 — PLAN-006: v6 프롬프트 + 파서 안전망

#### 변경 내용
1. **Part 1: `UPDATE_SYSTEM_V6` + `buildUpdateUserV6` 신규** (`src/utils/promptBuilder.js`) — v4·v5 불변
   - [Link–Confidence 상호구속] 섹션: `confidence=high|medium` 이면 link non-null 강제, link=null이면 confidence=low 강제 (레버 H)
   - [링크 우선순위] 재정리: 3순위(주관기관 컨퍼런스 색인 페이지)에서 해당 회차를 명시적으로 나열하는 경우 허용 명시. `iifiir.org/en/events/<슬러그>` 직접 이벤트 URL은 2순위로 편입, 일반 `/events` 루트만 금지
   - [Venue 포맷 — 엄격] 섹션 신규: US/Canada/기타 3분기, 국가명 정규화(`USA`/`UK`/`Korea`) + 예시 4건 (레버 I)
   - [Draft/초안 사이트 처리] 섹션 신규: framer.ai/notion.site/wix.com 등 빌더 사이트를 link로 사용 허용, confidence=low 강제 + notes='draft/prototype' (레버 J)
   - 자기검증 체크리스트를 user 프롬프트에 주입 (venue 포맷 / link–confidence / source_url 기반 link)
2. **Part 2: 파서 안전망** (`src/services/responseParser.js`)
   - `BANNED_LINK_DOMAINS` 상수 export — 프롬프트 템플릿 리터럴과 파서가 공유하는 단일 공급원
   - `normalizeUpdateData(data)` 신규 export + `parseUpdateResponse` 마지막 단계 자동 호출
   - 백필 조건: `link==null && source_url 유효(금지 미매칭) && start_date 존재` → `link=source_url` + confidence 1단계 다운그레이드(high→medium, medium→low, low→low) + notes 에 `[파서 백필: source_url → link]` 마커
3. **Part 3: 단위 테스트**
   - `responseParser.test.js`: `BANNED_LINK_DOMAINS`(2종) + `normalizeUpdateData`(12종) 신규 — framer.ai 미포함 / 백필 성공·차단 분기 / confidence 다운그레이드 3분기 / parseUpdateResponse 통합 동작
   - `promptBuilder.test.js`: v6 분기 7종 — Link–Confidence 텍스트, Venue 포맷 예시, Draft 섹션, framer.ai 금지리스트 미등장, 3순위 색인 허용, 자기검증 체크리스트, dedicated_url 힌트 (v5 동일 동작)

#### 결과
- eval (2026-04-18, `--version v6`): **pass 15 / partial 1 / fail 3 (19건)**, avg input 34,613 · output 729, `stop_reason=max_tokens` 0/19 — `docs/eval/results/2026-04-18T00-28-11-v6.json`
  - **fail**: conf_010 TPTPR (`ai_link_missing` — 17s, link 빈 반환), conf_012 THERMINIC (`url_mismatch` → `ipcei-me-ct.eu/events/...` 오답), conf_015 ICCFD (`url_mismatch` → `iccfd13.polimi.it`, 합리적 추측이나 golden과 mismatch)
  - **partial**: conf_006 IIR Cryogenics (URL pass, `start_date=null` — draft 연성화 효과 가능)
  - **v3(19/19) → v6(15/19) 표면적 회귀** — conf_010은 레버 H 의도된 보수성으로 추정(확신 없으면 link 비우기), conf_012/015는 진짜 회귀. 향후 follow-up 분석 대상
- 단위 테스트: 전건 122/122 통과 (신규 +21: 파서 14, 프롬프트 7)

#### 가설 (측정 대기)
- 레버 H 효과: v6 에서 `link=null + confidence=high` 자기모순 0건 (v4 재현 기준 대비)
- 레버 I 효과: v4 응답에서 관찰된 US 주(state) 누락 2건(conf_001·008) → v6 에서 `City, State, USA` 준수
- 레버 J 효과: conf_022 BS 2027 같은 케이스에서 `bs2027.framer.ai` link 채워지고 confidence=low + notes='draft/prototype' 표기. 혹은 `ibpsa.org/conferences/` 색인 페이지를 3순위로 채용
- 파서 안전망 효과: v4 활성 동안에도 `link=null` 오탐 일부 자동 백필 (단, 날짜 있는 경우만)
- 토큰 비용: v4 대비 +10~15% 예상 (3개 신규 섹션). 허용선 초과 시 [Venue 포맷] 예시 축소

#### 활성 전환 정책
- `DEFAULT_UPDATE_VERSION='v4'` 유지. eval 3-tier 측정에서 v6 가 v4 대비 partial/fail 감소 확인 후 별도 커밋으로 전환

#### 잔존 과제
- **DB 잔여 오염**: 기존 `conferences.json`/`editions` 의 `United States`/state 누락/framer 링크는 손대지 않음 — 다음 업데이트 때 자동 수렴 예정
- **v6 토큰 비용**: 레버 H·I·J 누적으로 input 증가 예상. eval 결과로 허용선 판단
- **`BANNED_LINK_DOMAINS` 단일 공급원 의존**: 프롬프트와 파서가 같은 상수 참조 → 수정 시 두 테스트 스위트 동시 회귀 확인

---

### 2026-04-20 — PLAN-013-C: v7 / `last.link` 패턴 추정

#### 변경 내용 (v6 → v7)
- `UPDATE_SYSTEM_V7` 신규: v6 에서 `dedicated_url` 관련 문구 제거. "[마지막 개최 정보 활용]" 섹션 추가 — `last.link` 패턴 추정 규칙 (`ihtc18.org → ihtc19.org`, `ecos2024.org → ecos2026.org` 등)
- `buildUpdateUserV7`: user 프롬프트에서 `dedicated_url` 힌트 제거, `last.{start,end,venue,link}` 그대로 노출
- PLAN-013-D 와 쌍: `buildLastEditionPrompt` v1 이 last-missing 사전 탐색을 처리하므로 main update 프롬프트는 `last.link` 활용에 집중

#### 결과
- eval: **미실행** (이후 PLAN-019 재시작으로 측정 보류)

---

> **이후 이력**: 2026-04-21 PLAN-019 로 v1~v7 전면 레거시화. 신규 v1_0 루프는 `docs/prompteng.md` 참조.
