import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Play, Square, Loader2, CheckCircle2, XCircle, ArrowUpRight,
  Phone, Crosshair, Target, Mail, Brain, Users, Zap,
  TrendingUp, DollarSign, BarChart3, Clock,
  Calendar, Activity, RefreshCw, Settings,
  CircleDot, Timer, Search, Database, Globe, Bot,
  Flame,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { t, glass, cx } from '../styles/admin-theme';

function ago(d: string | null | undefined) {
  if (!d) return 'jamais';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr }); }
  catch { return '\—'; }
}

function timeStr(d: string | null | undefined) {
  if (!d) return '\—';
  try { return format(new Date(d), 'HH:mm:ss', { locale: fr }); }
  catch { return '\—'; }
}

const CRON_INFO: Record<string, { label: string; schedule: string; icon: any; category: string }> = {
  prospection:          { label: 'Prospection',         schedule: '9h lun-ven',      icon: Search,     category: 'core' },
  calling:              { label: 'Appels sortants',     schedule: '*/20min 9-19h',   icon: Phone,      category: 'core' },
  reminders:            { label: 'Rappels',             schedule: 'Chaque heure',    icon: Clock,      category: 'core' },
  analytics:            { label: 'Analytics',           schedule: '23h55',           icon: BarChart3,  category: 'system' },
  dailyReset:           { label: 'Reset quotidien',     schedule: '00h01',           icon: RefreshCw,  category: 'system' },
  trialCheck:           { label: 'Vérif. essais',        schedule: '8h',              icon: Timer,      category: 'system' },
  onboardingRetry:      { label: 'Retry onboarding',    schedule: '*/5min',          icon: Users,      category: 'client' },
  bookingReminders:     { label: 'Rappels RDV',         schedule: '*/30min',         icon: Calendar,   category: 'client' },
  clientAnalytics:      { label: 'Stats clients',       schedule: '23h50',           icon: BarChart3,  category: 'client' },
  optimization:         { label: 'Optimisation IA',     schedule: 'Dim 0h',          icon: Brain,      category: 'ai' },
  phoneValidation:      { label: 'Valid. téléphone',     schedule: '*/10min',         icon: Phone,      category: 'system' },
  nicheLearning:        { label: 'Apprentissage niche', schedule: 'Dim 1h',          icon: Brain,      category: 'ai' },
  apifyScraping:        { label: 'Scraping Maps',       schedule: '2h UTC',          icon: Globe,      category: 'prospect' },
  outboundEngine:       { label: 'Moteur appels',       schedule: '*/20min 9-17h',   icon: Phone,      category: 'prospect' },
  abTesting:            { label: 'A/B Testing',         schedule: '6h UTC',          icon: Target,     category: 'ai' },
  bestTimeLearning:     { label: 'Best-time learning',  schedule: '4h UTC',          icon: Clock,      category: 'ai' },
  scriptLearning:       { label: 'Script learning',     schedule: 'Dim 1h',          icon: Brain,      category: 'ai' },
  followUpSequences:    { label: 'Follow-ups',          schedule: '*/30min',         icon: Mail,       category: 'prospect' },
  rescoreProspects:     { label: 'Re-scoring',          schedule: '3h UTC',          icon: Target,     category: 'prospect' },
  crmSync:              { label: 'Sync CRM',            schedule: '*/15min',         icon: Database,   category: 'client' },
  forwardingVerification: { label: 'Vérif. transferts',  schedule: '9h',              icon: Phone,      category: 'system' },
  overageBilling:       { label: 'Facturation surplus',  schedule: '1er du mois 6h', icon: DollarSign,  category: 'system' },
  agentPayments:        { label: 'Agent Paiements',     schedule: 'Chaque heure',    icon: DollarSign,  category: 'agent' },
  agentAccounting:      { label: 'Agent Compta',        schedule: '1er du mois 2h',  icon: BarChart3,   category: 'agent' },
  agentInventoryAlerts: { label: 'Agent Stock Alertes', schedule: '*/6h',            icon: Zap,         category: 'agent' },
  agentInventoryForecast:{ label: 'Agent Stock Prévi.',  schedule: '3h',              icon: TrendingUp,  category: 'agent' },
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
  const [health, setHealth] = useState<Record<string, boolean | string> | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [cronFilter, setCronFilter] = useState<string>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [hotLead, setHotLead] = useState<{ businessName: string; score: number; timestamp: Date } | null>(null);
  const socketRef = useRef<Socket | null>(null);

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
    const iv = setInterval(load, 10_000);
    return () => clearInterval(iv);
  }, [load]);

  // Socket.io: real-time hot lead alerts
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com';
    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('hot-lead', (data: { businessName: string; score: number; timestamp: string }) => {
      setHotLead({ ...data, timestamp: new Date(data.timestamp) });
      setTimeout(() => setHotLead(null), 15_000);
      load();
    });

    socket.on('activity', (data: any) => {
      setActivity(prev => [data, ...prev].slice(0, 30));
    });

    socket.on('call-completed', () => {
      load();
    });

    return () => { socket.disconnect(); socketRef.current = null; };
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

  // Off-hours detection: before 9h US Eastern = before 15h Brussels
  const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const beforeUSHours = nowET.getHours() < 9;

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
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: t.textTer }} />
    </div>
  );

  return (
    <div className={cx.pageWrap}>

      {/* -- Off-hours info banner -- */}
      {bot?.isActive && calls === 0 && beforeUSHours && (
        <section className="rounded-[14px] p-3 flex items-center gap-3" style={glass}>
          <Clock className="w-4 h-4 flex-shrink-0" style={{ color: t.textSec }} />
          <p className="text-[11px]" style={{ color: t.textSec }}>
            Les appels démarrent à 15h (9h Eastern US). Le bot est prêt et démarrera automatiquement.
          </p>
        </section>
      )}

      {/* -- Hot lead real-time alert -- */}
      {hotLead && (
        <section className="rounded-[14px] p-3 flex items-center gap-3 animate-pulse"
          style={{ ...glass, borderColor: t.success, border: `1px solid ${t.success}40` }}>
          <Flame className="w-4 h-4 flex-shrink-0" style={{ color: t.success }} />
          <div className="flex-1">
            <p className="text-[11px] font-semibold" style={{ color: t.text }}>
              Hot Lead détecté — {hotLead.businessName} (score {hotLead.score}/10)
            </p>
            <p className="text-[10px]" style={{ color: t.textTer }}>Rappeler dans les 5 minutes</p>
          </div>
          <button onClick={() => setHotLead(null)} className="text-[10px] px-2 py-0.5 rounded"
            style={{ color: t.textTer, background: t.elevated }}>
            Fermer
          </button>
        </section>
      )}

      {/* -- HEADER -- */}
      <section className="rounded-[14px] p-4 relative overflow-hidden" style={glass}>
        {bot?.isActive && (
          <div className="absolute top-0 left-0 w-full h-px" style={{ background: `linear-gradient(90deg, transparent, ${t.textMuted}, transparent)` }} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={toggleBot} disabled={toggling}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] font-semibold text-xs border transition-all disabled:opacity-50"
            style={bot?.isActive
              ? { background: `${t.danger}15`, borderColor: `${t.danger}30`, color: t.danger }
              : { background: `${t.success}15`, borderColor: `${t.success}30`, color: t.success }}>
            {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : bot?.isActive ? <><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: t.danger }} /><Square className="w-3.5 h-3.5" /> Arr\êter</>
              : <><span className="w-1.5 h-1.5 rounded-full" style={{ background: t.success }} /><Play className="w-3.5 h-3.5" /> D\émarrer</>}
          </button>

          {bot?.isActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[10px]" style={{ background: t.elevated, border: `1px solid ${t.border}` }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: t.live }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: t.live }} />
              </span>
              <span className="text-[10px] font-bold tracking-wider" style={{ color: t.live }}>LIVE</span>
            </div>
          )}

          <span className="text-[10px]" style={{ color: t.textTer }}>{activeCrons}/{totalCrons} crons</span>

          <div className="w-32">
            <div className="flex justify-between text-[10px] mb-1">
              <span style={{ color: t.textTer }}>Appels</span>
              <span className="font-bold tabular-nums" style={{ color: t.text }}>{calls}/{quota}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'rgba(255,255,255,0.08)' }} />
            </div>
          </div>

          {health && (
            <div className="flex flex-wrap gap-1 ml-auto items-center">
              {Object.entries(health).map(([k, ok]) => {
                const isOptional = ok === 'optional';
                const color = isOptional ? t.warning : ok ? t.textSec : t.danger;
                return (
                  <span key={k} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                    style={{ background: t.elevated, color }}>
                    {isOptional ? <CheckCircle2 className="w-2.5 h-2.5" /> : ok ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                    {k === 'resend' ? 'Email' : k === 'database' ? 'DB' : k.charAt(0).toUpperCase() + k.slice(1)}
                  </span>
                );
              })}
              <span className="text-[9px] font-mono ml-1" style={{ color: t.textMuted }}>{format(lastRefresh, 'HH:mm:ss')}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
          {[
            { key: 'prospecting', label: 'Prospection', icon: Crosshair },
            { key: 'scoring', label: 'Scoring', icon: Target },
            { key: 'calling', label: 'Appel', icon: Phone },
            { key: 'followup', label: 'Follow-up', icon: Mail },
          ].map(({ key, label, icon: I }) => (
            <button key={key} onClick={() => run(key)} disabled={running === key}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-[10px] font-medium transition-all disabled:opacity-50"
              style={{ background: t.elevated, color: t.textTer, border: `1px solid ${t.border}` }}>
              {running === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <I className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* -- KPIs -- */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
        {([
          { l: 'Prospects', v: stats?.prospects?.total ?? 0, to: '/admin/prospects' },
          { l: 'Clients', v: stats?.clients?.totalActive ?? 0, to: '/admin/clients' },
          { l: 'MRR', v: `$${mrr.toLocaleString()}`, to: '/admin/billing' },
          { l: 'Appels', v: calls, to: '/admin/calls' },
          { l: 'Leads', v: stats?.calls?.hotLeadsToday ?? 0, to: '/admin/leads' },
          { l: 'Conversion', v: `${(stats?.conversion?.prospectToClient ?? 0).toFixed(1)}%`, to: '/admin/prospects' },
        ] as const).map(({ l, v, to }) => (
          <Link key={l} to={to} className="rounded-[14px] p-3 transition-all group" style={glass}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: t.textTer }}>{l}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: t.text }}>{v}</p>
          </Link>
        ))}
      </section>

      {/* -- LIVE PANEL -- */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* Left: Status */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-[14px] p-4" style={glass}>
            <h3 className={`${cx.h3} mb-3 flex items-center gap-1.5`} style={{ color: t.textTer }}>
              <Bot className="w-3.5 h-3.5" /> En ce moment
              {bot?.isActive && <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full animate-pulse"
                style={{ color: t.live, background: 'rgba(34,197,94,0.10)' }}>LIVE</span>}
            </h3>

            {[
              { l: 'Statut', v: bot?.isActive ? 'Actif' : 'Arr\êt\é', bright: true },
              { l: 'Appels aujourd\'hui', v: `${calls} / ${quota}` },
              { l: 'Prospects trouv\és', v: (bot as any)?.prospectsFound ?? 0 },
              { l: 'Follow-ups envoy\és', v: (bot as any)?.followUpsSent ?? 0 },
            ].map(r => (
              <div key={r.l} className="flex items-center gap-2 py-2 last:border-0" style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                <span className="w-1 h-1 rounded-full" style={{ background: t.textMuted }} />
                <span className="text-[11px] flex-1" style={{ color: t.textTer }}>{r.l}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: r.bright ? t.text : t.textSec }}>{r.v}</span>
              </div>
            ))}

            {bot?.isActive && beforeUSHours && calls === 0 && (
              <p className="text-[10px] mt-2 px-2 py-1.5 rounded-[8px]" style={{ color: t.textMuted, background: 'rgba(255,255,255,0.02)' }}>
                <Clock className="w-3 h-3 inline-block mr-1 -mt-px" />
                Les appels US d\émarrent \à 15h (9h Eastern)
              </p>
            )}

            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
              <p className={`${cx.h3} mb-2`} style={{ color: t.textTer }}>Derni\ères actions</p>
              {[
                { l: 'Prospection', t: bot?.lastRunProspecting ?? (bot as any)?.lastProspection },
                { l: 'Appel', t: bot?.lastRunCalling ?? (bot as any)?.lastCall },
                { l: 'Scoring', t: (bot as any)?.lastRunScoring },
                { l: 'Follow-up', t: (bot as any)?.lastRunFollowUp },
              ].map(r => (
                <div key={r.l} className="flex justify-between py-1">
                  <span className="text-[10px]" style={{ color: t.textTer }}>{r.l}</span>
                  <span className="text-[10px] font-mono" style={{ color: t.textMuted }}>{r.t ? ago(r.t) : 'jamais'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue */}
          <div className="rounded-[14px] p-4" style={glass}>
            <h3 className={`${cx.h3} mb-2 flex items-center gap-1.5`} style={{ color: t.textTer }}>
              <DollarSign className="w-3.5 h-3.5" /> Revenus
            </h3>
            <p className="text-xl font-bold tabular-nums mb-3" style={{ color: t.text }}>${mrr.toLocaleString()}<span className="text-xs font-normal" style={{ color: t.textTer }}>/mo</span></p>
            {[
              { l: 'Clients actifs', v: stats?.clients?.totalActive ?? 0 },
              { l: 'Nouveaux ce mois', v: stats?.clients?.newThisMonth ?? 0 },
              { l: 'Taux conversion', v: `${(stats?.conversion?.prospectToClient ?? 0).toFixed(1)}%` },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-1.5" style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                <span className="text-[11px]" style={{ color: t.textTer }}>{r.l}</span>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: t.textSec }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Activity Feed */}
        <div className="lg:col-span-3 rounded-[14px] p-4" style={glass}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`${cx.h3} flex items-center gap-1.5`} style={{ color: t.textTer }}>
              <Activity className="w-3.5 h-3.5" /> Fil d'activit\é
              {bot?.isActive && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-1 animate-pulse"
                  style={{ color: t.live, background: 'rgba(34,197,94,0.10)' }}>LIVE</span>
              )}
            </h3>
            <Link to="/admin/calls" className="text-[10px] flex items-center gap-0.5 transition-colors hover:opacity-80" style={{ color: t.textTer }}>
              Tout voir <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {activity.length === 0 ? (
            <div className="text-center py-14">
              <Activity className="w-7 h-7 mx-auto mb-2 opacity-10" style={{ color: t.textTer }} />
              <p className="text-[11px]" style={{ color: t.textTer }}>Aucune activit\é</p>
              {bot?.isActive && beforeUSHours ? (
                <p className="text-[10px] mt-2 opacity-60" style={{ color: t.textMuted }}>
                  Les appels d\émarrent \à 15h heure belge (9h US Eastern). Le bot se lancera automatiquement.
                </p>
              ) : (
                <p className="text-[10px] mt-1 opacity-50" style={{ color: t.textMuted }}>Le fil se remplira quand le bot sera actif</p>
              )}
            </div>
          ) : (
            <div className="space-y-0 max-h-[420px] overflow-y-auto pr-1">
              {activity.slice(0, 20).map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3 py-2.5 -mx-2 px-2 rounded-[10px] transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                  <div className="mt-0.5">
                    <span className="text-sm opacity-60">{item.icon ?? '>'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium" style={{ color: t.textSec }}>{item.message ?? item.businessName ?? 'Activit\é'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{ color: t.textTer }}>{item.date ? ago(item.date) : ''}</span>
                      {item.date && <span className="text-[9px] font-mono" style={{ color: t.textMuted }}>{timeStr(item.date)}</span>}
                    </div>
                  </div>
                  {item.interestScore != null && (
                    <div className="text-center">
                      <span className="text-[12px] font-bold tabular-nums" style={{
                        color: item.interestScore >= 7 ? t.success : item.interestScore >= 4 ? t.warning : t.danger
                      }}>{item.interestScore}</span>
                      <span className="text-[8px] block" style={{ color: t.textTer }}>/10</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* -- CRON JOBS -- */}
      <section className="rounded-[14px] p-4" style={glass}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`${cx.h3} flex items-center gap-1.5`} style={{ color: t.textTer }}>
            <Settings className="w-3.5 h-3.5" /> Cron Jobs
            <span className="text-[9px] font-mono ml-1 px-1.5 py-0.5 rounded" style={{ background: t.elevated, color: t.textTer }}>
              {activeCrons} actifs
            </span>
          </h3>

          <div className="flex gap-1 flex-wrap">
            {['all', ...Object.keys(CATEGORY_LABELS)].map(key => (
              <button key={key} onClick={() => setCronFilter(key)}
                className="px-2 py-0.5 rounded text-[9px] font-bold transition-all"
                style={{
                  background: cronFilter === key ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: cronFilter === key ? t.text : t.textTer,
                }}>
                {key === 'all' ? 'Tous' : CATEGORY_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
          {filteredCrons.map(([key, state]) => {
            const info = CRON_INFO[key] ?? { label: key, schedule: '\—', icon: CircleDot, category: 'system' };
            const Icon = info.icon;
            const isRunningNow = running === key;

            return (
              <button key={key} onClick={() => triggerCron(key)} disabled={isRunningNow}
                className="flex items-center gap-2.5 p-2.5 rounded-[10px] transition-all text-left group disabled:opacity-50"
                style={{
                  background: state === 'active' ? t.elevated : 'rgba(255,255,255,0.01)',
                  border: `1px solid ${state === 'active' ? t.borderHi : t.border}`,
                }}>
                <div className="flex-shrink-0 w-7 h-7 rounded-[8px] flex items-center justify-center"
                  style={{ background: t.elevated }}>
                  {isRunningNow
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: t.textTer }} />
                    : <Icon className="w-3.5 h-3.5" style={{ color: t.textTer }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold truncate" style={{ color: t.textSec }}>{info.label}</p>
                  <p className="text-[9px] font-mono" style={{ color: t.textMuted }}>{info.schedule}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{
                    background: state === 'active' ? t.textSec : state === 'idle' ? t.textMuted : 'rgba(255,255,255,0.08)',
                  }} />
                  <span className="text-[8px] uppercase font-bold tracking-wider" style={{ color: t.textMuted }}>
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
