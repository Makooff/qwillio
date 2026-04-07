import React, { useEffect, useState } from 'react';

const API = 'https://qwillio.onrender.com';

const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
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

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [botLoading, setBotLoading] = useState(false);

  const fetchData = () => {
    fetch(`${API}/api/admin/dashboard`, { headers: getHeaders() })
      .then(r => r.json()).then(setData).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const toggleBot = async () => {
    if (!data) return;
    setBotLoading(true);
    const action = data.bot?.isActive ? 'stop' : 'start';
    await fetch(`${API}/api/admin/bot/${action}`, { method: 'POST', headers: getHeaders() }).catch(console.error);
    await fetchData();
    setBotLoading(false);
  };

  if (loading) return <div className='p-8 text-gray-400'>Chargement...</div>;
  if (!data) return <div className='p-8 text-red-400'>Erreur de chargement des données</div>;

  const d = data;

  return (
    <div className='p-8'>
      <div className='flex items-center justify-between mb-8'>
        <h1 className='text-2xl font-bold text-white'>Overview</h1>
        <button
          onClick={toggleBot}
          disabled={botLoading}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${d.bot?.isActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'} disabled:opacity-50`}
        >
          {botLoading ? '...' : d.bot?.isActive ? 'Arrêter le bot' : 'Démarrer le bot'}
        </button>
      </div>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
        <div className='bg-gray-800 rounded-xl p-4'>
          <div className='text-gray-400 text-sm'>Appels aujourd&#39;hui</div>
          <div className='text-3xl font-bold text-white'>{d.calls?.today ?? 0}</div>
          <div className='text-gray-500 text-xs mt-1'>quota: {d.bot?.callsQuota ?? 50}</div>
        </div>
        <div className='bg-gray-800 rounded-xl p-4'>
          <div className='text-gray-400 text-sm'>Prospects</div>
          <div className='text-3xl font-bold text-blue-400'>{d.prospects?.total ?? 0}</div>
          <div className='text-gray-500 text-xs mt-1'>prêts: {d.prospectsReadyToCall ?? 0}</div>
        </div>
        <div className='bg-gray-800 rounded-xl p-4'>
          <div className='text-gray-400 text-sm'>Clients actifs</div>
          <div className='text-3xl font-bold text-green-400'>{d.clients?.totalActive ?? 0}</div>
        </div>
        <div className='bg-gray-800 rounded-xl p-4'>
          <div className='text-gray-400 text-sm'>MRR</div>
          <div className='text-3xl font-bold text-yellow-400'>{(d.revenue?.mrr ?? 0).toFixed(0)} €</div>
        </div>
      </div>

      {d.activity && d.activity.length > 0 && (
        <div className='bg-gray-800 rounded-xl p-6'>
          <h2 className='text-lg font-semibold text-white mb-4'>Activité récente</h2>
          {d.activity.slice(0, 5).map((a: any, i: number) => (
            <div key={i} className='flex items-center gap-3 py-2 border-b border-gray-700'>
              <span className='text-gray-400 text-sm'>{a.type || a.action}</span>
              <span className='text-white text-sm'>{a.description || a.message || JSON.stringify(a).slice(0,80)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;