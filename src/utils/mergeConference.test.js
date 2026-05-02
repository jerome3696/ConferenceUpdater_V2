import { describe, it, expect } from 'vitest';
import { mergeConference, mergeEdition, mergeAll } from './mergeConference';

describe('mergeConference', () => {
  const upstream = {
    id: 'conf_1',
    category: '학회',
    field: '열유체',
    abbreviation: 'IHTC',
    full_name: 'International Heat Transfer Conference',
    cycle_years: 4,
    duration_days: 5,
    region: '국제',
    official_url: 'https://ihtc.org',
    note: '',
    organizer: 'Begell',
    last_ai_update_at: '2026-04-01T00:00:00Z',
    source: 'upstream',
  };

  it('userRow 없으면 upstream 그대로 + starred=0', () => {
    const merged = mergeConference(upstream, null);
    expect(merged.id).toBe('conf_1');
    expect(merged.full_name).toBe('International Heat Transfer Conference');
    expect(merged.cycle_years).toBe(4);
    expect(merged.starred).toBe(0);
    expect(merged.organizer).toBe('Begell');
    expect(merged.last_ai_update_at).toBe('2026-04-01T00:00:00Z');
  });

  it('userRow.overrides 가 upstream 보다 우선', () => {
    const userRow = {
      conference_id: 'conf_1',
      starred: 1,
      overrides: { abbreviation: 'IHTC*', note: '내 메모' },
    };
    const merged = mergeConference(upstream, userRow);
    expect(merged.abbreviation).toBe('IHTC*');
    expect(merged.note).toBe('내 메모');
    expect(merged.full_name).toBe('International Heat Transfer Conference');
    expect(merged.starred).toBe(1);
  });

  it('숫자 필드 누락 시 0 으로 폴백', () => {
    const partial = { id: 'x', full_name: 'X' };
    const merged = mergeConference(partial, null);
    expect(merged.cycle_years).toBe(0);
    expect(merged.duration_days).toBe(0);
    expect(merged.region).toBe('');
  });

  it('overrides 가 빈 객체이면 upstream 사용', () => {
    const userRow = { conference_id: 'conf_1', starred: 1, overrides: {} };
    const merged = mergeConference(upstream, userRow);
    expect(merged.full_name).toBe(upstream.full_name);
    expect(merged.starred).toBe(1);
  });

  it('personal_note 가 있으면 별도 필드로 노출', () => {
    const userRow = { conference_id: 'conf_1', starred: 0, personal_note: '관심', overrides: {} };
    const merged = mergeConference(upstream, userRow);
    expect(merged.personal_note).toBe('관심');
  });
});

describe('mergeEdition', () => {
  it('upstream edition → 기존 edition 형식 (anchored=false 보강)', () => {
    const e = {
      id: 'ed_1',
      conference_id: 'conf_1',
      status: 'upcoming',
      start_date: '2027-08-15',
      end_date: '2027-08-20',
      venue: 'Tokyo',
      link: 'https://example.com',
      source: 'ai_search',
      confidence: 'high',
      updated_at: '2026-04-01T00:00:00Z',
    };
    const m = mergeEdition(e);
    expect(m).toMatchObject({
      id: 'ed_1',
      conference_id: 'conf_1',
      status: 'upcoming',
      start_date: '2027-08-15',
      anchored: false,
      anchor_set_at: null,
    });
  });

  it('null/undefined 필드는 null 로 정규화', () => {
    const e = {
      id: 'ed_2', conference_id: 'c1', status: 'past',
      start_date: null, end_date: undefined, venue: null, link: null,
      source: 'backfill', confidence: undefined, updated_at: 't',
    };
    const m = mergeEdition(e);
    expect(m.start_date).toBeNull();
    expect(m.end_date).toBeNull();
    expect(m.confidence).toBeNull();
  });
});

describe('mergeAll', () => {
  it('upstream + editions + userRows 를 합쳐 {conferences, editions} 반환', () => {
    const ups = [
      { id: 'a', full_name: 'A', cycle_years: 1, duration_days: 1 },
      { id: 'b', full_name: 'B', cycle_years: 2, duration_days: 2 },
    ];
    const eds = [
      { id: 'e1', conference_id: 'a', status: 'upcoming', source: 'ai_search', updated_at: 't' },
      { id: 'e2', conference_id: 'b', status: 'past', source: 'backfill', updated_at: 't' },
    ];
    const users = [
      { conference_id: 'a', starred: 1, overrides: { full_name: 'A!' } },
    ];
    const out = mergeAll(ups, eds, users);
    expect(out.conferences).toHaveLength(2);
    expect(out.conferences[0].full_name).toBe('A!');
    expect(out.conferences[0].starred).toBe(1);
    expect(out.conferences[1].starred).toBe(0);
    expect(out.editions).toHaveLength(2);
  });

  it('빈 입력에도 안전', () => {
    const out = mergeAll();
    expect(out).toEqual({ conferences: [], editions: [] });
  });
});
