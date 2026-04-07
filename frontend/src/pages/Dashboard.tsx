import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Building2, Phone, TrendingUp, Zap, Target, BarChart3,
  Play, Square, RefreshCw, Clock, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import StatCard from '../components/ui/StatCard';
import { StatCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import SlideSheet from '../components/ui/SlideSheet';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const PIE_COLORS = ['#7B5CF0', '#6C47FF', '#22C55E', '#F59E0B', '#EF4444', '#6EE7B7', '#a78bfa'];

function scoreColor(s: number) {
  return s >= 7 ? '#22C55E' : s >= 4 ? '#F59E0B' : '#EF4444';
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [s, b, r, a] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/bot/status'),
        api.get('/dashboard/revenue-history'),
        api.get('/dashboard/activity'),
      ]);
      setStats(s.data);
      setBot(b.data);
      setRevenue(Array.isArray(r.data) ? r.data : []);
      setActivity(Array.isArray(a.data) ? a.data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
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

  const nicheData = Object.entries(
    (activity ?? []).reduce((acc: Record<string, number>, a: any) => {
      if (a.niche) acc[a.niche] = (acc[a.niche] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })).slice(0, 7);

  const mrr = stats?.revenue?.mrr ?? 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Vue d'ensemble</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Bot toggle */}
          <button
            onClick={toggleBot}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all disabled:opacity-50
              ${bot?.isActive
                ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${bot?.isActive ? 'bg-[#EF4444] animate-pulse' : 'bg-[#22C55E]'}`} />
            {bot?.isActive
              ? <><Square className="w-3.5 h-3.5" />Stopper</>
              : <><Play className="w-3.5 h-3.5" />Démarrer</>}
            <span className="opacity-60 text-xs ml-1">{bot?.callsToday ?? 0}/{bot?.callsQuotaDaily ?? 50}</span>
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard
            label="Clients actifs" value={stats?.clients?.totalActive ?? 0}
            delta={stats?.clients?.newThisMonth ? 5 : 0}
            icon={<Building2 className="w-4 h-4" />}
            sparkData={[2, 3, 3, 4, 5, 5, stats?.clients?.totalActive ?? 5]}
          />
          <StatCard
            label="MRR" value={mrr} format="currency"
            delta={stats?.revenue?.mrrGrowth ?? 0}
            color="#22C55E"
            icon={<TrendingUp className="w-4 h-4" />}
            sparkData={revenue.slice(-7).map((r: any) => r.revenue ?? 0)}
          />
          <StatCard
            label="Appels aujourd'hui" value={stats?.calls?.today ?? 0}
            icon={<Phone className="w-4 h-4" />}
            sparkData={[4, 6, 8, 5, 7, 9, stats?.calls?.today ?? 0]}
          />
          <StatCard
            label="Leads chauds" value={stats?.calls?.hotLeadsToday ?? 0}
            color="#F59E0B"
            icon={<Zap className="w-4 h-4" />}
            sparkData={[1, 2, 1, 3, 2, 4, stats?.calls?.hotLeadsToday ?? 0]}
          />
          <StatCard
            label="Conversion" value={stats?.conversion?.prospectToClient ?? 0}
            suffix="%" format="percent"
            delta={0.3}
            icon={<Target className="w-4 h-4" />}
            sparkData={[1.2, 1.5, 1.8, 2.1, 1.9, 2.3, stats?.conversion?.prospectToClient ?? 0]}
          />
          <StatCard
            label="Score moyen" value={stats?.calls?.avgInterestScore ?? 0}
            suffix="/10"
            color={scoreColor(stats?.calls?.avgInterestScore ?? 0)}
            icon={<BarChart3 className="w-4 h-4" />}
            sparkData={[5, 5.5, 6, 6.2, 5.8, 6.5, stats?.calls?.avgInterestScore ?? 0]}
          />
        </>}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Revenue Area Chart */}
        <div className="lg:col-span-3 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#F8F8FF]">Croissance MRR</h3>
              <p className="text-xs text-[#8B8BA7] mt-0.5">30 derniers jours</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-[#F8F8FF] tabular-nums">${(mrr * 12).toLocaleString()}</p>
              <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide">ARR</p>
            </div>
          </div>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7B5CF0" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#7B5CF0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} width={45}
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

        {/* Niche Donut */}
        <div className="lg:col-span-2 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#F8F8FF]">Appels par niche</h3>
            <p className="text-xs text-[#8B8BA7] mt-0.5">Distribution</p>
          </div>
          {loading ? <ChartSkeleton height="h-52" /> : nicheData.length === 0 ? (
            <div className="h-52 flex items-center justify-center">
              <EmptyState icon={<BarChart3 className="w-6 h-6" />} title="Aucune donnée" />
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={nicheData} cx="50%" cy="45%" innerRadius={50} outerRadius={72} dataKey="value" paddingAngle={2}>
                    {nicheData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={6}
                    formatter={(v) => <span style={{ color: '#8B8BA7', fontSize: 10 }}>{v}</span>} />
                  <Tooltip contentStyle={{ background: '#1E1E2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Live Activity Feed */}
        <div className="lg:col-span-3 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#F8F8FF]">Activité récente</h3>
            <span className="flex items-center gap-1.5 text-[10px] text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />LIVE
            </span>
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
            <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-hide">
              {activity.slice(0, 15).map((item: any, i: number) => (
                <button key={i} onClick={() => setSelected(item)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-all text-left group">
                  <div className="w-9 h-9 rounded-xl bg-[#7B5CF0]/10 flex items-center justify-center flex-shrink-0 text-base">
                    {item.icon ?? '📞'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#F8F8FF] truncate">{item.message ?? item.businessName ?? 'Appel'}</p>
                    <p className="text-[10px] text-[#8B8BA7] mt-0.5">
                      {item.date ? formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: fr }) : ''}
                    </p>
                  </div>
                  {item.interestScore !== undefined && (
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: scoreColor(item.interestScore) }}>
                      {item.interestScore}/10
                    </span>
                  )}
                  {item.outcome && <Badge label={item.outcome} dot size="xs" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Conversion Progress */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Taux de conversion</h3>
            {[
              { label: 'Prospect → Client', value: stats?.conversion?.prospectToClient ?? 0, color: '#7B5CF0' },
              { label: 'Acceptation devis', value: stats?.conversion?.quoteAcceptanceRate ?? 0, color: '#22C55E' },
              { label: 'Taux succès appels', value: stats?.calls?.successRate ?? 0, color: '#F59E0B' },
            ].map((item) => (
              <div key={item.label} className="mb-4 last:mb-0">
                <div className="flex justify-between text-xs mb-1.5">
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

          {/* This Month */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-[#F8F8FF] mb-3">Ce mois</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Frais setup', value: `$${(stats?.revenue?.setupFeesThisMonth ?? 0).toLocaleString()}` },
                { label: 'Total revenus', value: `$${(stats?.revenue?.totalThisMonth ?? 0).toLocaleString()}` },
                { label: 'Nouveaux clients', value: String(stats?.clients?.newThisMonth ?? 0) },
                { label: 'Durée moyenne', value: `${stats?.calls?.avgDuration ?? 0}s` },
              ].map((s) => (
                <div key={s.label} className="bg-[#0D0D15] rounded-xl p-3">
                  <p className="text-base font-bold tabular-nums text-[#F8F8FF]">{s.value}</p>
                  <p className="text-[10px] text-[#8B8BA7] mt-0.5 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-4">
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                { label: 'Cette heure', value: stats?.calls?.thisHour ?? 0, icon: <Clock className="w-3.5 h-3.5" /> },
                { label: 'Voicemails', value: stats?.calls?.voicemails ?? 0, icon: <Phone className="w-3.5 h-3.5" /> },
                { label: 'Leads', value: stats?.calls?.leadsToday ?? 0, icon: <Zap className="w-3.5 h-3.5" /> },
                { label: 'Succès %', value: `${(stats?.calls?.successRate ?? 0).toFixed(0)}%`, icon: <TrendingUp className="w-3.5 h-3.5" /> },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1 p-2">
                  <span className="text-[#8B8BA7]">{s.icon}</span>
                  <p className="text-base font-bold tabular-nums text-[#F8F8FF]">{s.value}</p>
                  <p className="text-[9px] text-[#8B8BA7] uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Call Detail Sheet */}
      <SlideSheet open={!!selected} onClose={() => setSelected(null)}
        title={selected?.businessName ?? selected?.message ?? 'Détail appel'}
        subtitle={selected?.city}>
        {selected && (
          <div className="space-y-4">
            {selected.interestScore !== undefined && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#0D0D15]">
                <span className="text-sm text-[#8B8BA7]">Score d'intérêt</span>
                <span className="text-2xl font-bold" style={{ color: scoreColor(selected.interestScore) }}>
                  {selected.interestScore}/10
                </span>
              </div>
            )}
            {selected.outcome && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#8B8BA7]">Résultat :</span>
                <Badge label={selected.outcome} dot />
              </div>
            )}
            {selected.message && (
              <p className="text-sm text-[#F8F8FF] bg-[#0D0D15] rounded-xl p-4 leading-relaxed">{selected.message}</p>
            )}
            {selected.date && (
              <p className="text-xs text-[#8B8BA7]">{new Date(selected.date).toLocaleString('fr-FR')}</p>
            )}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
