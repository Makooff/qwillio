import { useEffect, useState } from 'react';
const API = 'https://qwillio.onrender.com';
const getHeaders = () => { const t = localStorage.getItem('accessToken') ?? localStorage.getItem('token') ?? ''; return t ? { Authorization: `Bearer ${t}` } : {}; };

const PLAN_COLORS: Record<string, string> = { starter: '#60a5fa', pro: '#a78bfa', enterprise: '#f59e0b', free: '#6b7280' };

export default function Clients() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/clients`, { headers: getHeaders() })
      .then(r => r.json()).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  }, []);

  const filtered = data.filter(c => {
    const q = search.toLowerCase();
    return !q || (c.firstName + ' ' + c.lastName + ' ' + (c.company ?? '') + ' ' + c.email).toLowerCase().includes(q);
  });

  const totalMRR = data.filter(c => c.status === 'active').reduce((sum, c) => sum + (c.mrr ?? 0), 0);

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding: 40 }}><div style={{ width:32,height:32,border:'3px solid #333',borderTop:'3px solid #7c3aed',borderRadius:'50%' }} /></div>;

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ background:'#1a1a1a', borderRadius:10, padding:'14px 16px', marginBottom:12, border:'1px solid #2a2a2a', display:'flex', gap:24 }}>
        <div><div style={{ fontSize:22, fontWeight:700 }}>{data.filter(c=>c.status==='active').length}</div><div style={{ fontSize:11, color:'#888' }}>Clients actifs</div></div>
        <div><div style={{ fontSize:22, fontWeight:700 }}>{totalMRR}€</div><div style={{ fontSize:11, color:'#888' }}>MRR total</div></div>
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." style={{ width:'100%',boxSizing:'border-box',background:'#1a1a1a',border:'1px solid #333',borderRadius:8,padding:'8px 12px',color:'#fff',fontSize:13,marginBottom:12 }} />
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', color:'#666', padding: 40 }}>Aucun client trouvé</div>
      ) : filtered.map(c => (
        <div key={c.id} style={{ background:'#1a1a1a', borderRadius:10, padding:'12px 14px', marginBottom:8, border:'1px solid #2a2a2a' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>{c.firstName} {c.lastName}</div>
              {c.company && <div style={{ fontSize:12, color:'#888' }}>{c.company}</div>}
              <div style={{ fontSize:12, color:'#888' }}>{c.email}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <span style={{ background: (PLAN_COLORS[c.plan] ?? '#666') + '22', color: PLAN_COLORS[c.plan] ?? '#666', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>{c.plan ?? 'free'}</span>
              {(c.mrr ?? 0) > 0 && <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{c.mrr}€/mois</div>}
            </div>
          </div>
          <div style={{ fontSize:11, color:'#666', marginTop:6 }}>Depuis {new Date(c.createdAt).toLocaleDateString('fr-FR')}</div>
        </div>
      ))}
    </div>
  );
}
