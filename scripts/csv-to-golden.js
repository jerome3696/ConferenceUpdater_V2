#!/usr/bin/env node
// docs/eval/golden-set.csv → docs/eval/golden-set.json 변환.
// 스키마: id, link, source_url, verified_at, notes
// - link 또는 source_url 중 하나라도 비어 있지 않으면 평가 케이스로 채택
// - 둘 다 비어 있으면 "미작성"으로 간주하고 자동 스킵

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CSV_PATH = join(ROOT, 'docs/eval/golden-set.csv');
const JSON_PATH = join(ROOT, 'docs/eval/golden-set.json');
const CONF_PATH = join(ROOT, 'public/data/conferences.json');

const REQUIRED_COLS = ['id', 'link', 'source_url', 'verified_at', 'notes'];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') { /* skip */ }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function emptyOrNull(v) {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

async function main() {
  let csvText = await readFile(CSV_PATH, 'utf8');
  if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);
  const rows = parseCsv(csvText).filter((r) => r.length && !(r.length === 1 && r[0].trim() === ''));

  if (rows.length === 0) {
    console.error(`❌ ${CSV_PATH} 비어 있음.`);
    process.exit(1);
  }

  const header = rows[0].map((h) => h.trim());
  for (const col of REQUIRED_COLS) {
    if (!header.includes(col)) {
      console.error(`❌ CSV 헤더에 '${col}' 컬럼 없음. 현재 헤더: ${header.join(',')}`);
      console.error(`   스키마가 바뀌었으면 npm run eval:refresh 로 재생성하세요.`);
      process.exit(1);
    }
  }
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const { conferences } = JSON.parse(await readFile(CONF_PATH, 'utf8'));
  const byId = Object.fromEntries(conferences.map((c) => [c.id, c]));

  const cases = [];
  const skipped = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = emptyOrNull(r[idx.id]);
    if (!id) continue;
    if (id.startsWith('#')) continue;
    const link = emptyOrNull(r[idx.link]);
    const source_url = emptyOrNull(r[idx.source_url]);
    const verified_at = emptyOrNull(r[idx.verified_at]);
    const notes = emptyOrNull(r[idx.notes]);

    if (!link && !source_url) {
      skipped.push(id);
      continue;
    }
    if (!byId[id]) {
      console.warn(`⚠️  ${id}: conferences.json에 없음 (CSV에는 있지만 스킵)`);
      continue;
    }

    cases.push({
      id,
      full_name: byId[id].full_name,
      link,
      source_url,
      verified_at,
      notes,
    });
  }

  const out = {
    _generated: `이 파일은 csv-to-golden.js가 자동 생성합니다. 직접 편집하지 마세요. 편집은 docs/eval/golden-set.csv 에서.`,
    snapshot_date: new Date().toISOString().slice(0, 10),
    case_count: cases.length,
    cases,
  };

  await writeFile(JSON_PATH, JSON.stringify(out, null, 2));
  console.log(`✅ ${cases.length}건 변환 → docs/eval/golden-set.json`);
  if (skipped.length) {
    console.log(`   (미작성으로 스킵: ${skipped.length}건)`);
  }
}

main().catch((e) => {
  console.error('💥 변환 실패:', e);
  process.exit(1);
});
