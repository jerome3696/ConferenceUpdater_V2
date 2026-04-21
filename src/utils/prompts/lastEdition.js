// Last-edition discovery 프롬프트 — v1 (PLAN-013-D)
// upcoming 검색 전에 past 회차 link/날짜/장소를 먼저 확보해 update 프롬프트에 주입.
// PLAN-021 (2026-04-21): 도메인 분리로 promptBuilder.js 에서 추출.

import { BANNED_LIST_INLINE } from './shared.js';

export const LAST_EDITION_SYSTEM_V1 = `당신은 학회/박람회의 **과거 회차(most recent past)** 정보를 찾는 전문 리서처입니다.

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

export function buildLastEditionUserV1(conference) {
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
