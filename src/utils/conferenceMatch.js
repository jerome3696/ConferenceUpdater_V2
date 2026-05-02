// 학회 정체성 매칭의 단일 진실 함수 (blueprint v2 §2.3).
// upstream DB 후보가 새 candidate 와 동일 학회인지 판정.
//
// 매칭 전략:
//   1차) official_url 정규화 후 동일 (normalizeUrl + urlMatch 재사용)
//   2차) full_name fuzzy 매칭 (isLikelySameConference 재사용)
//
// 순수 함수 — 외부 IO 없음.

import { urlMatch } from '../services/urlMatch';
import { isLikelySameConference } from './nameMatch';

/**
 * candidate 가 upstreamConferences 중 하나와 동일 학회로 판정되면 해당 항목 반환, 아니면 null.
 *
 * @param {{ official_url?: string, full_name?: string, abbreviation?: string }} candidate
 * @param {Array<{ official_url?: string, full_name?: string, abbreviation?: string }>} upstreamConferences
 * @returns {object|null}
 */
export function findUpstreamMatch(candidate, upstreamConferences = []) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (!upstreamConferences.length) return null;

  const hasUrl = candidate.official_url && typeof candidate.official_url === 'string';
  const hasName = candidate.full_name && typeof candidate.full_name === 'string';

  // candidate 에 매칭 가능한 필드가 없으면 조기 종료
  if (!hasUrl && !hasName) return null;

  for (const conf of upstreamConferences) {
    // 1차: URL 정규화 매칭
    if (hasUrl && conf.official_url) {
      if (urlMatch(candidate.official_url, conf.official_url)) return conf;
    }

    // 2차: 이름 fuzzy 매칭
    if (hasName) {
      if (isLikelySameConference(candidate, conf)) return conf;
    }
  }

  return null;
}
