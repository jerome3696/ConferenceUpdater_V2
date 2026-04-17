import { describe, it, expect } from 'vitest';
import { buildUpdatePrompt, DEFAULT_UPDATE_VERSION } from './promptBuilder.js';

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
