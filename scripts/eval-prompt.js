#!/usr/bin/env node
// 프롬프트 평가 러너 (Node). URL 매칭 기반 pass/fail.
// 사용법:
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/eval-prompt.js
//   node scripts/eval-prompt.js --case conf_007
//   node scripts/eval-prompt.js --version v1

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { callClaude, extractText } from '../src/services/claudeApi.js';
import { buildUpdatePrompt } from '../src/utils/promptBuilder.js';
import { parseUpdateResponse } from '../src/services/responseParser.js';
import { urlMatch, normalizeUrl } from '../src/services/urlMatch.js';
import { MODELS } from '../src/config/models.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { version: 'v1', case: null, retryWaitMs: 30000 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version') args.version = argv[++i];
    else if (a === '--case') args.case = argv[++i];
    else if (a === '--retry-wait') args.retryWaitMs = Number(argv[++i]) * 1000;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/eval-prompt.js [--version v1] [--case conf_XXX] [--retry-wait 30]');
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

function scoreUrl(goldenCase, aiData) {
  const aiLink = aiData?.link || aiData?.source_url;
  if (!aiLink) return { status: 'fail', reason: 'ai_link_missing', aiLink: null };

  const candidates = [goldenCase.link, goldenCase.source_url].filter(Boolean);
  for (const c of candidates) {
    if (urlMatch(aiLink, c)) {
      // URL은 맞지만 start_date 미추출이면 partial — 콘텐츠 품질 드러내기
      if (!aiData?.start_date) {
        return { status: 'partial', reason: 'date_missing', matchedAgainst: c, aiLink };
      }
      return { status: 'pass', matchedAgainst: c, aiLink };
    }
  }
  return { status: 'fail', reason: 'url_mismatch', aiLink, expected: candidates };
}

async function runOne({ conference, lastEdition, apiKey, version, retryWaitMs }) {
  const { system, user } = buildUpdatePrompt(conference, lastEdition, { version });
  const t0 = Date.now();
  // 앱의 useUpdateQueue와 일치: model=MODELS.update(haiku-4-5), maxTokens=1024. RATE_LIMIT_STRATEGY §4.1 참조.
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

async function main() {
  const args = parseArgs(process.argv);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY 환경변수가 없습니다.');
    console.error('   PowerShell:  $env:ANTHROPIC_API_KEY="sk-ant-..."; npm run eval');
    console.error('   bash:        ANTHROPIC_API_KEY=sk-ant-... npm run eval');
    process.exit(1);
  }

  // CSV → JSON 자동 동기화. CSV/JSON/sync 스크립트는 PR-2 에서 legacy/ 로 이동.
  // PR-3 에서 eval-prompt.js 가 docs/eval/golden-set.parsed.json(XLSX import) 을 읽도록 재작성.
  const csvPath = join(ROOT, 'docs/eval/legacy/golden-set.csv');
  if (existsSync(csvPath)) {
    const sync = spawnSync(process.execPath, [join(ROOT, 'scripts/legacy/csv-to-golden.js')], { stdio: 'inherit' });
    if (sync.status !== 0) {
      console.error('❌ csv-to-golden.js 실패. CSV 확인 요망.');
      process.exit(1);
    }
  }

  const confPath = join(ROOT, 'public/data/conferences.json');
  const goldenPath = join(ROOT, 'docs/eval/legacy/golden-set.json');
  const { conferences, editions } = JSON.parse(await readFile(confPath, 'utf8'));
  const golden = JSON.parse(await readFile(goldenPath, 'utf8'));

  let cases = golden.cases || [];
  if (args.case) cases = cases.filter((c) => c.id === args.case);
  if (cases.length === 0) {
    console.error('❌ 실행할 케이스가 없습니다. docs/eval/legacy/golden-set.csv 를 확인하세요.');
    process.exit(1);
  }

  console.log(`\n📋 Prompt Eval — version=${args.version}, cases=${cases.length}, snapshot=${golden.snapshot_date}\n`);

  const results = [];
  for (const c of cases) {
    const conference = conferences.find((cf) => cf.id === c.id);
    if (!conference) {
      console.warn(`⚠️  ${c.id}: conferences.json에 없음. 스킵.`);
      continue;
    }
    const lastEdition = findLastPastEdition(editions, c.id);
    const label = conference.abbreviation || conference.full_name.slice(0, 30);
    process.stdout.write(`  ▶ ${c.id} (${label}) ... `);
    const r = await runOne({ conference, lastEdition, apiKey, version: args.version, retryWaitMs: args.retryWaitMs });

    let summary;
    if (!r.ok) {
      summary = { id: c.id, status: 'api_error', error: r.error };
      console.log(`❌ API ${r.error.kind}: ${r.error.message}`);
    } else if (!r.parsed.ok) {
      summary = {
        id: c.id,
        status: 'parse_fail',
        reason: r.parsed.reason,
        elapsedMs: r.elapsedMs,
        usage: r.usage,
        stop_reason: r.stop_reason,
      };
      console.log(`❌ parse:${r.parsed.reason} (${r.elapsedMs}ms)`);
    } else {
      const score = scoreUrl(c, r.parsed.data);
      summary = {
        id: c.id,
        status: score.status,
        reason: score.reason || null,
        aiLink: score.aiLink,
        matchedAgainst: score.matchedAgainst || null,
        expected: score.expected || null,
        aiData: r.parsed.data,
        elapsedMs: r.elapsedMs,
        usage: r.usage,
        stop_reason: r.stop_reason,
      };
      const icon = score.status === 'pass' ? '✅' : score.status === 'partial' ? '⚠️' : '❌';
      const tail = score.status === 'fail'
        ? `ai=${normalizeUrl(score.aiLink)}`
        : `matched ${normalizeUrl(score.matchedAgainst)}${score.status === 'partial' ? ' but date=null' : ''}`;
      const usageStr = r.usage ? ` [in=${r.usage.input_tokens} out=${r.usage.output_tokens}]` : '';
      console.log(`${icon} ${tail} (${r.elapsedMs}ms)${usageStr}`);
    }
    results.push({ ...summary, rawText: r.rawText, version: args.version });
  }

  console.log('\n=== 요약 ===');
  const passed = results.filter((r) => r.status === 'pass').length;
  const partialCnt = results.filter((r) => r.status === 'partial').length;
  const failed = results.length - passed - partialCnt;
  console.log(`pass: ${passed}  partial: ${partialCnt}  fail/error: ${failed}  (총 ${results.length})`);

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
      `stop_reason=max_tokens ${stopMaxTokens}/${withUsage.length}`
    );
  }

  console.table(results.map((r) => ({
    id: r.id,
    status: r.status,
    ai_link: r.aiLink ? normalizeUrl(r.aiLink) : '',
    matched: r.matchedAgainst ? normalizeUrl(r.matchedAgainst) : '',
    err: r.reason || r.error?.kind || '',
    ms: r.elapsedMs || '',
    in_tok: r.usage?.input_tokens || '',
    out_tok: r.usage?.output_tokens || '',
  })));

  const resultsDir = join(ROOT, 'docs/eval/results');
  if (!existsSync(resultsDir)) await mkdir(resultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = join(resultsDir, `${timestamp}-${args.version}.json`);
  await writeFile(outPath, JSON.stringify({
    meta: { timestamp, version: args.version, snapshot_date: golden.snapshot_date, case_count: results.length },
    summary: { pass: passed, partial: partialCnt, fail_or_error: failed, tokens: tokenSummary },
    results,
  }, null, 2));
  console.log(`\n📝 저장: ${outPath.replace(ROOT + '\\', '').replace(ROOT + '/', '')}\n`);
}

main().catch((e) => {
  console.error('💥 실행 실패:', e);
  process.exit(1);
});
