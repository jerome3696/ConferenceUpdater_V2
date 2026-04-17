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
export const BANNED_LINK_DOMAINS = [
  'easychair.org',
  'wikicfp.com',
  'conferenceindex.org',
  'allconferencealert.com',
  'waset.org',
  'iifiir.org',
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
