// goldenSheet.js 순수 함수 테스트 — buildRows·toSheetRow·createWorkbook·parseWorkbook 라운드트립.

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';

import {
  COLUMNS,
  SHEET_NAME,
  META_SHEET_NAME,
  buildRows,
  toSheetRow,
  createWorkbook,
  parseWorkbook,
  workbookToBuffer,
} from './goldenSheet.js';

const SAMPLE_CONFERENCES = [
  {
    id: 'conf_001',
    starred: 0,
    category: '학회',
    field: '냉동공조',
    abbreviation: '',
    full_name: 'Alpha',
    cycle_years: 1,
    duration_days: 5,
    region: '미주',
    official_url: 'https://a.example/',
    note: '',
  },
  {
    id: 'conf_002',
    starred: 1,
    category: '박람회',
    field: '기타',
    abbreviation: 'BETA',
    full_name: 'Beta Conference',
    cycle_years: 4,
    duration_days: 3,
    region: '유럽',
    official_url: 'https://b.example/',
    note: 'note-b',
  },
];

const SAMPLE_EDITIONS = [
  // conf_001 upcoming + past
  {
    id: 'ed_a1', conference_id: 'conf_001', status: 'upcoming',
    start_date: '2027-01-23', end_date: '2027-01-27', venue: 'Chicago, USA',
    link: 'https://a.example/2027/', confidence: 'high', anchored: true,
  },
  {
    id: 'ed_a2', conference_id: 'conf_001', status: 'past',
    start_date: '2026-01-31', end_date: '2026-02-04', venue: 'Las Vegas, USA',
    link: 'https://a.example/2026/',
  },
  // conf_001 지난 upcoming (비교용) — start_date 더 늦음 → 선택 안 됨
  {
    id: 'ed_a3', conference_id: 'conf_001', status: 'upcoming',
    start_date: '2028-01-22', end_date: '2028-01-26', venue: 'NY, USA', link: 'https://a.example/2028/',
  },
  // conf_002 는 start_date 없는 upcoming 하나만 → upcoming = undefined
  {
    id: 'ed_b1', conference_id: 'conf_002', status: 'upcoming',
    start_date: null, end_date: null, venue: null, link: null,
  },
];

describe('buildRows', () => {
  it('upcoming = 가장 이른 start_date, last = 가장 늦은 past start_date', () => {
    const rows = buildRows(SAMPLE_CONFERENCES, SAMPLE_EDITIONS);
    expect(rows).toHaveLength(2);
    const a = rows[0];
    expect(a.id).toBe('conf_001');
    expect(a.upcoming?.start_date).toBe('2027-01-23');  // ed_a1 (ed_a3 는 더 늦음)
    expect(a.last?.start_date).toBe('2026-01-31');
  });

  it('start_date 없는 edition 은 upcoming/last 에서 배제', () => {
    const rows = buildRows(SAMPLE_CONFERENCES, SAMPLE_EDITIONS);
    const b = rows[1];
    expect(b.id).toBe('conf_002');
    expect(b.upcoming).toBeUndefined();
    expect(b.last).toBeUndefined();
  });
});

describe('toSheetRow', () => {
  it('24컬럼 전부 키로 가짐', () => {
    const rows = buildRows(SAMPLE_CONFERENCES, SAMPLE_EDITIONS);
    const sr = toSheetRow(rows[0]);
    expect(Object.keys(sr).sort()).toEqual([...COLUMNS].sort());
  });

  it('upcoming/last 누락 시 빈 문자열', () => {
    const rows = buildRows(SAMPLE_CONFERENCES, SAMPLE_EDITIONS);
    const sr = toSheetRow(rows[1]);
    expect(sr.upcoming_start).toBe('');
    expect(sr.upcoming_link).toBe('');
    expect(sr.last_start).toBe('');
  });

  it('metaOverlay 가 verified_at/source_url/notes 주입', () => {
    const rows = buildRows(SAMPLE_CONFERENCES, SAMPLE_EDITIONS);
    const sr = toSheetRow(rows[0], {
      verified_at: '2026-04-20',
      source_url: 'https://src.example/',
      notes: 'verified',
    });
    expect(sr.verified_at).toBe('2026-04-20');
    expect(sr.source_url).toBe('https://src.example/');
    expect(sr.notes).toBe('verified');
  });

  it('starred 는 0/1 로 정규화', () => {
    const rows = buildRows(SAMPLE_CONFERENCES, SAMPLE_EDITIONS);
    expect(toSheetRow(rows[0]).starred).toBe(0);
    expect(toSheetRow(rows[1]).starred).toBe(1);
  });

  it('upcoming.anchored 가 1/0 로 정규화', () => {
    const rows = buildRows(SAMPLE_CONFERENCES, SAMPLE_EDITIONS);
    expect(toSheetRow(rows[0]).upcoming_anchored).toBe(1);
    expect(toSheetRow(rows[1]).upcoming_anchored).toBe(0);
  });
});

describe('createWorkbook + parseWorkbook 라운드트립', () => {
  it('rows + meta 보존', () => {
    const rows = buildRows(SAMPLE_CONFERENCES, SAMPLE_EDITIONS);
    const wb = createWorkbook({
      rows,
      snapshotDate: '2026-04-20',
      activeVersion: 'v7',
      metaOverlay: { conf_001: { verified_at: '2026-04-20', source_url: 'https://s', notes: 'n' } },
    });
    const { rows: out, meta } = parseWorkbook(wb);

    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('conf_001');
    expect(out[0].upcoming_start).toBe('2027-01-23');
    expect(out[0].verified_at).toBe('2026-04-20');
    expect(meta.snapshot_date).toBe('2026-04-20');
    expect(meta.active_version).toBe('v7');
    expect(meta.row_count).toBe(2);
  });

  it('buffer 직렬화 → re-read 라운드트립', () => {
    const rows = buildRows(SAMPLE_CONFERENCES, SAMPLE_EDITIONS);
    const wb = createWorkbook({ rows, snapshotDate: '2026-04-20', activeVersion: 'v4' });
    const buf = workbookToBuffer(wb);
    const wb2 = XLSX.read(buf, { type: 'array' });
    const { rows: out } = parseWorkbook(wb2);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('conf_001');
  });

  it('두 시트 이름이 기대값', () => {
    const rows = buildRows(SAMPLE_CONFERENCES, SAMPLE_EDITIONS);
    const wb = createWorkbook({ rows, snapshotDate: '2026-04-20', activeVersion: 'v4' });
    expect(wb.SheetNames).toEqual([SHEET_NAME, META_SHEET_NAME]);
  });
});
