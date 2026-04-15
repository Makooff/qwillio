import React, { useEffect, useState } from 'react';
const API = 'https://qwillio.onrender.com';
const getH = (): Record<string,string> => { const t=localStorage.getItem('token'); return t?{Authorization:`Bearer ${t}`}:{}; };
const fmt = (iso:string) => { if(!iso) return ''; const d=new Date(iso),diff=Date.now()-d.getTime(); if(diff<86400000) return `${Math.floor(diff/3600000)}h`; return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); };
const SC: Record<string,string> = { new:'#8B5CF6', called:'#6366F1', interested:'#a78bfa', not_interested:'rgba(255,80,80,0.7)', converted:'#c4b5fd' };
interface P { id:string; businessName:string; industry:string; phone:string; score:number; status:string; city:string; createdAt:string; callCount:number; }
const Prospects: React.FC = () => {
  const [items,setItems]=useState<P[]>([]);
  const [loading,setLoading]=useState(true);
  const [q,setQ]=useState('');
  useEffect(()=>{ fetch(`${API}/api/admin/prospects`,{headers:getH()}).then(r=>r.json()).then(d=>setItems(Array.isArray(d)?d:d.prospects||[])).catch(console.error).finally(()=>setLoading(false)); },[]);
  const filtered=items.filter(p=>!q||p.businessName?.toLowerCase().includes(q.toLowerCase())||p.city?.toLowerCase().includes(q.toLowerCase()));
  if(loading) return <div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:28,height:28,borderRadius:'50%',border:'2px solid #8B5CF6',borderTopColor:'transparent',animation:'spin .8s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',color:'white'}}>
      <div style={{padding:'56px 20px 16px'}}>
        <h1 style={{fontSize:28,fontWeight:700,margin:'0 0 16px',letterSpacing:'-0.5px'}}>Prospects</h1>
        <div style={{background:'#161616',borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,border:'1px solid rgba(255,255,255,0.06)'}}>
          <span style={{color:'rgba(255,255,255,0.3)'}}>🔍</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder={`Rechercher parmi ${filtered.length}...`} style={{background:'none',border:'none',outline:'none',color:'white',fontSize:14,width:'100%'}}/>
        </div>
      </div>
      <div style={{padding:'0 16px'}}>
        <div style={{background:'#161616',borderRadius:16,border:'1px solid rgba(255,255,255,0.06)',overflow:'hidden'}}>
          {filtered.length===0 && <div style={{padding:'40px 20px',textAlign:'center',color:'rgba(255,255,255,0.2)',fontSize:14}}>Aucun prospect</div>}
          {filtered.map((p,i)=>(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 16px',borderBottom:i<filtered.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
              <div style={{width:42,height:42,borderRadius:'50%',background:SC[p.status]+'18'||'rgba(255,255,255,0.08)',border:`1.5px solid ${SC[p.status]||'rgba(255,255,255,0.1)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:13,fontWeight:700,color:SC[p.status]||'rgba(255,255,255,0.4)'}}>{p.businessName?.charAt(0)||'?'}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.businessName}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.3)',marginTop:2}}>{p.city} · {p.industry}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:600,color:SC[p.status]||'rgba(255,255,255,0.4)'}}>{p.status}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.2)',marginTop:2}}>{p.score}/22 · {fmt(p.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default Prospects;