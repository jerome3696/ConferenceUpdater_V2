# docs/prompts/ — 프롬프트 MD 원본 (거울)

`src/utils/promptBuilder.js` 의 `TEMPLATES.update` 에 있는 프롬프트 버전을 **사람이 읽기 쉬운 MD** 로 미러링한 공간.

## 역할 분담

- **canonical**: `src/utils/promptBuilder.js`. 실제 런타임 프롬프트 원본.
- **mirror (이 폴더)**: 리뷰·diff·버전간 비교·문서용. **편집 금지** — 생성기로만 갱신.
- **동기화**: `src/utils/__tests__/promptBuilder.sync.test.js` 가 drift 를 차단. 한쪽만 고치면 `npm test` 실패.

## 파일

- `_template.md` — 새 버전 추가 시 참고용 틀.
- `v1_0.md` — 활성 버전 (PLAN-019, 2026-04-21 재시작). 소스 2축 분리 (탐색 A · 채택 B) + Haiku 단일.
- `legacy/v{4,5,6,7}.md` — PLAN-019 이전 이력. 참조·롤백용, 런타임 미사용.

## 버전 명명 규칙

- JS 식별자 안전성 확보 위해 `v{N}_{M}` (밑줄) 사용. 예: `v1_0`, `v1_1`. dot 표기는 금지.
- 이전 버전 불변. 신규 버전 추가는 기존 상수에 영향 없음.

## 편집 규칙

### 프롬프트 내용을 바꾸려면
1. `src/utils/promptBuilder.js` 에서 `UPDATE_SYSTEM_V{N}_{M}` 상수 또는 `buildUpdateUserV{N}_{M}` 함수 수정.
2. `node scripts/gen-prompt-md.js` 실행 → 이 폴더의 MD 파일들 갱신.
3. `npm test` 로 sync 확인 (drift 0).
4. 코드 + MD 를 같은 커밋에 담아 PR.

### 이 폴더의 MD 만 직접 수정하지 말 것
- `npm test` 가 fail.
- 회복: `node scripts/gen-prompt-md.js` 재실행.

## Reference input (MD 렌더링 기준)

User 프롬프트는 조건부 블록(예: `lastEdition.link` 힌트)을 전부 렌더링하기 위해 아래 reference 로 빌드:

```js
REF_CONFERENCE = {
  full_name: '{{FULL_NAME}}',
  abbreviation: '{{ABBR}}',
  cycle_years: '{{CYCLE}}',
  official_url: '{{OFFICIAL_URL}}',
};
REF_LAST_EDITION = {
  start_date: '{{LAST_START}}',
  end_date: '{{LAST_END}}',
  venue: '{{LAST_VENUE}}',
  link: '{{LAST_LINK}}',
};
REF_TODAY = '2026-04-21';
```

생성기(`scripts/gen-prompt-md.js`)가 Date 를 고정하고 이 reference 를 빌더에 주입해 결정론적 출력을 만든다.

## Precise 섹션

v1_0 은 `precise_diverged: false` — Precise 프롬프트 내용은 General 과 동일하고, 호출 여부 분기만 `updateLogic.shouldSearch(row, mode)` 가 수행한다. v1.1+ 에서 데이터 기반 실제 분기 도입 검토.

## 관련 문서

- 프롬프트 진화 서사·레버 카탈로그·실행 로그: `docs/prompteng.md`
- v1~v7 레거시 이력: `docs/legacy/PROMPT_LOG_pre_v1.md`
- 재시작 플랜: `docs/plans/active/PLAN-019.md`
