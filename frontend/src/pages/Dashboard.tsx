import { useCallback, useEffect, useState } from 'react';

const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}`, 'Content-Type': 'application/json' } : {};
};

interface DashboardData {
  bot?: { isActive?: boolean; callsToday?: number; callsQuota?: number };
  calls?: { today?: number; thisWeek?: number; successRate?: number };
  prospects?: { total?: number; newThisMonth?: number; byStatus?: Record<string, number> };
  clients?: { totalActive?: number; newThisMonth?: number };
  revenue?: { mrr?: number; totalThisMonth?: number };
  conversion?: { prospectToClient?: number };
  prospectsReadyToCall?: number;
  activity?: Array<{ type: string; description: string; createdAt: string }>;
  services?: Record<string, string>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botLoading, setBotLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/dashboard`, { headers: getHeaders() });
      if (r.ok) { setData(await r.json()); setError(null); }
      else { setError(`Erreur ${r.status}`); }
    } catch (e: any) { setError(e?.message ?? 'Erreur réseau'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  const toggleBot = async () => {
    setBotLoading(true);
    const isActive = data?.bot?.isActive;
    try {
      await fetch(`${API}/api/admin/bot/${isActive ? 'stop' : 'start'}`, { method: 'POST', headers: getHeaders() });
      await load();
    } finally { setBotLoading(false); }
  };

  if (loading) return <div style={styles.center}><div style={styles.spinner} /></div>;
  if (error && !data) return (
    <div style={styles.center}>
      <p style={{ color: '#ff6b6b' }}>Erreur: {error}</p>
      <button style={styles.btn} onClick={load}>Réessayer</button>
    </div>
  );

  const d = data ?? {};
  const botActive = d.bot?.isActive ?? false;

  return (
    <div style={styles.page}>
      <div style={{ ...styles.banner, background: botActive ? '#1a472a' : '#3d1a1a' }}>
        <div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>STATUT BOT</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: botActive ? '#4ade80' : '#f87171' }}>
            {botActive ? '● Bot Actif' : '● Bot Arrêté'}
          </div>
        </div>
        <button style={{ ...styles.btn, background: botActive ? '#ef4444' : '#7c3aed', opacity: botLoading ? 0.6 : 1 }} onClick={toggleBot} disabled={botLoading}>
          {botLoading ? '...' : botActive ? 'Arrêter' : 'Démarrer'}
        </button>
      </div>

      {(d.prospectsReadyToCall ?? 0) > 0 && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#a78bfa', marginBottom: 4 }}>PRÊTS À APPELER</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{d.prospectsReadyToCall} prospects</div>
            </div>
            <span style={{ fontSize: 28 }}>📞</span>
          </div>
        </div>
      )}

      <div style={styles.grid}>
        <StatCard label="Appels aujourd'hui" value={d.calls?.today ?? 0} sub={`${d.calls?.thisWeek ?? 0} cette semaine`} />
        <StatCard label="Quota/jour" value={d.bot?.callsQuota ?? 50} sub={`${d.bot?.callsToday ?? 0} utilisés`} />
        <StatCard label="Taux de réponse" value={`${Math.round((d.calls?.successRate ?? 0) * 100)}%`} />
        <StatCard label="Prospects" value={d.prospects?.total ?? 0} sub={`+${d.prospects?.newThisMonth ?? 0} ce mois`} />
        <StatCard label="Clients actifs" value={d.clients?.totalActive ?? 0} sub={`+${d.clients?.newThisMonth ?? 0} ce mois`} />
        <StatCard label="MRR" value={`${d.revenue?.mrr ?? 0}€`} sub={`${d.revenue?.totalThisMonth ?? 0}€ ce mois`} />
      </div>

      <div style={styles.card}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>CONVERSION</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{Math.round((d.conversion?.prospectToClient ?? 0) * 100)}%</div>
            <div style={{ fontSize: 11, color: '#888' }}>Prospect → Client</div>
          </div>
        </div>
      </div>

      {(d.activity?.length ?? 0) > 0 && (
        <div style={styles.card}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>ACTIVITÉ RÉCENTE</div>
          {d.activity?.slice(0, 5).map((a, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #222', fontSize: 13 }}>
              <span style={{ color: '#a78bfa', marginRight: 8 }}>●</span>{a.description}
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{new Date(a.createdAt).toLocaleString('fr-FR')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '12px 16px', maxWidth: 600, margin: '0 auto' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 },
  spinner: { width: 32, height: 32, border: '3px solid #333', borderTop: '3px solid #7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  banner: { borderRadius: 12, padding: '14px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  card: { background: '#1a1a1a', borderRadius: 12, padding: '14px 16px', marginBottom: 12, border: '1px solid #2a2a2a' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 },
  statCard: { background: '#1a1a1a', borderRadius: 12, padding: '14px 16px', border: '1px solid #2a2a2a' },
  btn: { background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
};
