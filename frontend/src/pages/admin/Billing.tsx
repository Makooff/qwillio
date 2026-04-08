import { useEffect, useState } from 'react';
import api from '../../services/api';
import { RefreshCw, DollarSign, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../../components/ui/Skeleton';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

export default function AdminBilling() {
  const [clients, setClients] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [s, c, r] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/clients/'),
        api.get('/dashboard/revenue-history'),
      ]);
      setStats(s.data);
      setClients(Array.isArray(c.data.data) ? c.data.data : (Array.isArray(c.data) ? c.data : []));
      setRevenue(Array.isArray(r.data) ? r.data : []);
    } catch { toast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const retryPayment = async (clientId: string) => {
    setRetrying(clientId);
    try {
      await api.post(`/clients/${clientId}/retry-payment`);
      toast('Relance paiement envoyée', 'success');
    } catch { toast('Erreur relance paiement', 'error'); }
    finally { setRetrying(null); }
  };

  const mrr = stats?.revenue?.mrr ?? 0;
  const arr = mrr * 12;
  const byPlan = stats?.clients?.byPlan ?? {};
  const planData = Object.entries(byPlan).map(([name, value]) => ({ name, value }));
  const failedPayments = clients.filter(c => c.subscriptionStatus === 'past_due' || c.subscriptionStatus === 'unpaid');
  const ttStyle = { background: '#1E1E2E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Facturation</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Revenus et abonnements</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="MRR" value={mrr} format="currency" color="#22C55E" icon={<DollarSign className="w-4 h-4" />}
            sparkData={revenue.slice(-7).map((r: any) => r.revenue ?? 0)} />
          <StatCard label="ARR" value={arr} format="currency" icon={<TrendingUp className="w-4 h-4" />} color="#7B5CF0" />
          <StatCard label="Clients actifs" value={stats?.clients?.totalActive ?? 0} icon={<Users className="w-4 h-4" />} />
          <StatCard label="Paiements échoués" value={failedPayments.length} icon={<AlertCircle className="w-4 h-4" />} color={failedPayments.length > 0 ? '#EF4444' : undefined} />
        </>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Évolution MRR</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} width={45}
                    tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip contentStyle={ttStyle} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'MRR']} />
                  <Area type="monotone" dataKey="revenue" stroke="#22C55E" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-2xl bg-[#12121A] border border-white/[0.06] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-4">Clients par plan</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8BA7' }} axisLine={false} tickLine={false} width={25} />
                  <Tooltip contentStyle={ttStyle} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}
                    fill="#7B5CF0" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#F8F8FF]">Abonnements actifs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Client','Plan','Mensualité','Statut','Depuis'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5}><div className="px-4 py-3 animate-pulse"><div className="h-4 bg-white/[0.06] rounded w-3/4" /></div></td></tr>
                ))
                : clients.filter(c => c.subscriptionStatus === 'active' || c.subscriptionStatus === 'trial').slice(0, 15).map(c => (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-medium text-[#F8F8FF]">{c.businessName}</p>
                      <p className="text-[10px] text-[#8B8BA7]">{c.contactEmail}</p>
                    </td>
                    <td className="px-4 py-3.5"><Badge label={c.planType} variant="purple" size="xs" /></td>
                    <td className="px-4 py-3.5"><span className="text-xs font-medium text-[#22C55E]">${c.monthlyFee}/mo</span></td>
                    <td className="px-4 py-3.5"><Badge label={c.subscriptionStatus} dot size="xs" /></td>
                    <td className="px-4 py-3.5"><span className="text-xs text-[#8B8BA7]">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failed Payments Alert */}
      {failedPayments.length > 0 && (
        <div className="rounded-2xl bg-[#EF4444]/5 border border-[#EF4444]/20 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-[#EF4444]" />
            <h3 className="text-sm font-semibold text-[#EF4444]">{failedPayments.length} paiement{failedPayments.length > 1 ? 's' : ''} échoué{failedPayments.length > 1 ? 's' : ''}</h3>
          </div>
          <div className="space-y-2">
            {failedPayments.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-[#0D0D15] rounded-xl">
                <div>
                  <p className="text-sm text-[#F8F8FF]">{c.businessName}</p>
                  <p className="text-xs text-[#8B8BA7]">{c.contactEmail} · ${c.monthlyFee}/mo</p>
                </div>
                <button onClick={() => retryPayment(c.id)} disabled={retrying === c.id}
                  className="px-3 py-1.5 rounded-lg bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 text-xs font-medium hover:bg-[#EF4444]/20 transition-all disabled:opacity-50">
                  {retrying === c.id ? '...' : 'Relancer'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
