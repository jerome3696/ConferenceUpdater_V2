import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '../services/supabaseClient';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data?.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
    });
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return {
    session,
    user: session?.user ?? null,
    loading,
    isAuthenticated: Boolean(session),
    signOut,
    configured: supabaseConfigured,
  };
}
