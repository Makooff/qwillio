import { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import StatCard from '../components/ui/StatCard';
import { TrendingUp, TrendingDown, Users, UserCheck } from 'lucide-react';

export default function Retention() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/admin-analytics/retention');
      setData(res);
    } catch { setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const ttStyle = { background: '#1E1E2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Rétention clients</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Churn et fidélisation</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="Taux rétention" value={data?.retentionRate ?? 0} suffix="%" format="percent" icon={<UserCheck className="w-4 h-4" />} color="#22C55E" />
          <StatCard label="Churn rate" value={data?.churnRate ?? 0} suffix="%" format="percent" icon={<TrendingDown className="w-4 h-4" />} color="#EF4444" />
          <StatCard label="LTV moyen" value={data?.avgLtv ?? 0} format="currency" icon={<TrendingUp className="w-4 h-4" />} color="#7B5CF0" />
          <StatCard label="Clients actifs" value={data?.activeClients ?? 0} icon={<Users className="w-4 h-4" />} />
        </>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Évolution rétention</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.monthlyRetention ?? []}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} width={35}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={ttStyle} formatter={(v: any) => [`${v}%`, 'Rétention']} />
                  <Line type="monotone" dataKey="rate" stroke="#22C55E" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Churn par plan</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.churnByPlan ?? []}>
                  <XAxis dataKey="plan" tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} width={35}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={ttStyle} formatter={(v: any) => [`${v}%`, 'Churn']} />
                  <Bar dataKey="churnRate" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {data?.atRiskClients?.length > 0 && (
        <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Clients à risque</h3>
          <div className="space-y-2">
            {data.atRiskClients.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-[#0D0D15] rounded-xl">
                <div>
                  <p className="text-sm text-[#F8F8FF] font-medium">{c.businessName}</p>
                  <p className="text-xs text-[#8B8BA7]">{c.reason}</p>
                </div>
                <span className="text-xs text-[#EF4444] font-medium">Risque {c.riskScore}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
