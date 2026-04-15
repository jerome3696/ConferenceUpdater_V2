// Claude 응답 파싱 + 스키마 검증.
// AI 응답은 항상 완벽한 JSON이 아닐 수 있음 → 실패 원인을 구분해서 돌려줌.

export const UPDATE_SCHEMA = {
  required: ['start_date', 'end_date', 'venue', 'link'],
  optional: ['source_url', 'confidence', 'notes'],
};

export const VERIFY_FIELDS = [
  'full_name', 'abbreviation', 'cycle_years', 'duration_days', 'region', 'official_url',
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
