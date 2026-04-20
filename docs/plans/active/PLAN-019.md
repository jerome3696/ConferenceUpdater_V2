# PLAN-019: 프롬프트 v1.0 재시작 — 소스 2축 분리 + Haiku 단일 회귀

> **상태**: active
> **생성일**: 2026-04-21
> **브랜치**: `feature/PLAN-019-prompt-v1-0`
> **스택**: PR-5 (PLAN-018) 위에
> **트랙**: F.2 프롬프트 평가 체계화 활용 — v1.0 재시작

---

## 1. 목표 (What)

v1~v7 레거시 격리 후 새 v1_0 프롬프트 작성. 핵심은 **소스 2축 분리** + **Haiku 단일 회귀**.

완료 시:
- `src/utils/promptBuilder.js` — v1~v7 TEMPLATES 삭제, `UPDATE_SYSTEM_V1_0` · `buildUpdateUserV1_0` 신규. `DEFAULT_UPDATE_VERSION='v1_0'`.
- `src/config/models.js` — `updateFallback` 필드 제거.
- `src/hooks/useUpdateQueue.js` — Sonnet 재시도 블록 제거.
- `docs/prompts/v1_0.md` 신규, `docs/prompts/v{4,5,6,7}.md` → `docs/prompts/legacy/`.
- `docs/prompteng.md` §3 버전 인덱스·§5 실행 로그 초기화. §4·§6 보존.
- `docs/legacy/PROMPT_LOG_pre_v1.md` 에 구 §3·§5 이식.
- `CLAUDE.md` 활성 버전 한 줄 갱신.
- 동기화 테스트 v1_0 만 검증.

## 2. 배경·동기 (Why)

`.claude/plans/prompt-v6-breezy-lollipop.md` 의 승인된 플랜 §Context·§설계원칙 참조. 요약:

1. v4~v7 의 "링크 우선순위 4단" 이 **탐색 순서** 와 **최종 채택 규칙** 두 개념을 섞음.
2. 사용자 피드백 (2026-04-20): `last.link → official_url → web` 탐색, 단 `official_url` 자체는 upcoming.link 불가 (institutional 1:N). 단 `cryocooler.org` 같은 dedicated 1:1 도메인은 예외.
3. Sonnet 폴백은 v4 미정교 시대 안전망. 정교화된 v1_0 의 Haiku 단독 성능이 먼저 공정한 비교 기준.
4. 학회 vs 박람회 유형 분기는 단일 규칙으로 출발 후 v1.1+ 에서 데이터 기반 결정.

## 3. 범위

### 포함
- 프롬프트 텍스트 전면 재작성 (v1_0)
- Sonnet 폴백 제거 (코드 2곳)
- 구 버전 레거시 격리 (MD · TEMPLATES · 문서 §)
- 동기화 테스트·단위 테스트 갱신
- 골든셋 27건 사용자 선별 커밋 (첫 commit)

### 제외
- `buildLastEditionPrompt` v1 (PLAN-013-D) 개정 — 유지
- `shouldSearch` (프롬프트 바깥 mode 분기) 개정 — 유지
- 카테고리별 (학회 vs 박람회) 분기 — v1.1 이후
- Precise 프롬프트 실제 분기 — `precise_diverged: false` 유지

## 4. 설계 결정 요약

- **축 A (탐색)**: `last.link` 패턴 추정 → `official_url` 시작점 → `web_search`.
- **축 B (채택)**:
  - ✅ 회차 전용 도메인 / 기관 이벤트 specific 슬러그 (`confidence=high` 가능)
  - ✅ Dedicated series domain 1:1 (홈=최신 회차, `cryocooler.org` 류) (`confidence=medium` 기본)
  - ❌ Institutional root 1:N (`ashrae.org`, `ibpsa.org` 류): 하위 경로만
  - ❌ 이벤트 목록 루트 / 리스팅 플랫폼
  - ⚠️ Draft 사이트: `confidence=low` 로만
- **재사용 레버**: A'·C·H·I + Draft 조건부
- **버린 레버**: F(Sonnet 폴백)·G(dedicated_url 힌트)

## 5. 단계

- [x] Step 0 — 골든셋 27건 사용자 선별 커밋
- [ ] Step 1 — 레거시 격리 (git mv docs/prompts/v{4..7}.md → legacy/, §3·§5 추출)
- [ ] Step 2 — 코드 정리 (updateFallback 제거 · v1~v7 TEMPLATES 삭제)
- [ ] Step 3 — v1_0 신규 프롬프트 작성 (promptBuilder.js + docs/prompts/v1_0.md)
- [ ] Step 4 — 문서 갱신 (prompteng.md · CLAUDE.md · README)
- [ ] Step 5 — verify-task.sh + 커밋

## 6. 검증

- [ ] `bash scripts/verify-task.sh` 5/5 통과
- [ ] `promptBuilder.sync.test.js` v1_0 strict equal
- [ ] `npm run eval:loop -- --version v1_0 --max-iter 3 --threshold 0.9` → `runs/<id>/run.json` (후속 세션)
- [ ] 실전 브라우저 spot check 3~5건 (conf_015 · conf_022 등)

## 7. 리스크·롤백

- **위험**: Dedicated vs Institutional 판별 실패. 완화: 프롬프트에 4건 대비 예시 (`cryocooler.org ✅ / ashrae.org ❌ / iccfd.org ✅ / ibpsa.org ❌`) 병기.
- **위험**: Haiku 단독 회귀로 `start_date=null` 증가. 완화: eval-loop 3회 반복으로 노이즈 분리.
- **롤백**: `docs/prompts/legacy/v7.md` 기반으로 v7 복원, `DEFAULT_UPDATE_VERSION='v7'`. git revert.

## 8. 후속

- **v1.1 유형 분기 검토**: 박람회/학회 pass rate 차이 확인 후
- **Last-edition 프롬프트 v2**: main v1_0 결과 보고 필요 시 개정
- **`domain_type` 필드**: Dedicated vs Institutional 판별 실패 누적 시 `conferences.json` 에 결정론적 힌트 추가

## 9. 작업 로그

- 2026-04-21: PLAN-018 (PR-5) 로컬 완료 (9fd1e95) 뒤 바로 착수.
