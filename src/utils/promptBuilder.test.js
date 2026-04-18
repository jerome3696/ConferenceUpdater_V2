import { describe, it, expect } from 'vitest';
import {
  buildUpdatePrompt,
  buildDiscoveryExpandPrompt,
  buildDiscoverySearchPrompt,
  DEFAULT_UPDATE_VERSION,
  DEFAULT_DISCOVERY_EXPAND_VERSION,
  DEFAULT_DISCOVERY_SEARCH_VERSION,
} from './promptBuilder.js';

const CONF = {
  full_name: 'International Conference on Computational Fluid Dynamics',
  abbreviation: 'ICCFD',
  cycle_years: 2,
  official_url: 'https://www.iccfd.org/',
};

describe('buildUpdatePrompt — v4 (default)', () => {
  it('DEFAULT_UPDATE_VERSION 은 v4', () => {
    expect(DEFAULT_UPDATE_VERSION).toBe('v4');
  });

  it('v4 에는 dedicated_url 힌트 라인이 없다', () => {
    const conf = { ...CONF, dedicated_url: 'https://iccfd13.polimi.it' };
    const { user, version } = buildUpdatePrompt(conf, null, { version: 'v4' });
    expect(version).toBe('v4');
    expect(user).not.toContain('회차 전용 사이트(힌트)');
    expect(user).not.toContain('iccfd13.polimi.it');
  });
});

describe('buildUpdatePrompt — v5 (dedicated_url 힌트)', () => {
  it('dedicated_url 있으면 힌트 라인이 user 프롬프트에 포함된다', () => {
    const conf = { ...CONF, dedicated_url: 'https://iccfd13.polimi.it' };
    const { user, system, version } = buildUpdatePrompt(conf, null, { version: 'v5' });
    expect(version).toBe('v5');
    expect(user).toContain('회차 전용 사이트(힌트): https://iccfd13.polimi.it');
    // v5 system == v4 system (내용 복사)
    expect(system).toContain('[날짜 규칙 — 엄격]');
  });

  it('dedicated_url 없으면 힌트 라인이 없다 (v4와 user 구조 동일)', () => {
    const { user } = buildUpdatePrompt(CONF, null, { version: 'v5' });
    expect(user).not.toContain('회차 전용 사이트(힌트)');
  });

  it('dedicated_url 빈 문자열도 힌트 미출력', () => {
    const conf = { ...CONF, dedicated_url: '' };
    const { user } = buildUpdatePrompt(conf, null, { version: 'v5' });
    expect(user).not.toContain('회차 전용 사이트(힌트)');
  });
});

describe('buildUpdatePrompt — v6 (cross-coupling + venue 포맷 + draft)', () => {
  it('v6 system 에 Link–Confidence 상호구속 섹션 존재', () => {
    const { system, version } = buildUpdatePrompt(CONF, null, { version: 'v6' });
    expect(version).toBe('v6');
    expect(system).toContain('[Link–Confidence 상호구속]');
    expect(system).toMatch(/high[^\n]*medium[^\n]*link[^\n]*non-null/i);
  });

  it('v6 system 에 Venue 포맷 섹션 + USA/Korea/UK 규칙 존재', () => {
    const { system } = buildUpdatePrompt(CONF, null, { version: 'v6' });
    expect(system).toContain('[Venue 포맷 — 엄격]');
    expect(system).toContain('City, State, USA');
    expect(system).toContain('Orlando, Florida, USA');
    expect(system).toContain('City, Province, Canada');
    expect(system).toMatch(/USA['"]?\s*고정/);
    expect(system).toContain("'Korea'");
    expect(system).toContain("'UK'");
  });

  it('v6 system 에 Draft/초안 사이트 처리 섹션 존재', () => {
    const { system } = buildUpdatePrompt(CONF, null, { version: 'v6' });
    expect(system).toContain('[Draft/초안 사이트 처리]');
    expect(system).toContain('framer.ai');
    expect(system).toContain('draft/prototype');
  });

  it('v6 금지 도메인 리스트에 framer.ai 미포함', () => {
    const { system } = buildUpdatePrompt(CONF, null, { version: 'v6' });
    const bannedSection = system.match(/금지 \(제3자[^\n]*/)?.[0] ?? '';
    expect(bannedSection).not.toContain('framer.ai');
    expect(bannedSection).toContain('easychair.org');
    expect(bannedSection).toContain('iifiir.org');
  });

  it('v6 에 3순위 색인 페이지 허용 명시 (ibpsa.org/conferences/)', () => {
    const { system } = buildUpdatePrompt(CONF, null, { version: 'v6' });
    expect(system).toContain('ibpsa.org/conferences/');
    expect(system).toMatch(/3순위.*색인/);
  });

  it('v6 user 프롬프트에 반환 직전 자기검증 체크리스트 존재', () => {
    const { user } = buildUpdatePrompt(CONF, null, { version: 'v6' });
    expect(user).toContain('[반환 직전 자기검증 체크리스트]');
    expect(user).toMatch(/link=null/);
  });

  it('v6 dedicated_url 힌트는 v5 와 동일하게 동작', () => {
    const conf = { ...CONF, dedicated_url: 'https://iccfd13.polimi.it' };
    const { user } = buildUpdatePrompt(conf, null, { version: 'v6' });
    expect(user).toContain('회차 전용 사이트(힌트): https://iccfd13.polimi.it');
  });

  it('v6 dedicated_url 없으면 힌트 라인 없음', () => {
    const { user } = buildUpdatePrompt(CONF, null, { version: 'v6' });
    expect(user).not.toContain('회차 전용 사이트(힌트)');
  });
});

describe('buildDiscoveryExpandPrompt — v1 (PLAN-011 Stage 1 + B.1 ko/en)', () => {
  it('DEFAULT_DISCOVERY_EXPAND_VERSION 은 v1', () => {
    expect(DEFAULT_DISCOVERY_EXPAND_VERSION).toBe('v1');
  });

  it('시드 키워드 배열을 user 프롬프트에 포함', () => {
    const { user, system, version } = buildDiscoveryExpandPrompt(['열전달', '디지털 트윈']);
    expect(version).toBe('v1');
    expect(user).toContain('"열전달"');
    expect(user).toContain('"디지털 트윈"');
    expect(system).toContain('연관 키워드 10개');
  });

  it('system 에 ko/en 페어 출력 schema 명시', () => {
    const { system } = buildDiscoveryExpandPrompt(['열전달']);
    expect(system).toMatch(/한국어\/영어 페어|ko[^a-z].*en/);
    expect(system).toContain('"ko"');
    expect(system).toContain('"en"');
  });

  it('user 에 ko/en 가이드 라인 포함', () => {
    const { user } = buildDiscoveryExpandPrompt(['열전달']);
    expect(user).toMatch(/ko:.*한국/);
    expect(user).toMatch(/en:.*영문|en:.*web_search/);
  });

  it('단일 키워드 문자열도 처리', () => {
    const { user } = buildDiscoveryExpandPrompt('열전달');
    expect(user).toContain('"열전달"');
  });

  it('빈 문자열·공백은 제거', () => {
    const { user } = buildDiscoveryExpandPrompt(['열전달', '', '  ']);
    expect(user).toContain('"열전달"');
    expect(user).not.toMatch(/""/);
  });

  it('알 수 없는 버전은 throw', () => {
    expect(() => buildDiscoveryExpandPrompt(['x'], { version: 'v99' })).toThrow();
  });
});

describe('buildDiscoverySearchPrompt — v1 (PLAN-011 Stage 2)', () => {
  it('DEFAULT_DISCOVERY_SEARCH_VERSION 은 v1', () => {
    expect(DEFAULT_DISCOVERY_SEARCH_VERSION).toBe('v1');
  });

  it('ko/en 페어 키워드를 한국어 / 영어 형식으로 user 에 포함', () => {
    const existing = [
      { full_name: 'International Heat Transfer Conference', abbreviation: 'IHTC', official_url: 'https://ihtc18.org/' },
      { full_name: 'ASHRAE Winter Conference', abbreviation: 'ASHRAE Winter' },
    ];
    const pairs = [
      { ko: '열전달', en: 'heat transfer' },
      { ko: '공기조화', en: 'HVAC' },
    ];
    const { user, system, version } = buildDiscoverySearchPrompt(pairs, existing);
    expect(version).toBe('v1');
    expect(user).toContain('- 열전달 / heat transfer');
    expect(user).toContain('- 공기조화 / HVAC');
    expect(user).toContain('IHTC');
    expect(user).toContain('International Heat Transfer Conference');
    expect(user).toContain('ihtc18.org');
    expect(user).toContain('ASHRAE Winter');
    expect(system).toContain('predatory_score');
    expect(system).toContain('OR 매칭');
  });

  it('문자열 키워드는 ko=en 폴백으로 페어화', () => {
    const { user } = buildDiscoverySearchPrompt(['heat transfer'], []);
    expect(user).toContain('- heat transfer / heat transfer');
  });

  it('system 에 matched_keywords + field 지시 명시', () => {
    const { system } = buildDiscoverySearchPrompt([], []);
    expect(system).toContain('matched_keywords');
    expect(system).toMatch(/field.*matched_keywords\[0\]\.ko/);
  });

  it('system 에 영문 면을 web_search 메인 쿼리로 사용 명시', () => {
    const { system } = buildDiscoverySearchPrompt([], []);
    expect(system).toMatch(/영문.*web_search.*메인|영문 면을 web_search/);
  });

  it('user 프롬프트에 오늘 날짜(YYYY-MM-DD) 포함', () => {
    const today = new Date().toISOString().slice(0, 10);
    const { user } = buildDiscoverySearchPrompt([{ ko: 'x', en: 'x' }], []);
    expect(user).toContain(today);
  });

  it('기존 학회 목록 빈 배열이면 "없음" 표시', () => {
    const { user } = buildDiscoverySearchPrompt([{ ko: 'x', en: 'x' }], []);
    expect(user).toContain('없음');
  });

  it('system 프롬프트에 BANNED_LINK_DOMAINS 인용 (waset 등)', () => {
    const { system } = buildDiscoverySearchPrompt([], []);
    expect(system).toContain('waset.org');
    expect(system).toContain('omicsonline.org');
    expect(system).toContain('hilarispublisher.com');
  });

  it('system 프롬프트에 정기 학회 한정 + 단발 행사 제외 명시', () => {
    const { user } = buildDiscoverySearchPrompt([{ ko: 'x', en: 'x' }], []);
    expect(user).toContain('정기 학회');
  });

  it('알 수 없는 버전은 throw', () => {
    expect(() => buildDiscoverySearchPrompt([{ ko: 'x', en: 'x' }], [], { version: 'v99' })).toThrow();
  });
});
