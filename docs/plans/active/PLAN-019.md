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
- [x] Step 1 — 레거시 격리 (git mv docs/prompts/v{4..7}.md → legacy/, §3·§5 추출)
- [x] Step 2 — 코드 정리 (updateFallback 제거 · v1~v7 TEMPLATES 삭제)
- [x] Step 3 — v1_0 신규 프롬프트 작성 (promptBuilder.js + docs/prompts/v1_0.md)
- [x] Step 4 — 문서 갱신 (prompteng.md · CLAUDE.md · README)
- [x] Step 5 — verify-task.sh + 커밋 (f928faa)
- [x] Step 6 — v1_0 첫 eval-loop (run_id=20260421-072101, pass 16/27)
- [x] Step 7 — 골든셋 수정 4건 (conf_005/007/012/015 + IRACC last_link) + v1_1 프롬프트 설계 (축 A URL 3유형 / confidence 소스 / 주기 초반 허용 / iifiir 임박)
- [x] Step 8 — v1_1 코드·MD·docs 작성 + verify 5/5 통과 (d1a549d)
- [x] Step 9 — v1_1 eval-loop (run_id=20260421-082859, pass 19/27, persistent 9→5)
- [x] Step 10 — v1_1 잔존 실패 분석 + 골든셋 추가 수정 (conf_007 cycle=3 dates blank, conf_017 cycle=3) + 측정 결과 문서화 (861e799)

## 6. 검증

- [x] `bash scripts/verify-task.sh` 5/5 통과 (v1_0 · v1_1 모두)
- [x] `promptBuilder.sync.test.js` v1_0 · v1_1 strict equal
- [x] `npm run eval:loop -- --version v1_0 --max-iter 3 --threshold 0.9` → `runs/20260421-072101/run.json`
- [x] `npm run eval:loop -- --version v1_1 --max-iter 3 --threshold 0.9` → `runs/20260421-082859/run.json`
- [ ] 실전 브라우저 spot check 3~5건 (후속 세션, conf_015 · conf_022 등)

## 7. 리스크·롤백

- **위험**: Dedicated vs Institutional 판별 실패. 완화: 프롬프트에 4건 대비 예시 (`cryocooler.org ✅ / ashrae.org ❌ / iccfd.org ✅ / ibpsa.org ❌`) 병기.
- **위험**: Haiku 단독 회귀로 `start_date=null` 증가. 완화: eval-loop 3회 반복으로 노이즈 분리.
- **롤백**: `docs/prompts/legacy/v7.md` 기반으로 v7 복원, `DEFAULT_UPDATE_VERSION='v7'`. git revert.

## 8. 후속 (다음 이터레이션 후보)

- **conf_006 IIR Cryogenics date null**: link 맞지만 start/end=null. AI notes 에 "과거 패턴 2023:4/25-28, 2019:4/7-11" 언급해놓고도 추정 반환 안 함. v1_2 에서 "공식 미공개 + 주기 초반 + last 기반 과거 패턴 추정 → low 로 반환 허용" 레버 검토
- **conf_007 ICMF JSON parse_fail**: 3 iter 중 2 회 parse_fail (preamble 분석 단락 + JSON 없이 종료). 시스템 프롬프트 JSON-only 강제 문구 강화 검토
- **conf_017 PRTEC cycle anomaly**: DB cycle=4 기준 "2028 예상" 인데 실제는 2027 (2024+2년 3개월). 골든셋 cycle=3 로 수정됐으나 `public/data/conferences.json` 은 미수정. **입력 DB 교정 or anomaly 케이스 수용 정책** 결정 필요
- **conf_010 TPTPR no_expected**: 골든셋 미정답. eval 스키마에 `no_expected` 제외 옵션 추가 검토
- **`public/data/conferences.json` cycle 교정**: conf_007 (2→3), conf_017 (4→3) 프롬프트 input 도 실제 주기 반영 필요. 반영 시 v1_1 재측정
- **DRAFT_SITE_CONFIDENCE 상수화**: user_mo04ezfq BS2027 는 **실질적 성공** (AI 가 bs2027.framer.ai + dates + venue 정확 반환). 골든셋 쪽을 수정하거나 AI draft 사이트 confidence=medium 정책 유지 판단
- **박람회 vs 학회 유형 분기**: v1_1 결과 raw 로 category 별 pass rate 측정 가능
- **`domain_type` 필드**: Dedicated vs Institutional 판별 실패 누적 시 `conferences.json` 에 결정론적 힌트 추가
- **Last-edition 프롬프트 v2**: main v1_1 결과 보고 필요 시 개정

## 9. 작업 로그

- 2026-04-21 아침: PLAN-018 (PR-5) 로컬 완료 (9fd1e95) 뒤 바로 착수. v1_0 코드·MD·docs 작성 후 verify 5/5, commit f928faa.
- 2026-04-21 오전: v1_0 첫 eval-loop (run_id=20260421-072101, pass 16/27, persistent 9건). 실패 9건 분석 후 4건 (conf_005 Hannover today-edge, conf_012 THERMINIC, conf_015 ICCFD, disc_mo520jhk7o IRACC last_link) 은 골든셋 엄격성으로 판정 → 사용자가 골든셋 수정.
- 2026-04-21 정오: v1_1 프롬프트 설계 — 튜닝 상수 2개 (`IIFIIR_STRICT_FROM=0.7`, `EARLY_INACCURATE_UNTIL=0.5`) + 내용 변경 4건 (축 A URL 3유형 / confidence 소스 재정의 / 주기 초반 low 허용 / iifiir 주기-임박 제외). 상수 파일 상단 노출하여 튜닝 용이성 확보. commit d1a549d.
- 2026-04-21 오후: v1_1 eval-loop (run_id=20260421-082859, pass 19/27, persistent 9→5). 개선 4건 (conf_005·012·015·019) 확인. 문서화 (commit 861e799).
- 2026-04-21 저녁: 잔존 5건 케이스별 심층 분석 — conf_006 link 성공/date null (보수적 AI), conf_007 JSON parse_fail (3 iter 중 2), conf_017 주기 anomaly, user_mo04ezfq 실질적 성공. 사용자가 골든셋 추가 수정 (conf_007 cycle 2→3 dates blank, conf_017 cycle 4→3). 다른 컴퓨터 이동 전 PR 생성.
