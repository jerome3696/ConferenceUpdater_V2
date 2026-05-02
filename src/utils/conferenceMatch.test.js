import { describe, it, expect } from 'vitest';
import { findUpstreamMatch } from './conferenceMatch.js';

const UPSTREAM = [
  {
    id: 'u1',
    full_name: 'International Heat Transfer Conference',
    abbreviation: 'IHTC',
    official_url: 'https://www.ihtc18.org/',
  },
  {
    id: 'u2',
    full_name: 'ASHRAE Winter Conference',
    abbreviation: 'ASHRAE Winter',
    official_url: 'https://ashrae.org/conferences/winter',
  },
  {
    id: 'u3',
    full_name: 'ASME International Mechanical Engineering Congress',
    abbreviation: 'IMECE',
    official_url: 'https://event.asme.org/IMECE',
  },
];

describe('findUpstreamMatch — URL 매칭', () => {
  it('URL exact match (정규화 후 동일) → 매치', () => {
    const candidate = {
      full_name: 'Some New Name',
      official_url: 'https://ihtc18.org',
    };
    const result = findUpstreamMatch(candidate, UPSTREAM);
    expect(result?.id).toBe('u1');
  });

  it('www. 프리픽스 차이 → 매치', () => {
    const candidate = {
      full_name: 'Different Name',
      official_url: 'http://www.ihtc18.org',
    };
    const result = findUpstreamMatch(candidate, UPSTREAM);
    expect(result?.id).toBe('u1');
  });

  it('trailing slash 차이 → 매치', () => {
    const candidate = {
      full_name: 'Different Name',
      official_url: 'https://ashrae.org/conferences/winter/',
    };
    const result = findUpstreamMatch(candidate, UPSTREAM);
    expect(result?.id).toBe('u2');
  });
});

describe('findUpstreamMatch — 이름 fuzzy 매칭', () => {
  it('URL 다르지만 이름 fuzzy match → 매치', () => {
    const candidate = {
      full_name: '14th International Heat Transfer Conference 2027',
      official_url: 'https://ihtc2027.org',
    };
    // ihtc2027.org 은 UPSTREAM 에 없으므로 URL 매칭 실패 → 이름 fuzzy 로 u1 검출
    const result = findUpstreamMatch(candidate, UPSTREAM);
    expect(result?.id).toBe('u1');
  });

  it('약칭 동일(4자 이상) → 매치', () => {
    const candidate = {
      full_name: 'IMECE 2027',
      abbreviation: 'IMECE',
      official_url: 'https://unknown-domain.example.com',
    };
    const result = findUpstreamMatch(candidate, UPSTREAM);
    expect(result?.id).toBe('u3');
  });
});

describe('findUpstreamMatch — null 반환 케이스', () => {
  it('URL 도 이름도 전혀 다르면 → null', () => {
    const candidate = {
      full_name: 'World Congress on Computational Mechanics',
      official_url: 'https://wccm2027.org',
    };
    expect(findUpstreamMatch(candidate, UPSTREAM)).toBeNull();
  });

  it('candidate 가 빈 객체 → null', () => {
    expect(findUpstreamMatch({}, UPSTREAM)).toBeNull();
  });

  it('upstream 빈 배열 → null', () => {
    const candidate = { full_name: 'International Heat Transfer Conference', official_url: 'https://ihtc18.org' };
    expect(findUpstreamMatch(candidate, [])).toBeNull();
  });

  it('candidate 가 null → null', () => {
    expect(findUpstreamMatch(null, UPSTREAM)).toBeNull();
  });

  it('candidate 에 official_url 도 full_name 도 없으면 → null', () => {
    expect(findUpstreamMatch({ abbreviation: 'IHTC' }, UPSTREAM)).toBeNull();
  });
});
