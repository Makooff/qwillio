import React, { useEffect, useState } from 'react';

const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const System: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/system`, { headers: getHeaders() })
      .then(r => r.json()).then(setData).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className='p-8 text-gray-400'>Chargement...</div>;
  if (!data) return <div className='p-8 text-red-400'>Erreur de chargement</div>;

  const uptime = data.uptime ? `${Math.floor(data.uptime / 3600)}h ${Math.floor((data.uptime % 3600) / 60)}m` : 'N/A';

  return (
    <div className='p-8'>
      <h1 className='text-2xl font-bold text-white mb-6'>Système</h1>
      <div className='grid grid-cols-2 gap-4'>
        <div className='bg-gray-800 rounded-xl p-4'>
          <div className='text-gray-400 text-sm'>Base de données</div>
          <div className={`text-lg font-bold ${data.db === 'connected' ? 'text-green-400' : 'text-red-400'}`}>{data.db}</div>
        </div>
        <div className='bg-gray-800 rounded-xl p-4'>
          <div className='text-gray-400 text-sm'>Uptime</div>
          <div className='text-lg font-bold text-white'>{uptime}</div>
        </div>
        <div className='bg-gray-800 rounded-xl p-4'>
          <div className='text-gray-400 text-sm'>Node.js</div>
          <div className='text-lg font-bold text-white'>{data.nodeVersion}</div>
        </div>
        <div className='bg-gray-800 rounded-xl p-4'>
          <div className='text-gray-400 text-sm'>Environnement</div>
          <div className='text-lg font-bold text-white'>{data.env}</div>
        </div>
        <div className='bg-gray-800 rounded-xl p-4'>
          <div className='text-gray-400 text-sm'>Prospects</div>
          <div className='text-lg font-bold text-blue-400'>{data.prospects}</div>
        </div>
        <div className='bg-gray-800 rounded-xl p-4'>
          <div className='text-gray-400 text-sm'>Clients</div>
          <div className='text-lg font-bold text-green-400'>{data.clients}</div>
        </div>
      </div>
    </div>
  );
};

export default System;