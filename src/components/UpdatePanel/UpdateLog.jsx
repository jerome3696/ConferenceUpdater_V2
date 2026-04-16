function formatTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

const ACTION_STYLES = {
  accepted: { label: '수용', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '리젝', cls: 'bg-slate-200 text-slate-600' },
  error: { label: '오류', cls: 'bg-red-100 text-red-700' },
};

const KIND_STYLES = {
  update: { label: '업데이트', cls: 'bg-blue-100 text-blue-700' },
  verify: { label: '검증', cls: 'bg-indigo-100 text-indigo-700' },
};

const VERIFY_FIELDS = ['full_name', 'abbreviation', 'cycle_years', 'duration_days', 'region', 'official_url'];

function summarizeVerifyResult(result) {
  if (!result) return '';
  const fixed = VERIFY_FIELDS.filter((f) => {
    const e = result[f];
    return e?.status === '불일치' && e?.correct !== undefined && e?.correct !== null && e?.correct !== '';
  });
  if (fixed.length === 0) return '수정 없음';
  return `수정 ${fixed.length}건: ${fixed.join(', ')}`;
}

export default function UpdateLog({ log }) {
  if (log.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">처리 로그 ({log.length})</h3>
      <div className="bg-white border border-slate-200 rounded divide-y divide-slate-100">
        {log.map((entry) => {
          const style = ACTION_STYLES[entry.action] || ACTION_STYLES.rejected;
          const kind = KIND_STYLES[entry.kind] || KIND_STYLES.update;
          const isVerify = entry.kind === 'verify';
          return (
            <div key={entry.id} className="px-3 py-2 text-sm flex items-center gap-3">
              <span className="text-xs text-slate-400 font-mono w-16">{formatTime(entry.at)}</span>
              <span className={`px-2 py-0.5 text-xs rounded ${kind.cls}`}>{kind.label}</span>
              <span className={`px-2 py-0.5 text-xs rounded ${style.cls}`}>{style.label}</span>
              <span className="font-semibold text-slate-700">{entry.abbrev}</span>
              <span className="text-slate-500 text-xs truncate flex-1">
                {entry.action === 'accepted' && entry.result && (
                  isVerify
                    ? summarizeVerifyResult(entry.result)
                    : <>{entry.result.start_date} ~ {entry.result.end_date} / {entry.result.venue}</>
                )}
                {entry.action === 'error' && entry.error}
              </span>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-slate-400 mt-2">※ 로그는 새로고침 시 초기화됩니다.</div>
    </div>
  );
}
