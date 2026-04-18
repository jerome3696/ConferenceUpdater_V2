// Stage 1 UI: 시드 키워드 입력 → AI 확장(ko/en 페어) → 칩 선택 + 자유 입력 추가/제거.
// 호출은 부모(DiscoveryPanel)가 담당. 본 컴포넌트는 입력·선택 상태만 관리.
//
// 011-B.1: 모든 키워드는 {ko, en} 페어. 칩은 메인 한국어 + 보조 영어 2-line.
//          자유 입력은 en=ko 폴백 (자동 번역 없음 — MVP).

import { useState } from 'react';

const MAX_SELECTED = 7;

// ko+en 정규화 키 — 대소문자/공백 무시한 동치 비교용
function pairKey(p) {
  return `${(p.ko || '').trim().toLowerCase()}::${(p.en || '').trim().toLowerCase()}`;
}

function Chip({ pair, on, onToggle, onRemove }) {
  const sameKoEn = pair.ko === pair.en;
  return (
    <span
      className={`inline-flex items-stretch gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs border ${
        on
          ? 'bg-blue-50 border-blue-300 text-blue-700'
          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
      title={sameKoEn ? pair.ko : `${pair.ko} / ${pair.en}`}
    >
      <button type="button" onClick={onToggle} className="text-left leading-tight py-0.5">
        <div className="font-medium">{pair.ko}</div>
        {!sameKoEn && (
          <div className="text-[10px] text-slate-400 font-normal">{pair.en}</div>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-rose-500 px-1 self-center"
          title="제거"
        >
          ×
        </button>
      )}
    </span>
  );
}

export default function KeywordExpansion({
  seedInput,
  onSeedInputChange,
  onExpand,
  expanding,
  expandError,
  expanded,             // {ko,en}[] — AI 제안
  selected,             // {ko,en}[] — 사용자가 선택한 키워드 (시드 + 확장 + 직접 입력 통합)
  onToggle,             // (pair) => void
  onAddCustom,          // (pair) => void
  onRemoveCustom,       // (pair) => void
  customKeywords,       // {ko,en}[] — 사용자가 직접 추가한 것 (제거 가능)
  onSearch,
  searching,
}) {
  const [customInput, setCustomInput] = useState('');

  const handleAddCustom = () => {
    const v = customInput.trim();
    if (!v) return;
    // MVP 폴백: en=ko (자동 번역 없음)
    onAddCustom({ ko: v, en: v });
    setCustomInput('');
  };

  const tooMany = selected.length > MAX_SELECTED;
  const selectedKeys = new Set(selected.map(pairKey));
  const isSelected = (p) => selectedKeys.has(pairKey(p));

  return (
    <div className="space-y-3">
      {/* Stage 1: seed input */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          시드 키워드 (1~3개, 쉼표로 구분)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={seedInput}
            onChange={(e) => onSeedInputChange(e.target.value)}
            placeholder="예: 열전달, 디지털 트윈"
            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            disabled={expanding}
          />
          <button
            onClick={onExpand}
            disabled={expanding || !seedInput.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {expanding ? '확장 중...' : '연관 키워드 받기'}
          </button>
        </div>
        {expandError && (
          <div className="mt-1 text-xs text-rose-600">{expandError}</div>
        )}
      </div>

      {/* Expanded keywords (AI suggestions) */}
      {expanded.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">
            AI 제안 ({expanded.length}개) — 클릭해서 선택
          </div>
          <div className="flex flex-wrap gap-1.5">
            {expanded.map((kw) => (
              <Chip
                key={pairKey(kw)}
                pair={kw}
                on={isSelected(kw)}
                onToggle={() => onToggle(kw)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom keywords */}
      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1">
          직접 추가 <span className="text-slate-400 font-normal">(영어로 입력해도 OK — 그대로 검색에 사용)</span>
        </div>
        <div className="flex gap-2 mb-1.5">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustom(); } }}
            placeholder="키워드 입력 후 Enter"
            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={handleAddCustom}
            disabled={!customInput.trim()}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            추가
          </button>
        </div>
        {customKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customKeywords.map((kw) => (
              <Chip
                key={pairKey(kw)}
                pair={kw}
                on={isSelected(kw)}
                onToggle={() => onToggle(kw)}
                onRemove={() => onRemoveCustom(kw)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected summary + Search button */}
      <div className="border-t border-slate-200 pt-3">
        <div className="text-xs text-slate-600 mb-2">
          선택된 키워드: <span className={`font-semibold ${tooMany ? 'text-rose-600' : 'text-slate-800'}`}>
            {selected.length} / {MAX_SELECTED}
          </span>
          {tooMany && <span className="text-rose-600 ml-2">— {MAX_SELECTED}개 이하로 줄여주세요</span>}
        </div>
        <button
          onClick={onSearch}
          disabled={searching || selected.length === 0 || tooMany}
          className="w-full px-3 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {searching ? '학회 검색 중... (30~60초)' : `학회 검색 시작 (${selected.length}개 키워드)`}
        </button>
      </div>
    </div>
  );
}
