// PLAN-028 CORS headers for Edge Functions
// GitHub Pages origin 만 허용 (본 앱). 로컬 dev 시 vite 5173 추가.

const ALLOWED_ORIGINS = [
  'https://jerome3696.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') ?? '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}
