import { describe, it, expect } from 'vitest';
import { buildIcs, toIcsFilename } from './icsExport';

const FIXED_NOW = new Date(Date.UTC(2026, 3, 18, 0, 0, 0)); // 2026-04-18 00:00 UTC

const ROWS = [
  {
    id: 'conf_001',
    starred: 1,
    category: '학회',
    field: '냉동공조',
    abbreviation: 'ASHRAE',
    full_name: 'ASHRAE Winter Conference',
    region: '미주',
    official_url: 'https://www.ashrae.org/',
    upcoming: {
      start_date: '2026-03-05',
      end_date: '2026-03-08',
      venue: 'Orlando, FL',
      link: 'https://www.ashrae.org/2026winter',
      source: 'official',
    },
  },
  {
    id: 'conf_002',
    starred: 0,
    category: '박람회',
    field: '건물공조',
    full_name: 'No Dates Conf',
    upcoming: null,
  },
  {
    id: 'conf_003',
    starred: 1,
    full_name: 'Comma, Semi; Test\\ Backslash',
    upcoming: { start_date: '2026-06-10' },
  },
];

describe('buildIcs', () => {
  it('VCALENDAR 헤더·푸터·PRODID 포함', () => {
    const ics = buildIcs(ROWS, { now: FIXED_NOW });
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
    expect(ics).toMatch(/PRODID:-\/\/ConferenceFinder\/\/Calendar\/\/EN/);
    expect(ics).toMatch(/VERSION:2\.0/);
  });

  it('upcoming 없는 행은 스킵', () => {
    const ics = buildIcs(ROWS, { now: FIXED_NOW });
    expect(ics).not.toMatch(/No Dates Conf/);
  });

  it('DTSTART는 포함일, DTEND는 배타적(+1일)', () => {
    const ics = buildIcs([ROWS[0]], { now: FIXED_NOW });
    expect(ics).toMatch(/DTSTART;VALUE=DATE:20260305/);
    expect(ics).toMatch(/DTEND;VALUE=DATE:20260309/); // 3/8 + 1
  });

  it('end_date 없으면 start_date 하루짜리', () => {
    const ics = buildIcs([ROWS[2]], { now: FIXED_NOW });
    expect(ics).toMatch(/DTSTART;VALUE=DATE:20260610/);
    expect(ics).toMatch(/DTEND;VALUE=DATE:20260611/);
  });

  it('SUMMARY 특수문자 이스케이프', () => {
    const ics = buildIcs([ROWS[2]], { now: FIXED_NOW });
    expect(ics).toMatch(/SUMMARY:Comma\\, Semi\\; Test\\\\ Backslash/);
  });

  it('UID는 row.id 기반 globally unique', () => {
    const ics = buildIcs([ROWS[0]], { now: FIXED_NOW });
    expect(ics).toMatch(/UID:conf_001@conferencefinder/);
  });

  it('DTSTAMP는 UTC ZULU 형식', () => {
    const ics = buildIcs([ROWS[0]], { now: FIXED_NOW });
    expect(ics).toMatch(/DTSTAMP:20260418T000000Z/);
  });

  it('LOCATION / URL / DESCRIPTION 포함', () => {
    const ics = buildIcs([ROWS[0]], { now: FIXED_NOW });
    expect(ics).toMatch(/LOCATION:Orlando\\, FL/);
    expect(ics).toMatch(/URL:https:\/\/www\.ashrae\.org\/2026winter/);
    expect(ics).toMatch(/DESCRIPTION:.*냉동공조/);
  });

  it('X-WR-CALNAME은 calName 옵션 반영', () => {
    const ics = buildIcs([ROWS[0]], { calName: '즐겨찾기', now: FIXED_NOW });
    expect(ics).toMatch(/X-WR-CALNAME:즐겨찾기/);
  });

  it('빈 rows → 헤더/푸터만', () => {
    const ics = buildIcs([], { now: FIXED_NOW });
    expect(ics).not.toMatch(/BEGIN:VEVENT/);
    expect(ics).toMatch(/BEGIN:VCALENDAR/);
    expect(ics).toMatch(/END:VCALENDAR/);
  });
});

describe('toIcsFilename', () => {
  it('기본 형식: conferencefinder_{scope}_YYYYMMDD.ics', () => {
    const name = toIcsFilename('즐겨찾기', FIXED_NOW);
    expect(name).toBe('conferencefinder_즐겨찾기_20260418.ics');
  });

  it('공백/특수문자는 _ 로 치환', () => {
    const name = toIcsFilename('test filter!', FIXED_NOW);
    expect(name).toBe('conferencefinder_test_filter__20260418.ics');
  });
});
