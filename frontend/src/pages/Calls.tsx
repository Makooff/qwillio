import React, { useEffect, useState } from 'react';
const API = 'https://qwillio.onrender.com';
const getH = (): Record<string,string> => { const t=localStorage.getItem('token'); return t?{Authorization:`Bearer ${t}`}:{}; };
const fmt = (iso:string) => { if(!iso) return ''; const d=new Date(iso),diff=Date.now()-d.getTime(); if(diff<3600000) return `${Math.floor(diff/60000)}min`; if(diff<86400000) return `${Math.floor(diff/3600000)}h`; return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); };
const OC: Record<string,string> = { interested:'#a78bfa', not_interested:'rgba(255,80,80,0.7)', no_answer:'rgba(255,255,255,0.25)', callback:'#c4b5fd', converted:'#8B5CF6' };
interface C { id:string; prospectName:string; status:string; duration:number; outcome:string; createdAt:string; }
const Calls: React.FC = () => {
  const [items,setItems]=useState<C[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ fetch(`${API}/api/admin/calls`,{headers:getH()}).then(r=>r.json()).then(d=>setItems(Array.isArray(d)?d:d.calls||[])).catch(console.error).finally(()=>setLoading(false)); },[]);
  if(loading) return <div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:28,height:28,borderRadius:'50%',border:'2px solid #8B5CF6',borderTopColor:'transparent',animation:'spin .8s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
  return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',color:'white'}}>
      <div style={{padding:'56px 20px 16px'}}>
        <h1 style={{fontSize:28,fontWeight:700,margin:'0 0 4px',letterSpacing:'-0.5px'}}>Appels</h1>
        <div style={{fontSize:13,color:'rgba(255,255,255,0.3)'}}>{items.length} appel{items.length!==1?'s':''}</div>
      </div>
      <div style={{padding:'0 16px'}}>
        <div style={{background:'#161616',borderRadius:16,border:'1px solid rgba(255,255,255,0.06)',overflow:'hidden'}}>
          {items.length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:'rgba(255,255,255,0.2)',fontSize:14}}>Aucun appel</div>}
          {items.map((c,i)=>(
            <div key={c.id} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 16px',borderBottom:i<items.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
              <div style={{width:42,height:42,borderRadius:'50%',background:OC[c.outcome]+'18'||'rgba(255,255,255,0.08)',border:`1.5px solid ${OC[c.outcome]||'rgba(255,255,255,0.1)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:18}}>📞</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.prospectName||'Inconnu'}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.3)',marginTop:2}}>{c.duration?`${Math.floor(c.duration/60)}m${c.duration%60}s`:'—'}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:600,color:OC[c.outcome]||'rgba(255,255,255,0.4)'}}>{c.outcome||c.status}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.2)',marginTop:2}}>{fmt(c.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default Calls;