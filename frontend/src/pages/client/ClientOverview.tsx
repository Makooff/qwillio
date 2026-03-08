import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone, Calendar, Users, Clock, Star, AlertCircle, ArrowRight, TrendingUp,
  PhoneForwarded, Pause, Play, Download, Activity, Zap, BarChart3,
  ChevronRight, Shield
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '../../stores/langStore';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { formatDuration, formatDateTime, formatShortDate, daysUntil } from '../../utils/format';

function getGreeting(name: string): string {
  const h = new Date().getHours();
  const first = name?.split(' ')[0] || name;
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'];
const SENTIMENT_COLORS: Record<string, string> = { positive: '#10b981', neutral: '#f59e0b', negative: '#ef4444' };

export default function ClientOverview() {
  const { t } = useLang();
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analytics30, setAnalytics30] = useState<any>(null);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [ov, an7, an30, calls] = await Promise.all([
        api.get('/my-dashboard/overview'),
        api.get('/my-dashboard/analytics?days=7'),
        api.get('/my-dashboard/analytics?days=30'),
        api.get('/my-dashboard/calls?page=1&limit=8'),
      ]);
      setData(ov.data);
      setAnalytics(an7.data);
      setAnalytics30(an30.data);
      setRecentCalls(calls.data?.data || []);
    } catch (err) {
      console.error('Overview fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleToggleAgent = async () => {
    const isActive = data?.client?.subscriptionStatus === 'active' || data?.client?.subscriptionStatus === 'trialing';
    try {
      await api.post(`/my-dashboard/${isActive ? 'pause' : 'resume'}`);
      fetchAll();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[#86868b]">{t('cdash.loading')}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const ov = data;
  const client = ov.client || {};
  const isActive = client.subscriptionStatus === 'active' || client.subscriptionStatus === 'trialing';
  const sentimentTotal = (ov.sentiment?.positive || 0) + (ov.sentiment?.neutral || 0) + (ov.sentiment?.negative || 0);
  const positiveRate = sentimentTotal > 0 ? Math.round(((ov.sentiment?.positive || 0) / sentimentTotal) * 100) : 0;
  const conversionRate = (ov.calls?.thisMonth || 0) > 0
    ? Math.round(((ov.leads?.thisMonth || 0) / ov.calls.thisMonth) * 100)
    : 0;

  const sentimentPie = sentimentTotal > 0
    ? Object.entries(ov.sentiment || {}).map(([k, v]) => ({ name: k, value: v as number })).filter(d => d.value > 0)
    : [];

  const hourData = analytics30?.peakHours
    ? Object.entries(analytics30.peakHours).map(([h, v]) => ({ hour: `${h}h`, calls: v as number }))
    : [];

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div>
      {/* ── Header with greeting ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">{getGreeting(user?.name || '')}</h1>
        <p className="text-sm text-[#86868b]">{dateStr}</p>
      </motion.div>

      {/* ── Quick actions ── */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={handleToggleAgent}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
            isActive
              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          {isActive ? <><Pause size={15} /> Pause AI</> : <><Play size={15} /> Resume AI</>}
        </button>
        <Link to="/dashboard/leads" className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d2d2d7]/60 transition-all">
          <Users size={15} /> View Leads
        </Link>
        <Link to="/dashboard/analytics" className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d2d2d7]/60 transition-all">
          <BarChart3 size={15} /> Analytics
        </Link>
      </div>

      {/* ── Trial / Alert banners ── */}
      <AnimatePresence>
        {client.isTrial && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 bg-gradient-to-r from-[#6366f1]/5 to-purple-500/5 border border-[#6366f1]/20 rounded-2xl px-6 py-4 mb-6"
          >
            <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center flex-shrink-0">
              <Shield size={20} className="text-[#6366f1]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Free trial — <strong>{daysUntil(client.trialEndDate)} days remaining</strong></p>
              <p className="text-xs text-[#86868b]">Upgrade anytime to keep your AI receptionist running</p>
            </div>
            <Link to="/dashboard/billing" className="inline-flex items-center gap-1 text-sm font-semibold text-[#6366f1] hover:underline whitespace-nowrap">
              Upgrade <ArrowRight size={14} />
            </Link>
          </motion.div>
        )}
        {!client.transferNumber && !client.isTrial && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-6 py-4 mb-6"
          >
            <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">Transfer number not set — calls needing human help can't be transferred.</p>
            <Link to="/dashboard/receptionist" className="ml-auto text-sm font-medium text-red-600 hover:underline whitespace-nowrap">Set up now</Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPI Row 1 — Core metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'Calls today', value: ov.calls?.today || 0, icon: Phone, color: 'blue', sub: `${ov.calls?.thisWeek || 0} this week` },
          { label: 'Calls this month', value: ov.calls?.thisMonth || 0, icon: Phone, color: 'indigo', sub: `${ov.calls?.total || 0} all time` },
          { label: 'Leads captured', value: ov.leads?.thisMonth || 0, icon: Users, color: 'amber' },
          { label: 'Conversion rate', value: `${conversionRate}%`, icon: Zap, color: 'purple' },
          { label: 'Avg. duration', value: formatDuration(ov.calls?.avgDuration), icon: Clock, color: 'cyan' },
          { label: 'Positive rate', value: `${positiveRate}%`, icon: Star, color: 'emerald' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5 hover:shadow-md hover:border-[#d2d2d7] transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${kpi.color}-50 text-${kpi.color}-600`}>
                <kpi.icon size={18} />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
            <p className="text-xs text-[#86868b] mt-1">{kpi.label}</p>
            {kpi.sub && <p className="text-[10px] text-[#86868b]/60 mt-0.5">{kpi.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* ── KPI Row 2 — Plan & quota ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Plan card */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] p-5 text-white">
          <p className="text-xs font-medium text-white/70 mb-1">Current plan</p>
          <p className="text-xl font-bold capitalize mb-3">{client.planType || 'Starter'}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">${Number(client.monthlyFee || 197).toFixed(0)}</span>
            <span className="text-sm text-white/70">/mo</span>
          </div>
          <Link to="/dashboard/billing" className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-white/80 hover:text-white">
            Manage plan <ChevronRight size={12} />
          </Link>
        </div>

        {/* Quota */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5">
          <p className="text-xs text-[#86868b] mb-1">Monthly quota</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold">{ov.calls?.quotaUsed || 0}</span>
            <span className="text-sm text-[#86868b]">/ {ov.calls?.quota || 0} calls</span>
          </div>
          <div className="h-2.5 bg-[#f5f5f7] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (ov.calls?.quotaPercent || 0) > 90 ? 'bg-red-500' : (ov.calls?.quotaPercent || 0) > 70 ? 'bg-amber-500' : 'bg-[#6366f1]'
              }`}
              style={{ width: `${Math.min(ov.calls?.quotaPercent || 0, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[#86868b] mt-2">{ov.calls?.quotaPercent || 0}% used</p>
        </div>

        {/* Agent status */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5">
          <p className="text-xs text-[#86868b] mb-1">AI receptionist</p>
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-3 h-3 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-lg font-bold">{isActive ? 'Active' : 'Paused'}</span>
          </div>
          <p className="text-xs text-[#86868b]">
            {client.vapiPhoneNumber ? `Answering on ${client.vapiPhoneNumber}` : 'No phone number assigned'}
          </p>
          <Link to="/dashboard/receptionist" className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-[#6366f1] hover:underline">
            Configure <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {/* ── Charts Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 30-day call trend */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-1">Calls per day</h3>
          <p className="text-xs text-[#86868b] mb-4">Last 30 days</p>
          <div className="h-56">
            {analytics30?.daily && analytics30.daily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics30.daily}>
                  <defs>
                    <linearGradient id="gradOv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#86868b' }} tickFormatter={d => formatShortDate(d)} />
                  <YAxis tick={{ fontSize: 10, fill: '#86868b' }} width={30} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Area type="monotone" dataKey="calls" stroke="#6366f1" fill="url(#gradOv)" strokeWidth={2} name="Calls" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#86868b]">No data yet</div>
            )}
          </div>
        </div>

        {/* Calls by hour */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-1">Peak hours</h3>
          <p className="text-xs text-[#86868b] mb-4">When your calls come in</p>
          <div className="h-56">
            {hourData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#86868b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#86868b' }} width={30} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} name="Calls" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#86868b]">No data yet</div>
            )}
          </div>
        </div>

        {/* Sentiment donut */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-1">Call sentiment</h3>
          <p className="text-xs text-[#86868b] mb-4">Disposition breakdown</p>
          <div className="h-56 flex items-center justify-center">
            {sentimentPie.length > 0 ? (
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {sentimentPie.map((entry, i) => (
                        <Cell key={i} fill={SENTIMENT_COLORS[entry.name] || COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {sentimentPie.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: SENTIMENT_COLORS[s.name] || COLORS[i] }} />
                      <span className="text-sm capitalize">{s.name}</span>
                      <span className="text-sm font-semibold ml-auto">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#86868b]">No sentiment data</p>
            )}
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold mb-0.5 flex items-center gap-2">
                <Activity size={15} className="text-[#6366f1]" /> Live activity
              </h3>
              <p className="text-xs text-[#86868b]">Updates every 30s</p>
            </div>
            <Link to="/dashboard/calls" className="text-xs font-medium text-[#6366f1] hover:underline">View all</Link>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            <AnimatePresence>
              {recentCalls.length > 0 ? recentCalls.map((call: any, i: number) => (
                <motion.div key={call.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-[#f5f5f7] transition-colors cursor-pointer group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    call.isLead ? 'bg-amber-50 text-amber-600' : call.bookingRequested ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {call.isLead ? <Users size={14} /> : call.bookingRequested ? <Calendar size={14} /> : <Phone size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {call.callerName || call.callerNumber?.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') || 'Unknown'}
                    </p>
                    <p className="text-[11px] text-[#86868b]">
                      {formatDuration(call.durationSeconds)} · {call.sentiment || 'neutral'}
                      {call.isLead && <span className="ml-1 text-amber-600 font-medium">· Lead</span>}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#86868b] group-hover:text-[#6366f1] transition-colors">{formatDateTime(call.createdAt)}</span>
                </motion.div>
              )) : (
                <p className="text-sm text-[#86868b] text-center py-8">No recent calls</p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Insights Panel ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-2xl border border-[#d2d2d7]/60 bg-gradient-to-br from-white to-[#f5f5f7] p-6"
      >
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Zap size={15} className="text-[#6366f1]" /> AI insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white border border-[#d2d2d7]/40 p-4">
            <p className="text-xs font-medium text-[#6366f1] mb-2">Weekly summary</p>
            <p className="text-sm text-[#1d1d1f] leading-relaxed">
              Your AI receptionist handled <strong>{ov.calls?.thisWeek || 0} calls</strong> this week,
              captured <strong>{ov.leads?.thisMonth || 0} leads</strong> this month,
              with {ov.bookings?.thisMonth || 0} appointments booked.
              {positiveRate > 70 && ' Caller sentiment is excellent!'}
            </p>
          </div>
          <div className="rounded-xl bg-white border border-[#d2d2d7]/40 p-4">
            <p className="text-xs font-medium text-emerald-600 mb-2">Performance</p>
            <p className="text-sm text-[#1d1d1f] leading-relaxed">
              Average call duration is <strong>{formatDuration(ov.calls?.avgDuration)}</strong>.
              {conversionRate > 0 ? ` Your lead conversion rate is ${conversionRate}%.` : ''}
              {(ov.calls?.quota || 0) > 0 && ` You've used ${ov.calls?.quotaPercent || 0}% of your monthly quota.`}
            </p>
          </div>
          <div className="rounded-xl bg-white border border-[#d2d2d7]/40 p-4">
            <p className="text-xs font-medium text-amber-600 mb-2">Recommendations</p>
            <p className="text-sm text-[#1d1d1f] leading-relaxed">
              {!client.transferNumber
                ? 'Set up a transfer number so your AI can route urgent calls to a human.'
                : conversionRate < 10
                  ? 'Review your call scripts to improve lead capture rate.'
                  : 'Your setup looks great! Consider upgrading to handle more call volume.'}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
