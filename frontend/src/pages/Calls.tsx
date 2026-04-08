import React, { useEffect, useState } from 'react';

const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const Calls: React.FC = () => {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch(`${API}/api/admin/calls`, { headers: getHeaders() })
      .then(r => r.json()).then(setCalls).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className='p-8 text-gray-400'>Chargement...</div>;

  const filtered = filter === 'all' ? calls : calls.filter(c => c.status === filter);
  const answered = calls.filter(c => c.status === 'answered').length;
  const rate = calls.length > 0 ? Math.round((answered / calls.length) * 100) : 0;

  return (
    <div className='p-8'>
      <h1 className='text-2xl font-bold text-white mb-6'>Appels</h1>
      <div className='grid grid-cols-3 gap-4 mb-6'>
        <div className='bg-gray-800 rounded-xl p-4'><div className='text-gray-400 text-sm'>Total</div><div className='text-2xl font-bold text-white'>{calls.length}</div></div>
        <div className='bg-gray-800 rounded-xl p-4'><div className='text-gray-400 text-sm'>Répondus</div><div className='text-2xl font-bold text-green-400'>{answered}</div></div>
        <div className='bg-gray-800 rounded-xl p-4'><div className='text-gray-400 text-sm'>Taux</div><div className='text-2xl font-bold text-blue-400'>{rate}%</div></div>
      </div>
      <div className='flex gap-2 mb-4'>
        {['all','answered','missed','failed'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 rounded-full text-sm ${filter===s?'bg-blue-600 text-white':'bg-gray-700 text-gray-300'}`}>{s}</button>
        ))}
      </div>
      <div className='bg-gray-800 rounded-xl overflow-hidden'>
        {filtered.length === 0 ? <div className='p-8 text-center text-gray-400'>Aucun appel</div> : filtered.map((c, i) => (
          <div key={i} className='flex items-center justify-between p-4 border-b border-gray-700'>
            <span className='text-white'>{c.phone || c.prospectName || 'Inconnu'}</span>
            <span className={`px-2 py-1 rounded text-xs ${c.status==='answered'?'bg-green-900 text-green-300':c.status==='missed'?'bg-yellow-900 text-yellow-300':'bg-red-900 text-red-300'}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Calls;