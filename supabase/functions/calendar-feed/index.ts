// PLAN-034: ICS calendar subscription feed Edge Function.
// GET ?token=<calendar_token> → RFC 5545 iCalendar response.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// @ts-ignore: Deno namespace provided by Supabase Edge runtime
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-ignore
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CRLF = '\r\n';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIcsDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function toIcsDateTimeUtc(d: Date): string {
  return `${toIcsDate(d)}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

function escapeText(s: unknown): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let i = 75;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join(CRLF);
}

function parseYmd(s: string | null | undefined): Date | null {
  if (!s || typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

function addDaysUtc(d: Date, delta: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + delta);
  return out;
}

interface ConferenceRow {
  id: string;
  abbreviation?: string | null;
  full_name?: string | null;
  official_url?: string | null;
  category?: string | null;
  field?: string | null;
  region?: string | null;
  editions_upstream?: {
    start_date?: string | null;
    end_date?: string | null;
    venue?: string | null;
    link?: string | null;
    source?: string | null;
  } | null;
}

function buildEvent(row: ConferenceRow, dtstamp: string): string[] | null {
  const ed = row.editions_upstream;
  if (!ed || !ed.start_date) return null;
  const start = parseYmd(ed.start_date);
  if (!start) return null;
  const endInclusive = ed.end_date ? parseYmd(ed.end_date) : start;
  const dtendExclusive = addDaysUtc(endInclusive ?? start, 1);

  const uid = `${row.id}@conferencefinder`;
  const summary = row.abbreviation
    ? `${row.abbreviation} — ${row.full_name}`
    : (row.full_name || row.id);

  const descParts: string[] = [];
  if (row.category) descParts.push(`분류: ${row.category}`);
  if (row.field) descParts.push(`분야: ${row.field}`);
  if (row.region) descParts.push(`지역: ${row.region}`);
  if (ed.source) descParts.push(`출처: ${ed.source}`);
  const description = descParts.join('\n');

  const location = ed.venue || '';
  const url = ed.link || row.official_url || '';

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

function buildIcs(rows: ConferenceRow[]): string {
  const now = new Date();
  const dtstamp = toIcsDateTimeUtc(now);

  const header = [
    'BEGIN:VCALENDAR',
    'PRODID:-//ConferenceFinder//Calendar//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ConferenceFinder',
    'X-WR-TIMEZONE:Asia/Seoul',
  ];
  const footer = ['END:VCALENDAR'];

  const body: string[] = [];
  for (const row of rows) {
    const evt = buildEvent(row, dtstamp);
    if (evt) body.push(...evt);
  }

  const all = [...header, ...body, ...footer].map(foldLine);
  return all.join(CRLF) + CRLF;
}

// Calendar clients (Apple Calendar, Google Calendar, etc.) send GET from any origin.
function calendarCorsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  };
}

// @ts-ignore: Deno.serve provided by Supabase Edge runtime
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: calendarCorsHeaders() });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...calendarCorsHeaders(), 'content-type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response(JSON.stringify({ error: 'missing_token' }), {
      status: 401,
      headers: { ...calendarCorsHeaders(), 'content-type': 'application/json' },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Look up user by calendar_token.
  const { data: userRow, error: userErr } = await admin
    .from('users')
    .select('id')
    .eq('calendar_token', token)
    .maybeSingle();

  if (userErr || !userRow) {
    return new Response(JSON.stringify({ error: 'invalid_token' }), {
      status: 401,
      headers: { ...calendarCorsHeaders(), 'content-type': 'application/json' },
    });
  }

  const userId = userRow.id;

  // Fetch starred conferences with upcoming edition data.
  const { data: rows, error: rowsErr } = await admin
    .from('user_conferences')
    .select(`
      conferences_upstream (
        id,
        abbreviation,
        full_name,
        official_url,
        category,
        field,
        region,
        editions_upstream (
          start_date,
          end_date,
          venue,
          link,
          source
        )
      )
    `)
    .eq('user_id', userId)
    .eq('starred', true);

  if (rowsErr) {
    console.error('calendar-feed query error', rowsErr);
    return new Response(JSON.stringify({ error: 'db_error' }), {
      status: 500,
      headers: { ...calendarCorsHeaders(), 'content-type': 'application/json' },
    });
  }

  // Flatten: each user_conference row wraps a conferences_upstream object.
  const conferences: ConferenceRow[] = (rows ?? [])
    .map((r: { conferences_upstream: ConferenceRow | null }) => r.conferences_upstream)
    .filter((c): c is ConferenceRow => c !== null);

  const ics = buildIcs(conferences);

  return new Response(ics, {
    status: 200,
    headers: {
      ...calendarCorsHeaders(),
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'max-age=3600',
      'Content-Disposition': 'inline; filename="conferencefinder.ics"',
    },
  });
});
