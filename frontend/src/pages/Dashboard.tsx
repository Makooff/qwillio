import { useEffect, useState, useCallback } from 'react';
import {
  Bot, Play, Pause, RefreshCw, AlertCircle,
  Activity, Zap, Users, DollarSign, Phone,
  TrendingUp, CheckCircle, AlertTriangle,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { pro, proShadow } from '../styles/pro-theme';
import {
  Card, PageHeader, Stat, SectionHead, PrimaryBtn, GhostBtn, Pill,
} from '../components/pro/ProBlocks';

const API = import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com';

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BotStatus {
  isActive: boolean;
  callsToday: number;
  callsQuota: number;
  eligibleProspects: number;
}

interface DashStats {
  prospects: { total: number; newThisMonth: number };
  clients: { totalActive: number };
  revenue: { mrr: number };
  hotLeads: number;
}

interface ActivityItem {
  id: string;
  type: string;
  message?: string;
  description?: string;
  createdAt?: string;
  timestamp?: string;
}

interface CallDay {
  date: string;
  calls: number;
}

interface Anomaly {
  id: string;
  metric: string;
  severity: string;
  diagnosis: string | null;
}

type PillColor = 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'neutral';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard({ h = 'h-24' }: { h?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl ${h}`}
      style={{ background: pro.panel, border: `1px solid ${pro.border}` }}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [botStatus, setBotStatus]   = useState<BotStatus | null>(null);
  const [stats, setStats]           = useState<DashStats | null>(null);
  const [activity, setActivity]     = useState<ActivityItem[]>([]);
  const [callsChart, setCallsChart] = useState<CallDay[]>([]);
  const [anomalies, setAnomalies]   = useState<Anomaly[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [busy, setBusy]             = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        fetch(`${API}/api/bot/status`,            { headers: getHeaders() }),
        fetch(`${API}/api/dashboard/stats`,        { headers: getHeaders() }),
        fetch(`${API}/api/bot/activity?limit=8`,   { headers: getHeaders() }),
        fetch(`${API}/api/dashboard/calls-chart`,  { headers: getHeaders() }),
        fetch(`${API}/api/ai-agents/anomalies`,    { headers: getHeaders() }),
      ]);

      const [botRes, statsRes, actRes, chartRes, anomRes] = results;

      if (botRes.status === 'fulfilled' && botRes.value.ok) {
        setBotStatus(await botRes.value.json());
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        setStats(await statsRes.value.json());
      }
      if (actRes.status === 'fulfilled' && actRes.value.ok) {
        const d = await actRes.value.json();
        setActivity(Array.isArray(d) ? d : d.items ?? []);
      }
      if (chartRes.status === 'fulfilled' && chartRes.value.ok) {
        const d = await chartRes.value.json();
        setCallsChart(Array.isArray(d) ? d : d.data ?? []);
      }
      if (anomRes.status === 'fulfilled' && anomRes.value.ok) {
        const d = await anomRes.value.json();
        setAnomalies(Array.isArray(d) ? d : d.anomalies ?? []);
      }

      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const toggleBot = async () => {
    if (!botStatus) return;
    setBusy(true);
    const action = botStatus.isActive ? 'stop' : 'start';
    try {
      const r = await fetch(`${API}/api/bot/${action}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!r.ok) {
        const err: unknown = await r.json().catch(() => ({}));
        const msg = (err as Record<string, string>).error ?? 'Échec';
        alert(`Erreur ${r.status}: ${msg}`);
      }
    } catch (e: unknown) {
      alert(`Erreur réseau : ${e instanceof Error ? e.message : 'inconnu'}`);
    }
    await load();
    setBusy(false);
  };

  const quickAction = async (label: string, endpoint: string) => {
    setActionBusy(label);
    try {
      const r = await fetch(`${API}/api/${endpoint}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!r.ok) alert(`Erreur ${r.status}`);
    } catch { /* silent */ }
    setActionBusy(null);
    await load();
  };

  if (loading) {
    return (
      <div className="space-y-4 admin-page">
        <SkeletonCard h="h-32" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <SkeletonCard h="h-52" />
          <SkeletonCard h="h-52" />
        </div>
      </div>
    );
  }

  if (error && !botStatus && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <AlertCircle className="w-9 h-9 mb-3" style={{ color: pro.bad }} />
        <p className="text-sm mb-4" style={{ color: pro.textSec }}>{error}</p>
        <PrimaryBtn onClick={load}>Réessayer</PrimaryBtn>
      </div>
    );
  }

  const active  = botStatus?.isActive ?? false;
  const quota   = botStatus?.callsQuota ?? 50;
  const calls   = botStatus?.callsToday ?? 0;
  const pct     = quota > 0 ? Math.min(100, Math.round((calls / quota) * 100)) : 0;
  const barColor = pct > 90 ? pro.bad : pct > 70 ? pro.warn : pro.accent;

  const severityColor = (s: string): PillColor => {
    const v = s.toLowerCase();
    if (v === 'critical' || v === 'high') return 'bad';
    if (v === 'medium') return 'warn';
    return 'info';
  };

  const fmtRelative = (iso?: string) => {
    if (!iso) return '';
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
    } catch {
      return '';
    }
  };

  const activityIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('call') || t.includes('appel')) return Phone;
    if (t.includes('lead'))  return Zap;
    if (t.includes('client')) return Users;
    if (t.includes('bot'))   return Bot;
    return Activity;
  };

  // Latest activity timestamp for "last updated" display
  const latestTs = activity[0]?.createdAt ?? activity[0]?.timestamp;

  return (
    <div className="space-y-4 admin-page">

      {/* ── Row 1: Bot status hero ────────────────────────────────────────── */}
      <div className="mb-5">
        <Card glow={active}>
          <div className="p-5">
            <div className="flex items-start gap-4">
              {/* Status icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                  boxShadow: active ? `0 0 20px ${pro.okGlow}` : undefined,
                }}
              >
                <Bot size={20} style={{ color: active ? pro.ok : pro.textSec }} />
              </div>

              {/* Main status + numbers */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: active ? pro.ok : pro.textTer,
                        boxShadow: active ? `0 0 6px ${pro.ok}` : undefined,
                        animation: active ? 'dash-pulse 1.4s ease infinite' : undefined,
                      }}
                    />
                    <span className="text-[15px] font-semibold" style={{ color: pro.text }}>
                      {active ? 'BOT ACTIF' : 'BOT INACTIF'}
                    </span>
                  </div>

                  {/* 3 key numbers inline */}
                  <div className="flex flex-wrap gap-4 ml-2">
                    <span className="text-[12px]" style={{ color: pro.textSec }}>
                      <span className="font-semibold tabular-nums" style={{ color: pro.text }}>{calls}</span>
                      {' '}appels aujourd'hui
                    </span>
                    <span className="text-[12px]" style={{ color: pro.textSec }}>
                      <span className="font-semibold tabular-nums" style={{ color: pro.text }}>
                        {botStatus?.eligibleProspects ?? '—'}
                      </span>
                      {' '}prospects éligibles
                    </span>
                    <span className="text-[12px]" style={{ color: pro.textSec }}>
                      <span className="font-semibold tabular-nums" style={{ color: barColor }}>
                        {quota - calls}
                      </span>
                      {' '}quota restant
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
                <p className="text-[10.5px] tabular-nums" style={{ color: pro.textTer }}>
                  {calls} / {quota} appels ({pct}%)
                </p>
              </div>

              {/* Toggle button */}
              <button
                onClick={toggleBot}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-[12.5px] font-semibold transition-all disabled:opacity-40 flex-shrink-0 cursor-pointer"
                style={{
                  background:  active ? 'rgba(239,68,68,0.10)' : pro.accentGrad,
                  color:       active ? pro.bad : '#fff',
                  border:      active ? `1px solid rgba(239,68,68,0.28)` : 'none',
                  boxShadow:   active ? undefined : proShadow.btn,
                }}
              >
                {busy ? '…' : active
                  ? <><Pause size={12} /> Arrêter</>
                  : <><Play  size={12} /> Démarrer</>}
              </button>
            </div>
          </div>
        </Card>

        {/* Last updated hint */}
        {latestTs && (
          <p
            className="mt-2 px-1"
            style={{ fontSize: 11, color: pro.textTer }}
          >
            Mis à jour {fmtRelative(latestTs)}
          </p>
        )}
      </div>

      {/* ── Row 2: 4 KPI stats ────────────────────────────────────────────── */}
      <section className="mb-6">
        <SectionHead title="Aperçu" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            icon={TrendingUp}
            label="Prospects total"
            value={stats?.prospects?.total ?? '—'}
            hint={stats ? `+${stats.prospects.newThisMonth} ce mois` : undefined}
          />
          <Stat
            icon={Zap}
            label="Hot leads (≥ 8)"
            value={stats?.hotLeads ?? '—'}
          />
          <Stat
            icon={Users}
            label="Clients actifs"
            value={stats?.clients?.totalActive ?? '—'}
          />
          <Stat
            icon={DollarSign}
            label="MRR"
            value={stats ? `${(stats.revenue.mrr).toFixed(0)} €` : '—'}
          />
        </div>
      </section>

      {/* ── Row 3: Chart + Activity ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">

        {/* Left: Area chart (60%) */}
        <Card className="lg:col-span-3">
          <div className="p-4">
            <SectionHead title="Appels — 7 derniers jours" />
            <div style={{ height: 180 }}>
              {callsChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={callsChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={pro.accent} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={pro.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: pro.textTer }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: pro.textTer }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(13,13,24,0.97)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: 10,
                        fontSize: 12,
                        color: pro.text,
                      }}
                      cursor={{ stroke: pro.accent, strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke={pro.accent}
                      strokeWidth={2}
                      fill="url(#callGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[12px]" style={{ color: pro.textTer }}>Aucune donnée disponible</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Right: Activity feed (40%) */}
        <Card className="lg:col-span-2">
          <div className="p-4">
            <SectionHead title="Activité récente" />
            {activity.length === 0 ? (
              <p className="text-[12px] py-8 text-center" style={{ color: pro.textTer }}>Aucune activité récente</p>
            ) : (
              <div className="space-y-0">
                {activity.slice(0, 8).map((a, i) => {
                  const Icon = activityIcon(a.type);
                  const ts = a.createdAt ?? a.timestamp;
                  return (
                    <div
                      key={a.id ?? i}
                      className="flex items-start gap-3 py-2.5"
                      style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      >
                        <Icon size={12} style={{ color: pro.textSec }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] leading-snug truncate" style={{ color: pro.text }}>
                          {a.message ?? a.description ?? a.type}
                        </p>
                        {ts && (
                          <p className="text-[10.5px] mt-0.5" style={{ color: pro.textTer }}>
                            {fmtRelative(ts)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Row 4: Anomalies + Quick actions ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-0">

        {/* Anomalies */}
        <Card>
          <div className="p-4">
            <SectionHead title="Anomalies" />
            {anomalies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CheckCircle size={28} style={{ color: pro.ok }} />
                <p className="text-[13px]" style={{ color: pro.textSec }}>Aucune anomalie</p>
              </div>
            ) : (
              <div className="space-y-0">
                {anomalies.slice(0, 5).map((a, i) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 py-2.5"
                    style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                  >
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: pro.warn }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12.5px] font-medium" style={{ color: pro.text }}>{a.metric}</span>
                        <Pill color={severityColor(a.severity)}>{a.severity}</Pill>
                      </div>
                      {a.diagnosis && (
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: pro.textSec }}>{a.diagnosis}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Quick actions */}
        <Card>
          <div className="p-4">
            <SectionHead title="Actions rapides" />
            {/* Trigger label */}
            <p
              className="px-1 mb-2"
              style={{
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: pro.textTer,
              }}
            >
              Déclencher
            </p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: 'Lancer scraping',   endpoint: 'admin/trigger-scraping',       color: pro.info },
                { label: 'Déclencher appel',   endpoint: 'admin/trigger-call',           color: pro.accent },
                { label: 'Traiter suivis',     endpoint: 'admin/trigger-followups',      color: pro.ok },
              ].map(({ label, endpoint, color }) => (
                <button
                  key={label}
                  onClick={() => quickAction(label, endpoint)}
                  disabled={actionBusy === label}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all disabled:opacity-50 hover:brightness-110 cursor-pointer"
                  style={{
                    background: `${color}12`,
                    border: `1px solid ${color}28`,
                    color: color,
                  }}
                >
                  {actionBusy === label ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Play size={13} />
                  )}
                  <span className="text-[13px] font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
