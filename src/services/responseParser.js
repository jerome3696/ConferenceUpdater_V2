// Claude 응답 파싱 + 스키마 검증.
// AI 응답은 항상 완벽한 JSON이 아닐 수 있음 → 실패 원인을 구분해서 돌려줌.

export const UPDATE_SCHEMA = {
  required: ['start_date', 'end_date', 'venue', 'link'],
  optional: ['source_url', 'confidence', 'notes'],
};

export const VERIFY_FIELDS = [
  'full_name', 'abbreviation', 'cycle_years', 'duration_days', 'region', 'official_url',
];

// link 필드·파서 백필에서 금지되는 도메인. 프롬프트와 파서가 공유하는 단일 공급원.
// PLAN-011: discovery 단계에서 약탈 출판사 도메인까지 확장.
export const BANNED_LINK_DOMAINS = [
  // 리스팅·CFP 집계 (update·discovery 공통)
  'easychair.org',
  'wikicfp.com',
  'conferenceindex.org',
  'allconferencealert.com',
  'iifiir.org',
  // 약탈적 출판사·학회 (discovery 1차 차단, update에서도 안전망)
  'waset.org',
  'omicsonline.org',
  'omicsonline.com',
  'omicsgroup.org',
  'scirp.org',
  'hilarispublisher.com',
  'longdom.org',
  'sciencepublishinggroup.com',
  'benthamopen.com',
  'iier.org',
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function hostMatchesBanned(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BANNED_LINK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

const CONFIDENCE_DOWNGRADE = { high: 'medium', medium: 'low', low: 'low' };

/**
 * link=null 이지만 source_url 이 유효하면 link 에 백필.
 * confidence 1단계 다운그레이드 + notes 에 마커 추가.
 * 조건: link 없음 + source_url 있음 + 금지도메인 아님 + start_date 있음.
 */
export function normalizeUpdateData(data) {
  if (!data || typeof data !== 'object') return data;
  const link = data.link;
  const src = data.source_url;
  const hasStart = Boolean(data.start_date);
  const canBackfill =
    (link == null || link === '') &&
    typeof src === 'string' &&
    src.length > 0 &&
    !hostMatchesBanned(src) &&
    hasStart;

  if (!canBackfill) return data;

  data.link = src;
  const cur = data.confidence;
  if (typeof cur === 'string' && cur in CONFIDENCE_DOWNGRADE) {
    data.confidence = CONFIDENCE_DOWNGRADE[cur];
  }
  const marker = '[파서 백필: source_url → link]';
  data.notes = data.notes ? `${data.notes} ${marker}` : marker;
  return data;
}

/**
 * 텍스트에서 JSON 블록을 추출. 코드펜스, 바깥 중괄호 순서로 시도.
 */
function extractJson(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch { /* fall through */ }
  }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { return null; }
  }
  return null;
}

/**
 * 업데이트 응답 파싱.
 * @returns {{ok:true, data:object} | {ok:false, reason:string, raw:string, parsed?:any}}
 *   reason: 'empty' | 'no_json' | 'invalid_json' | 'schema_mismatch'
 */
export function parseUpdateResponse(text) {
  if (!text || !text.trim()) return { ok: false, reason: 'empty', raw: text || '' };

  let data;
  try {
    data = extractJson(text);
  } catch (e) {
    return { ok: false, reason: 'invalid_json', raw: text };
  }
  if (data === null) return { ok: false, reason: 'no_json', raw: text };
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'schema_mismatch', raw: text, parsed: data };
  }

  const missing = UPDATE_SCHEMA.required.filter((k) => !(k in data));
  if (missing.length === UPDATE_SCHEMA.required.length) {
    return { ok: false, reason: 'schema_mismatch', raw: text, parsed: data };
  }

  // 날짜 형식 보정(없으면 null로 정규화). 실패는 하지 않음 — 평가 단계에서 diff로 드러남.
  for (const key of ['start_date', 'end_date']) {
    if (data[key] && !DATE_RE.test(String(data[key]))) {
      data[`${key}_raw`] = data[key];
    }
  }

  normalizeUpdateData(data);

  return { ok: true, data, missing };
}

// ──────────────────────────────────────────────────────────────────
// Discovery (PLAN-011)
// ──────────────────────────────────────────────────────────────────

const PREDATORY_LEVELS = new Set(['low', 'medium', 'high']);

/**
 * Discovery Stage 1 응답 파싱. { keywords: string[] } 기대.
 * @returns {{ok:true, keywords:string[]} | {ok:false, reason:string, raw:string, parsed?:any}}
 *   reason: 'empty' | 'no_json' | 'schema_mismatch'
 */
export function parseDiscoveryExpandResponse(text) {
  if (!text || !text.trim()) return { ok: false, reason: 'empty', raw: text || '' };
  const data = extractJson(text);
  if (data === null) return { ok: false, reason: 'no_json', raw: text };
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'schema_mismatch', raw: text, parsed: data };
  }
  const arr = data.keywords;
  if (!Array.isArray(arr)) return { ok: false, reason: 'schema_mismatch', raw: text, parsed: data };

  // 문자열만 추출, 공백·중복 제거. 빈 배열도 허용.
  const seen = new Set();
  const keywords = [];
  for (const k of arr) {
    if (typeof k !== 'string') continue;
    const trimmed = k.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(trimmed);
  }
  return { ok: true, keywords };
}

/**
 * Discovery Stage 2 응답 파싱. { candidates: CandidateConference[] } 기대.
 * 각 후보:
 *   - 필수: full_name (string), predatory_score ('low'|'medium'|'high')
 *   - 선택: abbreviation, field, region, official_url, organizer, cycle_years,
 *           evidence_url, predatory_reasons (string[]), upcoming { start_date, end_date, venue, link }
 * 금지도메인이 official_url 또는 upcoming.link 인 후보는 제거.
 * @returns {{ok:true, candidates:Candidate[]} | {ok:false, reason:string, raw:string, parsed?:any}}
 */
export function parseDiscoverySearchResponse(text) {
  if (!text || !text.trim()) return { ok: false, reason: 'empty', raw: text || '' };
  const data = extractJson(text);
  if (data === null) return { ok: false, reason: 'no_json', raw: text };
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'schema_mismatch', raw: text, parsed: data };
  }
  const arr = data.candidates;
  if (!Array.isArray(arr)) return { ok: false, reason: 'schema_mismatch', raw: text, parsed: data };

  const candidates = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const fullName = typeof raw.full_name === 'string' ? raw.full_name.trim() : '';
    if (!fullName) continue;

    // L1: 도메인 블랙리스트 hard reject
    if (raw.official_url && hostMatchesBanned(raw.official_url)) continue;
    if (raw.upcoming?.link && hostMatchesBanned(raw.upcoming.link)) continue;

    const score = typeof raw.predatory_score === 'string' ? raw.predatory_score.toLowerCase() : '';
    const predatoryScore = PREDATORY_LEVELS.has(score) ? score : 'medium'; // 미지정은 medium 보수치
    const reasons = Array.isArray(raw.predatory_reasons)
      ? raw.predatory_reasons.filter((r) => typeof r === 'string')
      : [];

    const candidate = {
      full_name: fullName,
      abbreviation: typeof raw.abbreviation === 'string' ? raw.abbreviation.trim() : '',
      field: typeof raw.field === 'string' ? raw.field.trim() : '',
      region: typeof raw.region === 'string' ? raw.region.trim() : '',
      official_url: typeof raw.official_url === 'string' ? raw.official_url.trim() : '',
      organizer: typeof raw.organizer === 'string' ? raw.organizer.trim() : '',
      cycle_years: Number.isFinite(raw.cycle_years) ? raw.cycle_years : null,
      evidence_url: typeof raw.evidence_url === 'string' ? raw.evidence_url.trim() : '',
      predatory_score: predatoryScore,
      predatory_reasons: reasons,
    };

    if (raw.upcoming && typeof raw.upcoming === 'object' && !Array.isArray(raw.upcoming)) {
      const u = raw.upcoming;
      const upcoming = {
        start_date: typeof u.start_date === 'string' && DATE_RE.test(u.start_date) ? u.start_date : null,
        end_date: typeof u.end_date === 'string' && DATE_RE.test(u.end_date) ? u.end_date : null,
        venue: typeof u.venue === 'string' ? u.venue.trim() : '',
        link: typeof u.link === 'string' ? u.link.trim() : '',
      };
      // upcoming 안에 의미 있는 필드가 하나라도 있을 때만 포함
      if (upcoming.start_date || upcoming.end_date || upcoming.venue || upcoming.link) {
        candidate.upcoming = upcoming;
      }
    }

    candidates.push(candidate);
  }
  return { ok: true, candidates };
}

/**
 * 검증 응답 파싱. 각 필드별 { status, correct } 기대.
 */
export function parseVerifyResponse(text) {
  if (!text || !text.trim()) return { ok: false, reason: 'empty', raw: text || '' };
  const data = extractJson(text);
  if (data === null) return { ok: false, reason: 'no_json', raw: text };
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'schema_mismatch', raw: text, parsed: data };
  }
  const hasAny = VERIFY_FIELDS.some((f) => data[f] && typeof data[f] === 'object');
  if (!hasAny) return { ok: false, reason: 'schema_mismatch', raw: text, parsed: data };
  return { ok: true, data };
}
