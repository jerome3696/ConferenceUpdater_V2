// Stage 1 UI: 시드 키워드 입력 → AI 확장 → 체크박스 선택 + 자유 입력 추가/제거.
// 호출은 부모(DiscoveryPanel)가 담당. 본 컴포넌트는 입력·선택 상태만 관리.

import { useState } from 'react';

const MAX_SELECTED = 7;

function Chip({ label, on, onToggle, onRemove }) {
  return (
    <span
      className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs border ${
        on
          ? 'bg-blue-50 border-blue-300 text-blue-700'
          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <button type="button" onClick={onToggle} className="font-medium">
        {label}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-rose-500 px-1"
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
  expanded,             // string[] — AI 제안
  selected,             // string[] — 사용자가 선택한 키워드 (시드 + 확장 + 직접 입력 통합)
  onToggle,             // (keyword) => void
  onAddCustom,          // (keyword) => void
  onRemoveCustom,       // (keyword) => void
  customKeywords,       // string[] — 사용자가 직접 추가한 것 (제거 가능)
  onSearch,
  searching,
}) {
  const [customInput, setCustomInput] = useState('');

  const handleAddCustom = () => {
    const v = customInput.trim();
    if (!v) return;
    onAddCustom(v);
    setCustomInput('');
  };

  const tooMany = selected.length > MAX_SELECTED;

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
                key={kw}
                label={kw}
                on={selected.includes(kw)}
                onToggle={() => onToggle(kw)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom keywords */}
      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1">직접 추가</div>
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
                key={kw}
                label={kw}
                on={selected.includes(kw)}
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
