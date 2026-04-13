import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Play, Square, Loader2, CheckCircle2, XCircle, ArrowUpRight,
  Phone, Crosshair, Target, Mail, Brain, Users, Zap,
  TrendingUp, DollarSign, BarChart3, Clock,
  Calendar, Activity, RefreshCw, Settings,
  CircleDot, Timer, Search, Database, Globe, Bot,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';

function ago(d: string | null | undefined) {
  if (!d) return 'jamais';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr }); }
  catch { return '—'; }
}

function timeStr(d: string | null | undefined) {
  if (!d) return '—';
  try { return format(new Date(d), 'HH:mm:ss', { locale: fr }); }
  catch { return '—'; }
}

/* ── Palette monochrome ── */
const C = {
  bg:       '#101014',
  card:     '#16161C',
  border:   'rgba(255,255,255,0.05)',
  borderHi: 'rgba(255,255,255,0.10)',
  text:     '#C8C8D0',
  textDim:  '#6E6E80',
  textBright:'#E4E4EC',
  accent:   '#A0A0B0', // gris clair pour les chiffres
  on:       '#7A7A8A', // dot "actif" gris clair
  off:      '#3A3A44', // dot "off" gris foncé
  warn:     '#8A8A94', // idle
  bar:      '#4A4A58', // progress bar
  green:    '#5A8A5A', // start button muted green
  red:      '#8A5A5A', // stop button muted red
  live:     '#22C55E', // live badge — keep green
};

const CRON_INFO: Record<string, { label: string; schedule: string; icon: any; category: string }> = {
  prospection:          { label: 'Prospection',         schedule: '9h lun-ven',      icon: Search,     category: 'core' },
  calling:              { label: 'Appels sortants',     schedule: '*/20min 9-19h',   icon: Phone,      category: 'core' },
  reminders:            { label: 'Rappels',             schedule: 'Chaque heure',    icon: Clock,      category: 'core' },
  analytics:            { label: 'Analytics',           schedule: '23h55',           icon: BarChart3,  category: 'system' },
  dailyReset:           { label: 'Reset quotidien',     schedule: '00h01',           icon: RefreshCw,  category: 'system' },
  trialCheck:           { label: 'Vérif. essais',       schedule: '8h',              icon: Timer,      category: 'system' },
  onboardingRetry:      { label: 'Retry onboarding',    schedule: '*/5min',          icon: Users,      category: 'client' },
  bookingReminders:     { label: 'Rappels RDV',         schedule: '*/30min',         icon: Calendar,   category: 'client' },
  clientAnalytics:      { label: 'Stats clients',       schedule: '23h50',           icon: BarChart3,  category: 'client' },
  optimization:         { label: 'Optimisation IA',     schedule: 'Dim 0h',          icon: Brain,      category: 'ai' },
  phoneValidation:      { label: 'Valid. téléphone',    schedule: '*/10min',         icon: Phone,      category: 'system' },
  nicheLearning:        { label: 'Apprentissage niche', schedule: 'Dim 1h',          icon: Brain,      category: 'ai' },
  apifyScraping:        { label: 'Scraping Maps',       schedule: '2h UTC',          icon: Globe,      category: 'prospect' },
  outboundEngine:       { label: 'Moteur appels',       schedule: '*/20min 9-17h',   icon: Phone,      category: 'prospect' },
  abTesting:            { label: 'A/B Testing',         schedule: '6h UTC',          icon: Target,     category: 'ai' },
  bestTimeLearning:     { label: 'Best-time learning',  schedule: '4h UTC',          icon: Clock,      category: 'ai' },
  scriptLearning:       { label: 'Script learning',     schedule: 'Dim 1h',          icon: Brain,      category: 'ai' },
  followUpSequences:    { label: 'Follow-ups',          schedule: '*/30min',         icon: Mail,       category: 'prospect' },
  rescoreProspects:     { label: 'Re-scoring',          schedule: '3h UTC',          icon: Target,     category: 'prospect' },
  crmSync:              { label: 'Sync CRM',            schedule: '*/15min',         icon: Database,   category: 'client' },
  forwardingVerification: { label: 'Vérif. transferts', schedule: '9h',              icon: Phone,      category: 'system' },
  overageBilling:       { label: 'Facturation surplus',  schedule: '1er du mois 6h', icon: DollarSign,  category: 'system' },
  agentPayments:        { label: 'Agent Paiements',     schedule: 'Chaque heure',    icon: DollarSign,  category: 'agent' },
  agentAccounting:      { label: 'Agent Compta',        schedule: '1er du mois 2h',  icon: BarChart3,   category: 'agent' },
  agentInventoryAlerts: { label: 'Agent Stock Alertes', schedule: '*/6h',            icon: Zap,         category: 'agent' },
  agentInventoryForecast:{ label: 'Agent Stock Prévi.', schedule: '3h',              icon: TrendingUp,  category: 'agent' },
  agentEmailSync:       { label: 'Agent Email Sync',    schedule: '*/10min',         icon: Mail,        category: 'agent' },
  agentEmailFollowUp:   { label: 'Agent Email Follow',  schedule: 'Chaque heure',    icon: Mail,        category: 'agent' },
  agentEmailDigest:     { label: 'Agent Email Digest',  schedule: '8h',              icon: Mail,        category: 'agent' },
  agentNoShow:          { label: 'Agent No-Show',       schedule: 'Chaque heure',    icon: XCircle,     category: 'agent' },
};

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Principal', prospect: 'Prospection', ai: 'IA',
  client: 'Clients', agent: 'Agents', system: 'Système',
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [health, setHealth] = useState<Record<string, boolean> | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [cronFilter, setCronFilter] = useState<string>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    try {
      const [s, b, h, a] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/bot/status'),
        api.get('/bot/health').catch(() => ({ data: {} })),
        api.get('/dashboard/activity').catch(() => ({ data: [] })),
      ]);
      setStats(s.data); setBot(b.data); setHealth(h.data);
      setActivity(Array.isArray(a.data) ? a.data : []);
      setLastRefresh(new Date());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const toggleBot = async () => {
    setToggling(true);
    try {
      await api.post(bot?.isActive ? '/bot/stop' : '/bot/start');
      setBot((await api.get('/bot/status')).data);
    } catch { /* silent */ }
    finally { setToggling(false); }
  };

  const run = async (task: string) => {
    setRunning(task);
    try { await api.post(`/bot/run/${task}`); setTimeout(load, 2000); }
    catch { /* silent */ }
    finally { setTimeout(() => setRunning(null), 1500); }
  };

  const triggerCron = async (name: string) => {
    setRunning(name);
    try { await api.post(`/admin/cron/run/${name}`); setTimeout(load, 2000); }
    catch { /* silent */ }
    finally { setTimeout(() => setRunning(null), 3000); }
  };

  const mrr = stats?.revenue?.mrr ?? 0;
  const calls = bot?.callsToday ?? stats?.calls?.today ?? 0;
  const quota = bot?.callsQuotaDaily ?? 50;
  const pct = quota > 0 ? Math.min((calls / quota) * 100, 100) : 0;
  const crons = (bot as any)?.crons ?? {};
  const activeCrons = Object.values(crons).filter((v: any) => v === 'active').length;
  const totalCrons = Object.keys(crons).length;

  const filteredCrons = Object.entries(crons).filter(([key]) => {
    if (cronFilter === 'all') return true;
    return CRON_INFO[key]?.category === cronFilter;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.textDim }} />
    </div>
  );

  return (
    <div className="space-y-3 max-w-[1400px]">

      {/* ── HEADER ── */}
      <section className="rounded-xl p-4 relative overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        {bot?.isActive && (
          <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(90deg, transparent, ${C.on}, transparent)` }} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={toggleBot} disabled={toggling}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs border transition-all disabled:opacity-50"
            style={bot?.isActive
              ? { background: 'rgba(138,90,90,0.15)', borderColor: 'rgba(138,90,90,0.3)', color: '#B88' }
              : { background: 'rgba(90,138,90,0.15)', borderColor: 'rgba(90,138,90,0.3)', color: '#8B8' }}>
            {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : bot?.isActive ? <><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#B88' }} /><Square className="w-3.5 h-3.5" /> Arrêter</>
              : <><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#8B8' }} /><Play className="w-3.5 h-3.5" /> Démarrer</>}
          </button>

          {bot?.isActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: C.live }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: C.live }} />
              </span>
              <span className="text-[10px] font-bold tracking-wider" style={{ color: C.live }}>LIVE</span>
            </div>
          )}

          <span className="text-[10px]" style={{ color: C.textDim }}>{activeCrons}/{totalCrons} crons</span>

          <div className="w-32">
            <div className="flex justify-between text-[10px] mb-1">
              <span style={{ color: C.textDim }}>Appels</span>
              <span className="font-bold tabular-nums" style={{ color: C.text }}>{calls}/{quota}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: C.bar }} />
            </div>
          </div>

          {health && (
            <div className="flex flex-wrap gap-1 ml-auto items-center">
              {Object.entries(health).map(([k, ok]) => (
                <span key={k} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                  style={{ background: 'rgba(255,255,255,0.03)', color: ok ? C.text : '#987' }}>
                  {ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                  {k === 'resend' ? 'Email' : k === 'database' ? 'DB' : k.charAt(0).toUpperCase() + k.slice(1)}
                </span>
              ))}
              <span className="text-[9px] font-mono ml-1" style={{ color: C.textDim }}>{format(lastRefresh, 'HH:mm:ss')}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
          {[
            { key: 'prospecting', label: 'Prospection', icon: Crosshair },
            { key: 'scoring', label: 'Scoring', icon: Target },
            { key: 'calling', label: 'Appel', icon: Phone },
            { key: 'followup', label: 'Follow-up', icon: Mail },
          ].map(({ key, label, icon: I }) => (
            <button key={key} onClick={() => run(key)} disabled={running === key}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.03)', color: C.textDim, border: `1px solid ${C.border}` }}>
              {running === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <I className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ── KPIs ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
        {([
          { l: 'Prospects', v: stats?.prospects?.total ?? 0, to: '/admin/prospects' },
          { l: 'Clients', v: stats?.clients?.totalActive ?? 0, to: '/admin/clients' },
          { l: 'MRR', v: `$${mrr.toLocaleString()}`, to: '/admin/billing' },
          { l: 'Appels', v: calls, to: '/admin/calls' },
          { l: 'Leads', v: stats?.calls?.hotLeadsToday ?? 0, to: '/admin/leads' },
          { l: 'Conversion', v: `${(stats?.conversion?.prospectToClient ?? 0).toFixed(1)}%`, to: '/admin/prospects' },
        ] as const).map(({ l, v, to }) => (
          <Link key={l} to={to} className="rounded-lg p-3 transition-all group"
            style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: C.textDim }}>{l}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: C.textBright }}>{v}</p>
          </Link>
        ))}
      </section>

      {/* ── LIVE PANEL ── */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* Left: Status */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-1.5" style={{ color: C.textDim }}>
              <Bot className="w-3.5 h-3.5" /> En ce moment
              {bot?.isActive && <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full animate-pulse"
                style={{ color: C.live, background: 'rgba(34,197,94,0.10)' }}>LIVE</span>}
            </h3>

            {[
              { l: 'Statut', v: bot?.isActive ? 'Actif' : 'Arrêté', bright: true },
              { l: 'Appels aujourd\'hui', v: `${calls} / ${quota}` },
              { l: 'Prospects trouvés', v: (bot as any)?.prospectsFound ?? 0 },
              { l: 'Follow-ups envoyés', v: (bot as any)?.followUpsSent ?? 0 },
            ].map(r => (
              <div key={r.l} className="flex items-center gap-2 py-2 last:border-0" style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                <span className="w-1 h-1 rounded-full" style={{ background: C.on }} />
                <span className="text-[11px] flex-1" style={{ color: C.textDim }}>{r.l}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: r.bright ? C.textBright : C.text }}>{r.v}</span>
              </div>
            ))}

            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: C.textDim }}>Dernières actions</p>
              {[
                { l: 'Prospection', t: bot?.lastRunProspecting ?? (bot as any)?.lastProspection },
                { l: 'Appel', t: bot?.lastRunCalling ?? (bot as any)?.lastCall },
                { l: 'Scoring', t: (bot as any)?.lastRunScoring },
                { l: 'Follow-up', t: (bot as any)?.lastRunFollowUp },
              ].map(r => (
                <div key={r.l} className="flex justify-between py-1">
                  <span className="text-[10px]" style={{ color: C.textDim }}>{r.l}</span>
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{r.t ? ago(r.t) : 'jamais'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue */}
          <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-1.5" style={{ color: C.textDim }}>
              <DollarSign className="w-3.5 h-3.5" /> Revenus
            </h3>
            <p className="text-xl font-bold tabular-nums mb-3" style={{ color: C.textBright }}>${mrr.toLocaleString()}<span className="text-xs font-normal" style={{ color: C.textDim }}>/mo</span></p>
            {[
              { l: 'Clients actifs', v: stats?.clients?.totalActive ?? 0 },
              { l: 'Nouveaux ce mois', v: stats?.clients?.newThisMonth ?? 0 },
              { l: 'Taux conversion', v: `${(stats?.conversion?.prospectToClient ?? 0).toFixed(1)}%` },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1.5" style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                <span className="text-[11px]" style={{ color: C.textDim }}>{r.l}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: C.text }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Activity Feed */}
        <div className="lg:col-span-3 rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5" style={{ color: C.textDim }}>
              <Activity className="w-3.5 h-3.5" /> Fil d'activité
              {bot?.isActive && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-1 animate-pulse"
                  style={{ color: C.live, background: 'rgba(34,197,94,0.10)' }}>LIVE</span>
              )}
            </h3>
            <Link to="/admin/calls" className="text-[10px] flex items-center gap-0.5 transition-colors hover:opacity-80" style={{ color: C.textDim }}>
              Tout voir <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {activity.length === 0 ? (
            <div className="text-center py-14">
              <Activity className="w-7 h-7 mx-auto mb-2 opacity-10" style={{ color: C.textDim }} />
              <p className="text-[11px]" style={{ color: C.textDim }}>Aucune activité</p>
              <p className="text-[10px] mt-1 opacity-50" style={{ color: C.textDim }}>Le fil se remplira quand le bot sera actif</p>
            </div>
          ) : (
            <div className="space-y-0 max-h-[420px] overflow-y-auto pr-1">
              {activity.slice(0, 20).map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3 py-2.5 -mx-2 px-2 rounded-md transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                  <div className="mt-0.5">
                    <span className="text-sm opacity-60">{item.icon ?? '>'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium" style={{ color: C.text }}>{item.message ?? item.businessName ?? 'Activité'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{ color: C.textDim }}>{item.date ? ago(item.date) : ''}</span>
                      {item.date && <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{timeStr(item.date)}</span>}
                    </div>
                  </div>
                  {item.interestScore != null && (
                    <div className="text-center">
                      <span className="text-[12px] font-bold tabular-nums" style={{
                        color: item.interestScore >= 7 ? '#9A9' : item.interestScore >= 4 ? '#AA9' : '#A99'
                      }}>{item.interestScore}</span>
                      <span className="text-[8px] block" style={{ color: C.textDim }}>/10</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CRON JOBS ── */}
      <section className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5" style={{ color: C.textDim }}>
            <Settings className="w-3.5 h-3.5" /> Cron Jobs
            <span className="text-[9px] font-mono ml-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.03)', color: C.textDim }}>
              {activeCrons} actifs
            </span>
          </h3>

          <div className="flex gap-1 flex-wrap">
            {['all', ...Object.keys(CATEGORY_LABELS)].map(key => (
              <button key={key} onClick={() => setCronFilter(key)}
                className="px-2 py-0.5 rounded text-[9px] font-bold transition-all"
                style={{
                  background: cronFilter === key ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: cronFilter === key ? C.textBright : C.textDim,
                }}>
                {key === 'all' ? 'Tous' : CATEGORY_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
          {filteredCrons.map(([key, state]) => {
            const info = CRON_INFO[key] ?? { label: key, schedule: '—', icon: CircleDot, category: 'system' };
            const Icon = info.icon;
            const isRunningNow = running === key;

            return (
              <button key={key} onClick={() => triggerCron(key)} disabled={isRunningNow}
                className="flex items-center gap-2.5 p-2.5 rounded-lg transition-all text-left group disabled:opacity-50"
                style={{
                  background: state === 'active' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                  border: `1px solid ${state === 'active' ? 'rgba(255,255,255,0.07)' : C.border}`,
                }}>
                <div className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {isRunningNow
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: C.textDim }} />
                    : <Icon className="w-3.5 h-3.5" style={{ color: C.textDim }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold truncate" style={{ color: C.text }}>{info.label}</p>
                  <p className="text-[9px] font-mono" style={{ color: C.textDim }}>{info.schedule}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{
                    background: state === 'active' ? C.on : state === 'idle' ? C.warn : C.off,
                  }} />
                  <span className="text-[8px] uppercase font-bold tracking-wider" style={{ color: C.textDim }}>
                    {state === 'active' ? 'on' : state === 'idle' ? 'idle' : 'off'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
