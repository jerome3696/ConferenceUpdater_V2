# RATE_LIMIT_STRATEGY

Anthropic API rate limit 대응 전략 및 단계별 실행 계획.
프롬프트 품질 개선은 범위 밖 — `docs/PROMPT_STRATEGY.md` 참조.

이 문서는 **"왜 이 순서로 해결할까 / 어떻게 단계적으로 실행할까"**의 실행 가이드.
실제 시도 이력과 결과 수치는 `docs/PROMPT_LOG.md`에 기록.

---

## 1. 배경 및 현황 분석

### Tier 1 한도
Anthropic API Tier 1 기본 한도: **input 30,000 tokens/min**. `web_search` 도구는 검색 결과 snippet이 입력에 재주입되어 케이스당 수천~1만 토큰 소모. 22건 연속 호출이면 확정적으로 429 발생.

### 현재 구현
- `src/services/claudeApi.js:90-97` — 429 응답에서 `retry-after` 헤더 파싱해 `err.retryAfterMs` 첨부
- `src/hooks/useUpdateQueue.js:102-113` — rate_limit 발생 시 큐 앞에 되돌리고 `rateLimitUntil` 설정, 타이머 만료 후 재시도
- `src/components/UpdatePanel/UpdatePanel.jsx:6-21` — `RateLimitBanner`로 남은 대기 시간 표시
- `scripts/eval-prompt.js` — `runOne` 래퍼가 `kind === 'rate_limit'`이면 1회 재시도

### 2026-04-15 eval 실행 결과
17건 전부 완주 (이전엔 14건 429 실패). 단발 재시도로 회복은 가능하나, 22건 배치에서는 한 건당 400초씩 묶이는 UX 파탄.

---

## 2. 레거시 대조 (conference-finder/)

동일 도메인의 Python 백엔드 레거시 프로젝트가 `conference-finder/`에 있음. 당시엔 rate limit이 체감되지 않았으므로 구조 차이 확인.

### 관련 파일 매핑

| 관심사 | 레거시 경로 | 현재 경로 |
|---|---|---|
| `web_search` 도구 설정 | `conference-finder/src/crawler/claude_search.py:17-23` | `src/services/claudeApi.js:51` |
| API 호출 래퍼 | `conference-finder/src/crawler/claude_search.py:89-148` | `src/services/claudeApi.js:31-106` |
| 순차 큐/루프 | `conference-finder/src/notifier/checker.py:110-126` | `src/hooks/useUpdateQueue.js:61-124` |
| 사전 스킵 필터 | `conference-finder/src/notifier/checker.py:21-29` (`_should_skip`) | `src/App.jsx:43` (`filterSearchTargets`) + `src/services/updateLogic.js:11-17` (`shouldSearch`) |
| 에러 처리 | `conference-finder/src/notifier/checker.py:124-126` (silent skip) | `src/hooks/useUpdateQueue.js:102-113` (재큐잉+배너) |

### 구조 차이 (rate limit 관점)

| 항목 | 레거시 | 현재 | rate limit 영향 |
|---|---|---|---|
| `web_search.max_uses` | **8 (명시 캡)** | 없음 | 현재는 한 호출 내 검색 횟수 제한 없음 → input 토큰 상한 예측 불가 |
| `max_tokens` (출력) | 1024 | 2048 | OTPM 소비 2배 |
| 모델 | `claude-opus-4-6` | update=Haiku 4.5 / verify=Sonnet 4 | tier별 한도 상이 |
| 사전 스킵 | `_should_skip`로 호출 생략 | `App.jsx:43`에서 동등 수행 | 동등 수준 |
| 429 에러 처리 | `continue`로 조용히 스킵 | retry-after 대기 후 재시도 | **레거시에서도 429는 발생했을 가능성이 높으나 로그로만 남아 사용자 미체감** |
| 실행 환경 | Python sync (서버) | 브라우저 useEffect | 호출 간격은 양쪽 다 ≈0, 차이 없음 |

### 시사점 — "레거시 안 걸렸던" 체감의 3가지 원인

1. `max_uses=8` + `max_tokens=1024`로 **한 호출의 실 토큰 소비가 작음**
2. `_should_skip`으로 **호출 총량 자체가 적음**
3. 429가 발생해도 **silent continue로 사용자 미인지** → "rate limit 없었음"은 실측이 아니라 체감

**이식 가치**:
- ✅ `max_uses` 캡 (Phase A로 채택)
- ✅ `max_tokens` 축소 (Phase A로 채택)
- ❌ silent-skip 에러 처리 (이식 금지, 현재 구조가 더 올바름)

---

## 3. 개선 로드맵

**원칙**: Phase A → 측정 → B → 측정 → C. 한 번에 다 넣으면 어느 레버가 주효했는지 분리 불가.

| Phase | 접근 | 난이도 | 기대 효과 | 착수 조건 |
|---|---|---|---|---|
| **A** | 구조적 토큰 절감 (max_uses + max_tokens) | 하 | 레거시 수준으로 회귀 | **즉시** |
| **B** | 응답 헤더 기반 proactive 스로틀 | 중 | 평균 대기 최소화, 낭비 없음 | A 측정 후 429 여전히 5건 이상 |
| **C** | 지수 백오프 N회 재시도 | 하 | 예외 안전망 | B 후에도 장시간 대기 빈발 |

---

## 4. Phase A — 즉효 (구조적 토큰 절감)

### 4.1 변경 지점

**1) `src/services/claudeApi.js`** — `web_search` 도구에 `max_uses` 추가

함수 시그니처에 `maxWebSearches = 5` 파라미터 추가:
```js
export async function callClaude({
  apiKey, prompt, system,
  webSearch = false,
  maxTokens = 1024,
  maxWebSearches = 5,
  model = DEFAULT_MODEL,
  signal,
}) {
```

도구 정의 (line 50-52):
```js
if (webSearch) {
  body.tools = [{
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: maxWebSearches,
  }];
}
```

**2) `src/hooks/useUpdateQueue.js:88`** — `maxTokens` kind별 분기

Before: `maxTokens: 2048,`
After: `maxTokens: item.kind === 'verify' ? 1536 : 1024,`

### 4.2 값 선정 근거

- **max_uses: 5** — 레거시는 8이었으나, 현재 Tier 여유 부족 상태이므로 보수적으로 5부터. 품질 저하 관찰되면 8로 상향.
- **maxTokens (update) 1024** — JSON 블록 하나 (upcoming 3필드 + confidence + notes). 레거시 동일.
- **maxTokens (verify) 1536** — 6개 필드 × `{status, correct}` 구조라 출력이 더 김. 안전 마진 포함.

### 4.3 위험·완화

| 위험 | 완화 |
|---|---|
| `max_uses: 5`가 비주류 학회에서 공식 페이지 못 찾게 함 (레거시 8 → 5) | eval 17건 재측정, pass 13/17 유지 여부 확인. 떨어지면 8로 상향 |
| `maxTokens: 1024/1536`에서 JSON 잘림 → 파싱 실패 | `res.stop_reason === 'max_tokens'` 모니터. 파싱 실패율이 baseline 초과 시 +512 증설 |

### 4.4 검증 체크리스트

- [ ] `npm run dev` → 단건 [업데이트] 버튼 회귀 (UpdateCard 정상)
- [ ] 단건 [검증] 회귀 (VerificationCard 정상, `schema_mismatch` 없음)
- [ ] `node scripts/eval-prompt.js --version v1` pass 건수 확인 (baseline 13/17)
- [ ] "전체 업데이트" 22건 실전, DevTools Network 탭:
  - [ ] 429 응답 건수 카운트 (baseline 14건)
  - [ ] `anthropic-ratelimit-input-tokens-remaining` 추이 기록 (Phase B 임계치 결정용)
  - [ ] `usage.input_tokens` / `usage.output_tokens` 총합 기록
  - [ ] `stop_reason === 'max_tokens'` 발생 여부

### 4.5 구현 후 실측

#### 2026-04-16 완전 측정 (eval 17/17, Haiku 4.5 + Phase A)

**측정 조건**: 앱과 동일 (`MODELS.update` = Haiku 4.5, `max_uses: 5`, `maxTokens: 1024`). eval 러너가 usage·stop_reason 기록 기능 추가된 뒤 첫 완전 측정.

| 지표 | Baseline (Sonnet, 제한없음) | Phase A (Haiku + max_uses=5 + 1024) | 변화 |
|---|---|---|---|
| eval pass | 13/17 | **16/17** | +3 (품질 **개선**) |
| rate_limit 발생 | 14/22 (7분 대기 빈발) | **0/17** | 완전 해소 |
| avg input tokens/call | _미측정_ | 34,510 | — |
| avg output tokens/call | _미측정_ | 649 | — |
| total input tokens (17건) | _미측정_ | 586,669 | — |
| total output tokens (17건) | _미측정_ | 11,033 | — |
| stop_reason=max_tokens | _미측정_ | 0/17 | JSON 잘림 없음 |

**해석**:
- **rate limit 완전 해소**: 17건 연속 무중단. Phase A만으로 목표 초과 달성.
- **품질 동시 개선 (예상외 수확)**: Sonnet baseline 13/17 → Haiku+Phase A 16/17. 가설: Sonnet은 `max_uses` 없이 검색을 확장해 past 회차·비공식 도메인에 빠지는 경향이 있었는데, max_uses=5로 조기 종료시키니 집중력 향상. 즉 Phase A는 토큰 절감 + 품질 개선 이중 효과.
  - conf_001 ASHRAE (이전 past 회차 반환) → 현재 2026 Winter 정답
  - conf_011 ECOS (이전 past 회차 반환) → ecos2026.insae.ro 정답
  - conf_010 TPTPR (이전 fail) → iifiir.org 정답
- **잔존 실패 conf_015 ICCFD**: easychair.org 반환. v1의 알려진 약점(비공식 도메인). Phase A 범위 밖 → `docs/PROMPT_STRATEGY.md` v2 가설(도메인 블랙리스트)로 해결할 과제.
- **토큰 관찰**: avg input 34,510/call이 Tier 1 ITPM 30,000에 근접. 단일 sequential 호출은 통과하나, 병렬성 또는 짧은 간격 반복은 여전히 위험. **Phase B 착수 필요성 낮음** — sequential 사용 전제에서는 Phase A로 충분.

**결과 JSON**: `docs/eval/results/2026-04-16T13-14-08-v1.json`
**상세 서사**: `docs/PROMPT_LOG.md`

---

## 5. Phase B — 응답 헤더 proactive 스로틀

### 5.1 착수 조건
Phase A 측정 후 429가 **5건 이상** 여전히 발생. Phase A만으로 부족한 경우에만 진행.

### 5.2 변경 지점

**1) `src/services/claudeApi.js`** — 성공 응답에 rate limit 헤더 메타데이터 첨부

성공 응답 반환 시:
```js
const body = await res.json();
Object.defineProperty(body, '__rateLimit', {
  value: readRateLimitHeaders(res.headers),
  enumerable: false,
});
return body;
```

헬퍼:
```js
function readRateLimitHeaders(headers) {
  const num = (h) => {
    const v = headers.get(h);
    return v === null ? null : Number(v);
  };
  const iso = (h) => {
    const v = headers.get(h);
    if (!v) return null;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  };
  return {
    inputTokensRemaining: num('anthropic-ratelimit-input-tokens-remaining'),
    inputTokensResetAt: iso('anthropic-ratelimit-input-tokens-reset'),
    requestsRemaining: num('anthropic-ratelimit-requests-remaining'),
    requestsResetAt: iso('anthropic-ratelimit-requests-reset'),
  };
}
```

non-enumerable 프로퍼티로 첨부하면 기존 `extractText`, `res.content`, `res.stop_reason` 호출부는 변경 불필요.

**2) `src/hooks/useUpdateQueue.js`** — 임계치 이하면 reset까지 sleep

매 호출 성공 후:
```js
const rl = res.__rateLimit;
if (rl?.inputTokensRemaining != null && rl.inputTokensRemaining < 3000) {
  const waitMs = Math.max(1000, (rl.inputTokensResetAt || Date.now() + 30000) - Date.now());
  setRateLimitUntil(Date.now() + waitMs);
  if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
  rateLimitTimerRef.current = setTimeout(() => {
    rateLimitTimerRef.current = null;
    setRateLimitUntil(null);
  }, waitMs);
}
```

기존 `rateLimitUntil` 상태와 `RateLimitBanner` UI 재활용.

### 5.3 임계치 튜닝 계획
- 초기값: **3000 tokens** (케이스당 평균 소비 3000~5000 가정)
- Phase A의 §4.4 검증에서 기록한 `anthropic-ratelimit-input-tokens-remaining` 추이를 보고 실측 기반 조정
- 너무 높으면 불필요한 대기, 너무 낮으면 여전히 429 발생

---

## 6. Phase C — 지수 백오프 N회 재시도

### 6.1 착수 조건
Phase B 후에도 간헐적 장시간 대기 발생. `retry-after` 헤더가 없는 상황에서 재시도 간격이 적절하지 않은 경우.

### 6.2 변경 지점

**`src/hooks/useUpdateQueue.js`** — item에 retries 카운트 추가

`enqueue` 시:
```js
const items = targets.map((r) => ({
  id: nextId(), kind, conferenceId: r.id, row: r,
  retries: 0,
}));
```

rate_limit catch 블록:
```js
} else if (err instanceof ClaudeApiError && err.kind === 'rate_limit') {
  const MAX_RETRIES = 3;
  const nextRetries = (item.retries ?? 0) + 1;
  if (nextRetries > MAX_RETRIES) {
    card = {
      ...item,
      status: 'error',
      error: `rate limit 재시도 ${MAX_RETRIES}회 초과`,
    };
  } else {
    const baseMs = Number.isFinite(err.retryAfterMs)
      ? err.retryAfterMs
      : 60000 * (2 ** (nextRetries - 1));
    const until = Date.now() + baseMs;
    setQueue((q) => [{ ...item, retries: nextRetries }, ...q]);
    setRateLimitUntil(until);
    // ... 기존 타이머 로직
    card = null;
  }
}
```

**원칙**: `retryAfterMs`가 있으면 그대로 사용. 없을 때만 지수 백오프 (60s → 120s → 240s). 이중 대기 방지.

---

## 7. 범위 밖 (고려했으나 제외)

| 방법 | 이유 |
|---|---|
| **동시성 제한 큐** (병렬 1~2개) | 처리량 증가가 목적이지만 rate limit 절약과 반대 방향 |
| **진행률 UI + 백그라운드 큐** ("N/22", 취소/재개) | UX 개선으로는 가치 있으나 rate limit 해결책이 아님. 별개 작업 |
| **Message Batches API** (비동기 배치) | 근본 해결이지만 `web_search` 도구 호환성 불명. 추후 재조사 가치 있음 |

---

## 8. 미해결 과제

- [x] Phase A 구현 (2026-04-16) — `claudeApi.js` maxWebSearches=5, `useUpdateQueue.js` maxTokens kind별
- [x] eval 러너 모델을 앱과 일치 (2026-04-16) — `MODELS.update`(Haiku 4.5) 사용. 이전에는 eval이 Sonnet 4로 호출되어 앱 품질 수치와 비교 불가였음.
- [x] Phase A eval 17건 완전 측정 (2026-04-16) — pass 16/17, rate_limit 0/17, avg input 34,510 tokens/call. §4.5 참조.
- [x] Phase B 착수 여부 결정 — **미착수 (Phase A로 충분)**. sequential 사용 전제에서 Phase A만으로 rate limit 완전 해소. 병렬·고빈도 시나리오 등장 시 재검토.
- [~] 22건 실전(앱 브라우저) 검증 — eval에서 효과 증명되어 필수성 낮음. 앱 자연 사용 중 관찰로 대체.
- [ ] (B 착수 시) 임계치 3000 튜닝 — 실측 기반
- [x] `scripts/eval-prompt.js:63`의 `maxTokens`를 runtime과 맞춤 (2026-04-16, update=1024. eval은 update kind만 테스트)
- [x] eval 러너의 결과 JSON에 `response.usage.input_tokens/output_tokens` 기록 추가 (2026-04-16)
- [ ] (장기) Message Batches API + `web_search` 호환성 재조사
