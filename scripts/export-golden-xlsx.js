#!/usr/bin/env node
// conferences.json → docs/eval/snapshots/<date>.xlsx + meta.json 생성.
// 사용: node scripts/export-golden-xlsx.js [--snapshot-date YYYY-MM-DD] [--version v7]
// 스냅샷은 리뷰 후 행을 골라 docs/eval/golden-set.xlsx 로 승격.

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

async function main() {
  const args = parseArgs(process.argv);
  const snapshotDate = args.snapshotDate || todayStamp();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)) {
    console.error(`❌ --snapshot-date 형식 오류: ${snapshotDate} (YYYY-MM-DD 필요)`);
    process.exit(1);
  }

  const { DEFAULT_UPDATE_VERSION } = await import('../src/utils/promptBuilder.js');
  const activeVersion = args.version || DEFAULT_UPDATE_VERSION;

  const confPath = join(ROOT, 'public/data/conferences.json');
  const { conferences, editions } = JSON.parse(await readFile(confPath, 'utf8'));
  const rows = buildRows(conferences, editions);

  const wb = createWorkbook({ rows, snapshotDate, activeVersion });
  const buf = workbookToBuffer(wb);

  const outDir = join(ROOT, 'docs/eval/snapshots');
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const xlsxPath = join(outDir, `${snapshotDate}.xlsx`);
  const metaPath = join(outDir, `${snapshotDate}.meta.json`);
  await writeFile(xlsxPath, Buffer.from(buf));
  await writeFile(
    metaPath,
    JSON.stringify(
      {
        snapshot_date: snapshotDate,
        active_version: activeVersion,
        row_count: rows.length,
        source: 'public/data/conferences.json',
      },
      null,
      2,
    ) + '\n',
  );

  console.log(`✓ ${xlsxPath.replace(ROOT + '\\', '').replace(ROOT + '/', '')} (${rows.length} rows)`);
  console.log(`✓ ${metaPath.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
  console.log(`\nactive_version = ${activeVersion}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
