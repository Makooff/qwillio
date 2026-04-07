import { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw, TrendingDown, DollarSign, Phone, Cpu } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ChartSkeleton, StatCardSkeleton } from '../components/ui/Skeleton';
import StatCard from '../components/ui/StatCard';

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

  const ttStyle = { background: '#1E1E2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Analyse des coûts</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Dépenses opérationnelles</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${days === d ? 'bg-[#7B5CF0]/10 text-[#7B5CF0] border border-[#7B5CF0]/20' : 'bg-[#12121A] border border-white/[0.06] text-[#8B8BA7] hover:text-white'}`}>
              {d}j
            </button>
          ))}
          <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all ml-1">
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
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Coûts par jour</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.byDay ?? []}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={ttStyle} labelStyle={{ color: '#8B8BA7' }} itemStyle={{ color: '#F8F8FF' }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Coût']} />
                  <Line type="monotone" dataKey="cost" stroke="#EF4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Répartition des coûts</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.breakdown ?? []}>
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={ttStyle} itemStyle={{ color: '#F8F8FF' }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Coût']} />
                  <Bar dataKey="cost" fill="#7B5CF0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {data?.byNiche && (
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Coût par niche</h3>
          <div className="space-y-3">
            {data.byNiche.map((n: any) => (
              <div key={n.niche} className="flex items-center gap-3">
                <span className="text-xs text-[#8B8BA7] w-32 truncate">{n.niche}</span>
                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-[#7B5CF0] rounded-full" style={{ width: `${Math.min((n.cost / (data?.totalCost || 1)) * 100, 100)}%` }} />
                </div>
                <span className="text-xs font-medium text-[#F8F8FF] w-16 text-right">${Number(n.cost).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
