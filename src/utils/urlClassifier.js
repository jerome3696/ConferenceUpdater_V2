// URL 신뢰도 분류. shouldSearch() 등 업데이트 결정 로직이 소비.
//
// 분류 체계:
//   official_edition — 특정 회차 전용 도메인 (ecos2026.insae.ro, ihtc18.org, icr2027.org)
//   official_series  — 시리즈/주관기관 공식 도메인 (ashrae.org, euroturbo.eu)
//   org_event        — 주관기관의 구체 이벤트 슬러그 (iifiir.org/en/events/icr2027)
//   news             — 뉴스·블로그 호스트
//   listing          — CFP·집계 root (BANNED_LINK_DOMAINS)
//   unknown          — 그 외
//
// trust 축 (shouldSearch 가 실제로 소비):
//   high   — official_edition, official_series
//   medium — org_event, unknown
//   low    — news, listing
//
// 주의: 약탈 출판사 도메인은 responseParser 가 이미 배제하므로 여기선 'listing' 으로 흡수.

import { BANNED_LINK_DOMAINS } from '../services/responseParser';
import { normalizeUrl } from '../services/urlMatch';

const NEWS_HOST_TOKENS = [
  'news', 'nytimes', 'reuters', 'bloomberg', 'forbes', 'cnn', 'bbc',
  'guardian', 'washingtonpost', 'wsj', 'tribune', 'herald', 'gazette',
  'businesswire', 'prnewswire', 'medium.com', 'substack.com',
  'wordpress.com', 'blogspot.com', 'tistory.com', 'brunch.co.kr',
];

function extractHost(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    const n = normalizeUrl(url);
    if (!n) return '';
    return n.split('/')[0];
  }
}

function extractPath(url) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}

function hostMatchesDomain(host, domain) {
  if (!host || !domain) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

function isBannedHost(host) {
  return BANNED_LINK_DOMAINS.some((d) => hostMatchesDomain(host, d));
}

function isNewsHost(host) {
  return NEWS_HOST_TOKENS.some((t) => host.includes(t));
}

// 회차 전용 도메인 패턴:
// - 호스트 라벨 자체가 4자리 연도 (events/2026.domain)
// - 또는 약칭 + 숫자(2~4자리) 접합 (ihtc18, ecos2026)
// - 또는 숫자 + 약칭 접합 (2026ashrae)
function isEditionHost(host, abbreviation) {
  if (!host) return false;
  const labels = host.split('.');
  const abbr = (abbreviation || '').trim().toLowerCase();
  const YEAR = /^(?:19|20)\d{2}$/;
  const EDITION_NUM = /^\d{2,4}$/;

  for (const label of labels) {
    if (YEAR.test(label)) return true;
    if (!abbr) continue;
    if (label.startsWith(abbr) && label.length > abbr.length) {
      if (EDITION_NUM.test(label.slice(abbr.length))) return true;
    }
    if (label.endsWith(abbr) && label.length > abbr.length) {
      if (EDITION_NUM.test(label.slice(0, label.length - abbr.length))) return true;
    }
  }
  return false;
}

function isOfficialSeriesHost(host, conference) {
  const officialHost = extractHost(conference?.official_url || '');
  if (!officialHost) return false;
  return hostMatchesDomain(host, officialHost) || hostMatchesDomain(officialHost, host);
}

// 구체 이벤트 슬러그 경로 (org_event 판정용).
// /events/<slug>, /conferences/<slug>, /meetings/<slug> 처럼 뒤에 식별자 세그먼트가 있어야 함.
// 순수 /events 나 /events/ 는 허브 root 로 보고 제외.
function hasEventSlugPath(url) {
  const path = extractPath(url);
  if (!path) return false;
  return /\/(events?|conferences?|meetings?|workshops?|symposia)\/[^/]+/.test(path);
}

/**
 * @param {string} url
 * @param {{ official_url?: string, abbreviation?: string }} conference
 * @returns {{ type: 'official_edition'|'official_series'|'org_event'|'news'|'listing'|'unknown', trust: 'high'|'medium'|'low' }}
 */
export function classifyUrlTrust(url, conference = {}) {
  if (!url || typeof url !== 'string') return { type: 'unknown', trust: 'medium' };
  const host = extractHost(url);
  if (!host) return { type: 'unknown', trust: 'medium' };

  if (isEditionHost(host, conference.abbreviation)) {
    return { type: 'official_edition', trust: 'high' };
  }

  if (isOfficialSeriesHost(host, conference)) {
    return { type: 'official_series', trust: 'high' };
  }

  // 차단 도메인이어도 구체 이벤트 슬러그 페이지는 org_event 로 격상.
  if (isBannedHost(host)) {
    if (hasEventSlugPath(url)) return { type: 'org_event', trust: 'medium' };
    return { type: 'listing', trust: 'low' };
  }

  if (isNewsHost(host)) return { type: 'news', trust: 'low' };

  return { type: 'unknown', trust: 'medium' };
}
