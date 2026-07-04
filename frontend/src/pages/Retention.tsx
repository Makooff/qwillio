import { useEffect, useState } from 'react';
import api from '../services/api';
import { RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import StatCard from '../components/ui/StatCard';
import { TrendingUp, TrendingDown, Users, UserCheck } from 'lucide-react';
import { t, glass, tooltipStyle } from '../styles/admin-theme';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Rétention clients</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>Churn et fidélisation</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl hover:bg-white/[0.08] transition-all" style={{ background: t.elevated, color: t.textSec }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="Taux rétention" value={data?.retentionRate ?? 0} suffix="%" format="percent" icon={<UserCheck className="w-4 h-4" />} color="#22C55E" />
          <StatCard label="Churn rate" value={data?.churnRate ?? 0} suffix="%" format="percent" icon={<TrendingDown className="w-4 h-4" />} color="#EF4444" />
          <StatCard label="LTV moyen" value={data?.avgLtv ?? 0} format="currency" icon={<TrendingUp className="w-4 h-4" />} />
          <StatCard label="Clients actifs" value={data?.activeClients ?? 0} icon={<Users className="w-4 h-4" />} />
        </>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Évolution rétention</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.monthlyRetention ?? []}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} width={35}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, 'Rétention']} />
                  <Line type="monotone" dataKey="rate" stroke={t.success} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Churn par plan</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.churnByPlan ?? []}>
                  <XAxis dataKey="plan" tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} width={35}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, 'Churn']} />
                  <Bar dataKey="churnRate" fill={t.danger} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {data?.atRiskClients?.length > 0 && (
        <div className="p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Clients à risque</h3>
          <div className="space-y-2">
            {data.atRiskClients.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: t.inset }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: t.text }}>{c.businessName}</p>
                  <p className="text-xs" style={{ color: t.textSec }}>{c.reason}</p>
                </div>
                <span className="text-xs font-medium" style={{ color: t.danger }}>Risque {c.riskScore}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
