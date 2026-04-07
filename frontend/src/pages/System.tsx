import { useEffect, useState } from 'react';
const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};` } : {}; };

export default function SystemPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`${API}/api/admin/system`, { headers: getHeaders() })
      .then(r => r.json()).then(setData).catch(() => setData({ db: 'error' })).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const d = data ?? {};
  const uptime = d.uptime ? `${Math.floor(d.uptime / 3600)}h ${Math.floor((d.uptime % 3600) / 60)}m` : '-';

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ background:'#1a1a1a', borderRadius:12, padding:'14px 16px', marginBottom:12, border:'1px solid #2a2a2a' }}>
        <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>STATUT SYSTÈME</div>
        {[
          { label: 'Base de données', value: d.db === 'connected' ? '✓ Connectée' : '✗ Erreur', ok: d.db === 'connected' },
          { label: 'Backend', value: data ? '✓ En ligne' : '✗ Hors ligne', ok: !!data },
          { label: 'Environnement', value: d.env ?? '-', ok: true },
          { label: 'Node.js', value: d.nodeVersion ?? '-', ok: true },
          { label: 'Uptime', value: uptime, ok: true },
        ].map(item => (
          <div key={item.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #222', fontSize:13 }}>
            <span style={{ color:'#888' }}>{item.label}</span>
            <span style={{ color: item.ok ? '#4ade80' : '#f87171', fontWeight:600 }}>{item.value}</span>
          </div>
        ))}
      </div>
      <div style={{ background:'#1a1a1a', borderRadius:12, padding:'14px 16px', marginBottom:12, border:'1px solid #2a2a2a' }}>
        <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>BASE DE DONNÉES</div>
        {[
          { label: 'Prospects', value: d.prospects ?? 0 },
          { label: 'Clients', value: d.clients ?? 0 },
          { label: 'Appels enregistrés', value: d.calls ?? 0 },
        ].map(item => (
          <div key={item.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #222', fontSize:13 }}>
            <span style={{ color:'#888' }}>{item.label}</span>
            <span style={{ fontWeight:600 }}>{item.value}</span>
          </div>
        ))}
      </div>
      <button onClick={load} disabled={loading} style={{ background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,padding:'10px 20px',cursor:'pointer',fontWeight:600,opacity: loading ? 0.6 : 1, width:'100%' }}>
        {loading ? 'Chargement...' : 'Actualiser'}
      </button>
    </div>
  );
}
