# PLAN-016: eval-prompt.js XLSX 입력 + 필드별 채점 (PR-3)

> **상태**: active
> **생성일**: 2026-04-20
> **브랜치**: `feature/PLAN-016-eval-scoring`
> **연관 PR**: TBD (PR-2 `feature/PLAN-015-golden-xlsx` 위에 스택)
> **트랙**: F.2 프롬프트 평가 체계화 · PR-3

---

## 1. 목표 (What)

`scripts/eval-prompt.js` 를 XLSX 입력 + 4필드 가중 채점으로 개편.

완료 시:
- `scripts/eval-common.js` — scoring · results v1/v2 reader · weights 파서 (공용 유틸).
- `scripts/eval-prompt.js` — `docs/eval/golden-set.xlsx` 직접 읽음. link-only → link/start/end/venue 4필드 채점. `cycle_years` 를 case 결과에 포함.
- `--weights link=0.5,start=0.3,end=0.1,venue=0.1` 플래그 지원.
- results 스키마 v1 → v2 bump. meta.schema_version 필드.
- 신규 테스트: eval-common.test.js (scoring·weights·reader).

## 2. 배경·동기 (Why)

상위 플랜 `C:\Users\jerom\.claude\plans\prompt-v6-breezy-lollipop.md` §핵심 작업 4.

현재 문제:
- 채점이 link 단일 필드라 upcoming_start 미추출도 `partial` 하나로만 구분됨 → 어느 필드가 약한지 알 수 없음.
- 사용자의 "주기 1년 vs 4년 학회 느낌 다르다" 질문에 답하려면 `cycle_years` 가 결과에 있어야 버킷 분석 가능.
- CSV 의존 구조라 PR-2 의 XLSX 전환 혜택을 못 받음.

## 3. 범위 (Scope)

### 포함
- 신규: `scripts/eval-common.js`, `scripts/eval-common.test.js`.
- 수정: `scripts/eval-prompt.js` — XLSX 입력 + 필드별 채점 + v2 스키마.
- 수정: `docs/eval/README.md` — 채점 로직 섹션 갱신.

### 제외 (Non-goals)
- eval-loop (PR-4).
- Skill / prompteng.md 갱신 (PR-5).
- legacy CSV/JSON 완전 삭제 — scripts/legacy/ 에서 참조 가능하게 유지.

## 4. 설계 결정

- **eval-common.js 순수 유틸**: `scoreCase(goldenCase, aiData, weights)` · `parseWeights(arg)` · `readResults(path)`. 테스트 가능성 최우선.
- **4필드 채점**:
  - `link`: 기존 urlMatch (upcoming_link ↔ source_url 을 candidate 로). pass/fail.
  - `start`/`end`: 문자열 equality (YYYY-MM-DD). pass/fail.
  - `venue`: case-insensitive 첫 토큰(쉼표 앞) equality. "Chicago, USA" vs "Chicago" pass. pass/fail.
- **expected 가 빈 값이면 해당 필드 제외** + 남은 필드로 가중치 재분배 (N/A 처리). 골든셋이 start_date 불명인 케이스도 link 채점은 가능.
- **Status 매핑**:
  - score >= 0.9 → `pass`
  - 0.5 <= score < 0.9 → `partial`
  - score < 0.5 → `fail`
- **가중치 기본값**: `link=0.6, start=0.2, end=0.1, venue=0.1`. `--weights` 플래그로 덮어쓰기.
- **입력 경로**: `docs/eval/golden-set.xlsx` 직접 읽음 (goldenSheet.parseWorkbook). parsed.json 은 참조용, 필수 아님.
- **결과 스키마 v2**: `meta.schema_version: 2`, 각 case 에 `fields: {link, start, end, venue}`, `score`, `cycle_years`. v1 호환: reader 가 schema_version 없으면 v1 로 취급.

## 5. 단계

- [ ] Step 1 — `scripts/eval-common.js` 작성 (scoreCase, parseWeights, readResults)
- [ ] Step 2 — `scripts/eval-common.test.js` 작성 (단위 테스트)
- [ ] Step 3 — `scripts/eval-prompt.js` 개편 (XLSX 입력 + 필드별 채점 + v2)
- [ ] Step 4 — `docs/eval/README.md` 채점 섹션 갱신
- [ ] Step 5 — `bash scripts/verify-task.sh` 통과
- [ ] Step 6 — 커밋 + PR

## 6. 검증

- [ ] `bash scripts/verify-task.sh` 전항목 통과
- [ ] `eval-common.test.js` — scoring 정상 케이스 + expected 빈 값 분배 + weights 파서
- [ ] 수동 (API 키 필요, 선택): `ANTHROPIC_API_KEY=... npm run eval -- --case conf_001` → 결과 JSON 에 v2 스키마 + cycle_years 확인

## 7. 리스크·롤백

- **저**: venue 토큰 매칭이 너무 엄격/느슨. 완화: 첫 쉼표 앞 토큰 비교로 시작, 필요 시 tier 확장.
- **저**: 가중치 재분배 로직 버그. 완화: 단위 테스트로 expected 0/1/2/3 개 케이스 전부 커버.
- 롤백: PR revert.

## 8. 후속

- PR-4: eval-loop.js (early-stop 래퍼).
- PR-5: Skill + prompteng.md §6 패턴 카탈로그 갱신.

## 9. 작업 로그

- 2026-04-20: PR-2 (PLAN-015) 로컬 완료 (8fa114c). PR-3 착수.
