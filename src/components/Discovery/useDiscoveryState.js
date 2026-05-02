// DiscoveryPanel 상태·핸들러 커스텀 훅 4종.
// PLAN-023 (2026-04-21): DiscoveryPanel.jsx 상태 분해로 추출.
// 흐름: useDiscoveryUsage → useKeywordExpansion → useDiscoverySearch → useCandidateReview.

import { useMemo, useState } from 'react';
import { callClaude, extractText, ClaudeApiError } from '../../services/claudeApi';
import {
  buildDiscoveryExpandPrompt,
  buildDiscoverySearchPrompt,
} from '../../utils/promptBuilder';
import {
  parseDiscoveryExpandResponse,
  parseDiscoverySearchResponse,
} from '../../services/responseParser';
import { findExistingMatch } from '../../utils/nameMatch';
import { combinePredatoryScore } from '../../utils/predatoryScore';
import { MODELS } from '../../config/models';

// Haiku 4.5 사용 (update와 동일). 추후 discovery 전용 모델 키로 분리 가능.
const DISCOVERY_MODEL = MODELS.update;

// Haiku 4.5 가격: $1 / 1M input, $5 / 1M output. web_search: $10 / 1k searches.
const PRICING = {
  inputPer1M: 1,
  outputPer1M: 5,
  searchPer1k: 10,
};

function calcCost(usage) {
  const { input = 0, output = 0, searches = 0 } = usage;
  return (input / 1e6) * PRICING.inputPer1M
    + (output / 1e6) * PRICING.outputPer1M
    + (searches / 1000) * PRICING.searchPer1k;
}

function extractUsage(res) {
  const u = res?.usage || {};
  const input = Number(u.input_tokens) || 0;
  const output = Number(u.output_tokens) || 0;
  // server_tool_use.web_search_requests 가 명시 카운터.
  const searches = Number(u.server_tool_use?.web_search_requests) || 0;
  return { input, output, searches };
}

export function fmtUSD(n) {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

export function fmtKRW(n) {
  return `₩${Math.round(n * 1500).toLocaleString('ko-KR')}`;
}

function parseSeed(input) {
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 시드 문자열 → {ko, en} 페어. 폴백 en=ko.
function seedToPair(s) {
  return { ko: s, en: s };
}

function pairKey(p) {
  return `${(p.ko || '').trim().toLowerCase()}::${(p.en || '').trim().toLowerCase()}`;
}

function dedupPairs(arr) {
  const seen = new Set();
  const out = [];
  for (const p of arr) {
    if (!p?.ko || !p?.en) continue;
    const k = pairKey(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

const isSamePair = (a, b) => pairKey(a) === pairKey(b);

function formatErrorMessage(e) {
  return e instanceof ClaudeApiError ? e.message : `오류: ${e?.message || e}`;
}

// ──────────────────────────────────────────────────────────────────
// useDiscoveryUsage — Stage 1+2 누적 usage·비용 추적
// ──────────────────────────────────────────────────────────────────
export function useDiscoveryUsage() {
  const [usage, setUsage] = useState({ input: 0, output: 0, searches: 0, calls: 0 });
  const addUsage = (u) => {
    setUsage((prev) => ({
      input: prev.input + u.input,
      output: prev.output + u.output,
      searches: prev.searches + u.searches,
      calls: prev.calls + 1,
    }));
  };
  const totalCost = calcCost(usage);
  return { usage, addUsage, totalCost };
}

// ──────────────────────────────────────────────────────────────────
// useKeywordExpansion — Stage 1 (시드 입력 → AI 키워드 확장 → 선택)
// ──────────────────────────────────────────────────────────────────
export function useKeywordExpansion({ addUsage }) {
  const [seedInput, setSeedInput] = useState('');
  const [expanded, setExpanded] = useState([]);
  const [customKeywords, setCustomKeywords] = useState([]);
  const [selected, setSelected] = useState([]);
  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState(null);

  const handleExpand = async () => {
    setExpandError(null);
    const seeds = parseSeed(seedInput);
    if (seeds.length === 0) {
      setExpandError('시드 키워드를 1개 이상 입력해주세요.');
      return;
    }
    setExpanding(true);
    try {
      const { system, user } = buildDiscoveryExpandPrompt(seeds);
      const res = await callClaude({
        prompt: user,
        system,
        endpoint: 'discovery_expand',
        webSearch: false,
        maxTokens: 768,
        model: DISCOVERY_MODEL,
      });
      addUsage(extractUsage(res));
      const text = extractText(res);
      const parsed = parseDiscoveryExpandResponse(text);
      if (!parsed.ok) {
        setExpandError(`응답 파싱 실패 (${parsed.reason})`);
        return;
      }
      // 시드 페어 + AI 확장 페어 병합. 시드는 자동 선택, 확장은 미선택.
      const seedPairs = seeds.map(seedToPair);
      setExpanded(dedupPairs([...seedPairs, ...parsed.keywords]));
      setSelected((prev) => dedupPairs([...prev, ...seedPairs]));
    } catch (e) {
      setExpandError(formatErrorMessage(e));
    } finally {
      setExpanding(false);
    }
  };

  const handleToggle = (pair) => {
    setSelected((prev) =>
      prev.some((p) => isSamePair(p, pair))
        ? prev.filter((p) => !isSamePair(p, pair))
        : [...prev, pair]
    );
  };

  const handleAddCustom = (pair) => {
    setCustomKeywords((prev) => (prev.some((p) => isSamePair(p, pair)) ? prev : [...prev, pair]));
    setSelected((prev) => (prev.some((p) => isSamePair(p, pair)) ? prev : [...prev, pair]));
  };

  const handleRemoveCustom = (pair) => {
    setCustomKeywords((prev) => prev.filter((p) => !isSamePair(p, pair)));
    setSelected((prev) => prev.filter((p) => !isSamePair(p, pair)));
  };

  return {
    seedInput, setSeedInput,
    expanded, customKeywords, selected,
    expanding, expandError,
    handleExpand, handleToggle, handleAddCustom, handleRemoveCustom,
  };
}

// ──────────────────────────────────────────────────────────────────
// useDiscoverySearch — Stage 2 (선택 키워드 + 기존 학회 배제 → 후보 학회)
// ──────────────────────────────────────────────────────────────────
export function useDiscoverySearch({ selected, existingConferences, addUsage }) {
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [duplicateCount, setDuplicateCount] = useState(0);

  const handleSearch = async () => {
    setSearchError(null);
    setCandidates([]);
    setDuplicateCount(0);
    if (selected.length === 0) {
      setSearchError('키워드를 1개 이상 선택해주세요.');
      return;
    }
    setSearching(true);
    try {
      const { system, user } = buildDiscoverySearchPrompt(selected, existingConferences);
      const res = await callClaude({
        prompt: user,
        system,
        endpoint: 'discovery_search',
        webSearch: true,
        maxWebSearches: 10,
        maxTokens: 4096,
        model: DISCOVERY_MODEL,
      });
      addUsage(extractUsage(res));
      const text = extractText(res);
      const parsed = parseDiscoverySearchResponse(text);
      if (!parsed.ok) {
        setSearchError(`응답 파싱 실패 (${parsed.reason})`);
        return;
      }
      // 011-D: nameMatch 로 기존 학회 중복 제거 (AI 가 놓친 케이스 안전망)
      const filtered = [];
      let dup = 0;
      for (const c of parsed.candidates) {
        if (findExistingMatch(c, existingConferences)) {
          dup++;
          continue;
        }
        // 011-D: 휴리스틱 점수와 합쳐 보강
        const combined = combinePredatoryScore(c);
        filtered.push({
          ...c,
          predatory_score: combined.predatory_score,
          predatory_reasons: combined.predatory_reasons,
          heuristic_score: combined.heuristic_score,
        });
      }
      setDuplicateCount(dup);
      setCandidates(filtered);
    } catch (e) {
      setSearchError(formatErrorMessage(e));
    } finally {
      setSearching(false);
    }
  };

  return { searching, searchError, candidates, duplicateCount, handleSearch };
}

// ──────────────────────────────────────────────────────────────────
// useCandidateReview — Stage 3 (후보 accept/reject 토글)
// ──────────────────────────────────────────────────────────────────
export function useCandidateReview({ candidates, onAccept }) {
  const [acceptedIds, setAcceptedIds] = useState(new Set());
  const [rejectedIds, setRejectedIds] = useState(new Set());

  const visibleCandidates = useMemo(
    () => candidates.filter((_, i) => !rejectedIds.has(i) && !acceptedIds.has(i)),
    [candidates, rejectedIds, acceptedIds]
  );

  const handleAccept = (idx) => {
    const c = candidates[idx];
    if (!c) return;
    if (typeof onAccept !== 'function') {
      // 안전망 — 정상 라우팅에서는 도달 불가.
      console.warn('[DiscoveryPanel] onAccept prop 미연결');
      return;
    }
    const newId = onAccept(c);
    if (!newId) {
      alert('학회 추가에 실패했습니다 (full_name 누락 또는 데이터 이상).');
      return;
    }
    setAcceptedIds((prev) => new Set(prev).add(idx));
  };

  const handleReject = (idx) => {
    setRejectedIds((prev) => new Set(prev).add(idx));
  };

  const reset = () => {
    setAcceptedIds(new Set());
    setRejectedIds(new Set());
  };

  return {
    acceptedIds, rejectedIds, visibleCandidates,
    acceptedCount: acceptedIds.size,
    handleAccept, handleReject, reset,
  };
}
