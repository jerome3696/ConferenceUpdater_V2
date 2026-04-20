#!/usr/bin/env node
// 1회성 이식기: 기존 docs/eval/golden-set.csv(link-only 5컬럼) → docs/eval/golden-set.xlsx(24컬럼).
// 사용: node scripts/migrate-csv-to-xlsx.js [--snapshot-date YYYY-MM-DD] [--version v7]
// conferences.json 의 master+upcoming+last 를 병합하고 CSV 의 검증 메타 3컬럼을 overlay.
// CSV 의 link 는 upcoming_link 의 fallback (conferences.json 에 upcoming 이 없을 때만 사용).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRows, createWorkbook, workbookToBuffer } from '../src/services/goldenSheet.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { snapshotDate: null, version: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--snapshot-date') args.snapshotDate = argv[++i];
    else if (a === '--version') args.version = argv[++i];
  }
  return args;
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 주석(#...) 행 스킵 + BOM 제거 + 따옴표 최소 대응. CSV 값 안에 콤마가 없어서 단순 split 으로 충분.
function parseCsv(text) {
  const stripped = text.replace(/^\uFEFF/, '');
  const lines = stripped.split(/\r?\n/).filter((l) => l && !l.trimStart().startsWith('#'));
  if (lines.length === 0) return [];
  const [header, ...rows] = lines;
  const cols = header.split(',').map((c) => c.trim());
  return rows.map((line) => {
    const vals = line.split(',');
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = (vals[i] ?? '').trim();
    return obj;
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const snapshotDate = args.snapshotDate || todayStamp();
  const { DEFAULT_UPDATE_VERSION } = await import('../src/utils/promptBuilder.js');
  const activeVersion = args.version || DEFAULT_UPDATE_VERSION;

  const csvPath = join(ROOT, 'docs/eval/golden-set.csv');
  const csvText = await readFile(csvPath, 'utf8');
  const csvRows = parseCsv(csvText).filter((r) => r.id && r.id.startsWith('conf_'));
  console.log(`CSV 행 수: ${csvRows.length}`);

  const { conferences, editions } = JSON.parse(
    await readFile(join(ROOT, 'public/data/conferences.json'), 'utf8'),
  );
  const allRows = buildRows(conferences, editions);
  const byId = new Map(allRows.map((r) => [r.id, r]));

  // CSV 에 있는 id 만 선별. 없으면 경고.
  const selectedRows = [];
  const metaOverlay = {};
  for (const csv of csvRows) {
    const row = byId.get(csv.id);
    if (!row) {
      console.warn(`⚠️  ${csv.id}: conferences.json 에 없음. 스킵.`);
      continue;
    }
    // CSV link 는 upcoming_link fallback. conferences.json 에 upcoming.link 없을 때만 사용.
    const patched = { ...row };
    if (!patched.upcoming?.link && csv.link) {
      patched.upcoming = { ...(patched.upcoming || {}), link: csv.link };
    }
    selectedRows.push(patched);
    metaOverlay[csv.id] = {
      verified_at: csv.verified_at || '',
      source_url: csv.source_url || '',
      notes: csv.notes || '',
    };
  }
  console.log(`매핑 성공: ${selectedRows.length}건`);

  const wb = createWorkbook({ rows: selectedRows, snapshotDate, activeVersion, metaOverlay });
  const buf = workbookToBuffer(wb);

  const outDir = join(ROOT, 'docs/eval');
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  const xlsxPath = join(outDir, 'golden-set.xlsx');
  const metaPath = join(outDir, 'golden-set.meta.json');
  await writeFile(xlsxPath, Buffer.from(buf));
  await writeFile(
    metaPath,
    JSON.stringify(
      {
        snapshot_date: snapshotDate,
        active_version: activeVersion,
        row_count: selectedRows.length,
        migrated_from: 'docs/eval/golden-set.csv',
      },
      null,
      2,
    ) + '\n',
  );

  console.log(`\n✓ ${xlsxPath.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
  console.log(`✓ ${metaPath.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
  console.log(`\n다음 단계: node scripts/import-golden-xlsx.js 실행 → parsed.json 생성 확인`);
}

main().catch((e) => { console.error(e); process.exit(1); });
