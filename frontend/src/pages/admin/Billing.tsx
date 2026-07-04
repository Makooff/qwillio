import { useEffect, useState } from 'react';
import api from '../../services/api';
import { RefreshCw, DollarSign, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { StatCardSkeleton, ChartSkeleton } from '../../components/ui/Skeleton';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { t, glass, tooltipStyle } from '../../styles/admin-theme';

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

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Facturation</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>Revenus et abonnements</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : <>
          <StatCard label="MRR" value={mrr} format="currency" color={t.success} icon={<DollarSign className="w-4 h-4" />}
            sparkData={revenue.slice(-7).map((r: any) => r.revenue ?? 0)} />
          <StatCard label="ARR" value={arr} format="currency" icon={<TrendingUp className="w-4 h-4" />} />
          <StatCard label="Clients actifs" value={stats?.clients?.totalActive ?? 0} icon={<Users className="w-4 h-4" />} />
          <StatCard label="Paiements échoués" value={failedPayments.length} icon={<AlertCircle className="w-4 h-4" />} color={failedPayments.length > 0 ? t.danger : undefined} />
        </>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Évolution MRR</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={t.success} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={t.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} width={45}
                    tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'MRR']} />
                  <Area type="monotone" dataKey="revenue" stroke={t.success} strokeWidth={2} fill="url(#revGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 p-5" style={glass}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: t.text }}>Clients par plan</h3>
          {loading ? <ChartSkeleton /> : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: t.textSec }} axisLine={false} tickLine={false} width={25} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}
                    fill={t.textTer} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="overflow-hidden" style={glass}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 className="text-sm font-semibold" style={{ color: t.text }}>Abonnements actifs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                {['Client','Plan','Mensualité','Statut','Depuis'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wide" style={{ color: t.textSec }}>{h}</th>
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
                      <p className="text-xs font-medium" style={{ color: t.text }}>{c.businessName}</p>
                      <p className="text-[10px]" style={{ color: t.textSec }}>{c.contactEmail}</p>
                    </td>
                    <td className="px-4 py-3.5"><Badge label={c.planType} size="xs" /></td>
                    <td className="px-4 py-3.5"><span className="text-xs font-medium" style={{ color: t.success }}>${c.monthlyFee}/mo</span></td>
                    <td className="px-4 py-3.5"><Badge label={c.subscriptionStatus} dot size="xs" /></td>
                    <td className="px-4 py-3.5"><span className="text-xs" style={{ color: t.textSec }}>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failed Payments Alert */}
      {failedPayments.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: `${t.danger}08`, border: `1px solid ${t.danger}30`, borderRadius: t.r }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4" style={{ color: t.danger }} />
            <h3 className="text-sm font-semibold" style={{ color: t.danger }}>{failedPayments.length} paiement{failedPayments.length > 1 ? 's' : ''} échoué{failedPayments.length > 1 ? 's' : ''}</h3>
          </div>
          <div className="space-y-2">
            {failedPayments.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: t.elevated, borderRadius: t.rSm }}>
                <div>
                  <p className="text-sm" style={{ color: t.text }}>{c.businessName}</p>
                  <p className="text-xs" style={{ color: t.textSec }}>{c.contactEmail} · ${c.monthlyFee}/mo</p>
                </div>
                <button onClick={() => retryPayment(c.id)} disabled={retrying === c.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                  style={{ background: `${t.danger}18`, color: t.danger, border: `1px solid ${t.danger}30` }}>
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
