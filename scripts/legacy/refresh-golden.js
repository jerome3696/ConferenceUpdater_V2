#!/usr/bin/env node
// golden-set.csv 를 현재 conferences.json 기준으로 재생성.
// - 새 학회 id 추가
// - DB에서 사라진 id 제거
// - 기존 link 보존 (회차 전용 URL은 안 바뀜)
// - verified_at 6개월 경과 OR DB에서 해당 학회의 upcoming이 past로 넘어갔으면 source_url 비우고 notes에 [재확인 필요] 추가

import { readFile, writeFile, access } from 'node:fs/promises';
import { constants as fsc } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// PR-2 (PLAN-015) 이후 scripts/legacy/ 로 이동. ROOT 는 두 단계 상위.
const ROOT = resolve(__dirname, '../..');
const CSV_PATH = join(ROOT, 'docs/eval/legacy/golden-set.csv');
const CONF_PATH = join(ROOT, 'public/data/conferences.json');

const STALE_MONTHS = 6;
const BOM = '\uFEFF';
const HEADER = 'id,link,source_url,verified_at,notes';

function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') { /* skip */ }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function exists(p) {
  try { await access(p, fsc.F_OK); return true; } catch { return false; }
}

function monthsBetween(isoA, isoB) {
  const a = new Date(isoA), b = new Date(isoB);
  return (b - a) / (1000 * 60 * 60 * 24 * 30.44);
}

function conferenceIsStale(conf, editions, today) {
  // 해당 학회에 upcoming edition이 아예 없거나, 모든 upcoming이 지났으면 stale
  const ups = editions.filter((e) => e.conference_id === conf.id && e.status === 'upcoming');
  if (ups.length === 0) return true;
  const hasFuture = ups.some((e) => e.start_date && e.start_date >= today);
  return !hasFuture;
}

async function main() {
  const confRaw = JSON.parse(await readFile(CONF_PATH, 'utf8'));
  const conferences = confRaw.conferences || [];
  const editions = confRaw.editions || [];
  const today = new Date().toISOString().slice(0, 10);

  // 기존 CSV 읽기 (있으면 값 보존)
  const existing = new Map(); // id → {link, source_url, verified_at, notes, prefix/suffix comment lines}
  const topComments = [];     // 헤더 이후 첫 # 주석들 — 가이드 블록. 유지.

  if (await exists(CSV_PATH)) {
    let text = await readFile(CSV_PATH, 'utf8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    // 주석 블록을 그대로 유지하기 위해 라인 단위로 재읽음
    const lines = text.split(/\r?\n/);
    // 헤더 이후 연속된 # 라인들을 topComments로 수집
    let startedData = false;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!startedData && (line.trim() === '' || line.trim().startsWith('#'))) {
        topComments.push(line);
      } else {
        startedData = true;
      }
    }

    const rows = parseCsv(text).filter((r) => r.length && !(r.length === 1 && r[0].trim() === ''));
    if (rows.length > 0) {
      const header = rows[0].map((h) => h.trim());
      const idx = Object.fromEntries(header.map((h, i) => [h, i]));
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const id = (r[idx.id] || '').trim();
        if (!id || id.startsWith('#')) continue;
        existing.set(id, {
          link: (r[idx.link] || '').trim(),
          source_url: (r[idx.source_url] || '').trim(),
          verified_at: (r[idx.verified_at] || '').trim(),
          notes: (r[idx.notes] || '').trim(),
        });
      }
    }
  }

  // 새 CSV의 데이터 행 생성
  const dataLines = [];
  const report = { preserved: 0, staleCleared: 0, added: 0, removed: 0 };

  for (const conf of conferences) {
    const prev = existing.get(conf.id);
    let link = '', source_url = '', verified_at = '', notes = `${conf.abbreviation || conf.full_name.slice(0, 40)}`;

    if (prev) {
      link = prev.link;
      notes = prev.notes || notes;

      // staleness 판단
      const staleByTime = prev.verified_at && monthsBetween(prev.verified_at, today) > STALE_MONTHS;
      const staleByDb = conferenceIsStale(conf, editions, today);
      const stale = staleByTime || staleByDb;

      if (stale && prev.source_url) {
        source_url = '';
        verified_at = '';
        const reason = staleByDb ? 'upcoming 없음/지남' : `${STALE_MONTHS}개월 경과`;
        notes = `[재확인 필요 · ${reason}] ${notes}`.trim();
        report.staleCleared++;
      } else {
        source_url = prev.source_url;
        verified_at = prev.verified_at;
        report.preserved++;
      }
    } else {
      report.added++;
    }

    dataLines.push([conf.id, link, source_url, verified_at, notes].map(csvEscape).join(','));
  }

  // DB에서 사라진 id들 집계 (경고용)
  for (const id of existing.keys()) {
    if (!conferences.find((c) => c.id === id)) {
      report.removed++;
      console.warn(`⚠️  ${id}: conferences.json에 없어서 CSV에서 제거됨`);
    }
  }

  // 기본 가이드 주석 (기존 주석 블록이 없으면 이걸 씀)
  const DEFAULT_GUIDE = [
    '# === 편집 가이드 ===',
    '#',
    '# [필드]',
    '# - link: AI가 맞춰야 할 정답. 그 회차의 가장 구체적인 공식 페이지.',
    '#         * 회차 전용 사이트 있으면 그것 (예: https://www.icr2027.org/)',
    '#         * 없으면 커미티/주관 사이트 (예: https://astfe.org/conferences/)',
    '# - source_url: 내가 실제로 값을 읽은 바로 그 페이지. 메인 페이지 X.',
    '#         * 보통 link와 같음',
    '#         * 회차 전용 사이트 없고 주관 캘린더에서 확인한 경우: 그 캘린더의 events 페이지',
    '#           예) https://iifiir.org/en/events  (메인 iifiir.org/ X)',
    '# - verified_at: YYYY-MM-DD. 내가 source_url을 확인한 날짜. 6개월 넘으면 refresh 시 자동 재확인 대상.',
    '# - notes: 자유 메모. [재확인 필요] 태그는 refresh가 자동으로 답.',
    '#',
    '# [운영]',
    '# - link와 source_url 중 하나라도 비어 있지 않으면 평가에 사용됨. 둘 다 비어 있으면 자동 스킵.',
    '# - 5~7건만 채우면 충분.',
    '# - npm run eval:refresh 를 실행하면:',
    '#     * conferences.json 기준으로 id 목록 갱신',
    '#     * link 값은 보존 (회차 전용 URL은 안 바뀌므로)',
    '#     * verified_at 6개월 경과 또는 DB에서 upcoming이 past로 넘어간 건 source_url 자동 비움 + [재확인 필요] 표시',
    '#',
    '# [예시 — 삭제 가능]',
    '# conf_XXX,https://www.icr2027.org/,https://iifiir.org/en/events,2026-04-15,IIR 캘린더에서 확인',
    '#',
  ];

  const commentBlock = topComments.length > 0 ? topComments.join('\n') : DEFAULT_GUIDE.join('\n');
  const final = BOM + HEADER + '\n' + commentBlock + '\n' + dataLines.join('\n') + '\n';
  await writeFile(CSV_PATH, final, 'utf8');

  console.log(`\n✅ golden-set.csv 재생성 완료`);
  console.log(`   총 학회: ${conferences.length}`);
  console.log(`   유지된 값: ${report.preserved}  /  stale 처리: ${report.staleCleared}  /  신규 추가: ${report.added}  /  DB 이탈로 제거: ${report.removed}`);
  if (report.staleCleared > 0) {
    console.log(`   → [재확인 필요] 표시된 행의 source_url을 다시 채워주세요.`);
  }
}

main().catch((e) => {
  console.error('💥 refresh 실패:', e);
  process.exit(1);
});
