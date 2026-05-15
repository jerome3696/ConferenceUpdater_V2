import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

// ── 섹션별 데이터 훅 ─────────────────────────────────────────

function useUsageStats() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: rows, error: err } = await supabase.rpc('admin_usage_stats');
        if (err) throw err;
        setData(rows ?? []);
      } catch (e) {
        // fallback: direct query
        try {
          const { data: rows, error: err2 } = await supabase
            .from('users')
            .select(`
              email,
              quotas(update_used, discovery_used, update_limit, discovery_limit)
            `);
          if (err2) throw err2;
          setData((rows ?? []).map(u => ({
            email: u.email,
            update_used: u.quotas?.update_used ?? 0,
            discovery_used: u.quotas?.discovery_used ?? 0,
            update_limit: u.quotas?.update_limit ?? 0,
            discovery_limit: u.quotas?.discovery_limit ?? 0,
            total_cost: 0,
          })));
        } catch {
          setError(e.message);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { data, loading, error };
}

function useCostTrend() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: rows, error: err } = await supabase
          .from('api_usage_log')
          .select('created_at, cost_usd')
          .order('created_at', { ascending: false });
        if (err) throw err;

        // 월별 집계
        const byMonth = {};
        for (const row of rows ?? []) {
          const month = row.created_at?.slice(0, 7) ?? 'unknown';
          byMonth[month] = (byMonth[month] ?? 0) + Number(row.cost_usd ?? 0);
        }
        const sorted = Object.entries(byMonth)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 6)
          .map(([month, cost]) => ({ month, cost }));
        setData(sorted);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { data, loading, error };
}

function useTopEdited() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        // audit_log에서 최근 30일 편집 빈도 상위 10개 집계
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: rows, error: err } = await supabase
          .from('audit_log')
          .select('conference_id, conferences_upstream(full_name, abbreviation)')
          .gte('ts', since);
        if (err) throw err;

        const counts = {};
        const names = {};
        for (const row of rows ?? []) {
          const cid = row.conference_id;
          counts[cid] = (counts[cid] ?? 0) + 1;
          if (row.conferences_upstream) {
            names[cid] = row.conferences_upstream.abbreviation || row.conferences_upstream.full_name || cid;
          }
        }
        const top10 = Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([id, edits]) => ({ id, edits, name: names[id] ?? id }));
        setData(top10);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { data, loading, error };
}

function useAbuseSignals() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: rows, error: err } = await supabase
          .from('api_usage_log')
          .select('user_id, status')
          .gte('created_at', since);
        if (err) throw err;

        const stats = {};
        for (const row of rows ?? []) {
          const uid = row.user_id;
          if (!stats[uid]) stats[uid] = { total: 0, errors: 0 };
          stats[uid].total += 1;
          if (row.status === 'error') stats[uid].errors += 1;
        }

        const signals = Object.entries(stats)
          .filter(([, s]) => s.total > 3 && (s.errors / s.total) >= 0.3)
          .map(([user_id, s]) => ({
            user_id,
            error_rate: Math.round((s.errors / s.total) * 100),
            total: s.total,
          }));
        setData(signals);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { data, loading, error };
}

function useInvitations() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error: err } = await supabase
        .from('invitations')
        .select('id, code, intended_email, used_by, used_at, expires_at, created_at')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setInvitations(rows ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { invitations, loading, error, reload: load };
}

function useUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: rows } = await supabase
        .from('users')
        .select('id, email, quotas(update_limit, discovery_limit)')
        .order('email');
      setUsers(rows ?? []);
    }
    load();
  }, []);

  return users;
}

// ── 섹션 컴포넌트 ──────────────────────────────────────────────

function SectionHeader({ children }) {
  return <h2 className="text-base font-semibold text-slate-700 mb-3">{children}</h2>;
}

function StatusBadge({ ok, label }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
      {label}
    </span>
  );
}

function LoadingRow({ cols }) {
  return (
    <tr>
      <td colSpan={cols} className="py-6 text-center text-sm text-slate-400">로딩 중...</td>
    </tr>
  );
}

function ErrorRow({ cols, msg }) {
  return (
    <tr>
      <td colSpan={cols} className="py-4 text-center text-sm text-red-500">{msg}</td>
    </tr>
  );
}

// a) 사용량 현황
function UsageSection() {
  const { data, loading, error } = useUsageStats();

  return (
    <section className="mb-8">
      <SectionHeader>사용량 현황</SectionHeader>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">이메일</th>
              <th className="px-4 py-2 text-right">update 사용</th>
              <th className="px-4 py-2 text-right">discovery 사용</th>
              <th className="px-4 py-2 text-right">이번달 비용</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <LoadingRow cols={4} /> : null}
            {error ? <ErrorRow cols={4} msg={error} /> : null}
            {!loading && !error && data.length === 0 ? (
              <tr><td colSpan={4} className="py-6 text-center text-sm text-slate-400">데이터 없음</td></tr>
            ) : null}
            {!loading && !error && data.map(row => (
              <tr key={row.email} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-700">{row.email}</td>
                <td className="px-4 py-2 text-right text-slate-600">{row.update_used}/{row.update_limit}</td>
                <td className="px-4 py-2 text-right text-slate-600">{row.discovery_used}/{row.discovery_limit}</td>
                <td className="px-4 py-2 text-right text-slate-600">${Number(row.total_cost ?? 0).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// b) 월 비용 추세
function CostTrendSection() {
  const { data, loading, error } = useCostTrend();
  const BUDGET = 50;

  return (
    <section className="mb-8">
      <SectionHeader>월 비용 추세</SectionHeader>
      {loading && <p className="text-sm text-slate-400">로딩 중...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && (
        <div className="space-y-2">
          {data.length === 0 && <p className="text-sm text-slate-400">데이터 없음</p>}
          {data.map(row => (
            <div key={row.month} className="flex items-center gap-3">
              <span className="w-16 text-xs text-slate-500 shrink-0">{row.month}</span>
              <div className="flex-1 relative h-5 bg-slate-100 rounded overflow-hidden">
                <div
                  className="h-full bg-sky-400 rounded"
                  style={{ width: `${Math.min((row.cost / BUDGET) * 100, 100)}%` }}
                />
                {/* $50 budget reference line */}
                <div className="absolute top-0 right-0 h-full w-px bg-red-400 opacity-60" title="$50 예산" />
              </div>
              <span className="w-20 text-xs text-right text-slate-600 shrink-0">${row.cost.toFixed(4)}</span>
            </div>
          ))}
          <p className="text-xs text-slate-400 mt-1">빨간 선 = $50 예산 기준</p>
        </div>
      )}
    </section>
  );
}

// c) 자주 편집 TOP10
function TopEditedSection() {
  const { data, loading, error } = useTopEdited();

  return (
    <section className="mb-8">
      <SectionHeader>자주 편집 TOP10 (최근 30일)</SectionHeader>
      {loading && <p className="text-sm text-slate-400">로딩 중...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && (
        <ol className="space-y-1">
          {data.length === 0 && <li className="text-sm text-slate-400">데이터 없음</li>}
          {data.map((item, i) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-right text-slate-400 shrink-0">{i + 1}.</span>
              <span className="flex-1 text-slate-700">{item.name}</span>
              <span className="text-slate-500 shrink-0">{item.edits}건</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// d) 어뷰즈 신호
function AbuseSection() {
  const { data, loading, error } = useAbuseSignals();

  return (
    <section className="mb-8">
      <SectionHeader>어뷰즈 신호 (최근 24h)</SectionHeader>
      {loading && <p className="text-sm text-slate-400">로딩 중...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-emerald-600">이상 신호 없음</p>
      )}
      {!loading && !error && data.length > 0 && (
        <ul className="space-y-2">
          {data.map(s => (
            <li key={s.user_id} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <span className="text-red-500">경고</span>
              <span className="text-slate-700 font-mono text-xs">{s.user_id}</span>
              <span className="text-red-600 font-medium">오류율 {s.error_rate}%</span>
              <span className="text-slate-500">({s.total}건 중)</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// e) 초대 코드 발급
function InviteSection() {
  const { invitations, loading, error, reload } = useInvitations();
  const [email, setEmail] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState(null);

  async function handleIssue() {
    setIssuing(true);
    setIssueError(null);
    try {
      const { data: codeData, error: codeErr } = await supabase.rpc('generate_invite_code');
      if (codeErr) throw codeErr;

      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertErr } = await supabase.from('invitations').insert({
        code: codeData,
        intended_email: email.trim() || null,
        created_by: user?.id ?? null,
      });
      if (insertErr) throw insertErr;

      setEmail('');
      await reload();
    } catch (e) {
      setIssueError(e.message);
    } finally {
      setIssuing(false);
    }
  }

  function inviteStatus(inv) {
    if (inv.used_by) return { label: '사용됨', ok: false };
    if (new Date(inv.expires_at) < new Date()) return { label: '만료', ok: false };
    return { label: '미사용', ok: true };
  }

  return (
    <section className="mb-8">
      <SectionHeader>초대 코드 발급</SectionHeader>
      <div className="flex gap-2 mb-4">
        <input
          type="email"
          placeholder="대상 이메일 (선택)"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <button
          onClick={handleIssue}
          disabled={issuing}
          className="px-4 py-1.5 bg-sky-500 text-white text-sm rounded hover:bg-sky-600 disabled:opacity-50"
        >
          {issuing ? '발급 중...' : '발급'}
        </button>
      </div>
      {issueError && <p className="text-sm text-red-500 mb-3">{issueError}</p>}
      {loading && <p className="text-sm text-slate-400">로딩 중...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">코드</th>
                <th className="px-4 py-2 text-left">대상 이메일</th>
                <th className="px-4 py-2 text-left">상태</th>
                <th className="px-4 py-2 text-left">만료일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-sm text-slate-400">발급된 코드 없음</td></tr>
              )}
              {invitations.map(inv => {
                const status = inviteStatus(inv);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-700">{inv.code}</td>
                    <td className="px-4 py-2 text-slate-600">{inv.intended_email ?? '—'}</td>
                    <td className="px-4 py-2"><StatusBadge ok={status.ok} label={status.label} /></td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{inv.expires_at?.slice(0, 10)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// f) 사용자 한도 조정
function QuotaSection() {
  const users = useUsers();
  const [selectedId, setSelectedId] = useState('');
  const [updateLimit, setUpdateLimit] = useState('');
  const [discoveryLimit, setDiscoveryLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  function handleSelectUser(id) {
    setSelectedId(id);
    setSaveMsg(null);
    const u = users.find(u => u.id === id);
    setUpdateLimit(String(u?.quotas?.update_limit ?? ''));
    setDiscoveryLimit(String(u?.quotas?.discovery_limit ?? ''));
  }

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const { error } = await supabase
        .from('quotas')
        .update({
          update_limit: Number(updateLimit),
          discovery_limit: Number(discoveryLimit),
        })
        .eq('user_id', selectedId);
      if (error) throw error;
      setSaveMsg({ ok: true, text: '저장되었습니다.' });
    } catch (e) {
      setSaveMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8">
      <SectionHeader>사용자 한도 조정</SectionHeader>
      <div className="flex flex-col gap-3 max-w-md">
        <select
          value={selectedId}
          onChange={e => handleSelectUser(e.target.value)}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          <option value="">사용자 선택...</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.email}</option>
          ))}
        </select>
        {selectedId && (
          <>
            <div className="flex gap-3">
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-slate-500">update 한도</span>
                <input
                  type="number"
                  min="0"
                  value={updateLimit}
                  onChange={e => setUpdateLimit(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </label>
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-slate-500">discovery 한도</span>
                <input
                  type="number"
                  min="0"
                  value={discoveryLimit}
                  onChange={e => setDiscoveryLimit(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </label>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="self-start px-4 py-1.5 bg-sky-500 text-white text-sm rounded hover:bg-sky-600 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            {saveMsg && (
              <p className={`text-sm ${saveMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{saveMsg.text}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ── 탭 메뉴 ──────────────────────────────────────────────────

const TABS = [
  { id: 'usage',   label: '사용량' },
  { id: 'cost',    label: '비용 추세' },
  { id: 'edited',  label: '자주 편집' },
  { id: 'abuse',   label: '어뷰즈' },
  { id: 'invite',  label: '초대 코드' },
  { id: 'quota',   label: '한도 조정' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('usage');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">관리자 대시보드</h1>
      <p className="text-xs text-slate-400 mb-5">
        {/* TODO: PLAN-030 완료 후 라이브러리 통계 위젯 + 라이브러리 큐레이팅 UI 추가 */}
        라이브러리 큐레이팅은 PLAN-030 완료 후 구현 예정
      </p>

      {/* 탭 바 */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'text-sky-600 border-b-2 border-sky-500'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'usage'  && <UsageSection />}
      {tab === 'cost'   && <CostTrendSection />}
      {tab === 'edited' && <TopEditedSection />}
      {tab === 'abuse'  && <AbuseSection />}
      {tab === 'invite' && <InviteSection />}
      {tab === 'quota'  && <QuotaSection />}
    </div>
  );
}
