import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Play, Square, Loader2, CheckCircle2, XCircle, ArrowUpRight,
  Phone, Crosshair, Target, Mail, Brain, Users, Zap,
  TrendingUp, DollarSign, BarChart3, Clock, Cpu,
  Calendar, Activity, ChevronRight, RefreshCw, Settings,
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

// Cron schedule descriptions
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

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  core:     { label: 'Principal',     color: '#7B5CF0' },
  prospect: { label: 'Prospection',   color: '#F59E0B' },
  ai:       { label: 'IA',            color: '#EC4899' },
  client:   { label: 'Clients',       color: '#3B82F6' },
  agent:    { label: 'Agents',        color: '#22C55E' },
  system:   { label: 'Système',       color: '#8B8BA7' },
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
  const pulseRef = useRef<HTMLDivElement>(null);

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
    const t = setInterval(load, 10_000); // refresh every 10s for live feel
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

  // Count active crons
  const activeCrons = Object.values(crons).filter((v: any) => v === 'active').length;
  const totalCrons = Object.keys(crons).length;

  // Filter crons by category
  const filteredCrons = Object.entries(crons).filter(([key]) => {
    if (cronFilter === 'all') return true;
    return CRON_INFO[key]?.category === cronFilter;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-[#7B5CF0]" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-[1400px]">

      {/* ── LIVE HEADER — Bot status + pulse ── */}
      <section className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5 relative overflow-hidden">
        {/* Pulse glow when active */}
        {bot?.isActive && (
          <div className="absolute top-0 left-0 w-full h-[2px]">
            <div className="h-full bg-gradient-to-r from-transparent via-[#7B5CF0] to-transparent animate-pulse" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          {/* Bot toggle */}
          <button onClick={toggleBot} disabled={toggling}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm border transition-all disabled:opacity-50
              ${bot?.isActive
                ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'}`}>
            {toggling ? <Loader2 className="w-4 h-4 animate-spin" />
              : bot?.isActive ? <><span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" /><Square className="w-4 h-4" /> Arrêter</>
              : <><span className="w-2 h-2 rounded-full bg-[#22C55E]" /><Play className="w-4 h-4" /> Démarrer</>}
          </button>

          {/* Live indicator */}
          <div className="flex items-center gap-2">
            {bot?.isActive && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22C55E]/5 border border-[#22C55E]/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
                </span>
                <span className="text-[11px] font-bold text-[#22C55E] tracking-wider">LIVE</span>
              </div>
            )}
            <span className="text-[10px] text-[#8B8BA7]">
              {activeCrons}/{totalCrons} crons actifs
            </span>
          </div>

          {/* Call quota bar */}
          <div className="w-36">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#8B8BA7]">Appels</span>
              <span className="font-bold text-[#F8F8FF] tabular-nums">{calls}/{quota}</span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${pct}%`, background: pct >= 90 ? '#EF4444' : pct >= 60 ? '#F59E0B' : '#7B5CF0',
              }} />
            </div>
          </div>

          {/* Health badges */}
          {health && (
            <div className="flex flex-wrap gap-1 ml-auto">
              {Object.entries(health).map(([k, ok]) => (
                <span key={k} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                  ${ok ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                  {ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                  {k === 'resend' ? 'Email' : k === 'database' ? 'DB' : k.charAt(0).toUpperCase() + k.slice(1)}
                </span>
              ))}
              <span className="text-[9px] text-[#8B8BA7] self-center ml-1">
                MàJ {format(lastRefresh, 'HH:mm:ss')}
              </span>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/[0.04]">
          {[
            { key: 'prospecting', label: 'Prospection', icon: Crosshair },
            { key: 'scoring', label: 'Scoring', icon: Target },
            { key: 'calling', label: 'Appel', icon: Phone },
            { key: 'followup', label: 'Follow-up', icon: Mail },
          ].map(({ key, label, icon: I }) => (
            <button key={key} onClick={() => run(key)} disabled={running === key}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                bg-white/[0.04] text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-[#7B5CF0]/10
                border border-white/[0.04] hover:border-[#7B5CF0]/30 transition-all disabled:opacity-50">
              {running === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <I className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ── KPIs ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
        {([
          { l: 'Prospects', v: stats?.prospects?.total ?? 0, c: '#7B5CF0', to: '/admin/prospects' },
          { l: 'Clients', v: stats?.clients?.totalActive ?? 0, c: '#3B82F6', to: '/admin/clients' },
          { l: 'MRR', v: `$${mrr.toLocaleString()}`, c: '#22C55E', to: '/admin/billing' },
          { l: 'Appels', v: calls, c: '#F59E0B', to: '/admin/calls' },
          { l: 'Leads', v: stats?.calls?.hotLeadsToday ?? 0, c: '#EF4444', to: '/admin/leads' },
          { l: 'Conversion', v: `${(stats?.conversion?.prospectToClient ?? 0).toFixed(1)}%`, c: '#EC4899', to: '/admin/prospects' },
        ] as const).map(({ l, v, c, to }) => (
          <Link key={l} to={to}
            className="rounded-xl bg-[#12121A] border border-white/[0.06] p-3.5 hover:border-white/[0.15] transition-all group">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#8B8BA7] mb-1 group-hover:text-[#F8F8FF] transition-colors">{l}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: c }}>{v}</p>
          </Link>
        ))}
      </section>

      {/* ── LIVE PANEL — 2 columns: Bot Status + Activity Feed ── */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left: Bot Live Status (2 cols) */}
        <div className="lg:col-span-2 space-y-4">

          {/* Current state */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7B5CF0] mb-4 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5" /> En ce moment
              {bot?.isActive && <span className="ml-auto text-[9px] text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
            </h3>

            <div className="space-y-0">
              {[
                { l: 'Statut', v: bot?.isActive ? 'Actif' : 'Arrêté', dot: bot?.isActive ? '#22C55E' : '#EF4444' },
                { l: 'Appels aujourd\'hui', v: `${calls} / ${quota}`, dot: calls > 0 ? '#F59E0B' : '#8B8BA7' },
                { l: 'Prospects trouvés', v: (bot as any)?.prospectsFound ?? 0, dot: '#7B5CF0' },
                { l: 'Follow-ups envoyés', v: (bot as any)?.followUpsSent ?? 0, dot: '#3B82F6' },
              ].map(r => (
                <div key={r.l} className="flex items-center gap-2 py-2.5 border-b border-white/[0.03] last:border-0">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: r.dot }} />
                  <span className="text-[11px] text-[#8B8BA7] flex-1">{r.l}</span>
                  <span className="text-[12px] font-bold tabular-nums text-[#F8F8FF]">{r.v}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.04]">
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] mb-2">Dernières actions</p>
              {[
                { l: 'Prospection', t: bot?.lastRunProspecting ?? (bot as any)?.lastProspection },
                { l: 'Appel', t: bot?.lastRunCalling ?? (bot as any)?.lastCall },
                { l: 'Scoring', t: (bot as any)?.lastRunScoring },
                { l: 'Follow-up', t: (bot as any)?.lastRunFollowUp },
              ].map(r => (
                <div key={r.l} className="flex justify-between py-1.5">
                  <span className="text-[10px] text-[#8B8BA7]">{r.l}</span>
                  <span className="text-[10px] font-mono text-[#F8F8FF]/60">{r.t ? ago(r.t) : 'jamais'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue mini */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#22C55E] mb-3 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Revenus
            </h3>
            <p className="text-2xl font-bold text-[#22C55E] tabular-nums mb-3">${mrr.toLocaleString()}<span className="text-xs text-[#8B8BA7] font-normal">/mo</span></p>
            {[
              { l: 'Clients actifs', v: stats?.clients?.totalActive ?? 0, c: '#3B82F6' },
              { l: 'Nouveaux ce mois', v: stats?.clients?.newThisMonth ?? 0, c: '#7B5CF0' },
              { l: 'Taux conversion', v: `${(stats?.conversion?.prospectToClient ?? 0).toFixed(1)}%`, c: '#EC4899' },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-[11px] text-[#8B8BA7]">{r.l}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: r.c }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Activity Feed (3 cols) */}
        <div className="lg:col-span-3 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F59E0B] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Fil d'activité
              {bot?.isActive && (
                <span className="text-[9px] text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded-full ml-1 animate-pulse">LIVE</span>
              )}
            </h3>
            <Link to="/admin/calls" className="text-[10px] text-[#8B8BA7] hover:text-[#F8F8FF] flex items-center gap-0.5 transition-colors">
              Tout voir <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {activity.length === 0 ? (
            <div className="text-center py-16 text-[#8B8BA7]">
              <Activity className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p className="text-[12px] font-medium">Aucune activité</p>
              <p className="text-[10px] mt-1 opacity-60">Le fil se remplira quand le bot sera actif</p>
            </div>
          ) : (
            <div className="space-y-0 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
              {activity.slice(0, 20).map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3 py-3 border-b border-white/[0.03] last:border-0 group hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center mt-1">
                    <span className="text-base">{item.icon ?? '📞'}</span>
                    {i < activity.length - 1 && <div className="w-px h-full bg-white/[0.04] mt-1" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[#F8F8FF] font-medium">{item.message ?? item.businessName ?? 'Activité'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[#8B8BA7]">{item.date ? ago(item.date) : ''}</span>
                      {item.date && <span className="text-[9px] text-[#8B8BA7]/50 font-mono">{timeStr(item.date)}</span>}
                    </div>
                  </div>

                  {item.interestScore != null && (
                    <div className="flex flex-col items-center">
                      <span className="text-[13px] font-black tabular-nums" style={{
                        color: item.interestScore >= 7 ? '#22C55E' : item.interestScore >= 4 ? '#F59E0B' : '#EF4444'
                      }}>{item.interestScore}</span>
                      <span className="text-[8px] text-[#8B8BA7]">/10</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CRON JOBS — Full grid ── */}
      <section className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8B8BA7] flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" /> Cron Jobs
            <span className="text-[9px] font-mono ml-1 px-1.5 py-0.5 rounded bg-white/[0.04]">
              {activeCrons} actifs
            </span>
          </h3>

          {/* Category filters */}
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setCronFilter('all')}
              className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all
                ${cronFilter === 'all' ? 'bg-white/[0.1] text-[#F8F8FF]' : 'text-[#8B8BA7] hover:text-[#F8F8FF]'}`}>
              Tous
            </button>
            {Object.entries(CATEGORY_LABELS).map(([key, { label, color }]) => (
              <button key={key} onClick={() => setCronFilter(key)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all
                  ${cronFilter === key ? 'text-[#F8F8FF]' : 'text-[#8B8BA7] hover:text-[#F8F8FF]'}`}
                style={cronFilter === key ? { background: `${color}20`, color } : {}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filteredCrons.map(([key, state]) => {
            const info = CRON_INFO[key] ?? { label: key, schedule: '—', icon: CircleDot, category: 'system' };
            const Icon = info.icon;
            const catColor = CATEGORY_LABELS[info.category]?.color ?? '#8B8BA7';
            const isRunningNow = running === key;

            return (
              <button key={key}
                onClick={() => triggerCron(key)}
                disabled={isRunningNow}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left group
                  ${state === 'active'
                    ? 'bg-[#22C55E]/5 border-[#22C55E]/20 hover:border-[#22C55E]/40'
                    : state === 'idle'
                      ? 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.12]'
                      : 'bg-white/[0.01] border-white/[0.03] opacity-50'
                  }`}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${catColor}15` }}>
                  {isRunningNow
                    ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: catColor }} />
                    : <Icon className="w-4 h-4" style={{ color: catColor }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-[#F8F8FF] truncate">{info.label}</p>
                  <p className="text-[9px] text-[#8B8BA7] font-mono">{info.schedule}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    state === 'active' ? 'bg-[#22C55E] animate-pulse'
                    : state === 'idle' ? 'bg-[#F59E0B]'
                    : 'bg-[#EF4444]'
                  }`} />
                  <span className="text-[8px] text-[#8B8BA7] uppercase font-bold tracking-wider">
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
