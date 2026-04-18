import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  normalizeAbbr,
  jaroWinkler,
  tokenJaccard,
  isLikelySameConference,
  findExistingMatch,
} from './nameMatch.js';

describe('normalizeName', () => {
  it('연도 + 구두점 + stopword + ordinal 제거', () => {
    expect(normalizeName('The 13th International Conference on Heat Transfer 2026')).toBe('heat transfer');
  });

  it('ordinal token (1st, 2nd, 13th) 제거', () => {
    expect(normalizeName('1st Annual Symposium on Cryogenics')).toBe('cryogenics');
    expect(normalizeName('13th IHTC')).toBe('ihtc');
  });

  it('대소문자/연속 공백 정규화', () => {
    expect(normalizeName('  ASHRAE   Winter   Conference  ')).toBe('ashrae winter');
  });

  it('빈 문자열·null 안전', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('normalizeAbbr', () => {
  it('영숫자만 + 끝 숫자(edition) 제거', () => {
    expect(normalizeAbbr('IHTC-18')).toBe('ihtc');
    expect(normalizeAbbr('ICCFD13')).toBe('iccfd');
    expect(normalizeAbbr('ASME IMECE')).toBe('asmeimece');
    expect(normalizeAbbr('')).toBe('');
  });
});

describe('jaroWinkler', () => {
  it('완전 일치 = 1', () => {
    expect(jaroWinkler('heat transfer', 'heat transfer')).toBe(1);
  });

  it('완전 다름 ~0', () => {
    expect(jaroWinkler('abcde', 'xyzwv')).toBeLessThan(0.5);
  });

  it('prefix 보너스로 비슷한 시작 문자열 가산점', () => {
    const a = jaroWinkler('thermal management', 'thermal mgmt');
    expect(a).toBeGreaterThan(0.85);
  });

  it('빈 문자열 = 0', () => {
    expect(jaroWinkler('', 'abc')).toBe(0);
    expect(jaroWinkler('abc', '')).toBe(0);
  });
});

describe('tokenJaccard', () => {
  it('완전 동일 = 1', () => {
    expect(tokenJaccard('heat transfer', 'heat transfer')).toBe(1);
  });

  it('일부 겹침', () => {
    // 'heat transfer' (2 토큰) vs 'heat exchanger' (2 토큰) → inter=1, union=3 → 1/3
    expect(tokenJaccard('heat transfer', 'heat exchanger')).toBeCloseTo(1 / 3, 3);
  });

  it('빈 문자열 = 0', () => {
    expect(tokenJaccard('', 'a b')).toBe(0);
  });
});

describe('isLikelySameConference', () => {
  it('약칭(4자 이상) 동일 → true', () => {
    expect(isLikelySameConference(
      { full_name: 'A', abbreviation: 'IHTC' },
      { full_name: 'B', abbreviation: 'IHTC-18' },
    )).toBe(true);
  });

  it('약칭 너무 짧음(3자 이하) → 약칭만으로는 매칭 안 됨', () => {
    expect(isLikelySameConference(
      { full_name: 'Aaa Bbb', abbreviation: 'ICC' },
      { full_name: 'Ccc Ddd', abbreviation: 'ICC' },
    )).toBe(false);
  });

  it('연도만 다른 동일 학회 → true', () => {
    expect(isLikelySameConference(
      { full_name: 'ASHRAE Winter Conference 2026' },
      { full_name: 'ASHRAE Winter Conference 2027' },
    )).toBe(true);
  });

  it('회차만 다른 동일 학회 (13th vs 14th) → true', () => {
    expect(isLikelySameConference(
      { full_name: '13th International Heat Transfer Conference' },
      { full_name: '14th International Heat Transfer Conference' },
    )).toBe(true);
  });

  it('완전 다른 학회 → false', () => {
    expect(isLikelySameConference(
      { full_name: 'International Heat Transfer Conference' },
      { full_name: 'World Congress on Computational Mechanics' },
    )).toBe(false);
  });

  it('null·빈 입력 안전', () => {
    expect(isLikelySameConference(null, { full_name: 'X' })).toBe(false);
    expect(isLikelySameConference({}, {})).toBe(false);
  });
});

describe('findExistingMatch', () => {
  const EXISTING = [
    { id: 'c1', full_name: 'International Heat Transfer Conference', abbreviation: 'IHTC' },
    { id: 'c2', full_name: 'ASHRAE Winter Conference', abbreviation: 'ASHRAE Winter' },
    { id: 'c3', full_name: 'ASME International Mechanical Engineering Congress', abbreviation: 'IMECE' },
  ];

  it('약칭 매칭으로 기존 학회 발견', () => {
    const m = findExistingMatch({ full_name: 'IHTC 2027 Conference', abbreviation: 'IHTC' }, EXISTING);
    expect(m?.id).toBe('c1');
  });

  it('연도/회차만 다른 풀네임 매칭', () => {
    const m = findExistingMatch({ full_name: '14th International Heat Transfer Conference 2027' }, EXISTING);
    expect(m?.id).toBe('c1');
  });

  it('매칭 없으면 null', () => {
    const m = findExistingMatch({ full_name: 'European Symposium on Cryogenics' }, EXISTING);
    expect(m).toBeNull();
  });

  it('candidate.full_name 누락 → null', () => {
    expect(findExistingMatch({}, EXISTING)).toBeNull();
  });

  it('빈 existing 배열 → null', () => {
    expect(findExistingMatch({ full_name: 'X' }, [])).toBeNull();
  });
});
