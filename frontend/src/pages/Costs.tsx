import { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, DollarSign, Phone, Cpu, TrendingUp, Layers } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import OrbsLoader from '../components/OrbsLoader';
import { pro } from '../styles/pro-theme';
import { PageHeader, Card, SectionHead, Stat, IconBtn, GhostBtn } from '../components/pro/ProBlocks';

const tooltipStyle = {
  background: '#111114',
  border: `1px solid ${pro.border}`,
  borderRadius: 12,
  fontSize: 12,
  color: pro.text,
};

const fmtCurrency = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function Costs() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const { data: res } = await api.get(`/admin-analytics/costs?days=${days}`);
      setData(res);
    } catch { setData(null); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [days]);

  if (loading && !data) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={40} fullscreen={false} />
    </div>
  );

  const totalCost = Number(data?.totalCost ?? 0);
  const breakdown: any[] = Array.isArray(data?.breakdown) ? data.breakdown : [];
  const byNiche: any[]   = Array.isArray(data?.byNiche)   ? data.byNiche   : [];

  return (
    <div className="space-y-5 max-w-[1200px]">
      <PageHeader
        title="Analyse des coûts"
        subtitle="Dépenses opérationnelles par service"
        right={
          <>
            <div className="flex items-center gap-1">
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className="px-3 h-8 rounded-lg text-[12px] font-medium transition-colors"
                  style={days === d
                    ? { background: 'rgba(255,255,255,0.08)', color: pro.text, border: `1px solid ${pro.borderHi}` }
                    : { background: pro.panel, color: pro.textSec, border: `1px solid ${pro.border}` }}>
                  {d}j
                </button>
              ))}
            </div>
            <IconBtn onClick={load} title="Rafraîchir">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </IconBtn>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          icon={DollarSign}
          label="Coût total"
          value={fmtCurrency(totalCost)}
          hint={`Sur ${days} jours`}
        />
        <Stat
          icon={TrendingUp}
          label="MTD"
          value={fmtCurrency(data?.mtdCost ?? totalCost)}
          hint="Mois en cours"
        />
        <Stat
          icon={Phone}
          label="Coût / appel"
          value={fmtCurrency(data?.costPerCall ?? 0)}
          hint={`${data?.totalCalls ?? 0} appels`}
        />
        <Stat
          icon={Cpu}
          label="Projection"
          value={fmtCurrency(data?.forecast ?? (totalCost / Math.max(days, 1)) * 30)}
          hint="Prévision 30j"
        />
      </div>

      {/* Cost breakdown per service */}
      <section>
        <SectionHead title="Répartition par service" />
        <Card>
          {breakdown.length === 0 ? (
            <div className="p-12 text-center">
              <Layers className="w-7 h-7 mx-auto mb-3" style={{ color: pro.textTer }} />
              <p className="text-[13px]" style={{ color: pro.textSec }}>Aucune donnée disponible</p>
            </div>
          ) : (
            breakdown.map((b: any, i: number) => {
              const pct = totalCost > 0 ? (Number(b.cost || 0) / totalCost) * 100 : 0;
              return (
                <div
                  key={b.category || i}
                  className="px-4 py-3"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                           style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <Cpu size={13} style={{ color: pro.textSec }} />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: pro.text }}>
                          {b.category || b.service || '—'}
                        </p>
                        <p className="text-[11px]" style={{ color: pro.textTer }}>
                          {pct.toFixed(1)}% du total
                        </p>
                      </div>
                    </div>
                    <p className="text-[13px] font-semibold tabular-nums" style={{ color: pro.text }}>
                      {fmtCurrency(b.cost)}
                    </p>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full transition-all"
                         style={{ width: `${Math.min(pct, 100)}%`, background: pro.accent }} />
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
              Coûts par jour
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.byDay ?? []}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: pro.textSec }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: pro.textSec }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: pro.textSec }} itemStyle={{ color: pro.text }}
                    formatter={(v: any) => [fmtCurrency(Number(v)), 'Coût']} />
                  <Line type="monotone" dataKey="cost" stroke={pro.accent} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: pro.textSec }}>
              Répartition graphique
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdown}>
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: pro.textSec }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: pro.textSec }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: pro.text }}
                    formatter={(v: any) => [fmtCurrency(Number(v)), 'Coût']} />
                  <Bar dataKey="cost" fill={pro.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      {byNiche.length > 0 && (
        <section>
          <SectionHead title="Coût par niche" />
          <Card>
            <div className="p-4 space-y-3">
              {byNiche.map((n: any) => {
                const pct = Math.min((Number(n.cost || 0) / (totalCost || 1)) * 100, 100);
                return (
                  <div key={n.niche} className="flex items-center gap-3">
                    <span className="text-[11.5px] w-32 truncate" style={{ color: pro.textSec }}>{n.niche}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pro.accent }} />
                    </div>
                    <span className="text-[12px] font-medium w-20 text-right tabular-nums" style={{ color: pro.text }}>
                      {fmtCurrency(n.cost)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
