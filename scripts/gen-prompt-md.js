#!/usr/bin/env node
// docs/prompts/v{N}.md 생성기 — promptBuilder.js(canonical) → MD(거울).
// 사용법: node scripts/gen-prompt-md.js
// idempotent. 두 번 돌려도 git diff 없음. drift 발생 시 재실행으로 회복.

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, 'docs/prompts');

// ─── Date 고정 ─────────────────────────────────────────────────────────
// 빌더가 `new Date()` 로 today 계산 → Date 를 고정해 결정론적 출력 보장.
// 2026-04-21 은 v1_0 system 프롬프트 내부 검증 예시 날짜와 일치 (PLAN-019).
const FROZEN_ISO = '2026-04-21T00:00:00.000Z';
const OrigDate = globalThis.Date;
class FrozenDate extends OrigDate {
  constructor(...args) {
    if (args.length === 0) {
      super(FROZEN_ISO);
    } else {
      super(...args);
    }
  }
  static now() { return OrigDate.parse(FROZEN_ISO); }
}
globalThis.Date = FrozenDate;

// 고정 후 import — promptBuilder 내부의 eager evaluation 도 frozen time 을 봄.
const { __TEMPLATES_FOR_TEST, DEFAULT_UPDATE_VERSION } = await import('../src/utils/promptBuilder.js');

// ─── Reference input (플레이스홀더 토큰) ─────────────────────────────────
// MD 를 사람이 읽을 때 `{{FULL_NAME}}` 이 어디에 들어가는지 바로 보이게.
// 모든 conditional branch 를 렌더링하려면 전부 truthy 값.
export const REF_CONFERENCE = {
  full_name: '{{FULL_NAME}}',
  abbreviation: '{{ABBR}}',
  cycle_years: '{{CYCLE}}',
  official_url: '{{OFFICIAL_URL}}',
};
export const REF_LAST_EDITION = {
  start_date: '{{LAST_START}}',
  end_date: '{{LAST_END}}',
  venue: '{{LAST_VENUE}}',
  link: '{{LAST_LINK}}',
};
export const REF_TODAY = '2026-04-21';

// ─── 버전 메타 ─────────────────────────────────────────────────────────
// PLAN-019 (2026-04-21): v1~v7 legacy 격리, v1_0 단일 활성.
const VERSIONS = [
  { v: 'v1_0', parent: null },
];

function statusFor(v) {
  return DEFAULT_UPDATE_VERSION === v ? 'active' : 'dormant';
}

// ─── MD 빌더 ──────────────────────────────────────────────────────────
function buildVersionMd({ v, parent }) {
  const tpl = __TEMPLATES_FOR_TEST.update[v];
  if (!tpl) throw new Error(`Unknown version ${v}`);
  const system = tpl.system;
  const user = tpl.user(REF_CONFERENCE, REF_LAST_EDITION);
  const status = statusFor(v);

  // 내부 ```json 블록이 있으므로 outer fence 는 4-backtick 사용.
  return `---
version: ${v}
status: ${status}
parent: ${parent ?? 'none (restart)'}
default_mode: general
precise_diverged: false
today_reference: ${REF_TODAY}
---

## 1. 정밀/일반 구분 기준

현재 이 버전은 정밀/일반 분기를 **프롬프트 내용**에서는 하지 않는다. 호출 자체의 분기만 \`updateLogic.shouldSearch(row, mode)\` 가 수행한다 (mode: 'precise' | 'general'). Precise 섹션은 General 과 동일 — 차별화는 v8+ 데이터 기반 결정 대기 (\`precise_diverged: false\`).

판정 기준은 \`src/utils/urlClassifier.js\` 의 \`classifyUrlTrust\` + \`src/utils/dateUtils.js\` 의 \`cycleProgress\` + \`src/services/updateLogic.js\` 의 \`shouldSearch(row, mode)\` 참조.

## 2. System Prompt (공통)

\`\`\`\`text
${system}
\`\`\`\`

## 3. User Prompt — General

> Reference input: placeholder 토큰(\`{{FULL_NAME}}\` 등) + today=${REF_TODAY} 고정 렌더링. 런타임에서는 빌더가 실제 \`conference\`, \`lastEdition\` 을 주입한다.

\`\`\`\`text
${user}
\`\`\`\`

## 4. User Prompt — Precise

General 과 동일. 차별화 보류 (\`precise_diverged: false\`). v1.1+ 에서 측정 후 분기 예정.
`;
}

// ─── _template.md ─────────────────────────────────────────────────────
const TEMPLATE_MD = `---
version: vN
status: dormant
parent: v{N-1}
default_mode: general
precise_diverged: false
today_reference: YYYY-MM-DD
---

## 1. 정밀/일반 구분 기준

<언제 precise·언제 general 로 분기하는지 한 단락. 현재는 updateLogic.shouldSearch 요약.>

## 2. System Prompt (공통)

\`\`\`\`text
<UPDATE_SYSTEM_VN 원문>
\`\`\`\`

## 3. User Prompt — General

\`\`\`\`text
<buildUpdateUserVN 템플릿 렌더 결과>
\`\`\`\`

## 4. User Prompt — Precise

<precise_diverged: false 이면 "General 과 동일, 차별화 보류" 한 줄.
 precise_diverged: true 이면 General 대비 diff.>
`;

// ─── README.md ────────────────────────────────────────────────────────
const README_MD = `# docs/prompts/ — 프롬프트 MD 원본 (거울)

\`src/utils/promptBuilder.js\` 의 \`TEMPLATES.update\` 에 있는 프롬프트 버전을 **사람이 읽기 쉬운 MD** 로 미러링한 공간.

## 역할 분담

- **canonical**: \`src/utils/promptBuilder.js\`. 실제 런타임 프롬프트 원본.
- **mirror (이 폴더)**: 리뷰·diff·버전간 비교·문서용. **편집 금지** — 생성기로만 갱신.
- **동기화**: \`src/utils/__tests__/promptBuilder.sync.test.js\` 가 drift 를 차단. 한쪽만 고치면 \`npm test\` 실패.

## 파일

- \`_template.md\` — 새 버전 추가 시 참고용 틀.
- \`v1_0.md\` — 활성 버전 (PLAN-019, 2026-04-21 재시작). 소스 2축 분리 (탐색 A · 채택 B) + Haiku 단일.
- \`legacy/v{4,5,6,7}.md\` — PLAN-019 이전 이력. 참조·롤백용, 런타임 미사용.

## 버전 명명 규칙

- JS 식별자 안전성 확보 위해 \`v{N}_{M}\` (밑줄) 사용. 예: \`v1_0\`, \`v1_1\`. dot 표기는 금지.
- 이전 버전 불변. 신규 버전 추가는 기존 상수에 영향 없음.

## 편집 규칙

### 프롬프트 내용을 바꾸려면
1. \`src/utils/promptBuilder.js\` 에서 \`UPDATE_SYSTEM_V{N}_{M}\` 상수 또는 \`buildUpdateUserV{N}_{M}\` 함수 수정.
2. \`node scripts/gen-prompt-md.js\` 실행 → 이 폴더의 MD 파일들 갱신.
3. \`npm test\` 로 sync 확인 (drift 0).
4. 코드 + MD 를 같은 커밋에 담아 PR.

### 이 폴더의 MD 만 직접 수정하지 말 것
- \`npm test\` 가 fail.
- 회복: \`node scripts/gen-prompt-md.js\` 재실행.

## Reference input (MD 렌더링 기준)

User 프롬프트는 조건부 블록(예: \`lastEdition.link\` 힌트)을 전부 렌더링하기 위해 아래 reference 로 빌드:

\`\`\`js
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
\`\`\`

생성기(\`scripts/gen-prompt-md.js\`)가 Date 를 고정하고 이 reference 를 빌더에 주입해 결정론적 출력을 만든다.

## Precise 섹션

v1_0 은 \`precise_diverged: false\` — Precise 프롬프트 내용은 General 과 동일하고, 호출 여부 분기만 \`updateLogic.shouldSearch(row, mode)\` 가 수행한다. v1.1+ 에서 데이터 기반 실제 분기 도입 검토.

## 관련 문서

- 프롬프트 진화 서사·레버 카탈로그·실행 로그: \`docs/prompteng.md\`
- v1~v7 레거시 이력: \`docs/legacy/PROMPT_LOG_pre_v1.md\`
- 재시작 플랜: \`docs/plans/active/PLAN-019.md\`
`;

// ─── 실행 ────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  for (const ver of VERSIONS) {
    const md = buildVersionMd(ver);
    const path = join(OUT_DIR, `${ver.v}.md`);
    await writeFile(path, md);
    console.log(`✓ ${path.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
  }

  await writeFile(join(OUT_DIR, '_template.md'), TEMPLATE_MD);
  console.log(`✓ docs/prompts/_template.md`);

  await writeFile(join(OUT_DIR, 'README.md'), README_MD);
  console.log(`✓ docs/prompts/README.md`);

  console.log(`\nDEFAULT_UPDATE_VERSION = ${DEFAULT_UPDATE_VERSION} → ${DEFAULT_UPDATE_VERSION}.md 만 status: active`);
}

main().catch((e) => { console.error(e); process.exit(1); });
