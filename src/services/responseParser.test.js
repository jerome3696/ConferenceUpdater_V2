import { describe, it, expect } from 'vitest';
import {
  parseUpdateResponse,
  parseVerifyResponse,
  UPDATE_SCHEMA,
  VERIFY_FIELDS,
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
