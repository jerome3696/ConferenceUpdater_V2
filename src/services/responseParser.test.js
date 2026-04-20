import { describe, it, expect } from 'vitest';
import {
  parseUpdateResponse,
  parseVerifyResponse,
  parseDiscoveryExpandResponse,
  parseDiscoverySearchResponse,
  parseLastEditionResponse,
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

  it('PLAN-011 약탈 출판사 도메인 추가', () => {
    expect(BANNED_LINK_DOMAINS).toContain('omicsonline.org');
    expect(BANNED_LINK_DOMAINS).toContain('scirp.org');
    expect(BANNED_LINK_DOMAINS).toContain('hilarispublisher.com');
    expect(BANNED_LINK_DOMAINS).toContain('sciencepublishinggroup.com');
  });
});

describe('parseDiscoveryExpandResponse (PLAN-011 + B.1 ko/en pair)', () => {
  it('ko/en 페어 배열을 파싱한다', () => {
    const text = JSON.stringify({
      keywords: [
        { ko: '열관리', en: 'thermal management' },
        { ko: '공기조화', en: 'HVAC' },
      ],
    });
    const result = parseDiscoveryExpandResponse(text);
    expect(result.ok).toBe(true);
    expect(result.keywords).toEqual([
      { ko: '열관리', en: 'thermal management' },
      { ko: '공기조화', en: 'HVAC' },
    ]);
  });

  it('코드펜스로 감싼 응답도 파싱한다', () => {
    const text = '```json\n' + JSON.stringify({
      keywords: [{ ko: 'a', en: 'A' }, { ko: 'b', en: 'B' }],
    }) + '\n```';
    const result = parseDiscoveryExpandResponse(text);
    expect(result.ok).toBe(true);
    expect(result.keywords).toEqual([{ ko: 'a', en: 'A' }, { ko: 'b', en: 'B' }]);
  });

  it('문자열 항목은 {ko, en} 폴백으로 처리한다', () => {
    const text = JSON.stringify({ keywords: ['heat transfer', 'HVAC'] });
    const result = parseDiscoveryExpandResponse(text);
    expect(result.ok).toBe(true);
    expect(result.keywords).toEqual([
      { ko: 'heat transfer', en: 'heat transfer' },
      { ko: 'HVAC', en: 'HVAC' },
    ]);
  });

  it('ko 또는 en 누락된 항목은 폐기', () => {
    const text = JSON.stringify({
      keywords: [
        { ko: '', en: 'no ko' },
        { ko: 'no en', en: '' },
        { ko: '정상', en: 'normal' },
      ],
    });
    const result = parseDiscoveryExpandResponse(text);
    expect(result.ok).toBe(true);
    expect(result.keywords).toEqual([{ ko: '정상', en: 'normal' }]);
  });

  it('공백·중복·비객체는 제거 (ko+en 정규화 키)', () => {
    const text = JSON.stringify({
      keywords: [
        { ko: '  열관리  ', en: '  thermal management  ' },
        { ko: '열관리', en: 'thermal management' },
        null,
        42,
        { ko: 'HVAC', en: 'HVAC' },
      ],
    });
    const result = parseDiscoveryExpandResponse(text);
    expect(result.ok).toBe(true);
    expect(result.keywords).toEqual([
      { ko: '열관리', en: 'thermal management' },
      { ko: 'HVAC', en: 'HVAC' },
    ]);
  });

  it('빈 응답은 reason: empty', () => {
    expect(parseDiscoveryExpandResponse('').reason).toBe('empty');
  });

  it('JSON 없으면 reason: no_json', () => {
    expect(parseDiscoveryExpandResponse('plain text').reason).toBe('no_json');
  });

  it('keywords 필드 없으면 schema_mismatch', () => {
    const result = parseDiscoveryExpandResponse(JSON.stringify({ other: ['a'] }));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('schema_mismatch');
  });

  it('keywords 가 배열이 아니면 schema_mismatch', () => {
    const result = parseDiscoveryExpandResponse(JSON.stringify({ keywords: 'a,b,c' }));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('schema_mismatch');
  });

  it('keywords 빈 배열도 ok', () => {
    const result = parseDiscoveryExpandResponse(JSON.stringify({ keywords: [] }));
    expect(result.ok).toBe(true);
    expect(result.keywords).toEqual([]);
  });
});

describe('parseDiscoverySearchResponse (PLAN-011)', () => {
  const MIN_CANDIDATE = {
    full_name: 'International Heat Transfer Conference',
    abbreviation: 'IHTC',
    field: '열전달',
    region: '전세계',
    official_url: 'https://www.ihtc18.org/',
    organizer: 'AIHTC',
    cycle_years: 4,
    evidence_url: 'https://www.ihtc18.org/about',
    predatory_score: 'low',
    predatory_reasons: ['Established academic body'],
  };

  it('정상 candidates 배열 파싱', () => {
    const text = JSON.stringify({ candidates: [MIN_CANDIDATE] });
    const result = parseDiscoverySearchResponse(text);
    expect(result.ok).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].full_name).toBe(MIN_CANDIDATE.full_name);
    expect(result.candidates[0].predatory_score).toBe('low');
  });

  it('upcoming 필드 정상 파싱 (날짜 형식 검증)', () => {
    const text = JSON.stringify({
      candidates: [{
        ...MIN_CANDIDATE,
        upcoming: {
          start_date: '2026-08-10',
          end_date: '2026-08-14',
          venue: 'Cape Town, South Africa',
          link: 'https://www.ihtc18.org/',
        },
      }],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.ok).toBe(true);
    expect(result.candidates[0].upcoming.start_date).toBe('2026-08-10');
    expect(result.candidates[0].upcoming.venue).toBe('Cape Town, South Africa');
  });

  it('upcoming 의 비정상 날짜는 null 로 정규화', () => {
    const text = JSON.stringify({
      candidates: [{
        ...MIN_CANDIDATE,
        upcoming: { start_date: '2026/08/10', end_date: 'TBA', venue: 'X', link: 'https://x' },
      }],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.ok).toBe(true);
    expect(result.candidates[0].upcoming.start_date).toBeNull();
    expect(result.candidates[0].upcoming.end_date).toBeNull();
    expect(result.candidates[0].upcoming.venue).toBe('X');
  });

  it('upcoming 의 모든 필드가 비면 upcoming 자체 omit', () => {
    const text = JSON.stringify({
      candidates: [{ ...MIN_CANDIDATE, upcoming: { start_date: '', end_date: '', venue: '', link: '' } }],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.ok).toBe(true);
    expect(result.candidates[0].upcoming).toBeUndefined();
  });

  it('금지도메인이 official_url 인 후보는 hard reject', () => {
    const text = JSON.stringify({
      candidates: [
        { ...MIN_CANDIDATE, full_name: 'WASET Conf', official_url: 'https://waset.org/heat-transfer-conference' },
        MIN_CANDIDATE,
      ],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.ok).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].full_name).toBe(MIN_CANDIDATE.full_name);
  });

  it('금지도메인이 upcoming.link 인 후보도 hard reject', () => {
    const text = JSON.stringify({
      candidates: [{
        ...MIN_CANDIDATE,
        upcoming: { start_date: '2026-08-10', end_date: '2026-08-14', venue: 'X', link: 'https://easychair.org/cfp/IHTC' },
      }],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.ok).toBe(true);
    expect(result.candidates).toHaveLength(0);
  });

  it('predatory_score 미지정·잘못된 값은 medium 으로 보수치 처리', () => {
    const text = JSON.stringify({
      candidates: [
        { ...MIN_CANDIDATE, predatory_score: undefined },
        { ...MIN_CANDIDATE, full_name: 'X', predatory_score: 'unknown' },
      ],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.ok).toBe(true);
    expect(result.candidates[0].predatory_score).toBe('medium');
    expect(result.candidates[1].predatory_score).toBe('medium');
  });

  it('full_name 없는 항목은 제외', () => {
    const text = JSON.stringify({
      candidates: [
        MIN_CANDIDATE,
        { ...MIN_CANDIDATE, full_name: '' },
        { ...MIN_CANDIDATE, full_name: null },
        null,
        'invalid',
      ],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.ok).toBe(true);
    expect(result.candidates).toHaveLength(1);
  });

  it('cycle_years 가 숫자 아니면 null', () => {
    const text = JSON.stringify({
      candidates: [{ ...MIN_CANDIDATE, cycle_years: '4' }],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.candidates[0].cycle_years).toBeNull();
  });

  it('빈 응답은 reason: empty', () => {
    expect(parseDiscoverySearchResponse('').reason).toBe('empty');
  });

  it('candidates 배열 아니면 schema_mismatch', () => {
    const result = parseDiscoverySearchResponse(JSON.stringify({ candidates: 'not array' }));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('schema_mismatch');
  });

  it('candidates 빈 배열도 ok', () => {
    const result = parseDiscoverySearchResponse(JSON.stringify({ candidates: [] }));
    expect(result.ok).toBe(true);
    expect(result.candidates).toEqual([]);
  });

  it('matched_keywords 페어 정상 파싱', () => {
    const text = JSON.stringify({
      candidates: [{
        ...MIN_CANDIDATE,
        matched_keywords: [
          { ko: '열전달', en: 'heat transfer' },
          { ko: '열관리', en: 'thermal management' },
        ],
      }],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.candidates[0].matched_keywords).toEqual([
      { ko: '열전달', en: 'heat transfer' },
      { ko: '열관리', en: 'thermal management' },
    ]);
  });

  it('matched_keywords 누락은 빈 배열', () => {
    const result = parseDiscoverySearchResponse(JSON.stringify({ candidates: [MIN_CANDIDATE] }));
    expect(result.candidates[0].matched_keywords).toEqual([]);
  });

  it('matched_keywords 잘못된 항목은 폐기 (ko/en 누락·문자열)', () => {
    const text = JSON.stringify({
      candidates: [{
        ...MIN_CANDIDATE,
        matched_keywords: [
          { ko: '열전달', en: 'heat transfer' },
          { ko: '', en: 'no ko' },
          'plain string',
          null,
          { ko: 'no en', en: '' },
        ],
      }],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.candidates[0].matched_keywords).toEqual([
      { ko: '열전달', en: 'heat transfer' },
    ]);
  });

  it('field 미지정 시 matched_keywords[0].ko 로 폴백', () => {
    const text = JSON.stringify({
      candidates: [{
        ...MIN_CANDIDATE,
        field: '',
        matched_keywords: [{ ko: '극저온', en: 'cryogenics' }],
      }],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.candidates[0].field).toBe('극저온');
  });

  it('field 명시되어 있으면 그대로 유지 (matched_keywords 무관)', () => {
    const text = JSON.stringify({
      candidates: [{
        ...MIN_CANDIDATE,
        field: '공기조화',
        matched_keywords: [{ ko: '극저온', en: 'cryogenics' }],
      }],
    });
    const result = parseDiscoverySearchResponse(text);
    expect(result.candidates[0].field).toBe('공기조화');
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

describe('parseLastEditionResponse (PLAN-013-D)', () => {
  const TODAY = '2026-04-20';

  it('정상 past 회차(end_date <= today) 파싱', () => {
    const text = JSON.stringify({
      start_date: '2024-07-01',
      end_date: '2024-07-05',
      venue: 'Milan, Italy',
      link: 'https://iccfd.org/iccfd13/',
      confidence: 'high',
    });
    const result = parseLastEditionResponse(text, TODAY);
    expect(result.ok).toBe(true);
    expect(result.data.start_date).toBe('2024-07-01');
    expect(result.data.link).toBe('https://iccfd.org/iccfd13/');
  });

  it('end_date 없어도 start_date <= today 면 통과', () => {
    const text = JSON.stringify({
      start_date: '2024-07-01',
      end_date: null,
      venue: 'Milan, Italy',
      link: 'https://example.org/',
    });
    const result = parseLastEditionResponse(text, TODAY);
    expect(result.ok).toBe(true);
  });

  it('미래 end_date 는 not_past 로 거절', () => {
    const text = JSON.stringify({
      start_date: '2026-07-01',
      end_date: '2026-07-05',
      venue: 'Seoul',
      link: 'https://ex.com',
    });
    const result = parseLastEditionResponse(text, TODAY);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_past');
  });

  it('start_date 만 있고 미래면 not_past', () => {
    const text = JSON.stringify({
      start_date: '2027-01-01',
      end_date: null,
      venue: null,
      link: null,
    });
    const result = parseLastEditionResponse(text, TODAY);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_past');
  });

  it('날짜 둘 다 null 이면 no_date', () => {
    const text = JSON.stringify({
      start_date: null,
      end_date: null,
      venue: null,
      link: null,
    });
    const result = parseLastEditionResponse(text, TODAY);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_date');
  });

  it('잘못된 날짜 포맷은 no_date 취급', () => {
    const text = JSON.stringify({
      start_date: '2024/07/01',
      end_date: 'July 5 2024',
    });
    const result = parseLastEditionResponse(text, TODAY);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_date');
  });

  it('빈 문자열은 empty', () => {
    expect(parseLastEditionResponse('', TODAY).reason).toBe('empty');
    expect(parseLastEditionResponse('   ', TODAY).reason).toBe('empty');
  });

  it('JSON 아닌 텍스트는 no_json', () => {
    expect(parseLastEditionResponse('plain text', TODAY).reason).toBe('no_json');
  });

  it('코드펜스 안 배열이면 schema_mismatch', () => {
    const text = '```json\n[]\n```';
    expect(parseLastEditionResponse(text, TODAY).reason).toBe('schema_mismatch');
  });

  it('todayIso 미지정 시 오늘 시스템 날짜 사용', () => {
    // 2000-01-01 은 확실히 과거 → 통과 기대
    const text = JSON.stringify({
      start_date: '2000-01-01',
      end_date: '2000-01-05',
    });
    const result = parseLastEditionResponse(text);
    expect(result.ok).toBe(true);
  });

  it('코드펜스 감싸진 JSON 도 파싱', () => {
    const text = '```json\n' + JSON.stringify({
      start_date: '2024-01-01',
      end_date: '2024-01-05',
      venue: 'Seoul',
      link: 'https://ex.com',
    }) + '\n```';
    const result = parseLastEditionResponse(text, TODAY);
    expect(result.ok).toBe(true);
  });
});
