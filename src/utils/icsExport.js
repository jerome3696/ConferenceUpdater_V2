// ICS (iCalendar, RFC 5545) 생성 유틸.
// 순수 함수 — 향후 서버(Cloudflare Worker 등)에서 구독 URL용으로 동일하게 재사용.

const CRLF = '\r\n';

function pad2(n) { return String(n).padStart(2, '0'); }

function toIcsDate(d) {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function toIcsDateTimeUtc(d) {
  return `${toIcsDate(d)}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

// RFC 5545 §3.3.11: 텍스트 필드에서 \ ; , 는 역슬래시 이스케이프, 개행은 \n.
function escapeText(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// RFC 5545 §3.1: 라인은 75 옥텟 넘으면 folding. 간단히 문자 단위로 잘라도 ASCII 범위에선 충분.
function foldLine(line) {
  if (line.length <= 75) return line;
  const chunks = [];
  let i = 0;
  chunks.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join(CRLF);
}

function parseYmd(s) {
  if (!s || typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

function addDaysUtc(d, delta) {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + delta);
  return out;
}

// conferenceRow → VEVENT 라인 배열. upcoming 없거나 날짜 파싱 실패면 null.
function buildEvent(row, { dtstamp, prodUid }) {
  const u = row.upcoming;
  if (!u || !u.start_date) return null;
  const start = parseYmd(u.start_date);
  if (!start) return null;
  const endInclusive = u.end_date ? parseYmd(u.end_date) : start;
  // DTEND (all-day)는 배타적이므로 마지막날 +1일.
  const dtendExclusive = addDaysUtc(endInclusive || start, 1);

  const uid = `${row.id}@${prodUid}`;
  const summary = row.abbreviation
    ? `${row.abbreviation} — ${row.full_name}`
    : (row.full_name || row.id);
  const descParts = [];
  if (row.category) descParts.push(`분류: ${row.category}`);
  if (row.field) descParts.push(`분야: ${row.field}`);
  if (row.region) descParts.push(`지역: ${row.region}`);
  if (u.source) descParts.push(`출처: ${u.source}`);
  const description = descParts.join('\n');
  const location = u.venue || '';
  const url = u.link || row.official_url || '';

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${toIcsDate(start)}`,
    `DTEND;VALUE=DATE:${toIcsDate(dtendExclusive)}`,
    `SUMMARY:${escapeText(summary)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (location) lines.push(`LOCATION:${escapeText(location)}`);
  if (url) lines.push(`URL:${escapeText(url)}`);
  lines.push('END:VEVENT');
  return lines;
}

// 캘린더 문자열 생성. rows 중 upcoming 없는 항목은 자동 스킵.
export function buildIcs(rows, opts = {}) {
  const {
    calName = 'ConferenceFinder',
    prodId = '-//ConferenceFinder//Calendar//EN',
    prodUid = 'conferencefinder',
    timezone = 'Asia/Seoul',
    now = new Date(),
  } = opts;
  const dtstamp = toIcsDateTimeUtc(now);

  const header = [
    'BEGIN:VCALENDAR',
    `PRODID:${prodId}`,
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
    `X-WR-TIMEZONE:${timezone}`,
  ];
  const footer = ['END:VCALENDAR'];

  const body = [];
  for (const row of rows) {
    const evt = buildEvent(row, { dtstamp, prodUid });
    if (evt) body.push(...evt);
  }

  const all = [...header, ...body, ...footer].map(foldLine);
  return all.join(CRLF) + CRLF;
}

// 파일명 안전화.
export function toIcsFilename(scopeLabel, now = new Date()) {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const safe = String(scopeLabel || 'calendar').replace(/[^\w가-힣-]+/g, '_');
  return `conferencefinder_${safe}_${y}${m}${d}.ics`;
}

// 브라우저 다운로드 트리거. 테스트에서는 호출하지 않음.
export function downloadIcs(ics, filename) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
