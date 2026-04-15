import React, { useEffect, useState, useRef } from 'react';

const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};
const fmt = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso), diff = Date.now() - d.getTime();
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

interface DashboardData {
  prospects: { total: number; newThisMonth: number; byStatus: Record<string, number> };
  clients: { totalActive: number; newThisMonth: number; byPlan: Record<string, number> };
  revenue: { mrr: number; setupFeesThisMonth: number; totalThisMonth: number };
  calls: { today: number; thisWeek: number; successRate: number };
  bot: { isActive: boolean; callsToday: number; callsQuota: number };
  prospectsReadyToCall: number;
  activity: any[];
}

const BOT_MESSAGES_ACTIVE = [
  'Analyse des prospects...', 'Passage d\'appels en cours...', 'Qualification des leads...',
  'Synchronisation CRM...', 'Évaluation des scores...', 'Planification des appels...',
];

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [botLoading, setBotLoading] = useState(false);
  const [botMsg, setBotMsg] = useState(0);
  const [angle, setAngle] = useState(0);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const msgRef = useRef<number>(0);

  const fetchData = () => {
    fetch(`${API}/api/admin/dashboard`, { headers: getHeaders() })
      .then(r => r.json()).then(setData).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 30000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (!data?.bot?.isActive) return;
    const animate = (ts: number) => {
      if (ts - lastRef.current > 16) { setAngle(a => (a + 1.5) % 360); lastRef.current = ts; }
      if (ts - msgRef.current > 4000) { setBotMsg(m => (m + 1) % BOT_MESSAGES_ACTIVE.length); msgRef.current = ts; }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [data?.bot?.isActive]);

  const toggleBot = async () => {
    if (!data) return;
    setBotLoading(true);
    const action = data.bot?.isActive ? 'stop' : 'start';
    await fetch(`${API}/api/admin/bot/${action}`, { method: 'POST', headers: getHeaders() }).catch(console.error);
    fetchData();
    setBotLoading(false);
  };

  if (loading) return (
    <div className='min-h-screen bg-gray-950 flex items-center justify-center'>
      <div className='w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
    </div>
  );

  const d = data;
  const active = d?.bot?.isActive ?? false;
  const nextMsg = BOT_MESSAGES_ACTIVE[botMsg];

  return (
    <div className='min-h-screen bg-gray-950 text-white pb-8'>
      <style>{`
        @keyframes orb-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes orb-pulse { 0%,100% { opacity:.7; transform:scale(1); } 50% { opacity:1; transform:scale(1.08); } }
        @keyframes dot-blink { 0%,100% { opacity:1; } 50% { opacity:.3; } }
        .orb-spin { animation: orb-rotate 3s linear infinite; }
        .orb-breathe { animation: orb-pulse 2.5s ease-in-out infinite; }
        .dot-live { animation: dot-blink 1.4s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className='px-4 pt-6 pb-4 flex items-center justify-between'>
        <div>
          <div className='text-xs text-gray-500 uppercase tracking-widest'>Admin</div>
          <h1 className='text-2xl font-bold text-white'>Qwillio</h1>
        </div>
        <div className='text-right'>
          <div className='text-xs text-gray-500'>{new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          <div className={`text-xs font-medium mt-0.5 ${active ? 'text-green-400' : 'text-gray-500'}`}>{active ? '● En ligne' : '○ Hors ligne'}</div>
        </div>
      </div>

      {/* Bot Activity Card */}
      <div className='mx-4 mb-4'>
        <div className={`rounded-2xl p-5 border ${active ? 'bg-gray-900 border-blue-500/30' : 'bg-gray-900 border-gray-800'}`}>
          <div className='flex items-center gap-4 mb-4'>
            {/* Animated orb */}
            <div className='relative flex-shrink-0 w-14 h-14'>
              {active ? (
                <>
                  <div className='orb-spin absolute inset-0 rounded-full' style={{background:'conic-gradient(from 0deg, #3b82f6, #8b5cf6, #06b6d4, #3b82f6)'}} />
                  <div className='absolute inset-0.5 rounded-full bg-gray-900' />
                  <div className='orb-breathe absolute inset-2 rounded-full bg-gradient-to-br from-blue-400 to-purple-500' />
                </>
              ) : (
                <>
                  <div className='absolute inset-0 rounded-full bg-gray-800' />
                  <div className='absolute inset-2 rounded-full bg-gray-700' />
                </>
              )}
            </div>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2'>
                <span className='font-semibold text-white'>Bot Qwillio</span>
                {active && <span className='dot-live w-2 h-2 rounded-full bg-green-400 inline-block' />}
              </div>
              <div className='text-sm mt-0.5 truncate'>
                {active
                  ? <span className='text-blue-400'>{nextMsg}</span>
                  : <span className='text-gray-500'>En attente</span>
                }
              </div>
            </div>
          </div>

          {active && (
            <div className='mb-4 rounded-xl bg-gray-800/60 p-3'>
              <div className='flex justify-between text-xs text-gray-400 mb-1.5'>
                <span>Appels aujourd'hui</span>
                <span className='text-white font-medium'>{d?.bot?.callsToday ?? 0} / {d?.bot?.callsQuota ?? 50}</span>
              </div>
              <div className='h-1.5 bg-gray-700 rounded-full overflow-hidden'>
                <div className='h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all'
                  style={{ width: `${Math.min(100, ((d?.bot?.callsToday ?? 0) / (d?.bot?.callsQuota ?? 50)) * 100)}%` }} />
              </div>
            </div>
          )}

          {!active && d?.activity && d.activity.length > 0 && (
            <div className='mb-4 rounded-xl bg-gray-800/40 p-3'>
              <div className='text-xs text-gray-500 mb-1'>Dernière activité</div>
              <div className='text-xs text-gray-300 truncate'>{d.activity[0]?.description || d.activity[0]?.message || '—'}</div>
              <div className='text-xs text-gray-600 mt-0.5'>{fmt(d.activity[0]?.createdAt || d.activity[0]?.timestamp)}</div>
            </div>
          )}

          <button onClick={toggleBot} disabled={botLoading}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
              active
                ? 'bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            } disabled:opacity-50`}>
            {botLoading ? '...' : active ? 'Arrêter le bot' : 'Démarrer le bot'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className='px-4 grid grid-cols-2 gap-3 mb-4'>
        {[
          { label: 'Appels', value: d?.calls?.today ?? 0, sub: `cette semaine: ${d?.calls?.thisWeek ?? 0}`, color: 'text-white' },
          { label: 'Prospects', value: d?.prospects?.total ?? 0, sub: `+${d?.prospects?.newThisMonth ?? 0} ce mois`, color: 'text-blue-400' },
          { label: 'Clients', value: d?.clients?.totalActive ?? 0, sub: `+${d?.clients?.newThisMonth ?? 0} ce mois`, color: 'text-green-400' },
          { label: 'MRR', value: `${(d?.revenue?.mrr ?? 0).toFixed(0)}€`, sub: `setup: ${(d?.revenue?.setupFeesThisMonth ?? 0).toFixed(0)}€`, color: 'text-amber-400' },
        ].map((s, i) => (
          <div key={i} className='bg-gray-900 border border-gray-800 rounded-2xl p-4'>
            <div className='text-xs text-gray-500 mb-1'>{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className='text-xs text-gray-600 mt-1 truncate'>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Activity Feed */}
      {(d?.activity?.length ?? 0) > 0 && (
        <div className='mx-4'>
          <div className='text-xs text-gray-500 uppercase tracking-widest mb-3'>Activité récente</div>
          <div className='space-y-2'>
            {d!.activity.slice(0, 5).map((a: any, i: number) => (
              <div key={i} className='bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3'>
                <div className='w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0' />
                <div className='flex-1 min-w-0'>
                  <div className='text-sm text-white truncate'>{a.description || a.message || a.type || '—'}</div>
                </div>
                <div className='text-xs text-gray-600 flex-shrink-0'>{fmt(a.createdAt || a.timestamp)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;