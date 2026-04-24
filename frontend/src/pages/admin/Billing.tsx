import { useEffect, useState } from 'react';
import api from '../../services/api';
import { RefreshCw, DollarSign, TrendingUp, Users, AlertCircle, CreditCard } from 'lucide-react';
import OrbsLoader from '../../components/OrbsLoader';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, IconBtn, GhostBtn, Pill,
} from '../../components/pro/ProBlocks';

type StatusColor = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'accent';

const statusPill = (status?: string): { color: StatusColor; label: string } => {
  switch ((status || '').toLowerCase()) {
    case 'active':   return { color: 'ok',   label: 'Actif' };
    case 'trial':    return { color: 'info', label: 'Essai' };
    case 'past_due': return { color: 'warn', label: 'Retard' };
    case 'unpaid':   return { color: 'bad',  label: 'Impayé' };
    case 'canceled':
    case 'cancelled':return { color: 'neutral', label: 'Annulé' };
    default:         return { color: 'neutral', label: status || '—' };
  }
};

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function AdminBilling() {
  const [clients, setClients] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
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
      // Preserve revenue endpoint call (response intentionally unused in new layout)
      void r;
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
  const activeCount = clients.filter(c => c.subscriptionStatus === 'active').length;
  const trialCount  = clients.filter(c => c.subscriptionStatus === 'trial').length;
  const failedPayments = clients.filter(c => c.subscriptionStatus === 'past_due' || c.subscriptionStatus === 'unpaid');
  const churnedCount = clients.filter(c => c.subscriptionStatus === 'canceled' || c.subscriptionStatus === 'cancelled').length;

  const subscriptions = clients
    .filter(c => c.subscriptionStatus === 'active' || c.subscriptionStatus === 'trial' || c.subscriptionStatus === 'past_due' || c.subscriptionStatus === 'unpaid')
    .slice(0, 20);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={120} fullscreen={false} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Facturation"
        subtitle="Revenus récurrents et abonnements clients"
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className="w-4 h-4" />
          </IconBtn>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign}  label="MRR"             value={`${Math.round(mrr)}€`}         hint="Récurrent mensuel" />
        <Stat icon={Users}       label="Essais"          value={trialCount}                     hint="En période d'essai" />
        <Stat icon={TrendingUp}  label="Actifs"          value={activeCount}                    hint={`Churn : ${churnedCount}`} />
        <Stat icon={AlertCircle} label="Impayés"         value={failedPayments.length}          hint="past_due + unpaid" />
      </div>

      {/* Failed payments */}
      {failedPayments.length > 0 && (
        <section>
          <SectionHead title="Paiements à relancer" />
          <Card>
            {failedPayments.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-3.5 px-4 py-3"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(239,68,68,0.08)' }}>
                  <AlertCircle size={14} style={{ color: pro.bad }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                    {c.businessName}
                  </p>
                  <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                    {c.contactEmail} · {Number(c.monthlyFee ?? 0).toFixed(0)}€/mois
                  </p>
                </div>
                <Pill color={statusPill(c.subscriptionStatus).color}>
                  {statusPill(c.subscriptionStatus).label}
                </Pill>
                <GhostBtn
                  size="sm"
                  onClick={() => retryPayment(c.id)}
                  disabled={retrying === c.id}
                >
                  {retrying === c.id ? '…' : 'Relancer'}
                </GhostBtn>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* Subscriptions list */}
      <section>
        <SectionHead title="Abonnements" />
        <Card>
          {subscriptions.length === 0 ? (
            <div className="p-12 text-center" style={{ color: pro.textTer }}>
              <p className="text-[13px]">Aucun abonnement</p>
            </div>
          ) : (
            subscriptions.map((c, i) => {
              const s = statusPill(c.subscriptionStatus);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold"
                       style={{ background: 'rgba(255,255,255,0.05)', color: pro.text }}>
                    {c.businessName?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                      {c.businessName}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                      {c.contactEmail || '—'} · Depuis {fmtDate(c.createdAt)}
                    </p>
                  </div>
                  <div className="hidden md:flex items-center gap-1.5 flex-shrink-0 text-[11.5px]" style={{ color: pro.textSec }}>
                    <CreditCard size={11} />
                    <span>{c.planType || '—'}</span>
                  </div>
                  <div className="text-right flex-shrink-0 w-20">
                    <p className="text-[13px] font-semibold tabular-nums" style={{ color: pro.text }}>
                      {Number(c.monthlyFee ?? 0).toFixed(0)}€
                    </p>
                    <p className="text-[10.5px] tabular-nums" style={{ color: pro.textTer }}>/ mois</p>
                  </div>
                  <Pill color={s.color}>{s.label}</Pill>
                </div>
              );
            })
          )}
        </Card>
      </section>
    </div>
  );
}
