import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Phone, Users, Clock, Zap, ArrowUp, ArrowDown, DollarSign, Calculator } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import api from '../../services/api';
import { formatDuration, formatShortDate } from '../../utils/format';
import OrbsLoader from "../../components/OrbsLoader";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#34d399',
  neutral: '#fbbf24',
  negative: '#f87171',
};

const TOOLTIP_STYLE = {
  background: '#12121A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  fontSize: 12,
  color: '#F8F8FF',
};

export default function ClientAnalytics() {
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<any>(null);
  const [compareData, setCompareData] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [costPerLead, setCostPerLead] = useState(50);
  const [avgDealValue, setAvgDealValue] = useState(500);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [an, compare, ov] = await Promise.all([
        api.get(`/my-dashboard/analytics?days=${period}`),
        api.get(`/my-dashboard/analytics?days=${period * 2}`).catch(() => ({ data: null })),
        api.get('/my-dashboard/overview').catch(() => ({ data: null })),
      ]);
      setData(an.data);
      setCompareData(compare.data);
      setOverview(ov.data);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) setError('no-profile');
      else setError(err?.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <OrbsLoader size={120} fullscreen={false} />
      </div>
    );
  }

  if (error === 'no-profile' || (!data && !loading)) return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${error === 'no-profile' ? 'bg-[#7B5CF0]/10' : 'bg-red-400/10'}`}>
        <BarChart3 size={28} className={error === 'no-profile' ? 'text-[#7B5CF0]' : 'text-red-400'} />
      </div>
      <h2 className="text-lg font-semibold text-[#F5F5F7] mb-1">
        {error === 'no-profile' ? 'Compte en cours de configuration' : 'Impossible de charger les analytiques'}
      </h2>
      <p className="text-sm text-[#A1A1A8] mb-4 max-w-xs leading-relaxed">
        {error === 'no-profile'
          ? 'Votre espace client est en cours d\'activation.'
          : (error || 'Vérifiez votre connexion et réessayez.')}
      </p>
      <div className="flex gap-3">
        {error === 'no-profile' && (
          <a href="/dashboard/support" className="px-5 py-2.5 text-sm font-medium text-white bg-[#7B5CF0] rounded-xl hover:bg-[#6a4ee0] transition-colors">
            Contacter le support
          </a>
        )}
        <button onClick={() => fetchData()}
          className="px-5 py-2.5 text-sm font-medium text-[#A1A1A8] bg-white/[0.06] rounded-xl hover:bg-white/[0.10] transition-colors">
          Réessayer
        </button>
      </div>
    </div>
  );

  const summary = data.summary || {};
  const daily = data.daily || [];

  const prevCalls = (compareData?.summary?.totalCalls || 0) - summary.totalCalls;
  const callsDelta = prevCalls > 0 ? Math.round(((summary.totalCalls - prevCalls) / prevCalls) * 100) : 0;
  const prevLeads = (compareData?.summary?.totalLeads || 0) - summary.totalLeads;
  const leadsDelta = prevLeads > 0 ? Math.round(((summary.totalLeads - prevLeads) / prevLeads) * 100) : 0;

  const sentimentPie = data.sentiment
    ? Object.entries(data.sentiment).filter(([, v]) => (v as number) > 0).map(([k, v]) => ({ name: k, value: v as number }))
    : [];

  const hourData = data.peakHours
    ? Object.entries(data.peakHours).map(([h, v]) => ({ hour: `${h}h`, calls: v as number })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour))
    : [];

  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const dayData = data.peakDays
    ? Object.entries(data.peakDays).map(([d, v]) => ({ day: dayNames[parseInt(d)] || d, calls: v as number }))
    : [];

  const leadsValue = summary.totalLeads * costPerLead;
  const potentialRevenue = summary.totalLeads * avgDealValue * (summary.conversionRate / 100);
  const monthlyFee = overview?.client?.monthlyFee || 197;
  const roi = monthlyFee > 0 ? Math.round(((potentialRevenue - monthlyFee) / monthlyFee) * 100) : 0;

  const funnelData = [
    { stage: 'Total appels', value: summary.totalCalls, color: '#7B5CF0' },
    { stage: 'Leads captés', value: summary.totalLeads, color: '#a78bfa' },
    { stage: 'Conversions est.', value: Math.round(summary.totalLeads * (summary.conversionRate / 100)), color: '#34d399' },
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[#F5F5F7] tracking-tight">Analytique</h1>
          <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">Performances de votre réceptionniste IA</p>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setPeriod(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                period === d ? 'bg-[#7B5CF0] text-white' : 'text-[#A1A1A8] hover:text-[#F5F5F7]'
              }`}
            >
              {d}j
            </button>
          ))}
        </div>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total appels', value: summary.totalCalls, delta: callsDelta, icon: Phone },
          { label: 'Leads captés', value: summary.totalLeads, delta: leadsDelta, icon: Users },
          { label: 'Taux conversion', value: `${summary.conversionRate}%`, icon: Zap },
          { label: 'Durée moy.', value: formatDuration(summary.avgCallDuration), icon: Clock },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <kpi.icon size={16} className="text-[#A1A1A8]" />
              {kpi.delta !== undefined && kpi.delta !== 0 && (
                <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${kpi.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {kpi.delta > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                  {Math.abs(kpi.delta)}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-[#F5F5F7]">{kpi.value}</p>
            <p className="text-xs text-[#A1A1A8] mt-0.5">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Call volume */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6">
          <h3 className="text-sm font-semibold text-[#F5F5F7] mb-1">Volume d'appels</h3>
          <p className="text-xs text-[#A1A1A8] mb-4">Tendances quotidiennes</p>
          <div className="h-56">
            {daily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="gCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7B5CF0" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#7B5CF0" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8B8BA7' }} tickFormatter={d => formatShortDate(d)} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} width={28} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="calls" stroke="#7B5CF0" fill="url(#gCalls)" strokeWidth={2} name="Appels" />
                  <Area type="monotone" dataKey="leads" stroke="#fbbf24" fill="url(#gLeads)" strokeWidth={2} name="Leads" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#A1A1A8]">Pas encore de données</div>
            )}
          </div>
        </div>

        {/* Sentiment */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6">
          <h3 className="text-sm font-semibold text-[#F5F5F7] mb-1">Analyse du sentiment</h3>
          <p className="text-xs text-[#A1A1A8] mb-4">Satisfaction des appelants</p>
          <div className="h-56 flex items-center justify-center">
            {sentimentPie.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                      {sentimentPie.map((entry, i) => (
                        <Cell key={i} fill={SENTIMENT_COLORS[entry.name] || '#8B8BA7'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {sentimentPie.map((s, i) => {
                    const total = sentimentPie.reduce((sum, p) => sum + p.value, 0);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: SENTIMENT_COLORS[s.name] }} />
                        <div>
                          <span className="text-sm font-medium text-[#F5F5F7] capitalize">{s.name}</span>
                          <span className="text-xs text-[#A1A1A8] ml-2">{Math.round((s.value / total) * 100)}%</span>
                        </div>
                        <span className="text-sm font-bold text-[#F5F5F7] ml-auto">{s.value}</span>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t border-white/[0.07]">
                    <p className="text-xs text-[#A1A1A8]">Score satisfaction</p>
                    <p className="text-lg font-bold text-[#7B5CF0]">{summary.satisfactionScore}%</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">Pas de données sentiment</p>
            )}
          </div>
        </div>

        {/* Peak hours */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6">
          <h3 className="text-sm font-semibold text-[#F5F5F7] mb-1">Heures de pointe</h3>
          <p className="text-xs text-[#A1A1A8] mb-4">Quand vos appels arrivent</p>
          <div className="h-48">
            {hourData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#8B8BA7' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} width={24} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="calls" fill="#7B5CF0" radius={[4, 4, 0, 0]} name="Appels" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#A1A1A8]">Pas encore de données</div>
            )}
          </div>
        </div>

        {/* Day distribution */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6">
          <h3 className="text-sm font-semibold text-[#F5F5F7] mb-1">Appels par jour</h3>
          <p className="text-xs text-[#A1A1A8] mb-4">Jours les plus chargés</p>
          <div className="h-48">
            {dayData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8B8BA7' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} width={24} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="calls" fill="#a78bfa" radius={[4, 4, 0, 0]} name="Appels" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#A1A1A8]">Pas encore de données</div>
            )}
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 mb-4">
        <h3 className="text-sm font-semibold text-[#F5F5F7] mb-4">Entonnoir de conversion</h3>
        <div className="flex items-stretch gap-3">
          {funnelData.map((f, i) => (
            <div key={i} className="flex-1">
              <div className="rounded-xl p-4 text-center border border-white/[0.07]" style={{ background: `${f.color}15` }}>
                <p className="text-2xl font-bold" style={{ color: f.color }}>{f.value}</p>
                <p className="text-xs text-[#A1A1A8] mt-1">{f.stage}</p>
              </div>
              {i < funnelData.length - 1 && (
                <div className="flex justify-center my-1">
                  <span className="text-xs text-[#A1A1A8]">
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
        className="rounded-xl border border-[#7B5CF0]/20 bg-[#7B5CF0]/[0.04] p-6"
      >
        <h3 className="text-sm font-semibold text-[#F5F5F7] mb-4 flex items-center gap-2">
          <Calculator size={16} className="text-[#7B5CF0]" />
          Calculateur ROI
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#A1A1A8] mb-1.5 block">Coût par lead (manuel)</label>
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3">
                <DollarSign size={14} className="text-[#A1A1A8]" />
                <input type="number" value={costPerLead} onChange={e => setCostPerLead(Number(e.target.value))}
                  className="flex-1 py-2.5 text-sm bg-transparent text-[#F5F5F7] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#A1A1A8] mb-1.5 block">Valeur moy. d'un deal</label>
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3">
                <DollarSign size={14} className="text-[#A1A1A8]" />
                <input type="number" value={avgDealValue} onChange={e => setAvgDealValue(Number(e.target.value))}
                  className="flex-1 py-2.5 text-sm bg-transparent text-[#F5F5F7] focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4">
              <p className="text-xs text-[#A1A1A8]">Leads captés (Qwillio)</p>
              <p className="text-xl font-bold text-[#7B5CF0]">{summary.totalLeads}</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4">
              <p className="text-xs text-[#A1A1A8]">Équivalent coût manuel</p>
              <p className="text-xl font-bold text-amber-400">${leadsValue.toLocaleString()}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4">
              <p className="text-xs text-[#A1A1A8]">Revenus potentiels</p>
              <p className="text-xl font-bold text-emerald-400">${potentialRevenue.toLocaleString()}</p>
            </div>
            <div className={`rounded-xl p-4 border ${roi > 0 ? 'bg-emerald-400/10 border-emerald-400/20' : 'bg-red-400/10 border-red-400/20'}`}>
              <p className="text-xs text-[#A1A1A8]">ROI</p>
              <p className={`text-2xl font-bold ${roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{roi > 0 ? '+' : ''}{roi}%</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
