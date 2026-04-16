import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'https://qwillio.onrender.com';
const getH = (): Record<string, string> => { const t = localStorage.getItem('token'); return t ? { Authorization: `Bearer ${t}` } : {}; };
const fmt = (iso: string) => { if (!iso) return ''; const d = new Date(iso), diff = Date.now() - d.getTime(); if (diff < 3600000) return `${Math.floor(diff/60000)}min`; if (diff < 86400000) return `${Math.floor(diff/3600000)}h`; return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
const C: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (<div style={{ background: '#161616', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', ...style }}>{children}</div>);
interface BotAction { message: string; timestamp: string; }
interface D { prospects: { total: number; newThisMonth: number }; clients: { totalActive: number; newThisMonth: number }; revenue: { mrr: number }; calls: { today: number; thisWeek: number }; bot: { isActive: boolean; callsToday: number; callsQuota: number; lastAction?: BotAction | null; recentActions?: BotAction[] }; activity: any[]; }
const Dashboard: React.FC = () => {
  const [data, setData] = useState<D | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [prevAction, setPrevAction] = useState<string>('');
  const [actionAnim, setActionAnim] = useState(false);
  const nav = useNavigate();
  const load = () => fetch(`${API}/api/admin/dashboard`, { headers: getH() }).then(r => r.json()).then((d: D) => {
    setData(d);
    const newAction = d?.bot?.lastAction?.message || '';
    if (newAction && newAction !== prevAction) { setPrevAction(newAction); setActionAnim(true); setTimeout(() => setActionAnim(false), 400); }
  }).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);
  const toggle = async () => {
    if (!data) return;
    setBusy(true);
    const action = data.bot?.isActive ? 'stop' : 'start';
    try {
      const r = await fetch(`${API}/api/admin/bot/${action}`, { method: 'POST', headers: { ...getH(), 'Content-Type': 'application/json' } });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        console.error(`Bot ${action} failed:`, r.status, err);
        alert(`Erreur ${r.status}: ${err.error || 'Échec'}`);
      }
    } catch (e) {
      console.error(`Bot ${action} network error:`, e);
      alert('Erreur réseau — le serveur est peut-être en train de démarrer. Réessaie dans 30s.');
    }
    await load();
    setBusy(false);
  };
  if (loading) return (<div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #8B5CF6', borderTopColor: 'transparent', animation: 'spin .8s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>);
  const d = data!; const active = d?.bot?.isActive ?? false;
  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes orb-spin{to{transform:rotate(360deg)}} @keyframes orb-pulse{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.12)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:.15}} @keyframes fade-up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ padding: '56px 20px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0, color: 'white' }}>Q</div>
        <div style={{ flex: 1, background: '#161616', borderRadius: 20, padding: '10px 16px', fontSize: 14, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.06)' }}>🔍 Rechercher</div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <C>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 4 }}>
              <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                {active ? (<><div style={{ position: 'absolute', inset: 0, borderRadius: '50%', animation: 'orb-spin 3s linear infinite', background: 'conic-gradient(from 0deg, #6366F1, #8B5CF6, #a78bfa, #6366F1)' }} /><div style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: '#161616' }} /><div style={{ position: 'absolute', inset: 4, borderRadius: '50%', animation: 'orb-pulse 2.5s ease-in-out infinite', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }} /></>) : (<div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Bot Qwillio</span>
                  {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', animation: 'blink 1.4s ease infinite', display: 'inline-block' }} />}
                </div>
                <div key={prevAction} style={{ fontSize: 12, color: active ? '#a78bfa' : 'rgba(255,255,255,0.3)', marginTop: 2, animation: actionAnim ? 'fade-up .35s ease' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active ? (d.bot?.lastAction?.message || 'En attente...') : 'Inactif'}</div>
              </div>
              <button onClick={toggle} disabled={busy} style={{ padding: '7px 16px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: active ? 'rgba(255,59,48,0.1)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: active ? 'rgba(255,80,70,0.9)' : 'white', whiteSpace: 'nowrap', opacity: busy ? 0.5 : 1, boxShadow: active ? 'none' : '0 2px 12px rgba(139,92,246,0.3)' }}>{busy ? '...' : active ? 'Arrêter' : 'Démarrer'}</button>
            </div>
            {[{ label: 'Prospects', sub: `+${d.prospects?.newThisMonth ?? 0} ce mois`, value: `${d.prospects?.total ?? 0}`, color: '#8B5CF6', icon: '◎', to: '/admin/prospects' }, { label: 'Clients', sub: `+${d.clients?.newThisMonth ?? 0} ce mois`, value: `${d.clients?.totalActive ?? 0}`, color: '#a78bfa', icon: '◍', to: '/admin/clients' }, { label: 'MRR', sub: 'récurrent', value: `${(d.revenue?.mrr ?? 0).toFixed(0)}€`, color: '#c4b5fd', icon: '◑', to: '/admin/billing' }].map((item, i) => (
              <div key={i} onClick={() => nav(item.to)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: item.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontSize: 16, color: item.color }}>{item.icon}</span></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 500 }}>{item.label}</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{item.sub}</div></div>
                <div style={{ fontSize: 15, fontWeight: 600, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </C>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 4px' }}>Appels</div>
        <C>
          <div style={{ padding: '4px 0' }}>
            {[{ label: 'Aujourd\'hui', value: `${d.calls?.today ?? 0}`, sub: 'appels passés', pct: Math.min(100, ((d.calls?.today ?? 0) / (d.bot?.callsQuota ?? 50)) * 100) }, { label: 'Cette semaine', value: `${d.calls?.thisWeek ?? 0}`, sub: 'total', pct: null }, { label: 'Quota', value: `${d.bot?.callsToday ?? 0}/${d.bot?.callsQuota ?? 50}`, sub: "aujourd'hui", pct: Math.min(100, ((d.bot?.callsToday ?? 0) / (d.bot?.callsQuota ?? 50)) * 100) }].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📞</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{row.label}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{row.sub}</div>
                  {row.pct !== null && <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}><div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#6366F1,#8B5CF6)', width: `${row.pct}%` }} /></div>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{row.value}</div>
              </div>
            ))}
          </div>
        </C>
        {(d.activity?.length ?? 0) > 0 && (<>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 4px' }}>Activité</div>
          <C>
            <div style={{ padding: '4px 0' }}>
              {d.activity.slice(0, 5).map((a: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6', opacity: 1 - i * 0.15 }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description || a.message || a.type || '—'}</div></div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{fmt(a.createdAt || a.timestamp)}</div>
                </div>
              ))}
            </div>
          </C>
        </>)}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
};
export default Dashboard;