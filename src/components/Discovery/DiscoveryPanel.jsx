// 발굴 패널 컨테이너. Stage 1 (키워드 확장) + Stage 2 (학회 검색) + Stage 3 (카드 검토).
// 011-B: callClaude 직접 호출, 카드 표시까지. 승인 시 alert 만 (실제 master+edition 생성은 011-C).
//
// 주의: useDiscoveryQueue 분리는 011-C 에서 수행. 본 단계는 단일 batch 호출 결과만 다룸.

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
import { MODELS } from '../../config/models';

// Haiku 4.5 사용 (update와 동일). discovery 전용 키 추가는 011-C.
const DISCOVERY_MODEL = MODELS.update;

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

export default function DiscoveryPanel({ apiKey, existingConferences = [], onClose }) {
  const [seedInput, setSeedInput] = useState('');
  const [expanded, setExpanded] = useState([]);     // AI 제안
  const [customKeywords, setCustomKeywords] = useState([]);
  const [selected, setSelected] = useState([]);

  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState(null);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [candidates, setCandidates] = useState([]); // Stage 2 결과
  const [rejectedIds, setRejectedIds] = useState(new Set());

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
      const text = extractText(res);
      const parsed = parseDiscoverySearchResponse(text);
      if (!parsed.ok) {
        setSearchError(`응답 파싱 실패 (${parsed.reason})`);
        return;
      }
      setCandidates(parsed.candidates);
    } catch (e) {
      const msg = e instanceof ClaudeApiError ? e.message : `오류: ${e?.message || e}`;
      setSearchError(msg);
    } finally {
      setSearching(false);
    }
  };

  const visibleCandidates = useMemo(
    () => candidates.filter((_, i) => !rejectedIds.has(i)),
    [candidates, rejectedIds]
  );

  const handleAccept = (idx) => {
    // 011-B: 실제 저장은 011-C. 임시로 alert + 카드 제거.
    const c = candidates[idx];
    alert(
      `[PLAN-011-B 임시] "${c.full_name}" 승인됨 — 실제 저장은 011-C 단계에서 구현됩니다.\n`
      + `marked predatory_score=${c.predatory_score}.`
    );
    setRejectedIds((prev) => new Set(prev).add(idx));
  };

  const handleReject = (idx) => {
    setRejectedIds((prev) => new Set(prev).add(idx));
  };

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
      {!searching && candidates.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">
            후보 학회 ({visibleCandidates.length}/{candidates.length})
          </div>
          {visibleCandidates.length === 0 ? (
            <div className="p-4 text-sm text-slate-500 text-center border border-dashed border-slate-300 rounded">
              모든 후보가 처리되었습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((c, i) => {
                if (rejectedIds.has(i)) return null;
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
    </div>
  );
}
