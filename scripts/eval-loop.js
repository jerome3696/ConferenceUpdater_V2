#!/usr/bin/env node
// eval-prompt.js 를 N 회 반복 호출하는 early-stop 래퍼.
// 한 loop 동안 프롬프트 고정 — 재시도는 노이즈 제거 목적 (튜닝 금지).
// 사용: npm run eval:loop -- --version v7 --max-iter 3 --threshold 0.9 [--case conf_XXX] [--weights ...]

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export function parseLoopArgs(argv) {
  const args = {
    version: 'v7',
    maxIter: 3,
    threshold: 0.9,
    case: null,
    weights: null,
    runId: null,
    minIter: 2,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version') args.version = argv[++i];
    else if (a === '--max-iter') args.maxIter = Number(argv[++i]);
    else if (a === '--threshold') args.threshold = Number(argv[++i]);
    else if (a === '--min-iter') args.minIter = Number(argv[++i]);
    else if (a === '--case') args.case = argv[++i];
    else if (a === '--weights') args.weights = argv[++i];
    else if (a === '--run-id') args.runId = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/eval-loop.js --version v7 [--max-iter 3] [--threshold 0.9] [--min-iter 2] [--case id] [--weights ...] [--run-id id]');
      process.exit(0);
    }
  }
  return args;
}

// 종료 조건 판정 — 순서대로 success · plateau · max_iter 체크.
// iter 는 1-based. previous 는 직전 iteration 요약 (없으면 null).
// current: { pass, partial, fail_or_error, total, fail_ids: Set|Array }
// success: pass/total >= threshold AND partial+fail_or_error <= 1
// plateau: previous 와 pass 수 동일 + fail_ids 집합 동일 (순서 무관)
// max_iter: iter === maxIter
export function decideStop({ previous, current, threshold, maxIter, iter, minIter }) {
  const ratio = current.total > 0 ? current.pass / current.total : 0;
  if (ratio >= threshold && current.partial + current.fail_or_error <= 1) {
    return 'success';
  }
  if (previous && iter >= minIter) {
    const prevIds = new Set(previous.fail_ids);
    const curIds = new Set(current.fail_ids);
    const sameCount = prevIds.size === curIds.size;
    const sameSet = sameCount && [...curIds].every((id) => prevIds.has(id));
    if (previous.pass === current.pass && sameSet) return 'plateau';
  }
  if (iter >= maxIter) return 'max_iter';
  return null;
}

// 모든 iteration 에서 한 번도 pass 하지 못한 id = 구조적 실패.
export function mergeFailIds(iterations) {
  if (iterations.length === 0) return [];
  const everPassed = new Set();
  for (const it of iterations) {
    for (const id of it.pass_ids || []) everPassed.add(id);
  }
  const union = new Set();
  for (const it of iterations) {
    for (const id of it.fail_ids || []) union.add(id);
  }
  return [...union].filter((id) => !everPassed.has(id)).sort();
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function summarizeIter(resultJson, iterNum, outPath) {
  const results = resultJson.results || [];
  const passCases = results.filter((r) => r.status === 'pass');
  const partialCases = results.filter((r) => r.status === 'partial');
  const failCases = results.filter((r) => !['pass', 'partial'].includes(r.status));
  return {
    iter: iterNum,
    total: results.length,
    pass: passCases.length,
    partial: partialCases.length,
    fail_or_error: failCases.length,
    pass_ids: passCases.map((r) => r.id),
    fail_ids: [...partialCases, ...failCases].map((r) => r.id),
    by_cycle_years: resultJson.summary?.by_cycle_years || {},
    results_path: outPath,
  };
}

async function runIteration({ iter, version, weights, caseId, outPath }) {
  const nodeArgs = [join(ROOT, 'scripts/eval-prompt.js'), '--version', version, '--out', outPath];
  if (weights) nodeArgs.push('--weights', weights);
  if (caseId) nodeArgs.push('--case', caseId);
  console.log(`\n=== iter ${iter} ===`);
  const res = spawnSync(process.execPath, nodeArgs, { stdio: 'inherit', env: process.env });
  if (res.status !== 0) {
    throw new Error(`iter ${iter} 실패 (exit ${res.status})`);
  }
  const json = JSON.parse(await readFile(outPath, 'utf8'));
  return summarizeIter(json, iter, outPath);
}

async function main() {
  const args = parseLoopArgs(process.argv);
  const runId = args.runId || stamp();
  const runDir = join(ROOT, 'docs/eval/runs', runId);
  if (!existsSync(runDir)) await mkdir(runDir, { recursive: true });

  console.log(`🔁 eval-loop — run_id=${runId}, version=${args.version}, max_iter=${args.maxIter}, threshold=${args.threshold}`);

  const iterations = [];
  let stoppedBy = null;
  for (let i = 1; i <= args.maxIter; i++) {
    const outPath = join(runDir, `iter-${i}.json`);
    const summary = await runIteration({
      iter: i,
      version: args.version,
      weights: args.weights,
      caseId: args.case,
      outPath,
    });
    iterations.push(summary);
    const previous = iterations.length >= 2 ? iterations[iterations.length - 2] : null;
    stoppedBy = decideStop({
      previous,
      current: summary,
      threshold: args.threshold,
      maxIter: args.maxIter,
      iter: i,
      minIter: args.minIter,
    });
    console.log(`\n  iter ${i}: pass=${summary.pass} partial=${summary.partial} fail=${summary.fail_or_error} (${summary.total})`);
    if (stoppedBy) {
      console.log(`  → stopped_by: ${stoppedBy}`);
      break;
    }
  }

  const persistentFailures = mergeFailIds(iterations);

  const byCycle = {};
  for (const it of iterations) {
    for (const [k, v] of Object.entries(it.by_cycle_years || {})) {
      if (!byCycle[k]) byCycle[k] = { total: 0, pass: 0 };
      byCycle[k].total += v.total || 0;
      byCycle[k].pass += v.pass || 0;
    }
  }

  const runJson = {
    run_id: runId,
    version: args.version,
    max_iter: args.maxIter,
    threshold: args.threshold,
    weights: args.weights || '(default)',
    stopped_by: stoppedBy || 'max_iter',
    iterations,
    persistent_failures: persistentFailures,
    by_cycle_years_total: byCycle,
  };
  const runPath = join(runDir, 'run.json');
  await writeFile(runPath, JSON.stringify(runJson, null, 2));

  console.log('\n=== 루프 요약 ===');
  console.log(`  iterations: ${iterations.length}`);
  console.log(`  stopped_by: ${runJson.stopped_by}`);
  console.log(`  persistent_failures (${persistentFailures.length}): ${persistentFailures.join(', ') || '(없음)'}`);
  console.log(`\n📝 저장: ${runPath.replace(ROOT + '\\', '').replace(ROOT + '/', '')}\n`);
}

// 테스트에서 import 시 main() 실행 방지.
const invokedDirect = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/eval-loop.js');
if (invokedDirect) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
