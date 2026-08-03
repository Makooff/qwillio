import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, BarChart3, Clock, Phone, Users, Zap } from 'lucide-react';
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api from '../../../services/api';
import { formatDuration, formatShortDate } from '../../../utils/format';
import {
  Card, EmptyState, Field, GhostBtn, Input, PageActions, PrimaryBtn, SectionHead, Stat,
} from '../../../components/v2/app/Blocks';

/* Analytique, registre produit V2 (DA/v2-direction.md, addendum). Logique de
   données identique à la V1: /my-dashboard/analytics?days=... et /overview.
   Graphes sobres: une seule série accent, grille hairline, zéro ombre. */

const ACCENT = '#7A5FFF';
const HAIRLINE = '#23252A';
const AXIS = '#8A8F98';
const MUTED_SERIES = '#8A8F98';

const TOOLTIP_STYLE = {
  background: '#0F1011',
  border: `1px solid ${HAIRLINE}`,
  borderRadius: 12,
  fontSize: 12,
  color: '#D0D6E0',
  boxShadow: 'none',
  padding: '8px 10px',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'oklch(72% 0.18 145)',
  neutral: 'oklch(78% 0.18 75)',
  negative: 'oklch(65% 0.22 25)',
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'Positif',
  neutral: 'Neutre',
  negative: 'Négatif',
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

const AXIS_TICK = { fontSize: 10, fill: AXIS };

function eur(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} €`;
}

function ChartFrame({
  title,
  hint,
  height,
  hasData,
  children,
}: {
  title: string;
  hint?: string;
  height: number;
  hasData: boolean;
  children: React.ReactElement;
}) {
  return (
    <Card>
      <SectionHead title={title} action={hint ? <span className="text-[11.5px] text-q2-fog">{hint}</span> : undefined} />
      <div style={{ height }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[12.5px] text-q2-fog">
            Pas encore de données
          </div>
        )}
      </div>
    </Card>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement des analytiques" className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-q2-carbon border border-q2-graphite-d rounded-xl p-4 space-y-3">
            <div className="h-2.5 w-20 rounded bg-q2-obsidian animate-pulse" />
            <div className="h-6 w-16 rounded bg-q2-obsidian animate-pulse" />
          </div>
        ))}
      </div>
      <div className="bg-q2-carbon border border-q2-graphite-d rounded-xl p-5">
        <div className="h-[240px] rounded-lg bg-q2-obsidian animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-q2-carbon border border-q2-graphite-d rounded-xl p-5">
            <div className="h-[180px] rounded-lg bg-q2-obsidian animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClientAnalytics() {
  const navigate = useNavigate();
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

  const periodPills = (
    <div role="group" aria-label="Période" className="inline-flex items-center gap-1 rounded-full bg-q2-obsidian border border-q2-graphite-d p-1">
      {([7, 30, 90] as Period[]).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setPeriod(d)}
          aria-pressed={period === d}
          className={`h-7 px-3 rounded-full text-[12px] font-medium tabular-nums transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
            period === d ? 'bg-q2-indigo text-white' : 'text-q2-fog hover:text-q2-mist'
          }`}
        >
          {d} j
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div>
        <PageActions subtitle="Performances de votre réceptionniste IA">{periodPills}</PageActions>
        <Skeleton />
      </div>
    );
  }

  if (error || !data) {
    const isNoProfile = error === 'no-profile';
    return (
      <div>
        <PageActions subtitle="Performances de votre réceptionniste IA">{periodPills}</PageActions>
        <Card>
          <EmptyState
            icon={BarChart3}
            title={isNoProfile ? 'Compte en cours de configuration' : 'Impossible de charger les analytiques'}
            description={
              isNoProfile
                ? "Votre espace client est en cours d'activation."
                : (error ?? 'Vérifiez votre connexion.')
            }
            action={
              <div className="flex items-center gap-2">
                {isNoProfile && (
                  <PrimaryBtn type="button" onClick={() => navigate('/dashboard/support')}>
                    Contacter le support
                  </PrimaryBtn>
                )}
                <GhostBtn type="button" onClick={fetchData}>Réessayer</GhostBtn>
              </div>
            }
          />
        </Card>
      </div>
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
  const sentimentTotal = sentimentPie.reduce((sum, p) => sum + p.value, 0);

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
    { stage: 'Total appels', value: totalCalls },
    { stage: 'Leads captés', value: totalLeads },
    { stage: 'Conversions estimées', value: Math.round(totalLeads * (conversionRate / 100)) },
  ];

  const delta = (d: number) => (
    <span
      className="inline-flex items-center gap-1 tabular-nums"
      style={{ color: d > 0 ? 'var(--q2p-ok)' : 'var(--q2p-bad)' }}
    >
      {d > 0 ? <ArrowUp size={10} aria-hidden="true" /> : <ArrowDown size={10} aria-hidden="true" />}
      {Math.abs(d)} % sur la période précédente
    </span>
  );

  return (
    <div>
      <PageActions subtitle="Performances de votre réceptionniste IA">{periodPills}</PageActions>

      <section aria-label="Indicateurs" className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Total appels" value={totalCalls.toLocaleString('fr-FR')} icon={Phone} hint={callsDelta !== 0 ? delta(callsDelta) : undefined} />
        <Stat label="Leads captés" value={totalLeads.toLocaleString('fr-FR')} icon={Users} hint={leadsDelta !== 0 ? delta(leadsDelta) : undefined} />
        <Stat label="Taux conversion" value={`${conversionRate} %`} icon={Zap} />
        <Stat label="Durée moyenne" value={formatDuration(avgCallDuration)} icon={Clock} />
      </section>

      <div className="mb-4">
        <ChartFrame
          title="Volume d'appels"
          hint={`${period} derniers jours`}
          height={240}
          hasData={daily.length > 0}
        >
          <ComposedChart data={daily} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid stroke={HAIRLINE} vertical={false} />
            <XAxis
              dataKey="date"
              tick={AXIS_TICK}
              tickFormatter={(d) => formatShortDate(d)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: HAIRLINE, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="calls"
              name="Appels"
              stroke={ACCENT}
              strokeWidth={1.75}
              fill={ACCENT}
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 3, fill: ACCENT, stroke: 'none' }}
            />
            <Line
              type="monotone"
              dataKey="leads"
              name="Leads"
              stroke={MUTED_SERIES}
              strokeWidth={1.25}
              dot={false}
              activeDot={{ r: 3, fill: MUTED_SERIES, stroke: 'none' }}
            />
          </ComposedChart>
        </ChartFrame>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card>
          <SectionHead
            title="Sentiment"
            action={
              summary.satisfactionScore !== undefined
                ? <span className="text-[11.5px] text-q2-fog tabular-nums">Satisfaction {summary.satisfactionScore} %</span>
                : undefined
            }
          />
          {sentimentPie.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-[120px] h-[120px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={38} outerRadius={54} paddingAngle={2} dataKey="value" stroke="none">
                      {sentimentPie.map((entry) => (
                        <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] ?? MUTED_SERIES} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 min-w-0 space-y-2.5">
                {sentimentPie.map((s) => (
                  <li key={s.name} className="flex items-center gap-2.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: SENTIMENT_COLORS[s.name] ?? MUTED_SERIES }}
                      aria-hidden="true"
                    />
                    <span className="text-[12.5px] text-q2-mist flex-1 truncate">
                      {SENTIMENT_LABELS[s.name] ?? s.name}
                    </span>
                    <span className="text-[12px] text-white tabular-nums">
                      {sentimentTotal > 0 ? Math.round((s.value / sentimentTotal) * 100) : 0} %
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-[12.5px] text-q2-fog">
              Pas encore de données
            </div>
          )}
        </Card>

        <ChartFrame title="Heures de pointe" hint="Arrivée des appels" height={180} hasData={hourData.length > 0}>
          <BarChart data={hourData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid stroke={HAIRLINE} vertical={false} />
            <XAxis dataKey="hour" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(122,95,255,0.08)' }} />
            <Bar dataKey="calls" name="Appels" fill={ACCENT} radius={[3, 3, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ChartFrame>

        <ChartFrame title="Appels par jour" hint="Jours les plus chargés" height={180} hasData={dayData.length > 0}>
          <BarChart data={dayData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid stroke={HAIRLINE} vertical={false} />
            <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(122,95,255,0.08)' }} />
            <Bar dataKey="calls" name="Appels" fill={ACCENT} radius={[3, 3, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ChartFrame>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card pad={false}>
          <div className="px-5 pt-5">
            <SectionHead title="Entonnoir de conversion" />
          </div>
          <ul>
            {funnelData.map((f, i) => {
              const pass = i < funnelData.length - 1 && f.value > 0
                ? Math.round((funnelData[i + 1].value / f.value) * 100)
                : null;
              return (
                <li
                  key={f.stage}
                  className="flex items-baseline justify-between gap-4 px-5 py-3.5 border-t border-q2-graphite-d"
                >
                  <span className="text-[13px] text-q2-mist">{f.stage}</span>
                  <span className="flex items-baseline gap-3">
                    {pass !== null && (
                      <span className="text-[11.5px] text-q2-fog tabular-nums">{pass} % vers l'étape suivante</span>
                    )}
                    <span className="text-[19px] font-light text-white tabular-nums leading-none">
                      {f.value.toLocaleString('fr-FR')}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <SectionHead title="Calculateur ROI" action={<span className="text-[11.5px] text-q2-fog">Hypothèses modifiables</span>} />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Coût par lead (manuel)">
              <Input
                type="number"
                value={costPerLead}
                onChange={(e) => setCostPerLead(Number(e.target.value))}
                className="!py-[7px] tabular-nums"
                aria-label="Coût par lead traité manuellement, en euros"
              />
            </Field>
            <Field label="Valeur moyenne d'un deal">
              <Input
                type="number"
                value={avgDealValue}
                onChange={(e) => setAvgDealValue(Number(e.target.value))}
                className="!py-[7px] tabular-nums"
                aria-label="Valeur moyenne d'un deal, en euros"
              />
            </Field>
          </div>
          <dl className="rounded-xl border border-q2-graphite-d overflow-hidden">
            {[
              { label: 'Leads captés', value: totalLeads.toLocaleString('fr-FR') },
              { label: 'Équivalent coût manuel', value: eur(leadsValue) },
              { label: 'Revenus potentiels', value: eur(potentialRevenue) },
              { label: 'Abonnement mensuel', value: eur(monthlyFee) },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-q2-graphite-d first:border-t-0">
                <dt className="text-[12.5px] text-q2-mist">{r.label}</dt>
                <dd className="text-[13px] text-white tabular-nums">{r.value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-q2-graphite-d">
              <dt className="text-[12.5px] text-q2-mist">ROI estimé</dt>
              <dd
                className="text-[15px] font-medium tabular-nums"
                style={{ color: roi >= 0 ? 'var(--q2p-ok)' : 'var(--q2p-bad)' }}
              >
                {roi >= 0 ? '+' : ''}{roi} %
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
