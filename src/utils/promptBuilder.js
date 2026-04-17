// 프롬프트 빌더 — 버전 기반 템플릿
// v1은 blueprint.md §5.3/§5.4 원문을 그대로 반영.
// 새 버전 추가 시 TEMPLATES.update / TEMPLATES.verify 에 키 하나 추가하면 됨.

const UPDATE_SYSTEM_V1 = `당신은 학회/박람회 정보를 검색하는 전문 리서처입니다.
다음 학회의 최신 개최 정보를 웹에서 검색하세요.
반드시 공식 사이트 또는 신뢰할 수 있는 출처에서 정보를 찾으세요.
WASET 등 가짜/약탈적 학회 관련 사이트는 무시하세요.`;

const UPDATE_SYSTEM_V2 = `당신은 학회/박람회 정보를 검색하는 전문 리서처입니다.

[날짜 규칙]
오늘 날짜는 요청에 명시됩니다. 오늘 이후에 시작하는 upcoming 회차만 반환하세요.
이미 종료된 회차·과거 연도 학회 정보는 반환 금지.

[링크 우선순위]
1순위: 해당 회차 전용 사이트 (예: icr2027.org, cryogenics-conference.eu/cryogenics2027/)
2순위: 주관기관 공식 이벤트 페이지 (예: iifiir.org/en/events/XXX — 이벤트 직접 URL)
3순위: 주관기관 메인/컨퍼런스 페이지
금지: easychair.org, framer.ai, wikicfp.com, allconferencealert.com, conferenceindex.org, waset.org, iifiir.org/en/iir-conferences-series 등 제3자 리스팅/CFP 집계 페이지

[이름 매칭]
학회명/약칭이 요청에 명시됩니다. 정확히 그 학회의 정보만 반환하세요.
("ASHRAE Winter Conference"와 "ASHRAE Annual Conference"는 다른 학회)

반드시 공식 사이트 또는 신뢰할 수 있는 출처에서 정보를 찾으세요.`;

const VERIFY_SYSTEM_V1 = `당신은 학회/박람회 정보의 정확성을 검증하는 전문 리서처입니다.
공식 사이트 또는 신뢰할 수 있는 출처에서 정보를 확인하세요.
WASET 등 가짜/약탈적 학회 관련 사이트는 무시하세요.`;

function formatLastEdition(lastEdition) {
  if (!lastEdition) return '정보 없음';
  const { start_date, end_date, venue } = lastEdition;
  const parts = [];
  if (start_date) parts.push(`${start_date}${end_date ? ` ~ ${end_date}` : ''}`);
  if (venue) parts.push(venue);
  return parts.length ? parts.join(' / ') : '정보 없음';
}

function buildUpdateUserV1(conference, lastEdition) {
  const {
    full_name = '',
    abbreviation = '',
    cycle_years = 0,
    official_url = '',
  } = conference;
  return `다음 학회의 다음(upcoming) 개최 정보를 찾아주세요.

학회명: ${full_name}
약칭: ${abbreviation || '없음'}
주기: ${cycle_years ? `${cycle_years}년` : '미상'}
공식사이트: ${official_url || '없음'}
마지막 개최: ${formatLastEdition(lastEdition)}

찾아야 할 정보:
- 시작일 (YYYY-MM-DD)
- 종료일 (YYYY-MM-DD)
- 장소 (도시, 국가)
- 공식 링크 (해당 회차 전용 URL이 있으면 그것, 없으면 공식사이트)

반드시 아래 JSON 형식으로만 응답하세요. 설명 문장은 JSON 뒤에 붙여도 되지만, JSON 블록은 반드시 포함되어야 합니다. 확인 불가 필드는 null로 두세요.

\`\`\`json
{
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "venue": "City, Country",
  "link": "https://...",
  "source_url": "근거가 된 출처 URL",
  "confidence": "high" | "medium" | "low",
  "notes": "부가 설명 (선택)"
}
\`\`\``;
}

function buildUpdateUserV2(conference, lastEdition) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    full_name = '',
    abbreviation = '',
    cycle_years = 0,
    official_url = '',
  } = conference;
  return `다음 학회의 다음(upcoming) 개최 정보를 찾아주세요.

오늘: ${today}

학회명: ${full_name}
약칭: ${abbreviation || '없음'}
주기: ${cycle_years ? `${cycle_years}년` : '미상'}
공식사이트: ${official_url || '없음'}
마지막 개최: ${formatLastEdition(lastEdition)}

주의:
- 시작일이 오늘(${today}) 이전이면 반환하지 마세요.
- 해당 회차 전용 사이트를 최우선으로 찾으세요. 리스팅/집계 사이트(easychair.org 등)는 사용 금지.

찾아야 할 정보:
- 시작일 (YYYY-MM-DD)
- 종료일 (YYYY-MM-DD)
- 장소 (도시, 국가)
- 공식 링크 (해당 회차 전용 URL이 있으면 그것, 없으면 공식사이트)

반드시 아래 JSON 형식으로만 응답하세요. 설명 문장은 JSON 뒤에 붙여도 되지만, JSON 블록은 반드시 포함되어야 합니다. 확인 불가 필드는 null로 두세요.

\`\`\`json
{
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "venue": "City, Country",
  "link": "https://...",
  "source_url": "근거가 된 출처 URL",
  "confidence": "high" | "medium" | "low",
  "notes": "부가 설명 (선택)"
}
\`\`\``;
}

function buildVerifyUserV1(conference) {
  const {
    full_name = '',
    abbreviation = '',
    cycle_years = 0,
    duration_days = 0,
    region = '',
    official_url = '',
  } = conference;
  return `다음 학회의 기본 정보가 정확한지 검증해주세요.

학회명: ${full_name}
약칭: ${abbreviation || '없음'}
주기: ${cycle_years ? `${cycle_years}년` : '미상'}
기간: ${duration_days ? `${duration_days}일` : '미상'}
지역: ${region || '미상'}
공식사이트: ${official_url || '없음'}

각 항목에 대해 "일치" / "불일치" / "확인불가" 중 하나로 판정하고, 불일치인 경우 올바른 값을 제시하세요.

반드시 아래 JSON 형식으로 응답하세요.

\`\`\`json
{
  "full_name":    { "status": "일치" | "불일치" | "확인불가", "correct": "불일치일 때 올바른 값" },
  "abbreviation": { "status": "...", "correct": "..." },
  "cycle_years":  { "status": "...", "correct": 2 },
  "duration_days":{ "status": "...", "correct": 5 },
  "region":       { "status": "...", "correct": "..." },
  "official_url": { "status": "...", "correct": "https://..." },
  "source_url": "근거가 된 출처 URL"
}
\`\`\``;
}

const TEMPLATES = {
  update: {
    v1: { system: UPDATE_SYSTEM_V1, user: buildUpdateUserV1 },
    v2: { system: UPDATE_SYSTEM_V2, user: buildUpdateUserV2 },
  },
  verify: {
    v1: { system: VERIFY_SYSTEM_V1, user: buildVerifyUserV1 },
  },
};

export const DEFAULT_UPDATE_VERSION = 'v1';
export const DEFAULT_VERIFY_VERSION = 'v1';

/**
 * 업데이트(다음 개최 찾기)용 프롬프트.
 * @param {object} conference   conferences.json의 학회 1건
 * @param {object|null} lastEdition  가장 최근 past edition (없으면 null)
 * @param {object} [opts]
 * @param {string} [opts.version='v1']
 * @returns {{ system: string, user: string, version: string }}
 */
export function buildUpdatePrompt(conference, lastEdition = null, { version = DEFAULT_UPDATE_VERSION } = {}) {
  const tpl = TEMPLATES.update[version];
  if (!tpl) throw new Error(`Unknown update prompt version: ${version}`);
  return { system: tpl.system, user: tpl.user(conference, lastEdition), version };
}

/**
 * 정합성 검증용 프롬프트.
 */
export function buildVerifyPrompt(conference, { version = DEFAULT_VERIFY_VERSION } = {}) {
  const tpl = TEMPLATES.verify[version];
  if (!tpl) throw new Error(`Unknown verify prompt version: ${version}`);
  return { system: tpl.system, user: tpl.user(conference), version };
}

export const __TEMPLATES_FOR_TEST = TEMPLATES;
