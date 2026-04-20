#!/usr/bin/env node
// docs/eval/golden-set.xlsx → docs/eval/golden-set.parsed.json (eval-prompt.js 입력 용 정규화).
// 사용: node scripts/import-golden-xlsx.js [--file path] [--out path]
// 검증: id 가 conferences.json 에 존재 · 날짜 YYYY-MM-DD · upcoming_link 가 http(s).
// 실패 시 exit(1). PR-3 에서 eval-prompt.js 가 이 파일을 읽는다.

import * as XLSX from 'xlsx';
import { readFile as fsReadFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseWorkbook } from '../src/services/goldenSheet.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\//i;

function parseArgs(argv) {
  const args = { file: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') args.file = argv[++i];
    else if (a === '--out') args.out = argv[++i];
  }
  return args;
}

// row 하나를 검증. 실패 시 이슈 배열 반환.
export function validateRow(row, knownIds) {
  const issues = [];
  if (!row.id) issues.push('id 누락');
  else if (!knownIds.has(row.id)) issues.push(`id ${row.id} 가 conferences.json 에 없음`);

  for (const [field, val] of Object.entries(row)) {
    if (!val) continue;
    if (field.endsWith('_start') || field.endsWith('_end') || field === 'verified_at') {
      if (!DATE_RE.test(String(val))) issues.push(`${field}=${val} 형식 오류 (YYYY-MM-DD)`);
    }
    if (field === 'upcoming_link' || field === 'last_link' || field === 'official_url' || field === 'source_url') {
      if (!URL_RE.test(String(val))) issues.push(`${field}=${val} 스킴 오류 (http/https)`);
    }
  }
  return issues;
}

async function main() {
  const args = parseArgs(process.argv);
  const xlsxPath = args.file ? resolve(args.file) : join(ROOT, 'docs/eval/golden-set.xlsx');
  const outPath = args.out ? resolve(args.out) : join(ROOT, 'docs/eval/golden-set.parsed.json');

  if (!existsSync(xlsxPath)) {
    console.error(`❌ 파일 없음: ${xlsxPath}`);
    process.exit(1);
  }

  const buf = await fsReadFile(xlsxPath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const { rows, meta } = parseWorkbook(wb);
  console.log(`📥 ${xlsxPath} — rows=${rows.length}, snapshot_date=${meta.snapshot_date || '(없음)'}`);

  const confPath = join(ROOT, 'public/data/conferences.json');
  const { conferences } = JSON.parse(await fsReadFile(confPath, 'utf8'));
  const knownIds = new Set(conferences.map((c) => c.id));

  const errors = [];
  for (const row of rows) {
    const issues = validateRow(row, knownIds);
    if (issues.length > 0) errors.push({ id: row.id || '(id 없음)', issues });
  }

  if (errors.length > 0) {
    console.error(`\n❌ 검증 실패 ${errors.length} 건:`);
    for (const e of errors) console.error(`  - ${e.id}: ${e.issues.join(', ')}`);
    process.exit(1);
  }

  const parsed = {
    snapshot_date: meta.snapshot_date || null,
    active_version: meta.active_version || null,
    row_count: rows.length,
    cases: rows,
  };
  await writeFile(outPath, JSON.stringify(parsed, null, 2) + '\n');
  console.log(`\n✓ ${outPath.replace(ROOT + '\\', '').replace(ROOT + '/', '')} (${rows.length} cases)`);
  console.log(`  snapshot_date = ${parsed.snapshot_date}`);
  console.log(`  active_version = ${parsed.active_version}`);
}

// 테스트에서 import 시 main() 실행 방지.
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
