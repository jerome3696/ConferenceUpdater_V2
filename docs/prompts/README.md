# docs/prompts/ — 프롬프트 MD 원본 (거울)

`src/utils/promptBuilder.js` 의 `TEMPLATES.update` 에 있는 프롬프트 버전(v4~v7)을 **사람이 읽기 쉬운 MD** 로 미러링한 공간.

## 역할 분담

- **canonical**: `src/utils/promptBuilder.js`. 실제 런타임 프롬프트 원본.
- **mirror (이 폴더)**: 리뷰·diff·버전간 비교·문서용. **편집 금지** — 생성기로만 갱신.
- **동기화**: `src/utils/__tests__/promptBuilder.sync.test.js` 가 drift 를 차단. 한쪽만 고치면 `npm test` 실패.

## 파일

- `_template.md` — 새 버전 추가 시 참고용 틀.
- `v4.md` ~ `v7.md` — 각 버전의 (구분 기준 / System / User-General / User-Precise) 4섹션.

## 편집 규칙

### 프롬프트 내용을 바꾸려면
1. `src/utils/promptBuilder.js` 에서 `UPDATE_SYSTEM_V{N}` 상수 또는 `buildUpdateUserV{N}` 함수 수정.
2. `node scripts/gen-prompt-md.js` 실행 → 이 폴더의 MD 파일들 갱신.
3. `npm test` 로 sync 확인 (drift 0).
4. 코드 + MD 를 같은 커밋에 담아 PR.

### 이 폴더의 MD 만 직접 수정하지 말 것
- `npm test` 가 fail.
- 회복: `node scripts/gen-prompt-md.js` 재실행.

## Reference input (MD 렌더링 기준)

User 프롬프트는 조건부 블록(예: v5/v6 의 `dedicated_url` 힌트, v7 의 `lastEdition.link` 힌트)을 전부 렌더링하기 위해 아래 reference 로 빌드:

```js
REF_CONFERENCE = {
  full_name: '{{FULL_NAME}}',
  abbreviation: '{{ABBR}}',
  cycle_years: '{{CYCLE}}',
  official_url: '{{OFFICIAL_URL}}',
  dedicated_url: '{{DEDICATED_URL}}',
};
REF_LAST_EDITION = {
  start_date: '{{LAST_START}}',
  end_date: '{{LAST_END}}',
  venue: '{{LAST_VENUE}}',
  link: '{{LAST_LINK}}',
};
REF_TODAY = '2026-04-17';
```

생성기(`scripts/gen-prompt-md.js`)가 Date 를 고정하고 이 reference 를 빌더에 주입해 결정론적 출력을 만든다.

## Precise 섹션

현재 v4~v7 은 모두 `precise_diverged: false` — Precise 프롬프트 내용은 General 과 동일하고, 호출 여부 분기만 `updateLogic.shouldSearch(row, mode)` 가 수행한다. v8+ 에서 데이터 기반으로 실제 분기 도입 예정.

## 관련 문서

- 프롬프트 진화 서사·레버 카탈로그·실행 로그: `docs/prompteng.md`
- 상위 설계: `C:\\Users\\jerom\\.claude\\plans\\prompt-v6-breezy-lollipop.md`
