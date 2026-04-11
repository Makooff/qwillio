import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Building2, Phone, TrendingUp, Zap, Target, BarChart3,
  Play, Square, RefreshCw, Clock, Activity, ArrowUpRight,
  CheckCircle2, XCircle, Loader2, Search, Settings,
  Crosshair, Brain, Mail, Gauge,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import StatCard from '../components/ui/StatCard';
import { StatCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

/* ── Helpers ── */
function scoreColor(s: number) {
  return s >= 7 ? '#22C55E' : s >= 4 ? '#F59E0B' : '#EF4444';
}
function ago(d: string | null | undefined) {
  if (!d) return 'jamais';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: fr }); }
  catch { return '—'; }
}

/* ── Service Health Badge ── */
function HealthDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
      ${ok ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </div>
  );
}

/* ── Pipeline Step ── */
function PipelineStep({ label, value, sub, color, active }: {
  label: string; value: string | number; sub: string; color: string; active?: boolean;
}) {
  return (
    <div className={`flex-1 rounded-xl p-3 border transition-all
      ${active ? 'border-white/[0.12] bg-white/[0.03]' : 'border-white/[0.04] bg-[#0D0D15]'}`}>
      <div className="flex items-center gap-2 mb-1">
        {active && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8BA7]">{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[10px] text-[#8B8BA7] mt-0.5">{sub}</p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [health, setHealth] = useState<Record<string, boolean> | null>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, b, h, r, a] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/bot/status'),
        api.get('/bot/health').catch(() => ({ data: {} })),
        api.get('/dashboard/revenue-history'),
        api.get('/dashboard/activity'),
      ]);
      setStats(s.data);
      setBot(b.data);
      setHealth(h.data);
      setRevenue(Array.isArray(r.data) ? r.data : []);
      setActivity(Array.isArray(a.data) ? a.data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    const handler = () => load();
    window.addEventListener('admin-refresh', handler);
    return () => { clearInterval(t); window.removeEventListener('admin-refresh', handler); };
  }, [load]);

  const toggleBot = async () => {
    setToggling(true);
    try {
      if (bot?.isActive) await api.post('/bot/stop');
      else await api.post('/bot/start');
      const { data } = await api.get('/bot/status');
      setBot(data);
    } catch { /* silent */ }
    finally { setToggling(false); }
  };

  const runManual = async (task: string) => {
    setRunning(task);
    try {
      await api.post(`/bot/run/${task}`);
      setTimeout(load, 2000);
    } catch { /* silent */ }
    finally { setTimeout(() => setRunning(null), 1500); }
  };

  const mrr = stats?.revenue?.mrr ?? 0;
  const callsToday = bot?.callsToday ?? stats?.calls?.today ?? 0;
  const quota = bot?.callsQuotaDaily ?? 50;
  const callProgress = Math.min((callsToday / quota) * 100, 100);

  return (
    <div className="space-y-5">

      {/* ═══ BOT CONTROL PANEL ═══ */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">

          {/* Bot Status + Toggle */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <button
              onClick={toggleBot}
              disabled={toggling}
              className={`relative flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50
                ${bot?.isActive
                  ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                  : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'}`}
            >
              {toggling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : bot?.isActive ? (
                <><span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" /><Square className="w-4 h-4" /> Arrêter le bot</>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-[#22C55E]" /><Play className="w-4 h-4" /> Démarrer le bot</>
              )}
            </button>

            {/* Call quota progress */}
            <div className="hidden sm:block min-w-[140px]">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-[#8B8BA7]">Appels</span>
                <span className="font-semibold text-[#F8F8FF]">{callsToday}/{quota}</span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${callProgress}%`, background: callProgress >= 90 ? '#EF4444' : callProgress >= 60 ? '#F59E0B' : '#7B5CF0' }} />
              </div>
            </div>
          </div>

          {/* Service Health */}
          <div className="flex flex-wrap gap-1.5 lg:ml-auto">
            {health && (
              <>
                <HealthDot ok={health.vapi} label="VAPI" />
                <HealthDot ok={health.openai} label="OpenAI" />
                <HealthDot ok={health.twilio} label="Twilio" />
                <HealthDot ok={health.stripe} label="Stripe" />
                <HealthDot ok={health.resend} label="Email" />
                <HealthDot ok={health.database} label="DB" />
              </>
            )}
          </div>
        </div>

        {/* Pipeline Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          <PipelineStep
            label="Prospection" value={stats?.prospects?.total ?? bot?.prospectsFound ?? 0}
            sub={`Dernière: ${ago(bot?.lastRunProspecting ?? bot?.lastProspection)}`}
            color="#7B5CF0" active={!!bot?.isActive}
          />
          <PipelineStep
            label="Appels" value={callsToday}
            sub={`Dernier: ${ago(bot?.lastRunCalling ?? bot?.lastCall)}`}
            color="#3B82F6" active={!!bot?.isActive}
          />
          <PipelineStep
            label="Follow-ups" value={bot?.followUpsSent ?? 0}
            sub={`Dernier: ${ago(bot?.lastRunFollowUp)}`}
            color="#F59E0B"
          />
          <PipelineStep
            label="Leads chauds" value={stats?.calls?.hotLeadsToday ?? 0}
            sub={`Score moyen: ${(stats?.calls?.avgInterestScore ?? 0).toFixed(1)}/10`}
            color="#22C55E"
          />
        </div>

        {/* Manual Run Buttons */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/[0.04]">
          <span className="text-[10px] text-[#8B8BA7] uppercase tracking-wider self-center mr-1">Exécuter :</span>
          {[
            { key: 'prospecting', label: 'Prospection', icon: Crosshair },
            { key: 'scoring', label: 'Scoring', icon: Target },
            { key: 'calling', label: 'Appel', icon: Phone },
            { key: 'followup', label: 'Follow-up', icon: Mail },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => runManual(key)} disabled={running === key}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                bg-white/[0.04] text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.08]
                border border-white/[0.04] hover:border-white/[0.1] transition-all disabled:opacity-50">
              {running === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ KPI GRID ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {loading ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <Link to="/admin/clients" className="block">
            <StatCard
              label="Clients" value={stats?.clients?.totalActive ?? 0}
              delta={stats?.clients?.newThisMonth ? 5 : 0}
              icon={<Building2 className="w-4 h-4" />}
              sparkData={[2, 3, 3, 4, 5, 5, stats?.clients?.totalActive ?? 5]}
            />
          </Link>
          <Link to="/admin/billing" className="block">
            <StatCard
              label="MRR" value={mrr} format="currency"
              delta={stats?.revenue?.mrrGrowth ?? 0}
              color="#22C55E"
              icon={<TrendingUp className="w-4 h-4" />}
              sparkData={revenue.slice(-7).map((r: any) => r.revenue ?? 0)}
            />
          </Link>
          <Link to="/admin/calls" className="block">
            <StatCard
              label="Appels" value={stats?.calls?.today ?? 0}
              icon={<Phone className="w-4 h-4" />}
              sparkData={[4, 6, 8, 5, 7, 9, stats?.calls?.today ?? 0]}
            />
          </Link>
          <Link to="/admin/leads" className="block">
            <StatCard
              label="Leads" value={stats?.calls?.hotLeadsToday ?? 0}
              color="#F59E0B"
              icon={<Zap className="w-4 h-4" />}
              sparkData={[1, 2, 1, 3, 2, 4, stats?.calls?.hotLeadsToday ?? 0]}
            />
          </Link>
          <Link to="/admin/prospects" className="block">
            <StatCard
              label="Conversion" value={stats?.conversion?.prospectToClient ?? 0}
              suffix="%" format="percent"
              icon={<Target className="w-4 h-4" />}
              sparkData={[1.2, 1.5, 1.8, 2.1, 1.9, 2.3, stats?.conversion?.prospectToClient ?? 0]}
            />
          </Link>
          <Link to="/admin/calls" className="block">
            <StatCard
              label="Score moyen" value={stats?.calls?.avgInterestScore ?? 0}
              suffix="/10"
              color={scoreColor(stats?.calls?.avgInterestScore ?? 0)}
              icon={<BarChart3 className="w-4 h-4" />}
              sparkData={[5, 5.5, 6, 6.2, 5.8, 6.5, stats?.calls?.avgInterestScore ?? 0]}
            />
          </Link>
        </>}
      </div>

      {/* ═══ CHARTS + ACTIVITY ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#F8F8FF]">Revenus</h3>
              <p className="text-xs text-[#8B8BA7]">Évolution MRR</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-[#F8F8FF] tabular-nums">${mrr.toLocaleString()}<span className="text-xs text-[#8B8BA7] font-normal">/mo</span></p>
              <p className="text-[10px] text-[#8B8BA7]">ARR ${(mrr * 12).toLocaleString()}</p>
            </div>
          </div>
          {loading ? <ChartSkeleton /> : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7B5CF0" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#7B5CF0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip contentStyle={{ background: '#1E1E2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: '#8B8BA7' }} itemStyle={{ color: '#F8F8FF' }}
                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenus']} />
                  <Area type="monotone" dataKey="revenue" stroke="#7B5CF0" strokeWidth={2} fill="url(#grad1)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Conversion + This Month */}
        <div className="space-y-4">
          {/* Conversion Rates */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-[#F8F8FF] mb-3">Taux de conversion</h3>
            {[
              { label: 'Prospect → Client', value: stats?.conversion?.prospectToClient ?? 0, color: '#7B5CF0' },
              { label: 'Devis acceptés', value: stats?.conversion?.quoteAcceptanceRate ?? 0, color: '#22C55E' },
              { label: 'Succès appels', value: stats?.calls?.successRate ?? 0, color: '#F59E0B' },
            ].map((item) => (
              <div key={item.label} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#8B8BA7]">{item.label}</span>
                  <span className="font-semibold text-[#F8F8FF]">{item.value.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(item.value, 100)}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* This Month Summary */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-[#F8F8FF] mb-3">Ce mois</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Revenus', value: `$${(stats?.revenue?.totalThisMonth ?? 0).toLocaleString()}`, color: '#22C55E' },
                { label: 'Setup fees', value: `$${(stats?.revenue?.setupFeesThisMonth ?? 0).toLocaleString()}`, color: '#7B5CF0' },
                { label: 'Nouveaux', value: String(stats?.clients?.newThisMonth ?? 0), color: '#3B82F6' },
                { label: 'Durée moy.', value: `${stats?.calls?.avgDuration ?? 0}s`, color: '#F59E0B' },
              ].map((s) => (
                <div key={s.label} className="bg-[#0D0D15] rounded-xl p-3">
                  <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] text-[#8B8BA7] mt-0.5 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ACTIVITY FEED ═══ */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#F8F8FF]">Activité récente</h3>
            {bot?.isActive && (
              <span className="flex items-center gap-1.5 text-[10px] text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />LIVE
              </span>
            )}
          </div>
          <Link to="/admin/calls" className="text-[11px] text-[#8B8BA7] hover:text-[#F8F8FF] flex items-center gap-1 transition-colors">
            Voir tout <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/[0.06] rounded w-40" />
                  <div className="h-2 bg-white/[0.04] rounded w-24" />
                </div>
                <div className="h-5 w-12 bg-white/[0.06] rounded-full" />
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <EmptyState icon={<Activity className="w-6 h-6" />} title="Aucune activité" description="Démarrez le bot pour voir l'activité." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {activity.slice(0, 12).map((item: any, i: number) => (
              <div key={i}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-all">
                <div className="w-9 h-9 rounded-xl bg-[#7B5CF0]/10 flex items-center justify-center flex-shrink-0 text-base">
                  {item.icon ?? '📞'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#F8F8FF] truncate">{item.message ?? item.businessName ?? 'Appel'}</p>
                  <p className="text-[10px] text-[#8B8BA7] mt-0.5">
                    {item.date ? ago(item.date) : ''}
                    {item.niche ? ` · ${item.niche}` : ''}
                  </p>
                </div>
                {item.interestScore !== undefined && (
                  <span className="text-xs font-bold flex-shrink-0 tabular-nums" style={{ color: scoreColor(item.interestScore) }}>
                    {item.interestScore}/10
                  </span>
                )}
                {item.outcome && <Badge label={item.outcome} dot size="xs" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ QUICK LINKS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { to: '/admin/prospects', label: 'Prospects', icon: Target, count: stats?.prospects?.total ?? 0, color: '#7B5CF0' },
          { to: '/admin/ai-learning', label: 'IA Learning', icon: Brain, count: null, color: '#F59E0B' },
          { to: '/admin/monitor', label: 'Moniteur live', icon: Gauge, count: null, color: '#3B82F6' },
          { to: '/admin/settings', label: 'Paramètres', icon: Settings, count: null, color: '#8B8BA7' },
        ].map(({ to, label, icon: Icon, count, color }) => (
          <Link key={to} to={to}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-[#12121A] border border-white/[0.06]
              hover:border-white/[0.12] hover:bg-white/[0.02] transition-all group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#F8F8FF] group-hover:text-white">{label}</p>
              {count !== null && <p className="text-[10px] text-[#8B8BA7]">{count} total</p>}
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#8B8BA7] opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}
