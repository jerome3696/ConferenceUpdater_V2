# PLAN-014: 프롬프트 MD 관리 체계 + 동기화 테스트 (PR-1)

> **상태**: active
> **생성일**: 2026-04-20
> **브랜치**: `feature/PLAN-014-prompt-md-sync`
> **연관 PR**: TBD
> **트랙**: F (운영 품질) — F.2 프롬프트 평가 체계화 · PR-1

---

## 1. 목표 (What)

프롬프트 버전(v4~v7)을 **사람이 읽기 쉬운 MD 원본**으로 `docs/prompts/` 에 옮기고, `src/utils/promptBuilder.js` 의 실제 템플릿과의 **drift 를 테스트로 차단**한다.

완료 시:
- `docs/prompts/{README, _template, v4, v5, v6, v7}.md` 존재.
- 각 MD 파일에 frontmatter + (정밀/일반 구분 기준 / System Prompt / User Prompt — General / User Prompt — Precise) 4섹션.
- `npm run test` 에 `promptBuilder.sync.test.js` 포함, v4~v7 전부 통과.
- 한쪽만 고치면 CI 실패 (drift 차단).

## 2. 배경·동기 (Why)

상위 플랜 `C:\Users\jerom\.claude\plans\prompt-v6-breezy-lollipop.md` §핵심 구현 작업 1·2 의 Stage 1 을 구현한다.

현재 문제:
- 프롬프트 원문이 976줄 `promptBuilder.js` 템플릿 리터럴 안에 묻혀 있어 버전 간 diff·리뷰가 grep·스크롤 의존.
- 이력·레버는 `docs/prompteng.md` 에 서사적으로 흩어져 있고, 실제 프롬프트 텍스트는 따로. 둘을 교차 참조하려면 매번 파일 2개 열어야 함.
- 사용자는 버전별 **(정밀/일반 구분 기준 / 정밀 프롬프트 / 일반 프롬프트)** 3요소 형태의 MD 를 원함. 현재는 "정밀/일반 구분"이 `updateLogic.shouldSearch` 호출 여부 분기에만 있고 프롬프트 내용 분리는 없음 — 이 gap 을 문서 구조로 먼저 확립.

## 3. 범위 (Scope)

### 포함
- `docs/prompts/README.md` — 스키마·편집 규칙·동기화 테스트 설명.
- `docs/prompts/_template.md` — 새 버전 추가용 틀.
- `docs/prompts/v4.md`, `v5.md`, `v6.md`, `v7.md` — 기존 `TEMPLATES.update.v{N}` 원문 복제.
- `scripts/gen-prompt-md.js` — MD 생성기 (reference input + 고정 date 로 렌더링). CLI: `node scripts/gen-prompt-md.js`.
- `src/utils/__tests__/promptBuilder.sync.test.js` — MD 와 코드 템플릿 일치 검증.

### 제외 (Non-goals)
- Precise 섹션의 **실제 내용 차별화** — v8+ 에서 데이터 기반 결정. 이번엔 전부 `"General 과 동일, 차별화 보류"` 플레이스홀더.
- v1~v3 MD 생성 — v4 미만은 deprecated 로 간주, 필요 시 후속.
- 골든셋·eval·Skill — PR-2~5 에서.
- `promptBuilder.js` 코드 수정 — 이번 PR 은 **문서·테스트만**. MD 가 canonical 되는 건 Stage 2 (v8 작성 시).

## 4. 설계 결정

- **MD 가 canonical 이 아니라 거울**: 코드가 여전히 원본. MD 는 리뷰·diff·문서용. 동기화 테스트가 일치 강제. 런타임 loader 는 빌드 복잡도 때문에 미채택.
- **버전별 폴더 아닌 단일 파일** (`v{N}.md`): 리뷰·grep·PR diff 비용 최소화. 한 버전에 200~400줄 현실적 분량.
- **Reference input + 고정 date 로 User 프롬프트 렌더링**: 플레이스홀더 토큰(`{{FULL_NAME}}` 등)을 reference 값으로 주면 builder 가 그대로 삽입 → MD 가독성·결정성 동시 확보.
- **today 는 `2026-04-17` 고정**: 기존 v3/v4/v6/v7 system 프롬프트의 검증 예시 날짜와 맞춤. 의미상 자연스러움.
- **System 섹션은 exact string match, User 섹션은 line-normalized match**: System 은 정적 상수라 완전 비교, User 는 에디터의 trailing whitespace 차이 등을 관용.
- **생성기 스크립트 제공**: 새 버전 추가·대량 업데이트 시 수작업 방지. 테스트가 drift 를 감지하면 `node scripts/gen-prompt-md.js` 실행으로 회복.

## 5. 단계

- [ ] Step 1 — PLAN-014.md (이 파일) 작성
- [ ] Step 2 — `scripts/gen-prompt-md.js` 생성기 작성 (v4~v7 → MD)
- [ ] Step 3 — 생성기 1회 실행, `docs/prompts/{README,_template,v4,v5,v6,v7}.md` 커밋
- [ ] Step 4 — `src/utils/__tests__/promptBuilder.sync.test.js` 작성
- [ ] Step 5 — drift 유도 실험 (코드 한 글자 바꿔 sync fail 확인 후 원복)
- [ ] Step 6 — `bash scripts/verify-task.sh` 통과
- [ ] Step 7 — 커밋 + PR

## 6. 검증

- [ ] `bash scripts/verify-task.sh` 통과 (lint/vitest/build/secret/size)
- [ ] 신규 테스트: `promptBuilder.sync.test.js` — 각 v4~v7 의 system/user MD 일치
- [ ] 수동: `docs/prompts/v7.md` 를 에디터로 열어 가독성 확인 (backtick nesting, frontmatter 렌더링)
- [ ] 생성기 재실행 idempotent: `node scripts/gen-prompt-md.js` 두 번 돌려도 git diff 없음
- [ ] drift 실험: `promptBuilder.js` 임의 변경 → `npm test` 가 어느 버전이 깨졌는지 명확히 알림

## 7. 리스크·롤백

- **저**: MD 와 코드 drift. 회복: `node scripts/gen-prompt-md.js` 재실행 후 MD 커밋.
- **저**: 생성기의 reference input 이 conditional branch 를 빠뜨려 "특정 경로는 MD 에 반영 안 됨". 예: v5/v6 의 `dedicated_url` 조건·v7 의 `lastEdition.link` 조건. → reference 에 전부 truthy 값 넣어 모든 branch 렌더링 보장. 테스트로 검증.
- 롤백: 이 플랜은 문서·테스트만 추가. PR revert 1회로 원복 가능.

## 8. 후속 (Follow-ups)

- PR-2: 골든셋 XLSX 일원화 + 마이그레이션 (`prompt-v6-breezy-lollipop.md` 핵심 작업 3)
- PR-3: eval-prompt.js XLSX 개편 + 필드별 채점 (핵심 작업 4)
- PR-4: eval-loop.js early-stop 래퍼 (핵심 작업 5)
- PR-5: prompt-designer Skill + prompteng.md·CLAUDE.md 갱신 (핵심 작업 6·7)
- v8 작성 시 Stage 2 진입 — MD 먼저 쓰고 코드로 이식.

## 9. 작업 로그

- 2026-04-20: 상위 설계(`C:\Users\jerom\.claude\plans\prompt-v6-breezy-lollipop.md`) 승인됨. PR-1 분리 착수.
