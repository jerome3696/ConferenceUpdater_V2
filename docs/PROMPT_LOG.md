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
