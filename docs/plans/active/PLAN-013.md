# PLAN-013: Update 시스템 대대적 재설계 (F.1 Phase 2)

> **상태**: A·B1·B2·C·D 구현 완료 · 통합 PR 대기 · eval(#E) 잔여
> **생성일**: 2026-04-20
> **완료일**: — (eval 이후 확정)
> **브랜치**: 서브플랜별 분리 — `feature/PLAN-013-A-anchor`(d950a5c), `feature/PLAN-013-B1-url-classifier`(c708ee3), `feature/PLAN-013-B2-should-search`(689cada), `feature/PLAN-013-C-prompt-v7`(3ac3242), `feature/PLAN-013-D-last-discovery`(b3f461f). 통합: `feature/PLAN-013-integration` (90feb99 → 34dbb9b → a1b201b → d8ac648 → 962dd31, 326 tests 통과)
> **연관 PR**: TBD (단일 통합 PR 로 머지 예정)
> **트랙**: F (운영 품질) — F.1 Phase 2

---

## 1. 목표 (What)

Update 시스템의 두 가지 근본 문제를 동시에 해결한다:

1. **Last 정보 활용 부재** — past edition 의 `link` 가 DB 에 있어도 update 프롬프트에 주입 안 되고, last 자체가 없으면 발굴 시도조차 안 함
2. **Update 대상 선별이 source 단일축에 의존** — `updateLogic.shouldSearch()` 가 `source !== 'ai_search'` 만 보아 user_input 무조건 재검색·신뢰도 낮은 link 무조건 pass 하는 오류

완료 시 정량 목표:
- 29 학회 일반 모드 update 시 검색 호출 횟수 baseline 대비 **30% 이상 감소**
- 사용자 anchored upcoming 은 어떤 모드에서도 100% skip
- v7 (last URL 활용) 의 confidence=high 비율이 v6 대비 **+10%p** 이상

## 2. 배경·동기 (Why)

- F.1 Phase 1 (PR #21, 2026-04-19) 으로 past edition 28건 backfill 완료 — 29 학회 전수 last 보유. 이 자산을 활용할 시점.
- 사용자 관찰 사례:
  - 수동 입력 정보를 AI 가 다시 검색해 더 틀린 결과로 덮어쓸 위험 (user_input 무조건 재검색의 폐해)
  - 4년 주기 학회를 3년 전부터 매 update 마다 재검색 — 무의미 비용
  - `source='ai_search'` 면 link 가 뉴스 기사여도 pass 되어 정확도 저하
- v6 활성 전환 차단 (conf_012/015 회귀) 도 별도 진단 대신 v7 신설 + eval 비교로 함께 해결

근거: `docs/dev-guide-v3.md` §3 Track F.1, 사용자 대화 (2026-04-20).

## 3. 범위 (Scope)

### 포함

**A — Edition anchor + UI 토글** (`feature/PLAN-013-A-anchor`)
- `editions[]` 객체에 `anchored: boolean`, `anchor_set_at: string` 추가
- `shouldSearch()` 첫 단락에 `if (u.anchored) return false`
- `useConferences.upsertEdition` anchor 필드 보존
- UpdateCard accept 시 앵커 토글, EditionSection 앵커 체크박스
- 기존 conferences.json 마이그레이션 (모든 upcoming `anchored: false`)
- upcoming → past 자동 전환 시 anchor 자동 해제

**B Phase 1 — urlClassifier 유틸 + dateUtils 확장** (`feature/PLAN-013-B1-url-classifier`)
- `src/utils/urlClassifier.js` 신규: `classifyUrlTrust(url, conference)` → `{ type, trust }`
- `src/utils/dateUtils.js`: `daysUntil`, `cycleProgress` 추가
- 단위 테스트

**B Phase 2 — shouldSearch 재설계 + 정밀/일반 모드** (`feature/PLAN-013-B2-should-search`)
- `updateLogic.shouldSearch(row, mode)` 전면 재작성 (앵커 + URL 신뢰도 + 주기 임계값)
- `filterSearchTargets(rows, mode)` mode 파라미터 추가
- 전체 업데이트 클릭 시 정밀/일반 모달 추가 (App.jsx + MainTable.jsx)

**C — Prompt v7 + Last URL 활용** (`feature/PLAN-013-C-prompt-v7`)
- `formatLastEdition` link 노출 (현재 비대칭 해소)
- v7 system + user 프롬프트 추가 (시리즈 도메인 패턴 추정 + web_fetch 우선 지시)
- dedicated_url 필드 사용 중단 (DB 미보유 → dead code 정리)

**D — Last 자동 발굴** (`feature/PLAN-013-D-last-discovery`)
- `buildLastEditionPrompt(conference)` 추가
- `useUpdateQueue` 검색 루프에 last 사전 발굴 분기 (last 없을 때만)
- past edition 으로 저장 후 동일 사이클에서 upcoming 검색에 활용

**eval — v6 vs v7** (PR 별도)
- 골든셋 1회 실행, confidence·link·start_date 정확도 비교
- DEFAULT_UPDATE_VERSION 결정

### 제외 (Non-goals)
- 신규 학회 발굴 (E.1 PLAN-011) — 별도 트랙
- F.3 Playwright E2E — 별도 트랙
- prompt v8+ 추가 fine-tuning — 후속
- "upcoming → past 직전 알림" UX — 후속

## 4. 설계 결정

- **앵커는 edition 레벨**: conference 마스터 아닌 edition 에 둔다. 회차마다 사용자 확정 의사가 다를 수 있고, 회차 종료 시 자동 해제가 자연스럽다.
- **mode 기본값 'general'**: 사용자가 명시 선택 안 하면 일반 모드 — 비용 절약 우선. 정밀 모드는 의도된 행동일 때만.
- **앵커 vs 정밀 모드의 우선순위**: 정밀 모드가 모든 것을 빡세게 재검색하지만 **앵커는 정밀 모드에서도 보호**. 사용자 명시 의사 > 자동 모드 결정.
- **last 자동 발굴 항상 활성**: 비용 분석 결과 호출 2배 아님. last 없는 학회는 신규 추가 직후 1회만 발생, 이후 시리즈 패턴 힌트로 upcoming 검색이 단축돼 케이스별 동일~약간 증가 수준.
- **v6 회귀 분석 별도 단계 생략**: version 트래킹 부담 최소화. v6 vs v7 eval 1회로 활성 결정.
- **dedicated_url 제거**: v5/v6 이 받지만 conference 스키마 미존재 → 사실상 dead code. v7 에서 제거.

## 5. 단계

- [x] Step A — Edition anchor + UI 토글 (`feature/PLAN-013-A-anchor` d950a5c)
- [x] Step B1 — urlClassifier + dateUtils (`feature/PLAN-013-B1-url-classifier` c708ee3)
- [x] Step B2 — shouldSearch 재설계 + 정밀/일반 모드 (`feature/PLAN-013-B2-should-search` 689cada)
- [x] Step C — Prompt v7 + Last URL 노출 (`feature/PLAN-013-C-prompt-v7` 3ac3242)
- [x] Step D — Last 자동 발굴 (`feature/PLAN-013-D-last-discovery` b3f461f)
- [ ] Step E — v6 vs v7 eval + DEFAULT_VERSION 결정 (별도 PR, C·D 의존)

구현 경로: 계획상 5개 독립 PR 이었으나 실제로는 5개 branch 를 단일 통합 PR 로 머지 — 브랜치 stacking 없이 각자 main 에서 분기된 상태여서 일괄 검토가 더 안전. Step E 는 API 비용 발생 작업이므로 별도 세션/PR.

## 6. 검증

**전체 완료 조건**:
- [ ] `bash scripts/verify-task.sh` 각 PR 통과
- [ ] 신규 테스트:
  - `urlClassifier.test.js` (사례별 분류 정확도)
  - `dateUtils.test.js` 확장 (daysUntil, cycleProgress)
  - `updateLogic.test.js` 확장 (앵커, mode, 주기·신뢰도 매트릭스)
  - `promptBuilder.test.js` 확장 (v7 link 노출, last 발굴 프롬프트)
- [ ] 통합 검증:
  - 29 학회 일반 모드 → 검색 호출 횟수 baseline 대비 -30% 달성
  - 정밀 모드 → 앵커 외 모든 학회 검색
  - 앵커 학회 → 어떤 모드에서도 skip
- [ ] `prompteng.md` §5 갱신 (v7 항목 + eval 결과)
- [ ] `docs/dev-guide-v3.md` F.1 Phase 2 체크박스 갱신
- [ ] `docs/changelog.md` 기능 추가 항목

## 7. 리스크·롤백

- **중**: shouldSearch 재설계 로직 오류 시 모든 학회 매번 검색 (비용 폭증) 또는 모두 skip (정보 갱신 중단). 단위 테스트 매트릭스로 1차 방어. 롤백: PR revert.
- **중**: v7 회귀로 v6 대비 정확도 하락 가능. eval 결과로 DEFAULT 승격 보류 가능 (v7 코드 유지하되 활성 안 함).
- **저**: anchor 필드 마이그레이션 누락 → 기존 edition 들 `undefined` 로 처리. `shouldSearch` 에서 `u?.anchored` falsy 처리로 안전.
- **저**: last 자동 발굴 추가 호출이 GitHub commit rate-limit 영향 — past edition 1건 추가 저장만 발생, 영향 미미.

## 8. 후속 (Follow-ups)

- v7 eval 후 v8+ fine-tuning (Track E.4 PLAN-012)
- F.2 prompt log analyzer (eval 10회+ 축적 시점)
- "앵커 만료 임박 알림" UI (회차 종료 1주 전 사용자 환기)
- 정밀 모드 비용 사전 표시 (예상 검색 횟수·달러)

## 9. 작업 로그

- 2026-04-20: 플랜 수립. 사용자 승인. PLAN-013-A 부터 착수.
- 2026-04-20: A·B1·B2·C·D 5개 서브플랜 구현 완료. 각 verify-task 통과.
  - A (d950a5c): anchor 스키마 + UI 토글
  - B1 (c708ee3): urlClassifier + daysUntil/cycleProgress — 19 + 16 단위 테스트
  - B2 (689cada): shouldSearch(row, mode) 전면 재작성 + 정밀/일반 모달
  - C (3ac3242): update v7 — formatLastEditionV2 + URL 패턴 추정, dedicated_url 제거. DEFAULT_UPDATE_VERSION 은 여전히 v4 (eval 후 결정)
  - D (b3f461f): buildLastEditionPrompt + parseLastEditionResponse + applyLastDiscovery + useUpdateQueue 선행 호출 분기
- 2026-04-20: 5 branch 단일 통합 PR 생성·머지. Step E(eval) 잔여 — 별도 세션에서 API 호출로 진행 예정.
