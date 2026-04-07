import { useEffect, useState } from 'react';
const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}` } : {}; };

const STATUS_COLORS: Record<string, string> = { answered: '#4ade80', voicemail: '#fbbf24', failed: '#f87171', busy: '#f59e0b', 'no-answer': '#6b7280' };
const STATUS_FR: Record<string, string> = { answered: 'Répondu', voicemail: 'Messagerie', failed: 'Échec', busy: 'Occupé', 'no-answer': 'Pas de réponse' };

export default function Calls() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch(`${API}/api/admin/calls`, { headers: getHeaders() })
      .then(r => r.json()).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? data : data.filter(c => c.status === filter);
  const answered = data.filter(c => c.status === 'answered').length;
  const rate = data.length > 0 ? Math.round(answered / data.length * 100) : 0;

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding: 40 }}><div style={{ width:32,height:32,border:'3px solid #333',borderTop:'3px solid #7c3aed',borderRadius:'50%' }} /></div>;

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
        {[{ label:'Total', value: data.length },{ label:'Répondus', value: answered },{ label:'Taux', value: rate + '%' }].map(s => (
          <div key={s.label} style={{ background:'#1a1a1a', borderRadius:10, padding:'12px', border:'1px solid #2a2a2a', textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:700 }}>{s.value}</div>
            <div style={{ fontSize:11, color:'#888' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ background:'#1a1a1a',border:'1px solid #333',borderRadius:8,padding:'8px',color:'#fff',fontSize:13,marginBottom:12,width:'100%' }}>
        <option value="all">Tous les appels</option>
        {Object.entries(STATUS_FR).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', color:'#666', padding: 40 }}>Aucun appel trouvé</div>
      ) : filtered.map(c => (
        <div key={c.id} style={{ background:'#1a1a1a', borderRadius:10, padding:'12px 14px', marginBottom:8, border:'1px solid #2a2a2a' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>{c.prospect?.firstName ?? '?'} {c.prospect?.lastName ?? ''}</div>
              {c.prospect?.company && <div style={{ fontSize:12, color:'#888' }}>{c.prospect.company}</div>}
              <div style={{ fontSize:12, color:'#60a5fa' }}>{c.prospect?.phone ?? c.phone ?? '-'}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <span style={{ background: (STATUS_COLORS[c.status] ?? '#666') + '22', color: STATUS_COLORS[c.status] ?? '#666', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>{STATUS_FR[c.status] ?? c.status}</span>
              {c.duration && <div style={{ fontSize:11, color:'#888', marginTop:4 }}>{c.duration}s</div>}
            </div>
          </div>
          <div style={{ fontSize:11, color:'#666', marginTop:6 }}>{new Date(c.createdAt).toLocaleString('fr-FR')}</div>
        </div>
      ))}
    </div>
  );
}
