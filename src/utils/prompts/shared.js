// 공용 helper — 5개 도메인 모듈이 공유하는 유틸 및 상수.
// PLAN-021 (2026-04-21): promptBuilder.js 도메인 분리 시 추출.

import { BANNED_LINK_DOMAINS } from '../../services/responseParser.js';

export const BANNED_LIST_INLINE = BANNED_LINK_DOMAINS.join(', ');

// last.link 까지 노출해 AI 가 회차/연도 패턴을 추정할 수 있도록.
export function formatLastEdition(lastEdition) {
  if (!lastEdition) return '정보 없음';
  const { start_date, end_date, venue, link } = lastEdition;
  const parts = [];
  if (start_date) parts.push(`${start_date}${end_date ? ` ~ ${end_date}` : ''}`);
  if (venue) parts.push(venue);
  if (link) parts.push(`link=${link}`);
  return parts.length ? parts.join(' / ') : '정보 없음';
}

export function formatExistingForPrompt(existingIndex) {
  if (!Array.isArray(existingIndex) || existingIndex.length === 0) return '없음 (전부 신규로 간주)';
  return existingIndex
    .map((c) => {
      const abbr = c.abbreviation ? `${c.abbreviation} — ` : '';
      const url = c.official_url ? ` | ${c.official_url}` : '';
      return `- ${abbr}${c.full_name || ''}${url}`;
    })
    .join('\n');
}

// 키워드를 {ko, en} 페어 형태로 정규화. 문자열이면 ko=en 폴백.
export function normalizeKeywordPair(k) {
  if (k && typeof k === 'object' && !Array.isArray(k)) {
    const ko = typeof k.ko === 'string' ? k.ko.trim() : '';
    const en = typeof k.en === 'string' ? k.en.trim() : '';
    if (ko || en) return { ko: ko || en, en: en || ko };
    return null;
  }
  if (typeof k === 'string') {
    const t = k.trim();
    if (t) return { ko: t, en: t };
  }
  return null;
}
