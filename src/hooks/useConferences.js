import { useEffect, useRef, useState } from 'react';
import { isExpired } from '../utils/dateUtils';
import {
  loadConferences,
  saveConferencesLocal,
  commitToGitHub,
  getCachedSha,
  ConflictError,
} from '../services/dataManager';

const DEBOUNCE_MS = 10000;

function generateEditionId() {
  return `ed_${Date.now().toString(36)}`;
}

function isEditionEmpty(e) {
  return !e.start_date && !e.end_date && !e.venue && !e.link;
}

function editionFieldsEqual(a, b) {
  return (a?.start_date || '') === (b?.start_date || '')
    && (a?.end_date || '') === (b?.end_date || '')
    && (a?.venue || '') === (b?.venue || '')
    && (a?.link || '') === (b?.link || '');
}

export function useConferences({ token } = {}) {
  const [data, setData] = useState({ conferences: [], editions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | dirty | saving | saved | error | conflict
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // ref로 최신값 유지 (debounce 타이머 내부에서 참조)
  const tokenRef = useRef(token);
  const dataRef = useRef(data);
  const timerRef = useRef(null);

  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { dataRef.current = data; }, [data]);

  // 초기 로드 (token 변화에 재로드: 토큰 설정 직후 최신본 fetch)
  useEffect(() => {
    let cancelled = false;
    // 토큰 변경 시 로딩 상태로 즉시 전환해야 UI에서 깜빡임 없이 fetch 표시 가능.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    loadConferences({ token })
      .then(({ data: loaded }) => {
        if (!cancelled) setData(loaded);
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [token]);

  const runCommit = async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) {
      setSyncStatus('idle');
      return;
    }
    setSyncStatus('saving');
    try {
      await commitToGitHub(currentToken, dataRef.current, getCachedSha());
      setSyncStatus('saved');
      setLastSavedAt(new Date());
    } catch (e) {
      console.error('GitHub 커밋 실패:', e);
      if (e instanceof ConflictError) {
        setSyncStatus('conflict');
      } else {
        setSyncStatus('error');
      }
    }
  };

  const scheduleCommit = () => {
    if (!tokenRef.current) {
      setSyncStatus('idle');
      return;
    }
    setSyncStatus('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(runCommit, DEBOUNCE_MS);
  };

  const persist = (next) => {
    setData(next);
    dataRef.current = next;
    saveConferencesLocal(next);
    scheduleCommit();
  };

  const retryCommit = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    runCommit();
  };

  const addConference = (conference) => {
    persist({ ...data, conferences: [...data.conferences, conference] });
  };

  const updateConference = (id, patch) => {
    persist({
      ...data,
      conferences: data.conferences.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  // QA #13: source 갱신은 upcoming 필드가 실제로 변경된 경우에만.
  // - 기존 edition: 필드 변경 없으면 source 그대로 (편집 모달 단순 저장으로 ai_search → user_input
  //   덮어쓰기 방지). status='upcoming' 이고 변경된 경우에만 user_input 으로 승격.
  // - 신규 edition: 사용자가 명시적으로 입력한 것이므로 user_input.
  const upsertEdition = (next, conferenceId, existingEditionId, status, editionData) => {
    const now = new Date().toISOString();
    const empty = isEditionEmpty(editionData);

    if (existingEditionId) {
      if (empty) {
        return {
          ...next,
          editions: next.editions.filter((e) => e.id !== existingEditionId),
        };
      }
      return {
        ...next,
        editions: next.editions.map((e) => {
          if (e.id !== existingEditionId) return e;
          const changed = !editionFieldsEqual(e, editionData);
          if (!changed) return e;
          const newSource = status === 'upcoming' ? 'user_input' : e.source;
          return { ...e, ...editionData, status, source: newSource, updated_at: now };
        }),
      };
    }
    if (empty) return next;
    const newEdition = {
      id: generateEditionId(),
      conference_id: conferenceId,
      status,
      start_date: editionData.start_date,
      end_date: editionData.end_date,
      venue: editionData.venue,
      link: editionData.link,
      source: 'user_input',
      updated_at: now,
    };
    return { ...next, editions: [...next.editions, newEdition] };
  };

  const saveConferenceEdit = (id, { master, starred, upcoming, last }, existingUpcomingId, existingLastId) => {
    let next = {
      ...data,
      conferences: data.conferences.map((c) =>
        c.id === id ? { ...c, ...master, starred } : c
      ),
    };
    next = upsertEdition(next, id, existingUpcomingId, 'upcoming', upcoming);
    next = upsertEdition(next, id, existingLastId, 'past', last);
    persist(next);
  };

  const updateStarred = (id, value) => {
    updateConference(id, { starred: value });
  };

  // 검증 결과 수용: status === '불일치' 인 필드만 correct 값으로 학회 마스터에 반영.
  // 일치/확인불가 필드는 건드리지 않는다.
  const applyVerifyUpdate = (conferenceId, result) => {
    const FIELDS = ['full_name', 'abbreviation', 'cycle_years', 'duration_days', 'region', 'official_url'];
    const patch = {};
    for (const f of FIELDS) {
      const entry = result?.[f];
      if (entry && entry.status === '불일치' && entry.correct !== undefined && entry.correct !== null && entry.correct !== '') {
        patch[f] = entry.correct;
      }
    }
    if (Object.keys(patch).length === 0) return;
    updateConference(conferenceId, patch);
  };

  const applyAiUpdate = (conferenceId, proposed) => {
    const now = new Date().toISOString();
    const existing = data.editions
      .filter((e) => e.conference_id === conferenceId && e.status === 'upcoming')
      .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))[0];

    const fields = {
      start_date: proposed.start_date || null,
      end_date: proposed.end_date || null,
      venue: proposed.venue || null,
      link: proposed.link || null,
      // QA #14 — 메인 테이블 출처 셀 inline 표시용. 신뢰도 미제공 시 null.
      confidence: proposed.confidence || null,
    };

    let editions;
    if (existing) {
      editions = data.editions.map((e) =>
        e.id === existing.id
          ? { ...e, ...fields, status: 'upcoming', source: 'ai_search', updated_at: now }
          : e
      );
    } else {
      editions = [
        ...data.editions,
        {
          id: generateEditionId(),
          conference_id: conferenceId,
          status: 'upcoming',
          ...fields,
          source: 'ai_search',
          updated_at: now,
        },
      ];
    }
    persist({ ...data, editions });
  };

  const deleteConference = (id) => {
    persist({
      ...data,
      conferences: data.conferences.filter((c) => c.id !== id),
      editions: data.editions.filter((e) => e.conference_id !== id),
    });
  };

  // 날짜 자동 전환
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

  return {
    rows, loading, error,
    data,
    syncStatus,
    lastSavedAt,
    retryCommit,
    addConference,
    updateConference,
    updateStarred,
    saveConferenceEdit,
    applyAiUpdate,
    applyVerifyUpdate,
    deleteConference,
  };
}
