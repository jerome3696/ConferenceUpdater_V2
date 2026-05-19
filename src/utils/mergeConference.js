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
 * raw rows → 기존 dataManager 형식. 각 conference 에 소속 라이브러리 목록(libraries) 부착.
 * 참조 모델(blueprint §1.5.1): 라이브러리는 학회 데이터를 복사하지 않고 태그로 붙는다.
 * @param {Array} libraries          libraries 테이블 행 (PLAN-030)
 * @param {Array} libraryConferences library_conferences 태그 행 (PLAN-030)
 */
export function mergeAll(
  upstreamConferences = [],
  upstreamEditions = [],
  userConferences = [],
  libraries = [],
  libraryConferences = [],
) {
  const userMap = new Map();
  for (const u of userConferences) {
    if (u?.conference_id) userMap.set(u.conference_id, u);
  }

  // conference_id → [library 객체]
  const libById = new Map();
  for (const lib of libraries) {
    if (lib?.id) libById.set(lib.id, lib);
  }
  const libsByConf = new Map();
  for (const lc of libraryConferences) {
    if (!lc?.conference_id) continue;
    const lib = libById.get(lc.library_id);
    if (!lib) continue;
    if (!libsByConf.has(lc.conference_id)) libsByConf.set(lc.conference_id, []);
    libsByConf.get(lc.conference_id).push(lib);
  }

  return {
    conferences: upstreamConferences.map((c) => {
      const merged = mergeConference(c, userMap.get(c.id) || null);
      merged.libraries = libsByConf.get(c.id) || [];
      return merged;
    }),
    editions: upstreamEditions.map(mergeEdition),
  };
}

/**
 * PLAN-030: 메인 테이블 게이팅 — 사용자가 구독한 라이브러리(+ 본인 가상 "내 학회")에
 * 속한 학회만 남긴다. mergeAll 결과를 받아 필터링하는 순수 함수.
 *
 * - 가상 라이브러리(`is_virtual`)는 RLS 상 본인 것만 조회되므로 항상 허용.
 * - 어떤 라이브러리에도 속하지 않은 학회(orphan)는 안전망으로 표시 유지 — 데이터
 *   이상이나 아직 태그되지 않은 발굴 학회가 사라지지 않게.
 *
 * @param {{conferences:Array, editions:Array}} merged  mergeAll 출력
 * @param {string[]} subscribedLibraryIds  user_libraries 의 library_id 목록
 */
export function gateBySubscribedLibraries(merged, subscribedLibraryIds = []) {
  const allowed = new Set(subscribedLibraryIds);
  const conferences = (merged.conferences || []).filter((c) => {
    const libs = c.libraries || [];
    if (libs.length === 0) return true; // orphan 안전망
    return libs.some((l) => l.is_virtual || allowed.has(l.id));
  });
  const keptIds = new Set(conferences.map((c) => c.id));
  const editions = (merged.editions || []).filter((e) => keptIds.has(e.conference_id));
  return { conferences, editions };
}
