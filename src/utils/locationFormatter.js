// QA #10 — venue 표시 포맷 통일.
// US: "City, State, USA" / 그 외: "City, Country".
// 입력 데이터의 country 표기 흔들림(United States, U.S.A., U.S., US 등)을 'USA'로 정규화.

const US_ALIASES = new Set([
  'usa', 'us', 'u.s', 'u.s.a',
  'united states', 'united states of america',
]);

function normalizeUsToken(s) {
  return s.toLowerCase().replace(/\.+$/, '').replace(/\s+/g, ' ').trim();
}

export function formatLocation(venue) {
  if (venue == null) return '';
  if (typeof venue !== 'string') return String(venue);
  const parts = venue.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  const last = normalizeUsToken(parts[parts.length - 1]);
  if (US_ALIASES.has(last)) {
    parts[parts.length - 1] = 'USA';
  }
  return parts.join(', ');
}
