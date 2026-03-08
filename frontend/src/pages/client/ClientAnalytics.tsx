import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Phone, Users, Clock, Star, Zap,
  ArrowUp, ArrowDown, DollarSign, Calculator
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend
} from 'recharts';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';
import { formatDuration, formatShortDate } from '../../utils/format';

const SENTIMENT_COLORS: Record<string, string> = { positive: '#10b981', neutral: '#f59e0b', negative: '#ef4444' };

export default function ClientAnalytics() {
  const { t } = useLang();
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<any>(null);
  const [compareData, setCompareData] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ROI calculator
  const [costPerLead, setCostPerLead] = useState(50);
  const [avgDealValue, setAvgDealValue] = useState(500);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [an, compare, ov] = await Promise.all([
        api.get(`/my-dashboard/analytics?days=${period}`),
        api.get(`/my-dashboard/analytics?days=${period * 2}`),
        api.get('/my-dashboard/overview'),
      ]);
      setData(an.data);
      setCompareData(compare.data);
      setOverview(ov.data);
    } catch (err) {
      console.error('Analytics fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const summary = data.summary || {};
  const daily = data.daily || [];

  // Calculate period-over-period changes
  const prevCalls = (compareData?.summary?.totalCalls || 0) - summary.totalCalls;
  const callsDelta = prevCalls > 0 ? Math.round(((summary.totalCalls - prevCalls) / prevCalls) * 100) : 0;
  const prevLeads = (compareData?.summary?.totalLeads || 0) - summary.totalLeads;
  const leadsDelta = prevLeads > 0 ? Math.round(((summary.totalLeads - prevLeads) / prevLeads) * 100) : 0;

  // Sentiment pie
  const sentimentPie = data.sentiment
    ? Object.entries(data.sentiment).filter(([, v]) => (v as number) > 0).map(([k, v]) => ({ name: k, value: v as number }))
    : [];

  // Peak hours
  const hourData = data.peakHours
    ? Object.entries(data.peakHours).map(([h, v]) => ({ hour: `${h}h`, calls: v as number })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour))
    : [];

  // Day distribution
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayData = data.peakDays
    ? Object.entries(data.peakDays).map(([d, v]) => ({ day: dayNames[parseInt(d)] || d, calls: v as number }))
    : [];

  // ROI
  const leadsValue = summary.totalLeads * costPerLead;
  const potentialRevenue = summary.totalLeads * avgDealValue * (summary.conversionRate / 100);
  const monthlyFee = overview?.client?.monthlyFee || 197;
  const roi = monthlyFee > 0 ? Math.round(((potentialRevenue - monthlyFee) / monthlyFee) * 100) : 0;

  // Conversion funnel
  const funnelData = [
    { stage: 'Total calls', value: summary.totalCalls, color: '#6366f1' },
    { stage: 'Leads captured', value: summary.totalLeads, color: '#8b5cf6' },
    { stage: 'Est. conversions', value: Math.round(summary.totalLeads * (summary.conversionRate / 100)), color: '#10b981' },
  ];

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-[#86868b]">Performance insights for your AI receptionist</p>
        </div>
        <div className="flex items-center gap-1 bg-[#f5f5f7] rounded-xl p-1">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setPeriod(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                period === d ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total calls', value: summary.totalCalls, delta: callsDelta, icon: Phone, color: 'blue' },
          { label: 'Leads captured', value: summary.totalLeads, delta: leadsDelta, icon: Users, color: 'amber' },
          { label: 'Conversion rate', value: `${summary.conversionRate}%`, icon: Zap, color: 'purple' },
          { label: 'Avg duration', value: formatDuration(summary.avgCallDuration), icon: Clock, color: 'cyan' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <kpi.icon size={16} className="text-[#86868b]" />
              {kpi.delta !== undefined && kpi.delta !== 0 && (
                <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${kpi.delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {kpi.delta > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                  {Math.abs(kpi.delta)}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs text-[#86868b] mt-0.5">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Call volume trend */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-1">Call volume</h3>
          <p className="text-xs text-[#86868b] mb-4">Daily call & lead trends</p>
          <div className="h-64">
            {daily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="gradCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#86868b' }} tickFormatter={d => formatShortDate(d)} />
                  <YAxis tick={{ fontSize: 10, fill: '#86868b' }} width={30} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, fontSize: 12 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="calls" stroke="#6366f1" fill="url(#gradCalls)" strokeWidth={2} name="Calls" />
                  <Area type="monotone" dataKey="leads" stroke="#f59e0b" fill="url(#gradLeads)" strokeWidth={2} name="Leads" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#86868b]">No data yet</div>
            )}
          </div>
        </div>

        {/* Sentiment breakdown */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-1">Sentiment analysis</h3>
          <p className="text-xs text-[#86868b] mb-4">Caller satisfaction breakdown</p>
          <div className="h-64 flex items-center justify-center">
            {sentimentPie.length > 0 ? (
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {sentimentPie.map((entry, i) => (
                        <Cell key={i} fill={SENTIMENT_COLORS[entry.name] || '#d2d2d7'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {sentimentPie.map((s, i) => {
                    const total = sentimentPie.reduce((sum, p) => sum + p.value, 0);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full" style={{ background: SENTIMENT_COLORS[s.name] }} />
                        <div>
                          <span className="text-sm font-medium capitalize">{s.name}</span>
                          <span className="text-xs text-[#86868b] ml-2">{Math.round((s.value / total) * 100)}%</span>
                        </div>
                        <span className="text-sm font-bold ml-auto">{s.value}</span>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t border-[#d2d2d7]/40">
                    <p className="text-xs text-[#86868b]">Satisfaction score</p>
                    <p className="text-lg font-bold text-[#6366f1]">{summary.satisfactionScore}%</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#86868b]">No sentiment data</p>
            )}
          </div>
        </div>

        {/* Peak hours */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-1">Peak hours</h3>
          <p className="text-xs text-[#86868b] mb-4">When your calls come in</p>
          <div className="h-56">
            {hourData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#86868b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#86868b' }} width={25} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} name="Calls" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#86868b]">No data yet</div>
            )}
          </div>
        </div>

        {/* Day distribution */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-1">Calls by day</h3>
          <p className="text-xs text-[#86868b] mb-4">Busiest days of the week</p>
          <div className="h-56">
            {dayData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#86868b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#86868b' }} width={25} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="calls" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Calls" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#86868b]">No data yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Conversion funnel */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 mb-6">
        <h3 className="text-sm font-semibold mb-4">Conversion funnel</h3>
        <div className="flex items-center gap-3">
          {funnelData.map((f, i) => (
            <div key={i} className="flex-1">
              <div className="rounded-xl p-4 text-center" style={{ background: `${f.color}10` }}>
                <p className="text-2xl font-bold" style={{ color: f.color }}>{f.value}</p>
                <p className="text-xs text-[#86868b] mt-1">{f.stage}</p>
              </div>
              {i < funnelData.length - 1 && (
                <div className="flex justify-center my-1">
                  <span className="text-xs text-[#86868b]">
                    {f.value > 0 ? `${Math.round((funnelData[i + 1].value / f.value) * 100)}%` : '0%'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ROI Calculator */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-2xl border border-[#d2d2d7]/60 bg-gradient-to-br from-white to-[#f5f5f7] p-6"
      >
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Calculator size={16} className="text-[#6366f1]" />
          ROI calculator
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">Cost per lead (manual)</label>
              <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-[#86868b]" />
                <input type="number" value={costPerLead} onChange={e => setCostPerLead(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#86868b] mb-1 block">Avg deal value</label>
              <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-[#86868b]" />
                <input type="number" value={avgDealValue} onChange={e => setAvgDealValue(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-white border border-[#d2d2d7]/40 p-4">
              <p className="text-xs text-[#86868b]">Leads captured (Qwillio)</p>
              <p className="text-xl font-bold text-[#6366f1]">{summary.totalLeads}</p>
            </div>
            <div className="rounded-xl bg-white border border-[#d2d2d7]/40 p-4">
              <p className="text-xs text-[#86868b]">Manual lead cost equivalent</p>
              <p className="text-xl font-bold text-amber-600">${leadsValue.toLocaleString()}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-white border border-[#d2d2d7]/40 p-4">
              <p className="text-xs text-[#86868b]">Potential revenue</p>
              <p className="text-xl font-bold text-emerald-600">${potentialRevenue.toLocaleString()}</p>
            </div>
            <div className={`rounded-xl p-4 ${roi > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="text-xs text-[#86868b]">ROI</p>
              <p className={`text-2xl font-bold ${roi > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{roi > 0 ? '+' : ''}{roi}%</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
