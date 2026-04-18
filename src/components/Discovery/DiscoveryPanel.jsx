// 발굴 패널 컨테이너. Stage 1 (키워드 확장) + Stage 2 (학회 검색) + Stage 3 (카드 검토).
// 011-C: 승인 시 onAccept 콜백 (App → useConferences.addConferenceFromDiscovery) 으로
//        master + upcoming edition 동시 생성. Stage 1·2 의 토큰/web_search usage 누적.
// 011-D: parseDiscoverySearchResponse 직후 nameMatch 로 기존 학회 중복 제거 + 휴리스틱
//        predatory 점수 보강 (AI 가 놓친 약탈 패턴 보완).

import { useMemo, useState } from 'react';
import KeywordExpansion from './KeywordExpansion';
import DiscoveryCard from './DiscoveryCard';
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

function fmtUSD(n) {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

function fmtKRW(n) {
  return `₩${Math.round(n * 1500).toLocaleString('ko-KR')}`;
}

function parseSeed(input) {
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 시드 문자열 → {ko, en} 페어. 폴백 en=ko.
// 한글 포함이면 ko 면을 채우고 en=ko (Stage 2 system 이 영문 위주 web_search 안내).
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

export default function DiscoveryPanel({ apiKey, existingConferences = [], onAccept, onClose }) {
  const [seedInput, setSeedInput] = useState('');
  const [expanded, setExpanded] = useState([]);     // AI 제안
  const [customKeywords, setCustomKeywords] = useState([]);
  const [selected, setSelected] = useState([]);

  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState(null);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [candidates, setCandidates] = useState([]); // Stage 2 결과
  const [acceptedIds, setAcceptedIds] = useState(new Set());
  const [rejectedIds, setRejectedIds] = useState(new Set());
  const [duplicateCount, setDuplicateCount] = useState(0); // 011-D: nameMatch 로 걸러진 기존 학회 수

  // Stage 1+2 누적 usage. 패널 단위 (모달 닫혀도 unmount → 리셋)
  const [usage, setUsage] = useState({ input: 0, output: 0, searches: 0, calls: 0 });
  const addUsage = (u) => {
    setUsage((prev) => ({
      input: prev.input + u.input,
      output: prev.output + u.output,
      searches: prev.searches + u.searches,
      calls: prev.calls + 1,
    }));
  };

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
        apiKey,
        prompt: user,
        system,
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
      const msg = e instanceof ClaudeApiError ? e.message : `오류: ${e?.message || e}`;
      setExpandError(msg);
    } finally {
      setExpanding(false);
    }
  };

  const isSamePair = (a, b) => pairKey(a) === pairKey(b);

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

  const handleSearch = async () => {
    setSearchError(null);
    setCandidates([]);
    setRejectedIds(new Set());
    setAcceptedIds(new Set());
    setDuplicateCount(0);
    if (selected.length === 0) {
      setSearchError('키워드를 1개 이상 선택해주세요.');
      return;
    }
    setSearching(true);
    try {
      const { system, user } = buildDiscoverySearchPrompt(selected, existingConferences);
      const res = await callClaude({
        apiKey,
        prompt: user,
        system,
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
      const msg = e instanceof ClaudeApiError ? e.message : `오류: ${e?.message || e}`;
      setSearchError(msg);
    } finally {
      setSearching(false);
    }
  };

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

  const totalCost = calcCost(usage);
  const acceptedCount = acceptedIds.size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">신규 학회 발굴</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            시드 키워드 → AI 확장 → 검색 → 후보 검토 (PLAN-011)
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
        >
          닫기
        </button>
      </div>

      {/* Stage 1 + selected + Search trigger */}
      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
        <KeywordExpansion
          seedInput={seedInput}
          onSeedInputChange={setSeedInput}
          onExpand={handleExpand}
          expanding={expanding}
          expandError={expandError}
          expanded={expanded}
          selected={selected}
          onToggle={handleToggle}
          onAddCustom={handleAddCustom}
          onRemoveCustom={handleRemoveCustom}
          customKeywords={customKeywords}
          onSearch={handleSearch}
          searching={searching}
        />
      </div>

      {/* Stage 2 search status */}
      {searchError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-sm text-rose-700">
          {searchError}
        </div>
      )}

      {searching && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 text-center">
          <div className="inline-block animate-spin mr-2">⟳</div>
          web_search 최대 10회 실행 중... 보통 30~60초 소요됩니다.
        </div>
      )}

      {/* Stage 3 candidate cards */}
      {!searching && (candidates.length > 0 || duplicateCount > 0) && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center justify-between">
            <span>
              후보 학회 ({visibleCandidates.length}/{candidates.length})
              {duplicateCount > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  · 기존 DB 중복 {duplicateCount}건 필터됨
                </span>
              )}
            </span>
            {acceptedCount > 0 && (
              <span className="text-xs font-normal text-emerald-700">
                ✓ {acceptedCount}건 추가됨
              </span>
            )}
          </div>
          {visibleCandidates.length === 0 ? (
            <div className="p-4 text-sm text-slate-500 text-center border border-dashed border-slate-300 rounded">
              모든 후보가 처리되었습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((c, i) => {
                if (rejectedIds.has(i) || acceptedIds.has(i)) return null;
                return (
                  <DiscoveryCard
                    key={i}
                    candidate={c}
                    onAccept={() => handleAccept(i)}
                    onReject={() => handleReject(i)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {!searching && !searchError && candidates.length === 0 && selected.length > 0 && (
        <div className="p-4 text-sm text-slate-500 text-center border border-dashed border-slate-300 rounded">
          [학회 검색 시작] 버튼을 눌러주세요.
        </div>
      )}

      {/* 세션 사용량/비용 — Stage 1+2 누적, 모달 unmount 시 리셋 */}
      {usage.calls > 0 && (
        <div className="border-t border-slate-200 pt-2 text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-2">
          <span>
            세션 호출 {usage.calls}회 · input {usage.input.toLocaleString()} tok
            · output {usage.output.toLocaleString()} tok
            {usage.searches > 0 && <> · web_search {usage.searches}회</>}
          </span>
          <span className="font-semibold text-slate-700">
            누적 비용 ≈ {fmtUSD(totalCost)} ({fmtKRW(totalCost)})
          </span>
        </div>
      )}
    </div>
  );
}
