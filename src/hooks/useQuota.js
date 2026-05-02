import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../services/supabaseClient';
import { subscribeQuota } from '../services/claudeApiServer';

export function useQuota({ userId } = {}) {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabaseConfigured && userId));

  useEffect(() => {
    if (!supabaseConfigured || !userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuota(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('quotas')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setQuota(data);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // claudeApi 응답에 포함된 quota_after 자동 반영
  useEffect(() => subscribeQuota((q) => setQuota((prev) => ({ ...(prev || {}), ...q }))), []);

  return { quota, loading, setQuota };
}
