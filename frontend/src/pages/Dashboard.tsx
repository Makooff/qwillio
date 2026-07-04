import { useEffect, useState, useRef, useCallback } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Play, Square, RefreshCw, Trash2, Search,
  Building2, Mail, Phone, Calendar, DollarSign, BarChart2, Users,
} from 'lucide-react';
import api from '../services/api';
import SlideSheet from '../components/ui/SlideSheet';
import Badge from '../components/ui/Badge';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';
import { t, tooltipStyle } from '../styles/admin-theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashStats {
  prospects: { total: number; newThisMonth: number };
  clients: { totalActive: number; newThisMonth: number; byPlan?: Record<string, number> };
  revenue: { mrr: number };
  calls: { today: number; thisWeek: number };
  bot: {
    isActive: boolean;
    callsToday: number;
    callsQuota: number;
    lastAction?: { message: string; timestamp: string } | null;
    nextAction?: { name: string; inMinutes: number } | null;
  };
  prospectsReadyToCall?: number;
  activity: any[];
}

interface Client {
  id: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  planType: string;
  subscriptionStatus: string;
  monthlyFee: number;
  createdAt: string;
}

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['Stats', 'Automatisation', 'Clients', 'Paramètres'] as const;
type Tab = typeof TABS[number];

const TRIGGERS = [
  { name: 'scrape',              label: 'Scrape Apify',        icon: '🔍' },
  { name: 'call',                label: 'Appels',              icon: '📞' },
  { name: 'ab-analysis',         label: 'A/B Analysis',        icon: '🔬' },
  { name: 'best-time',           label: 'Meilleur moment',     icon: '⏰' },
  { name: 'script-learning',     label: 'Script learning',     icon: '🧠' },
  { name: 'follow-ups',          label: 'Follow-ups',          icon: '📬' },
  { name: 'rescore',             label: 'Rescore',             icon: '⭐' },
  { name: 'seed-local-presence', label: 'Local presence',      icon: '📍' },
];

const LOG_CFG = {
  error: { color: t.danger,  bg: 'rgba(248,113,113,0.07)', tag: 'ERR' },
  warn:  { color: t.warning, bg: 'rgba(251,191,36,0.07)',  tag: 'WRN' },
  info:  { color: t.textSec, bg: 'transparent',            tag: 'INF' },
  debug: { color: t.textTer, bg: 'transparent',            tag: 'DBG' },
};

const PIE_COLORS = [t.brand, t.info, t.success, t.warning, t.danger];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';

const fmtUptime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const card = {
  background: t.panelSolid,
  border: `1px solid ${t.border}`,
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('Stats');
  const { toasts, add: toast, remove } = useToast();

  // Stats
  const [stats, setStats]           = useState<DashStats | null>(null);
  const [revenue, setRevenue]       = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [botBusy, setBotBusy]       = useState(false);

  // Automatisation
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const lastLogIdRef                = useRef(0);
  const logIntervalRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const [logLevel, setLogLevel]     = useState<string>('all');
  const [logConnected, setLogConnected] = useState(true);
  const [triggerBusy, setTriggerBusy]   = useState<string | null>(null);

  // Clients
  const [clients, setClients]           = useState<Client[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch]   = useState('');
  const [clientStatus, setClientStatus]   = useState('all');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState(false);

  // Paramètres
  const [config, setConfig]           = useState<any>(null);
  const [system, setSystem]           = useState<any>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [callsPerDay, setCallsPerDay] = useState(50);
  const [savingConfig, setSavingConfig] = useState(false);

  // ── Stats load ────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/dashboard/revenue-history').catch(() => ({ data: [] })),
      ]);
      setStats(s.data);
      setRevenue(Array.isArray(r.data) ? r.data : []);
    } catch { /* silent */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 30000);
    return () => clearInterval(id);
  }, [loadStats]);

  // ── Bot toggle ────────────────────────────────────────────────────────────

  const toggleBot = async () => {
    if (botBusy) return;
    setBotBusy(true);
    const action = stats?.bot?.isActive ? 'stop' : 'start';
    try {
      await api.post(`/admin/bot/${action}`);
      await loadStats();
    } catch { toast('Erreur bot', 'error'); }
    finally { setBotBusy(false); }
  };

  // ── Triggers ──────────────────────────────────────────────────────────────

  const runTrigger = async (name: string) => {
    setTriggerBusy(name);
    try {
      await api.post(`/prospecting/trigger/${name}`);
      toast(`${name} déclenché`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.error || `Erreur ${name}`, 'error');
    } finally { setTriggerBusy(null); }
  };

  // ── Log polling ───────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async (since?: number) => {
    try {
      const params = new URLSearchParams();
      if (since != null) params.set('since', String(since));
      if (logLevel !== 'all') params.set('level', logLevel);
      const { data } = await api.get(`/admin/logs?${params}`);
      setLogConnected(true);
      const entries: LogEntry[] = data.logs ?? [];
      if (since == null) {
        setLogs(entries);
      } else if (entries.length > 0) {
        setLogs(prev => [...prev, ...entries].slice(-300));
      }
      lastLogIdRef.current = data.lastId ?? 0;
    } catch { setLogConnected(false); }
  }, [logLevel]);

  useEffect(() => {
    if (tab !== 'Automatisation') {
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
      return;
    }
    fetchLogs(undefined);
    logIntervalRef.current = setInterval(() => fetchLogs(lastLogIdRef.current), 5000);
    return () => { if (logIntervalRef.current) clearInterval(logIntervalRef.current); };
  }, [tab, fetchLogs]);

  // ── Clients ───────────────────────────────────────────────────────────────

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    try {
      const { data } = await api.get('/admin/clients');
      setClients(Array.isArray(data) ? data : []);
      setClientsLoaded(true);
    } catch { toast('Erreur clients', 'error'); }
    finally { setClientsLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'Clients' && !clientsLoaded) loadClients();
  }, [tab, clientsLoaded, loadClients]);

  const deleteClient = async () => {
    if (!selectedClient) return;
    setDeletingClient(true);
    try {
      await api.delete(`/admin/clients/${selectedClient.id}`);
      setClients(prev => prev.filter(c => c.id !== selectedClient.id));
      setSelectedClient(null);
      toast('Client supprimé', 'success');
    } catch { toast('Erreur suppression', 'error'); }
    finally { setDeletingClient(false); }
  };

  const filteredClients = clients.filter(c => {
    const q = clientSearch.toLowerCase();
    const matchQ = !q || [c.businessName, c.contactName, c.contactEmail]
      .some(v => v?.toLowerCase().includes(q));
    const matchS = clientStatus === 'all' || c.subscriptionStatus === clientStatus;
    return matchQ && matchS;
  });

  // ── Config / System ───────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const [cfg, sys] = await Promise.all([
        api.get('/admin/bot-config'),
        api.get('/admin/system'),
      ]);
      setConfig(cfg.data);
      setSystem(sys.data);
      setCallsPerDay(cfg.data.callsPerDay ?? 50);
      setConfigLoaded(true);
    } catch { toast('Erreur config', 'error'); }
    finally { setConfigLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'Paramètres' && !configLoaded) loadConfig();
  }, [tab, configLoaded, loadConfig]);

  const saveCallsPerDay = async () => {
    setSavingConfig(true);
    try {
      await api.post('/admin/bot-config', { callsPerDay });
      toast('Sauvegardé', 'success');
    } catch { toast('Erreur sauvegarde', 'error'); }
    finally { setSavingConfig(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const active = stats?.bot?.isActive ?? false;
  const nicheData = stats?.clients?.byPlan
    ? Object.entries(stats.clients.byPlan).map(([name, value]) => ({ name, value: value as number }))
    : [];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      <ToastContainer toasts={toasts} remove={remove} />

      {/* ── Tab bar ── */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3 flex gap-1.5 overflow-x-auto scrollbar-hide"
        style={{ background: t.bg }}>
        {TABS.map(tb => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-medium transition-all"
            style={tab === tb
              ? { background: t.brand, color: '#fff' }
              : { background: t.elevated, color: t.textSec }}
          >
            {tb}
          </button>
        ))}
      </div>

      <div className="px-4 pb-28 space-y-4">

        {/* ══════════════════════════════════════════
            TAB — STATS
        ══════════════════════════════════════════ */}
        {tab === 'Stats' && (
          <>
            {/* Bot header */}
            <div className="p-4 rounded-2xl flex items-center gap-3" style={card}>
              <div className="relative w-9 h-9 flex-shrink-0">
                {active ? (
                  <>
                    <div className="absolute inset-0 rounded-full animate-spin"
                      style={{ background: 'conic-gradient(from 0deg,#6366F1,#8B5CF6,#a78bfa,#6366F1)', animationDuration: '3s' }} />
                    <div className="absolute inset-0.5 rounded-full" style={{ background: t.panelSolid }} />
                    <div className="absolute inset-1.5 rounded-full animate-pulse"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }} />
                  </>
                ) : (
                  <div className="w-9 h-9 rounded-full" style={{ background: t.elevated }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: t.text }}>Bot Qwillio</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: t.live }} />}
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: t.textSec }}>
                  {active
                    ? (stats?.bot?.lastAction?.message ?? 'En cours...')
                    : 'Inactif'}
                </p>
              </div>
              <button
                onClick={toggleBot}
                disabled={botBusy}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                style={active
                  ? { background: 'rgba(248,113,113,0.1)', color: t.danger }
                  : { background: t.brand, color: '#fff' }}
              >
                {botBusy
                  ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                  : active ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {botBusy ? '...' : active ? 'Arrêter' : 'Démarrer'}
              </button>
            </div>

            {/* KPI grid */}
            {statsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: t.panelSolid }} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Clients actifs',     value: stats?.clients?.totalActive ?? 0,        sub: `+${stats?.clients?.newThisMonth ?? 0} ce mois` },
                  { label: 'MRR',                value: `${(stats?.revenue?.mrr ?? 0).toFixed(0)}€`, sub: 'mensuel récurrent' },
                  { label: "Appels aujourd'hui", value: stats?.bot?.callsToday ?? 0,              sub: `quota: ${stats?.bot?.callsQuota ?? 50}` },
                  { label: 'Prêts à appeler',    value: stats?.prospectsReadyToCall ?? 0,         sub: 'prospects éligibles' },
                  { label: 'Cette semaine',      value: stats?.calls?.thisWeek ?? 0,              sub: 'appels totaux' },
                  { label: 'Prospects',          value: stats?.prospects?.total ?? 0,             sub: `+${stats?.prospects?.newThisMonth ?? 0} ce mois` },
                ].map((kpi, i) => (
                  <div key={i} className="p-3.5 rounded-2xl" style={card}>
                    <p className="text-[11px]" style={{ color: t.textSec }}>{kpi.label}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: t.text }}>{kpi.value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: t.textTer }}>{kpi.sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Revenue chart */}
            {revenue.length > 0 && (
              <div className="p-4 rounded-2xl" style={card}>
                <p className="text-xs font-semibold mb-3" style={{ color: t.text }}>Évolution MRR</p>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenue}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={t.brand} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={t.brand} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: t.textSec }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: t.textSec }} axisLine={false} tickLine={false} width={36}
                        tickFormatter={v => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}€`} />
                      <Tooltip contentStyle={tooltipStyle}
                        formatter={(v: any) => [`${Number(v).toLocaleString()}€`, 'MRR']} />
                      <Area type="monotone" dataKey="revenue" stroke={t.brand}
                        strokeWidth={2} fill="url(#revGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Plans pie */}
            {nicheData.length > 0 && (
              <div className="p-4 rounded-2xl" style={card}>
                <p className="text-xs font-semibold mb-3" style={{ color: t.text }}>Clients par plan</p>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={nicheData} cx="50%" cy="50%"
                          innerRadius={28} outerRadius={40} dataKey="value" strokeWidth={0}>
                          {nicheData.map((_: any, i: number) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {nicheData.map((d: any, i: number) => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-xs capitalize" style={{ color: t.textSec }}>{d.name}</span>
                        </div>
                        <span className="text-xs font-medium" style={{ color: t.text }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Activity feed */}
            {(stats?.activity?.length ?? 0) > 0 && (
              <div className="rounded-2xl overflow-hidden" style={card}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                  <p className="text-xs font-semibold" style={{ color: t.text }}>Activité récente</p>
                </div>
                {stats!.activity.slice(0, 8).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < 7 ? `1px solid ${t.border}` : 'none' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: t.elevated }}>
                      <div className="w-1.5 h-1.5 rounded-full"
                        style={{ background: t.brand, opacity: Math.max(0.2, 1 - i * 0.1) }} />
                    </div>
                    <p className="flex-1 text-xs truncate" style={{ color: t.text }}>
                      {a.description || a.message || a.type || '—'}
                    </p>
                    <span className="text-[10px] flex-shrink-0" style={{ color: t.textTer }}>
                      {fmtDate(a.createdAt || a.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            TAB — AUTOMATISATION
        ══════════════════════════════════════════ */}
        {tab === 'Automatisation' && (
          <>
            {/* Bot control */}
            <div className="p-5 rounded-2xl" style={card}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: t.text }}>Bot Qwillio</p>
                  <p className="text-xs mt-0.5" style={{ color: t.textSec }}>
                    {active
                      ? `${stats?.bot?.callsToday ?? 0} / ${stats?.bot?.callsQuota ?? 50} appels`
                      : 'Inactif'}
                  </p>
                </div>
                <button
                  onClick={toggleBot}
                  disabled={botBusy}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={active
                    ? { background: 'rgba(248,113,113,0.1)', color: t.danger, border: `1px solid rgba(248,113,113,0.2)` }
                    : { background: t.brand, color: '#fff' }}
                >
                  {botBusy
                    ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : active ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {botBusy ? '...' : active ? 'Stopper' : 'Démarrer'}
                </button>
              </div>
              {/* Progress bar */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[10px]" style={{ color: t.textTer }}>Quota journalier</span>
                  <span className="text-[10px] font-medium" style={{ color: t.textSec }}>
                    {stats?.bot?.callsToday ?? 0}/{stats?.bot?.callsQuota ?? 50}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: t.elevated }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((stats?.bot?.callsToday ?? 0) / (stats?.bot?.callsQuota ?? 50)) * 100)}%`,
                      background: 'linear-gradient(90deg,#6366F1,#8B5CF6)',
                    }} />
                </div>
              </div>
            </div>

            {/* Triggers grid */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-0.5"
                style={{ color: t.textTer }}>Déclencheurs manuels</p>
              <div className="grid grid-cols-2 gap-2.5">
                {TRIGGERS.map(tr => (
                  <button
                    key={tr.name}
                    onClick={() => runTrigger(tr.name)}
                    disabled={triggerBusy !== null}
                    className="flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all hover:opacity-80 disabled:opacity-40"
                    style={card}
                  >
                    <span className="text-lg leading-none">{tr.icon}</span>
                    <div className="min-w-0 flex-1">
                      {triggerBusy === tr.name && (
                        <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin mb-1"
                          style={{ color: t.brand }} />
                      )}
                      <p className="text-xs font-medium leading-tight" style={{ color: t.text }}>
                        {tr.label}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Live logs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: t.textTer }}>Logs live</p>
                  <span className="flex items-center gap-1 text-[9px]"
                    style={{ color: logConnected ? t.live : t.danger }}>
                    <span className="w-1.5 h-1.5 rounded-full"
                      style={{ background: logConnected ? t.live : t.danger }} />
                    {logConnected ? '5s' : 'off'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {(['all', 'info', 'warn', 'error'] as const).map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setLogLevel(lvl)}
                      className="px-2 py-0.5 rounded-full text-[9px] font-medium transition-all"
                      style={logLevel === lvl
                        ? { background: t.borderHi, color: t.text }
                        : { color: t.textTer }}
                    >
                      {lvl}
                    </button>
                  ))}
                  <button
                    onClick={async () => {
                      await api.delete('/admin/logs');
                      setLogs([]);
                      lastLogIdRef.current = 0;
                    }}
                    className="p-1 rounded-lg hover:opacity-80 transition-opacity ml-1"
                    style={{ color: t.textTer }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden font-mono" style={{ ...card, background: '#0d0d0f' }}>
                <div className="max-h-72 overflow-y-auto text-[11px]">
                  {logs.length === 0 ? (
                    <p className="text-center py-8" style={{ color: t.textTer }}>Aucun log</p>
                  ) : (
                    [...logs].reverse().map(log => {
                      const cfg = LOG_CFG[log.level] ?? LOG_CFG.info;
                      return (
                        <div key={log.id}
                          className="flex items-start gap-2 px-3 py-1.5"
                          style={{ borderBottom: `1px solid rgba(255,255,255,0.03)`, background: cfg.bg }}>
                          <span className="flex-shrink-0 w-7 text-[9px] font-bold" style={{ color: cfg.color }}>
                            {cfg.tag}
                          </span>
                          <span className="flex-shrink-0 text-[9px] tabular-nums" style={{ color: t.textMuted }}>
                            {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                          </span>
                          <span className="flex-1 break-all leading-relaxed"
                            style={{ color: log.level === 'error' ? t.danger : log.level === 'warn' ? t.warning : t.textSec }}>
                            {log.message}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            TAB — CLIENTS
        ══════════════════════════════════════════ */}
        {tab === 'Clients' && (
          <>
            {/* Search + filter bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: t.textSec }} />
                <input
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none"
                  style={{ ...card, color: t.text }}
                />
              </div>
              <select
                value={clientStatus}
                onChange={e => setClientStatus(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm focus:outline-none"
                style={{ ...card, color: t.textSec }}
              >
                {['all', 'active', 'trial', 'paused', 'cancelled'].map(s => (
                  <option key={s} value={s}>{s === 'all' ? 'Tous' : s}</option>
                ))}
              </select>
              <button
                onClick={loadClients}
                className="p-2 rounded-xl flex-shrink-0 hover:opacity-80 transition-opacity"
                style={card}
              >
                <RefreshCw className="w-4 h-4" style={{ color: t.textSec }} />
              </button>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {clientsLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: t.panelSolid }} />
                  ))
                : filteredClients.length === 0
                  ? <p className="text-center py-8 text-sm" style={{ color: t.textSec }}>Aucun client</p>
                  : filteredClients.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedClient(c)}
                        className="w-full text-left p-4 rounded-2xl hover:opacity-80 transition-opacity"
                        style={card}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: t.text }}>{c.businessName}</p>
                            <p className="text-xs truncate mt-0.5" style={{ color: t.textSec }}>{c.contactEmail}</p>
                          </div>
                          <div className="flex-shrink-0 ml-3">
                            <Badge label={c.subscriptionStatus} />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] capitalize" style={{ color: t.textTer }}>{c.planType}</span>
                          <span className="text-[10px]" style={{ color: t.textTer }}>{c.monthlyFee}€/mois</span>
                          <span className="text-[10px]" style={{ color: t.textTer }}>{fmtDate(c.createdAt)}</span>
                        </div>
                      </button>
                    ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block rounded-2xl overflow-hidden" style={card}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      {['Entreprise', 'Contact', 'Email', 'Plan', 'Statut', 'Mensualité', 'Créé le'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wide"
                          style={{ color: t.textSec }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientsLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            <td colSpan={7} className="px-4 py-3">
                              <div className="h-4 animate-pulse rounded" style={{ background: t.elevated }} />
                            </td>
                          </tr>
                        ))
                      : filteredClients.map(c => (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedClient(c)}
                            className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                            style={{ borderBottom: `1px solid ${t.border}` }}
                          >
                            <td className="px-4 py-3.5 text-xs font-medium" style={{ color: t.text }}>{c.businessName}</td>
                            <td className="px-4 py-3.5 text-xs" style={{ color: t.textSec }}>{c.contactName}</td>
                            <td className="px-4 py-3.5 text-xs" style={{ color: t.textSec }}>{c.contactEmail}</td>
                            <td className="px-4 py-3.5 text-xs capitalize" style={{ color: t.textSec }}>{c.planType}</td>
                            <td className="px-4 py-3.5"><Badge label={c.subscriptionStatus} /></td>
                            <td className="px-4 py-3.5 text-xs font-medium" style={{ color: t.text }}>{c.monthlyFee}€</td>
                            <td className="px-4 py-3.5 text-xs" style={{ color: t.textTer }}>{fmtDate(c.createdAt)}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
                {!clientsLoading && filteredClients.length === 0 && (
                  <p className="text-center py-8 text-sm" style={{ color: t.textSec }}>Aucun client</p>
                )}
              </div>
            </div>

            {/* SlideSheet — client detail */}
            <SlideSheet
              open={!!selectedClient}
              onClose={() => setSelectedClient(null)}
              title={selectedClient?.businessName ?? ''}
              subtitle={selectedClient?.planType}
            >
              {selectedClient && (
                <div className="space-y-5">
                  {[
                    { icon: <Building2 className="w-4 h-4" />, label: 'Entreprise', value: selectedClient.businessName },
                    { icon: <Users className="w-4 h-4" />,     label: 'Contact',    value: selectedClient.contactName },
                    { icon: <Mail className="w-4 h-4" />,      label: 'Email',      value: selectedClient.contactEmail },
                    { icon: <Phone className="w-4 h-4" />,     label: 'Téléphone',  value: selectedClient.contactPhone || '—' },
                    { icon: <DollarSign className="w-4 h-4" />,label: 'Mensualité', value: `${selectedClient.monthlyFee}€/mois` },
                    { icon: <Calendar className="w-4 h-4" />,  label: 'Créé le',    value: fmtDate(selectedClient.createdAt) },
                  ].map(row => (
                    <div key={row.label} className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0" style={{ color: t.textSec }}>{row.icon}</div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: t.textTer }}>{row.label}</p>
                        <p className="text-sm" style={{ color: t.text }}>{row.value}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0" style={{ color: t.textSec }}><BarChart2 className="w-4 h-4" /></div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: t.textTer }}>Statut</p>
                      <Badge label={selectedClient.subscriptionStatus} />
                    </div>
                  </div>
                  <div className="pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
                    <button
                      onClick={() => {
                        if (!confirm(`Supprimer ${selectedClient.businessName} ?`)) return;
                        deleteClient();
                      }}
                      disabled={deletingClient}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      style={{
                        background: 'rgba(248,113,113,0.1)',
                        color: t.danger,
                        border: `1px solid rgba(248,113,113,0.2)`,
                      }}
                    >
                      {deletingClient ? 'Suppression...' : 'Supprimer le client'}
                    </button>
                  </div>
                </div>
              )}
            </SlideSheet>
          </>
        )}

        {/* ══════════════════════════════════════════
            TAB — PARAMÈTRES
        ══════════════════════════════════════════ */}
        {tab === 'Paramètres' && (
          <>
            {/* Calls per day */}
            <div className="p-4 rounded-2xl" style={card}>
              <p className="text-sm font-semibold mb-3" style={{ color: t.text }}>Appels par jour</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={callsPerDay}
                  onChange={e => setCallsPerDay(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-xl text-sm text-center focus:outline-none"
                  style={{ background: t.elevated, border: `1px solid ${t.borderHi}`, color: t.text }}
                />
                <button
                  onClick={saveCallsPerDay}
                  disabled={savingConfig}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: t.brand, color: '#fff' }}
                >
                  {savingConfig ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </div>

            {/* Config read-only */}
            {configLoading ? (
              <div className="h-40 rounded-2xl animate-pulse" style={{ background: t.panelSolid }} />
            ) : config ? (
              <div className="p-4 rounded-2xl" style={card}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                  style={{ color: t.textSec }}>Configuration bot</p>
                <div className="space-y-3">
                  {[
                    { label: 'Heures actives', value: `${config.startHour}h – ${config.endHour}h` },
                    { label: 'Intervalle',      value: `${Math.round(config.callIntervalSeconds / 60)} min` },
                    { label: 'Jours actifs',   value: config.activeDays || '—' },
                    { label: 'Modèle IA',      value: config.vapiModel || '—' },
                    { label: 'Timezone',       value: config.timezone || '—' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: t.textSec }}>{row.label}</span>
                      <span className="text-xs font-medium" style={{ color: t.text }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* System */}
            {system && (
              <div className="p-4 rounded-2xl" style={card}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                  style={{ color: t.textSec }}>Système</p>
                <div className="space-y-3">
                  {[
                    { label: 'Base de données', value: system.db === 'connected' ? '✅ Connectée' : '❌ Erreur' },
                    { label: 'Prospects',       value: (system.prospects ?? 0).toLocaleString() },
                    { label: 'Clients',         value: `${system.clients ?? 0}` },
                    { label: 'Appels',          value: (system.calls ?? 0).toLocaleString() },
                    { label: 'Uptime',          value: fmtUptime(system.uptime ?? 0) },
                    { label: 'Node',            value: system.nodeVersion || '—' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: t.textSec }}>{row.label}</span>
                      <span className="text-xs font-medium" style={{ color: t.text }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
