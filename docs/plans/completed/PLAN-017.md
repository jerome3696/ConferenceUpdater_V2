# PLAN-017: eval-loop.js early-stop 래퍼 (PR-4)

> **상태**: completed
> **생성일**: 2026-04-20
> **완료일**: 2026-04-20
> **브랜치**: `feature/PLAN-017-eval-loop`
> **연관 PR**: #24 (일괄 머지 e925a66 / 개별 커밋 41df95c)
> **트랙**: F.2 프롬프트 평가 체계화 · PR-4

---

## 1. 목표 (What)

`eval-prompt.js` 를 N회 반복 호출하며 노이즈를 걷어내는 얇은 wrapper.

완료 시:
- `scripts/eval-loop.js` — `npm run eval:loop -- --version v7 --max-iter 3 --threshold 0.9` 호출.
- 3종 조기 종료: `success` · `plateau` · `max_iter`.
- `docs/eval/runs/<run-id>/run.json` — iterations · persistent_failures · cycle_years 집계.
- `package.json`: `eval:loop` script 추가.
- 신규 테스트: `eval-loop.test.js` — 종료 로직 3종 + persistent_failures 계산.

## 2. 배경·동기 (Why)

상위 플랜 §핵심 작업 5. 현재 `eval-prompt.js` 한 번 실행 = 1 iteration. 웹검색/LLM 노이즈로 인한 변동이 있는데, "진짜 프롬프트 약점" vs "운 나쁜 한 번" 을 구분하려면 반복이 필수. 수동으로 3번 돌리면 파일 3개 관리·합산 번거로움.

사용자 결정: **한 루프 동안 프롬프트 고정** (튜닝 금지). 재시도는 노이즈 제거 목적.

## 3. 범위

### 포함
- `scripts/eval-loop.js` + export 유틸.
- `scripts/eval-loop.test.js` — decideStop + mergeFailIds 단위 테스트.
- `scripts/eval-prompt.js` — `--out` 플래그 추가 (loop 가 결과 파일 경로 제어).
- `package.json` — `"eval:loop"` script.

### 제외
- Skill (PR-5).
- Results 비교 대시보드·html 리포트.

## 4. 설계 결정

- **Thin wrapper**: 각 iteration 은 `spawnSync(node, [eval-prompt.js, ...args])` 로 별도 프로세스. 프롬프트·API 호출은 eval-prompt 에 위임.
- **종료 조건 (순차 체크)**:
  1. `success`: `pass / total >= threshold` AND `partial + fail_or_error <= 1`
  2. `plateau`: 직전 iter 와 pass 수 동일 AND fail_ids 집합 동일
  3. `max_iter`: 도달
- **persistent_failures**: 모든 iteration 에서 fail/partial/api_error/parse_fail 이었던 id 의 교집합. (한 번이라도 pass 한 id 는 제외 → 진짜 구조적 실패만 남김)
- **run_id**: `YYYYMMDD-HHmmss` 포맷, `--run-id` 로 덮어쓰기.
- **결과 위치**: `docs/eval/runs/<run_id>/run.json` + 각 iter 의 results JSON 은 `docs/eval/runs/<run_id>/iter-<n>.json` 에 저장 (eval-prompt 의 `--out` 플래그 사용).
- **Weights 전달**: `--weights` 를 그대로 eval-prompt 에 pass-through.

## 5. 단계

- [ ] Step 1 — `scripts/eval-prompt.js` 에 `--out` 플래그 추가
- [ ] Step 2 — `scripts/eval-loop.js` 작성 (decideStop · mergeFailIds · main)
- [ ] Step 3 — `scripts/eval-loop.test.js` 작성
- [ ] Step 4 — `package.json` script 추가
- [ ] Step 5 — verify-task.sh
- [ ] Step 6 — 커밋 + PR

## 6. 검증

- [ ] `bash scripts/verify-task.sh` 전항목 통과
- [ ] `eval-loop.test.js` — success / plateau / max_iter 3종 + mergeFailIds (교집합)
- [ ] 수동 (선택): `ANTHROPIC_API_KEY=... npm run eval:loop -- --version v7 --max-iter 2 --threshold 0.8 --case conf_006` → runs/ 에 파일 생성 확인

## 7. 리스크·롤백

- **저**: plateau 판정이 너무 공격적이라 2 iter 만에 조기 종료. 완화: `--min-iter` 플래그 기본 2, threshold 미도달 시 plateau 체크 스킵 가능.
- **저**: subprocess 환경변수 전달 누락 (ANTHROPIC_API_KEY). 완화: `spawnSync` 는 기본 env 상속.
- 롤백: PR revert.

## 8. 후속

- PR-5: Skill + 문서.

## 9. 작업 로그

- 2026-04-20: PR-3 (PLAN-016) 로컬 완료 (56570cb). PR-4 착수.
