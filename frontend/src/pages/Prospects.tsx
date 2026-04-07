import { useEffect, useState } from 'react';
const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}` } : {}; };

const STATUS_COLORS: Record<string, string> = { new: '#a78bfa', contacted: '#60a5fa', qualified: '#34d399', converted: '#4ade80', rejected: '#f87171' };
const STATUS_FR: Record<string, string> = { new: 'Nouveau', contacted: 'Contacté', qualified: 'Qualifié', converted: 'Converti', rejected: 'Refus' };

export default function Prospects() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch(`${API}/api/admin/prospects`, { headers: getHeaders() })
      .then(r => r.json()).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  }, []);

  const filtered = data.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.firstName + ' ' + p.lastName + ' ' + (p.company ?? '') + ' ' + (p.phone ?? '')).toLowerCase().includes(q);
    const matchFilter = filter === 'all' || p.status === filter;
    return matchSearch && matchFilter;
  });

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding: 40 }}><div style={{ width:32,height:32,border:'3px solid #333',borderTop:'3px solid #7c3aed',borderRadius:'50%' }} /></div>;

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." style={{ flex:1,background:'#1a1a1a',border:'1px solid #333',borderRadius:8,padding:'8px 12px',color:'#fff',fontSize:13 }} />
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ background:'#1a1a1a',border:'1px solid #333',borderRadius:8,padding:'8px',color:'#fff',fontSize:13 }}>
          <option value="all">Tous ({data.length})</option>
          {['new','contacted','qualified','converted','rejected'].map(s => <option key={s} value={s}>{STATUS_FR[s]}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', color:'#666', padding: 40 }}>Aucun prospect trouvé</div>
      ) : filtered.map(p => (
        <div key={p.id} style={{ background:'#1a1a1a', borderRadius:10, padding:'12px 14px', marginBottom:8, border:'1px solid #2a2a2a' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>{p.firstName} {p.lastName}</div>
              {p.company && <div style={{ fontSize:12, color:'#888' }}>{p.company}</div>}
              {p.phone && <div style={{ fontSize:12, color:'#60a5fa', marginTop:2 }}>{p.phone}</div>}
            </div>
            <span style={{ background: STATUS_COLORS[p.status] + '22', color: STATUS_COLORS[p.status], padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>{STATUS_FR[p.status] ?? p.status}</span>
          </div>
          <div style={{ display:'flex', gap:12, marginTop:8, fontSize:11, color:'#666' }}>
            <span>📞 {p.callAttempts ?? 0} tentatives</span>
            <span>{p.eligibleForCall ? '✓ Éligible' : '✗ Non éligible'}</span>
            <span>{new Date(p.createdAt).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
