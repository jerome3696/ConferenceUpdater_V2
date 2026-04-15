# PROMPT_STRATEGY

프롬프트·평가·API 호출 개선을 위한 **전략/가설/대응책** 저장소.
사람이 먼저 읽고, 추후 Claude Code가 작업 맥락 파악용으로도 참조.

`PROMPT_LOG.md`는 "무엇을 했나(버전별 서사와 실행 결과)"의 기록.
이 파일은 "무엇을 할까/왜 이렇게 할까(설계 판단)"의 기록.

---

## 1. Rate limit 대응 전략

### 배경
Anthropic tier 1 기본 한도: input 30,000 tokens/min. `web_search` 도구는 검색 결과 snippet이 입력에 재주입되어 케이스당 수천~1만 토큰 소모. 22건 연속 호출이면 확정적으로 429 발생.

### 현재 구현 (eval 러너)
- 케이스 간 고정 딜레이 0
- 429 발생 시 `retry-after` 헤더(없으면 30s) 대기 후 1회 재시도
- `src/services/claudeApi.js` — 429 응답에서 `retry-after` 헤더 파싱해 `err.retryAfterMs` 첨부
- `scripts/eval-prompt.js` — `runOne` 래퍼가 `kind === 'rate_limit'`이면 1회 재시도

### 2026-04-15 첫 실행 검증
17건 전부 완주 (이전엔 14건 429 실패). rate_limit은 단발 재시도로 충분히 회복됨.

### 전체 업데이트(Step 3.4)에서의 재발 가능성: 높음
22건 × 웹검색 = 동일 구조. 사용자 UI에서 7분 무응답 + 중간 에러는 UX 파탄.

### 개선 후보 (난이도 순)

| # | 방법 | 난이도 | 효과 |
|---|---|---|---|
| A | **응답 헤더 기반 스로틀링**: `anthropic-ratelimit-input-tokens-remaining` 읽어 임계치 이하면 `reset` 시각까지 sleep | 중 | 이론상 최적. 낭비 없음 |
| B | **동시성 제한 큐**: 병렬 1~2개로 처리량 올리되 한도 안 넘게 | 중 | 체감 속도 ↑ |
| C | **진행률 UI + 백그라운드 큐**: "N/22 완료" 실시간 표시, 취소/재개 | 상 | UX 해결책 |
| D | **Message Batches API**: 비동기 배치, 최대 24h, 50% 싸고 rate limit 별도 | 상 | 근본 해결. 단 `web_search` 도구 호환 확인 필요 |
| E | **지수 백오프 + N회 재시도**: 현재 1회→3~5회 | 하 | 최소 개선 |

### 추천 (Step 3.4 시점)
A + E 조합. A로 평균 대기 최소화, E로 예외 안전망. C는 별개 UX 작업.

---

## 2. v2 프롬프트 개선 가설

### v1 실패 패턴 (PROMPT_LOG v1 실행 결과 참고)
- **past 회차 반환**: conf_001(ASHRAE 2025), conf_011(ECOS 2025)
- **비공식/드래프트 도메인 선호**: conf_015(easychair), conf_022(framer.ai)

### 프롬프트 단독으로 **품질 + 토큰** 동시 개선 가능한 레버

| 레버 | 지시 예시 | 기대 효과 |
|---|---|---|
| (A) today 앵커 | "오늘: YYYY-MM-DD. 시작일이 과거면 반환 금지" | past 회차 제거 (품질) |
| (B) 도메인 블랙리스트 | "금지: easychair, framer.ai, conferenceindex, waset, allconferencealert류" | 비공식 URL 제거 (품질) |
| (C) 조기 종료 | "공식 페이지 찾으면 추가 검색 금지" | 검색 호출 수↓ → input 토큰↓ |
| (D) JSON-only | "JSON 블록 1개만. preamble/후기 금지" | output 토큰↓ |

### 예상 범위
- pass: 13/17 → 15~16/17
- avg input tokens: -20~40%
- avg output tokens: -30~50%

### 검증 방법
1. `src/utils/promptBuilder.js`에 `TEMPLATES.update.v2` 추가 (v1 불변 유지)
2. `scripts/eval-prompt.js` 결과 JSON에 `response.usage` 기록 추가
3. v1, v2 교차 실행 → pass / avg input / avg output 비교
4. 결과를 `PROMPT_LOG.md`에 기록

---

## 3. 토큰 절감의 추가 레버 (프롬프트 외)

- **`web_search` 도구의 `max_uses` 파라미터**: 프롬프트로 "조기 종료"를 지시하는 것보다 더 직접적. 값 3~5로 캡 설정.
- `max_tokens` 축소: 현재 2048. JSON-only 강제하면 512~1024로도 충분할 가능성.

둘 다 v2 프롬프트 검증 후 별건으로 실험 가치 있음.

---

## 4. 자동 프롬프트 최적화 (subagent 분업) 검토

### 제안: crawler + log analyzer + prompt editor 3-agent 분업

### 부정적 평가

1. **해결하려는 문제가 현재 스케일에 없음**
   - crawler가 정답지 생성 → "AI 채점 AI" 순환, 회귀 테스트 의미 증발
   - log analyzer: 실패 4건 수준은 사람이 1분이면 파악. 수백 건 스케일에서나 가치
   - prompt editor: 편집은 병목이 아니고 **검증이 병목** (정답지, 시간, 비용)

2. **피드백 루프 비용**
   - 1 iteration = 17건 × 30초 × API 비용. 자동 20회 돌면 수백 호출 + 수만 토큰

3. **Goodhart's Law 위험**
   - 자동 편집이 pass율을 목표로 하면 정답지에 과적합. 정답지 밖 케이스 품질 저하 가능

4. **품질 문제가 단순함**
   - past 반환/비공식 URL은 프롬프트 지시 1~2줄로 잡힘. LLM이 자율 튜닝할 여지가 크지 않음

### 그래도 쓸모 있는 부분

- **log analyzer (반자동)**: 결과 JSON 10회+ 쌓였을 때 "실패 패턴 분류" 1-shot 호출. slash command 같은 형태.
- **prompt editor (후보 생성만)**: "실패 로그 보고 v2/v3/v4 후보 3개 제안해줘". 사람이 diff 보고 승인. 자동 채택 금지.
- **crawler (정답지 생성)**: 평가 독립성 파괴. 쓰지 말 것. 예외: "새 학회 발굴" 목적은 OK, 정답지 pipeline과 분리.

### 단계적 적용

- 지금(MVP): 수동. v2 가설→실행→기록 사이클 2~3회
- 결과 10회+ 축적 후: 반자동 log analyzer 1-shot
- MVP 이후: 반자동 prompt editor (후보 생성만)
- **절대 금지**: 정답지 AI 생성, 인간 개입 없는 자동 채택 루프

---

## 5. 미해결 과제 리스트

- [ ] v2 프롬프트 구현 및 v1/v2 비교 실행
- [ ] eval 러너에 `usage.input_tokens/output_tokens` 기록 추가
- [ ] `web_search.max_uses` 파라미터 실험
- [ ] Step 3.4 전체 업데이트 시 응답 헤더 기반 스로틀링 도입
- [ ] (장기) 반자동 log analyzer 슬래시 커맨드 구성
