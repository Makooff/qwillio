import React, { useEffect, useState } from 'react';

const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const Clients: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/clients`, { headers: getHeaders() })
      .then(r => r.json()).then(setClients).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className='p-8 text-gray-400'>Chargement...</div>;

  const filtered = clients.filter(c =>
    !search || (c.name||c.companyName||'').toLowerCase().includes(search.toLowerCase())
  );
  const mrr = clients.reduce((s, c) => s + Number(c.monthlyFee || 0), 0);

  return (
    <div className='p-8'>
      <h1 className='text-2xl font-bold text-white mb-6'>Clients</h1>
      <div className='bg-gray-800 rounded-xl p-4 mb-6'>
        <div className='text-gray-400 text-sm'>MRR Total</div>
        <div className='text-3xl font-bold text-green-400'>{mrr.toFixed(2)} €</div>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder='Rechercher...' className='w-full bg-gray-700 text-white px-4 py-2 rounded-lg mb-4 outline-none' />
      <div className='bg-gray-800 rounded-xl overflow-hidden'>
        {filtered.map((c, i) => (
          <div key={i} className='flex items-center justify-between p-4 border-b border-gray-700'>
            <div>
              <div className='text-white font-medium'>{c.name || c.companyName || 'Client'}</div>
              <div className='text-gray-400 text-sm'>{c.email}</div>
            </div>
            <div className='text-right'>
              <span className='bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs'>{c.plan || 'Standard'}</span>
              <div className='text-green-400 text-sm mt-1'>{Number(c.monthlyFee||0).toFixed(2)} €/mois</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Clients;