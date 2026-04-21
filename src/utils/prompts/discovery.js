// Discovery 프롬프트 — 2-stage (PLAN-011)
//   Stage 1 (expand): 시드 키워드 → 연관 키워드 10개 (web_search 불필요)
//   Stage 2 (search): 선택 키워드 + 기존 학회 배제 → 후보 학회 배열 (web_search)
// PLAN-021 (2026-04-21): 도메인 분리로 promptBuilder.js 에서 추출.

import { BANNED_LIST_INLINE, formatExistingForPrompt, normalizeKeywordPair } from './shared.js';

export const DISCOVERY_EXPAND_SYSTEM_V1 = `당신은 학술 분야 키워드 확장 전문가입니다.

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

export function buildDiscoveryExpandUserV1(seedKeywords) {
  const seeds = (Array.isArray(seedKeywords) ? seedKeywords : [seedKeywords])
    .map((s) => String(s).trim())
    .filter(Boolean);
  return `시드 키워드: ${seeds.map((s) => `"${s}"`).join(', ')}

위 시드와 학술적으로 인접한 분야에서 학회 검색에 쓸 수 있는 연관 키워드 10개를 한국어/영어 페어로 제안하세요.
- ko: 한국 학계에서 정착된 학술용어 우선
- en: web_search 에 쓸 수 있는 표준 영문 용어
- 시드 자체 제외, 너무 일반/너무 좁은 단어 제외`;
}

export const DISCOVERY_SEARCH_SYSTEM_V1 = `당신은 학술 학회 발굴 전문 리서처입니다. 웹검색으로 사용자 키워드에 부합하는 국제 학회를 찾되, 다음 규칙을 엄격히 준수하세요.

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

export function buildDiscoverySearchUserV1(selectedKeywords, existingIndex) {
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
