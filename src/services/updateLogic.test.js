import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldSearch, filterSearchTargets } from './updateLogic.js';

// daysUntil 은 todayIso() 기본값을 쓰므로 테스트에선 명시 start_date 를 상대 기준으로 계산.
// 기준일을 고정하기 위해 vi.useFakeTimers 로 시스템 시간을 2026-04-20 로 pin.
const TODAY = '2026-04-20';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T00:00:00Z'));
});
afterEach(() => vi.useRealTimers());

// start_date 가 today + N 일이 되도록 만드는 헬퍼.
function daysFromToday(n) {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function makeRow({
  daysToNext = 400,
  link = 'https://ashrae.org/',
  cycle_years = 1,
  abbreviation = 'ASHRAE',
  official_url = 'https://www.ashrae.org/',
  anchored = false,
  missingField = null,
} = {}) {
  const upcoming = {
    start_date: daysFromToday(daysToNext),
    end_date: daysFromToday(daysToNext + 3),
    venue: 'Seoul',
    link,
    anchored,
  };
  if (missingField) upcoming[missingField] = '';
  return { abbreviation, official_url, cycle_years, upcoming };
}

describe('shouldSearch — anchor 보호', () => {
  it('anchored=true 이면 general 모드에서 pass', () => {
    expect(shouldSearch(makeRow({ anchored: true }))).toBe(false);
  });

  it('anchored=true 이면 precise 모드에서도 pass', () => {
    expect(shouldSearch(makeRow({ anchored: true }), 'precise')).toBe(false);
  });

  it('anchored=true 이지만 link 빈 값이어도 pass (앵커 최우선)', () => {
    const row = makeRow({ anchored: true });
    row.upcoming.link = '';
    expect(shouldSearch(row)).toBe(false);
  });
});

describe('shouldSearch — 필수 필드 미비', () => {
  it('upcoming 없으면 검색', () => {
    expect(shouldSearch({})).toBe(true);
    expect(shouldSearch({ upcoming: null })).toBe(true);
  });

  it('start_date 누락 → 검색', () => {
    expect(shouldSearch(makeRow({ missingField: 'start_date' }))).toBe(true);
  });

  it('end_date 누락 → 검색', () => {
    expect(shouldSearch(makeRow({ missingField: 'end_date' }))).toBe(true);
  });

  it('venue 누락 → 검색', () => {
    expect(shouldSearch(makeRow({ missingField: 'venue' }))).toBe(true);
  });

  it('link 누락 → 검색', () => {
    expect(shouldSearch(makeRow({ missingField: 'link' }))).toBe(true);
  });
});

describe('shouldSearch — precise 모드', () => {
  it('precise 는 앵커 제외 모두 검색 (고신뢰 URL + 먼 미래도)', () => {
    const row = makeRow({ daysToNext: 800, link: 'https://ashrae.org/' });
    expect(shouldSearch(row, 'general')).toBe(false);
    expect(shouldSearch(row, 'precise')).toBe(true);
  });
});

describe('shouldSearch — URL 신뢰도 × 남은 일수 (general)', () => {
  it('1년 이내 + official (high) → pass', () => {
    const row = makeRow({ daysToNext: 180, link: 'https://www.ashrae.org/' });
    expect(shouldSearch(row)).toBe(false);
  });

  it('1년 이내 + edition host (high) → pass', () => {
    const row = makeRow({
      daysToNext: 100,
      link: 'https://ecos2026.insae.ro/',
      abbreviation: 'ECOS',
      official_url: 'https://insae.ro',
    });
    expect(shouldSearch(row)).toBe(false);
  });

  it('1년 이내 + unknown (medium) → 검색', () => {
    const row = makeRow({ daysToNext: 180, link: 'https://random-host.com/', official_url: 'https://other.org' });
    expect(shouldSearch(row)).toBe(true);
  });

  it('1년 이내 + news (low) → 검색', () => {
    const row = makeRow({ daysToNext: 180, link: 'https://news.example.com/article', official_url: 'https://other.org' });
    expect(shouldSearch(row)).toBe(true);
  });

  it('1년 이내 + listing (low) → 검색', () => {
    const row = makeRow({ daysToNext: 180, link: 'https://www.wikicfp.com/cfp/1', official_url: 'https://other.org' });
    expect(shouldSearch(row)).toBe(true);
  });
});

describe('shouldSearch — cycle 절반 이내 (general)', () => {
  it('4년 주기, 2년 후 (절반 초과 남음), high → pass', () => {
    // daysToNext 730 > cycle/2 (730.5일), 경계 근처 — 730 은 cycle/2 보다 작으므로 4b 적용
    const row = makeRow({ daysToNext: 730, cycle_years: 4, link: 'https://www.ashrae.org/' });
    expect(shouldSearch(row)).toBe(false);
  });

  it('4년 주기, 1년 반 후 (절반 이내) + medium → pass (high+medium 인정)', () => {
    const row = makeRow({
      daysToNext: 500, cycle_years: 4,
      link: 'https://random-host.com/',
      official_url: 'https://other.org',
    });
    expect(shouldSearch(row)).toBe(false);
  });

  it('4년 주기, 1년 반 후 (절반 이내) + news (low) → 검색', () => {
    const row = makeRow({
      daysToNext: 500, cycle_years: 4,
      link: 'https://news.example.com/article',
      official_url: 'https://other.org',
    });
    expect(shouldSearch(row)).toBe(true);
  });
});

describe('shouldSearch — 충분히 먼 미래 (general)', () => {
  it('4년 주기, 3년 후 + news (low) → pass (cycle 절반 초과)', () => {
    const row = makeRow({
      daysToNext: 1100, cycle_years: 4,
      link: 'https://news.example.com/article',
      official_url: 'https://other.org',
    });
    expect(shouldSearch(row)).toBe(false);
  });

  it('cycle_years 누락·0이면 4b 분기 스킵, 1년 이후는 모두 pass', () => {
    const row = makeRow({
      daysToNext: 500, cycle_years: 0,
      link: 'https://news.example.com/article',
      official_url: 'https://other.org',
    });
    expect(shouldSearch(row)).toBe(false);
  });
});

describe('shouldSearch — 경계·예외', () => {
  it('start_date 파싱 실패 → 검색 (데이터 신뢰 불가)', () => {
    const row = makeRow({ daysToNext: 100 });
    row.upcoming.start_date = '2026/99/99';
    expect(shouldSearch(row)).toBe(true);
  });

  it('이미 지난 start_date (음수 days, < 365) → high 만 pass', () => {
    // 이미 지난 경우도 "1년 이내" 분기로 빠짐. 보통 upcoming→past 로 자동 전환되지만 안전망.
    const row = makeRow({ daysToNext: -10, link: 'https://www.ashrae.org/' });
    expect(shouldSearch(row)).toBe(false);
  });
});

describe('filterSearchTargets', () => {
  it('모드 인자를 shouldSearch 에 전달', () => {
    const rows = [
      makeRow({ daysToNext: 800, link: 'https://www.ashrae.org/' }),
    ];
    expect(filterSearchTargets(rows, 'general')).toHaveLength(0);
    expect(filterSearchTargets(rows, 'precise')).toHaveLength(1);
  });

  it('mode 생략 시 general', () => {
    const rows = [
      makeRow({ daysToNext: 800, link: 'https://www.ashrae.org/' }),
    ];
    expect(filterSearchTargets(rows)).toHaveLength(0);
  });

  it('빈 배열', () => {
    expect(filterSearchTargets([])).toEqual([]);
  });
});
