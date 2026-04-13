import { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, TrendingDown, DollarSign, Phone, Cpu } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ChartSkeleton, StatCardSkeleton } from '../components/ui/Skeleton';
import StatCard from '../components/ui/StatCard';
import { t, glass, tooltipStyle } from '../styles/admin-theme';

export default function Costs() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/admin-analytics/costs?days=${days}`);
      setData(res);
    } catch { setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Analyse des coûts</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>Dépenses opérationnelles</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={days === d
                ? { background: 'rgba(255,255,255,0.08)', color: t.text, border: `1px solid ${t.borderHi}` }
                : { background: t.panel, color: t.textSec, border: `1px solid ${t.border}` }}>
              {d}j
            </button>
          ))}
          <button onClick={load} className="p-2 rounded-xl hover:bg-white/[0.08] transition-all ml-1" style={{ background: t.elevated, color: t.textSec }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="Coût total" value={data?.totalCost ?? 0} format="currency" icon={<DollarSign className="w-4 h-4" />} color="#EF4444" />
          <StatCard label="Coût / appel" value={data?.costPerCall ?? 0} format="currency" icon={<Phone className="w-4 h-4" />} />
          <StatCard label="Appels passés" value={data?.totalCalls ?? 0} icon={<Phone className="w-4 h-4" />} />
          <StatCard label="Coût IA" value={data?.aiCost ?? 0} format="currency" icon={<Cpu className="w-4 h-4" />} color="#F59E0B" />
        </>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Coûts par jour</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.byDay ?? []}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: t.textSec }} itemStyle={{ color: t.text }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Coût']} />
                  <Line type="monotone" dataKey="cost" stroke={t.danger} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Répartition des coûts</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.breakdown ?? []}>
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: t.text }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Coût']} />
                  <Bar dataKey="cost" fill={t.textTer} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {data?.byNiche && (
        <div className="p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Coût par niche</h3>
          <div className="space-y-3">
            {data.byNiche.map((n: any) => (
              <div key={n.niche} className="flex items-center gap-3">
                <span className="text-xs w-32 truncate" style={{ color: t.textSec }}>{n.niche}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min((n.cost / (data?.totalCost || 1)) * 100, 100)}%`, background: 'rgba(255,255,255,0.20)' }} />
                </div>
                <span className="text-xs font-medium w-16 text-right" style={{ color: t.text }}>${Number(n.cost).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
