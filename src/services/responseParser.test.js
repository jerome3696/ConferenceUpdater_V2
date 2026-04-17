import { describe, it, expect } from 'vitest';
import {
  parseUpdateResponse,
  parseVerifyResponse,
  normalizeUpdateData,
  UPDATE_SCHEMA,
  VERIFY_FIELDS,
  BANNED_LINK_DOMAINS,
} from './responseParser.js';

describe('parseUpdateResponse', () => {
  it('정상 JSON 객체를 파싱한다', () => {
    const text = JSON.stringify({
      start_date: '2026-09-01',
      end_date: '2026-09-04',
      venue: 'Seoul, Korea',
      link: 'https://example.org/conf',
      confidence: 0.9,
    });
    const result = parseUpdateResponse(text);
    expect(result.ok).toBe(true);
    expect(result.data.start_date).toBe('2026-09-01');
    expect(result.missing).toEqual([]);
  });

  it('코드펜스로 감싼 JSON도 파싱한다', () => {
    const text = '```json\n' + JSON.stringify({
      start_date: '2026-09-01',
      end_date: '2026-09-04',
      venue: 'Seoul',
      link: 'https://example.org',
    }) + '\n```';
    const result = parseUpdateResponse(text);
    expect(result.ok).toBe(true);
    expect(result.data.venue).toBe('Seoul');
  });

  it('주변 텍스트가 있어도 바깥 중괄호로 추출한다', () => {
    const text = '여기 결과입니다: ' + JSON.stringify({
      start_date: '2026-09-01',
      end_date: '2026-09-04',
      venue: 'Seoul',
      link: 'https://example.org',
    }) + ' 끝.';
    const result = parseUpdateResponse(text);
    expect(result.ok).toBe(true);
  });

  it('빈 응답은 reason: empty', () => {
    expect(parseUpdateResponse('').reason).toBe('empty');
    expect(parseUpdateResponse('   ').reason).toBe('empty');
    expect(parseUpdateResponse(null).reason).toBe('empty');
  });

  it('JSON이 없으면 reason: no_json', () => {
    const result = parseUpdateResponse('그냥 평범한 텍스트입니다.');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_json');
  });

  it('필수 필드가 부분만 있어도 ok (missing 표시)', () => {
    const text = JSON.stringify({
      start_date: '2026-09-01',
      end_date: '2026-09-04',
    });
    const result = parseUpdateResponse(text);
    expect(result.ok).toBe(true);
    expect(result.missing).toContain('venue');
    expect(result.missing).toContain('link');
  });

  it('필수 필드 전부 빠지면 schema_mismatch', () => {
    const text = JSON.stringify({ unrelated: 'value' });
    const result = parseUpdateResponse(text);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('schema_mismatch');
  });

  it('코드펜스 안 배열은 schema_mismatch', () => {
    // 코드펜스로 감싸면 배열이 그대로 파싱돼 객체 검사에서 걸러진다
    const text = '```json\n["a","b"]\n```';
    const result = parseUpdateResponse(text);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('schema_mismatch');
  });

  it('비정상 날짜 형식은 _raw 필드로 보존', () => {
    const text = JSON.stringify({
      start_date: '2026/09/01',
      end_date: '2026-09-04',
      venue: 'Seoul',
      link: 'https://x',
    });
    const result = parseUpdateResponse(text);
    expect(result.ok).toBe(true);
    expect(result.data.start_date_raw).toBe('2026/09/01');
  });
});

describe('parseVerifyResponse', () => {
  it('정상 검증 응답을 파싱한다', () => {
    const text = JSON.stringify({
      full_name: { status: 'confirmed', correct: 'International Conf X' },
      cycle_years: { status: 'confirmed', correct: 1 },
    });
    const result = parseVerifyResponse(text);
    expect(result.ok).toBe(true);
    expect(result.data.full_name.status).toBe('confirmed');
  });

  it('일부 필드만 있어도 ok', () => {
    const text = JSON.stringify({
      official_url: { status: 'corrected', correct: 'https://new.example.org' },
    });
    const result = parseVerifyResponse(text);
    expect(result.ok).toBe(true);
  });

  it('빈 응답은 reason: empty', () => {
    expect(parseVerifyResponse('').reason).toBe('empty');
  });

  it('JSON이 없으면 reason: no_json', () => {
    const result = parseVerifyResponse('텍스트만');
    expect(result.reason).toBe('no_json');
  });

  it('알려진 필드가 하나도 없으면 schema_mismatch', () => {
    const text = JSON.stringify({ random_field: { status: 'x' } });
    const result = parseVerifyResponse(text);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('schema_mismatch');
  });
});

describe('스키마 상수', () => {
  it('UPDATE_SCHEMA에 4개 필수 필드', () => {
    expect(UPDATE_SCHEMA.required).toEqual(['start_date', 'end_date', 'venue', 'link']);
  });

  it('VERIFY_FIELDS에 6개 필드', () => {
    expect(VERIFY_FIELDS).toHaveLength(6);
    expect(VERIFY_FIELDS).toContain('official_url');
  });
});

describe('BANNED_LINK_DOMAINS 상수', () => {
  it('제3자 CFP 집계·IIR 시리즈 도메인을 포함한다', () => {
    expect(BANNED_LINK_DOMAINS).toContain('easychair.org');
    expect(BANNED_LINK_DOMAINS).toContain('wikicfp.com');
    expect(BANNED_LINK_DOMAINS).toContain('conferenceindex.org');
    expect(BANNED_LINK_DOMAINS).toContain('waset.org');
    expect(BANNED_LINK_DOMAINS).toContain('iifiir.org');
  });

  it('framer.ai 는 포함하지 않는다 (draft 연성화)', () => {
    expect(BANNED_LINK_DOMAINS).not.toContain('framer.ai');
  });
});

describe('normalizeUpdateData — link 백필 안전망 (PLAN-006)', () => {
  const BASE = {
    start_date: '2026-07-06',
    end_date: '2026-07-10',
    venue: 'Milan, Italy',
    link: null,
    source_url: 'https://iccfd.org/iccfd13/',
    confidence: 'high',
    notes: 'official page',
  };

  it('조건 충족 시 link 에 source_url 백필', () => {
    const result = normalizeUpdateData({ ...BASE });
    expect(result.link).toBe('https://iccfd.org/iccfd13/');
  });

  it('백필 시 confidence 를 1단계 다운그레이드 (high → medium)', () => {
    const result = normalizeUpdateData({ ...BASE, confidence: 'high' });
    expect(result.confidence).toBe('medium');
  });

  it('백필 시 confidence 다운그레이드 (medium → low)', () => {
    const result = normalizeUpdateData({ ...BASE, confidence: 'medium' });
    expect(result.confidence).toBe('low');
  });

  it('백필 시 confidence 다운그레이드 (low → low)', () => {
    const result = normalizeUpdateData({ ...BASE, confidence: 'low' });
    expect(result.confidence).toBe('low');
  });

  it('백필 시 notes 에 마커 추가', () => {
    const result = normalizeUpdateData({ ...BASE });
    expect(result.notes).toContain('[파서 백필: source_url → link]');
    expect(result.notes).toContain('official page');
  });

  it('notes 가 없었으면 마커만 세팅', () => {
    const result = normalizeUpdateData({ ...BASE, notes: undefined });
    expect(result.notes).toBe('[파서 백필: source_url → link]');
  });

  it('차단: source_url 이 금지 도메인 (easychair)', () => {
    const result = normalizeUpdateData({
      ...BASE,
      source_url: 'https://easychair.org/cfp/ICCFD13',
    });
    expect(result.link).toBeNull();
    expect(result.confidence).toBe('high');
  });

  it('차단: source_url 이 금지 도메인 (iifiir.org 서브경로)', () => {
    const result = normalizeUpdateData({
      ...BASE,
      source_url: 'https://iifiir.org/en/events/something',
    });
    expect(result.link).toBeNull();
  });

  it('차단: source_url 없음', () => {
    const result = normalizeUpdateData({ ...BASE, source_url: undefined });
    expect(result.link).toBeNull();
  });

  it('차단: start_date 없음', () => {
    const result = normalizeUpdateData({ ...BASE, start_date: null });
    expect(result.link).toBeNull();
  });

  it('정상 유지: link 이미 존재하면 source_url 영향 없음', () => {
    const result = normalizeUpdateData({
      ...BASE,
      link: 'https://original.example.org/',
    });
    expect(result.link).toBe('https://original.example.org/');
    expect(result.confidence).toBe('high');
    expect(result.notes).toBe('official page');
  });

  it('parseUpdateResponse 마지막 단계에서 자동 호출 (source_url → link 백필)', () => {
    const text = JSON.stringify({
      start_date: '2026-07-06',
      end_date: '2026-07-10',
      venue: 'Milan, Italy',
      link: null,
      source_url: 'https://iccfd.org/iccfd13/',
      confidence: 'high',
    });
    const result = parseUpdateResponse(text);
    expect(result.ok).toBe(true);
    expect(result.data.link).toBe('https://iccfd.org/iccfd13/');
    expect(result.data.confidence).toBe('medium');
  });
});
