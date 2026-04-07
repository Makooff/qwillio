import { useEffect, useState } from 'react';
const API = 'https://qwillio.onrender.com';
const getHeaders = () => { const t = localStorage.getItem('accessToken') ?? localStorage.getItem('token') ?? ''; return t ? { Authorization: `Bearer ${t}` } : {}; };

const STAGES = [
  { key: 'contacted', label: 'Contacté', color: '#60a5fa' },
  { key: 'qualified', label: 'Qualifié', color: '#a78bfa' },
  { key: 'proposal', label: 'Proposition', color: '#fbbf24' },
  { key: 'converted', label: 'Converti', color: '#4ade80' },
];

export default function Leads() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/leads`, { headers: getHeaders() })
      .then(r => r.json()).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding: 40 }}><div style={{ width:32,height:32,border:'3px solid #333',borderTop:'3px solid #7c3aed',borderRadius:'50%' }} /></div>;

  if (data.length === 0) return (
    <div style={{ padding:'40px 16px', textAlign:'center' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
      <div style={{ fontWeight:600, fontSize:16, marginBottom:8 }}>Aucun lead en cours</div>
      <div style={{ color:'#666', fontSize:13 }}>Les prospects contactés apparaîtront ici</div>
    </div>
  );

  return (
    <div style={{ padding: '12px 16px' }}>
      {STAGES.map(stage => {
        const leads = data.filter(l => l.status === stage.key);
        if (leads.length === 0) return null;
        return (
          <div key={stage.key} style={{ marginBottom: 16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background: stage.color, display:'inline-block' }} />
              <span style={{ fontSize:12, fontWeight:700, color: stage.color }}>{stage.label.toUpperCase()}</span>
              <span style={{ fontSize:11, color:'#666' }}>({leads.length})</span>
            </div>
            {leads.map(l => (
              <div key={l.id} style={{ background:'#1a1a1a', borderRadius:10, padding:'12px 14px', marginBottom:6, border:`1px solid ${stage.color}33` }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{l.firstName} {l.lastName}</div>
                {l.company && <div style={{ fontSize:12, color:'#888' }}>{l.company}</div>}
                {l.phone && <div style={{ fontSize:12, color:'#60a5fa' }}>{l.phone}</div>}
                <div style={{ fontSize:11, color:'#666', marginTop:4 }}>{new Date(l.updatedAt).toLocaleDateString('fr-FR')}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
