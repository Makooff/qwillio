import React, { useEffect, useState } from 'react';
import api from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────────

type ServiceStatus = 'running' | 'idle' | 'inactive';

interface DashboardData {
  totalProspects: number;
  prospectsReadyToCall: number;
  prospectsThisWeek: number;
  callsToday: number;
  callsThisWeek: number;
  answeredCalls: number;
  conversionRate: number;
  activeClients: number;
  botIsActive: boolean;
  lastProspection: string | null;
  callsQuotaDaily: number;
  servicesStatus: {
    prospection: ServiceStatus;
    calling: ServiceStatus;
    reminders: ServiceStatus;
    analytics: ServiceStatus;
    dailyReset: ServiceStatus;
  };
}

interface ActivityItem {
  id?: string | number;
  type?: string;
  description?: string;
  message?: string;
  event?: string;
  timestamp?: string;
  date?: string;
  status?: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────

const PulseDot: React.FC<{ active: boolean }> = ({ active }) => (
  <span style={{ position: 'relative', display: 'inline-flex', width: 12, height: 12, flexShrink: 0 }}>
    {active && (
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        backgroundColor: '#7C3AED', opacity: 0.75,
        animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
      }} />
    )}
    <span style={{
      position: 'relative', borderRadius: '50%', width: 12, height: 12,
      backgroundColor: active ? '#7C3AED' : '#D1D5DB',
    }} />
  </span>
);

const ServiceBadge: React.FC<{ status: ServiceStatus }> = ({ status }) => {
  const cfg = {
    running: { color: '#16A34A', bg: '#DCFCE7', label: 'Actif' },
    idle:    { color: '#6B7280', bg: '#F3F4F6', label: 'En attente' },
    inactive: { color: '#DC2626', bg: '#FEE2E2', label: 'Inactif' },
  }[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      color: cfg.color, backgroundColor: cfg.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.color, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
};

const SERVICE_CONFIG = [
  { key: 'prospection' as const, name: 'Prospection', icon: '🔍' },
  { key: 'calling' as const, name: 'Calling', icon: '📞' },
  { key: 'reminders' as const, name: 'Reminders', icon: '📧' },
  { key: 'analytics' as const, name: 'Analytics', icon: '📊' },
  { key: 'dailyReset' as const, name: 'Daily Reset', icon: '🔄' },
];

// ── Main component ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadAll() {
    setError(null);
    try {
      const [statsRes, actRes] = await Promise.allSettled([
        api.get('/admin/stats'),
        api.get('/admin/activity-feed'),
      ]);

      if (statsRes.status === 'fulfilled') {
        setData(statsRes.value.data);
      } else {
        setError('Erreur de chargement des statistiques');
      }

      if (actRes.status === 'fulfilled') {
        const raw = actRes.value.data;
        setActivity(Array.isArray(raw) ? raw : (raw?.items ?? []));
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  }

  const isActive = data?.botIsActive ?? false;
  const activeServiceCount = data
    ? Object.values(data.servicesStatus).filter((s) => s === 'running').length
    : 0;

  const kpis = [
    {
      icon: '📋',
      label: 'Total Prospects',
      value: data?.totalProspects ?? 0,
      sub: data?.prospectsThisWeek
        ? `+${data.prospectsThisWeek} cette semaine`
        : 'cette semaine: aucun',
      highlight: false,
    },
    {
      icon: '🎯',
      label: 'Prêts à appeler',
      value: data?.prospectsReadyToCall ?? 0,
      sub: data?.prospectsReadyToCall
        ? `${data.prospectsReadyToCall} en file d'attente`
        : 'aucun en attente',
      highlight: true,
    },
    {
      icon: '📈',
      label: "Appels aujourd'hui",
      value: data?.callsToday ?? 0,
      sub: `quota ${data?.callsQuotaDaily ?? 50}/jour`,
      highlight: false,
    },
    {
      icon: '✅',
      label: 'Taux réponse',
      value: `${data?.conversionRate ?? 0}%`,
      sub: `${data?.answeredCalls ?? 0} appels répondus`,
      highlight: false,
    },
  ];

  return (
    <div style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0 }}>Dashboard</h1>
          <p style={{ color: '#6B7280', marginTop: 4, fontSize: 14 }}>Vue d&apos;ensemble de Qwillio</p>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#DC2626', fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* ── Section 1: Status Banner ────────────────────────── */}
        <div style={{
          background: isActive
            ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
            : 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
          borderRadius: 14,
          padding: '18px 24px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: isActive ? '0 4px 20px rgba(5,150,105,0.25)' : '0 4px 12px rgba(220,38,38,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>
              {isActive ? '🤖' : '💤'}
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>
                {loading ? 'Chargement…' : isActive ? 'Bot Actif · LIVE' : 'Bot Arrêté'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>
                {isActive
                  ? `${activeServiceCount} service${activeServiceCount > 1 ? 's' : ''} en cours d'exécution`
                  : 'Démarrez le bot pour lancer l\'automatisation'}
              </div>
            </div>
          </div>
          {data?.lastProspection && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Dernière prospection</div>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
                {new Date(data.lastProspection).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
        </div>

        {/* ── Section 2: KPI Grid ─────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} style={{
              backgroundColor: kpi.highlight ? '#EDE9FE' : '#fff',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
              border: kpi.highlight ? '1px solid #DDD6FE' : '1px solid #E5E7EB',
            }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>{kpi.icon}</div>
              <div style={{
                fontSize: 34, fontWeight: 800, lineHeight: 1,
                color: kpi.highlight ? '#7C3AED' : '#111827',
              }}>
                {loading ? '—' : kpi.value}
              </div>
              <div style={{ fontSize: 13, color: kpi.highlight ? '#6D28D9' : '#374151', marginTop: 5, fontWeight: 500 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 11, color: kpi.highlight ? '#8B5CF6' : '#9CA3AF', marginTop: 3 }}>
                {kpi.sub}
              </div>
            </div>
          ))}
        </div>

        {/* ── Section 3: Services Grid ────────────────────────── */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          border: '1px solid #E5E7EB',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 0, marginBottom: 16 }}>
            Services automatiques
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {SERVICE_CONFIG.map((svc) => {
              const status: ServiceStatus = loading
                ? 'inactive'
                : (data?.servicesStatus?.[svc.key] ?? 'inactive');
              return (
                <div key={svc.key} style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  backgroundColor: status === 'running' ? '#F0FDF4' : status === 'idle' ? '#FAFAFA' : '#FFF5F5',
                  border: `1px solid ${status === 'running' ? '#BBF7D0' : status === 'idle' ? '#E5E7EB' : '#FEE2E2'}`,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 18 }}>{svc.icon}</span>
                    <ServiceBadge status={status} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{svc.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section 4: Activity Feed ─────────────────────────── */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          border: '1px solid #E5E7EB',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 0, marginBottom: 16 }}>
            Activité récente
          </h2>
          {loading ? (
            <div style={{ color: '#9CA3AF', fontSize: 14 }}>Chargement…</div>
          ) : activity.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', padding: '28px 0' }}>
              Aucune activité — démarrez le bot pour commencer
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activity.slice(0, 20).map((item, idx) => (
                <div key={item.id ?? idx} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 12px', borderRadius: 8, backgroundColor: '#F9FAFB', fontSize: 13,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                    backgroundColor: item.status === 'success' ? '#10B981' : item.status === 'error' ? '#EF4444' : '#7C3AED',
                  }} />
                  <div style={{ flex: 1, color: '#374151' }}>
                    {item.description ?? item.message ?? item.event ?? '—'}
                    {item.type && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#9CA3AF', backgroundColor: '#E5E7EB', padding: '1px 6px', borderRadius: 999 }}>
                        {item.type}
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#9CA3AF', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {(item.timestamp || item.date)
                      ? new Date((item.timestamp ?? item.date)!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
