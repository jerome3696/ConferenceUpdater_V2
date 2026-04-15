function DiffRow({ label, oldValue, newValue }) {
  const changed = (oldValue || '') !== (newValue || '');
  return (
    <div className="grid grid-cols-[100px_1fr_1fr] gap-2 py-1.5 border-b border-slate-100 last:border-0 text-sm">
      <div className="text-slate-500">{label}</div>
      <div className={`text-slate-600 ${changed ? 'line-through' : ''}`}>{oldValue || <span className="text-slate-300">없음</span>}</div>
      <div className={changed ? 'font-semibold text-emerald-700' : 'text-slate-600'}>
        {newValue || <span className="text-slate-300">없음</span>}
      </div>
    </div>
  );
}

export default function VerificationCard({ current, onAccept, onReject, onCancel }) {
  const { row, status, result, error } = current;
  const oldUpcoming = row.upcoming || {};

  return (
    <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-800">
            {row.abbreviation} <span className="text-slate-500 font-normal">— {row.full_name}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {row.category} / {row.field} / {row.region}
          </div>
        </div>
        <div className="text-xs">
          {status === 'loading' && <span className="text-blue-600">검색 중...</span>}
          {status === 'ready' && <span className="text-emerald-600">승인 대기</span>}
          {status === 'error' && <span className="text-red-600">오류</span>}
        </div>
      </div>

      <div className="p-4">
        {status === 'loading' && (
          <div className="py-8 text-center text-slate-500">
            <div className="inline-block animate-spin mr-2">⟳</div>
            Claude API로 검색 중입니다. 보통 10~30초 소요됩니다.
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
            <div className="grid grid-cols-[100px_1fr_1fr] gap-2 pb-2 border-b-2 border-slate-300 text-xs font-semibold text-slate-500">
              <div>필드</div>
              <div>현재</div>
              <div>제안</div>
            </div>
            <DiffRow label="시작일" oldValue={oldUpcoming.start_date} newValue={result.start_date} />
            <DiffRow label="종료일" oldValue={oldUpcoming.end_date} newValue={result.end_date} />
            <DiffRow label="장소" oldValue={oldUpcoming.venue} newValue={result.venue} />
            <DiffRow label="링크" oldValue={oldUpcoming.link} newValue={result.link} />

            {(result.confidence || result.source_url || result.notes) && (
              <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 space-y-1">
                {result.confidence && <div>신뢰도: <span className="font-semibold">{result.confidence}</span></div>}
                {result.source_url && (
                  <div>
                    출처: <a href={result.source_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{result.source_url}</a>
                  </div>
                )}
                {result.notes && <div>비고: {result.notes}</div>}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={onReject}
                className="px-4 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
              >
                리젝
              </button>
              <button
                onClick={onAccept}
                className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                수용
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
