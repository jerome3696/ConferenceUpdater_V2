import { describe, it, expect } from 'vitest';
import { classifyUrlTrust } from './urlClassifier.js';

describe('classifyUrlTrust — official_edition', () => {
  it('약칭 + 연도 서브도메인: ecos2026.insae.ro', () => {
    const r = classifyUrlTrust('https://ecos2026.insae.ro/', { abbreviation: 'ECOS' });
    expect(r.type).toBe('official_edition');
    expect(r.trust).toBe('high');
  });

  it('약칭 + 회차 숫자: ihtc18.org', () => {
    const r = classifyUrlTrust('https://ihtc18.org/program', { abbreviation: 'IHTC' });
    expect(r.type).toBe('official_edition');
    expect(r.trust).toBe('high');
  });

  it('약칭 + 연도 TLD 전방: icr2027.org', () => {
    const r = classifyUrlTrust('https://www.icr2027.org/', { abbreviation: 'ICR' });
    expect(r.type).toBe('official_edition');
    expect(r.trust).toBe('high');
  });

  it('약칭 없어도 라벨이 4자리 연도면 edition 으로 인정: 2026.somehost.org', () => {
    const r = classifyUrlTrust('https://2026.somehost.org/', {});
    expect(r.type).toBe('official_edition');
  });

  it('edition 패턴 없으면 official_edition 로 분류 안 함', () => {
    const r = classifyUrlTrust('https://ashrae.org/', { abbreviation: 'ASHRAE' });
    expect(r.type).not.toBe('official_edition');
  });
});

describe('classifyUrlTrust — official_series', () => {
  it('official_url host 와 동일: ashrae.org ↔ ashrae.org', () => {
    const r = classifyUrlTrust('https://www.ashrae.org/conferences', {
      official_url: 'https://www.ashrae.org/',
      abbreviation: 'ASHRAE',
    });
    expect(r.type).toBe('official_series');
    expect(r.trust).toBe('high');
  });

  it('official_url 서브도메인 매칭', () => {
    const r = classifyUrlTrust('https://events.ashrae.org/summer2026', {
      official_url: 'https://ashrae.org',
      abbreviation: 'X', // edition 패턴 매치 안 되도록
    });
    expect(r.type).toBe('official_series');
  });

  it('official_url 없으면 series 분류 불가 → unknown', () => {
    const r = classifyUrlTrust('https://euroturbo.eu/', {});
    expect(r.type).toBe('unknown');
  });
});

describe('classifyUrlTrust — listing & org_event', () => {
  it('BANNED_LINK_DOMAINS root 는 listing', () => {
    const r = classifyUrlTrust('https://www.iifiir.org/', {});
    expect(r.type).toBe('listing');
    expect(r.trust).toBe('low');
  });

  it('iifiir.org/en/events/<slug> 는 org_event 로 격상', () => {
    const r = classifyUrlTrust('https://iifiir.org/en/events/icr-2027', {});
    expect(r.type).toBe('org_event');
    expect(r.trust).toBe('medium');
  });

  it('wikicfp.com 은 listing', () => {
    const r = classifyUrlTrust('https://www.wikicfp.com/cfp/program?id=12345', {});
    expect(r.type).toBe('listing');
  });

  it('약탈 출판사 도메인도 listing', () => {
    const r = classifyUrlTrust('https://waset.org/program', {});
    expect(r.type).toBe('listing');
  });
});

describe('classifyUrlTrust — news', () => {
  it('hostname 에 news 토큰', () => {
    const r = classifyUrlTrust('https://news.example.com/article', {});
    expect(r.type).toBe('news');
    expect(r.trust).toBe('low');
  });

  it('medium.com blog 도 news 로 분류', () => {
    const r = classifyUrlTrust('https://medium.com/@author/some-post', {});
    expect(r.type).toBe('news');
  });
});

describe('classifyUrlTrust — unknown / edge cases', () => {
  it('빈 url → unknown/medium', () => {
    expect(classifyUrlTrust('')).toEqual({ type: 'unknown', trust: 'medium' });
    expect(classifyUrlTrust(null)).toEqual({ type: 'unknown', trust: 'medium' });
  });

  it('일치 항목 없으면 unknown/medium', () => {
    const r = classifyUrlTrust('https://some-random-host.org/page', {});
    expect(r.type).toBe('unknown');
    expect(r.trust).toBe('medium');
  });

  it('편집 패턴이 official_url 매치를 이긴다 (우선순위 확인)', () => {
    // ecos2026.insae.ro 는 official_url=insae.ro 와도 매치 가능하지만 edition 판정이 먼저
    const r = classifyUrlTrust('https://ecos2026.insae.ro/', {
      official_url: 'https://www.insae.ro',
      abbreviation: 'ECOS',
    });
    expect(r.type).toBe('official_edition');
  });
});
