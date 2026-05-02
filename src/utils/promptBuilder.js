// 프롬프트 빌더 — 버전 기반 템플릿 (얇은 shell)
// PLAN-021 (2026-04-21): 도메인별 5개 모듈로 분리. 공개 API·import 경로 불변.
// 새 버전 추가 시 해당 도메인 모듈에 system+builder 를 추가하고 아래 TEMPLATES 에 키 하나 등록.

import {
  UPDATE_SYSTEM_V1_0, buildUpdateUserV1_0,
  UPDATE_SYSTEM_V1_1, buildUpdateUserV1_1,
  UPDATE_SYSTEM_V1_2, buildUpdateUserV1_2,
} from './prompts/update.js';
import { VERIFY_SYSTEM_V1, buildVerifyUserV1 } from './prompts/verify.js';
import { LAST_EDITION_SYSTEM_V1, buildLastEditionUserV1 } from './prompts/lastEdition.js';
import {
  DISCOVERY_EXPAND_SYSTEM_V1,
  buildDiscoveryExpandUserV1,
  DISCOVERY_SEARCH_SYSTEM_V1,
  buildDiscoverySearchUserV1,
} from './prompts/discovery.js';

const TEMPLATES = {
  update: {
    v1_0: { system: UPDATE_SYSTEM_V1_0, user: buildUpdateUserV1_0 },
    v1_1: { system: UPDATE_SYSTEM_V1_1, user: buildUpdateUserV1_1 },
    v1_2: { system: UPDATE_SYSTEM_V1_2, user: buildUpdateUserV1_2 },
  },
  verify: {
    v1: { system: VERIFY_SYSTEM_V1, user: buildVerifyUserV1 },
  },
  discovery_expand: {
    v1: { system: DISCOVERY_EXPAND_SYSTEM_V1, user: buildDiscoveryExpandUserV1 },
  },
  discovery_search: {
    v1: { system: DISCOVERY_SEARCH_SYSTEM_V1, user: buildDiscoverySearchUserV1 },
  },
  last_edition: {
    v1: { system: LAST_EDITION_SYSTEM_V1, user: buildLastEditionUserV1 },
  },
};

export const DEFAULT_UPDATE_VERSION = 'v1_2';
export const DEFAULT_VERIFY_VERSION = 'v1';
export const DEFAULT_DISCOVERY_EXPAND_VERSION = 'v1';
export const DEFAULT_DISCOVERY_SEARCH_VERSION = 'v1';
export const DEFAULT_LAST_EDITION_VERSION = 'v1';

/**
 * 업데이트(다음 개최 찾기)용 프롬프트.
 * @param {object} conference   conferences.json의 학회 1건
 * @param {object|null} lastEdition  가장 최근 past edition (없으면 null)
 * @param {object} [opts]
 * @param {string} [opts.version='v1_1']
 * @returns {{ system: string, user: string, version: string }}
 */
export function buildUpdatePrompt(conference, lastEdition = null, { version = DEFAULT_UPDATE_VERSION } = {}) {
  const tpl = TEMPLATES.update[version];
  if (!tpl) throw new Error(`Unknown update prompt version: ${version}`);
  return { system: tpl.system, user: tpl.user(conference, lastEdition), version };
}

/**
 * 정합성 검증용 프롬프트.
 */
export function buildVerifyPrompt(conference, { version = DEFAULT_VERIFY_VERSION } = {}) {
  const tpl = TEMPLATES.verify[version];
  if (!tpl) throw new Error(`Unknown verify prompt version: ${version}`);
  return { system: tpl.system, user: tpl.user(conference), version };
}

/**
 * 신규 학회 발굴 Stage 1: 시드 키워드 → 연관 키워드 10개.
 */
export function buildDiscoveryExpandPrompt(seedKeywords, { version = DEFAULT_DISCOVERY_EXPAND_VERSION } = {}) {
  const tpl = TEMPLATES.discovery_expand[version];
  if (!tpl) throw new Error(`Unknown discovery_expand prompt version: ${version}`);
  return { system: tpl.system, user: tpl.user(seedKeywords), version };
}

/**
 * 신규 학회 발굴 Stage 2: 선택 키워드(OR) + 기존 학회 배제 → 후보 학회 배열.
 */
export function buildDiscoverySearchPrompt(selectedKeywords, existingIndex = [], { version = DEFAULT_DISCOVERY_SEARCH_VERSION } = {}) {
  const tpl = TEMPLATES.discovery_search[version];
  if (!tpl) throw new Error(`Unknown discovery_search prompt version: ${version}`);
  return { system: tpl.system, user: tpl.user(selectedKeywords, existingIndex), version };
}

/**
 * 과거 회차(last edition) 발굴용 프롬프트 (PLAN-013-D).
 * row.last 가 없을 때 update 직전에 선행 호출.
 */
export function buildLastEditionPrompt(conference, { version = DEFAULT_LAST_EDITION_VERSION } = {}) {
  const tpl = TEMPLATES.last_edition[version];
  if (!tpl) throw new Error(`Unknown last_edition prompt version: ${version}`);
  return { system: tpl.system, user: tpl.user(conference), version };
}

export const __TEMPLATES_FOR_TEST = TEMPLATES;
