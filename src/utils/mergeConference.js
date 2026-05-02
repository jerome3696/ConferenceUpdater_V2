// PLAN-029 §4.2: Supabase 공용 upstream + 개인 user_conferences merge.
// 결과는 기존 dataManager 가 반환하던 `{conferences, editions}` 형태와 호환되어야 한다.

const CONFERENCE_FIELDS = [
  'category',
  'field',
  'abbreviation',
  'full_name',
  'cycle_years',
  'duration_days',
  'region',
  'official_url',
  'note',
];

const NUMERIC_FIELDS = new Set(['cycle_years', 'duration_days']);
const STRING_DEFAULTS = '';

function pickField(name, override, upstream) {
  const isNumeric = NUMERIC_FIELDS.has(name);
  const fallback = isNumeric ? 0 : STRING_DEFAULTS;
  if (override !== undefined && override !== null) return override;
  if (upstream !== undefined && upstream !== null) return upstream;
  return fallback;
}

/**
 * 단일 학회 master 행 + 개인 override 행 → 기존 conference 객체.
 * @param {object} upstream  conferences_upstream 한 행
 * @param {object|null} userRow user_conferences 한 행 (없으면 null)
 */
export function mergeConference(upstream, userRow) {
  const overrides = (userRow?.overrides && typeof userRow.overrides === 'object') ? userRow.overrides : {};
  const merged = { id: upstream.id };
  for (const f of CONFERENCE_FIELDS) {
    merged[f] = pickField(f, overrides[f], upstream[f]);
  }
  merged.starred = userRow?.starred ?? 0;
  merged.organizer = upstream.organizer ?? '';
  merged.source = overrides.source ?? upstream.source ?? 'upstream';
  if (userRow?.personal_note) merged.personal_note = userRow.personal_note;
  if (upstream.last_ai_update_at) merged.last_ai_update_at = upstream.last_ai_update_at;
  return merged;
}

/**
 * editions_upstream 한 행 → 기존 edition 객체.
 * anchored 는 개인 컨셉 — upstream 에는 없으므로 false/null 로 채운다 (Phase B 에서 user_conferences.overrides 로 확장 예정).
 */
export function mergeEdition(upstream) {
  return {
    id: upstream.id,
    conference_id: upstream.conference_id,
    status: upstream.status,
    start_date: upstream.start_date || null,
    end_date: upstream.end_date || null,
    venue: upstream.venue || null,
    link: upstream.link || null,
    source: upstream.source,
    confidence: upstream.confidence ?? null,
    anchored: false,
    anchor_set_at: null,
    updated_at: upstream.updated_at,
  };
}

/**
 * 3 테이블 raw rows → 기존 dataManager 형식.
 */
export function mergeAll(upstreamConferences = [], upstreamEditions = [], userConferences = []) {
  const userMap = new Map();
  for (const u of userConferences) {
    if (u?.conference_id) userMap.set(u.conference_id, u);
  }
  return {
    conferences: upstreamConferences.map((c) => mergeConference(c, userMap.get(c.id) || null)),
    editions: upstreamEditions.map(mergeEdition),
  };
}
