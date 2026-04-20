#!/usr/bin/env node
// 프롬프트 평가 러너 (Node). 필드별 가중 채점 (link/start/end/venue).
// 사용법:
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/eval-prompt.js
//   node scripts/eval-prompt.js --case conf_007
//   node scripts/eval-prompt.js --version v7 --weights link=0.5,start=0.3,end=0.1,venue=0.1
// 입력: docs/eval/golden-set.xlsx (PR-2 에서 도입). PR-3 (PLAN-016) 에서 필드별 채점으로 개편.

import * as XLSX from 'xlsx';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { callClaude, extractText } from '../src/services/claudeApi.js';
import { buildUpdatePrompt } from '../src/utils/promptBuilder.js';
import { parseUpdateResponse } from '../src/services/responseParser.js';
import { normalizeUrl } from '../src/services/urlMatch.js';
import { MODELS } from '../src/config/models.js';
import { parseWorkbook } from '../src/services/goldenSheet.js';
import { scoreCase, parseWeights, SCHEMA_VERSION } from './eval-common.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { version: 'v1', case: null, retryWaitMs: 30000, weights: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version') args.version = argv[++i];
    else if (a === '--case') args.case = argv[++i];
    else if (a === '--retry-wait') args.retryWaitMs = Number(argv[++i]) * 1000;
    else if (a === '--weights') args.weights = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/eval-prompt.js [--version v7] [--case conf_XXX] [--weights link=0.6,start=0.2,end=0.1,venue=0.1] [--retry-wait 30] [--out path.json]');
      process.exit(0);
    }
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findLastPastEdition(editions, confId) {
  const past = editions
    .filter((e) => e.conference_id === confId && e.status === 'past' && e.start_date)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  return past[0] || null;
}

async function runOne({ conference, lastEdition, apiKey, version, retryWaitMs }) {
  const { system, user } = buildUpdatePrompt(conference, lastEdition, { version });
  const t0 = Date.now();
  const attempt = async () => callClaude({
    apiKey, prompt: user, system, model: MODELS.update, webSearch: true, maxTokens: 1024,
  });
  try {
    let res;
    try {
      res = await attempt();
    } catch (err) {
      if (err?.kind === 'rate_limit') {
        const waitMs = err.retryAfterMs || retryWaitMs;
        console.log(`\n  ⏳ rate limit — ${Math.round(waitMs / 1000)}s 대기 후 재시도...`);
        await sleep(waitMs);
        res = await attempt();
      } else {
        throw err;
      }
    }
    const elapsed = Date.now() - t0;
    const text = extractText(res);
    const parsed = parseUpdateResponse(text);
    return {
      ok: true,
      elapsedMs: elapsed,
      rawText: text,
      parsed,
      stop_reason: res.stop_reason,
      usage: res.usage || null,
    };
  } catch (err) {
    return {
      ok: false,
      elapsedMs: Date.now() - t0,
      error: { kind: err?.kind || 'unknown', message: err?.message || String(err) },
    };
  }
}

async function loadGolden() {
  const xlsxPath = join(ROOT, 'docs/eval/golden-set.xlsx');
  if (!existsSync(xlsxPath)) {
    console.error(`❌ ${xlsxPath} 없음. 먼저 npm run golden:export / migrate-csv-to-xlsx 실행.`);
    process.exit(1);
  }
  const buf = await readFile(xlsxPath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const { rows, meta } = parseWorkbook(wb);
  return { cases: rows, meta };
}

async function main() {
  const args = parseArgs(process.argv);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY 환경변수가 없습니다.');
    console.error('   PowerShell:  $env:ANTHROPIC_API_KEY="sk-ant-..."; npm run eval');
    console.error('   bash:        ANTHROPIC_API_KEY=sk-ant-... npm run eval');
    process.exit(1);
  }

  const weights = parseWeights(args.weights);

  const confPath = join(ROOT, 'public/data/conferences.json');
  const { conferences, editions } = JSON.parse(await readFile(confPath, 'utf8'));
  const { cases: allCases, meta: goldenMeta } = await loadGolden();

  let cases = allCases;
  if (args.case) cases = cases.filter((c) => c.id === args.case);
  if (cases.length === 0) {
    console.error('❌ 실행할 케이스가 없습니다. docs/eval/golden-set.xlsx 를 확인하세요.');
    process.exit(1);
  }

  console.log(`\n📋 Prompt Eval — version=${args.version}, cases=${cases.length}, snapshot=${goldenMeta.snapshot_date}`);
  console.log(`   weights: link=${weights.link} start=${weights.start} end=${weights.end} venue=${weights.venue}\n`);

  const results = [];
  for (const c of cases) {
    const conference = conferences.find((cf) => cf.id === c.id);
    if (!conference) {
      console.warn(`⚠️  ${c.id}: conferences.json에 없음. 스킵.`);
      continue;
    }
    const lastEdition = findLastPastEdition(editions, c.id);
    const label = conference.abbreviation || conference.full_name.slice(0, 30);
    process.stdout.write(`  ▶ ${c.id} (${label}, cycle=${conference.cycle_years}y) ... `);
    const r = await runOne({ conference, lastEdition, apiKey, version: args.version, retryWaitMs: args.retryWaitMs });

    let summary;
    if (!r.ok) {
      summary = { id: c.id, status: 'api_error', error: r.error, cycle_years: conference.cycle_years };
      console.log(`❌ API ${r.error.kind}: ${r.error.message}`);
    } else if (!r.parsed.ok) {
      summary = {
        id: c.id,
        status: 'parse_fail',
        reason: r.parsed.reason,
        cycle_years: conference.cycle_years,
        elapsedMs: r.elapsedMs,
        usage: r.usage,
        stop_reason: r.stop_reason,
      };
      console.log(`❌ parse:${r.parsed.reason} (${r.elapsedMs}ms)`);
    } else {
      const scored = scoreCase(c, r.parsed.data, weights);
      summary = {
        id: c.id,
        status: scored.status,
        score: Number(scored.score.toFixed(3)),
        fields: scored.fields,
        cycle_years: conference.cycle_years,
        aiData: r.parsed.data,
        elapsedMs: r.elapsedMs,
        usage: r.usage,
        stop_reason: r.stop_reason,
      };
      const icon = { pass: '✅', partial: '⚠️ ', fail: '❌', no_expected: '·' }[scored.status] || '?';
      const fieldStr = Object.entries(scored.fields)
        .map(([k, v]) => `${k}:${v.status === 'pass' ? '✓' : '✗'}`)
        .join(' ');
      const usageStr = r.usage ? ` [in=${r.usage.input_tokens} out=${r.usage.output_tokens}]` : '';
      console.log(`${icon} score=${summary.score} ${fieldStr} (${r.elapsedMs}ms)${usageStr}`);
    }
    results.push({ ...summary, rawText: r.rawText, version: args.version });
  }

  // 요약 + cycle_years 버킷별 pass rate
  console.log('\n=== 요약 ===');
  const passed = results.filter((r) => r.status === 'pass').length;
  const partialCnt = results.filter((r) => r.status === 'partial').length;
  const failed = results.length - passed - partialCnt;
  console.log(`pass: ${passed}  partial: ${partialCnt}  fail/error: ${failed}  (총 ${results.length})`);

  const byCycle = {};
  for (const r of results) {
    const k = r.cycle_years ?? 'unknown';
    if (!byCycle[k]) byCycle[k] = { total: 0, pass: 0 };
    byCycle[k].total++;
    if (r.status === 'pass') byCycle[k].pass++;
  }
  const cycleSummary = Object.entries(byCycle)
    .map(([k, v]) => `${k}y: ${v.pass}/${v.total}`)
    .join('  ');
  if (cycleSummary) console.log(`cycle_years 버킷: ${cycleSummary}`);

  const withUsage = results.filter((r) => r.usage);
  const totalIn = withUsage.reduce((s, r) => s + (r.usage.input_tokens || 0), 0);
  const totalOut = withUsage.reduce((s, r) => s + (r.usage.output_tokens || 0), 0);
  const stopMaxTokens = withUsage.filter((r) => r.stop_reason === 'max_tokens').length;
  const tokenSummary = withUsage.length > 0
    ? {
        samples: withUsage.length,
        total_input: totalIn,
        total_output: totalOut,
        avg_input: Math.round(totalIn / withUsage.length),
        avg_output: Math.round(totalOut / withUsage.length),
        stop_reason_max_tokens: stopMaxTokens,
      }
    : null;
  if (tokenSummary) {
    console.log(
      `tokens: total in=${tokenSummary.total_input} out=${tokenSummary.total_output} · ` +
      `avg in=${tokenSummary.avg_input} out=${tokenSummary.avg_output} · ` +
      `stop_reason=max_tokens ${stopMaxTokens}/${withUsage.length}`,
    );
  }

  console.table(results.map((r) => ({
    id: r.id,
    cyc: r.cycle_years ?? '',
    status: r.status,
    score: r.score ?? '',
    link: r.fields?.link?.status === 'pass' ? '✓' : (r.fields?.link ? '✗' : ''),
    start: r.fields?.start?.status === 'pass' ? '✓' : (r.fields?.start ? '✗' : ''),
    end: r.fields?.end?.status === 'pass' ? '✓' : (r.fields?.end ? '✗' : ''),
    venue: r.fields?.venue?.status === 'pass' ? '✓' : (r.fields?.venue ? '✗' : ''),
    ai_link: r.fields?.link?.aiLink ? normalizeUrl(r.fields.link.aiLink) : '',
    err: r.reason || r.error?.kind || '',
    ms: r.elapsedMs || '',
  })));

  let outPath;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  if (args.out) {
    outPath = resolve(args.out);
    const outDir = dirname(outPath);
    if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });
  } else {
    const resultsDir = join(ROOT, 'docs/eval/results');
    if (!existsSync(resultsDir)) await mkdir(resultsDir, { recursive: true });
    outPath = join(resultsDir, `${timestamp}-${args.version}.json`);
  }
  await writeFile(outPath, JSON.stringify({
    meta: {
      schema_version: SCHEMA_VERSION,
      timestamp,
      version: args.version,
      snapshot_date: goldenMeta.snapshot_date,
      active_version: goldenMeta.active_version,
      case_count: results.length,
      weights,
    },
    summary: {
      pass: passed,
      partial: partialCnt,
      fail_or_error: failed,
      by_cycle_years: byCycle,
      tokens: tokenSummary,
    },
    results,
  }, null, 2));
  console.log(`\n📝 저장: ${outPath.replace(ROOT + '\\', '').replace(ROOT + '/', '')}\n`);
}

main().catch((e) => {
  console.error('💥 실행 실패:', e);
  process.exit(1);
});
