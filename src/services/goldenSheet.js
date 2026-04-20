// Golden-set XLSX 빌더 — 브라우저·Node 양쪽에서 호출되는 순수 함수.
// canonical schema: 식별(3) → 마스터(8) → Upcoming(6) → Last(4) → 검증 메타(3) = 24컬럼.
// 컬럼명은 영문 snake_case (eval 파이프라인 안정성 우선).

import * as XLSX from 'xlsx';

export const COLUMNS = [
  // 식별
  'id',
  'abbreviation',
  'full_name',
  // 마스터
  'starred',
  'category',
  'field',
  'cycle_years',
  'duration_days',
  'region',
  'official_url',
  'note',
  // Upcoming
  'upcoming_start',
  'upcoming_end',
  'upcoming_venue',
  'upcoming_link',
  'upcoming_confidence',
  'upcoming_anchored',
  // Last
  'last_start',
  'last_end',
  'last_venue',
  'last_link',
  // 검증 메타
  'verified_at',
  'source_url',
  'notes',
];

export const SHEET_NAME = 'golden';
export const META_SHEET_NAME = '_meta';

// MainTable 과 동일한 선택 규칙: upcoming = 가장 이른 upcoming edition, last = 가장 늦은 past edition.
// (단 start_date 없는 edition 은 배제)
export function buildRows(conferences, editions) {
  return conferences.map((c) => {
    const mine = editions.filter((e) => e.conference_id === c.id);
    const upcoming = mine
      .filter((e) => e.status === 'upcoming' && e.start_date)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    const last = mine
      .filter((e) => e.status === 'past' && e.start_date)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
    return { ...c, upcoming, last };
  });
}

// row(master+upcoming+last) + metaOverlay(id→{verified_at,source_url,notes}) → sheet row (24컬럼).
export function toSheetRow(row, meta = {}) {
  return {
    id: row.id || '',
    abbreviation: row.abbreviation || '',
    full_name: row.full_name || '',
    starred: row.starred ? 1 : 0,
    category: row.category || '',
    field: row.field || '',
    cycle_years: row.cycle_years ?? '',
    duration_days: row.duration_days ?? '',
    region: row.region || '',
    official_url: row.official_url || '',
    note: row.note || '',
    upcoming_start: row.upcoming?.start_date || '',
    upcoming_end: row.upcoming?.end_date || '',
    upcoming_venue: row.upcoming?.venue || '',
    upcoming_link: row.upcoming?.link || '',
    upcoming_confidence: row.upcoming?.confidence || '',
    upcoming_anchored: row.upcoming?.anchored ? 1 : 0,
    last_start: row.last?.start_date || '',
    last_end: row.last?.end_date || '',
    last_venue: row.last?.venue || '',
    last_link: row.last?.link || '',
    verified_at: meta.verified_at || '',
    source_url: meta.source_url || '',
    notes: meta.notes || '',
  };
}

export function toSheetData(rows, metaOverlay = {}) {
  return rows.map((r) => toSheetRow(r, metaOverlay[r.id] || {}));
}

// 24컬럼 시트 + _meta 시트 2장 구성의 workbook.
// snapshotDate: 'YYYY-MM-DD' 문자열. activeVersion: 'v7' 같은 프롬프트 버전.
export function createWorkbook({ rows, snapshotDate, activeVersion, metaOverlay = {}, generatorVersion = '1' }) {
  const data = toSheetData(rows, metaOverlay);
  const ws = XLSX.utils.json_to_sheet(data, { header: COLUMNS });
  ws['!cols'] = COLUMNS.map((k) => {
    const maxLen = Math.max(
      k.length,
      ...data.map((row) => String(row[k] ?? '').length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
  });

  const metaRows = [
    { key: 'snapshot_date', value: snapshotDate || '' },
    { key: 'active_version', value: activeVersion || '' },
    { key: 'row_count', value: data.length },
    { key: 'generator_version', value: generatorVersion },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaRows, { header: ['key', 'value'] });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  XLSX.utils.book_append_sheet(wb, wsMeta, META_SHEET_NAME);
  return wb;
}

// XLSX ArrayBuffer 반환 — Node 는 writeFile, 브라우저는 Blob 으로 래핑.
export function workbookToBuffer(wb) {
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

// 역변환: workbook → { rows, meta }. import 스크립트·테스트용.
export function parseWorkbook(wb) {
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) throw new Error(`Missing sheet: ${SHEET_NAME}`);
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const metaWs = wb.Sheets[META_SHEET_NAME];
  const meta = {};
  if (metaWs) {
    const metaRows = XLSX.utils.sheet_to_json(metaWs, { defval: '' });
    for (const r of metaRows) {
      if (r.key) meta[r.key] = r.value;
    }
  }
  return { rows, meta };
}
