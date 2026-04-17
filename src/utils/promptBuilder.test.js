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
