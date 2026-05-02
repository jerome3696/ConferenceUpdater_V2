// 발굴 패널 컨테이너. Stage 1 (키워드 확장) + Stage 2 (학회 검색) + Stage 3 (카드 검토).
// 011-C: 승인 시 onAccept 콜백 (App → useConferences.addConferenceFromDiscovery) 으로
//        master + upcoming edition 동시 생성. Stage 1·2 의 토큰/web_search usage 누적.
// 011-D: parseDiscoverySearchResponse 직후 nameMatch 로 기존 학회 중복 제거 + 휴리스틱
//        predatory 점수 보강 (AI 가 놓친 약탈 패턴 보완).
// PLAN-023 (2026-04-21): 상태 13개를 `useDiscoveryState.js` 의 4 훅으로 분해.

import KeywordExpansion from './KeywordExpansion';
import DiscoveryCard from './DiscoveryCard';
import {
  useDiscoveryUsage,
  useKeywordExpansion,
  useDiscoverySearch,
  useCandidateReview,
  fmtUSD,
  fmtKRW,
} from './useDiscoveryState';

export default function DiscoveryPanel({ existingConferences = [], onAccept, onClose }) {
  const { usage, addUsage, totalCost } = useDiscoveryUsage();
  const kw = useKeywordExpansion({ addUsage });
  const search = useDiscoverySearch({
    selected: kw.selected,
    existingConferences,
    addUsage,
  });
  const review = useCandidateReview({ candidates: search.candidates, onAccept });

  // 새 검색 시작 전 이전 accept/reject 상태 초기화. 기존 DiscoveryPanel 의 onResetReview 동작 보존.
  const onSearchClick = () => {
    review.reset();
    return search.handleSearch();
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
          seedInput={kw.seedInput}
          onSeedInputChange={kw.setSeedInput}
          onExpand={kw.handleExpand}
          expanding={kw.expanding}
          expandError={kw.expandError}
          expanded={kw.expanded}
          selected={kw.selected}
          onToggle={kw.handleToggle}
          onAddCustom={kw.handleAddCustom}
          onRemoveCustom={kw.handleRemoveCustom}
          customKeywords={kw.customKeywords}
          onSearch={onSearchClick}
          searching={search.searching}
        />
      </div>

      {/* Stage 2 search status */}
      {search.searchError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-sm text-rose-700">
          {search.searchError}
        </div>
      )}

      {search.searching && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 text-center">
          <div className="inline-block animate-spin mr-2">⟳</div>
          web_search 최대 10회 실행 중... 보통 30~60초 소요됩니다.
        </div>
      )}

      {/* Stage 3 candidate cards */}
      {!search.searching && (search.candidates.length > 0 || search.duplicateCount > 0) && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center justify-between">
            <span>
              후보 학회 ({review.visibleCandidates.length}/{search.candidates.length})
              {search.duplicateCount > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  · 기존 DB 중복 {search.duplicateCount}건 필터됨
                </span>
              )}
            </span>
            {review.acceptedCount > 0 && (
              <span className="text-xs font-normal text-emerald-700">
                ✓ {review.acceptedCount}건 추가됨
              </span>
            )}
          </div>
          {review.visibleCandidates.length === 0 ? (
            <div className="p-4 text-sm text-slate-500 text-center border border-dashed border-slate-300 rounded">
              모든 후보가 처리되었습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {search.candidates.map((c, i) => {
                if (review.rejectedIds.has(i) || review.acceptedIds.has(i)) return null;
                return (
                  <DiscoveryCard
                    key={i}
                    candidate={c}
                    onAccept={() => review.handleAccept(i)}
                    onReject={() => review.handleReject(i)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {!search.searching && !search.searchError && search.candidates.length === 0 && kw.selected.length > 0 && (
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
