// docs/prompts/v{N}.md 와 promptBuilder.js 사이의 drift 차단.
// 한쪽만 고치면 fail. 회복: `node scripts/gen-prompt-md.js`.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { __TEMPLATES_FOR_TEST } from './promptBuilder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const PROMPTS_DIR = join(ROOT, 'docs/prompts');

const REF_CONFERENCE = {
  full_name: '{{FULL_NAME}}',
  abbreviation: '{{ABBR}}',
  cycle_years: '{{CYCLE}}',
  official_url: '{{OFFICIAL_URL}}',
  dedicated_url: '{{DEDICATED_URL}}',
};
const REF_LAST_EDITION = {
  start_date: '{{LAST_START}}',
  end_date: '{{LAST_END}}',
  venue: '{{LAST_VENUE}}',
  link: '{{LAST_LINK}}',
};
const REF_TODAY_ISO = '2026-04-17T00:00:00.000Z';

const VERSIONS = ['v4', 'v5', 'v6', 'v7'];

// outer fence = 4-backtick. MD 에서 `````text` 로 연 블록의 내용을 순서대로 반환.
function extractCodeBlocks(md) {
  const FENCE = '````';
  const lines = md.split(/\r?\n/);
  const blocks = [];
  let inside = false;
  let cur = [];
  for (const line of lines) {
    if (line.startsWith(FENCE)) {
      if (inside) {
        blocks.push(cur.join('\n'));
        cur = [];
        inside = false;
      } else {
        inside = true;
      }
      continue;
    }
    if (inside) cur.push(line);
  }
  return blocks;
}

// 에디터 따라 trailing whitespace 차이 허용. 그 외는 exact.
function normalize(s) {
  return s.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
}

let origDate;
beforeAll(() => {
  // Date 를 고정 — builders 의 `new Date()` 가 frozen time 반환.
  origDate = globalThis.Date;
  class FrozenDate extends origDate {
    constructor(...args) {
      if (args.length === 0) {
        super(REF_TODAY_ISO);
      } else {
        super(...args);
      }
    }
    static now() { return origDate.parse(REF_TODAY_ISO); }
  }
  globalThis.Date = FrozenDate;
});
afterAll(() => {
  globalThis.Date = origDate;
});

describe('promptBuilder ↔ docs/prompts/ 동기화', () => {
  for (const v of VERSIONS) {
    describe(`${v}.md`, () => {
      let mdBlocks;
      let expectedSystem;
      let expectedUser;

      beforeAll(() => {
        const mdPath = join(PROMPTS_DIR, `${v}.md`);
        const md = readFileSync(mdPath, 'utf8');
        mdBlocks = extractCodeBlocks(md);
        const tpl = __TEMPLATES_FOR_TEST.update[v];
        expectedSystem = tpl.system;
        expectedUser = tpl.user(REF_CONFERENCE, REF_LAST_EDITION);
      });

      it('System·User 두 개의 code block 을 가짐', () => {
        expect(mdBlocks.length).toBe(2);
      });

      it('System Prompt 가 UPDATE_SYSTEM 상수와 일치', () => {
        expect(normalize(mdBlocks[0])).toBe(normalize(expectedSystem));
      });

      it('User Prompt 가 builder 렌더 결과와 일치 (reference input + today=2026-04-17)', () => {
        expect(normalize(mdBlocks[1])).toBe(normalize(expectedUser));
      });
    });
  }
});
