import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
import StatusBadge from '../../components/dashboard/StatusBadge';
import { MetricCardSkeleton } from '../../components/dashboard/SkeletonLoader';
import EmptyState from '../../components/dashboard/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area,
} from 'recharts';
import { format } from 'date-fns';

export default function AdminBilling() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, clientsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/clients'),
      ]);
      setData({
        stats: statsRes.data,
        clients: Array.isArray(clientsRes.data?.clients) ? clientsRes.data.clients
          : Array.isArray(clientsRes.data) ? clientsRes.data : [],
      });
    } catch { setData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const h = () => fetchData();
    window.addEventListener('admin-refresh', h);
    return () => window.removeEventListener('admin-refresh', h);
  }, [fetchData]);

  const mrr = data?.stats?.revenue?.mrr ?? 0;
  const arr = mrr * 12;
  const clients: any[] = data?.clients ?? [];
  const activeClients = clients.filter((c: any) => c.subscriptionStatus === 'active' || c.status === 'active');
  const failedPayments = clients.filter((c: any) => c.subscriptionStatus === 'past_due');

  // Plan distribution for bar chart
  const planData = [
    { plan: 'Starter', clients: clients.filter((c: any) => c.planType === 'starter').length, mrr: clients.filter((c: any) => c.planType === 'starter').reduce((a: number, c: any) => a + (c.monthlyFee ?? 0), 0) },
    { plan: 'Pro', clients: clients.filter((c: any) => c.planType === 'pro').length, mrr: clients.filter((c: any) => c.planType === 'pro').reduce((a: number, c: any) => a + (c.monthlyFee ?? 0), 0) },
    { plan: 'Enterprise', clients: clients.filter((c: any) => c.planType === 'enterprise').length, mrr: clients.filter((c: any) => c.planType === 'enterprise').reduce((a: number, c: any) => a + (c.monthlyFee ?? 0), 0) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#F8F8FF]">Billing</h1>
        <p className="text-sm text-[#8B8BA7] mt-0.5">Revenue and subscription overview</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            {[
              { label: 'MRR', value: `$${mrr.toLocaleString()}`, sub: 'Monthly recurring', color: 'text-[#22C55E]' },
              { label: 'ARR', value: `$${arr.toLocaleString()}`, sub: 'Annual run rate', color: 'text-[#7B5CF0]' },
              { label: 'Active Subs', value: String(activeClients.length), sub: 'Paying clients', color: 'text-[#F8F8FF]' },
              { label: 'Failed', value: String(failedPayments.length), sub: 'Past due', color: failedPayments.length > 0 ? 'text-[#EF4444]' : 'text-[#8B8BA7]' },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
                <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#8B8BA7] mb-2">{m.label}</p>
                <p className={`text-3xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
                <p className="text-xs text-[#8B8BA7] mt-1">{m.sub}</p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Revenue by plan */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
        <h3 className="text-sm font-semibold text-[#F8F8FF] mb-1">Revenue by Plan</h3>
        <p className="text-xs text-[#8B8BA7] mb-4">Clients and MRR per tier</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={planData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="plan" tick={{ fontSize: 11, fill: '#8B8BA7' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
              <Tooltip
                contentStyle={{ background: '#1E1E2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#8B8BA7' }}
                itemStyle={{ color: '#F8F8FF' }}
                formatter={(v: any, name: string) => [name === 'mrr' ? `$${v.toLocaleString()}` : v, name === 'mrr' ? 'MRR' : 'Clients']}
              />
              <Bar dataKey="clients" fill="#7B5CF0" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="mrr" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subscriptions table */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#F8F8FF]">Active Subscriptions</h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activeClients.length === 0 ? (
          <EmptyState icon={<CreditCard className="w-6 h-6" />} title="No active subscriptions" description="Clients with active subscriptions will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Client', 'Plan', 'MRR', 'Next Billing', 'Status', 'Trial'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold tracking-[0.08em] uppercase text-[#8B8BA7]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeClients.slice(0, 25).map((client: any, i: number) => (
                  <tr key={client.id ?? i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-[#F8F8FF]">{client.businessName ?? client.name ?? '—'}</p>
                        <p className="text-xs text-[#8B8BA7]">{client.contactEmail ?? ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={client.planType ?? 'starter'} size="sm" />
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium text-[#22C55E] tabular-nums">
                      ${(client.monthlyFee ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#8B8BA7]">
                      {client.nextBillingDate ? format(new Date(client.nextBillingDate), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={client.subscriptionStatus ?? client.status ?? 'active'} size="sm" />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#8B8BA7]">
                      {client.isTrial && client.trialEndDate
                        ? `${Math.max(0, Math.ceil((new Date(client.trialEndDate).getTime() - Date.now()) / 86400000))}d left`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Failed payments */}
      {failedPayments.length > 0 && (
        <div className="rounded-2xl bg-[#EF4444]/[0.06] border border-[#EF4444]/20 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-[#EF4444]" />
            <h3 className="text-sm font-semibold text-[#EF4444]">Failed Payments ({failedPayments.length})</h3>
          </div>
          <div className="space-y-3">
            {failedPayments.map((client: any) => (
              <div key={client.id} className="flex items-center justify-between p-3 bg-[#12121A] rounded-xl">
                <div>
                  <p className="text-sm font-medium text-[#F8F8FF]">{client.businessName}</p>
                  <p className="text-xs text-[#8B8BA7]">${(client.monthlyFee ?? 0).toLocaleString()} due</p>
                </div>
                <button className="px-3 py-1.5 text-xs font-medium text-[#EF4444] border border-[#EF4444]/30 rounded-lg hover:bg-[#EF4444]/10 transition-all">
                  Retry charge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
