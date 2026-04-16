# PROMPT_STRATEGY

프롬프트 품질 개선 전략.
API rate limit 대응 및 호출 구조 개선은 → `docs/RATE_LIMIT_STRATEGY.md`

`PROMPT_LOG.md`는 "무엇을 했나(버전별 서사와 실행 결과)"의 기록.
이 파일은 "무엇을 할까/왜 이렇게 할까(설계 판단)"의 기록.

---

## 1. v2 프롬프트 개선 가설

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
| (E) 임박 학회 공식사이트 추종 | 시작일 ≤ N일(예: 90일)이면 link가 있어도 공식 도메인 재검증 | 리스팅 사이트 우회 (품질) — **프롬프트 단독 불충분, `updateLogic.shouldSearch` 확장 병행** |

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

## 2. 자동 프롬프트 최적화 (subagent 분업) 검토

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

## 3. 미해결 과제 리스트

- [ ] v2 프롬프트 구현 및 v1/v2 비교 실행 (레버 A~D)
- [x] eval 러너에 `usage.input_tokens/output_tokens` 기록 추가 (2026-04-16)
- [ ] 레버 (E) 임박 학회 공식사이트 추종 — `updateLogic.shouldSearch` 확장(imminent 판단) + 프롬프트 공식 도메인 우선 지시. MVP 후.
- [ ] (장기) 반자동 log analyzer 슬래시 커맨드 구성
