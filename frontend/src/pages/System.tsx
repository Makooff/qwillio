import React, { useEffect, useState } from 'react';

const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

interface SystemData {
  prospects: number; clients: number;
  botStatus: { isActive: boolean; callsToday: number; quota: number; uptime?: number };
  database: { status: string };
  recentErrors?: number;
}

const System: React.FC = () => {
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ping, setPing] = useState<number | null>(null);

  useEffect(() => {
    const t0 = Date.now();
    fetch(`${API}/api/admin/system`, { headers: getHeaders() })
      .then(r => r.json()).then(d => { setData(d); setPing(Date.now() - t0); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className='min-h-screen bg-gray-950 flex items-center justify-center'>
      <div className='w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
    </div>
  );

  const d = data;
  const healthy = d?.database?.status === 'connected' || d?.database?.status === 'ok';

  return (
    <div className='min-h-screen bg-gray-950 text-white pb-8'>
      <div className='px-4 pt-6 pb-4'>
        <div className='text-xs text-gray-500 uppercase tracking-widest'>Admin</div>
        <h1 className='text-2xl font-bold mt-1'>Système</h1>
      </div>

      {/* Health indicators */}
      <div className='px-4 space-y-3 mb-6'>
        {[
          { label: 'API Backend', ok: true, detail: ping ? `${ping}ms` : '—' },
          { label: 'Base de données', ok: healthy, detail: d?.database?.status || 'unknown' },
          { label: 'Bot', ok: d?.botStatus?.isActive ?? false, detail: d?.botStatus?.isActive ? 'Actif' : 'Inactif' },
        ].map((item, i) => (
          <div key={i} className='bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className={`w-2.5 h-2.5 rounded-full ${item.ok ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className='text-sm font-medium text-white'>{item.label}</span>
            </div>
            <span className={`text-xs ${item.ok ? 'text-gray-400' : 'text-red-400'}`}>{item.detail}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className='px-4 grid grid-cols-2 gap-3 mb-6'>
        <div className='bg-gray-900 border border-gray-800 rounded-2xl p-4'>
          <div className='text-xs text-gray-500 mb-1'>Prospects</div>
          <div className='text-2xl font-bold text-blue-400'>{d?.prospects ?? 0}</div>
        </div>
        <div className='bg-gray-900 border border-gray-800 rounded-2xl p-4'>
          <div className='text-xs text-gray-500 mb-1'>Clients</div>
          <div className='text-2xl font-bold text-green-400'>{d?.clients ?? 0}</div>
        </div>
        <div className='bg-gray-900 border border-gray-800 rounded-2xl p-4'>
          <div className='text-xs text-gray-500 mb-1'>Appels / quota</div>
          <div className='text-2xl font-bold text-white'>
            {d?.botStatus?.callsToday ?? 0}
            <span className='text-sm text-gray-600 font-normal'>/{d?.botStatus?.quota ?? 50}</span>
          </div>
        </div>
        <div className='bg-gray-900 border border-gray-800 rounded-2xl p-4'>
          <div className='text-xs text-gray-500 mb-1'>Erreurs récentes</div>
          <div className={`text-2xl font-bold ${(d?.recentErrors ?? 0) > 0 ? 'text-red-400' : 'text-gray-600'}`}>
            {d?.recentErrors ?? 0}
          </div>
        </div>
      </div>

      {/* Bot quota bar */}
      <div className='mx-4'>
        <div className='text-xs text-gray-500 uppercase tracking-widest mb-3'>Quota appels</div>
        <div className='bg-gray-900 border border-gray-800 rounded-2xl p-4'>
          <div className='flex justify-between text-xs mb-2'>
            <span className='text-gray-400'>Aujourd'hui</span>
            <span className='text-white font-medium'>
              {d?.botStatus?.callsToday ?? 0} / {d?.botStatus?.quota ?? 50}
            </span>
          </div>
          <div className='h-2 bg-gray-800 rounded-full overflow-hidden'>
            <div className='h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all'
              style={{ width: `${Math.min(100, ((d?.botStatus?.callsToday ?? 0) / (d?.botStatus?.quota ?? 50)) * 100)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default System;