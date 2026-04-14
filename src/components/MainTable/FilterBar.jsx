function Select({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-slate-300 rounded px-2 py-1 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
      >
        <option value="">전체</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export default function FilterBar({
  categories, fields, regions,
  category, field, region, query,
  onChange, total, filtered,
}) {
  const reset = () => onChange({ category: '', field: '', region: '', query: '' });
  const hasFilter = category || field || region || query;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 mb-3 bg-white border border-slate-300 rounded">
      <Select label="분류" value={category} options={categories}
        onChange={(v) => onChange({ category: v, field, region, query })} />
      <Select label="분야" value={field} options={fields}
        onChange={(v) => onChange({ category, field: v, region, query })} />
      <Select label="지역" value={region} options={regions}
        onChange={(v) => onChange({ category, field, region: v, query })} />
      <label className="flex items-center gap-1 text-sm">
        <span className="text-slate-600">검색</span>
        <input
          type="text"
          value={query}
          onChange={(e) => onChange({ category, field, region, query: e.target.value })}
          placeholder="학회명 또는 약칭"
          className="border border-slate-300 rounded px-2 py-1 bg-white text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </label>
      {hasFilter && (
        <button onClick={reset} className="text-xs px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded">
          초기화
        </button>
      )}
      <div className="ml-auto text-xs text-slate-500">
        {filtered} / {total}건
      </div>
    </div>
  );
}
