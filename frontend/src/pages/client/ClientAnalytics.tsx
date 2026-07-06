// === FILE: ClientAnalytics.tsx ===
import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3, Phone, Users, Clock, Zap, ArrowUp, ArrowDown,
  DollarSign, Calculator,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import api from '../../services/api';
import { formatDuration, formatShortDate } from '../../utils/format';
import { SubPageHeader } from '../../components/dashboard/OverviewBlocks';

const TOOLTIP_STYLE = {
  background: '#12121A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  fontSize: 12,
  color: '#F8F8FF',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#34d399',
  neutral: '#fbbf24',
  negative: '#f87171',
};

type Period = 7 | 30 | 90;

interface AnalyticsData {
  summary?: {
    totalCalls?: number;
    totalLeads?: number;
    conversionRate?: number;
    avgCallDuration?: number;
    satisfactionScore?: number;
  };
  daily?: { date: string; calls: number; leads: number }[];
  sentiment?: Record<string, number>;
  peakHours?: Record<string, number>;
  peakDays?: Record<string, number>;
}

function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className ?? ''}`} />;
}

function LoadingSkeleton() {
  return (
    <main className="space-y-6" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Bone className="h-7 w-36" /><Bone className="h-4 w-52" /></div>
        <Bone className="h-9 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4 space-y-3">
            <Bone className="h-4 w-4 rounded-full" />
            <Bone className="h-8 w-16" />
            <Bone className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6">
        <Bone className="h-56 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6">
            <Bone className="h-4 w-32 mb-4" />
            <Bone className="h-48 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </main>
  );
}

export default function ClientAnalytics() {
  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [compareData, setCompareData] = useState<AnalyticsData | null>(null);
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [costPerLead, setCostPerLead] = useState(50);
  const [avgDealValue, setAvgDealValue] = useState(500);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [an, compare, ov] = await Promise.all([
        api.get(`/my-dashboard/analytics?days=${period}`),
        api.get(`/my-dashboard/analytics?days=${period * 2}`).catch(() => ({ data: null })),
        api.get('/my-dashboard/overview').catch(() => ({ data: null })),
      ]);
      setData(an.data as AnalyticsData);
      setCompareData(compare.data as AnalyticsData | null);
      setOverview(ov.data as Record<string, unknown> | null);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response?.status;
      if (status === 404) setError('no-profile');
      else setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingSkeleton />;

  if (error || !data) {
    const isNoProfile = error === 'no-profile';
    return (
      <main className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isNoProfile ? 'bg-[#493cbe]/10' : 'bg-red-500/10'}`}>
          <BarChart3 size={26} className={isNoProfile ? 'text-[#5b4ed6]' : 'text-red-400'} />
        </div>
        <h2 className="text-lg font-semibold text-white/90 mb-1">
          {isNoProfile ? 'Compte en cours de configuration' : 'Impossible de charger les analytiques'}
        </h2>
        <p className="text-sm text-white/50 mb-5 max-w-xs leading-relaxed">
          {isNoProfile ? "Votre espace client est en cours d'activation." : (error ?? 'Vérifiez votre connexion.')}
        </p>
        <div className="flex gap-3">
          {isNoProfile && (
            <a href="/dashboard/support" className="px-5 py-2.5 text-sm font-medium text-white bg-[#493cbe] rounded-xl hover:bg-[#5b4ed6] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5b4ed6]">
              Contacter le support
            </a>
          )}
          <button
            onClick={fetchData}
            className="px-5 py-2.5 text-sm font-medium text-white/60 bg-white/[0.06] rounded-xl hover:bg-white/[0.10] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5b4ed6]"
          >
            Réessayer
          </button>
        </div>
      </main>
    );
  }

  const summary = data.summary ?? {};
  const daily = data.daily ?? [];
  const totalCalls = summary.totalCalls ?? 0;
  const totalLeads = summary.totalLeads ?? 0;
  const conversionRate = summary.conversionRate ?? 0;
  const avgCallDuration = summary.avgCallDuration ?? 0;

  const prevCalls = (compareData?.summary?.totalCalls ?? 0) - totalCalls;
  const callsDelta = prevCalls > 0 ? Math.round(((totalCalls - prevCalls) / prevCalls) * 100) : 0;
  const prevLeads = (compareData?.summary?.totalLeads ?? 0) - totalLeads;
  const leadsDelta = prevLeads > 0 ? Math.round(((totalLeads - prevLeads) / prevLeads) * 100) : 0;

  const sentimentPie = data.sentiment
    ? Object.entries(data.sentiment).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }))
    : [];

  const hourData = data.peakHours
    ? Object.entries(data.peakHours)
        .map(([h, v]) => ({ hour: `${h}h`, calls: v }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour))
    : [];

  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const dayData = data.peakDays
    ? Object.entries(data.peakDays).map(([d, v]) => ({ day: dayNames[parseInt(d)] ?? d, calls: v }))
    : [];

  const monthlyFee = (overview?.client as Record<string, number> | undefined)?.monthlyFee ?? 197;
  const potentialRevenue = totalLeads * avgDealValue * (conversionRate / 100);
  const leadsValue = totalLeads * costPerLead;
  const roi = monthlyFee > 0 ? Math.round(((potentialRevenue - monthlyFee) / monthlyFee) * 100) : 0;

  const funnelData = [
    { stage: 'Total appels', value: totalCalls, color: '#493cbe' },
    { stage: 'Leads captés', value: totalLeads, color: '#818cf8' },
    { stage: 'Conversions est.', value: Math.round(totalLeads * (conversionRate / 100)), color: '#34d399' },
  ];

  const kpis = [
    { label: 'Total appels', value: totalCalls, delta: callsDelta, icon: Phone },
    { label: 'Leads captés', value: totalLeads, delta: leadsDelta, icon: Users },
    { label: 'Taux conversion', value: `${conversionRate}%`, delta: undefined as number | undefined, icon: Zap },
    { label: 'Durée moy.', value: formatDuration(avgCallDuration), delta: undefined as number | undefined, icon: Clock },
  ];

  const emptyChart = (
    <div className="h-full flex items-center justify-center text-white/30 text-sm">Pas encore de données</div>
  );

  return (
    <main className="space-y-6">
      {/* Header */}
      <SubPageHeader
        title="Analytiques"
        subtitle="Performances de votre réceptionniste IA"
        action={
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1">
            {([7, 30, 90] as Period[]).map(d => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5b4ed6] ${
                  period === d ? 'bg-[#493cbe] text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                {d}j
              </button>
            ))}
          </div>
        }
      />

      {/* KPI strip — frameless figures split by hairlines */}
      <div className="pb-6 border-b border-white/[0.06]">
        <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
          {kpis.map((kpi, i) => (
            <div key={i} className="px-3 sm:px-6 py-1 first:pl-0 last:pr-0">
              <div className="flex items-center justify-between mb-2">
                <kpi.icon size={14} className="text-white/30" />
                {kpi.delta !== undefined && kpi.delta !== 0 && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${kpi.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {kpi.delta > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                    {Math.abs(kpi.delta)}%
                  </span>
                )}
              </div>
              <p className="text-[19px] sm:text-[26px] font-bold tabular-nums text-white/90 leading-none">{kpi.value}</p>
              <p className="text-[10px] sm:text-[11px] text-white/40 mt-1.5 leading-tight">{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Area chart – full width */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6">
        <h3 className="text-sm font-semibold text-white/90 mb-0.5">Volume d'appels</h3>
        <p className="text-xs text-white/40 mb-5">Tendances quotidiennes sur {period} jours</p>
        <div className="h-60">
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#493cbe" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#493cbe" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A855F7" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#A855F7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }}
                  tickFormatter={d => formatShortDate(d)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="calls" stroke="#493cbe" fill="url(#gCalls)" strokeWidth={2} name="Appels" />
                <Area type="monotone" dataKey="leads" stroke="#A855F7" fill="url(#gLeads)" strokeWidth={2} name="Leads" />
              </AreaChart>
            </ResponsiveContainer>
          ) : emptyChart}
        </div>
      </section>

      {/* Sentiment + Peak hours + Day distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sentiment donut */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6">
          <h3 className="text-sm font-semibold text-white/90 mb-0.5">Sentiment</h3>
          <p className="text-xs text-white/40 mb-4">Satisfaction des appelants</p>
          {sentimentPie.length > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={42} outerRadius={64} paddingAngle={3} dataKey="value">
                    {sentimentPie.map((entry, i) => (
                      <Cell key={i} fill={SENTIMENT_COLORS[entry.name] ?? '#8B8BA7'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="w-full space-y-2">
                {sentimentPie.map((s, i) => {
                  const total = sentimentPie.reduce((sum, p) => sum + p.value, 0);
                  return (
                    <li key={i} className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SENTIMENT_COLORS[s.name] ?? '#8B8BA7' }} />
                      <span className="text-[12.5px] text-white/80 capitalize flex-1">{s.name}</span>
                      <span className="text-[11px] text-white/40">{Math.round((s.value / total) * 100)}%</span>
                      <span className="text-[12px] font-semibold text-white/70">{s.value}</span>
                    </li>
                  );
                })}
              </ul>
              {summary.satisfactionScore !== undefined && (
                <div className="w-full pt-3 border-t border-white/[0.06]">
                  <p className="text-[10px] text-white/40 mb-0.5">Score satisfaction</p>
                  <p className="text-xl font-bold text-[#5b4ed6]">{summary.satisfactionScore}%</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-white/30 text-sm">Pas de données</div>
          )}
        </section>

        {/* Peak hours */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6">
          <h3 className="text-sm font-semibold text-white/90 mb-0.5">Heures de pointe</h3>
          <p className="text-xs text-white/40 mb-4">Quand vos appels arrivent</p>
          <div className="h-48">
            {hourData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourData} margin={{ left: -24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="calls" fill="#493cbe" radius={[4, 4, 0, 0]} name="Appels" />
                </BarChart>
              </ResponsiveContainer>
            ) : emptyChart}
          </div>
        </section>

        {/* Day distribution */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6">
          <h3 className="text-sm font-semibold text-white/90 mb-0.5">Appels par jour</h3>
          <p className="text-xs text-white/40 mb-4">Jours les plus chargés</p>
          <div className="h-48">
            {dayData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayData} margin={{ left: -24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="calls" fill="#818cf8" radius={[4, 4, 0, 0]} name="Appels" />
                </BarChart>
              </ResponsiveContainer>
            ) : emptyChart}
          </div>
        </section>
      </div>

      {/* Conversion funnel */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6">
        <h3 className="text-sm font-semibold text-white/90 mb-4">Entonnoir de conversion</h3>
        <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
          {funnelData.map((f, i) => {
            const passPct = i < funnelData.length - 1 && f.value > 0
              ? Math.round((funnelData[i + 1].value / f.value) * 100)
              : null;
            return (
              <div key={i} className="px-3 sm:px-6 py-1 first:pl-0 last:pr-0">
                <p className="text-[20px] sm:text-[26px] font-semibold tabular-nums text-white/90 leading-none">{f.value}</p>
                <p className="text-[10px] sm:text-[11px] text-white/40 mt-1.5 leading-tight">{f.stage}</p>
                {passPct !== null && (
                  <div className="mt-3">
                    <div className="h-[3px] rounded-full bg-white/[0.08] overflow-hidden">
                      <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.min(100, passPct)}%` }} />
                    </div>
                    <p className="text-[10px] text-white/30 mt-1 tabular-nums">{passPct}%</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ROI calculator */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-6">
        <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
          <Calculator size={15} className="text-white/40" />
          Calculateur ROI
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Inputs */}
          <div className="space-y-4">
            {[
              { label: 'Coût par lead (manuel)', value: costPerLead, onChange: setCostPerLead },
              { label: "Valeur moy. d'un deal", value: avgDealValue, onChange: setAvgDealValue },
            ].map(({ label, value, onChange }) => (
              <div key={label}>
                <label className="text-[11px] text-white/40 mb-1.5 block">{label}</label>
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3">
                  <DollarSign size={13} className="text-white/30" />
                  <input
                    type="number"
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className="flex-1 py-2.5 text-sm bg-transparent text-white/90 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Middle metrics */}
          <div className="space-y-3">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4">
              <p className="text-[10px] text-white/40 mb-1">Leads captés (Qwillio)</p>
              <p className="text-xl font-bold tabular-nums text-white/90">{totalLeads}</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4">
              <p className="text-[10px] text-white/40 mb-1">Équivalent coût manuel</p>
              <p className="text-xl font-bold tabular-nums text-white/90">${leadsValue.toLocaleString()}</p>
            </div>
          </div>
          {/* ROI result */}
          <div className="space-y-3">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4">
              <p className="text-[10px] text-white/40 mb-1">Revenus potentiels</p>
              <p className="text-xl font-bold tabular-nums text-white/90">${potentialRevenue.toLocaleString()}</p>
            </div>
            <div className={`rounded-xl p-4 border ${roi >= 0 ? 'bg-emerald-400/[0.07] border-emerald-400/20' : 'bg-red-400/[0.07] border-red-400/20'}`}>
              <p className="text-[10px] text-white/40 mb-1">ROI estimé</p>
              <p className={`text-2xl font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {roi >= 0 ? '+' : ''}{roi}%
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
