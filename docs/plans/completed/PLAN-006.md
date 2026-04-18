# PLAN-006: v6 프롬프트 + 파서 안전망 + venue 정규화

> **상태**: active (초안 — PLAN-005 머지 후 착수)
> **생성일**: 2026-04-18
> **완료일**: —
> **브랜치**: `feature/PLAN-006-v6-prompt-safety-net` (PLAN-005 머지 후 `main` 에서 분기)
> **연관 PR**: TBD
> **트랙**: B (품질)

---

## 1. 목표 (What)

v4 프롬프트의 3가지 결함을 v6 로 해소하고, 파서 레이어에 안전망을 추가:

1. `confidence=high/medium` 인데 `link=null` 나오는 AI 자기모순 차단 (cross-coupling 명시)
2. "[링크 우선순위] 3순위 허용" vs "시리즈 목록 금지" 내부 충돌 해소
3. US 개최 venue 포맷 통일: `City, State, USA` (국가명 `USA` 고정, `United States`/`US` 금지)

파서 `normalizeUpdateData` 안전망으로 v6 활성 전에도 `link=null` 오탐 보정 가능하게.

## 2. 배경·동기 (Why)

2026-04-18 브라우저 실사용(PLAN-005 반영된 feature 브랜치 상태)에서 다수 결함 관찰:

| 학회 | 증상 | 근본 원인 |
|---|---|---|
| conf_006 IIR Cryogenics (1차 run) | `confidence=high` + `link=null` (비고엔 "공식 전용 페이지(1순위)에서 확인") | LLM 비결정성 + v4 에 "high면 link!=null" cross-coupling 부재 |
| conf_008 ITherm | `Orlando, Florida, United States` → `Orlando, United States` (주 누락) | v4 프롬프트에 venue 포맷 규칙 없음 |
| conf_001 ASHRAE | `Chicago, Illinois, USA` → `Chicago, USA` | 동일 (state 누락) |
| conf_022 BS 2027 | `bs2027.framer.ai` → `null` (source=`ibpsa.org/conferences/`) | (a) v4 에서 `framer.ai` 하드 금지가 과잉 일반화 (v1 Sonnet 한 건 관찰 기반) (b) `ibpsa.org/conferences/` 는 [링크 우선순위] 3순위 허용 vs "**중요** 시리즈 목록 페이지 금지" 와 충돌 → AI가 안전한 `null` 선택 |

PLAN-005 의 Haiku→Sonnet 폴백은 `start_date=null` 보정에 특화. **`link=null` 오탐은 여전히 미해결**. eval 3-tier 에도 `link` 누락은 집계되지 않음(URL 매칭 전 단계에서 `ai_link_missing` 로 fail 처리만).

## 3. 범위 (Scope)

### 포함

**Part 1 — v6 프롬프트** (`src/utils/promptBuilder.js`, v4·v5 불변 + v6 신규)
- [신뢰도 기준] cross-coupling 추가: "`confidence=high` 또는 `medium` 이면 `link != null` (4순위 이상을 link 필드에 채울 것)"
- [링크 우선순위] 3순위 허용 범위 명료화: 주관기관 "컨퍼런스 색인 페이지" (`ibpsa.org/conferences/`, `astfe.org/conferences/`) **허용**. 진짜 금지는 제3자 CFP 집계(`easychair`, `wikicfp`, `conferenceindex`, `allconferencealert`, `waset`) + IIR 회차무관 집계(`iifiir.org/en/iir-conferences-series`, `iifiir.org/en/events`) only
- [Venue 포맷] 신규 섹션: US 는 `City, State, USA` / Canada 는 `City, Province, Canada` / 기타는 `City, Country`. 국가명 정규화: `USA` (United States/US 금지), `UK` (United Kingdom 금지), `Korea` (South Korea/Republic of Korea 금지). 예시 3~4건 포함
- [Draft 사이트 처리] 신규: `framer.ai`/draft 플랫폼 페이지는 **link 로 사용 허용**. 단 `confidence=low` 강제 + `notes` 에 `'draft/prototype'` 명시. 하드 금지 목록에서 `framer.ai` 제거
- `DEFAULT_UPDATE_VERSION='v4'` 유지. v6 eval 측정 후 활성 전환은 별도 커밋

**Part 2 — responseParser 안전망** (`src/services/responseParser.js`)
- `BANNED_LINK_DOMAINS` 상수 export (프롬프트와 동일 목록, 단일 진실 공급원)
- `normalizeUpdateData(data)` 신규 export
  - 조건: `link==null && source_url 존재 && !BANNED_LINK_DOMAINS 매칭 && start_date 존재`
  - 동작: `link = source_url` 백필, `confidence` 1단계 다운그레이드 (`high`→`medium`, `medium`→`low`, `low`→`low`), `notes` 에 `'[파서 백필: source_url → link]'` 추가
- `parseUpdateResponse` 내부 마지막 단계에서 자동 호출 → 호출부(useUpdateQueue/eval-prompt) 변경 불요

**Part 3 — 단위 테스트**
- `promptBuilder.test.js` 확장:
  - v6 에 state 포함 venue 예시 텍스트 존재
  - v6 에 cross-coupling 규칙 텍스트 존재
  - v6 에 draft 사이트 지침 텍스트 존재
  - v6 [링크 우선순위] 에서 `framer.ai` 미등장
- `responseParser.test.js` 확장 — `normalizeUpdateData` 5종:
  - 백필 성공 (link null + 유효 source_url + start_date 있음)
  - 백필 차단 (source_url 금지도메인)
  - 백필 차단 (source_url 없음)
  - 백필 차단 (start_date 없음)
  - 정상 유지 (link 이미 있음 → source_url 영향 없음)
  - confidence 다운그레이드 3분기 (high→medium, medium→low, low→low)

### 제외 (Non-goals)
- **기존 DB 정규화 마이그레이션** — `conferences.json`/`editions` 에 남은 `United States`/주 누락/framer.ai 링크는 손대지 않음. 다음 업데이트 때 자동 수렴
- **레버 E (임박 학회 재검증)** — PLAN-007 별도. `updateLogic.shouldSearch` imminent 로직은 여기서 안 건드림
- **DB 스크리닝 (official_url 에 금지도메인 저장된 학회 탐색)** — follow-up QA 로 기록만
- **v6 활성 전환** — `DEFAULT_UPDATE_VERSION='v6'` 변경은 eval 측정 후 별도 커밋/플랜
- **PLAN-005 기능 변경** — 머지 후 착수 전제, 충돌 영역 없음

## 4. 설계 결정

- **v5 위에 v6 신규 (v5 수정 아님)**: prompteng §2 원칙 — 이전 버전 불변. v5 는 `dedicated_url` 힌트, v6 는 규칙 보강. 두 축 독립. 필요하면 v7 에서 합본
- **파서 안전망 위치 = `parseUpdateResponse` 내부**: 파서가 이미 `date_raw` 보정 같은 경량 정규화를 수행 → 일관된 위치. 단 `normalizeUpdateData` 는 별도 export 하여 단위 테스트·재사용 용이
- **confidence 자동 다운그레이드 이유**: 백필된 link 는 AI 명시 선택이 아닌 파서 추론 → 원래 `confidence=high` 였더라도 "근거가 `source_url` 파생" 으로 격하가 정직. 다만 1단계만 낮춤(`high`→`medium`) — 너무 깎으면 eval partial 과다 발생
- **framer.ai 연성화 근거**: v2 블랙리스트 등재가 v1 Sonnet 1건 관찰(conf_022 `bs2027.framer.ai`)의 과잉 일반화. "학회 직전 재검증" 니즈는 레버 E 영역 — 프롬프트 범위 밖
- **venue 포맷에 예시 포함**: v3 today 앵커의 검증 예시 7건이 P4 완전 해소한 선례 — 한국어/영어 서술 지시보다 예시 기반 지시가 강함
- **`BANNED_LINK_DOMAINS` 단일 공급원**: 프롬프트 텍스트와 파서 정규화 둘 다 이 상수 참조 → 향후 도메인 추가/제거 시 한 곳만 수정. 프롬프트는 템플릿 리터럴로 주입

## 5. 단계

**전제**: PLAN-005 PR 생성 → 리뷰·머지 → `main` pull

- [ ] **Step 1** — `feature/PLAN-006-v6-prompt-safety-net` 브랜치 생성 (`main` 기준)
- [ ] **Step 2** — `src/services/responseParser.js`: `BANNED_LINK_DOMAINS` 상수 + `normalizeUpdateData(data)` 추가. `parseUpdateResponse` 마지막에 자동 호출. 테스트 먼저 작성(TDD)
- [ ] **Step 3** — `src/utils/promptBuilder.js`: `UPDATE_SYSTEM_V6` + `buildUpdateUserV6` 추가. `BANNED_LINK_DOMAINS` import 해서 금지 리스트 템플릿 리터럴 주입. `TEMPLATES.update.v6` 등록
- [ ] **Step 4** — `promptBuilder.test.js` v6 분기 추가 (cross-coupling / venue / draft / framer.ai 제거 검증)
- [ ] **Step 5** — `docs/prompteng.md` 갱신: §1 현황판(v6 항목) / §3 버전 인덱스 / §4 레버 H·I·J 추가 (cross-coupling, venue 정규화, draft 연성화) / §5 실행 로그 / §6 P8~P10 추가 (link-confidence 모순, venue 누락, draft 하드 금지 과잉)
- [ ] **Step 6** — `docs/changelog.md` 항목 추가
- [ ] **Step 7** — `bash scripts/verify-task.sh` 5/5 통과
- [ ] **Step 8** — 커밋 + 푸시 + PR
- [ ] **Step 9 (후속, 머지 후)** — `npm run eval -- --version v6` 3-tier 측정 → prompteng.md 결과 기록. 만족 시 별도 커밋으로 `DEFAULT_UPDATE_VERSION='v6'` 활성 전환

## 6. 검증

- [ ] `bash scripts/verify-task.sh` 5/5
- [ ] 단위 테스트: 총 110+ 통과 (현 100 + v6/normalize 약 10건)
- [ ] 브라우저 수동 — 세션 당 1건씩 랜덤 재실행:
  - [ ] conf_008 ITherm [업데이트] → venue = `Orlando, Florida, USA`
  - [ ] conf_001 ASHRAE [업데이트] → venue = `Chicago, Illinois, USA`
  - [ ] conf_022 BS [업데이트] → link 채워짐 (`ibpsa.org/conferences/` confidence=medium 또는 framer.ai confidence=low + notes draft)
  - [ ] conf_006 IIR Cryogenics [업데이트] 3~5회 반복 → `link=null` 재현 여부 확인 (v6 → 0건 기대)
- [ ] (후속) `npm run eval -- --version v6` 3-tier 결과, v4 대비 partial/fail 변화 기록

## 7. 리스크·롤백

- **파서 과도 백필**: 파서가 AI 의도 없이 `link` 자동 채움 → AI가 의도적으로 null 반환(학회 발견 실패 등)한 케이스도 덮어쓸 위험. **완화책**: `start_date 존재` 전제. 날짜도 없으면 정말 발견 실패이므로 백필 안 함
- **v6 규칙 누적으로 input 토큰 증가**: v4 대비 +10~15% 예상. eval 토큰 기록으로 허용선 판단. 넘치면 [Venue 포맷] 예시를 1~2건으로 축소
- **`BANNED_LINK_DOMAINS` 상수화 부작용**: 프롬프트와 파서 둘 다 이 상수 의존 → 런타임 import 실패 시 둘 다 꺠짐. 완화책: 상수는 하드코드 문자열 배열(의존성 0), 테스트로 존재 확인
- **롤백**: v6 템플릿/`normalizeUpdateData` 제거만 하면 기존 동작. `DEFAULT='v4'` 유지되는 한 활성 영향 없음. PLAN-005 와 충돌 영역 없음

## 8. 후속 (Follow-ups)

- **PLAN-007 (레버 E — 임박 학회 재검증)**: `updateLogic.shouldSearch` 에 imminent 판단 확장. draft/framer 링크는 시작일 ≤ N일이면 자동 재검색 대상
- **QA 태스크**: `conferences.json` 내 `official_url` 이 `BANNED_LINK_DOMAINS` 에 해당하는 학회 스크리닝 (conf_006 외 잔존 여부)
- **기존 DB venue 정규화**: `Illinois, USA` 등 손수 일괄 업데이트 (수동 또는 일회성 스크립트). PLAN-006 영향 받은 학회 한해
- **v6 활성 전환**: eval 통과 후 별도 커밋 — `DEFAULT_UPDATE_VERSION='v6'`
- **v7 후보**: v5 `dedicated_url` 힌트 + v6 규칙 보강 합본 (독립축 둘을 하나로 수렴)

## 9. 작업 로그

- 2026-04-18: 플랜 초안 작성 (PLAN-005 머지 대기 상태). 브라우저 실사용 관찰 4건(conf_001·008·006·022)이 동기
