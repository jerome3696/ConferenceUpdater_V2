// 검수 Excel (last-editions-review.xlsx) 을 다시 읽어 public/data/conferences.json 에 반영.
// 기본: dry-run (diff만 출력). --apply 플래그로 실제 기록.
// 사용:
//   node scripts/import-review.cjs           # dry-run
//   node scripts/import-review.cjs --apply   # 실제 반영

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'public/data/conferences.json');
const XLSX_PATH = path.join(ROOT, 'scripts/output/last-editions-review.xlsx');

const apply = process.argv.includes('--apply');

const db = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const wb = XLSX.readFile(XLSX_PATH);
const sheet = wb.Sheets['editions'];
if (!sheet) {
  console.error('ERROR: xlsx 에 "editions" 시트 없음');
  process.exit(1);
}
const xlsxRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

// 정규화 헬퍼
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeDate(v) {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v || '').trim();
  if (!s) return '';
  if (DATE_RE.test(s)) return s;
  return s; // 검증 실패 시 원본 유지 → 경고로 노출
}
function str(v) { return String(v ?? '').trim(); }

const masterIds = new Set(db.conferences.map((c) => c.id));
const oldEditionsById = new Map(db.editions.map((e) => [e.id, e]));

const nextEditions = [];
const warnings = [];
const changes = { added: [], updated: [], unchanged: 0, removed: [] };

const seenIds = new Set();
for (const row of xlsxRows) {
  const editionId = str(row.edition_id);
  const confId = str(row.conference_id);
  const status = str(row.status);
  const startDate = normalizeDate(row.start_date);
  const endDate = normalizeDate(row.end_date);

  if (!confId) { warnings.push(`행 skip — conference_id 비어있음 (edition_id=${editionId || '(빈값)'})`); continue; }
  if (!masterIds.has(confId)) { warnings.push(`행 skip — conference_id "${confId}" 가 masters 에 없음`); continue; }
  if (!status) { warnings.push(`행 skip — status 비어있음 (${editionId || confId})`); continue; }
  if (startDate && !DATE_RE.test(startDate)) warnings.push(`날짜 형식 경고: ${editionId || confId} start_date="${startDate}"`);
  if (endDate && !DATE_RE.test(endDate)) warnings.push(`날짜 형식 경고: ${editionId || confId} end_date="${endDate}"`);

  const id = editionId || `ed_last_${confId.replace(/^conf_/, '').replace(/^user_/, '').replace(/^disc_/, '')}_${Date.now().toString(36).slice(-4)}`;
  if (seenIds.has(id)) { warnings.push(`중복 edition_id: ${id} — 두 번째 이후 skip`); continue; }
  seenIds.add(id);

  const rec = {
    id,
    conference_id: confId,
    status,
    start_date: startDate,
    end_date: endDate,
    venue: str(row.venue),
    link: str(row.link),
  };
  const source = str(row.source);
  const confidence = str(row.confidence);
  const notes = str(row.notes);
  const sourceUrl = str(row.source_url);
  const updatedAt = str(row.updated_at);
  if (source) rec.source = source;
  if (confidence) rec.confidence = confidence;
  if (notes) rec.notes = notes;
  if (sourceUrl) rec.source_url = sourceUrl;
  rec.updated_at = updatedAt || new Date().toISOString();

  const old = oldEditionsById.get(id);
  if (!old) {
    changes.added.push(rec);
  } else {
    const differ = Object.keys(rec).some((k) => k !== 'updated_at' && JSON.stringify(rec[k]) !== JSON.stringify(old[k]));
    if (differ) changes.updated.push({ before: old, after: rec });
    else { changes.unchanged++; rec.updated_at = old.updated_at; }
  }
  nextEditions.push(rec);
}

// 삭제 감지: xlsx 에 없던 기존 edition 은 제거된 것으로 간주하되, 안전상 기록만 하고 유지 옵션 제공
for (const [oid, oed] of oldEditionsById) {
  if (!seenIds.has(oid)) changes.removed.push(oed);
}

// 리포트
console.log('=== Import review ===');
console.log(`xlsx rows  : ${xlsxRows.length}`);
console.log(`added      : ${changes.added.length}`);
console.log(`updated    : ${changes.updated.length}`);
console.log(`unchanged  : ${changes.unchanged}`);
console.log(`removed    : ${changes.removed.length} (xlsx 에 없는 기존 edition)`);
console.log(`warnings   : ${warnings.length}`);
console.log();

if (changes.added.length) {
  console.log('--- ADDED ---');
  changes.added.forEach((r) => console.log(`  + ${r.id} | ${r.conference_id} | ${r.status} | ${r.start_date}~${r.end_date} | ${r.venue}`));
  console.log();
}
if (changes.updated.length) {
  console.log('--- UPDATED (주요 필드 변경) ---');
  for (const { before, after } of changes.updated) {
    const fields = ['status', 'start_date', 'end_date', 'venue', 'link', 'confidence', 'notes'];
    const diffs = fields.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]));
    if (diffs.length === 0) continue;
    console.log(`  * ${after.id} (${after.conference_id})`);
    diffs.forEach((f) => console.log(`      ${f}: ${JSON.stringify(before[f])} → ${JSON.stringify(after[f])}`));
  }
  console.log();
}
if (changes.removed.length) {
  console.log('--- REMOVED (xlsx 에서 사라짐) ---');
  changes.removed.forEach((r) => console.log(`  - ${r.id} | ${r.conference_id} | ${r.status} | ${r.start_date}`));
  console.log('  ⚠ 이 레코드들을 실제로 제거하려면 --apply 시 자동 반영됨. 유지하려면 xlsx 에 다시 추가해야 함.');
  console.log();
}
if (warnings.length) {
  console.log('--- WARNINGS ---');
  warnings.forEach((w) => console.log('  ! ' + w));
  console.log();
}

if (!apply) {
  console.log('(dry-run — 실제 반영하려면 --apply 플래그 추가)');
  process.exit(0);
}

db.editions = nextEditions;
fs.writeFileSync(JSON_PATH, JSON.stringify(db, null, 2) + '\n');
console.log('✅ conferences.json 갱신 완료. editions=' + nextEditions.length);
