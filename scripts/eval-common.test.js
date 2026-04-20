// eval-common.js — scoring · weights 파서 단위 테스트.

import { describe, it, expect } from 'vitest';
import { scoreCase, parseWeights, DEFAULT_WEIGHTS } from './eval-common.js';

const GOLDEN_FULL = {
  id: 'conf_001',
  upcoming_start: '2027-01-23',
  upcoming_end: '2027-01-27',
  upcoming_venue: 'Chicago, USA',
  upcoming_link: 'https://www.ashrae.org/conferences/2027-winter-conference',
  source_url: 'https://www.ashrae.org/',
};

describe('parseWeights', () => {
  it('빈 값이면 기본값', () => {
    expect(parseWeights()).toEqual(DEFAULT_WEIGHTS);
  });

  it('일부 필드만 덮어쓰기', () => {
    const w = parseWeights('link=0.5,start=0.3');
    expect(w.link).toBe(0.5);
    expect(w.start).toBe(0.3);
    expect(w.end).toBe(DEFAULT_WEIGHTS.end);
    expect(w.venue).toBe(DEFAULT_WEIGHTS.venue);
  });

  it('음수 거부', () => {
    expect(() => parseWeights('link=-0.1')).toThrow();
  });

  it('모르는 필드 거부', () => {
    expect(() => parseWeights('foo=0.5')).toThrow();
  });
});

describe('scoreCase — 전체 일치', () => {
  it('4필드 pass 시 score=1 status=pass', () => {
    const ai = {
      start_date: '2027-01-23',
      end_date: '2027-01-27',
      venue: 'Chicago, IL, USA',
      link: 'https://www.ashrae.org/conferences/2027-winter-conference',
    };
    const r = scoreCase(GOLDEN_FULL, ai);
    expect(r.fields.link.status).toBe('pass');
    expect(r.fields.start.status).toBe('pass');
    expect(r.fields.end.status).toBe('pass');
    expect(r.fields.venue.status).toBe('pass');
    expect(r.score).toBe(1);
    expect(r.status).toBe('pass');
  });
});

describe('scoreCase — 부분 일치', () => {
  it('link 만 pass → score=0.6 → partial', () => {
    const ai = {
      start_date: null,
      end_date: null,
      venue: null,
      link: 'https://www.ashrae.org/conferences/2027-winter-conference',
    };
    const r = scoreCase(GOLDEN_FULL, ai);
    expect(r.fields.link.status).toBe('pass');
    expect(r.fields.start.status).toBe('fail');
    expect(r.score).toBeCloseTo(0.6);
    expect(r.status).toBe('partial');
  });

  it('link fail + 나머지 pass → 0.4 → fail', () => {
    const ai = {
      start_date: '2027-01-23',
      end_date: '2027-01-27',
      venue: 'Chicago',
      link: 'https://wikicfp.com/',
    };
    const r = scoreCase(GOLDEN_FULL, ai);
    expect(r.fields.link.status).toBe('fail');
    expect(r.score).toBeCloseTo(0.4);
    expect(r.status).toBe('fail');
  });
});

describe('scoreCase — venue 토큰 매칭', () => {
  it('"Chicago, USA" ↔ "Chicago, IL, USA" pass', () => {
    const ai = { ...{ start_date: null, end_date: null, link: null }, venue: 'Chicago, IL, USA' };
    const r = scoreCase({ upcoming_venue: 'Chicago, USA' }, ai);
    expect(r.fields.venue.status).toBe('pass');
  });

  it('"Chicago" ↔ "New York" fail', () => {
    const ai = { venue: 'New York, USA' };
    const r = scoreCase({ upcoming_venue: 'Chicago, USA' }, ai);
    expect(r.fields.venue.status).toBe('fail');
  });
});

describe('scoreCase — expected 빈 값 필드 제외', () => {
  it('venue expected 없으면 채점 제외 + 남은 3필드 재분배', () => {
    const golden = {
      upcoming_start: '2027-01-23',
      upcoming_end: '2027-01-27',
      upcoming_link: 'https://www.ashrae.org/',
      // upcoming_venue 없음
    };
    const ai = {
      start_date: '2027-01-23',
      end_date: '2027-01-27',
      link: 'https://www.ashrae.org/',
      venue: 'Mars',  // AI 가 아무거나 답해도 채점 안됨
    };
    const r = scoreCase(golden, ai);
    expect(r.fields.venue).toBeUndefined();
    expect(Object.keys(r.fields).sort()).toEqual(['end', 'link', 'start']);
    expect(r.score).toBe(1);
    expect(r.status).toBe('pass');
  });

  it('link 만 expected → link fail → score=0 → fail', () => {
    const r = scoreCase(
      { upcoming_link: 'https://a.example/' },
      { link: 'https://b.example/' },
    );
    expect(r.fields.link.status).toBe('fail');
    expect(r.score).toBe(0);
    expect(r.status).toBe('fail');
  });

  it('expected 0 필드 → no_expected', () => {
    const r = scoreCase({}, { link: 'https://a.example/' });
    expect(r.status).toBe('no_expected');
  });
});

describe('scoreCase — 커스텀 가중치', () => {
  it('link=1 나머지=0 이면 link 만 score 에 기여', () => {
    const w = { link: 1, start: 0, end: 0, venue: 0 };
    const ai = {
      start_date: 'wrong', end_date: 'wrong', venue: 'wrong',
      link: 'https://www.ashrae.org/conferences/2027-winter-conference',
    };
    const r = scoreCase(GOLDEN_FULL, ai, w);
    expect(r.fields.link.status).toBe('pass');
    expect(r.score).toBe(1);
  });
});
