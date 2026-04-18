// 학회명 fuzzy 중복 검출. discovery 후보가 기존 DB 학회와 동일한지 클라이언트 측에서 재검증.
// AI 가 "기존 학회 배제" 지시를 100% 따르지 못하는 경우 안전망.
//
// 전략:
//  1) normalizeName: lowercase + 4자리 연도 제거 + ordinal(13th, 1st) 제거 + 구두점 제거
//     + "the/and/of/on/in/for" 등 stopword 제거 + 공백 정규화
//  2) abbreviationMatch: 약칭 정규화 후 토큰 단위 정확 매칭
//  3) similarity: Jaro-Winkler (≥0.92 → 동일 후보)
//  4) tokenJaccard 보조 (긴 정식명 / 짧은 약칭 혼용 케이스용, ≥0.75)
//  5) isLikelySameConference: 위 셋 중 하나라도 충족 → true

const STOPWORDS = new Set([
  'the', 'and', 'of', 'on', 'in', 'for', 'a', 'an', 'to', 'with', 'at',
  '&', '-', '–', '—',
  'international', 'conference', 'symposium', 'congress', 'workshop', 'meeting',
  'annual', 'biennial',
]);

// 1st, 2nd, 3rd, 4th, ... 13th 등 ordinal token 검출
const ORDINAL_RE = /^(\d+)(st|nd|rd|th)$/i;

export function normalizeName(s) {
  if (!s || typeof s !== 'string') return '';
  let out = s.toLowerCase();
  // 4자리 연도 제거 (1900~2099 안전)
  out = out.replace(/\b(19|20)\d{2}\b/g, ' ');
  // 구두점 → 공백
  out = out.replace(/[.,:;!?()[\]{}"'`]/g, ' ');
  // 토큰화 + ordinal·stopword 제거
  const tokens = out.split(/\s+/).filter((t) => {
    if (!t) return false;
    if (ORDINAL_RE.test(t)) return false;
    if (STOPWORDS.has(t)) return false;
    return true;
  });
  return tokens.join(' ');
}

export function normalizeAbbr(s) {
  if (!s || typeof s !== 'string') return '';
  // 영숫자만 → 끝의 edition/year 숫자 제거 (IHTC-18 → ihtc, ICCFD13 → iccfd)
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\d+$/, '');
}

// Jaro distance.
function jaro(s1, s2) {
  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;
  const matchDist = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const m1 = new Array(s1.length).fill(false);
  const m2 = new Array(s2.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(s2.length, i + matchDist + 1);
    for (let j = start; j < end; j++) {
      if (m2[j]) continue;
      if (s1[i] !== s2[j]) continue;
      m1[i] = true;
      m2[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }
  t /= 2;
  return (matches / s1.length + matches / s2.length + (matches - t) / matches) / 3;
}

// Jaro-Winkler with prefix bonus (p=0.1, l up to 4).
export function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const j = jaro(a, b);
  let l = 0;
  const maxL = Math.min(4, a.length, b.length);
  while (l < maxL && a[l] === b[l]) l++;
  return j + l * 0.1 * (1 - j);
}

export function tokenJaccard(a, b) {
  if (!a || !b) return 0;
  const sa = new Set(a.split(/\s+/).filter(Boolean));
  const sb = new Set(b.split(/\s+/).filter(Boolean));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return inter / union;
}

/**
 * 두 학회가 같을 가능성이 높은지 판정.
 * @param {{full_name?:string, abbreviation?:string}} a
 * @param {{full_name?:string, abbreviation?:string}} b
 * @param {object} [opts]
 * @param {number} [opts.jwThreshold=0.92]
 * @param {number} [opts.jaccardThreshold=0.75]
 */
export function isLikelySameConference(a, b, opts = {}) {
  const { jwThreshold = 0.92, jaccardThreshold = 0.75 } = opts;
  if (!a || !b) return false;

  // 약칭 동일 (둘 다 4자 이상으로 길어야 신뢰. ICC 같은 너무 짧은 약칭은 false-positive 위험)
  const abbrA = normalizeAbbr(a.abbreviation);
  const abbrB = normalizeAbbr(b.abbreviation);
  if (abbrA && abbrB && abbrA.length >= 4 && abbrA === abbrB) return true;

  const nA = normalizeName(a.full_name);
  const nB = normalizeName(b.full_name);
  if (!nA || !nB) return false;
  if (nA === nB) return true;

  if (jaroWinkler(nA, nB) >= jwThreshold) return true;
  if (tokenJaccard(nA, nB) >= jaccardThreshold) return true;
  return false;
}

/**
 * candidate 가 기존 conferences 중 하나와 매칭되면 매칭된 학회 반환, 아니면 null.
 */
export function findExistingMatch(candidate, existingConferences = []) {
  if (!candidate?.full_name) return null;
  for (const conf of existingConferences) {
    if (isLikelySameConference(candidate, conf)) return conf;
  }
  return null;
}
