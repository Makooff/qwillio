import { useEffect, useState } from 'react';
const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}` } : {}; };

export default function Billing() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/billing`, { headers: getHeaders() })
      .then(r => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding: 40 }}><div style={{ width:32,height:32,border:'3px solid #333',borderTop:'3px solid #7c3aed',borderRadius:'50%' }} /></div>;

  const d = data ?? { totalMrr: 0, clientCount: 0, byPlan: {} };

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ background:'linear-gradient(135deg, #4c1d95, #7c3aed)', borderRadius:14, padding:'20px 16px', marginBottom:12 }}>
        <div style={{ fontSize:12, color:'#c4b5fd', marginBottom:4 }}>MRR TOTAL</div>
        <div style={{ fontSize:36, fontWeight:800, color:'#fff' }}>{d.totalMrr}€</div>
        <div style={{ fontSize:13, color:'#c4b5fd', marginTop:4 }}>{d.clientCount} clients actifs</div>
      </div>
      <div style={{ background:'#1a1a1a', borderRadius:12, padding:'14px 16px', border:'1px solid #2a2a2a' }}>
        <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>RÉPARTITION PAR PLAN</div>
        {Object.entries(d.byPlan ?? {}).length === 0 ? (
          <div style={{ color:'#666', fontSize:13 }}>Aucune donnée</div>
        ) : Object.entries(d.byPlan).map(([plan, count]: any) => (
          <div key={plan} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #222', fontSize:13 }}>
            <span style={{ textTransform:'capitalize', color:'#a78bfa' }}>{plan}</span>
            <span style={{ fontWeight:600 }}>{count} client{count > 1 ? 's' : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
