# PLAN-005: ICCFD·Cryogenics 품질 대응 — Sonnet+web_fetch 재시도 + eval 3-tier

> **상태**: active
> **생성일**: 2026-04-18
> **브랜치**: `feature/PLAN-005-iccfd-cryogenics-fix`
> **트랙**: B (코드 품질)

---

## 1. 목표 (What)

- conf_006 IIR Cryogenics: 브라우저 실행 시 start_date=2027-04-26 / venue=Dresden 정상 추출
- conf_015 ICCFD: 브라우저 실행 시 start_date=2026-07-06 / venue=Milan 정상 추출 (Sonnet 재시도로)
- eval: URL 매칭만 보던 pass/fail → **pass/partial/fail 3-tier**. partial=URL 맞지만 start_date null

## 2. 배경·동기 (Why)

2026-04-18 브라우저 테스트에서 발견한 2건의 품질 실패:
1. **conf_006** `official_url`이 v4 프롬프트의 금지 도메인(`iifiir.org/en/iir-conferences-series`)으로 등록되어 있음. 전용 사이트 `cryogenics-conference.eu`는 2027-04-26 일정을 평문 공개하지만 AI 발굴 실패.
2. **conf_015** `official_url=iccfd.org`는 정상. 홈페이지 평문 "July 6–10, 2026 Milan, ITALY" 존재. 자체 WebFetch로는 추출 가능하나 Haiku의 `web_search` 요약 경로에서는 날짜 누락.

**숨은 배경**: v4 eval 19/19 pass였으나 `scoreUrl`이 URL만 확인하여 두 건 모두 실제로는 start_date=null인데 pass 기록됨. 측정 기반이 착시.

## 3. 범위 (Scope)

### 포함
- Part 1: conf_006 `official_url` 교체 + golden-set 갱신
- Part 2: `scripts/eval-prompt.js` scoreUrl 3-tier 채점
- Part 3-a: `MODELS.updateFallback = 'claude-sonnet-4-6'`
- Part 3-b: `claudeApi.js` `webFetch: boolean` 파라미터 → `web_fetch_20250910` 툴 추가
- Part 3-c: `useUpdateQueue.js` Haiku 결과 start_date null → Sonnet+web_fetch 1회 재시도
- Part 3-d: `promptBuilder.js` v5 신규 (v4 + `dedicated_url` 힌트 주입) + conf_015 dedicated_url 등록

### 제외 (Non-goals)
- DEFAULT_UPDATE_VERSION = v5 활성 전환 (v5 측정 후 별도 세션·플랜)
- 레버 E (임박 학회 공식사이트 재검증) — 별도 과제
- verify 모델 변경 (sonnet-4.6 업그레이드는 별건)
- eval 실제 재실행·측정 (코드 기반 준비만, 실제 측정은 사용자 실행 권한)

## 4. 설계 결정

- **A1 vs A2 중 A2**: update 전체 Sonnet 교체는 비용 ~3x. 대부분 Haiku로 성공하므로 실패 케이스만 Sonnet 재시도. 재시도 시점에 web_fetch까지 동봉.
- **v5 신규 (v4 수정 금지)**: prompteng.md §2 원칙 — 이전 버전 불변. dedicated_url 주입은 프롬프트 구조 변화 → v5.
- **conf_006 dedicated_url 불요**: official_url 자체를 전용 사이트로 교체하므로 중복 힌트 불필요.
- **재시도 1회 제한**: 비용 폭주 방지. 2차도 null이면 그대로 승인 대기 큐.
- **재시도 트리거는 start_date 단독**: link 유무 무관. start_date=null이면 실질적으로 데이터 무가치.
- **verify 모델은 건드리지 않음**: `MODELS.verify`는 정합성 검증용 별도 경로.

## 5. 단계 (Steps)

- [ ] Step 1 — Part 1: conf_006 official_url 교체, golden-set.csv 갱신, csv-to-golden.js 재생성
- [ ] Step 2 — Part 2: eval-prompt.js scoreUrl 3-tier 채점 + 요약 집계
- [ ] Step 3 — Part 3-a: models.js updateFallback 상수
- [ ] Step 4 — Part 3-b: claudeApi.js webFetch 옵션
- [ ] Step 5 — Part 3-c: useUpdateQueue.js Sonnet 재시도 블록
- [ ] Step 6 — Part 3-d: promptBuilder.js v5 + conf_015 dedicated_url
- [ ] Step 7 — 단위 테스트: useUpdateQueue 재시도 시나리오, promptBuilder v5 힌트 주입
- [ ] Step 8 — prompteng.md (§1·§3·§5·§6) + changelog.md 갱신
- [ ] Step 9 — verify-task 통과, 커밋, PR

## 6. 검증 (Verification)

- [ ] `bash scripts/verify-task.sh` 전항목 PASS (lint, test, build, secrets, 500줄)
- [ ] 신규 테스트: useUpdateQueue — Haiku 성공 응답 시 재시도 없음 / Haiku start_date=null 시 Sonnet 호출 발생 / 재시도 1회 한정
- [ ] 신규 테스트: promptBuilder v5 — dedicated_url 있으면 user 프롬프트에 힌트 줄 포함, 없으면 v4와 동일 구조
- [ ] 수동 (별도): `ANTHROPIC_API_KEY=... npm run eval -- --version v4` → pass/partial/fail 3-tier 분해 출력 확인
- [ ] 수동 (별도): `npm run eval -- --version v5` → partial 0 목표
- [ ] 수동 (브라우저): conf_006 [업데이트] → 2027-04-26 추출 / conf_015 [업데이트] → 로그에 `[retry:sonnet]` + 2026-07-06 추출
- [ ] `prompteng.md` §1 현황판·§5 v5 entry·§6 P5/P6 상태 갱신
- [ ] `changelog.md` 항목 추가

## 7. 리스크·롤백

- **비용 급증**: Sonnet 재시도 무한 루프 방지 — 1회 제한 테스트 필수.
- **web_fetch 호환성**: Sonnet 4.6 한정 지원. Haiku 경로에 실수로 webFetch:true 넘기면 API 에러. 호출부 규율로 방어 (기본값 false).
- **v5 비활성 유지**: DEFAULT가 v4인 동안 v5 코드는 휴면. 사용자가 v5 활성 전환 승인 전까지 무해.
- **롤백**: conf_006 URL 되돌리기 / 재시도 블록 제거 / claudeApi webFetch 분기 제거. 모두 국소 변경.

## 8. 후속 (Follow-ups)

- v5 eval 실측 후 DEFAULT_UPDATE_VERSION=v5 활성 전환 (별도 세션, 결과 기반 판단)
- 레버 E (임박 학회 공식사이트 재검증) — `updateLogic.shouldSearch` 확장
- Sonnet 재시도 실제 호출 빈도 1주 운영 후 리뷰 (비용 모니터링)
- verify 모델의 sonnet 버전 업그레이드 고려 (별건)

## 9. 작업 로그

- 2026-04-18: 플랜 작성. 세션에서 conf_006·conf_015 브라우저 실패 관찰 → eval 착시 확인 → A2+C 전략 확정.
