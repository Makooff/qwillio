import { useEffect, useState, useCallback } from 'react';
import QwillioLoader from '../components/QwillioLoader';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';
import {
  Bot, Play, Pause, RefreshCw, AlertCircle,
  Activity, Zap, Users, DollarSign, Phone,
  TrendingUp, CheckCircle, AlertTriangle,
  Megaphone, PhoneCall, Target,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, CartesianGrid, XAxis, YAxis,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { pro, proShadow } from '../styles/pro-theme';
import {
  Card, PageHeader, Stat, SectionHead, PrimaryBtn, Pill,
} from '../components/pro/ProBlocks';

const API = import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com';

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonCard({ h = 'h-24' }: { h?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl ${h}`}
      style={{ background: pro.panel, border: `1px solid ${pro.border}` }}
    />
  );
}

// ── Custom tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-xl"
      style={{
        background: pro.panelHi,
        border: `1px solid ${pro.borderHi}`,
        boxShadow: proShadow.float,
      }}
    >
      <p className="text-[11px] mb-1" style={{ color: pro.textTer }}>{label}</p>
      <p className="text-[15px] font-bold tabular-nums" style={{ color: pro.text }}>
        {payload[0].value}
        <span className="text-[11px] font-normal ml-1" style={{ color: pro.textSec }}>appels</span>
      </p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [showIntro, setShowIntro]   = useState(() => !sessionStorage.getItem('qw-intro-played'));
  const [introFading, setIntroFading] = useState(false);
  const [botStatus, setBotStatus]   = useState<BotStatus | null>(null);
  const [stats, setStats]           = useState<DashStats | null>(null);
  const [activity, setActivity]     = useState<ActivityItem[]>([]);
  const [callsChart, setCallsChart] = useState<CallDay[]>([]);
  const [anomalies, setAnomalies]   = useState<Anomaly[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [busy, setBusy]             = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  useEffect(() => {
    if (!showIntro) return;
    const fadeTimer = window.setTimeout(() => setIntroFading(true), 2300);
    const hideTimer = window.setTimeout(() => {
      setShowIntro(false);
      sessionStorage.setItem('qw-intro-played', '1');
    }, 2750);
    return () => { window.clearTimeout(fadeTimer); window.clearTimeout(hideTimer); };
  }, [showIntro]);

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
        addToast(`Erreur ${r.status}: ${msg}`, 'error');
      }
    } catch (e: unknown) {
      addToast(`Erreur réseau : ${e instanceof Error ? e.message : 'inconnu'}`, 'error');
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
      if (!r.ok) addToast(`Erreur ${r.status}`, 'error');
    } catch { /* intentional */ }
    setActionBusy(null);
    await load();
  };

  if (loading) {
    return (
      <div className="space-y-4 admin-page">
        <SkeletonCard h="h-36" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3"><SkeletonCard h="h-56" /></div>
          <div className="lg:col-span-2"><SkeletonCard h="h-56" /></div>
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

  const active    = botStatus?.isActive ?? false;
  const quota     = botStatus?.callsQuota ?? 50;
  const calls     = botStatus?.callsToday ?? 0;
  const pct       = quota > 0 ? Math.min(100, Math.round((calls / quota) * 100)) : 0;
  const barColor  = pct > 90 ? pro.bad : pct > 70 ? pro.warn : pro.accent;

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
    if (t.includes('lead'))   return Zap;
    if (t.includes('client')) return Users;
    if (t.includes('bot'))    return Bot;
    return Activity;
  };

  const latestTs = activity[0]?.createdAt ?? activity[0]?.timestamp;

  return (
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={removeToast} />

      {showIntro && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: '#0A0A0F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: introFading ? 0 : 1,
            transition: 'opacity 450ms ease-out',
            pointerEvents: introFading ? 'none' : 'auto',
          }}
        >
          <QwillioLoader fullscreen={false} size={160} />
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────────── */}
      <PageHeader
        title="Tableau de bord"
        subtitle={latestTs ? `Mis à jour ${fmtRelative(latestTs)}` : undefined}
      />

      {/* ── Bot status hero ───────────────────────────────────────────── */}
      <Card glow={active}>
        <div className="p-5">
          <div className="flex items-start gap-4">

            {/* Pulsing status orb */}
            <div
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: active
                  ? 'oklch(72% 0.18 145 / 0.10)'
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'oklch(72% 0.18 145 / 0.28)' : pro.border}`,
              }}
            >
              {active && (
                <span
                  className="absolute inset-0 rounded-2xl animate-ping"
                  style={{ background: 'oklch(72% 0.18 145 / 0.08)' }}
                />
              )}
              <Bot size={22} style={{ color: active ? pro.ok : pro.textSec }} />
            </div>

            {/* Status label + metrics */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background: active ? pro.ok : pro.textTer,
                      boxShadow: active ? `0 0 8px ${pro.okGlow}` : undefined,
                    }}
                  />
                  <span className="text-base font-bold tracking-tight" style={{ color: pro.text }}>
                    {active ? 'Bot actif' : 'Bot inactif'}
                  </span>
                </div>

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
                  quota restant{' '}
                  <span className="font-semibold tabular-nums" style={{ color: barColor }}>
                    {quota - calls}
                  </span>
                </span>
              </div>

              {/* Quota progress bar */}
              <div
                className="h-2 rounded-full overflow-hidden mb-1.5"
                style={{ background: 'rgba(255,255,255,0.06)' }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Quota d'appels"
              >
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
              <p className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>
                {calls} / {quota} appels utilisés ({pct}%)
              </p>
            </div>

            {/* Toggle */}
            <button
              onClick={toggleBot}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-[12.5px] font-semibold transition-colors disabled:opacity-40 flex-shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              style={{
                background:  active ? 'rgba(239,68,68,0.10)' : pro.accentGrad,
                color:       active ? pro.bad : '#fff',
                border:      active ? `1px solid rgba(239,68,68,0.28)` : 'none',
                boxShadow:   active ? undefined : proShadow.btn,
              }}
            >
              {busy
                ? <RefreshCw size={12} className="animate-spin" />
                : active
                  ? <><Pause size={12} /> Arrêter</>
                  : <><Play  size={12} /> Démarrer</>
              }
            </button>
          </div>
        </div>
      </Card>

      {/* ── 4 KPI stats ───────────────────────────────────────────────── */}
      <section>
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
            value={stats ? `${stats.revenue.mrr.toFixed(0)} €` : '—'}
          />
        </div>
      </section>

      {/* ── Chart + Activity feed ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Area chart */}
        <Card className="lg:col-span-3">
          <div className="p-4">
            <SectionHead title="Appels — 7 derniers jours" />
            <div style={{ height: 190 }}>
              {callsChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={callsChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={pro.accent} stopOpacity={0.30} />
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
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: pro.accent, strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke={pro.accent}
                      strokeWidth={2}
                      fill="url(#callGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: pro.accent, strokeWidth: 0 }}
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

        {/* Activity feed */}
        <Card className="lg:col-span-2">
          <div className="p-4">
            <SectionHead title="Activité récente" />
            {activity.length === 0 ? (
              <p className="text-[12px] py-10 text-center" style={{ color: pro.textTer }}>
                Aucune activité récente
              </p>
            ) : (
              <ul className="space-y-0">
                {activity.slice(0, 8).map((a, i) => {
                  const Icon = activityIcon(a.type);
                  const ts = a.createdAt ?? a.timestamp;
                  return (
                    <li
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
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* ── Anomalies + Quick actions ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Anomalies */}
        <Card>
          <div className="p-4">
            <SectionHead title="Anomalies détectées" />
            {anomalies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <CheckCircle size={28} style={{ color: pro.ok }} />
                <p className="text-[13px]" style={{ color: pro.textSec }}>Aucune anomalie</p>
              </div>
            ) : (
              <ul className="space-y-0">
                {anomalies.slice(0, 5).map((a, i) => (
                  <li
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
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Prochaines actions */}
        <Card>
          <div className="p-4">
            <SectionHead title="Prochaines actions" />
            <div className="grid grid-cols-1 gap-2">
              {[
                {
                  label:    'Lancer scraping prospects',
                  endpoint: 'admin/trigger-scraping',
                  icon:     Target,
                  color:    pro.info,
                },
                {
                  label:    'Déclencher un appel',
                  endpoint: 'admin/trigger-call',
                  icon:     PhoneCall,
                  color:    pro.accent,
                },
                {
                  label:    'Traiter les suivis',
                  endpoint: 'admin/trigger-followups',
                  icon:     Megaphone,
                  color:    pro.ok,
                },
              ].map(({ label, endpoint, icon: Icon, color }) => (
                <button
                  key={label}
                  onClick={() => quickAction(label, endpoint)}
                  disabled={actionBusy === label}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors disabled:opacity-50 hover:brightness-110 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  style={{
                    background: `${color}12`,
                    border: `1px solid ${color}28`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}18` }}
                  >
                    {actionBusy === label
                      ? <RefreshCw size={13} className="animate-spin" style={{ color }} />
                      : <Icon size={14} style={{ color }} />
                    }
                  </div>
                  <span className="text-[13px] font-medium" style={{ color }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
