import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, GhostBtn, Pill,
} from '../../components/pro/ProBlocks';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface DashStats {
  prospects?: { total: number; qualified: number; eligible: number };
  calls?: { total: number; today: number; avgDuration: number };
  clients?: { total: number; active: number; trial: number; mrr: number };
  revenue?: { mrr: number; arr: number };
}

interface RevenuePoint {
  date: string;
  mrr: number;
  newClients: number;
}

interface ProspectingStats {
  totalProspects?: number;
  scraped?: number;
  eligible?: number;
  called?: number;
  qualified?: number;
  clients?: number;
}

interface AgentDashboard {
  closerAgent: {
    sequencesActive: number;
    converted7d: number;
    total7d: number;
    conversionRate: number;
  };
  workPlanner: {
    plansGenerated7d: number;
    avgPlannedPerDay: number;
  };
  businessPlan: {
    pitchesGenerated7d: number;
  };
  brandingAgent: {
    analysesRun7d: number;
  };
  anomalies: Array<{
    id: string;
    metric: string;
    current: number;
    avg: number;
    deviation: number;
    severity: string;
    diagnosis: string | null;
    createdAt: string;
    resolvedAt?: string | null;
  }>;
}

type DateRange = '7d' | '30d' | '90d';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtLabel = (dateStr: string) =>
  format(new Date(dateStr), 'd MMM', { locale: fr });

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function calcPct(numerator: number, denominator: number): string {
  if (!denominator) return '0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function TrendArrow({ value }: { value: number }) {
  if (value > 0) return <TrendingUp size={12} style={{ color: pro.ok }} />;
  if (value < 0) return <TrendingDown size={12} style={{ color: pro.bad }} />;
  return <Minus size={12} style={{ color: pro.textSec }} />;
}

type SeverityColor = 'bad' | 'warn' | 'info';

function severityColor(s: string): SeverityColor {
  const v = s.toLowerCase();
  if (v === 'critical' || v === 'high') return 'bad';
  if (v === 'medium') return 'warn';
  return 'info';
}

function formatMetricName(metric: string): string {
  return metric
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl h-24"
          style={{ background: pro.panel, border: `1px solid ${pro.border}` }}
        />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="animate-pulse rounded-2xl h-[280px]"
      style={{ background: pro.panel, border: `1px solid ${pro.border}` }}
    />
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

interface MrrTooltipPayload {
  value: number;
  name: string;
  payload: RevenuePoint;
}

interface MrrTooltipProps {
  active?: boolean;
  payload?: MrrTooltipPayload[];
  label?: string;
}

function MrrTooltip({ active, payload, label }: MrrTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div
      className="rounded-xl px-3 py-2 text-[12px] space-y-0.5 shadow-lg"
      style={{ background: pro.panel, border: `1px solid ${pro.border}` }}
    >
      <p className="font-semibold" style={{ color: pro.text }}>{label}</p>
      <p style={{ color: pro.accent }}>MRR : {fmtEur(data.mrr)}</p>
      <p style={{ color: pro.ok }}>+{data.newClients} client{data.newClients !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ── Funnel Row ────────────────────────────────────────────────────────────────

interface FunnelRowProps {
  label: string;
  value: number;
  pct: string;
  trend?: number;
}

function FunnelRow({ label, value, pct, trend = 0 }: FunnelRowProps) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: `1px solid ${pro.border}` }}
    >
      <p className="text-[12.5px]" style={{ color: pro.textSec }}>{label}</p>
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: pro.text }}>
          {value.toLocaleString('fr-FR')}
        </span>
        <div className="flex items-center gap-1 min-w-[56px] justify-end">
          <TrendArrow value={trend} />
          <span className="text-[12px] font-medium tabular-nums" style={{ color: pro.textSec }}>
            {pct}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Date-range tabs ───────────────────────────────────────────────────────────

const DATE_RANGES: { value: DateRange; label: string; days: number }[] = [
  { value: '7d', label: '7 jours', days: 7 },
  { value: '30d', label: '30 jours', days: 30 },
  { value: '90d', label: '90 jours', days: 90 },
];

interface DateTabsProps {
  active: DateRange;
  onChange: (r: DateRange) => void;
}

function DateTabs({ active, onChange }: DateTabsProps) {
  return (
    <div
      className="flex gap-1 p-1 rounded-xl text-[12px]"
      style={{ background: pro.panel, border: `1px solid ${pro.border}` }}
    >
      {DATE_RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className="px-3 py-1.5 rounded-lg font-medium transition-colors"
          style={{
            background: active === r.value ? pro.accent + '22' : 'transparent',
            color: active === r.value ? pro.accent : pro.textSec,
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Analytics() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [stats, setStats] = useState<DashStats | null>(null);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [prospecting, setProspecting] = useState<ProspectingStats | null>(null);
  const [agents, setAgents] = useState<AgentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const { toasts, add: toast, remove } = useToast();

  const selectedRange = DATE_RANGES.find((r) => r.value === dateRange)!;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, revenueRes, prospectingRes, agentsRes] = await Promise.allSettled([
        api.get<DashStats>('/dashboard/stats'),
        api.get<RevenuePoint[]>(`/dashboard/revenue-history?days=${selectedRange.days}`),
        api.get<ProspectingStats>('/prospecting/status'),
        api.get<AgentDashboard>('/ai-agents/dashboard'),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (revenueRes.status === 'fulfilled') setRevenue(revenueRes.value.data);
      if (prospectingRes.status === 'fulfilled') setProspecting(prospectingRes.value.data);
      if (agentsRes.status === 'fulfilled') setAgents(agentsRes.value.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedRange.days, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived values ──
  const totalProspects = prospecting?.totalProspects ?? stats?.prospects?.total ?? 0;
  const qualified = stats?.prospects?.qualified ?? prospecting?.qualified ?? 0;
  const activeClients = stats?.clients?.active ?? 0;
  const mrr = stats?.revenue?.mrr ?? stats?.clients?.mrr ?? 0;
  const totalCalls = stats?.calls?.total ?? 0;
  const conversionRate = totalProspects > 0 ? (activeClients / totalProspects) * 100 : 0;

  // Funnel steps
  const scraped = prospecting?.scraped ?? totalProspects;
  const eligible = prospecting?.eligible ?? stats?.prospects?.eligible ?? 0;
  const called = prospecting?.called ?? totalCalls;
  const qualifiedN = prospecting?.qualified ?? qualified;
  const clients = prospecting?.clients ?? activeClients;

  // Revenue chart data — fall back to synthetic if empty
  const chartData: RevenuePoint[] = revenue.length > 0
    ? revenue.map((p) => ({ ...p, date: fmtLabel(p.date) }))
    : Array.from({ length: selectedRange.days }, (_, i) => ({
        date: fmtLabel(subDays(new Date(), selectedRange.days - 1 - i).toISOString()),
        mrr: 0,
        newClients: 0,
      }));

  const activeAnomalies = agents?.anomalies.filter((a) => !a.resolvedAt) ?? [];

  return (
    <div className="space-y-6 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      {/* Header */}
      <PageHeader
        title="Analytics"
        subtitle="Vue globale — conversion, revenus, IA"
        right={
          <div className="flex items-center gap-3">
            <DateTabs active={dateRange} onChange={setDateRange} />
            <GhostBtn onClick={load} size="sm">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </GhostBtn>
          </div>
        }
      />

      {/* ROW 1 — KPIs */}
      <section>
        <SectionHead title="Indicateurs clés" />
        {loading && !stats ? (
          <StatsSkeleton />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat
              label="Total prospects"
              value={totalProspects.toLocaleString('fr-FR')}
              icon={TrendingUp}
            />
            <Stat
              label="Appels effectués"
              value={totalCalls.toLocaleString('fr-FR')}
              hint={stats?.calls?.today ? `${stats.calls.today} aujourd'hui` : undefined}
              icon={TrendingUp}
            />
            <Stat
              label="Qualifiés (score ≥ 5)"
              value={qualifiedN.toLocaleString('fr-FR')}
              hint={calcPct(qualifiedN, totalProspects)}
              icon={TrendingUp}
            />
            <Stat
              label="Clients actifs"
              value={activeClients.toLocaleString('fr-FR')}
              icon={TrendingUp}
            />
            <Stat
              label="MRR"
              value={fmtEur(mrr)}
              icon={TrendingUp}
            />
            <Stat
              label="Taux conversion"
              value={`${conversionRate.toFixed(1)}%`}
              hint="clients / prospects"
              icon={TrendingUp}
            />
          </div>
        )}
      </section>

      {/* ROW 2 — MRR Chart */}
      <section>
        <SectionHead title="Évolution MRR" />
        {loading && revenue.length === 0 ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={pro.accent} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={pro.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={pro.border} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: pro.textSec, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: pro.textSec, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                    width={42}
                  />
                  <Tooltip content={<MrrTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stroke={pro.accent}
                    strokeWidth={2}
                    fill="url(#mrrGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: pro.accent }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </section>

      {/* ROW 3 — Conversion Funnel */}
      <section>
        <SectionHead title="Entonnoir de conversion" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left — Bar chart */}
          <Card>
            <div className="p-4">
              <p className="text-[12px] font-semibold mb-3" style={{ color: pro.textSec }}>
                Volume par étape
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  layout="vertical"
                  data={[
                    { step: 'Scrappés', count: scraped },
                    { step: 'Éligibles', count: eligible },
                    { step: 'Appelés', count: called },
                    { step: 'Qualifiés', count: qualifiedN },
                    { step: 'Clients', count: clients },
                  ]}
                  margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={pro.border} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: pro.textSec, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="step"
                    tick={{ fill: pro.textSec, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip
                    formatter={(v: number) => [v.toLocaleString('fr-FR'), 'Prospects']}
                    contentStyle={{ background: pro.panel, border: `1px solid ${pro.border}`, borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: pro.text }}
                    itemStyle={{ color: pro.accent }}
                  />
                  <Bar dataKey="count" fill={pro.accent} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Right — conversion rates table */}
          <Card>
            <div className="p-1">
              <p className="text-[12px] font-semibold px-3 pt-3 pb-1" style={{ color: pro.textSec }}>
                Taux de conversion par étape
              </p>
              <FunnelRow label="Scrappés → Éligibles" value={eligible} pct={calcPct(eligible, scraped)} />
              <FunnelRow label="Éligibles → Appelés" value={called} pct={calcPct(called, eligible)} />
              <FunnelRow label="Appelés → Qualifiés" value={qualifiedN} pct={calcPct(qualifiedN, called)} />
              <FunnelRow label="Qualifiés → Clients" value={clients} pct={calcPct(clients, qualifiedN)} />
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[12.5px] font-semibold" style={{ color: pro.text }}>Taux global</p>
                <span
                  className="text-[13px] font-bold tabular-nums"
                  style={{ color: pro.accent }}
                >
                  {calcPct(clients, scraped)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ROW 4 — Agent Performance */}
      {agents && (
        <section>
          <SectionHead title="Performance des agents IA" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <div className="p-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>
                  Closer Agent
                </p>
                <p className="text-[22px] font-bold tabular-nums" style={{ color: pro.text }}>
                  {agents.closerAgent.sequencesActive}
                </p>
                <p className="text-[11.5px]" style={{ color: pro.textSec }}>séquences actives</p>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: pro.ok }}
                  >
                    {(agents.closerAgent.conversionRate * 100).toFixed(1)}%
                  </span>
                  <span className="text-[11px]" style={{ color: pro.textSec }}>taux conv. 7j</span>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>
                  Work Planner
                </p>
                <p className="text-[22px] font-bold tabular-nums" style={{ color: pro.text }}>
                  {agents.workPlanner.plansGenerated7d}
                </p>
                <p className="text-[11.5px]" style={{ color: pro.textSec }}>plans générés 7j</p>
                <p className="text-[12px]" style={{ color: pro.info }}>
                  ~{agents.workPlanner.avgPlannedPerDay.toFixed(1)} / jour
                </p>
              </div>
            </Card>

            <Card>
              <div className="p-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>
                  Business Plan
                </p>
                <p className="text-[22px] font-bold tabular-nums" style={{ color: pro.text }}>
                  {agents.businessPlan.pitchesGenerated7d}
                </p>
                <p className="text-[11.5px]" style={{ color: pro.textSec }}>pitches générés 7j</p>
              </div>
            </Card>

            <Card>
              <div className="p-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: pro.textSec }}>
                  Branding Agent
                </p>
                <p className="text-[22px] font-bold tabular-nums" style={{ color: pro.text }}>
                  {agents.brandingAgent.analysesRun7d}
                </p>
                <p className="text-[11.5px]" style={{ color: pro.textSec }}>analyses 7j</p>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* ROW 5 — Anomalies */}
      <section>
        <SectionHead title="Anomalies & Alertes" />
        {loading && !agents ? (
          <div
            className="animate-pulse rounded-2xl h-16"
            style={{ background: pro.panel, border: `1px solid ${pro.border}` }}
          />
        ) : activeAnomalies.length === 0 ? (
          <Card>
            <div className="px-5 py-4 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: `${pro.ok}1A` }}
              >
                <span style={{ color: pro.ok, fontSize: 16 }}>✓</span>
              </div>
              <p className="text-[13px]" style={{ color: pro.textSec }}>
                Aucune anomalie détectée
              </p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${pro.border}` }}>
                    {['Métrique', 'Actuel', 'Moyenne', 'Déviation', 'Sévérité', 'Recommandation'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10.5px]"
                        style={{ color: pro.textSec }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeAnomalies.map((anomaly, i) => (
                    <tr
                      key={anomaly.id}
                      className="hover:bg-white/[0.02] transition-colors"
                      style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: pro.text }}>
                        {formatMetricName(anomaly.metric)}
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: pro.text }}>
                        {anomaly.current.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: pro.textSec }}>
                        {anomaly.avg.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: pro.warn }}>
                        {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation.toFixed(1)}σ
                      </td>
                      <td className="px-4 py-3">
                        <Pill color={severityColor(anomaly.severity)}>{anomaly.severity}</Pill>
                      </td>
                      <td
                        className="px-4 py-3 max-w-[220px] truncate"
                        style={{ color: pro.textSec }}
                      >
                        {anomaly.diagnosis ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
