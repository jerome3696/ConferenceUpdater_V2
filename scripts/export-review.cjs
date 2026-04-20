// 검수용 Excel 내보내기. 현재 public/data/conferences.json 을 읽어
// master + edition 조인한 행을 한 시트에 풀어낸다.
// 사용자는 Excel 에서 편집(특히 past 회차) 후 저장 → scripts/output/last-editions-review.xlsx
// 이후 scripts/import-review.cjs 가 다시 읽어 conferences.json 에 반영.

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public/data/conferences.json');
const OUT_DIR = path.join(ROOT, 'scripts/output');
const OUT = path.join(OUT_DIR, 'last-editions-review.xlsx');

const db = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const masterById = new Map(db.conferences.map((c) => [c.id, c]));

const rows = db.editions.map((e) => {
  const m = masterById.get(e.conference_id) || {};
  return {
    edition_id: e.id,
    conference_id: e.conference_id,
    full_name: m.full_name || '',
    abbreviation: m.abbreviation || '',
    cycle_years: m.cycle_years ?? '',
    region: m.region || '',
    official_url: m.official_url || '',
    status: e.status,
    start_date: e.start_date || '',
    end_date: e.end_date || '',
    venue: e.venue || '',
    link: e.link || '',
    source: e.source || '',
    confidence: e.confidence || '',
    notes: e.notes || '',
    source_url: e.source_url || '',
    updated_at: e.updated_at || '',
  };
});

// 정렬: conference_id asc, status(past→upcoming), start_date desc
const statusOrder = { past: 0, upcoming: 1 };
rows.sort((a, b) => {
  if (a.conference_id !== b.conference_id) return a.conference_id.localeCompare(b.conference_id);
  const so = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
  if (so !== 0) return so;
  return String(b.start_date).localeCompare(String(a.start_date));
});

const ws = XLSX.utils.json_to_sheet(rows, {
  header: [
    'edition_id', 'conference_id', 'full_name', 'abbreviation', 'cycle_years', 'region', 'official_url',
    'status', 'start_date', 'end_date', 'venue', 'link',
    'source', 'confidence', 'notes', 'source_url', 'updated_at',
  ],
});

ws['!cols'] = [
  { wch: 18 }, { wch: 16 }, { wch: 42 }, { wch: 12 }, { wch: 5 }, { wch: 8 }, { wch: 36 },
  { wch: 9 }, { wch: 11 }, { wch: 11 }, { wch: 40 }, { wch: 36 },
  { wch: 12 }, { wch: 10 }, { wch: 50 }, { wch: 40 }, { wch: 24 },
];
// 첫 행 freeze
ws['!freeze'] = { xSplit: 0, ySplit: 1 };

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'editions');

// 두 번째 시트: masters only (참고용)
const mastersSheet = XLSX.utils.json_to_sheet(
  db.conferences.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    abbreviation: c.abbreviation || '',
    category: c.category || '',
    field: c.field || '',
    region: c.region || '',
    cycle_years: c.cycle_years ?? '',
    duration_days: c.duration_days ?? '',
    official_url: c.official_url || '',
    note: c.note || '',
  })),
);
mastersSheet['!cols'] = [
  { wch: 16 }, { wch: 42 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
  { wch: 6 }, { wch: 6 }, { wch: 42 }, { wch: 30 },
];
XLSX.utils.book_append_sheet(wb, mastersSheet, 'masters');

fs.mkdirSync(OUT_DIR, { recursive: true });
XLSX.writeFile(wb, OUT);

const pastCount = rows.filter((r) => r.status === 'past').length;
const upCount = rows.filter((r) => r.status === 'upcoming').length;
console.log('Wrote:', OUT);
console.log('  editions:', rows.length, '(past=' + pastCount + ', upcoming=' + upCount + ')');
console.log('  masters:', db.conferences.length);
