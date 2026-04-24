import { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, TrendingDown, TrendingUp, Users, UserCheck, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import OrbsLoader from '../components/OrbsLoader';
import { pro } from '../styles/pro-theme';
import { PageHeader, Card, SectionHead, Stat, IconBtn, Pill } from '../components/pro/ProBlocks';

const tooltipStyle = {
  background: '#111114',
  border: `1px solid ${pro.border}`,
  borderRadius: 12,
  fontSize: 12,
  color: pro.text,
};

const fmtRelative = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000)       return 'à l\'instant';
  if (diff < 3_600_000)    return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000)   return `il y a ${Math.floor(diff / 3_600_000)} h`;
  if (diff < 2_592_000_000) return `il y a ${Math.floor(diff / 86_400_000)} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const riskPill = (score: number): 'ok' | 'warn' | 'bad' => {
  if (score >= 70) return 'bad';
  if (score >= 40) return 'warn';
  return 'ok';
};

export default function Retention() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const { data: res } = await api.get('/admin-analytics/retention');
      setData(res);
    } catch { setData(null); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={40} fullscreen={false} />
    </div>
  );

  const atRisk: any[] = Array.isArray(data?.atRiskClients) ? data.atRiskClients : [];

  return (
    <div className="space-y-5 max-w-[1200px]">
      <PageHeader
        title="Rétention clients"
        subtitle="Churn, fidélisation et clients à risque"
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </IconBtn>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          icon={TrendingUp}
          label="MRR"
          value={`${Number(data?.mrr ?? 0).toFixed(0)}€`}
          hint="Récurrent mensuel"
        />
        <Stat
          icon={TrendingDown}
          label="Churn"
          value={`${Number(data?.churnRate ?? 0).toFixed(1)}%`}
          hint="Taux mensuel"
        />
        <Stat
          icon={UserCheck}
          label="Retenus"
          value={data?.activeClients ?? 0}
          hint={`Rétention ${Number(data?.retentionRate ?? 0).toFixed(1)}%`}
        />
        <Stat
          icon={Users}
          label="À risque"
          value={atRisk.length}
          hint="Clients flagués"
        />
      </div>

      {/* At-risk clients */}
      <section>
        <SectionHead title="Clients à risque" />
        <Card>
          {atRisk.length === 0 ? (
            <div className="p-12 text-center">
              <UserCheck className="w-7 h-7 mx-auto mb-3" style={{ color: pro.ok }} />
              <p className="text-[13px]" style={{ color: pro.textSec }}>Aucun client à risque</p>
            </div>
          ) : (
            atRisk.map((c: any, i: number) => {
              const score = Number(c.riskScore ?? 0);
              return (
                <div
                  key={c.id || i}
                  className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(239,68,68,0.08)' }}>
                    <AlertTriangle size={14} style={{ color: pro.bad }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                      {c.businessName || c.name || '—'}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                      {c.reason || 'Inactivité prolongée'} · dernière activité {fmtRelative(c.lastActivityAt || c.lastActivity)}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Pill color={riskPill(score)}>Risque {score}%</Pill>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <div className="p-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: pro.textSec }}>
              Évolution rétention
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.monthlyRetention ?? []}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: pro.textSec }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: pro.textSec }} axisLine={false} tickLine={false} width={35}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: pro.text }}
                    formatter={(v: any) => [`${v}%`, 'Rétention']} />
                  <Line type="monotone" dataKey="rate" stroke={pro.accent} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: pro.textSec }}>
              Churn par plan
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.churnByPlan ?? []}>
                  <XAxis dataKey="plan" tick={{ fontSize: 10, fill: pro.textSec }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: pro.textSec }} axisLine={false} tickLine={false} width={35}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: pro.text }}
                    formatter={(v: any) => [`${v}%`, 'Churn']} />
                  <Bar dataKey="churnRate" fill={pro.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
