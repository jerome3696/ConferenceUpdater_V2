#!/usr/bin/env node
/**
 * PLAN-028 Step S5: conferences.json → Supabase 1회성 마이그레이션
 *
 * 사용:
 *   node scripts/migrate-json-to-supabase.mjs             # dry-run (기본)
 *   node scripts/migrate-json-to-supabase.mjs --commit    # 실제 삽입
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (필수)
 *
 * 멱등성:
 *   - upsert 기반 (ON CONFLICT DO UPDATE). 재실행 안전.
 *   - --commit 없이 실행 시 삽입 대상 count 만 출력.
 */

import fs from 'node:fs';
import path from 'node:path';

const COMMIT = process.argv.includes('--commit');
const STRICT = process.argv.includes('--strict');
const JSON_PATH = path.resolve('public/data/conferences.json');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function log(...args) { console.log(...args); }
function die(msg, code = 1) { console.error('ERROR:', msg); process.exit(code); }

if (!fs.existsSync(JSON_PATH)) die(`not found: ${JSON_PATH}`);

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const { conferences = [], editions = [] } = data;
log(`source: ${conferences.length} conferences, ${editions.length} editions`);

// ── 변환 함수 ────────────────────────────────────────────────
function toUpstreamConference(c) {
  // CHECK 제약: category IN ('학회','박람회'). 빈 값(disc_* 잔여)은 '학회' 로 normalize.
  const category = c.category && c.category.trim() ? c.category : '학회';
  return {
    id: c.id,
    category,
    field: c.field,
    abbreviation: c.abbreviation || null,
    full_name: c.full_name,
    cycle_years: c.cycle_years,
    duration_days: c.duration_days,
    region: c.region || null,
    official_url: c.official_url || null,
    note: c.note || null,
    organizer: c.extra?.organizer ?? c.organizer ?? null,
    found_at: c.extra?.found_at ?? c.found_at ?? null,
  };
}

// CHECK: source IN ('ai_search','user_input','backfill','initial_import')
// 레거시 값(ai_discovery·ai_backfill) 을 스키마에 맞게 normalize
const SOURCE_MAP = {
  ai_search: 'ai_search',
  user_input: 'user_input',
  backfill: 'backfill',
  initial_import: 'initial_import',
  ai_discovery: 'ai_search',   // 발굴 프롬프트 결과 → 동일 버킷
  ai_backfill: 'backfill',     // 레거시 표기
};

function toUpstreamEdition(e) {
  const src = e.source ?? 'initial_import';
  return {
    id: e.id,
    conference_id: e.conference_id,
    status: e.status ?? 'unknown',
    start_date: e.start_date || null,
    end_date: e.end_date || null,
    venue: e.venue || null,
    link: e.link || null,
    source: SOURCE_MAP[src] ?? 'initial_import',
    confidence: e.confidence ?? null,
    notes: e.notes ?? null,
    updated_at: e.updated_at ?? new Date().toISOString(),
  };
}

const confRows = conferences.map(toUpstreamConference);
const edRows = editions.map(toUpstreamEdition);

// ── 검증 ──────────────────────────────────────────────────────
const confIds = new Set(confRows.map((r) => r.id));
const orphanEditions = edRows.filter((e) => !confIds.has(e.conference_id));

if (orphanEditions.length) {
  log(`⚠️  ${orphanEditions.length} orphan editions (discovery 잔여 등):`);
  orphanEditions.slice(0, 5).forEach((o) =>
    log(`    ${o.id} -> ${o.conference_id} (${o.venue ?? 'no venue'})`),
  );
  if (STRICT) die('--strict: orphan editions 발견 시 중단');
  log('  → skip (운영 데이터 무결성 유지). --strict 플래그로 엄격 모드.');
}

const cleanEdRows = edRows.filter((e) => confIds.has(e.conference_id));
log(`dry-run validation: ${confRows.length} conferences + ${cleanEdRows.length} editions (orphans skipped: ${orphanEditions.length})`);
log('sample conference:', JSON.stringify(confRows[0], null, 2));
log('sample edition:', JSON.stringify(cleanEdRows[0], null, 2));

if (!COMMIT) {
  log('\n(dry-run complete — rerun with --commit to apply)');
  process.exit(0);
}

// ── 실제 삽입 (--commit) ──────────────────────────────────────
if (!SUPABASE_URL || !SERVICE_KEY) {
  die('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env 가 필요합니다');
}

let createClient;
try {
  ({ createClient } = await import('@supabase/supabase-js'));
} catch {
  die('@supabase/supabase-js 미설치 — `npm install @supabase/supabase-js` 후 재실행');
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 배치 업서트 (chunk=50)
async function upsertBatch(table, rows, pk = 'id') {
  const CHUNK = 50;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error, count } = await sb.from(table).upsert(batch, {
      onConflict: pk, count: 'exact',
    });
    if (error) die(`${table} upsert failed: ${error.message}`);
    inserted += count ?? batch.length;
    log(`  ${table}: ${inserted}/${rows.length}`);
  }
  return inserted;
}

log('\n--commit: 삽입 시작');
const cInserted = await upsertBatch('conferences_upstream', confRows);
const eInserted = await upsertBatch('editions_upstream', cleanEdRows);

// 검증
const { count: cCount } = await sb.from('conferences_upstream').select('*', { count: 'exact', head: true });
const { count: eCount } = await sb.from('editions_upstream').select('*', { count: 'exact', head: true });

log(`\n완료: conferences=${cCount} (inserted ${cInserted}), editions=${eCount} (inserted ${eInserted})`);

if (cCount !== confRows.length || eCount !== cleanEdRows.length) {
  log(`⚠️  DB count 가 소스 count 와 불일치 — 기존 데이터 포함일 수 있음`);
}
