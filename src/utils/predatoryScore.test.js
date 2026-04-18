import { describe, it, expect } from 'vitest';
import { scorePredatory, combinePredatoryScore } from './predatoryScore.js';

describe('scorePredatory — 명칭 패턴', () => {
  it('WASET 명칭 → high', () => {
    const r = scorePredatory({ full_name: 'WASET International Conference on Heat Transfer' });
    expect(r.severity).toBe('high');
    expect(r.reasons.some((x) => /WASET/.test(x))).toBe(true);
  });

  it('OMICS 명칭 → high', () => {
    const r = scorePredatory({ organizer: 'OMICS Group' });
    expect(r.severity).toBe('high');
  });

  it('SCIRP → score≥40 → high', () => {
    const r = scorePredatory({ organizer: 'SCIRP Publishing' });
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.severity).toBe('high');
  });
});

describe('scorePredatory — 도메인', () => {
  it('금지 도메인이 official_url → 점수 가산', () => {
    const r = scorePredatory({
      full_name: 'Some Conference',
      official_url: 'https://www.waset.org/conference/2027',
    });
    expect(r.score).toBeGreaterThanOrEqual(50);
  });

  it('.events TLD → 약한 의심 (medium 부근)', () => {
    const r = scorePredatory({
      full_name: 'Energy Symposium',
      official_url: 'https://energy-conf.events',
    });
    expect(r.reasons.some((x) => /\.events/.test(x))).toBe(true);
  });
});

describe('scorePredatory — 신뢰 키워드 감점', () => {
  it('IEEE 매칭 → 감점, low 유지', () => {
    const r = scorePredatory({
      full_name: 'IEEE International Conference on Computer Vision',
      official_url: 'https://iccv2027.thecvf.com',
      organizer: 'IEEE Computer Society',
    });
    expect(r.score).toBeLessThan(20);
    expect(r.severity).toBe('low');
  });

  it('ASHRAE → 감점', () => {
    const r = scorePredatory({
      full_name: 'ASHRAE Winter Conference',
      organizer: 'ASHRAE',
    });
    expect(r.score).toBeLessThan(20);
  });
});

describe('scorePredatory — 누락 데이터', () => {
  it('null 후보 → high 폴백', () => {
    const r = scorePredatory(null);
    expect(r.severity).toBe('high');
  });

  it('URL 모두 없음 → 점수 가산', () => {
    const r = scorePredatory({ full_name: 'Some Conference' });
    expect(r.reasons.some((x) => /URL 모두 없음/.test(x))).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(20);
  });
});

describe('combinePredatoryScore — AI ↔ 휴리스틱 결합', () => {
  it('AI=high, 휴리스틱=low → high 유지 (강한 쪽 채택)', () => {
    const candidate = {
      full_name: 'IEEE International Conference on X',
      official_url: 'https://ieee-x.org',
      organizer: 'IEEE',
      predatory_score: 'high',
      predatory_reasons: ['AI 가 발견한 의심 사유'],
    };
    const r = combinePredatoryScore(candidate);
    expect(r.predatory_score).toBe('high');
    expect(r.predatory_reasons).toContain('AI 가 발견한 의심 사유');
  });

  it('AI=low, 휴리스틱=high → high 로 격상', () => {
    const candidate = {
      full_name: 'WASET Energy Conference',
      predatory_score: 'low',
      predatory_reasons: [],
    };
    const r = combinePredatoryScore(candidate);
    expect(r.predatory_score).toBe('high');
    expect(r.predatory_reasons.some((x) => /WASET/.test(x))).toBe(true);
  });

  it('휴리스틱 사유는 [휴] prefix 로 표시', () => {
    const candidate = {
      full_name: 'OMICS X',
      predatory_score: 'medium',
      predatory_reasons: ['AI: organizer unclear'],
    };
    const r = combinePredatoryScore(candidate);
    const heuristic = r.predatory_reasons.filter((x) => x.startsWith('[휴]'));
    expect(heuristic.length).toBeGreaterThan(0);
    expect(r.predatory_reasons).toContain('AI: organizer unclear');
  });

  it('predatory_score 누락 → medium 으로 취급', () => {
    const candidate = { full_name: 'Some legit conf', official_url: 'https://x.org' };
    const r = combinePredatoryScore(candidate);
    expect(['low', 'medium', 'high']).toContain(r.predatory_score);
  });
});
