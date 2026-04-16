// 정합성 검증 카드 — blueprint §4.3.3.
// 필드별 status(일치/불일치/확인불가) 뱃지 + 불일치일 때 제안값 표시.

const FIELDS = [
  { key: 'full_name',     label: '정식명칭',  unit: '' },
  { key: 'abbreviation',  label: '약칭',      unit: '' },
  { key: 'cycle_years',   label: '주기',      unit: '년' },
  { key: 'duration_days', label: '기간',      unit: '일' },
  { key: 'region',        label: '지역',      unit: '' },
  { key: 'official_url',  label: '공식URL',   unit: '' },
];

function formatValue(value, unit) {
  if (value === null || value === undefined || value === '') return '';
  return `${value}${unit}`;
}

function StatusBadge({ status }) {
  if (status === '일치') {
    return <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">✅ 일치</span>;
  }
  if (status === '불일치') {
    return <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">⚠️ 불일치</span>;
  }
  return <span className="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-600">❓ 확인불가</span>;
}

function VerifyRow({ label, current, entry, unit }) {
  const status = entry?.status || '확인불가';
  const isMismatch = status === '불일치';
  const hasSuggestion = entry?.correct !== undefined && entry?.correct !== null && entry?.correct !== '';
  const currentDisplay = formatValue(current, unit) || <span className="text-slate-300">없음</span>;
  const suggestDisplay = hasSuggestion ? formatValue(entry.correct, unit) : null;

  return (
    <div className="grid grid-cols-[80px_1fr_auto] gap-2 py-1.5 border-b border-slate-100 last:border-0 text-sm items-center">
      <div className="text-slate-500">{label}</div>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`truncate ${isMismatch ? 'text-slate-600' : 'text-slate-700'}`} title={String(current ?? '')}>
          {currentDisplay}
        </span>
        {isMismatch && suggestDisplay && (
          <>
            <span className="text-slate-400">→</span>
            <span className="font-semibold text-amber-700 truncate" title={String(entry.correct)}>
              {suggestDisplay}
            </span>
          </>
        )}
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

export default function VerificationCard({ current, onAccept, onReject, onCancel }) {
  const { row, status, result, error } = current;

  // 수정할 항목 수 계산
  const mismatchCount = result
    ? FIELDS.filter((f) => {
        const e = result[f.key];
        return e?.status === '불일치' && e?.correct !== undefined && e?.correct !== null && e?.correct !== '';
      }).length
    : 0;
  const matchCount = result
    ? FIELDS.filter((f) => result[f.key]?.status === '일치').length
    : 0;

  return (
    <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-800">
            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 mr-2">검증</span>
            {row.abbreviation} <span className="text-slate-500 font-normal">— {row.full_name}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {row.category} / {row.field} / {row.region}
          </div>
        </div>
        <div className="text-xs">
          {status === 'loading' && <span className="text-blue-600">검증 중...</span>}
          {status === 'ready' && <span className="text-emerald-600">확인 대기</span>}
          {status === 'error' && <span className="text-red-600">오류</span>}
        </div>
      </div>

      <div className="p-4">
        {status === 'loading' && (
          <div className="py-8 text-center text-slate-500">
            <div className="inline-block animate-spin mr-2">⟳</div>
            Claude API로 검증 중입니다. 보통 10~30초 소요됩니다.
            <div className="mt-4">
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-100"
              >
                중단
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 whitespace-pre-wrap">
              {error}
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={onReject}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-100"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {status === 'ready' && result && (
          <>
            <div className="grid grid-cols-[80px_1fr_auto] gap-2 pb-2 border-b-2 border-slate-300 text-xs font-semibold text-slate-500">
              <div>필드</div>
              <div>현재 → 제안</div>
              <div>상태</div>
            </div>
            {FIELDS.map((f) => (
              <VerifyRow
                key={f.key}
                label={f.label}
                current={row[f.key]}
                entry={result[f.key]}
                unit={f.unit}
              />
            ))}

            {result.source_url && (
              <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
                출처:{' '}
                <a
                  href={result.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {result.source_url}
                </a>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                전체 결과:{' '}
                <span className="font-semibold text-slate-800">
                  {matchCount}/{FIELDS.length} 일치
                </span>
                {mismatchCount > 0 && (
                  <span className="ml-2 text-amber-700">
                    · 수정 제안 {mismatchCount}건
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onReject}
                  className="px-4 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
                >
                  {mismatchCount > 0 ? '무시' : '확인'}
                </button>
                {mismatchCount > 0 && (
                  <button
                    onClick={onAccept}
                    className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    수정사항 수용
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
