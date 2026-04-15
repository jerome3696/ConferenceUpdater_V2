import * as XLSX from 'xlsx';

function todayStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsJson(data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, `conferences_${todayStamp()}.json`);
}

// rows: MainTable에서 사용하는 형태 (conferences + upcoming/last 병합)
export function exportAsXlsx(rows) {
  const sheetData = rows.map((r) => ({
    '중요도': r.starred || 0,
    '분류': r.category || '',
    '분야': r.field || '',
    '약칭': r.abbreviation || '',
    '학회명': r.full_name || '',
    '주기(년)': r.cycle_years || '',
    '기간(일)': r.duration_days || '',
    '지역': r.region || '',
    '공식URL': r.official_url || '',
    'Upcoming 시작일': r.upcoming?.start_date || '',
    'Upcoming 종료일': r.upcoming?.end_date || '',
    'Upcoming 장소': r.upcoming?.venue || '',
    'Upcoming 링크': r.upcoming?.link || '',
    'Upcoming 출처': r.upcoming?.source === 'ai_search' ? 'AI검색'
                    : r.upcoming?.source === 'user_input' ? '수동입력' : '',
    'Last 시작일': r.last?.start_date || '',
    'Last 종료일': r.last?.end_date || '',
    'Last 장소': r.last?.venue || '',
    'Last 링크': r.last?.link || '',
    '메모': r.note || '',
  }));

  const ws = XLSX.utils.json_to_sheet(sheetData);
  // 컬럼 폭 자동 조정 (대략적)
  const cols = Object.keys(sheetData[0] || {}).map((k) => {
    const maxLen = Math.max(
      k.length,
      ...sheetData.map((row) => String(row[k] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
  });
  ws['!cols'] = cols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '학회 DB');

  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `conferences_${todayStamp()}.xlsx`);
}
