# PLAN-021: promptBuilder 도메인별 분리 — 684 → ~450줄

> **상태**: active
> **생성일**: 2026-04-21
> **브랜치**: `feature/PLAN-021-promptbuilder-split`
> **트랙**: G.2 (리팩토링, dev-guide-v3 §2)

---

## 1. 목표 (What)

`src/utils/promptBuilder.js` (684줄, critical) 를 도메인별 모듈로 분리. 공개 API (`buildUpdatePrompt` 등) 는 **불변**, import 경로 변경 없음. 단일 파일 ~100줄 shell + 5개 모듈(~80~200줄) 로 재구성.

## 2. 배경·동기 (Why)

- `bash scripts/refactor-check.sh` critical 1건: `promptBuilder.js 684 줄`
- v1_2·discovery v2 추가 시 더 비대화 예상
- 프롬프트 버전 수정 시 전체 파일 스크롤 부담
- `docs/prompts/v*.md` 동기화 테스트(`promptBuilder.sync.test.js`) 는 `__TEMPLATES_FOR_TEST` re-export 만 유지하면 그대로 작동

## 3. 범위

### 포함
- `src/utils/prompts/` 하위 5개 모듈 신설 (shared·update·verify·lastEdition·discovery)
- `promptBuilder.js` 를 얇은 shell 로 축소 (TEMPLATES + 공개 API + re-export)
- 동기화 테스트(`__TEMPLATES_FOR_TEST`) 는 import 구조만 바뀌고 로직 불변
- `V1_1_VARS` 튜닝 상수는 `prompts/update.js` 최상단으로 이동 (사용자 조정 포인트 명시)

### 제외
- 프롬프트 **내용** 변경 (단 1줄도 수정 안 함)
- md 파일 포맷 변경
- `docs/prompts/` 외부 재생성 스크립트 신설
- 동기화 테스트 로직 재설계

## 4. 설계 결정

### 4.1 파일 구조
```
src/utils/promptBuilder.js           (~110줄) shell
src/utils/prompts/
  ├ shared.js                        (~45줄) 공용 helper + BANNED_LIST_INLINE
  ├ update.js                        (~220줄) V1_1_VARS + v1_0·v1_1 system + builders
  ├ verify.js                        (~50줄) v1 system + builder
  ├ lastEdition.js                   (~80줄) v1 system + builder
  └ discovery.js                     (~130줄) expand v1 + search v1
```

### 4.2 공개 API 불변
- 기존 consumer: `useUpdateQueue.js`, `DiscoveryPanel.jsx`, `promptBuilder.test.js`, `promptBuilder.sync.test.js`
- promptBuilder.js 가 계속 `buildUpdatePrompt / buildVerifyPrompt / buildDiscoveryExpandPrompt / buildDiscoverySearchPrompt / buildLastEditionPrompt / DEFAULT_*_VERSION / __TEMPLATES_FOR_TEST` export
- import 경로 변경 없음 → consumer 0줄 수정

### 4.3 내부 구성: TEMPLATES 레지스트리
- `promptBuilder.js` 가 5개 모듈의 `SYSTEM + builder` 를 import 해 `TEMPLATES = { update, verify, discovery_expand, discovery_search, last_edition }` 조립
- 레지스트리 구조 유지 → 테스트 dependency injection pattern 불변

## 5. 단계

- [x] Step 1 — 브랜치 생성 + PLAN 문서
- [x] Step 2 — `prompts/shared.js` 생성 (helper 이동)
- [x] Step 3 — `prompts/update.js` 생성 (V1_1_VARS + v1_0 + v1_1)
- [x] Step 4 — `prompts/verify.js`·`lastEdition.js`·`discovery.js` 생성
- [x] Step 5 — `promptBuilder.js` 슬림화 (re-export shell)
- [x] Step 6 — `bash scripts/verify-task.sh` 5/5 통과 (sync test 특히)
- [ ] Step 7 — commit + push + PR

## 6. 검증

- [x] `promptBuilder.js` 줄 수 < 150 → 91줄
- [x] 모든 개별 파일 < 300 줄 → update 292 / discovery 142 / lastEdition 74 / shared 43 / verify 41
- [x] `promptBuilder.sync.test.js` 통과 (v1_0 · v1_1 strict equal)
- [x] `promptBuilder.test.js` 361+ 테스트 통과 → 364 passed
- [x] `bash scripts/refactor-check.sh` 에서 `promptBuilder.js` critical 제거 → critical 0
- [x] consumer (`useUpdateQueue`, `DiscoveryPanel`) 수정 없이 빌드·테스트 통과

## 7. 리스크·롤백

**리스크**:
- import 순서 변경 시 circular dependency 가능성 → shared.js 만 다른 모듈을 import 안 하도록 설계
- 동기화 테스트 drift → Step 6 에서 per-version 확인
- 프롬프트 내용 실수 변경 (공백·줄바꿈) → 원본 복사 방식으로 리스크 최소화

**롤백**:
- 작업이 모두 브랜치 내 → PR 거부 시 브랜치 폐기로 롤백
- 부분 문제 시 `git checkout main -- src/utils/promptBuilder.js` 로 원복

## 8. 후속

- G.1 PLAN-020 useUpdateQueue last-edition 추출 (278 → 250줄)
- G.3 PLAN-022 responseParser BaseParser 추출 (305 → 250줄)
- G.4 PLAN-023 DiscoveryPanel 상태 분해 (14 useState)

## 9. 작업 로그

- 2026-04-21: 착수. refactor-check 결과 critical 1 + warning 5, promptBuilder.js 가 유일한 critical. PLAN-027 (roadmap) merged 후 곁가지 정리로 우선 처리.
- 2026-04-21: Step 2~6 완료. `src/utils/prompts/{shared,update,verify,lastEdition,discovery}.js` 5개 모듈 신설, promptBuilder.js 684 → 91줄 shell. 템플릿 문자열 character-exact 유지 → sync test (v1_0·v1_1 strict equal) 통과. verify-task.sh 5/5 통과 (364 tests), refactor-check critical 0.
