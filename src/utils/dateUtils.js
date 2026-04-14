export function formatDate(iso) {
  if (!iso) return '';
  return iso;
}

export function formatDateRange(start, end) {
  if (!start) return '';
  if (!end || start === end) return start;
  return `${start} ~ ${end}`;
}

export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isExpired(endDate, today = todayIso()) {
  if (!endDate) return false;
  return endDate < today;
}
