// PLAN-028 claude-proxy Edge Function (Supabase / Deno)
// 책임:
//   1) JWT 검증 (auth.uid())
//   2) 쿼터 원자적 차감 (consume_quota RPC) — 월초 lazy reset 포함
//   3) 예산 상한 체크 ($50/월) — 초과 시 refund
//   4) 공용 DB TTL 선참조 (conferences_upstream.last_ai_update_at < 30d) → hit 시 API skip
//   5) Anthropic 호출 (Prompt Caching 활성)
//   6) api_usage_log 기록 + quotas 응답
//   7) 모든 실패 경로에서 보상 트랜잭션

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, preflight } from '../_shared/cors.ts';
import { callAnthropic, extractWebSearchCount } from '../_shared/anthropic.ts';
import { computeCostUsd } from '../_shared/cost.ts';

// @ts-ignore: Deno namespace is provided by Supabase Edge runtime
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-ignore
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// @ts-ignore
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
// @ts-ignore
const BUDGET_CAP_USD = Number(Deno.env.get('MONTHLY_BUDGET_CAP_USD') ?? '50');
// @ts-ignore
const CACHE_TTL_DAYS = Number(Deno.env.get('CACHE_TTL_DAYS') ?? '30');

type Endpoint = 'update' | 'discovery_expand' | 'discovery_search' | 'verify';

interface RequestBody {
  endpoint: Endpoint;
  conference_id?: string;
  prompt: string;
  system?: string;
  webSearch?: boolean;
  webFetch?: boolean;
  maxTokens?: number;
  maxWebSearches?: number;
  model?: string;
  // force_refresh: 캐시 히트 무시하고 재조회
  force_refresh?: boolean;
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'content-type': 'application/json' },
  });
}

// @ts-ignore: Deno.serve is provided by Supabase Edge runtime
Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'method_not_allowed' }, 405);
  }

  // ── 1) JWT 검증 ────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return jsonResponse(req, { error: 'unauthorized' }, 401);

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser(jwt);
  if (authErr || !authData?.user) {
    return jsonResponse(req, { error: 'unauthorized' }, 401);
  }
  const userId = authData.user.id;

  // ── 2) Body 파싱 ───────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'invalid_json' }, 400);
  }
  const { endpoint, conference_id, prompt, system } = body;
  const valid: Endpoint[] = ['update', 'discovery_expand', 'discovery_search', 'verify'];
  if (!valid.includes(endpoint) || !prompt) {
    return jsonResponse(req, { error: 'invalid_body' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── 3) 캐시 선참조 (update/verify 에 한정, conference_id 필요) ──
  if (!body.force_refresh && conference_id && (endpoint === 'update' || endpoint === 'verify')) {
    const { data: cached } = await admin
      .from('conferences_upstream')
      .select('id, last_ai_update_at')
      .eq('id', conference_id)
      .maybeSingle();

    if (cached?.last_ai_update_at) {
      const ageMs = Date.now() - new Date(cached.last_ai_update_at).getTime();
      const ttlMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
      if (ageMs < ttlMs) {
        await admin.from('api_usage_log').insert({
          user_id: userId, endpoint, conference_id,
          status: 'cached', cost_usd: 0,
        });
        return jsonResponse(req, {
          cached: true,
          conference_id,
          last_ai_update_at: cached.last_ai_update_at,
          message: `공용 캐시 히트 (<${CACHE_TTL_DAYS}일) — API 호출 skip`,
        });
      }
    }
  }

  // ── 4) 쿼터 차감 (RPC) ──────────────────────────────────────
  const { data: quotaRows, error: quotaErr } = await admin.rpc('consume_quota', {
    p_user_id: userId, p_endpoint: endpoint,
  });
  if (quotaErr) {
    console.error('consume_quota error', quotaErr);
    return jsonResponse(req, { error: 'quota_rpc_error' }, 500);
  }
  const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
  if (!quota?.allowed) {
    await admin.from('api_usage_log').insert({
      user_id: userId, endpoint, conference_id: conference_id ?? null,
      status: 'quota_block', cost_usd: 0,
    });
    return jsonResponse(req, {
      error: 'quota_exceeded', quota_after: quota,
    }, 429);
  }

  // ── 5) 예산 상한 체크 ──────────────────────────────────────
  const { data: budgetUsed } = await admin.rpc('monthly_budget_used');
  if (typeof budgetUsed === 'number' && budgetUsed >= BUDGET_CAP_USD) {
    // user 차단, admin 은 통과 (디버깅). role 조회.
    const { data: roleRow } = await admin
      .from('users').select('role').eq('id', userId).maybeSingle();
    if (roleRow?.role !== 'admin') {
      await admin.rpc('refund_quota', { p_user_id: userId, p_endpoint: endpoint });
      await admin.from('api_usage_log').insert({
        user_id: userId, endpoint, conference_id: conference_id ?? null,
        status: 'quota_block', cost_usd: 0,
      });
      return jsonResponse(req, {
        error: 'budget_cap', monthly_used: budgetUsed, cap: BUDGET_CAP_USD,
      }, 429);
    }
  }

  // ── 6) Anthropic 호출 ──────────────────────────────────────
  let response;
  try {
    response = await callAnthropic({
      apiKey: ANTHROPIC_API_KEY,
      prompt,
      system,
      webSearch: body.webSearch,
      webFetch: body.webFetch,
      maxTokens: body.maxTokens,
      maxWebSearches: body.maxWebSearches,
      model: body.model,
      cacheSystem: Boolean(system),
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? 'unknown';
    await admin.rpc('refund_quota', { p_user_id: userId, p_endpoint: endpoint });
    await admin.from('api_usage_log').insert({
      user_id: userId, endpoint, conference_id: conference_id ?? null,
      status: 'error', cost_usd: 0,
    });
    console.error('Anthropic call failed', msg);
    return jsonResponse(req, { error: 'upstream_error', detail: msg.slice(0, 200) }, 502);
  }

  // ── 7) 비용 계산 + 로그 ────────────────────────────────────
  const usage = response.usage;
  const webSearches = extractWebSearchCount(response);
  const cost_usd = computeCostUsd({
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    web_searches: webSearches,
  });

  await admin.from('api_usage_log').insert({
    user_id: userId,
    endpoint,
    conference_id: conference_id ?? null,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    web_searches: webSearches,
    cache_hit_tokens: usage.cache_read_input_tokens ?? 0,
    cost_usd,
    status: 'success',
  });

  // conferences_upstream TTL 갱신 (update/verify 에 한정)
  if (conference_id && (endpoint === 'update' || endpoint === 'verify')) {
    await admin
      .from('conferences_upstream')
      .update({ last_ai_update_at: new Date().toISOString() })
      .eq('id', conference_id);
  }

  // ── 8) 쿼터 재조회 후 응답 ─────────────────────────────────
  const { data: quotaAfter } = await admin
    .from('quotas').select('*').eq('user_id', userId).maybeSingle();

  return jsonResponse(req, {
    cached: false,
    response,
    cost_usd,
    quota_after: quotaAfter,
  });
});
