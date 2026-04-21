import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
const API = 'https://qwillio.onrender.com';
const getH = (): Record<string,string> => { const t=localStorage.getItem('token'); return t?{Authorization:`Bearer ${t}`}:{}; };
const fmtDateTime = (iso?:string) => { if(!iso) return '—'; const d=new Date(iso); const timeStr=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); const dateStr=d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); return `${dateStr} · ${timeStr}`; };
const PC: Record<string,string> = { starter:'rgba(255,255,255,0.3)', pro:'#8B5CF6', business:'#a78bfa', enterprise:'#c4b5fd' };
interface Cl { id:string; businessName:string; contactName:string; email:string; plan:string; monthlyFee:number|string; city:string; createdAt:string; }
const toNum = (v: unknown): number => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0)); return Number.isFinite(n) ? n : 0; };
const Clients: React.FC = () => {
  const [items,setItems]=useState<Cl[]>([]);
  const [loading,setLoading]=useState(true);
  const [q,setQ]=useState('');
  useEffect(()=>{ fetch(`${API}/api/admin/clients`,{headers:getH()}).then(r=>r.json()).then(d=>setItems(Array.isArray(d)?d:d.clients||[])).catch(console.error).finally(()=>setLoading(false)); },[]);
  const filtered=items.filter(c=>!q||c.businessName?.toLowerCase().includes(q.toLowerCase())||c.contactName?.toLowerCase().includes(q.toLowerCase()));
  const mrr=filtered.reduce((s,c)=>s+toNum(c.monthlyFee),0);
  if(loading) return <div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:28,height:28,borderRadius:'50%',border:'2px solid #8B5CF6',borderTopColor:'transparent',animation:'spin .8s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',color:'white'}}>
      <div style={{padding:'56px 20px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:16}}>
          <h1 style={{fontSize:28,fontWeight:700,margin:0,letterSpacing:'-0.5px'}}>Clients</h1>
          <div style={{textAlign:'right'}}><div style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>MRR</div><div style={{fontSize:20,fontWeight:700,color:'#c4b5fd'}}>{mrr.toFixed(0)}€</div></div>
        </div>
        <div style={{background:'#161616',borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,border:'1px solid rgba(255,255,255,0.06)'}}>
          <span style={{color:'rgba(255,255,255,0.3)'}}>🔍</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder='Rechercher...' style={{background:'none',border:'none',outline:'none',color:'white',fontSize:14,width:'100%'}}/>
        </div>
      </div>
      <div style={{padding:'0 16px'}}>
        <div style={{background:'#161616',borderRadius:16,border:'1px solid rgba(255,255,255,0.06)',overflow:'hidden'}}>
          {filtered.length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:'rgba(255,255,255,0.2)',fontSize:14}}>Aucun client</div>}
          {filtered.map((c,i)=>(
            <div key={c.id} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 16px',borderBottom:i<filtered.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
              <div style={{width:42,height:42,borderRadius:'50%',background:PC[c.plan?.toLowerCase()]+'18'||'rgba(255,255,255,0.08)',border:`1.5px solid ${PC[c.plan?.toLowerCase()]||'rgba(255,255,255,0.1)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:13,fontWeight:700,color:PC[c.plan?.toLowerCase()]||'rgba(255,255,255,0.4)'}}>{c.businessName?.charAt(0)||'?'}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.businessName}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.3)',marginTop:2}}>{c.contactName||c.email||c.city||'—'}</div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4,color:'rgba(255,255,255,0.35)'}}>
                  <Clock size={11} style={{flexShrink:0}}/>
                  <span style={{fontSize:11,fontWeight:500}}>{fmtDateTime(c.createdAt)}</span>
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:14,fontWeight:600,color:'#c4b5fd'}}>{toNum(c.monthlyFee).toFixed(0)}€</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:2}}>{c.plan||'—'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default Clients;
