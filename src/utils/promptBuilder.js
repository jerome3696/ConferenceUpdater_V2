// 프롬프트 빌더 — 버전 기반 템플릿
// v1은 blueprint.md §5.3/§5.4 원문을 그대로 반영.
// 새 버전 추가 시 TEMPLATES.update / TEMPLATES.verify 에 키 하나 추가하면 됨.

import { BANNED_LINK_DOMAINS } from '../services/responseParser.js';

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

// v7: last.link 까지 노출. AI 가 시리즈/회차 도메인 패턴을 추정할 수 있도록.
function formatLastEditionV2(lastEdition) {
  if (!lastEdition) return '정보 없음';
  const { start_date, end_date, venue, link } = lastEdition;
  const parts = [];
  if (start_date) parts.push(`${start_date}${end_date ? ` ~ ${end_date}` : ''}`);
  if (venue) parts.push(venue);
  if (link) parts.push(`link=${link}`);
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

const UPDATE_SYSTEM_V5 = UPDATE_SYSTEM_V4;

const BANNED_LIST_INLINE = BANNED_LINK_DOMAINS.join(', ');

const UPDATE_SYSTEM_V6 = `당신은 학회/박람회 정보를 검색하는 전문 리서처입니다.

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
2순위: 주관기관 공식 이벤트 페이지 (예: iifiir.org/en/events/XXX — 이벤트 직접 URL이 **특정 회차를 가리키는 경우만**)
3순위: 주관기관의 컨퍼런스 색인/허브 페이지. 해당 회차를 명시적으로 나열·언급하는 경우에 한해 허용 (예: ibpsa.org/conferences/, astfe.org/conferences/). 허용 시 confidence는 'medium' 이하.
4순위 (1·2·3순위 링크 없을 때만): venue 또는 개최 사실을 확인한 출처 URL — 이 경우 confidence 반드시 'low'. 단, 아래 금지 도메인에 해당하면 사용 불가.

금지 (제3자 CFP 집계·회차 무관 시리즈 페이지): ${BANNED_LIST_INLINE}. 특히 iifiir.org/en/iir-conferences-series 및 iifiir.org/en/events (이벤트 목록/검색 페이지 루트) 금지. 단, iifiir.org/en/events/<특정 이벤트 슬러그> 처럼 해당 회차를 **직접 가리키는** 이벤트 페이지는 2순위로 허용.

**중요**: 해당 회차 specific 정보(날짜 또는 해당 회차를 식별하는 URL)가 없으면 link=null.

[Link–Confidence 상호구속]
- confidence가 'high' 또는 'medium' 이면 link는 반드시 non-null이어야 한다. 1~3순위가 막히면 4순위라도 채우고 confidence='low'로 내린다. 반대로 link가 null이면 confidence는 무조건 'low'.
- confidence='high'인데 link=null, 혹은 "공식 페이지에서 확인" 취지의 notes와 link=null이 공존하는 응답은 **모순**이므로 금지.

[Draft/초안 사이트 처리]
- 주최자가 스태틱 사이트 빌더(framer.ai, notion.site, wix.com, squarespace.com 등)로 만든 회차 페이지도 **link로 사용 허용**.
- 허용 조건: 사이트에서 해당 회차의 날짜나 장소 중 하나 이상 확인 가능. 이 경우 confidence는 'low' 강제, notes에 'draft/prototype' 명시.
- 정식 도메인(자체 .org/.com)이 나중에 개설되면 그것이 1순위, draft 사이트는 즉시 대체.

[Venue 포맷 — 엄격]
venue는 아래 규칙을 반드시 따라야 한다.
- 미국 개최: "City, State, USA" (예: "Orlando, Florida, USA", "Chicago, Illinois, USA"). 주 이름은 풀 네임(약자 FL/IL 금지). 국가명은 'USA' 고정 — 'United States'/'US'/'U.S.'/'U.S.A.' 금지.
- 캐나다 개최: "City, Province, Canada" (예: "Toronto, Ontario, Canada").
- 기타 국가: "City, Country" (예: "Milan, Italy", "Seoul, Korea"). 국가명 정규화: 영국은 'UK' (United Kingdom 금지), 한국은 'Korea' (South Korea/Republic of Korea 금지).

[신뢰도 기준]
high  : 1·2순위 링크에서 날짜(start_date)+장소 모두 직접 확인, link non-null
medium: 날짜 있으나 장소 불확실, 또는 3순위 색인 페이지에서 확인. link non-null
low   : start_date 미확인, 또는 4순위(간접 출처)·draft 사이트만 존재, 또는 link=null

[이름 매칭]
학회명/약칭이 요청에 명시됩니다. 정확히 그 학회의 정보만 반환하세요.
("ASHRAE Winter Conference"와 "ASHRAE Annual Conference"는 다른 학회)

반드시 공식 사이트 또는 신뢰할 수 있는 출처에서 정보를 찾으세요.`;

function buildUpdateUserV6(conference, lastEdition) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    full_name = '',
    abbreviation = '',
    cycle_years = 0,
    official_url = '',
    dedicated_url = '',
  } = conference;
  const dedicatedLine = dedicated_url ? `\n회차 전용 사이트(힌트): ${dedicated_url}` : '';
  const dedicatedHint = dedicated_url
    ? '\n- "회차 전용 사이트(힌트)"가 제공된 경우: 그 URL을 직접 방문·탐색하여 날짜/장소를 확보하라. 힌트 URL이 유효(해당 회차 공식 페이지)하면 link로 우선 사용. 힌트가 오래되었거나 잘못된 경우에만 일반 검색으로 보정.'
    : '';
  return `다음 학회의 다음(upcoming) 개최 정보를 찾아주세요.

오늘: ${today}

학회명: ${full_name}
약칭: ${abbreviation || '없음'}
주기: ${cycle_years ? `${cycle_years}년` : '미상'}
공식사이트: ${official_url || '없음'}${dedicatedLine}
마지막 개최: ${formatLastEdition(lastEdition)}

[upcoming 판별 — 반환 직전 필수 검증]
찾은 학회의 start_date를 오늘(${today})과 YYYY-MM-DD 문자열로 비교하세요.
- start_date > ${today} → upcoming. 그대로 반환.
- start_date <= ${today} → 반환 금지 (과거 또는 당일). 주기를 고려해 다음 회차를 탐색하되, 정보가 없으면 start_date/end_date/venue/link 모두 null로 둘 것.

비교는 연·월·일 자릿수 단위. 같은 연도라도 start_date의 월·일이 오늘(${today})보다 뒤라면 미래입니다. "같은 연도니까 이미 지났다"는 판단 금지.

[반환 직전 자기검증 체크리스트]
1. venue 포맷: 미국이면 "City, State, USA", 캐나다면 "City, Province, Canada", 그 외 "City, Country". 국가명 표기 규칙 준수.
2. link vs confidence: confidence가 'high'/'medium'인데 link=null이면 안 됨. 둘 중 하나를 수정 후 반환.
3. source_url이 있으면 link도 최소 그 URL 또는 더 적합한 링크로 채워져 있어야 함 (금지 도메인 제외).

[기타 주의]
- 해당 회차 전용 사이트를 최우선. 3순위(주관기관 컨퍼런스 색인) 페이지도 회차를 식별하면 허용.
- 공식사이트를 발견했으나 홈페이지에 날짜가 없을 경우, 사이트 내 하위 페이지(Important Dates / Program / Venue / About / Registration 등)를 추가 탐색하라. 날짜가 사이트 어딘가에 있다면 반드시 추출해야 한다.${dedicatedHint}

찾아야 할 정보:
- 시작일 (YYYY-MM-DD)
- 종료일 (YYYY-MM-DD)
- 장소 (위 venue 포맷 규칙 적용)
- 공식 링크 (링크 우선순위 1→4순위 적용, Link–Confidence 상호구속 준수)

반드시 아래 JSON 형식으로만 응답하세요. 설명 문장은 JSON 뒤에 붙여도 되지만, JSON 블록은 반드시 포함되어야 합니다. 확인 불가 필드는 null로 두세요.

\`\`\`json
{
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "venue": "City, State, USA | City, Country",
  "link": "https://...",
  "source_url": "근거가 된 출처 URL",
  "confidence": "high" | "medium" | "low",
  "notes": "부가 설명 (선택)"
}
\`\`\``;
}

function buildUpdateUserV5(conference, lastEdition) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    full_name = '',
    abbreviation = '',
    cycle_years = 0,
    official_url = '',
    dedicated_url = '',
  } = conference;
  const dedicatedLine = dedicated_url ? `\n회차 전용 사이트(힌트): ${dedicated_url}` : '';
  const dedicatedHint = dedicated_url
    ? '\n- "회차 전용 사이트(힌트)"가 제공된 경우: 그 URL을 직접 방문·탐색하여 날짜/장소를 확보하라. 힌트 URL이 유효(해당 회차 공식 페이지)하면 link로 우선 사용. 힌트가 오래되었거나 잘못된 경우에만 일반 검색으로 보정.'
    : '';
  return `다음 학회의 다음(upcoming) 개최 정보를 찾아주세요.

오늘: ${today}

학회명: ${full_name}
약칭: ${abbreviation || '없음'}
주기: ${cycle_years ? `${cycle_years}년` : '미상'}
공식사이트: ${official_url || '없음'}${dedicatedLine}
마지막 개최: ${formatLastEdition(lastEdition)}

[upcoming 판별 — 반환 직전 필수 검증]
찾은 학회의 start_date를 오늘(${today})과 YYYY-MM-DD 문자열로 비교하세요.
- start_date > ${today} → upcoming. 그대로 반환.
- start_date <= ${today} → 반환 금지 (과거 또는 당일). 주기를 고려해 다음 회차를 탐색하되, 정보가 없으면 start_date/end_date/venue/link 모두 null로 둘 것.

비교는 연·월·일 자릿수 단위. 같은 연도라도 start_date의 월·일이 오늘(${today})보다 뒤라면 미래입니다. "같은 연도니까 이미 지났다"는 판단 금지.

[기타 주의]
- 해당 회차 전용 사이트를 최우선으로 찾으세요. 리스팅/집계 사이트(easychair.org 등)는 사용 금지.
- 공식사이트를 발견했으나 홈페이지에 날짜가 없을 경우, 사이트 내 하위 페이지(Important Dates / Program / Venue / About / Registration 등)를 추가 탐색하라. 날짜가 사이트 어딘가에 있다면 반드시 추출해야 한다.${dedicatedHint}

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

// v7: v6 베이스에 last.link 활용 지시 추가, dedicated_url 제거.
const UPDATE_SYSTEM_V7 = `당신은 학회/박람회 정보를 검색하는 전문 리서처입니다.

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

[마지막 개최 정보 활용 — v7 추가]
요청에 "마지막 개최" link 이 포함될 수 있습니다. 이 URL 은 과거 회차의 공식 페이지이며, 다음 회차 URL 을 **패턴 추정**하는 강력한 힌트입니다.

패턴 1 — 회차 번호:
- ihtc18.org (18회) → 다음 회차 후보: ihtc19.org, ihtc20.org
- icr2025.kr → icr2027.kr (주기=2년)

패턴 2 — 연도:
- ecos2024.insae.ro → ecos2026.insae.ro (주기=2년), ecos2025.<host>
- cryogenics-conference.eu/cryogenics2025/ → /cryogenics2027/

**절차**:
1. 마지막 개최 link 가 주어지면, 주기(cycle_years)를 참고해 다음 회차 URL 후보 1~3개를 추정.
2. web_fetch 로 후보 URL 을 직접 방문. 페이지가 존재하고 해당 회차 정보를 제공하면 link 1순위로 채택.
3. 후보가 모두 404/부재면 일반 web_search 로 보정.
4. 마지막 link 가 시리즈 루트(예: ashrae.org) 여서 패턴 추정이 불가능하면 건너뛰고 일반 검색.

이 절차로 web_search 횟수와 정확도를 동시에 개선하세요.

[링크 우선순위]
1순위: 해당 회차 전용 사이트 (예: icr2027.org, cryogenics-conference.eu/cryogenics2027/)
2순위: 주관기관 공식 이벤트 페이지 (예: iifiir.org/en/events/XXX — 이벤트 직접 URL이 **특정 회차를 가리키는 경우만**)
3순위: 주관기관의 컨퍼런스 색인/허브 페이지. 해당 회차를 명시적으로 나열·언급하는 경우에 한해 허용. 허용 시 confidence는 'medium' 이하.
4순위 (1·2·3순위 링크 없을 때만): venue 또는 개최 사실을 확인한 출처 URL — 이 경우 confidence 반드시 'low'. 단, 아래 금지 도메인에 해당하면 사용 불가.

금지 (제3자 CFP 집계·회차 무관 시리즈 페이지): ${BANNED_LIST_INLINE}. 특히 iifiir.org/en/iir-conferences-series 및 iifiir.org/en/events (이벤트 목록/검색 페이지 루트) 금지. 단, iifiir.org/en/events/<특정 이벤트 슬러그> 처럼 해당 회차를 **직접 가리키는** 이벤트 페이지는 2순위로 허용.

**중요**: 해당 회차 specific 정보(날짜 또는 해당 회차를 식별하는 URL)가 없으면 link=null.

[Link–Confidence 상호구속]
- confidence가 'high' 또는 'medium' 이면 link는 반드시 non-null이어야 한다. 1~3순위가 막히면 4순위라도 채우고 confidence='low'로 내린다. 반대로 link가 null이면 confidence는 무조건 'low'.
- confidence='high'인데 link=null, 혹은 "공식 페이지에서 확인" 취지의 notes와 link=null이 공존하는 응답은 **모순**이므로 금지.

[Draft/초안 사이트 처리]
- 주최자가 스태틱 사이트 빌더(framer.ai, notion.site, wix.com, squarespace.com 등)로 만든 회차 페이지도 **link로 사용 허용**.
- 허용 조건: 사이트에서 해당 회차의 날짜나 장소 중 하나 이상 확인 가능. 이 경우 confidence는 'low' 강제, notes에 'draft/prototype' 명시.
- 정식 도메인(자체 .org/.com)이 나중에 개설되면 그것이 1순위, draft 사이트는 즉시 대체.

[Venue 포맷 — 엄격]
venue는 아래 규칙을 반드시 따라야 한다.
- 미국 개최: "City, State, USA" (예: "Orlando, Florida, USA", "Chicago, Illinois, USA"). 주 이름은 풀 네임(약자 FL/IL 금지). 국가명은 'USA' 고정 — 'United States'/'US'/'U.S.'/'U.S.A.' 금지.
- 캐나다 개최: "City, Province, Canada" (예: "Toronto, Ontario, Canada").
- 기타 국가: "City, Country" (예: "Milan, Italy", "Seoul, Korea"). 국가명 정규화: 영국은 'UK' (United Kingdom 금지), 한국은 'Korea' (South Korea/Republic of Korea 금지).

[신뢰도 기준]
high  : 1·2순위 링크에서 날짜(start_date)+장소 모두 직접 확인, link non-null
medium: 날짜 있으나 장소 불확실, 또는 3순위 색인 페이지에서 확인. link non-null
low   : start_date 미확인, 또는 4순위(간접 출처)·draft 사이트만 존재, 또는 link=null

[이름 매칭]
학회명/약칭이 요청에 명시됩니다. 정확히 그 학회의 정보만 반환하세요.
("ASHRAE Winter Conference"와 "ASHRAE Annual Conference"는 다른 학회)

반드시 공식 사이트 또는 신뢰할 수 있는 출처에서 정보를 찾으세요.`;

function buildUpdateUserV7(conference, lastEdition) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    full_name = '',
    abbreviation = '',
    cycle_years = 0,
    official_url = '',
  } = conference;
  const lastLine = formatLastEditionV2(lastEdition);
  const lastLinkHint = lastEdition?.link
    ? '\n- 마지막 개최 link 가 제공됨 → 주기(cycle_years)를 반영해 다음 회차 URL 패턴을 먼저 추정·web_fetch 시도한 뒤, 필요 시 web_search 로 보정.'
    : '';
  return `다음 학회의 다음(upcoming) 개최 정보를 찾아주세요.

오늘: ${today}

학회명: ${full_name}
약칭: ${abbreviation || '없음'}
주기: ${cycle_years ? `${cycle_years}년` : '미상'}
공식사이트: ${official_url || '없음'}
마지막 개최: ${lastLine}

[upcoming 판별 — 반환 직전 필수 검증]
찾은 학회의 start_date를 오늘(${today})과 YYYY-MM-DD 문자열로 비교하세요.
- start_date > ${today} → upcoming. 그대로 반환.
- start_date <= ${today} → 반환 금지 (과거 또는 당일). 주기를 고려해 다음 회차를 탐색하되, 정보가 없으면 start_date/end_date/venue/link 모두 null로 둘 것.

비교는 연·월·일 자릿수 단위. 같은 연도라도 start_date의 월·일이 오늘(${today})보다 뒤라면 미래입니다. "같은 연도니까 이미 지났다"는 판단 금지.

[반환 직전 자기검증 체크리스트]
1. venue 포맷: 미국이면 "City, State, USA", 캐나다면 "City, Province, Canada", 그 외 "City, Country". 국가명 표기 규칙 준수.
2. link vs confidence: confidence가 'high'/'medium'인데 link=null이면 안 됨. 둘 중 하나를 수정 후 반환.
3. source_url이 있으면 link도 최소 그 URL 또는 더 적합한 링크로 채워져 있어야 함 (금지 도메인 제외).

[기타 주의]
- 해당 회차 전용 사이트를 최우선. 3순위(주관기관 컨퍼런스 색인) 페이지도 회차를 식별하면 허용.
- 공식사이트를 발견했으나 홈페이지에 날짜가 없을 경우, 사이트 내 하위 페이지(Important Dates / Program / Venue / About / Registration 등)를 추가 탐색하라. 날짜가 사이트 어딘가에 있다면 반드시 추출해야 한다.${lastLinkHint}

찾아야 할 정보:
- 시작일 (YYYY-MM-DD)
- 종료일 (YYYY-MM-DD)
- 장소 (위 venue 포맷 규칙 적용)
- 공식 링크 (링크 우선순위 1→4순위 적용, Link–Confidence 상호구속 준수)

반드시 아래 JSON 형식으로만 응답하세요. 설명 문장은 JSON 뒤에 붙여도 되지만, JSON 블록은 반드시 포함되어야 합니다. 확인 불가 필드는 null로 두세요.

\`\`\`json
{
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "venue": "City, State, USA | City, Country",
  "link": "https://...",
  "source_url": "근거가 된 출처 URL",
  "confidence": "high" | "medium" | "low",
  "notes": "부가 설명 (선택)"
}
\`\`\``;
}

// ──────────────────────────────────────────────────────────────────
// Last-edition discovery (PLAN-013-D)
// upcoming 검색 전에 past 회차 link/날짜/장소를 먼저 확보해 v7 프롬프트에 주입.
// ──────────────────────────────────────────────────────────────────

const LAST_EDITION_SYSTEM_V1 = `당신은 학회/박람회의 **과거 회차(most recent past)** 정보를 찾는 전문 리서처입니다.

[작업]
지정된 학회의 가장 최근에 이미 개최 완료된 회차 1건을 찾아 반환하세요.
"과거 회차": end_date <= today 인 회차. 복수 회차 존재 시 end_date 가 가장 오늘에 가까운 1건.

[링크 우선순위]
1순위: 해당 회차 전용 사이트 (예: ihtc18.org, ecos2024.insae.ro)
2순위: 주관기관 이벤트 페이지가 그 회차를 직접 가리키는 경우 (iifiir.org/en/events/<slug>)
3순위: 시리즈 색인 페이지 중 해당 회차를 식별 가능한 앵커/섹션

금지 (제3자 CFP 집계): ${BANNED_LIST_INLINE}
단, iifiir.org/en/events/<특정 이벤트 슬러그> 처럼 해당 회차를 **직접 가리키는** 이벤트 페이지는 2순위로 허용.

[신뢰도 기준]
high  : 1·2순위 링크에서 날짜(start_date)+장소 직접 확인
medium: 날짜 있으나 link 가 3순위 색인 또는 장소 불확실
low   : 날짜 또는 link 미확인

[venue 포맷]
- 미국: "City, State, USA" (주 풀네임)
- 캐나다: "City, Province, Canada"
- 기타: "City, Country" (UK/Korea 표기 규칙은 update 프롬프트와 동일)

확인 불가 필드는 null 로 두세요. 과거 회차 자체가 존재하지 않거나 정보가 없으면 모든 필드 null.`;

function buildLastEditionUserV1(conference) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    full_name = '',
    abbreviation = '',
    cycle_years = 0,
    official_url = '',
  } = conference;
  return `다음 학회의 가장 최근 과거(past) 회차 정보를 찾아주세요.

오늘: ${today}

학회명: ${full_name}
약칭: ${abbreviation || '없음'}
주기: ${cycle_years ? `${cycle_years}년` : '미상'}
공식사이트: ${official_url || '없음'}

[과거 회차 판별]
- end_date <= ${today} 인 회차만.
- 복수 회차 발견 시 가장 최근(가장 오늘에 가까운 end_date) 1건만 반환.
- 아직 개최 전인 upcoming 회차는 절대 반환 금지.

찾아야 할 정보:
- 시작일 (YYYY-MM-DD)
- 종료일 (YYYY-MM-DD)
- 장소 (venue 포맷 규칙 적용)
- 해당 회차 공식 링크 (link 우선순위 1→3)

반드시 아래 JSON 형식으로만 응답하세요. 확인 불가 필드는 null.

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

// ──────────────────────────────────────────────────────────────────
// Discovery (PLAN-011): 신규 학회 발굴 — 2-stage
//   Stage 1: 시드 키워드 → 연관 키워드 10개 (web_search 불필요)
//   Stage 2: 선택 키워드 + 기존 학회 배제 → 후보 학회 배열 (web_search)
// ──────────────────────────────────────────────────────────────────

const DISCOVERY_EXPAND_SYSTEM_V1 = `당신은 학술 분야 키워드 확장 전문가입니다.

[작업]
사용자가 제시한 시드 키워드(1~3개)를 보고, 같은/유사 분야의 국제 학회 검색에 사용할 수 있는 연관 키워드 10개를 **한국어/영어 페어**로 제안하세요.

[원칙]
- 시드 키워드와 학술적으로 인접한 분야의 키워드만 (예: "열전달" → 열관리/thermal management, 극저온/cryogenics, 공기조화/HVAC).
- ko 는 한국 학계에서 정착된 학술용어 우선. 정착된 용어가 없으면 자연 번역 또는 음차.
- en 은 국제 학회 web_search 에 그대로 쓸 수 있는 표준 영문 용어.
- ko 와 en 의 의미는 일대일 일치해야 함.
- 너무 일반적인 단어 제외 (예: "research", "engineering", "science").
- 너무 좁은 단어 제외 (단일 알고리즘·제품명·특정 학회 약칭).
- 시드 키워드 자체는 결과에 포함 금지 (이미 사용자가 알고 있음).

[출력 형식]
반드시 아래 JSON 형식만 응답. 설명 문장 없이 JSON 객체만. 모든 항목은 ko/en 두 키 모두 비어있지 않아야 함.

\`\`\`json
{
  "keywords": [
    { "ko": "열관리", "en": "thermal management" },
    { "ko": "공기조화", "en": "HVAC" },
    { "ko": "극저온", "en": "cryogenics" },
    { "ko": "콜드체인", "en": "cold chain" },
    { "ko": "열유체", "en": "thermofluid" },
    { "ko": "건물 에너지", "en": "building energy" },
    { "ko": "상변화", "en": "phase change" },
    { "ko": "냉동", "en": "refrigeration" },
    { "ko": "디지털 트윈", "en": "digital twin" },
    { "ko": "에너지 시스템", "en": "energy systems" }
  ]
}
\`\`\``;

function buildDiscoveryExpandUserV1(seedKeywords) {
  const seeds = (Array.isArray(seedKeywords) ? seedKeywords : [seedKeywords])
    .map((s) => String(s).trim())
    .filter(Boolean);
  return `시드 키워드: ${seeds.map((s) => `"${s}"`).join(', ')}

위 시드와 학술적으로 인접한 분야에서 학회 검색에 쓸 수 있는 연관 키워드 10개를 한국어/영어 페어로 제안하세요.
- ko: 한국 학계에서 정착된 학술용어 우선
- en: web_search 에 쓸 수 있는 표준 영문 용어
- 시드 자체 제외, 너무 일반/너무 좁은 단어 제외`;
}

const DISCOVERY_SEARCH_SYSTEM_V1 = `당신은 학술 학회 발굴 전문 리서처입니다. 웹검색으로 사용자 키워드에 부합하는 국제 학회를 찾되, 다음 규칙을 엄격히 준수하세요.

[작업]
- 제시된 키워드는 한국어/영어 페어로 주어집니다. **영문 면을 web_search 의 메인 쿼리로** 사용하고, 한글 면은 보조·한국 학회 검색에 활용하세요.
- 키워드 중 **하나 이상**에 부합하는 국제 학회/컨퍼런스를 발굴하세요 (OR 매칭, AND 아님).
- 사용자가 이미 보유한 학회 목록(요청에 명시)은 결과에서 **반드시 제외**.
- 정기적으로 개최되는 학회만 (단발 워크숍·세미나·1회성 심포지엄 제외).

[Predatory(가짜·약탈적 학회) 판정 — 매우 중요]
다음 신호 중 하나라도 해당하면 \`predatory_score: "high"\`:
- Publisher가 WASET, OMICS, SCIRP, Hilaris, Science Publishing Group, Bentham Open, Longdom, IIER 중 하나
- 학회명이 "International Conference on X, Y, Z, ..." 처럼 무관 분야를 한꺼번에 다수 다룸
- 도메인이 .events / .conf / academia.edu 만 사용하고 학회 자체 도메인 부재
- ISSN/ISBN/DOI 명시 없음 + 명확한 organizer 미상

\`predatory_score: "medium"\`: 신호가 1~2개 모호하거나, organizer가 알려진 학회 단체가 아님.
\`predatory_score: "low"\`: IEEE / ASME / Springer / Elsevier / AIAA / ASHRAE / Wiley 등 명확한 학회·출판사가 organizer.

[금지 도메인]
${BANNED_LIST_INLINE}
이 도메인이 official_url 후보면 결과 자체에서 제외 (link 후보로도 사용 금지).

[matched_keywords 와 field — 매우 중요]
각 후보 학회에 대해 \`matched_keywords\` 를 채우세요:
- 입력 페어 중 학회 주제와 매칭되는 것을 1~3개, **매칭이 강한 순서**로 정렬.
- 각 항목은 입력 그대로의 ko/en 페어 형태 ({ "ko": "...", "en": "..." }).
- 학회 주제와 무관한 키워드는 절대 포함하지 말 것.

\`field\` (학회 분류) 는 기본적으로 **\`matched_keywords[0].ko\` 와 동일하게** 채우세요.
다만 한국 학계에서 더 적합한 한국어 분류가 명백하면 자유 변경 허용 (예: matched_keywords[0].ko = "냉동" 인데 학회가 본질적으로 "공기조화" 분야라면 field="공기조화").

[Upcoming 정보 (선택)]
가능하면 upcoming 회차 (start_date > today) 정보도 함께 채우세요. 없으면 \`upcoming\` 필드 omit.
- start_date / end_date: YYYY-MM-DD
- venue: "City, Country"
- link: 회차 전용 URL (1순위) 또는 organizer 이벤트 페이지 (2순위). 금지도메인 사용 금지.

[출력 형식]
반드시 아래 JSON 형식만 응답. 설명 문장 없이 JSON 객체만.

\`\`\`json
{
  "candidates": [
    {
      "full_name": "International Heat Transfer Conference",
      "abbreviation": "IHTC",
      "field": "열전달",
      "region": "전세계",
      "official_url": "https://www.ihtc18.org/",
      "organizer": "Assembly for International Heat Transfer Conferences",
      "cycle_years": 4,
      "evidence_url": "https://www.ihtc18.org/about",
      "predatory_score": "low",
      "predatory_reasons": ["Established academic body since 1966"],
      "matched_keywords": [
        { "ko": "열전달", "en": "heat transfer" },
        { "ko": "열관리", "en": "thermal management" }
      ],
      "upcoming": {
        "start_date": "2026-08-10",
        "end_date": "2026-08-14",
        "venue": "Cape Town, South Africa",
        "link": "https://www.ihtc18.org/"
      }
    }
  ]
}
\`\`\`

candidates 배열은 0~20개. 매칭 학회가 없거나 모두 기존 보유라면 빈 배열로 응답.`;

function formatExistingForPrompt(existingIndex) {
  if (!Array.isArray(existingIndex) || existingIndex.length === 0) return '없음 (전부 신규로 간주)';
  return existingIndex
    .map((c) => {
      const abbr = c.abbreviation ? `${c.abbreviation} — ` : '';
      const url = c.official_url ? ` | ${c.official_url}` : '';
      return `- ${abbr}${c.full_name || ''}${url}`;
    })
    .join('\n');
}

// 키워드를 {ko, en} 페어 형태로 정규화. 문자열이면 ko=en 폴백.
function normalizeKeywordPair(k) {
  if (k && typeof k === 'object' && !Array.isArray(k)) {
    const ko = typeof k.ko === 'string' ? k.ko.trim() : '';
    const en = typeof k.en === 'string' ? k.en.trim() : '';
    if (ko || en) return { ko: ko || en, en: en || ko };
    return null;
  }
  if (typeof k === 'string') {
    const t = k.trim();
    if (t) return { ko: t, en: t };
  }
  return null;
}

function buildDiscoverySearchUserV1(selectedKeywords, existingIndex) {
  const today = new Date().toISOString().slice(0, 10);
  const arr = Array.isArray(selectedKeywords) ? selectedKeywords : [selectedKeywords];
  const pairs = arr.map(normalizeKeywordPair).filter(Boolean);
  return `오늘: ${today}

[검색 키워드 (OR 매칭, 한국어 / 영어 페어)]
${pairs.map((p) => `- ${p.ko} / ${p.en}`).join('\n')}

[기존 보유 학회 (반드시 제외)]
${formatExistingForPrompt(existingIndex)}

위 키워드 중 하나 이상에 부합하면서, 보유 목록에 없는 신규 국제 학회를 발굴하세요.
- 영문 면을 web_search 메인 쿼리로 사용
- 매년/격년/3년 주기 등 정기 학회만. 단발 행사 제외.
- 각 후보에 predatory_score, evidence_url, matched_keywords (입력 페어 형태) 를 반드시 포함.
- field 는 기본적으로 matched_keywords[0].ko 와 동일하게.`;
}

const TEMPLATES = {
  update: {
    v1: { system: UPDATE_SYSTEM_V1, user: buildUpdateUserV1 },
    v2: { system: UPDATE_SYSTEM_V2, user: buildUpdateUserV2 },
    v3: { system: UPDATE_SYSTEM_V3, user: buildUpdateUserV3 },
    v4: { system: UPDATE_SYSTEM_V4, user: buildUpdateUserV4 },
    v5: { system: UPDATE_SYSTEM_V5, user: buildUpdateUserV5 },
    v6: { system: UPDATE_SYSTEM_V6, user: buildUpdateUserV6 },
    v7: { system: UPDATE_SYSTEM_V7, user: buildUpdateUserV7 },
  },
  verify: {
    v1: { system: VERIFY_SYSTEM_V1, user: buildVerifyUserV1 },
  },
  discovery_expand: {
    v1: { system: DISCOVERY_EXPAND_SYSTEM_V1, user: buildDiscoveryExpandUserV1 },
  },
  discovery_search: {
    v1: { system: DISCOVERY_SEARCH_SYSTEM_V1, user: buildDiscoverySearchUserV1 },
  },
  last_edition: {
    v1: { system: LAST_EDITION_SYSTEM_V1, user: buildLastEditionUserV1 },
  },
};

export const DEFAULT_UPDATE_VERSION = 'v4';
export const DEFAULT_VERIFY_VERSION = 'v1';
export const DEFAULT_DISCOVERY_EXPAND_VERSION = 'v1';
export const DEFAULT_DISCOVERY_SEARCH_VERSION = 'v1';
export const DEFAULT_LAST_EDITION_VERSION = 'v1';

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

/**
 * 신규 학회 발굴 Stage 1: 시드 키워드 → 연관 키워드 10개.
 * @param {string[]} seedKeywords  사용자 시드 키워드 1~3개
 * @param {object} [opts]
 * @param {string} [opts.version='v1']
 * @returns {{ system: string, user: string, version: string }}
 */
export function buildDiscoveryExpandPrompt(seedKeywords, { version = DEFAULT_DISCOVERY_EXPAND_VERSION } = {}) {
  const tpl = TEMPLATES.discovery_expand[version];
  if (!tpl) throw new Error(`Unknown discovery_expand prompt version: ${version}`);
  return { system: tpl.system, user: tpl.user(seedKeywords), version };
}

/**
 * 신규 학회 발굴 Stage 2: 선택 키워드(OR) + 기존 학회 배제 → 후보 학회 배열.
 * @param {string[]} selectedKeywords  사용자 선택 키워드 1~7개
 * @param {Array<{full_name:string, abbreviation?:string, official_url?:string}>} existingIndex
 * @param {object} [opts]
 * @param {string} [opts.version='v1']
 * @returns {{ system: string, user: string, version: string }}
 */
export function buildDiscoverySearchPrompt(selectedKeywords, existingIndex = [], { version = DEFAULT_DISCOVERY_SEARCH_VERSION } = {}) {
  const tpl = TEMPLATES.discovery_search[version];
  if (!tpl) throw new Error(`Unknown discovery_search prompt version: ${version}`);
  return { system: tpl.system, user: tpl.user(selectedKeywords, existingIndex), version };
}

/**
 * 과거 회차(last edition) 발굴용 프롬프트 (PLAN-013-D).
 * row.last 가 없을 때 update 직전에 선행 호출.
 */
export function buildLastEditionPrompt(conference, { version = DEFAULT_LAST_EDITION_VERSION } = {}) {
  const tpl = TEMPLATES.last_edition[version];
  if (!tpl) throw new Error(`Unknown last_edition prompt version: ${version}`);
  return { system: tpl.system, user: tpl.user(conference), version };
}

export const __TEMPLATES_FOR_TEST = TEMPLATES;
