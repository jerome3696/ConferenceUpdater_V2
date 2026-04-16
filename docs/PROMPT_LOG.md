# PROMPT_LOG

프롬프트 버전별 **실행 기록**. 어떤 버전을 썼고, 무엇이 pass/fail했는지의 사실만.

- 정답지와 실행 결과 JSON 원본: `docs/eval/`
- 가설/대응 전략/미해결 과제: `docs/PROMPT_STRATEGY.md`

---

## v1 (2026-04-15) — 초기 버전, 실전 검증 전

### 작성 의도

- blueprint.md §5.3 / §5.4 초안을 거의 그대로 구현.
- 구조화된 JSON 응답을 강제하기 위해 ```json 코드펜스 예시를 프롬프트에 포함.
- 확인 불가 필드는 `null`로 두게 유도 (fabrication 방지).
- `source_url`, `confidence` 필드를 추가해 근거와 자신감을 함께 받음 (blueprint 원문에는 없음 — 실패 원인 분석용).
- 시스템 프롬프트에 WASET 등 약탈적 학회 출처 배제 명시.

### 구현 위치

- `src/utils/promptBuilder.js` — `buildUpdatePrompt` / `buildVerifyPrompt` (v1)
- `src/services/responseParser.js` — `parseUpdateResponse`, `parseVerifyResponse`

### 실행 결과

#### 2026-04-15 첫 전체 실행 (17건)

- **결과**: pass 13 / fail 4 (76%). 결과 파일: `docs/eval/results/2026-04-15T22-38-24-v1.json`
- 인프라 이슈(rate_limit 등) 0건. 초기 시도에선 17건 중 14건이 429였으나 `claudeApi.js`에 `retry-after` 파싱, `eval-prompt.js`에 단발 재시도 추가 후 전건 완주.

#### 실패 4건 패턴 분석

| id | AI link | 기대 | 분류 |
|---|---|---|---|
| conf_010 | ceee.umd.edu/tptpr2025 (2025 과거 회차) | iifiir.org/en | **past 회차 반환** |
| conf_011 | ecos2025.org/ (2025 Paris, 종료) | ecos2026.insae.ro | **past 회차 반환** |
| conf_015 | easychair.org/smart-program/ICCFD13 | iccfd.org | **비공식/총합 사이트 선호** (source_url은 정답 일치) |
| conf_022 | bs2027.framer.ai (프로토타입) | bs2027.org | **드래프트/비공식 도메인 선호** |

추가로 pass 처리됐지만 **의심 건**:
- conf_001 ASHRAE: 2025 Orlando(이미 종료) 반환. URL은 ashrae.org 하위라 매칭됐을 뿐 사실상 past.

가설/대응 전략/다음 단계는 `docs/PROMPT_STRATEGY.md` 참조.

---

## v1 (2026-04-16) — Haiku 4.5 + Phase A (rate limit 긴급 개선)

### 변경 내용 (프롬프트 외)

프롬프트 텍스트는 v1 그대로 유지. 주변 호출 조건만 변경:

1. **eval 러너 모델 일치** — 이전 측정은 Sonnet 4로 돌았음. `scripts/eval-prompt.js`가 `MODELS.update`(Haiku 4.5)를 import해 앱과 동일 조건으로 측정.
2. **Phase A (RATE_LIMIT_STRATEGY §4)**:
   - `src/services/claudeApi.js` — `web_search` 도구에 `max_uses: 5` 캡
   - `src/hooks/useUpdateQueue.js` — `maxTokens` 2048 → 1024 (kind=update)
3. **eval 러너 계측 추가** — 결과 JSON에 `response.usage` 기록, 케이스별 토큰 소비 실측 가능.

### 실행 결과 (17건 전건)

- **결과**: pass **16/17** (94%). 결과 파일: `docs/eval/results/2026-04-16T13-14-08-v1.json`
- **rate_limit 0건** (이전엔 14건 발생 후 재시도로 회복).
- **토큰 소비**: total input 586,669 / output 11,033. avg input **34,510** / output **649** per call.
- `stop_reason=max_tokens` 0/17 (maxTokens 1024 축소로 인한 JSON 잘림 없음).

### 주요 이슈별 개선

| id | 2026-04-15 (Sonnet) | 2026-04-16 (Haiku + Phase A) |
|---|---|---|
| conf_001 ASHRAE | past 회차(2025 Orlando) 반환, 의심 pass | 2026 Winter 정답 |
| conf_010 TPTPR | past 회차 fail | iifiir.org 정답 |
| conf_011 ECOS | past 회차(2025 Paris) fail | ecos2026.insae.ro 정답 |
| conf_015 ICCFD | easychair.org fail | 여전히 easychair.org fail |
| conf_022 Building Simulation | bs2027.framer.ai fail | ibpsa.org 정답 |

### 가설 — 왜 품질이 올라갔나

`max_uses: 5` 캡이 의도치 않게 **검색 범위 수렴 효과**를 냄. Sonnet은 검색을 확장하다 비공식·past 도메인에 걸려 자기 함정에 빠졌으나, 5회 제한은 공식 도메인 발견 직후 종료를 유도. 모델 다운그레이드(Sonnet → Haiku)에도 품질이 오른 건 이 효과가 모델 차이를 상쇄했음을 시사.

### 잔존 실패

- **conf_015 ICCFD**: 프롬프트의 비공식 도메인 배제 지시(WASET 등)가 easychair까지는 커버 못함. v2 프롬프트의 도메인 블랙리스트 (A·B 레버, `PROMPT_STRATEGY.md §1`) 과제.

### 시사점 (rate limit 관점)

- Tier 1 한도 30k ITPM 대비 **단일 호출 avg 34,510** → sequential에선 통과하나 병렬/고빈도 상황에선 여전히 위험.
- sequential 사용(앱의 현재 동작) 한정으로는 Phase B/C 불필요. 상세는 `docs/RATE_LIMIT_STRATEGY.md §4.5, §8`.

---

## Step 3.6 실전 검증 (2026-04-16, 앱 브라우저)

### 조건
- Phase A 적용 상태 (`max_uses: 5`, `maxTokens: 1024`, Haiku 4.5).
- 앱 UI에서 개별 [업데이트] 버튼으로 실행, 공식사이트 수동 대조.
- eval 17건과 별개. 앱 큐 흐름 (승인 대기 → 수용 → 테이블 반영 → GitHub 저장) 검증 포함.

### 4건 결과

| 학회 | 결과 | AI 반환 | 관찰 |
|---|---|---|---|
| IIR GL 2026 (열물성/냉매) | pass | iifiir.org 리스팅 페이지 | 공식 `iir-gl-2026.net` 대비 리스팅 사이트 선호. 정보 자체는 정확 |
| IHTC | pass | 2026-08-02~07 / Rio de Janeiro | 완벽 |
| ICCFD | pass | easychair.org/smart-program/iccfd13 | **eval conf_015과 동일 실패 패턴 재현** — 공식 `iccfd.org` 대신 easychair 선호 |
| ICBCHT | pass | Cambridge, USA / 2026-06-14~17 / sites.mit.edu/icbcht12 | 기존 "Boston" → AI가 Cambridge로 정밀화 (MIT는 Cambridge, MA). AI가 원본보다 정확한 케이스 |

### 새 관찰

1. **리스팅/플랫폼 사이트 선호 (반복 패턴)** — ICCFD easychair, IIR GL iifiir.org. v1의 WASET 블랙리스트가 포괄 못함. `PROMPT_STRATEGY.md §1 (B) 도메인 블랙리스트` 과제 재확인.
2. **AI가 원본보다 정밀한 케이스** — ICBCHT Cambridge. 단순 일치 검사로는 이런 개선을 pass로만 뭉뚱그림. 정답지 품질 검토 여지 (MVP 후).
3. **임박 학회 공식사이트 추종 아이디어** — 사용자 제안: 시작일까지 N일 이내면 link 있어도 공식 도메인 재검증. `PROMPT_STRATEGY.md §1 (E)`로 이관.

### 결론
- 4건 100% pass, UX 흐름(업데이트 → 수용 → 테이블 반영 → GitHub 저장) 정상 동작.
- "전체 업데이트 22건 1회" 항목은 스킵 — eval 17건 + 실전 4건으로 충분, 자연 사용 중 관찰로 대체.
- 품질 개선은 v2 프롬프트로 이월, 현 시점에서는 Step 4.1 진행.
