// URL 정규화·비교. 정답지 URL과 AI가 반환한 URL을 느슨하게 매칭.
// 소문자화 + protocol/www/trailing slash/hash 제거. query string은 유지 (iifiir.org/en/events?... 처럼 필터 의미 있을 수 있음).

export function normalizeUrl(u) {
  if (!u) return '';
  let s = String(u).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^www\./, '');
  s = s.replace(/#.*$/, '');
  s = s.replace(/\/+$/, '');
  return s;
}

/**
 * a와 b가 "같은 페이지로 볼 수 있는가" 판정.
 * - 정규화 후 동일
 * - 한쪽이 다른쪽의 상위 경로 (예: astfe.org vs astfe.org/conferences)
 */
export function urlMatch(a, b) {
  const na = normalizeUrl(a);
  const nb = normalizeUrl(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.startsWith(nb + '/') || nb.startsWith(na + '/')) return true;
  return false;
}
