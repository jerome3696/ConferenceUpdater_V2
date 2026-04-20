// Eval 공용 유틸: scoring · weights parser · results reader.
// eval-prompt.js 와 (후속 PR-4) eval-loop.js 모두 import.
// 필드별 채점 → 가중 평균 → pass/partial/fail 매핑.

import { readFile } from 'node:fs/promises';
import { urlMatch } from '../src/services/urlMatch.js';

export const DEFAULT_WEIGHTS = { link: 0.6, start: 0.2, end: 0.1, venue: 0.1 };
export const SCHEMA_VERSION = 2;

// "link=0.5,start=0.3,end=0.1,venue=0.1" → {link:0.5,...}. 누락 필드는 기본값.
// 합이 1 에 안 맞아도 그대로 — scoreCase 에서 정규화함.
export function parseWeights(arg) {
  if (!arg) return { ...DEFAULT_WEIGHTS };
  const out = { ...DEFAULT_WEIGHTS };
  for (const part of arg.split(',')) {
    const [k, v] = part.split('=').map((s) => s?.trim());
    if (!k || v == null) continue;
    const num = Number(v);
    if (!Number.isFinite(num) || num < 0) {
      throw new Error(`invalid weight: ${part}`);
    }
    if (!(k in DEFAULT_WEIGHTS)) throw new Error(`unknown weight field: ${k}`);
    out[k] = num;
  }
  return out;
}

// venue 비교: 쉼표 앞 첫 토큰 case-insensitive. "Chicago, USA" vs "Chicago" / "chicago, il, usa" 모두 pass.
function venueMatch(expected, got) {
  if (!expected || !got) return false;
  const first = (s) => String(s).split(',')[0].trim().toLowerCase();
  return first(expected) === first(got);
}

function dateMatch(expected, got) {
  if (!expected || !got) return false;
  return String(expected).trim() === String(got).trim();
}

// link 매칭: AI 응답의 link(없으면 source_url) 를 golden 의 upcoming_link + source_url 후보에 urlMatch.
function linkMatch(goldenCase, aiData) {
  const ai = aiData?.link || aiData?.source_url;
  if (!ai) return { ok: false, aiLink: null, matchedAgainst: null };
  const candidates = [goldenCase.upcoming_link, goldenCase.source_url, goldenCase.link].filter(Boolean);
  for (const c of candidates) {
    if (urlMatch(ai, c)) return { ok: true, aiLink: ai, matchedAgainst: c };
  }
  return { ok: false, aiLink: ai, matchedAgainst: null };
}

// 골든의 기대값이 있는 필드만 채점. 가중치는 available 필드에 정규화 재분배.
// goldenCase: XLSX 행 (upcoming_*, source_url, ...).
// aiData: parseUpdateResponse().data (start_date, end_date, venue, link, ...).
export function scoreCase(goldenCase, aiData, weights = DEFAULT_WEIGHTS) {
  const fields = {};

  // link — upcoming_link/source_url 중 하나라도 있으면 채점 대상.
  const hasLinkExpected = !!(goldenCase.upcoming_link || goldenCase.source_url || goldenCase.link);
  if (hasLinkExpected) {
    const m = linkMatch(goldenCase, aiData);
    fields.link = { status: m.ok ? 'pass' : 'fail', aiLink: m.aiLink, matchedAgainst: m.matchedAgainst };
  }

  if (goldenCase.upcoming_start) {
    fields.start = {
      status: dateMatch(goldenCase.upcoming_start, aiData?.start_date) ? 'pass' : 'fail',
      expected: goldenCase.upcoming_start,
      got: aiData?.start_date || null,
    };
  }
  if (goldenCase.upcoming_end) {
    fields.end = {
      status: dateMatch(goldenCase.upcoming_end, aiData?.end_date) ? 'pass' : 'fail',
      expected: goldenCase.upcoming_end,
      got: aiData?.end_date || null,
    };
  }
  if (goldenCase.upcoming_venue) {
    fields.venue = {
      status: venueMatch(goldenCase.upcoming_venue, aiData?.venue) ? 'pass' : 'fail',
      expected: goldenCase.upcoming_venue,
      got: aiData?.venue || null,
    };
  }

  const availableKeys = Object.keys(fields);
  const totalWeight = availableKeys.reduce((s, k) => s + (weights[k] ?? 0), 0);
  const score = totalWeight > 0
    ? availableKeys.reduce((s, k) => s + (fields[k].status === 'pass' ? (weights[k] ?? 0) : 0), 0) / totalWeight
    : 0;

  let status;
  if (availableKeys.length === 0) status = 'no_expected';
  else if (score >= 0.9) status = 'pass';
  else if (score >= 0.5) status = 'partial';
  else status = 'fail';

  return { fields, score, status, weights_used: weights };
}

// results 파일 reader. v1 = 이전 link-only 결과 (schema_version 없음). v2 = 필드별.
export async function readResults(path) {
  const raw = JSON.parse(await readFile(path, 'utf8'));
  const version = raw.meta?.schema_version ?? 1;
  return { version, data: raw };
}
