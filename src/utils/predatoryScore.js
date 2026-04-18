// 약탈학회/저널 휴리스틱 점수. responseParser.BANNED_LINK_DOMAINS 의 hard-reject 와
// AI 의 predatory_score 사이를 보강.
//
// 점수가 낮을수록 안전, 높을수록 약탈 의심.
//   ≥ 40  → high
//   20~39 → medium
//   <20   → low
//
// 정책: AI 가 제시한 score 보다 약하게 평가하지 않는다 (max-of-AI-vs-heuristic).
// 즉 AI 가 high 라고 하면 휴리스틱이 낮아도 high 유지.

import { BANNED_LINK_DOMAINS } from '../services/responseParser';

// 신뢰 출판사·학회 단체. 이름·도메인에 등장하면 감점.
const TRUSTED_KEYWORDS = [
  'ieee', 'asme', 'asce', 'ashrae', 'springer', 'elsevier', 'wiley',
  'nature', 'sciencedirect', 'siam', 'acm', 'iccfd', 'eurotherm',
  'iiar', 'iir-iif', 'ihtc', 'imece',
];

// 약탈 출판사·도메인 시그너처. BANNED 외에 이름 텍스트에서도 검출.
const PREDATORY_NAME_PATTERNS = [
  { re: /\bwaset\b/i, score: 50, reason: 'WASET 명칭 매칭' },
  { re: /\bomics\b/i, score: 50, reason: 'OMICS 명칭 매칭' },
  { re: /\bscirp\b/i, score: 40, reason: 'SCIRP 명칭 매칭' },
  { re: /\bhilaris\b/i, score: 40, reason: 'Hilaris 명칭 매칭' },
  { re: /\blongdom\b/i, score: 40, reason: 'Longdom 명칭 매칭' },
  { re: /\bbentham\s*open\b/i, score: 40, reason: 'Bentham Open 명칭 매칭' },
  { re: /\biier\b/i, score: 35, reason: 'IIER 명칭 매칭' },
];

// 도메인 의심 패턴 (BANNED 미포함이지만 약한 신호).
const DOMAIN_SUSPICION_PATTERNS = [
  { re: /\.events?$/i, score: 15, reason: '의심스러운 .events TLD' },
  { re: /\.conf$/i, score: 15, reason: '의심스러운 .conf TLD' },
  { re: /allconferencealert/i, score: 25, reason: 'allConferenceAlert 도메인' },
  { re: /conferenceindex/i, score: 25, reason: 'conferenceindex 도메인' },
];

const SEVERITY_LEVELS = ['low', 'medium', 'high'];

function severityRank(s) {
  const i = SEVERITY_LEVELS.indexOf(s);
  return i === -1 ? 1 : i; // 알 수 없으면 medium 으로 취급
}

function scoreToSeverity(score) {
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

function safeHostname(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function hostMatchesBanned(host) {
  if (!host) return false;
  return BANNED_LINK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * candidate 의 약탈 휴리스틱 점수 + 사유 계산.
 * @param {object} candidate parseDiscoverySearchResponse 가 반환한 형태.
 * @returns {{score:number, severity:'low'|'medium'|'high', reasons:string[]}}
 */
export function scorePredatory(candidate) {
  const reasons = [];
  let score = 0;

  if (!candidate || typeof candidate !== 'object') {
    return { score: 50, severity: 'high', reasons: ['후보 데이터 누락'] };
  }

  const text = `${candidate.full_name || ''} ${candidate.organizer || ''} ${candidate.abbreviation || ''}`;
  const hosts = [
    safeHostname(candidate.official_url),
    safeHostname(candidate.evidence_url),
    safeHostname(candidate.upcoming?.link),
  ].filter(Boolean);

  // 1. 명칭 패턴
  for (const p of PREDATORY_NAME_PATTERNS) {
    if (p.re.test(text)) {
      score += p.score;
      reasons.push(p.reason);
    }
  }

  // 2. 도메인 BANNED (responseParser 가 hard-reject 하므로 일반적으로는 도달 X. 안전망)
  for (const h of hosts) {
    if (hostMatchesBanned(h)) {
      score += 50;
      reasons.push(`금지 도메인 ${h}`);
    }
  }

  // 3. 도메인 의심 패턴
  for (const h of hosts) {
    for (const p of DOMAIN_SUSPICION_PATTERNS) {
      if (p.re.test(h)) {
        score += p.score;
        reasons.push(`${p.reason} (${h})`);
      }
    }
  }

  // 4. cycle_years=1 + 약칭이 너무 일반적 (분야 잡탕 의심)
  if (candidate.cycle_years === 1 && (!candidate.abbreviation || candidate.abbreviation.length < 3)) {
    score += 15;
    reasons.push('매년 개최 + 약칭 불명확 — 분야 잡탕 의심');
  }

  // 5. URL 자체가 없음 (evidence/official 둘 다)
  if (!candidate.official_url && !candidate.evidence_url) {
    score += 20;
    reasons.push('공식·근거 URL 모두 없음');
  }

  // 6. 신뢰 키워드 감점
  const haystack = `${text} ${hosts.join(' ')}`.toLowerCase();
  for (const kw of TRUSTED_KEYWORDS) {
    if (haystack.includes(kw)) {
      score -= 20;
      reasons.push(`신뢰 출판사·단체 매칭 (${kw}) — 감점`);
      break; // 한 번만 적용 (중복 감점 방지)
    }
  }

  if (score < 0) score = 0;
  return { score, severity: scoreToSeverity(score), reasons };
}

/**
 * AI 판정 + 휴리스틱을 합쳐 최종 predatory_score 와 reasons 반환.
 * 정책: 더 강한 쪽(more severe)을 채택. 사유는 양쪽 합집합 (휴리스틱 사유 prefix 표시).
 * @param {object} candidate parseDiscoverySearchResponse 결과.
 * @returns {{predatory_score:'low'|'medium'|'high', predatory_reasons:string[], heuristic_score:number}}
 */
export function combinePredatoryScore(candidate) {
  const aiScore = typeof candidate?.predatory_score === 'string'
    ? candidate.predatory_score.toLowerCase()
    : 'medium';
  const aiReasons = Array.isArray(candidate?.predatory_reasons) ? candidate.predatory_reasons : [];

  const h = scorePredatory(candidate);
  const finalSeverity = severityRank(h.severity) > severityRank(aiScore) ? h.severity : aiScore;

  // 사유 합집합. 휴리스틱 사유는 [휴] prefix 로 구분.
  const heuristicTagged = h.reasons.map((r) => `[휴] ${r}`);
  const merged = [...aiReasons, ...heuristicTagged];

  return {
    predatory_score: SEVERITY_LEVELS.includes(finalSeverity) ? finalSeverity : 'medium',
    predatory_reasons: merged,
    heuristic_score: h.score,
  };
}
