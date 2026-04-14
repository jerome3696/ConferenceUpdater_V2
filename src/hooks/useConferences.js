import { useEffect, useState } from 'react';
import { isExpired } from '../utils/dateUtils';

export function useConferences() {
  const [data, setData] = useState({ conferences: [], editions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}data/conferences.json`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => setData(json))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  // 날짜 자동 전환: end_date가 지난 upcoming은 past로 취급 (JSON 원본은 수정하지 않음)
  const normalized = data.editions.map((e) => {
    if (e.status === 'upcoming' && isExpired(e.end_date)) {
      return { ...e, status: 'past', auto_expired: true };
    }
    return e;
  });

  const rows = data.conferences.map((c) => {
    const upcoming = normalized
      .filter((e) => e.conference_id === c.id && e.status === 'upcoming' && e.start_date)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    const last = normalized
      .filter((e) => e.conference_id === c.id && e.status === 'past' && e.start_date)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
    return { ...c, upcoming, last };
  });

  return { rows, loading, error };
}
