# PLAN-011: 신규 학회 발굴 (Discovery) — 블루프린트

> **상태**: active (블루프린트 단계 — 서브플랜 011-A~E 분리 예정)
> **생성일**: 2026-04-18
> **완료일**: —
> **브랜치**: `feature/PLAN-011-discovery` (서브플랜별 분기)
> **연관 PR**: TBD
> **트랙**: E (기능 확장 / blueprint §7.2 우선순위 3)
> **흡수 항목**: Track E.2 (가짜학회 필터링) + Track E.3 (키워드 추천)

---

## 1. 목표 (What)

관리자가 1~3개 시드 키워드만 던지면, **DB에 없는 신규 학회를 후보 카드 10~20건으로 발굴 → 승인 시 마스터 + upcoming edition 동시 생성**까지 한 번에 마무리하는 기능을 제공한다.

측정 가능한 완료 조건:
- 시드 3개 → 5분 이내 후보 카드 출력
- 한 발굴 세션 비용 **$0.10~0.20 (₩150~300)** 이하
- WASET류 약탈 학회 **0건 통과** (기본값 거절 토글)
- 기존 update/verify UI 패턴 그대로 재사용 (학습부담 0)

## 2. 배경·동기 (Why)

현재 ConferenceFinder DB는 사용자가 시드한 학회 목록을 AI 업데이트/검증으로 유지할 뿐, **모집단 자체를 확장하는 수단이 없다**. blueprint §3.3 미구현 항목 그대로 — 사용자가 키워드(예: "열전달")를 입력하면 AI가 관련 키워드를 1차 제안하고, 키워드군으로 DB 미등재 학회를 발굴, 가짜 학회는 사전 필터.

dev-guide-v3 Track E.1로 재분류되었고 Track D(인프라)와 독립 병렬. DB 성장 필요성이 체감되는 시점에 착수.

## 3. 범위 (Scope)

### 포함
- **Stage 1 키워드 확장**: 시드 1~3개 → AI가 10개 연관 키워드 제안 → 사용자 0~7개 선택 (자유 입력 가능)
- **Stage 2 학회 검색**: 선택 키워드(OR) + 기존 학회 배제 리스트 → web_search로 후보 학회 배열
- **Stage 3 검토·승인**: DiscoveryCard로 후보별 승인/거절. 승인 시 마스터 + upcoming edition 동시 생성
- **3중 predatory 안전망**: 도메인 블랙리스트 + AI 자체 판정 + UI 거절 토글
- **discovery 전용 프롬프트 버전 관리** (`promptBuilder.js` `TEMPLATES.discovery_expand`, `TEMPLATES.discovery_search`)
- Header 우측 "🔍 발굴" 버튼 (hasKey=true 시)

### 제외 (Non-goals)
- 발굴 결과의 자동 승인 (반드시 사용자 확인)
- 영구 키워드 사전·태그 시스템 (단발성 세션 입력)
- 분야 다양화 (열유체·건물공조 외 영역까지의 확장은 별 트랙)
- 검색 결과 캐싱 인프라 — 단일 사용자 단계에서는 localStorage TTL 정도만 (선택)
- Sonnet 자동 폴백 — **수동 트리거**만 (DiscoveryCard "심층 보강" 버튼)
- 검색 프롬프트 v2 이상 튜닝·eval 인프라 → **PLAN-012 분리**

## 4. 설계 결정

### 4.1 확정 사항 (사용자 확인 2026-04-18)

| 항목 | 결정 | 근거 |
|---|---|---|
| Sonnet fallback | **수동 트리거** ("심층 보강" 버튼) | 비용 명시적 통제. update의 자동 폴백은 단일 학회 정밀 검색이라 수익성 명확하지만, discovery는 다건이라 자동 폴백 시 비용 폭증 |
| 승인 후 동작 | **마스터 + upcoming edition 동시 생성** | AI가 검색 시점에 발견한 next edition 정보(start/end/venue/link)를 그대로 upcoming으로 저장. 부족분만 추후 update queue로 보강. 한 번에 완성 → 사용자 부담 최소 |
| UI 진입점 | **Header 우측 "🔍 발굴" 버튼** | hasKey=true 시 노출. 기존 UpdatePanel 토글 옆에 자연스레 위치. 라우팅 도입 비용 없음 |
| Predatory 노출 | **점수 + 사유 노출, high는 기본 거절 토글** | 사용자에게 학습 기회 제공. high는 빨간 배경 + 거절 강조, 승인하려면 명시적 클릭 필요 |

### 4.2 데이터 흐름

```
[Header "🔍 발굴"]
   ↓
KeywordExpansion (Stage 1)
   buildDiscoveryExpandPrompt(seedKeywords)
   → callClaude({ model: Haiku, webSearch: false, maxTokens: 512 })
   → parseDiscoveryExpandResponse() → string[]
   ↓ (사용자 0~7개 선택 + 자유 입력)
DiscoveryPanel (Stage 2)
   buildDiscoverySearchPrompt(selectedKeywords, existingConferenceIndex)
   → callClaude({ model: Haiku, webSearch: true, maxWebSearches: 10, maxTokens: 4096 })
   → parseDiscoverySearchResponse() → CandidateConference[]
   → filterClientSideDuplicates(candidates, existingConferences)  // nameMatch + urlMatch
   → enqueue as 'discovery' kind
   ↓
DiscoveryCard (Stage 3, 후보별)
   [승인] → addConferenceFromDiscovery(master, initialEdition)
   [거절] → 로그
   [심층 보강] → 단건 Sonnet 재호출 (수동)
```

### 4.3 비용 정밀 분석

| 단계 | 모델 | 호출당 비용 |
|---|---|---|
| Stage 1 (확장) | Haiku 4.5 (no web_search) | **$0.002 (~₩3)** — 입력 500 + 출력 300 토큰 |
| Stage 2 (검색) | Haiku 4.5 + web_search max=10 | **$0.16 (~₩240)** — 입력 ~42K (검색결과 포함) + 출력 3K + web_search $10/1k×10 |
| Sonnet 심층 (수동) | Sonnet 4.6 + web_fetch | +$0.20/건 (선택) |

**월 추정**: 가벼운 사용 ~$0.7, 적극 사용 ~$3, 광역 캠페인 ~$5. 운영비 대비 **무시 가능 (월 $5 미만)**. dominant cost는 web_search $10/1k 단가 — `max_uses` 캡(5↔10 토글)이 핵심 레버.

### 4.4 3중 predatory 안전망

| 레이어 | 위치 | 동작 |
|---|---|---|
| L1. 도메인 블랙리스트 | `responseParser.js` `BANNED_LINK_DOMAINS` (확장) | hard reject. waset, easychair, omics, scirp, hilarispublisher 등 매칭 시 결과 자체 폐기 |
| L2. AI 자체 판정 | discovery_search 시스템 프롬프트 | publisher·도메인·ISSN 신호로 `predatory_score: 'low'\|'medium'\|'high'` + `predatory_reasons: string[]` 출력 |
| L3. UI 거절 토글 | `DiscoveryCard` + `PredatoryBadge` | high는 빨간 배경 + 기본 거절 강조, medium은 노란 경고, low만 기본 승인 가능 |

휴리스틱(`predatoryScore.js` 클라이언트 보강): 약탈 출판사 매칭(+50), 분야 잡탕(+30), "International Journal of..." 패턴(+20), ISSN/ISBN 명시(-20), IEEE/ASME/Springer/Elsevier(-30). 점수 ≥40 high / 20~39 medium / <20 low.

## 5. 단계 (Steps)

서브플랜 단위로 분리. 각 서브플랜은 독립 PR — 011-A 머지 후에도 사용자 진입점 없으므로 안전.

### 011-A: 프롬프트·파서·단위테스트 (3일)
- [ ] `src/utils/promptBuilder.js` — `TEMPLATES.discovery_expand.v1`, `TEMPLATES.discovery_search.v1` 추가
- [ ] `buildDiscoveryExpandPrompt(seedKeywords)`, `buildDiscoverySearchPrompt(selectedKeywords, existingIndex)` export
- [ ] `src/services/responseParser.js` — `parseDiscoveryExpandResponse(text) → string[]`, `parseDiscoverySearchResponse(text) → CandidateConference[]`
- [ ] `BANNED_LINK_DOMAINS` 확장 (omics, scirp, hilarispublisher, sciencepg 등)
- [ ] 단위테스트: promptBuilder.test.js / responseParser.test.js 신규 케이스
- [ ] 콘솔 시연용 임시 스크립트 (`scripts/discovery-demo.js`) — UI 없이 동작 확인

### 011-B: DiscoveryPanel UI + Stage 1/2 폼 + DiscoveryCard (3일)
- [ ] `src/components/Discovery/DiscoveryPanel.jsx` — Stage 1/2 컨테이너 (모달 또는 드로어)
- [ ] `src/components/Discovery/KeywordExpansion.jsx` — 시드 입력 + 확장 결과 체크박스 + 자유 입력
- [ ] `src/components/Discovery/DiscoveryCard.jsx` — UpdateCard 변형 (마스터 미리보기 + organizer + evidence_url + predatory_score)
- [ ] `src/components/Discovery/PredatoryBadge.jsx` — low/medium/high 배지
- [ ] `src/components/common/Header.jsx` — "🔍 발굴" 버튼 (hasKey 조건)
- [ ] `src/App.jsx` — Discovery 패널 토글 상태

### 011-C: 승인 플로우 + master+edition 생성 + 비용 표시 (2일)
- [ ] `src/hooks/useUpdateQueue.js` 확장 — `kind='discovery'` 분기 (또는 `useDiscoveryQueue.js` 분리)
- [ ] `src/hooks/useConferences.js` — `addConferenceFromDiscovery({ master, initialEdition })` 원자적 추가
- [ ] `conferences[i].source` enum에 `'ai_discovery'` 추가
- [ ] `conferences[i].discovery_meta?` 선택 필드 (seed_keywords, expanded_keywords, predatory_score, found_at) — 감사용
- [ ] `src/config/models.js` — `discovery_expand`, `discovery_search`, `discovery_search_fallback` 모델 키
- [ ] DiscoveryPanel 하단 "이번 세션 비용: $0.XX" 표시 (usage 헤더 누적)

### 011-D: predatoryScore + nameMatch fuzzy 매칭 (2일)
- [ ] `src/utils/nameMatch.js` 신규 — 학회명 정규화 + fuzzy 비교 (Jaro-Winkler 또는 단순 token-set ratio)
- [ ] `src/utils/predatoryScore.js` 신규 — 휴리스틱 점수
- [ ] `filterClientSideDuplicates(candidates, existingConferences)` — nameMatch + urlMatch 결합
- [ ] `nameMatch.test.js` / `predatoryScore.test.js` — 골든 케이스 (ASHRAE Winter ≡ ASHRAE Winter 2026, WASET → high 등)

### 011-E: 사용자 실사용 + 발견된 이슈 정리 (1주, 가벼운 작업)
- [ ] 실 사용 중 qa-backlog 누적
- [ ] 사용성 미세조정
- [ ] 다음 단계(PLAN-012 프롬프트 v2 튜닝) 입력 자료 정리

## 6. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 통과
- [ ] **단위 테스트**:
  - `promptBuilder.test.js` — discovery_expand/search v1 생성, 기존 학회 리스트 포함 여부
  - `responseParser.test.js` — parseDiscoverySearchResponse: 정상/빈 배열/schema_mismatch/predatory 필드 검증
  - `nameMatch.test.js` — "ASHRAE Winter Conference" ≡ "ASHRAE Winter 2026"
  - `predatoryScore.test.js` — WASET·OMICS → high, IEEE → low
- [ ] **통합 시나리오 (수동)**:
  1. 시드 "열전달" → Stage 1 호출 → 10개 키워드 출력
  2. 5개 선택 → Stage 2 → 후보 배열 + 기존 IHTC 등 배제 확인
  3. 후보 1건 승인 → conferences.json 마스터 + upcoming edition 추가, source='ai_discovery'
  4. GitHub commit debounce 작동 확인
  5. WASET 도메인 학회는 후보 배열에 0건 노출 확인
- [ ] **비용 측정**: 실제 호출 1회 기록 → $0.20 이하 확인
- [ ] **prompteng.md 갱신**: §1 현황판에 discovery_search v1 라인 추가, §5 변경 로그
- [ ] **structure.md 갱신**: components/Discovery, hooks/useDiscoveryQueue, utils/nameMatch·predatoryScore 추가
- [ ] **changelog.md 갱신**

## 7. 리스크·롤백

### 리스크
1. **AI hallucination** — 존재하지 않는 학회 생성. 대응: evidence_url 강제 + UI 사용자 확인 + nameMatch fuzzy 재검증
2. **web_search ranking 편향** — P2 패턴(리스팅사이트 우선). 대응: BANNED_LINK_DOMAINS 강화 + 검색 프롬프트 도메인 우선순위 명시
3. **기존 학회 배제 정확도** — 약칭 변형으로 신규 오인. 대응: 클라이언트 측 nameMatch (011-D)
4. **Stage 2 응답 시간** — 30~60초 예상. 대응: 진행 상황 spinner + 중간 결과 streaming은 future work
5. **비용 초과** — `max_uses` 잘못 설정 시 한 세션 $1+. 대응: 코드에 `MAX_DISCOVERY_WEB_SEARCHES = 10` 상수 + 변경 시 PR 리뷰

### 롤백
- 각 서브플랜은 독립 PR → 문제 시 `git revert`
- `conferences[i].source='ai_discovery'` 필터로 발굴 학회만 일괄 제거 가능
- discovery_meta 보유로 어떤 세션·키워드에서 추가됐는지 감사 추적 가능

## 8. 후속 (Follow-ups)

- **PLAN-012**: discovery_search 프롬프트 v2/v3 튜닝 + eval 골든셋 + runner. update v1→v6 진화와 동일 트랙. 본 PLAN-011 머지 후 누적된 실 사용 결과 기반.
- **streaming UI**: Stage 2 응답 30~60초 동안 spinner만 → 부분 결과 progressive 표시
- **결과 캐싱**: 동일 키워드·24h TTL localStorage 캐시 — D.3(서버 도입) 이후 서버 캐시로 이전
- **분야별 시드 라이브러리**: 사용자가 자주 쓰는 키워드 묶음 저장·재호출 UI

## 9. 작업 로그

- 2026-04-18: 블루프린트 작성 완료 (사용자 요청). 4가지 핵심 결정 확정 (Sonnet 수동·동시 생성·Header 버튼·predatory 노출+토글). 서브플랜 011-A~E 분리. PLAN-012는 후속 분리.

---

## 부록 A: Critical Files

| 파일 | 변경 |
|---|---|
| `src/utils/promptBuilder.js` | discovery_expand v1 / discovery_search v1 추가 |
| `src/services/responseParser.js` | parse* 추가, BANNED_LINK_DOMAINS 확장 |
| `src/services/claudeApi.js` | 변경 없음 (기존 callClaude 충분) |
| `src/hooks/useUpdateQueue.js` 또는 `src/hooks/useDiscoveryQueue.js` | discovery kind 큐 |
| `src/hooks/useConferences.js` | addConferenceFromDiscovery 추가 |
| `src/components/Discovery/*` (신규 폴더) | UI 일체 |
| `src/utils/nameMatch.js` (신규) | 학회명 fuzzy 매칭 |
| `src/utils/predatoryScore.js` (신규) | 휴리스틱 점수 |
| `src/components/common/Header.jsx` | 발굴 진입 버튼 |
| `src/App.jsx` | 패널 토글 |
| `src/config/models.js` | discovery 전용 모델 키 |

## 부록 B: 데이터 모델 추가

```jsonc
// conferences[i] (마스터)
{
  "source": "user_input | ai_discovery | seed",  // ai_discovery 신규
  "discovery_meta": {                              // 선택, 감사용
    "seed_keywords": ["열전달"],
    "expanded_keywords": ["heat transfer", "thermal management"],
    "predatory_score": "low",
    "predatory_reasons": ["IEEE published"],
    "found_at": "2026-04-18T..."
  }
}
```

editions 모델 변경 없음.
