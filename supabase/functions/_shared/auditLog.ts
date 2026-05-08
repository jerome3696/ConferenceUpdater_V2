// PLAN-031 Edge Function audit_log 통합 (best-effort).
// AI 응답을 파싱해서 변경된 필드별로 audit_log row 1개 INSERT.
// trigger(bump_edit_meta)가 conferences_upstream.edited_count 자동 증가.
//
// 실패는 항상 swallow — main response 흐름을 막지 않는다.

const UPDATE_FIELDS = ['start_date', 'end_date', 'venue', 'link'] as const;
const VERIFY_FIELDS = ['full_name', 'abbreviation', 'cycle_years', 'duration_days', 'region', 'official_url'] as const;

type UpdateField = typeof UPDATE_FIELDS[number];
type VerifyField = typeof VERIFY_FIELDS[number];

// AI 응답 텍스트에서 JSON 객체 추출 (responseParser.js 의 extractJson 동등 구현).
// 실패 시 null.
export function extractJson(text: string | undefined): Record<string, unknown> | null {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      const parsed = JSON.parse(fence[1].trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { /* fall through */ }
  }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      const parsed = JSON.parse(text.slice(first, last + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { /* ignore */ }
  }
  return null;
}

function toText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

// admin 클라이언트(service_role)와 응답 텍스트를 받아 audit_log 행을 best-effort 로 INSERT.
// endpoint='update': editions_upstream 의 upcoming row 와 비교 → 4 필드.
// endpoint='verify': conferences_upstream 마스터와 비교 → 6 필드 (status='불일치' 만).
// 다른 endpoint 는 skip.
export async function recordAuditLog(params: {
  // deno-lint-ignore no-explicit-any
  admin: any;
  userId: string;
  conferenceId: string;
  endpoint: 'update' | 'verify';
  responseText: string | undefined;
}): Promise<void> {
  try {
    const data = extractJson(params.responseText);
    if (!data) return;

    if (params.endpoint === 'update') {
      // 현재 upcoming edition (가장 최근 start_date) 조회
      const { data: editions } = await params.admin
        .from('editions_upstream')
        .select('start_date, end_date, venue, link')
        .eq('conference_id', params.conferenceId)
        .eq('status', 'upcoming')
        .order('start_date', { ascending: false, nullsFirst: false })
        .limit(1);
      const current = (editions && editions[0]) || {};
      const rows: Array<Record<string, unknown>> = [];
      for (const f of UPDATE_FIELDS) {
        const newVal = toText(data[f as UpdateField]);
        const oldVal = toText(current[f]);
        if (newVal === oldVal) continue;
        rows.push({
          user_id: params.userId,
          conference_id: params.conferenceId,
          field: f,
          old_value: oldVal,
          new_value: newVal,
          source: 'ai_search',
          endpoint: 'update',
        });
      }
      if (rows.length) await params.admin.from('audit_log').insert(rows);
      return;
    }

    if (params.endpoint === 'verify') {
      const { data: conf } = await params.admin
        .from('conferences_upstream')
        .select('full_name, abbreviation, cycle_years, duration_days, region, official_url')
        .eq('id', params.conferenceId)
        .maybeSingle();
      const current = conf || {};
      const rows: Array<Record<string, unknown>> = [];
      for (const f of VERIFY_FIELDS) {
        const entry = data[f as VerifyField] as { status?: string; correct?: unknown } | undefined;
        if (!entry || typeof entry !== 'object') continue;
        if (entry.status !== '불일치') continue;
        const correct = entry.correct;
        if (correct === undefined || correct === null || correct === '') continue;
        rows.push({
          user_id: params.userId,
          conference_id: params.conferenceId,
          field: f,
          old_value: toText(current[f]),
          new_value: toText(correct),
          source: 'ai_search',
          endpoint: 'verify',
        });
      }
      if (rows.length) await params.admin.from('audit_log').insert(rows);
    }
  } catch (e) {
    console.warn('audit_log best-effort 기록 실패:', (e as Error)?.message ?? e);
  }
}
