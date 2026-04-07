import { useState, useEffect, useCallback } from 'react';

const API = 'https://qwillio.onrender.com';
const getToken = () => localStorage.getItem('accessToken') ?? localStorage.getItem('token') ?? '';

interface Payment {
  id: string;
  amount: number;
  status: string;
  type?: string;
  createdAt: string;
  client?: { businessName?: string; company?: string; firstName?: string } | null;
}

interface BillingData {
  mrr?: number;
  totalMrr?: number;
  revenueThisMonth?: number;
  activeClients?: number;
  clientCount?: number;
  planBreakdown?: Record<string, number>;
  byPlan?: Record<string, number>;
  recentPayments?: Payment[];
}

const planColors: Record<string, string> = {
  starter: '#3b82f6',
  pro: '#8b5cf6',
  enterprise: '#22c55e',
  basic: '#3b82f6',
  growth: '#f59e0b',
};

function formatEur(cents: number): string {
  if (cents > 10000) {
    return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }
  return cents.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function getClientName(p: Payment): string {
  if (!p.client) return 'Client inconnu';
  return p.client.businessName ?? p.client.company ?? p.client.firstName ?? 'Client inconnu';
}

export default function Billing() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/admin/billing`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBilling(); }, [fetchBilling]);

  useEffect(() => {
    const handler = () => fetchBilling();
    window.addEventListener('admin-refresh', handler);
    return () => window.removeEventListener('admin-refresh', handler);
  }, [fetchBilling]);

  const mrr = data?.mrr ?? data?.totalMrr ?? 0;
  const revenue = data?.revenueThisMonth ?? 0;
  const activeClients = data?.activeClients ?? data?.clientCount ?? 0;
  const planBreakdown = data?.planBreakdown ?? data?.byPlan ?? {};
  const recentPayments = data?.recentPayments ?? [];
  const totalPlans = Object.values(planBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
          Facturation
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Vue d&apos;ensemble financière</p>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          Chargement…
        </div>
      )}

      {error && (
        <div style={{
          background: '#1a0a0a', border: '1px solid #ef4444', borderRadius: '8px',
          padding: '16px', color: '#ef4444', marginBottom: '16px',
        }}>
          Erreur : {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <KpiCard label="MRR" value={formatEur(mrr)} accent="#8b5cf6" icon="💜" />
            <KpiCard label="Revenus ce mois" value={formatEur(revenue)} accent="#22c55e" icon="📈" />
            <KpiCard label="Clients actifs" value={String(activeClients)} accent="#3b82f6" icon="👥" />
            <KpiCard
              label="ARPU"
              value={activeClients > 0 ? formatEur(Math.round(mrr / activeClients)) : '—'}
              accent="#f59e0b"
              icon="⚡"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            {/* Plan breakdown */}
            <div style={{
              background: '#0d0d15', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '20px',
            }}>
              <h3 style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '16px', fontSize: '15px' }}>
                Répartition par plan
              </h3>
              {Object.entries(planBreakdown).length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                  Aucun client actif
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(planBreakdown).map(([plan, count]) => {
                    const pct = totalPlans > 0 ? Math.round((count / totalPlans) * 100) : 0;
                    const color = planColors[plan.toLowerCase()] ?? '#6b7280';
                    return (
                      <div key={plan}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                          <span style={{ color, fontWeight: 600, textTransform: 'capitalize' }}>
                            {plan}
                          </span>
                          <span style={{ color: '#94a3b8' }}>{count} · {pct}%</span>
                        </div>
                        <div style={{ background: '#1e1e2e', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                          <div style={{
                            background: color,
                            height: '100%', width: `${pct}%`, borderRadius: '4px',
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent payments */}
            <div style={{
              background: '#0d0d15', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '20px',
            }}>
              <h3 style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '16px', fontSize: '15px' }}>
                Paiements récents
              </h3>
              {recentPayments.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                  Aucun paiement
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {recentPayments.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', borderBottom: '1px solid #1e1e2e', fontSize: '13px',
                    }}>
                      <div>
                        <div style={{ color: '#f8fafc', fontWeight: 500 }}>{getClientName(p)}</div>
                        <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                          {p.type ?? 'paiement'} · {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>{formatEur(p.amount)}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                          background: p.status === 'paid' ? '#22c55e22' : '#ef444422',
                          color: p.status === 'paid' ? '#22c55e' : '#ef4444',
                        }}>
                          {p.status === 'paid' ? 'Payé' : p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: string }) {
  return (
    <div style={{
      background: '#0d0d15', border: '1px solid #1e1e2e', borderRadius: '12px',
      padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '20px' }}>{icon}</span>
      </div>
      <div style={{ color: accent, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  );
}
