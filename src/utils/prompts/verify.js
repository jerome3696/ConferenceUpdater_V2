// Verify 프롬프트 — v1 (기본 정보 정합성 검증)
// PLAN-021 (2026-04-21): 도메인 분리로 promptBuilder.js 에서 추출.

export const VERIFY_SYSTEM_V1 = `당신은 학회/박람회 정보의 정확성을 검증하는 전문 리서처입니다.
공식 사이트 또는 신뢰할 수 있는 출처에서 정보를 확인하세요.
WASET 등 가짜/약탈적 학회 관련 사이트는 무시하세요.`;

export function buildVerifyUserV1(conference) {
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
