import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { DashboardStats, BotStatus } from '../types';
import {
  Users, Building2, Phone, Zap, TrendingUp, Clock,
  Play, Square, BarChart3, Target,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import MetricCard from '../components/dashboard/MetricCard';
import StatusBadge from '../components/dashboard/StatusBadge';
import { MetricCardSkeleton, ChartSkeleton } from '../components/dashboard/SkeletonLoader';
import SlideSheet from '../components/dashboard/SlideSheet';
import EmptyState from '../components/dashboard/EmptyState';
import { formatDistanceToNow } from 'date-fns';

const NICHE_COLORS = ['#7B5CF0', '#6C47FF', '#22C55E', '#F59E0B', '#EF4444', '#6EE7B7', '#a78bfa'];

const SCORE_COLOR = (s: number) => s >= 7 ? '#22C55E' : s >= 4 ? '#F59E0B' : '#EF4444';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [revenueHistory, setRevenueHistory] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [toggling, setToggling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, botRes, revenueRes, activityRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/bot/status'),
        api.get('/dashboard/revenue-history'),
        api.get('/dashboard/activity'),
      ]);
      setStats(statsRes.data);
      setBotStatus(botRes.data);
      setRevenueHistory(Array.isArray(revenueRes.data) ? revenueRes.data : []);
      setActivity(Array.isArray(activityRes.data) ? activityRes.data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    const handler = () => fetchData();
    window.addEventListener('admin-refresh', handler);
    return () => {
      clearInterval(interval);
      window.removeEventListener('admin-refresh', handler);
    };
  }, [fetchData]);

  const toggleBot = async () => {
    setToggling(true);
    try {
      if (botStatus?.isActive) await api.post('/bot/stop');
      else await api.post('/bot/start');
      const { data } = await api.get('/bot/status');
      setBotStatus(data);
    } catch { /* silent */ }
    finally { setToggling(false); }
  };

  // Build niche chart data from activity
  const nicheData = Object.entries(
    (activity ?? []).reduce((acc: Record<string, number>, a: any) => {
      if (a.niche) acc[a.niche] = (acc[a.niche] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })).slice(0, 7);

  const mrr = stats?.revenue?.mrr ?? 0;
  const arr = mrr * 12;

  return (
    <div className="space-y-6">

      {/* Page header + Bot toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Overview</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Qwillio performance dashboard</p>
        </div>
        <button
          onClick={toggleBot}
          disabled={toggling}
          className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all
            ${botStatus?.isActive
              ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
              : 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20'
            } disabled:opacity-50`}
        >
          <span className={`w-2 h-2 rounded-full ${botStatus?.isActive ? 'bg-[#EF4444] animate-pulse' : 'bg-[#22C55E]'}`} />
          {botStatus?.isActive ? <><Square className="w-3.5 h-3.5" />Stop bot</> : <><Play className="w-3.5 h-3.5" />Start bot</>}
          <span className="ml-1 text-xs opacity-60">
            {botStatus?.callsToday ?? 0}/{botStatus?.callsQuotaDaily ?? 50}
          </span>
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard
              label="Active Clients" value={stats?.clients?.totalActive ?? 0}
              delta={stats?.clients?.newThisMonth ? 5 : 0}
              icon={<Building2 className="w-4 h-4" />}
              sparkData={[2,3,3,4,5,5,stats?.clients?.totalActive ?? 5]}
            />
            <MetricCard
              label="MRR" value={mrr} prefix="$" format="currency"
              delta={stats?.revenue?.mrrGrowth ?? 0}
              icon={<TrendingUp className="w-4 h-4" />}
              colorClass="text-[#22C55E]"
              sparkData={revenueHistory.slice(-7).map((r: any) => r.revenue ?? 0)}
            />
            <MetricCard
              label="Calls Today" value={stats?.calls?.today ?? 0}
              icon={<Phone className="w-4 h-4" />}
              sparkData={[4,6,8,5,7,9,stats?.calls?.today ?? 0]}
            />
            <MetricCard
              label="Hot Leads" value={stats?.calls?.hotLeadsToday ?? 0}
              colorClass="text-[#F59E0B]"
              icon={<Zap className="w-4 h-4" />}
              sparkData={[1,2,1,3,2,4,stats?.calls?.hotLeadsToday ?? 0]}
            />
            <MetricCard
              label="Conversion" value={stats?.conversion?.prospectToClient ?? 0}
              suffix="%" format="percent"
              delta={0.3}
              icon={<Target className="w-4 h-4" />}
              sparkData={[1.2,1.5,1.8,2.1,1.9,2.3,stats?.conversion?.prospectToClient ?? 0]}
            />
            <MetricCard
              label="Avg Score" value={stats?.calls?.avgInterestScore ?? 0}
              suffix="/10"
              colorClass={`text-[${SCORE_COLOR(stats?.calls?.avgInterestScore ?? 0)}]`}
              icon={<BarChart3 className="w-4 h-4" />}
              sparkData={[5,5.5,6,6.2,5.8,6.5,stats?.calls?.avgInterestScore ?? 0]}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Revenue chart */}
        <div className="lg:col-span-3 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#F8F8FF]">Revenue Growth</h3>
              <p className="text-xs text-[#8B8BA7] mt-0.5">MRR last 30 days</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-[#F8F8FF] tabular-nums">${arr.toLocaleString()}</p>
              <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide">ARR</p>
            </div>
          </div>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueHistory}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7B5CF0" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#7B5CF0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} width={45}
                    tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    contentStyle={{ background: '#1E1E2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: '#8B8BA7' }}
                    itemStyle={{ color: '#F8F8FF' }}
                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#7B5CF0" strokeWidth={2} fill="url(#gradRev)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Calls by niche donut */}
        <div className="lg:col-span-2 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#F8F8FF]">Calls by Niche</h3>
            <p className="text-xs text-[#8B8BA7] mt-0.5">Distribution today</p>
          </div>
          {loading ? <ChartSkeleton height="h-52" /> : nicheData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-[#8B8BA7] text-sm">No data yet</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={nicheData} cx="50%" cy="45%" innerRadius={50} outerRadius={75}
                    dataKey="value" nameKey="name" paddingAngle={2}>
                    {nicheData.map((_: any, i: number) => (
                      <Cell key={i} fill={NICHE_COLORS[i % NICHE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle" iconSize={6}
                    formatter={(v) => <span style={{ color: '#8B8BA7', fontSize: 10 }}>{v}</span>}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1E1E2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                    itemStyle={{ color: '#F8F8FF' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Live feed + Quick stats */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Live call feed */}
        <div className="lg:col-span-3 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#F8F8FF]">Live Call Feed</h3>
            <span className="flex items-center gap-1.5 text-[10px] text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />LIVE
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/[0.06] rounded w-32" />
                    <div className="h-2.5 bg-white/[0.04] rounded w-20" />
                  </div>
                  <div className="h-5 w-10 bg-white/[0.06] rounded-full" />
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <EmptyState
              icon={<Phone className="w-6 h-6" />}
              title="No calls yet"
              description="Start the bot to begin making calls."
            />
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-hide">
              {activity.slice(0, 15).map((item: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setSelectedCall(item)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#7B5CF0]/10 flex items-center justify-center flex-shrink-0 text-sm">
                    {item.icon ?? '📞'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#F8F8FF] truncate">{item.message ?? item.businessName ?? 'Call'}</p>
                    <p className="text-[10px] text-[#8B8BA7] mt-0.5">
                      {item.date ? formatDistanceToNow(new Date(item.date), { addSuffix: true }) : ''}
                    </p>
                  </div>
                  {item.interestScore !== undefined && (
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: SCORE_COLOR(item.interestScore) }}>
                      {item.interestScore}/10
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right column: quick stats */}
        <div className="lg:col-span-2 space-y-4">

          {/* Conversion rates */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Conversion Rates</h3>
            <div className="space-y-4">
              {[
                { label: 'Prospect → Client', value: stats?.conversion?.prospectToClient ?? 0, color: '#7B5CF0' },
                { label: 'Quote Acceptance', value: stats?.conversion?.quoteAcceptanceRate ?? 0, color: '#22C55E' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#8B8BA7]">{item.label}</span>
                    <span className="font-semibold text-[#F8F8FF]">{item.value.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(item.value, 100)}%`, background: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats bar */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-[#F8F8FF] mb-3">This Month</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Setup Fees', value: `$${(stats?.revenue?.setupFeesThisMonth ?? 0).toLocaleString()}` },
                { label: 'Total Revenue', value: `$${(stats?.revenue?.totalThisMonth ?? 0).toLocaleString()}` },
                { label: 'New Clients', value: String(stats?.clients?.newThisMonth ?? 0) },
                { label: 'Avg Duration', value: `${stats?.calls?.avgDuration ?? 0}s` },
              ].map((s) => (
                <div key={s.label} className="bg-[#0D0D15] rounded-xl p-3">
                  <p className="text-lg font-bold tabular-nums text-[#F8F8FF]">{s.value}</p>
                  <p className="text-[10px] text-[#8B8BA7] mt-0.5 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hour stats */}
          <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              {[
                { label: 'This Hour', value: stats?.calls?.thisHour ?? 0, icon: <Clock className="w-3.5 h-3.5" /> },
                { label: 'Voicemails', value: stats?.calls?.voicemails ?? 0, icon: <Phone className="w-3.5 h-3.5" /> },
                { label: 'Leads', value: stats?.calls?.leadsToday ?? 0, icon: <Zap className="w-3.5 h-3.5" /> },
                { label: 'Success %', value: `${(stats?.calls?.successRate ?? 0).toFixed(0)}%`, icon: <TrendingUp className="w-3.5 h-3.5" /> },
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

      {/* Call detail sheet */}
      <SlideSheet
        open={!!selectedCall}
        onClose={() => setSelectedCall(null)}
        title={selectedCall?.businessName ?? selectedCall?.message ?? 'Call Detail'}
        subtitle={selectedCall?.city}
      >
        {selectedCall && (
          <div className="space-y-4">
            {selectedCall.interestScore !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-[#8B8BA7] text-sm">Interest score:</span>
                <span className="text-xl font-bold" style={{ color: SCORE_COLOR(selectedCall.interestScore) }}>
                  {selectedCall.interestScore}/10
                </span>
              </div>
            )}
            {selectedCall.outcome && (
              <div>
                <span className="text-[#8B8BA7] text-sm">Outcome: </span>
                <StatusBadge status={selectedCall.outcome} />
              </div>
            )}
            {selectedCall.message && (
              <p className="text-sm text-[#F8F8FF] bg-[#0D0D15] rounded-xl p-4">{selectedCall.message}</p>
            )}
            {selectedCall.date && (
              <p className="text-xs text-[#8B8BA7]">
                {new Date(selectedCall.date).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
