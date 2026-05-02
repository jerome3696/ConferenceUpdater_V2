import { useEffect, useRef, useState } from 'react';
import { isExpired } from '../utils/dateUtils';
import {
  loadConferences,
  saveConferencesLocal,
  commitToGitHub,
  getCachedSha,
  generateDiscoveryConferenceId,
  upsertUserConference,
  deleteUserConference,
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

// PLAN-013-A: edition merge 시 anchor 필드 보존 (사용자 수동 토글이 명시적으로 들어왔을 때만 변경).
function mergeAnchor(existing, incoming) {
  if (incoming?.anchored !== undefined) {
    if (incoming.anchored && !existing?.anchored) {
      return { anchored: true, anchor_set_at: new Date().toISOString() };
    }
    if (!incoming.anchored && existing?.anchored) {
      return { anchored: false, anchor_set_at: null };
    }
  }
  return existing?.anchored
    ? { anchored: true, anchor_set_at: existing.anchor_set_at || null }
    : { anchored: false, anchor_set_at: null };
}

export function useConferences({ token, userId } = {}) {
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

  // PLAN-024: mutator 들은 `dataRef.current` 를 단일 소스로 읽는다 (`data` 아님).
  // 같은 렌더 틱 안에서 mutator 가 연속 호출돼도 앞선 변경을 덮어쓰지 않게 하기 위해서.
  // render-time 파생값(rows/normalized)은 `data` 를 계속 사용 — 그쪽은 stale 이슈 없음.
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
    const current = dataRef.current;
    persist({ ...current, conferences: [...current.conferences, conference] });
  };

  const updateConference = (id, patch) => {
    const current = dataRef.current;
    persist({
      ...current,
      conferences: current.conferences.map((c) => (c.id === id ? { ...c, ...patch } : c)),
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
          const fieldsChanged = !editionFieldsEqual(e, editionData);
          const anchor = status === 'upcoming' ? mergeAnchor(e, editionData) : { anchored: false, anchor_set_at: null };
          const anchorChanged = (e.anchored || false) !== anchor.anchored;
          if (!fieldsChanged && !anchorChanged) return e;
          const newSource = status === 'upcoming' && fieldsChanged ? 'user_input' : e.source;
          return { ...e, ...editionData, ...anchor, status, source: newSource, updated_at: now };
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
      ...(status === 'upcoming' ? mergeAnchor(null, editionData) : { anchored: false, anchor_set_at: null }),
    };
    return { ...next, editions: [...next.editions, newEdition] };
  };

  const saveConferenceEdit = (id, { master, starred, upcoming, last }, existingUpcomingId, existingLastId) => {
    const current = dataRef.current;
    let next = {
      ...current,
      conferences: current.conferences.map((c) =>
        c.id === id ? { ...c, ...master, starred } : c
      ),
    };
    next = upsertEdition(next, id, existingUpcomingId, 'upcoming', upcoming);
    next = upsertEdition(next, id, existingLastId, 'past', last);
    persist(next);
    // PLAN-038: Supabase user_conferences 동기화 (실패해도 UX 보호).
    if (userId) {
      const patch = { starred };
      if (master && Object.keys(master).length > 0) patch.overrides = master;
      upsertUserConference(userId, id, patch).catch((e) =>
        console.warn('user_conferences upsert 실패 (saveConferenceEdit):', e)
      );
    }
  };

  const updateStarred = (id, value) => {
    updateConference(id, { starred: value });
    // PLAN-038: Supabase user_conferences 동기화 (실패해도 UX 보호).
    if (userId) {
      upsertUserConference(userId, id, { starred: value }).catch((e) =>
        console.warn('user_conferences upsert 실패 (starred):', e)
      );
    }
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

  // PLAN-013-D: Last-edition 자동 발굴 적용.
  // 같은 conference 에 이미 past edition 이 있으면 `start_date` 가 더 최근(>=)인 후보만 교체/추가.
  // 더 오래된 과거를 덮어쓰지 않도록 보호.
  const applyLastDiscovery = (conferenceId, proposed) => {
    if (!proposed?.start_date) return;
    const current = dataRef.current;
    const now = new Date().toISOString();
    const pastsForConf = current.editions.filter(
      (e) => e.conference_id === conferenceId && e.status === 'past' && e.start_date
    );
    const mostRecent = pastsForConf.sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
    if (mostRecent && mostRecent.start_date >= proposed.start_date) return;

    const fields = {
      start_date: proposed.start_date || null,
      end_date: proposed.end_date || null,
      venue: proposed.venue || null,
      link: proposed.link || null,
      confidence: proposed.confidence || null,
    };

    let editions;
    if (mostRecent) {
      editions = current.editions.map((e) =>
        e.id === mostRecent.id
          ? { ...e, ...fields, status: 'past', source: 'ai_search', updated_at: now }
          : e
      );
    } else {
      editions = [
        ...current.editions,
        {
          id: generateEditionId(),
          conference_id: conferenceId,
          status: 'past',
          ...fields,
          source: 'ai_search',
          updated_at: now,
        },
      ];
    }
    persist({ ...current, editions });
  };

  // PLAN-013-A: AI 결과 수용 시 기본 anchor=false. 사용자가 "수용 (확정)" 으로 명시 요청한 경우만 true.
  const applyAiUpdate = (conferenceId, proposed, { anchor = false } = {}) => {
    const current = dataRef.current;
    const now = new Date().toISOString();
    const existing = current.editions
      .filter((e) => e.conference_id === conferenceId && e.status === 'upcoming')
      .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))[0];

    const fields = {
      start_date: proposed.start_date || null,
      end_date: proposed.end_date || null,
      venue: proposed.venue || null,
      link: proposed.link || null,
      // QA #14 — 메인 테이블 출처 셀 inline 표시용. 신뢰도 미제공 시 null.
      confidence: proposed.confidence || null,
      anchored: anchor,
      anchor_set_at: anchor ? now : null,
    };

    let editions;
    if (existing) {
      editions = current.editions.map((e) =>
        e.id === existing.id
          ? { ...e, ...fields, status: 'upcoming', source: 'ai_search', updated_at: now }
          : e
      );
    } else {
      editions = [
        ...current.editions,
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
    persist({ ...current, editions });
  };

  // PLAN-011-C: discovery 후보 승인 → master + (있으면) upcoming edition 동시 생성.
  // candidate 는 parseDiscoverySearchResponse 가 반환하는 형태 그대로.
  // 이미 동일 id 가 있으면 새 id 재생성 (이론상 거의 불가, 안전망).
  const addConferenceFromDiscovery = (candidate) => {
    if (!candidate || typeof candidate !== 'object') return null;
    const fullName = typeof candidate.full_name === 'string' ? candidate.full_name.trim() : '';
    if (!fullName) return null;

    const current = dataRef.current;
    let id = generateDiscoveryConferenceId();
    const existingIds = new Set(current.conferences.map((c) => c.id));
    while (existingIds.has(id)) id = generateDiscoveryConferenceId();

    const cycle = Number.isFinite(candidate.cycle_years) ? candidate.cycle_years : 0;
    const master = {
      id,
      starred: 0,
      category: '',
      field: typeof candidate.field === 'string' ? candidate.field : '',
      abbreviation: typeof candidate.abbreviation === 'string' ? candidate.abbreviation : '',
      full_name: fullName,
      cycle_years: cycle,
      duration_days: 0,
      region: typeof candidate.region === 'string' ? candidate.region : '',
      official_url: typeof candidate.official_url === 'string' ? candidate.official_url : '',
      note: '',
      source: 'ai_discovery',
      discovery_meta: {
        predatory_score: candidate.predatory_score || 'medium',
        predatory_reasons: Array.isArray(candidate.predatory_reasons) ? candidate.predatory_reasons : [],
        matched_keywords: Array.isArray(candidate.matched_keywords) ? candidate.matched_keywords : [],
        evidence_url: typeof candidate.evidence_url === 'string' ? candidate.evidence_url : '',
        organizer: typeof candidate.organizer === 'string' ? candidate.organizer : '',
        found_at: new Date().toISOString(),
      },
    };

    const u = candidate.upcoming;
    const hasUpcoming = u && (u.start_date || u.end_date || u.venue || u.link);
    const editions = hasUpcoming
      ? [
        ...current.editions,
        {
          id: generateEditionId(),
          conference_id: id,
          status: 'upcoming',
          start_date: u.start_date || null,
          end_date: u.end_date || null,
          venue: u.venue || null,
          link: u.link || null,
          confidence: null,
          source: 'ai_discovery',
          anchored: false,
          anchor_set_at: null,
          updated_at: new Date().toISOString(),
        },
      ]
      : current.editions;

    persist({ ...current, conferences: [...current.conferences, master], editions });
    // PLAN-038: user_conferences UPSERT — starred 기본값(0) 등록.
    // 가상 라이브러리 등록은 PLAN-030 의존 (TODO: PLAN-030 머지 후 library_id 포함).
    if (userId) {
      upsertUserConference(userId, id, { starred: 0 }).catch((e) =>
        console.warn('user_conferences upsert 실패 (addConferenceFromDiscovery):', e)
      );
    }
    return id;
  };

  const deleteConference = (id) => {
    const current = dataRef.current;
    persist({
      ...current,
      conferences: current.conferences.filter((c) => c.id !== id),
      editions: current.editions.filter((e) => e.conference_id !== id),
    });
    // PLAN-038: Supabase user_conferences 동기화 (실패해도 UX 보호).
    if (userId) {
      deleteUserConference(userId, id).catch((e) =>
        console.warn('user_conferences delete 실패:', e)
      );
    }
  };

  // 날짜 자동 전환. PLAN-013-A: past 전환 시 anchor 자동 해제.
  const normalized = data.editions.map((e) => {
    if (e.status === 'upcoming' && isExpired(e.end_date)) {
      return { ...e, status: 'past', auto_expired: true, anchored: false, anchor_set_at: null };
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
    applyLastDiscovery,
    applyVerifyUpdate,
    addConferenceFromDiscovery,
    deleteConference,
  };
}
