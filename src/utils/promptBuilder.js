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

const UPDATE_SYSTEM_V3 = `당신은 학회/박람회 정보를 검색하는 전문 리서처입니다.

[날짜 규칙 — 엄격]
요청에는 오늘 날짜가 YYYY-MM-DD 형식으로 명시됩니다.
"upcoming" 회차의 정의: **start_date > today** (YYYY-MM-DD 문자열 사전식 비교).

검증 예시 (today=2026-04-17 기준):
- start_date=2026-04-18 → upcoming ✅  (4/18이 4/17보다 뒤)
- start_date=2026-05-26 → upcoming ✅  (5월이 4월보다 뒤)
- start_date=2026-08-02 → upcoming ✅  (8월이 4월보다 뒤)
- start_date=2027-01-23 → upcoming ✅  (2027년이 2026년보다 뒤)
- start_date=2026-04-17 → 반환 금지  (오늘과 동일)
- start_date=2026-03-10 → 반환 금지  (오늘보다 앞)
- start_date=2025-06-28 → 반환 금지  (과거 연도)

**반환 전 반드시 확인**: start_date 문자열이 today 문자열보다 뒤인지 자릿수 단위로 비교하세요.
같은 연도 안에 있다는 이유만으로 "이미 지났다"고 판단하지 마세요 — 오늘이 4월이면 5·6·7·8·9·10·11·12월은 모두 미래입니다.

[링크 우선순위]
1순위: 해당 회차 전용 사이트 (예: icr2027.org, cryogenics-conference.eu/cryogenics2027/)
2순위: 주관기관 공식 이벤트 페이지 (예: iifiir.org/en/events/XXX — 이벤트 직접 URL)
3순위: 주관기관 메인/컨퍼런스 페이지
금지: easychair.org, framer.ai, wikicfp.com, allconferencealert.com, conferenceindex.org, waset.org, iifiir.org/en/iir-conferences-series 등 제3자 리스팅/CFP 집계 페이지

[이름 매칭]
학회명/약칭이 요청에 명시됩니다. 정확히 그 학회의 정보만 반환하세요.
("ASHRAE Winter Conference"와 "ASHRAE Annual Conference"는 다른 학회)

반드시 공식 사이트 또는 신뢰할 수 있는 출처에서 정보를 찾으세요.`;

const UPDATE_SYSTEM_V4 = `당신은 학회/박람회 정보를 검색하는 전문 리서처입니다.

[날짜 규칙 — 엄격]
요청에는 오늘 날짜가 YYYY-MM-DD 형식으로 명시됩니다.
"upcoming" 회차의 정의: **start_date > today** (YYYY-MM-DD 문자열 사전식 비교).

검증 예시 (today=2026-04-17 기준):
- start_date=2026-04-18 → upcoming ✅  (4/18이 4/17보다 뒤)
- start_date=2026-05-26 → upcoming ✅  (5월이 4월보다 뒤)
- start_date=2026-08-02 → upcoming ✅  (8월이 4월보다 뒤)
- start_date=2027-01-23 → upcoming ✅  (2027년이 2026년보다 뒤)
- start_date=2026-04-17 → 반환 금지  (오늘과 동일)
- start_date=2026-03-10 → 반환 금지  (오늘보다 앞)
- start_date=2025-06-28 → 반환 금지  (과거 연도)

**반환 전 반드시 확인**: start_date 문자열이 today 문자열보다 뒤인지 자릿수 단위로 비교하세요.
같은 연도 안에 있다는 이유만으로 "이미 지났다"고 판단하지 마세요 — 오늘이 4월이면 5·6·7·8·9·10·11·12월은 모두 미래입니다.

[링크 우선순위]
1순위: 해당 회차 전용 사이트 (예: icr2027.org, cryogenics-conference.eu/cryogenics2027/)
2순위: 주관기관 공식 이벤트 페이지 (예: iifiir.org/en/events/XXX — 이벤트 직접 URL)
3순위: 주관기관 메인/컨퍼런스 페이지
4순위 (1·2·3순위 링크 없을 때만): venue 또는 개최 사실을 확인한 출처 URL — 이 경우 confidence 반드시 'low'로 설정. 단, 아래 금지 도메인에 해당하면 사용 불가.
금지: easychair.org, framer.ai, wikicfp.com, allconferencealert.com, conferenceindex.org, waset.org, iifiir.org/en/iir-conferences-series 등 제3자 리스팅/CFP 집계 페이지

**중요**: 해당 회차 specific 정보(날짜 또는 해당 회차 전용 URL)가 없으면 link=null.
시리즈 목록 페이지·주관기관 일반 이벤트 목록 페이지는 사용 금지 (회차와 무관한 일반 페이지).
(금지 예: iifiir.org/en/iir-conferences-series, iifiir.org/en/events)

[신뢰도 기준]
high  : 1·2순위 링크에서 날짜(start_date)+장소 모두 직접 확인
medium: 날짜 있으나 장소 불확실, 또는 3순위 출처에서 확인
low   : start_date 미확인, 또는 공식 회차 페이지 없이 4순위(간접 출처)만 존재

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

function buildUpdateUserV3(conference, lastEdition) {
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

[upcoming 판별 — 반환 직전 필수 검증]
찾은 학회의 start_date를 오늘(${today})과 YYYY-MM-DD 문자열로 비교하세요.
- start_date > ${today} → upcoming. 그대로 반환.
- start_date <= ${today} → 반환 금지 (과거 또는 당일). 주기를 고려해 다음 회차를 탐색하되, 정보가 없으면 start_date/end_date/venue/link 모두 null로 둘 것.

비교는 연·월·일 자릿수 단위. 같은 연도라도 start_date의 월·일이 오늘(${today})보다 뒤라면 미래입니다. "같은 연도니까 이미 지났다"는 판단 금지.

[기타 주의]
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

function buildUpdateUserV4(conference, lastEdition) {
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

[upcoming 판별 — 반환 직전 필수 검증]
찾은 학회의 start_date를 오늘(${today})과 YYYY-MM-DD 문자열로 비교하세요.
- start_date > ${today} → upcoming. 그대로 반환.
- start_date <= ${today} → 반환 금지 (과거 또는 당일). 주기를 고려해 다음 회차를 탐색하되, 정보가 없으면 start_date/end_date/venue/link 모두 null로 둘 것.

비교는 연·월·일 자릿수 단위. 같은 연도라도 start_date의 월·일이 오늘(${today})보다 뒤라면 미래입니다. "같은 연도니까 이미 지났다"는 판단 금지.

[기타 주의]
- 해당 회차 전용 사이트를 최우선으로 찾으세요. 리스팅/집계 사이트(easychair.org 등)는 사용 금지.
- 공식사이트를 발견했으나 홈페이지에 날짜가 없을 경우, 사이트 내 하위 페이지(Important Dates / Program / Venue / About / Registration 등)를 추가 탐색하라. 날짜가 사이트 어딘가에 있다면 반드시 추출해야 한다.

찾아야 할 정보:
- 시작일 (YYYY-MM-DD)
- 종료일 (YYYY-MM-DD)
- 장소 (도시, 국가)
- 공식 링크 (링크 우선순위 1→4순위 적용)

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
    v3: { system: UPDATE_SYSTEM_V3, user: buildUpdateUserV3 },
    v4: { system: UPDATE_SYSTEM_V4, user: buildUpdateUserV4 },
  },
  verify: {
    v1: { system: VERIFY_SYSTEM_V1, user: buildVerifyUserV1 },
  },
};

export const DEFAULT_UPDATE_VERSION = 'v4';
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
