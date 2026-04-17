# 학회 DB 관리 웹앱 — 개발 가이드 v2

> **문서 버전**: v2.0  
> **최종 수정일**: 2026-04-17  
> **목적**: Post-MVP 체계화 + 기능 확장 실행 가이드. dev-guide v1(MVP)의 후속.  
> **배경 자료**: `docs/reference/HARNESS_MASTER.md` (하네스 원칙, MVP 평가, 논의 기록)

---

## 1. 목표 선언

MVP v1.0.0이 완료된 시점에서 다음 3가지를 병렬로 달성한다:

1. **체계화** — 문서 재편, 하네스 뼈대(CI/테스트/hook), 워크플로우 격리
2. **코드 품질** — 리팩토링, 프롬프트 개선, 테스트 커버리지 확대
3. **기능 확장** — 멀티유저, 학회 검색, 기타 신규 기능

**원칙**: Track A(체계화)가 최소 완료된 후에 Track C(기능 확장) 시작. Track B(코드 품질)는 상시 병행.

---

## 2. 문서 구조 (v2 확정)

```
docs/
├── blueprint.md          ← 기능 정의 (What): 구현됨 / 미구현
├── structure.md           ← 코드 구조 (How): 파일 맵, 의존 관계
├── design.md              ← UI/디자인 결정 로그
├── prompteng.md           ← 프롬프트 전략 + 실행 로그 통합
├── changelog.md           ← 버전별 변경 이력
├── dev-guide-v2.md        ← 이 파일
├── qa-backlog.md          ← 사용 중 관찰 이슈 축적
├── eval/                  ← 골든셋, 결과 JSON
├── plans/
│   ├── active/            ← 진행 중 플랜 (PLAN-xxx.md)
│   └── completed/         ← 완료된 플랜
├── reference/             ← 사람용 레퍼런스
│   └── HARNESS_MASTER.md
└── legacy/                ← 역할 끝난 문서
    ├── dev-guide.md
    ├── rate_limit_strategy.md
    ├── PROMPT_LOG.md
    └── PROMPT_STRATEGY.md
```

---

## 3. Track A: 체계화

**목표**: "프롬프트에만 존재하는 규칙"을 "코드로 강제하는 규칙"으로 전환.

### Step A.1: docs 재편
- [x] `docs/legacy/` 폴더 생성
- [x] `docs/rate_limit_strategy.md` → `docs/legacy/` 이동
- [x] `docs/dev-guide.md` → `docs/legacy/` 이동
- [x] `docs/PROMPT_LOG.md` + `docs/PROMPT_STRATEGY.md` → `docs/prompteng.md`로 통합 후 원본은 `docs/legacy/` 이동
- [x] `docs/qa-backlog.md` 생성 (빈 템플릿)
- [x] `docs/plans/active/`, `docs/plans/completed/` 폴더 생성
- [x] `docs/plans/TEMPLATE.md` 생성 (플랜 문서 템플릿)
- [x] CLAUDE.md "필수 참조 문서" 섹션을 v2 구조로 갱신
- **확인**: `docs/` 구조가 §2와 일치하는가? → ✅ 일치 (2026-04-17)

### Step A.2: Husky + lint-staged 설치
- [x] `npm install -D husky lint-staged` (husky 9.1.7 + lint-staged 16.4.0)
- [x] `npx husky init` (`.husky/pre-commit` + package.json `prepare` 스크립트 자동 추가)
- [x] ESLint 설정 확인 — 이미 flat config 존재. **현 25 errors 사전 정리**: scripts/에 node globals 추가, `react-hooks/set-state-in-effect`·`react-hooks/purity`·`react-refresh/only-export-components` warn으로 완화 (24건 cleanup은 qa-backlog 이관), unused vars 2건 실제 제거
- [x] `.husky/pre-commit` 작성: `bash scripts/check-secrets.sh && npx lint-staged`
- [x] `package.json`에 lint-staged 설정 추가 (`{src,scripts}/**/*.{js,jsx}: eslint --fix`)
- [x] `scripts/check-secrets.sh` 작성 — `sk-ant-`, `github_pat_`, `ghp_` 패턴 staged diff에서 grep
- [x] pre-commit에 check-secrets.sh 연결 (lint-staged보다 먼저)
- **확인**: `src/test-trap.js`에 `const k = "sk-ant-test-fake-key"` 넣고 commit → 차단됨 ✅ (2026-04-17)

### Step A.3: 핵심 유틸 단위 테스트
- [x] Vitest 설치 (`npm install -D vitest`)
- [x] `package.json`에 `"test": "vitest run"` 추가
- [x] `src/services/responseParser.test.js` 작성
  - parseUpdateResponse: 정상 JSON, 빈 응답, 부분 필드, 잘못된 형식
  - parseVerifyResponse: 정상, 부분 일치, 파싱 실패
- [x] `src/services/updateLogic.test.js` 작성
  - shouldSearch: upcoming 있음/없음, 필드 완성/미완성, source 구분
- [x] `src/utils/dateUtils.test.js` 작성
  - 날짜 비교, 만료 판정, 포맷 변환
- [x] `npm run test` 전건 통과 확인 (40/40, 2026-04-17)
- **확인**: responseParser에 `reason: 'empty' → 'SANITY_BUG'` 변경 → "빈 응답" 테스트 실패 확인 후 원복 ✅ (2026-04-17)

### Step A.4: CI 파이프라인 강화
- [x] `.github/workflows/ci.yml` 생성
  ```yaml
  on:
    pull_request:
      branches: [main]
  jobs:
    verify:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
        - run: npm ci
        - run: npm run lint
        - run: npm run test
        - run: npm run build
  ```
- [x] GitHub repo settings → branch protection rule:
  - main 브랜치: Require PR, Require status checks (verify)
- **확인**: PR에서 CI 통과 확인 ✅ (2026-04-17)

### Step A.5: verify-task 스크립트
- [x] `scripts/verify-task.sh` 작성
  ```
  체크 항목:
    1. npm run lint
    2. npm run test
    3. npm run build
    4. API 키 패턴 감지 (grep -r "sk-ant-\|github_pat_" src/)
    5. 파일 크기 경고 (단일 파일 500줄 초과)
  ```
- [x] CLAUDE.md에 추가: "작업 완료 후 반드시 `scripts/verify-task.sh` 실행할 것"
- **확인**: `bash scripts/verify-task.sh` → ✅ 5 ❌ 0 전항목 PASS (2026-04-17)

### Step A.6: 브랜치 전략 도입
- [x] main 브랜치 직접 push 금지 설정 (GitHub branch protection) — A.4에서 완료
- [x] CLAUDE.md에 브랜치 규칙 명시:
  - `feature/PLAN-xxx-설명`: 새 기능 (플랜 필수)
  - `fix/설명`: 버그 수정 (플랜 불필요)
  - `docs/설명`: 문서 수정 (플랜 불필요)
  - `chore/설명`: 설정 변경 (플랜 불필요)
- [x] 커밋 메시지 규칙 명시 (Conventional Commits):
  - `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- **확인**: main 직접 push → GitHub에서 거부 (branch protection 활성) ✅ (2026-04-17)

### Step A.7: 플랜 강제 Hook
- [x] `scripts/check-plan.sh` 작성:
  - 현재 브랜치명에서 PLAN ID 추출
  - `docs/plans/active/`에 해당 ID 파일 존재 확인
  - 없으면 에러 + 커밋 차단
  - fix/docs/chore 브랜치는 건너뜀
- [x] `.husky/pre-commit`에 check-plan.sh 연결
- [x] `.husky/post-merge` 작성:
  - 머지된 브랜치의 PLAN ID 추출
  - `docs/plans/active/PLAN-xxx.md` → `docs/plans/completed/` 이동
  - 자동 커밋
- **확인**: `feature/PLAN-999-test` 브랜치에서 플랜 없이 커밋 → 차단됨 ✅ (2026-04-17)

### Step A.8: CLAUDE.md 전면 갱신
- [x] "필수 참조 문서" → v2 문서 구조 반영 (A.1에서 완료)
- [x] "현재 상태" → Post-MVP Track A/B/C 진행 상황 (A.7 완료 반영)
- [x] "작업 흐름" 섹션 신규 추가 (7단계 블록)
- [x] "문서 업데이트 규칙" 갱신 (v2 문서명 반영, "문서 갱신 트리거" 섹션)
- [x] "코드 구조 참고" → `structure.md` 문서 맵 링크로 대체 (별도 섹션 불필요)
- **확인**: 새 세션에서 Claude가 CLAUDE.md를 읽고 v2 흐름대로 작업하는가? ✅ (2026-04-17)

> ✅ **Track A 완료 조건**: Husky hook 동작, 테스트 통과, CI 게이트 작동, 브랜치 보호 활성, 플랜 강제 hook 작동.

---

## 4. Track B: 코드 품질

**목표**: 기존 코드의 품질 향상 + 프롬프트 개선. Track A와 병행 가능하나, Step B.1은 A.3 이후.

### Step B.1: 테스트 커버리지 확대
- [x] 컴포넌트 테스트: MainTable 렌더링, 필터 동작
- [x] 훅 테스트: useConferences (데이터 로드, 날짜 전환, applyAiUpdate)
- [x] 서비스 테스트: dataManager (로드, 저장, GitHub 커밋 mock)
- **의존**: Step A.3 (Vitest 설치) 완료 후
- **확인**: 73건 전건 통과, verify-task ✅ 5 ❌ 0 (2026-04-17)

### Step B.2: 프롬프트 v2 수동 이터레이션
- [x] prompteng.md의 v2 가설 (레버 A~D) 중 A(today 앵커) + B(도메인 블랙리스트) 먼저 적용 — v2 pass 16/19 (P4 회귀), v3 pass 19/19 (P4 해소)
- [x] promptBuilder.js에 `TEMPLATES.update.v2~v6` 추가 (이전 버전 불변 유지). 활성: v4
- [x] eval-prompt.js로 v1/v2/v3 비교 실행, 결과 기록
- [x] PLAN-005: v4 보강 (Haiku→Sonnet 폴백 + v5 `dedicated_url` 힌트 + eval 3-tier 채점) — 2026-04-18
- [x] PLAN-006: v6 Link–Confidence 상호구속 + Venue 포맷 엄격 + draft 연성화 + 파서 `normalizeUpdateData` 안전망 — 2026-04-18
- [x] **Step B.2 종료 (2026-04-18)**: 브라우저 실사용 정확도 충분. v4·v5·v6 eval 3-tier 측정은 follow-up(머지 후 별도 세션)에서 수행 후 활성 전환 판단
- **확인**: v2 pass율이 v1(16/17) 이상인가? ✅ v3 19/19 (100%) 달성. v6 까지 4차례 이터레이션 종료

### Step B.3: 리팩토링 체크 스크립트
- [ ] `scripts/refactor-check.sh` 작성:
  - 파일별 줄 수 리포트 (500줄 초과 경고)
  - 컴포넌트당 useState 개수 (10개 초과 경고 — 상태 분리 필요 신호)
  - 중복 코드 패턴 감지 (기본적 수준)
- [ ] CLAUDE.md에 추가: "리팩토링 요청 시 먼저 `scripts/refactor-check.sh` 실행 후 결과 기반으로 제안할 것"
- [ ] 첫 실행 → 결과 리뷰 → 리팩토링 대상 선정
- **확인**: MainTable 등 큰 컴포넌트가 경고에 잡히는가?

### Step B.4: 리팩토링 실행 (결과 기반)
- [ ] B.3 결과에서 가장 심각한 1~2건 선정
- [ ] 각각 플랜 문서 작성 (H2.2 절차)
- [ ] feature branch에서 리팩토링 → verify-task → PR → merge
- **확인**: 리팩토링 후 기존 테스트 전건 통과?

> ✅ **Track B 완료 조건**: v2 프롬프트 확정, 핵심 컴포넌트 리팩토링 1회 이상 완료, 테스트 커버리지 서비스 레이어 100%.

---

## 5. Track C: 기능 확장

**목표**: 개인용 → 배포용 전환. Track A 최소 완료(A.1~A.5) 후 시작.

> ⚠️ Track C의 상세 Step은 기능 요구사항이 구체화된 후 blueprint.md에서 설계, 이 문서에 Step 추가.

### Step C.0: blueprint.md 갱신
- [ ] 현재 구현된 기능 목록 정리 (v1.0 baseline)
- [ ] 미구현/희망 기능 목록 정리 (멀티유저, 학회 검색, 캘린더 뷰 등)
- [ ] 각 기능의 우선순위 결정
- [ ] 첫 번째 기능의 상세 설계 추가

### 예정 기능 (우선순위 미결)
- 다기기 편집 아키텍처 전환 (Cloudflare Worker → Firebase/Supabase)
- 신규 학회 발굴 (키워드 기반 AI 검색)
- 사용자별 DB (로그인 + 개인화)
- 캘린더 뷰
- 프롬프트 반자동 log analyzer (결과 10회+ 축적 후)
- E2E 테스트 (Playwright)

> ✅ **Track C 완료 조건**: 기능별로 정의. 각 기능마다 플랜 → 구현 → verify → merge 사이클.

---

## 6. qa-backlog 워크플로우

사용 중 발견한 개선사항을 즉시 코딩하지 않고 축적한 뒤 일괄 처리.

```
1. 이슈 발견 → docs/qa-backlog.md에 한 줄 추가
   예: "- [ ] 필터 초기화 버튼이 없어서 불편 (2026-04-17)"

2. 5~10건 모이면 "qa-backlog 처리해줘" 요청

3. AI가 qa-backlog.md 읽고:
   - 유사 이슈 그룹핑
   - 플랜 문서 작성 (docs/plans/active/)
   - feature branch에서 일괄 수정
   - verify-task 실행
   - PR → merge

4. 처리된 항목은 qa-backlog.md에서 [x] 체크
```

---

## 7. 트랙 간 의존성

```
Track A (체계화)
  A.1 docs 재편 ─────────────────────────────────────┐
  A.2 Husky + lint ──┐                               │
  A.3 단위 테스트 ────┤→ A.4 CI 파이프라인 → A.6 브랜치 → A.7 플랜 hook → A.8 CLAUDE.md
  A.5 verify-task ───┘                               │
                                                      │
Track B (코드 품질) ← A.3 이후 시작 가능               │
  B.1 테스트 확대                                      │
  B.2 프롬프트 v2                                      │
  B.3~B.4 리팩토링                                     │
                                                      │
Track C (기능 확장) ← A.1~A.5 최소 완료 후 ────────────┘
  C.0 blueprint 갱신
  C.1~ 기능별 플랜 → 구현 → verify → merge
```

---

## 8. 용어 정리 (v2 추가분)

| 용어 | 의미 |
|---|---|
| 하네스 엔지니어링 | AI가 규칙을 어겼을 때 자동으로 잡아내는 장치를 만드는 것 |
| pre-commit hook | 커밋 직전에 자동 실행되는 검증 스크립트 (Husky로 관리) |
| lint-staged | 스테이징된 파일에만 lint를 돌리는 도구 |
| Conventional Commits | `feat:`, `fix:` 등 접두어로 커밋 의도를 명시하는 규약 |
| verify-task | 작업 완료 시 AI가 반드시 실행하는 종합 검증 스크립트 |
| 플랜 문서 | 기능 구현 전 작성하는 설계서. active/ → completed/ 이동 |
| qa-backlog | 사용 중 발견한 개선사항 축적 문서. 일괄 처리용 |
| Track | 병렬 진행 가능한 작업 묶음 (A: 체계화, B: 품질, C: 확장) |
