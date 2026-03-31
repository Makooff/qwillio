import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Zap, Phone, Search, TrendingUp, TrendingDown,
  Clock, AlertCircle, CheckCircle, Users, Flame, Target, Mail,
  ChevronUp, ChevronDown, Play,
} from 'lucide-react';
import api from '../../services/api';

// ─── Types ────────────────────────────────────────────────
interface EngineStatus {
  totalProspects: number;
  eligibleProspects: number;
  pendingFollowUps: number;
  activeAbTests: number;
  recentMutations: number;
  localPresenceNumbers: number;
}

interface AbTest {
  id: string;
  niche: string;
  language: string;
  variantA: string;
  variantB: string;
  callsA: number;
  conversionsA: number;
  callsB: number;
  conversionsB: number;
  winner: string | null;
  decidedAt: string | null;
  active: boolean;
  createdAt: string;
}

interface Mutation {
  id: string;
  niche: string;
  language: string;
  type: string;
  changeApplied: string;
  reason: string;
  callsBefore: number;
  conversionBefore: number;
  callsAfter: number;
  conversionAfter: number | null;
  status: 'testing' | 'validated' | 'reverted';
  confidenceScore: number | null;
  createdAt: string;
}

interface Prospect {
  id: string;
  businessName: string;
  niche: string | null;
  businessType: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  priorityScore: number;
  score: number;
  status: string;
  callAttempts: number;
  isMobile: boolean;
  eligibleForCall: boolean;
  googleRating: number | null;
  googleReviewsCount: number | null;
  lastCallDate: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────
const token = () => localStorage.getItem('token') || '';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    new: 'bg-slate-100 text-slate-600',
    contacted: 'bg-blue-100 text-blue-700',
    interested: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    exhausted: 'bg-orange-100 text-orange-700',
    qualified: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function mutationBadge(status: string) {
  if (status === 'validated') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><TrendingUp size={11} />Validated</span>;
  if (status === 'reverted')  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><TrendingDown size={11} />Reverted</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock size={11} />Testing</span>;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ConvBar({ rate, color }: { rate: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-[#f5f5f7] rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${Math.min(100, rate * 5)}%` }} />
      </div>
      <span className="text-xs text-[#86868b] w-10">{(rate * 100).toFixed(1)}%</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────
export default function Prospecting() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [abTests, setAbTests]           = useState<AbTest[]>([]);
  const [mutations, setMutations]       = useState<Mutation[]>([]);
  const [prospects, setProspects]       = useState<Prospect[]>([]);
  const [loading, setLoading]           = useState(true);

  // Trigger states
  const [triggering, setTriggering]     = useState<string | null>(null);
  const [triggerMsg, setTriggerMsg]     = useState<string | null>(null);

  // Prospect filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterNiche, setFilterNiche]   = useState('');
  const [sortField, setSortField]       = useState<'priorityScore' | 'callAttempts' | 'createdAt'>('priorityScore');
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('desc');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, abRes, mutRes, prospectsRes] = await Promise.all([
        api.get('/prospecting/status'),
        api.get('/prospecting/ab-tests'),
        api.get('/prospecting/mutations'),
        api.get('/prospects?limit=50&orderBy=priorityScore&order=desc'),
      ]);
      setEngineStatus(statusRes.data);
      setAbTests(abRes.data || []);
      setMutations((mutRes.data || []).slice(0, 15));
      setProspects(prospectsRes.data?.prospects || prospectsRes.data || []);
    } catch (err) {
      console.error('Prospecting fetch error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const trigger = async (key: string, endpoint: string, label: string) => {
    setTriggering(key);
    setTriggerMsg(null);
    try {
      const res = await api.post(`/prospecting/trigger/${endpoint}`);
      const d = res.data;
      const msg = d.prospectsAdded != null ? `✓ ${d.prospectsAdded} prospects added`
        : d.called != null ? (d.called ? '✓ Call initiated' : '✓ No eligible prospect right now')
        : d.sent != null   ? `✓ ${d.sent} follow-ups sent`
        : d.updated != null ? `✓ ${d.updated} prospects re-scored`
        : `✓ ${label} done`;
      setTriggerMsg(msg);
      fetchAll();
    } catch (err: any) {
      setTriggerMsg(`✗ Error: ${err?.response?.data?.error || err.message}`);
    }
    setTriggering(null);
    setTimeout(() => setTriggerMsg(null), 5000);
  };

  // ── Filtered/sorted prospects ─────────────────────────
  const filteredProspects = prospects
    .filter(p => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterNiche && (p.niche ?? p.businessType) !== filterNiche) return false;
      return true;
    })
    .sort((a, b) => {
      const v = sortDir === 'desc' ? -1 : 1;
      if (sortField === 'priorityScore') return v * (b.priorityScore - a.priorityScore);
      if (sortField === 'callAttempts')  return v * (b.callAttempts - a.callAttempts);
      return v * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });

  const niches = [...new Set(prospects.map(p => p.niche ?? p.businessType).filter(Boolean))];
  const hotLeads = prospects.filter(p => p.status === 'interested').slice(0, 5);

  function SortBtn({ field }: { field: typeof sortField }) {
    const active = sortField === field;
    return (
      <button
        className="inline-flex items-center gap-0.5 hover:text-[#6366f1]"
        onClick={() => { setSortField(field); setSortDir(d => active ? (d === 'desc' ? 'asc' : 'desc') : 'desc'); }}
      >
        {field === 'priorityScore' ? 'Score' : field === 'callAttempts' ? 'Attempts' : 'Added'}
        {active ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : <ChevronDown size={12} className="opacity-30" />}
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1d1d1f]">Prospecting Engine</h1>
          <p className="text-sm text-[#86868b] mt-1">
            Apify scraping · Priority scoring · Local presence · A/B testing · Script self-learning
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {triggerMsg && (
            <span className={`text-sm px-3 py-1.5 rounded-lg font-medium ${triggerMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {triggerMsg}
            </span>
          )}
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#d2d2d7] text-sm hover:bg-[#f5f5f7] transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => trigger('scrape', 'scrape', 'Scraping')}
            disabled={!!triggering}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1d1d1f] text-white text-sm hover:bg-black transition-colors disabled:opacity-50"
          >
            {triggering === 'scrape' ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            Scrape Now
          </button>
          <button
            onClick={() => trigger('call', 'call', 'Outbound call')}
            disabled={!!triggering}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#6366f1] text-white text-sm hover:bg-[#4f46e5] transition-colors disabled:opacity-50"
          >
            {triggering === 'call' ? <RefreshCw size={14} className="animate-spin" /> : <Phone size={14} />}
            Call Next
          </button>
          <button
            onClick={() => trigger('rescore', 'rescore', 'Rescore')}
            disabled={!!triggering}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#d2d2d7] text-sm hover:bg-[#f5f5f7] transition-colors disabled:opacity-50"
          >
            {triggering === 'rescore' ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
            Re-score
          </button>
          <button
            onClick={() => trigger('followups', 'follow-ups', 'Follow-ups')}
            disabled={!!triggering}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#d2d2d7] text-sm hover:bg-[#f5f5f7] transition-colors disabled:opacity-50"
          >
            {triggering === 'followups' ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
            Follow-ups
          </button>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Prospects', value: engineStatus?.totalProspects ?? 0, icon: Users, color: 'text-[#1d1d1f]', bg: 'bg-slate-50' },
          { label: 'Eligible (score ≥ 10)', value: engineStatus?.eligibleProspects ?? 0, icon: Target, color: 'text-[#6366f1]', bg: 'bg-indigo-50' },
          { label: 'Hot Leads', value: hotLeads.length, icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Pending Follow-ups', value: engineStatus?.pendingFollowUps ?? 0, icon: Mail, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#d2d2d7] p-5 flex items-center gap-4">
            <div className={`${card.bg} p-3 rounded-lg`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-xs text-[#86868b]">{card.label}</p>
              <p className={`text-3xl font-bold mt-0.5 ${card.color}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Secondary stats row ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Active A/B Tests', value: engineStatus?.activeAbTests ?? 0, color: 'text-blue-600' },
          { label: 'Script Mutations (testing)', value: engineStatus?.recentMutations ?? 0, color: 'text-yellow-600' },
          { label: 'Local Presence Numbers', value: engineStatus?.localPresenceNumbers ?? 0, color: 'text-purple-600' },
        ].map((c, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#d2d2d7] p-4">
            <p className="text-xs text-[#86868b] mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Hot Leads + A/B Tests (side by side) ─────────── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Hot Leads */}
        <div className="bg-white rounded-xl border border-[#d2d2d7]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#d2d2d7]">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-[#1d1d1f]">Hot Leads</h2>
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">{hotLeads.length}</span>
            </div>
          </div>
          {hotLeads.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-[#86868b]">
              <AlertCircle size={28} className="opacity-30" />
              <p className="text-sm">No hot leads yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#d2d2d7]/60">
              {hotLeads.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-[#f5f5f7] transition-colors">
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1f]">{p.businessName}</p>
                    <p className="text-xs text-[#86868b] mt-0.5">{p.niche ?? p.businessType} · {p.city}{p.state ? `, ${p.state}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-[#f5f5f7] text-[#86868b] px-2 py-1 rounded font-mono">{p.phone}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                      <Flame size={10} /> {p.priorityScore || p.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* A/B Tests */}
        <div className="bg-white rounded-xl border border-[#d2d2d7]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#d2d2d7]">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-[#6366f1]" />
              <h2 className="text-sm font-semibold text-[#1d1d1f]">A/B Script Tests</h2>
              <span className="text-xs bg-indigo-100 text-[#6366f1] px-2 py-0.5 rounded-full font-medium">{abTests.length} active</span>
            </div>
          </div>
          {abTests.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-[#86868b]">
              <AlertCircle size={28} className="opacity-30" />
              <p className="text-sm">No active A/B tests</p>
            </div>
          ) : (
            <div className="divide-y divide-[#d2d2d7]/60">
              {abTests.map(t => {
                const rateA = t.callsA > 0 ? t.conversionsA / t.callsA : 0;
                const rateB = t.callsB > 0 ? t.conversionsB / t.callsB : 0;
                const aWins = rateA >= rateB;
                return (
                  <div key={t.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#1d1d1f] capitalize">{t.niche}</span>
                        <span className="text-xs uppercase text-[#6366f1] font-medium">{t.language}</span>
                      </div>
                      {t.winner && (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle size={12} /> Winner: {t.winner}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs w-4 font-bold ${aWins ? 'text-green-600' : 'text-[#86868b]'}`}>A</span>
                        <ConvBar rate={rateA} color={aWins ? 'bg-green-500' : 'bg-[#d2d2d7]'} />
                        <span className="text-xs text-[#86868b]">{t.callsA} calls</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs w-4 font-bold ${!aWins ? 'text-green-600' : 'text-[#86868b]'}`}>B</span>
                        <ConvBar rate={rateB} color={!aWins ? 'bg-[#6366f1]' : 'bg-[#d2d2d7]'} />
                        <span className="text-xs text-[#86868b]">{t.callsB} calls</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Script Mutations ─────────────────────────────── */}
      {mutations.length > 0 && (
        <div className="bg-white rounded-xl border border-[#d2d2d7]">
          <div className="px-5 py-4 border-b border-[#d2d2d7] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#6366f1]" />
            <h2 className="text-sm font-semibold text-[#1d1d1f]">Script Mutations</h2>
            <span className="text-xs bg-[#f5f5f7] text-[#86868b] px-2 py-0.5 rounded-full">{mutations.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f5f5f7] border-b border-[#d2d2d7]">
                <tr>
                  {['Date', 'Niche', 'Lang', 'Stage', 'Change', 'Conv Before→After', 'Confidence', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-[#86868b] text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d2d2d7]/60">
                {mutations.map(m => (
                  <tr key={m.id} className="hover:bg-[#f5f5f7] transition-colors">
                    <td className="px-4 py-3 text-[#86868b] whitespace-nowrap text-xs">{fmtDate(m.createdAt)}</td>
                    <td className="px-4 py-3 font-medium capitalize text-sm">{m.niche}</td>
                    <td className="px-4 py-3 uppercase text-xs font-medium text-[#6366f1]">{m.language}</td>
                    <td className="px-4 py-3 text-xs text-[#86868b]">{m.type}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate text-xs text-[#1d1d1f]" title={m.changeApplied}>{m.changeApplied}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <span className="text-[#86868b]">{(m.conversionBefore * 100).toFixed(1)}%</span>
                      <span className="mx-1 text-[#86868b]">→</span>
                      {m.conversionAfter != null ? (
                        <span className={m.conversionAfter > m.conversionBefore ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {(m.conversionAfter * 100).toFixed(1)}%
                        </span>
                      ) : <span className="text-[#86868b]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {m.confidenceScore != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-[#f5f5f7] rounded-full h-1.5">
                            <div className="bg-[#6366f1] h-1.5 rounded-full" style={{ width: `${m.confidenceScore}%` }} />
                          </div>
                          <span className="text-xs text-[#86868b]">{m.confidenceScore}%</span>
                        </div>
                      ) : <span className="text-xs text-[#86868b]">—</span>}
                    </td>
                    <td className="px-4 py-3">{mutationBadge(m.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Prospects table ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#d2d2d7]">
        <div className="px-5 py-4 border-b border-[#d2d2d7] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#6366f1]" />
            <h2 className="text-sm font-semibold text-[#1d1d1f]">Prospects</h2>
            <span className="text-xs bg-[#f5f5f7] text-[#86868b] px-2 py-0.5 rounded-full">{filteredProspects.length}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-[#d2d2d7] rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
            >
              <option value="">All statuses</option>
              {['new','contacted','interested','rejected','exhausted','qualified'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterNiche}
              onChange={e => setFilterNiche(e.target.value)}
              className="border border-[#d2d2d7] rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
            >
              <option value="">All niches</option>
              {niches.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {filteredProspects.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-[#86868b]">
            <AlertCircle size={32} className="opacity-30" />
            <p className="text-sm">No prospects yet. Click <strong>Scrape Now</strong> to start.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f5f5f7] border-b border-[#d2d2d7]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-[#86868b] text-xs uppercase tracking-wide">Business</th>
                  <th className="text-left px-4 py-3 font-medium text-[#86868b] text-xs uppercase tracking-wide">Niche</th>
                  <th className="text-left px-4 py-3 font-medium text-[#86868b] text-xs uppercase tracking-wide">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-[#86868b] text-xs uppercase tracking-wide cursor-pointer">
                    <SortBtn field="priorityScore" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[#86868b] text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-[#86868b] text-xs uppercase tracking-wide cursor-pointer">
                    <SortBtn field="callAttempts" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[#86868b] text-xs uppercase tracking-wide">Rating</th>
                  <th className="text-left px-4 py-3 font-medium text-[#86868b] text-xs uppercase tracking-wide cursor-pointer">
                    <SortBtn field="createdAt" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d2d2d7]/60">
                {filteredProspects.slice(0, 50).map(p => (
                  <tr key={p.id} className="hover:bg-[#f5f5f7] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1d1d1f] text-sm truncate max-w-[180px]">{p.businessName}</p>
                      <p className="text-xs text-[#86868b] font-mono mt-0.5">{p.phone ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-xs text-[#86868b]">{p.niche ?? p.businessType}</td>
                    <td className="px-4 py-3 text-xs text-[#86868b] whitespace-nowrap">{p.city}{p.state ? `, ${p.state}` : ''}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center font-bold text-sm px-2 py-0.5 rounded-lg ${
                        (p.priorityScore || p.score) >= 15 ? 'bg-green-50 text-green-700' :
                        (p.priorityScore || p.score) >= 10 ? 'bg-blue-50 text-blue-700' :
                        'bg-[#f5f5f7] text-[#86868b]'
                      }`}>
                        {p.priorityScore || p.score}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-medium ${p.callAttempts >= 2 ? 'text-orange-600' : 'text-[#86868b]'}`}>
                        {p.callAttempts}/3
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#86868b] whitespace-nowrap">
                      {p.googleRating ? (
                        <span className="flex items-center gap-1">
                          ⭐ {p.googleRating.toFixed(1)}
                          {p.googleReviewsCount ? <span className="text-[#86868b]">({p.googleReviewsCount})</span> : null}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#86868b] whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
