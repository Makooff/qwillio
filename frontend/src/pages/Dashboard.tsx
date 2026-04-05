import React, { useEffect, useState } from 'react';
import api from '../services/api';

interface BotStatus {
  isActive: boolean;
  callsToday?: number;
  callsQuotaDaily?: number;
  [key: string]: any;
}

interface DashboardStats {
  prospects: { total: number; newThisMonth: number; byStatus: Record<string, number> };
  clients: { totalActive: number; newThisMonth: number; byPlan: Record<string, number> };
  calls: { today: number; thisWeek: number; successRate: number };
  conversion: { prospectToClient: number; quoteAcceptanceRate: number };
  revenue: { mrr: number; setupFeesThisMonth: number; totalThisMonth: number };
  bot?: { isActive: boolean; callsToday: number; callsQuota: number };
}

interface ServiceStatus {
  name: string;
  active: boolean;
  key: string;
}

interface ActivityItem {
  id: string | number;
  type: string;
  description: string;
  timestamp: string;
  status?: string;
  [key: string]: any;
}

const PulseDot: React.FC<{ active: boolean }> = ({ active }) => (
  <span className="relative flex" style={{ width: '12px', height: '12px', flexShrink: 0 }}>
    {active && (
      <span
        className="animate-ping absolute inline-flex rounded-full opacity-75"
        style={{ backgroundColor: '#7C3AED', width: '12px', height: '12px' }}
      />
    )}
    <span
      className="relative inline-flex rounded-full"
      style={{
        backgroundColor: active ? '#7C3AED' : '#D1D5DB',
        width: '12px',
        height: '12px',
      }}
    />
  </span>
);

export default function Dashboard() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [botRes, statsRes, actRes] = await Promise.allSettled([
          api.get('/bot/status'),
          api.get('/admin/stats'),
          api.get('/admin/activity-feed'),
        ]);

        if (botRes.status === 'fulfilled') setBotStatus(botRes.value.data);
        else setBotStatus({ isActive: false });

        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        else setStats(null);

        if (actRes.status === 'fulfilled') {
          const data = actRes.value.data;
          setActivity(Array.isArray(data) ? data : (data as any).items ?? []);
        } else setActivity([]);

        // Services from bot config
        try {
          const cfgRes = await api.get('/bot/config');
          const cfg = cfgRes.data;
          setServices([
            { key: 'vapi', name: 'VAPI', active: !!(cfg?.vapiApiKey || cfg?.vapi_api_key || cfg?.vapiAssistantId) },
            { key: 'twilio', name: 'Twilio', active: !!(cfg?.twilioAccountSid || cfg?.twilio_account_sid) },
            { key: 'apify', name: 'Apify', active: !!(cfg?.apifyApiKey || cfg?.apify_api_key || cfg?.apifyActorId) },
            { key: 'discord', name: 'Discord', active: !!(cfg?.discordWebhook || cfg?.discord_webhook) },
          ]);
        } catch {
          setServices([
            { key: 'vapi', name: 'VAPI', active: false },
            { key: 'twilio', name: 'Twilio', active: false },
            { key: 'apify', name: 'Apify', active: false },
            { key: 'discord', name: 'Discord', active: false },
          ]);
        }
      } catch {
        setError('Erreur de chargement des données');
      } finally {
        setLoading(false);
      }
    }
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const isActive = botStatus?.isActive ?? false;
  const callsToday = stats?.calls?.today ?? botStatus?.callsToday ?? 0;
  const conversions = stats ? Math.round(stats.conversion?.prospectToClient ?? 0) : 0;

  const kpiTiles = [
    { label: 'Prospects total', value: stats?.prospects?.total ?? 0, icon: '👥' },
    { label: "Appels aujourd'hui", value: callsToday, icon: '📞' },
    { label: 'Conversions %', value: `${conversions}%`, icon: '✅' },
    { label: 'Clients actifs', value: stats?.clients?.totalActive ?? 0, icon: '🏢' },
  ];

  return (
    <div style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 }}>Dashboard</h1>
          <p style={{ color: '#6B7280', marginTop: '4px', fontSize: '14px' }}>Vue d&apos;ensemble de Qwillio</p>
        </div>

        {error && (
          <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#DC2626', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* Bot Status Banner */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: `1px solid ${isActive ? '#DDD6FE' : '#E5E7EB'}`,
        }}>
          <PulseDot active={isActive} />
          <div>
            <span style={{ fontWeight: 600, color: '#111827', fontSize: '15px' }}>Bot Qwillio — </span>
            <span style={{ fontWeight: 700, color: isActive ? '#7C3AED' : '#EF4444', fontSize: '15px' }}>
              {loading ? '...' : isActive ? 'Actif' : 'Inactif'}
            </span>
          </div>
          {botStatus?.callsToday != null && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9CA3AF', backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: '999px' }}>
              {botStatus.callsToday} appels aujourd&apos;hui
            </span>
          )}
        </div>

        {/* KPI Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {kpiTiles.map((tile) => (
            <div key={tile.label} style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid #E5E7EB',
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{tile.icon}</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#7C3AED', lineHeight: 1 }}>
                {loading ? '—' : tile.value}
              </div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{tile.label}</div>
            </div>
          ))}
        </div>

        {/* Services Status */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid #E5E7EB',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '16px', marginTop: 0 }}>Services</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {(services.length > 0 ? services : [
              { key: 'vapi', name: 'VAPI', active: false },
              { key: 'twilio', name: 'Twilio', active: false },
              { key: 'apify', name: 'Apify', active: false },
              { key: 'discord', name: 'Discord', active: false },
            ]).map((svc) => (
              <div key={svc.key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                backgroundColor: svc.active ? '#F5F3FF' : '#F9FAFB',
                borderRadius: '8px',
                border: `1px solid ${svc.active ? '#DDD6FE' : '#E5E7EB'}`,
              }}>
                <PulseDot active={svc.active} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{svc.name}</div>
                  <div style={{ fontSize: '11px', color: svc.active ? '#7C3AED' : '#9CA3AF' }}>
                    {svc.active ? 'Connecté' : 'Inactif'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid #E5E7EB',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '16px', marginTop: 0 }}>Activité récente</h2>
          {loading ? (
            <div style={{ color: '#9CA3AF', fontSize: '14px' }}>Chargement...</div>
          ) : activity.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
              Aucune activité récente
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activity.slice(0, 20).map((item, idx) => (
                <div key={item.id ?? idx} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#F9FAFB',
                  fontSize: '13px',
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: item.status === 'success' ? '#10B981' : item.status === 'error' ? '#EF4444' : '#7C3AED',
                    marginTop: '4px',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ color: '#374151' }}>{item.description ?? item.message ?? item.event ?? String(item)}</span>
                    {item.type && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: '#9CA3AF', backgroundColor: '#E5E7EB', padding: '1px 6px', borderRadius: '999px' }}>
                        {item.type}
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#9CA3AF', fontSize: '11px', whiteSpace: 'nowrap' }}>
                    {item.timestamp || item.date
                      ? new Date(item.timestamp ?? item.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
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
