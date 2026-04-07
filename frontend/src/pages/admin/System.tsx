import { useState, useEffect, useCallback } from 'react';

const API = 'https://qwillio.onrender.com';
const getToken = () => localStorage.getItem('accessToken') ?? localStorage.getItem('token') ?? '';

interface SystemData {
  // v2 fields (from our new endpoint)
  dbConnected?: boolean;
  backendAlive?: boolean;
  prospectCount?: number;
  callCount?: number;
  botQuotaRemaining?: number;
  botActive?: boolean;
  lastCallAt?: string | null;
  lastProspectAt?: string | null;
  uptime?: number;
  nodeVersion?: string;
  environment?: string;
  error?: string;
  // v1 fields (from existing endpoint)
  db?: string;
  prospects?: number;
  clients?: number;
  calls?: number;
  env?: string;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function HealthRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderRadius: '8px', background: '#0d0d15',
      border: `1px solid ${ok ? '#22c55e44' : '#ef444444'}`,
      marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '10px', height: '10px', borderRadius: '50%',
          background: ok ? '#22c55e' : '#ef4444',
          boxShadow: ok ? '0 0 8px #22c55e88' : '0 0 8px #ef444488',
        }} />
        <span style={{ color: '#f8fafc', fontWeight: 500, fontSize: '14px' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {detail && <span style={{ color: '#94a3b8', fontSize: '13px' }}>{detail}</span>}
        <span style={{
          padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
          background: ok ? '#22c55e22' : '#ef444422',
          color: ok ? '#22c55e' : '#ef4444',
        }}>
          {ok ? 'OK' : 'KO'}
        </span>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: '#0d0d15', border: '1px solid #1e1e2e', borderRadius: '10px',
      padding: '16px 20px',
    }}>
      <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ color: '#f8fafc', fontSize: '22px', fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

export default function System() {
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchSystem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/admin/system`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSystem(); }, [fetchSystem]);

  useEffect(() => {
    const interval = setInterval(fetchSystem, 60_000);
    return () => clearInterval(interval);
  }, [fetchSystem]);

  useEffect(() => {
    const handler = () => fetchSystem();
    window.addEventListener('admin-refresh', handler);
    return () => window.removeEventListener('admin-refresh', handler);
  }, [fetchSystem]);

  // Normalize fields between v1 and v2 response shapes
  const isDbOk = data ? (data.dbConnected ?? data.db === 'connected') : false;
  const isBackendOk = data ? (data.backendAlive ?? true) : false;
  const isBotActive = data?.botActive ?? false;
  const prospectCount = data?.prospectCount ?? data?.prospects ?? 0;
  const callCount = data?.callCount ?? data?.calls ?? 0;
  const clientCount = data?.clients ?? 0;
  const uptimeVal = data?.uptime ?? 0;
  const nodeVer = data?.nodeVersion ?? '—';
  const envName = data?.environment ?? data?.env ?? '—';
  const quotaRemaining = data?.botQuotaRemaining ?? 0;

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
            Système
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            {lastRefresh ? `Mis à jour à ${lastRefresh.toLocaleTimeString('fr-FR')}` : 'Vérification en cours…'}
          </p>
        </div>
        <button
          onClick={fetchSystem}
          style={{
            padding: '8px 16px', background: '#7c3aed', border: 'none',
            borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
          }}
        >
          {loading ? 'Vérification…' : 'Vérifier maintenant'}
        </button>
      </div>

      {error && (
        <div style={{
          background: '#1a0a0a', border: '1px solid #ef4444', borderRadius: '8px',
          padding: '16px', color: '#ef4444', marginBottom: '16px',
        }}>
          Erreur de connexion au backend : {error}
        </div>
      )}

      {!loading && data && (
        <>
          {/* Health checks */}
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Santé du système
            </h2>
            <HealthRow label="Backend API" ok={isBackendOk} detail={envName} />
            <HealthRow label="Base de données" ok={isDbOk} />
            <HealthRow
              label="Bot VAPI"
              ok={isBotActive}
              detail={isBotActive ? `${quotaRemaining} appels restants` : 'Arrêté'}
            />
          </div>

          {/* Stats */}
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Statistiques base de données
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <StatCard label="Prospects" value={prospectCount.toLocaleString('fr-FR')} />
              <StatCard label="Appels" value={callCount.toLocaleString('fr-FR')} />
              {clientCount > 0 && <StatCard label="Clients" value={clientCount.toLocaleString('fr-FR')} />}
              {data.lastCallAt && (
                <StatCard
                  label="Dernier appel"
                  value={new Date(data.lastCallAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  sub={new Date(data.lastCallAt).toLocaleDateString('fr-FR')}
                />
              )}
              {data.lastProspectAt && (
                <StatCard
                  label="Dernier prospect"
                  value={new Date(data.lastProspectAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  sub={new Date(data.lastProspectAt).toLocaleDateString('fr-FR')}
                />
              )}
            </div>
          </div>

          {/* Runtime */}
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Runtime
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {uptimeVal > 0 && <StatCard label="Uptime" value={formatUptime(uptimeVal)} />}
              <StatCard label="Node.js" value={nodeVer} />
              <StatCard label="Environnement" value={envName} />
              {quotaRemaining > 0 && <StatCard label="Quota bot" value={`${quotaRemaining} restants`} />}
            </div>
          </div>
        </>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          Vérification du système…
        </div>
      )}
    </div>
  );
}
