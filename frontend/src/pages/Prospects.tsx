import React, { useEffect, useState } from 'react';

const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-900 text-blue-300',
  contacted: 'bg-yellow-900 text-yellow-300',
  qualified: 'bg-purple-900 text-purple-300',
  converted: 'bg-green-900 text-green-300',
  refused: 'bg-red-900 text-red-300',
};

const Prospects: React.FC = () => {
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch(`${API}/api/admin/prospects`, { headers: getHeaders() })
      .then(r => r.json()).then(setProspects).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className='p-8 text-gray-400'>Chargement...</div>;

  const filtered = prospects.filter(p => {
    const matchSearch = !search || (p.companyName||p.name||p.phone||'').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className='p-8'>
      <h1 className='text-2xl font-bold text-white mb-6'>Prospects ({prospects.length})</h1>
      <div className='flex gap-4 mb-4'>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder='Rechercher...' className='flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg outline-none' />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className='bg-gray-700 text-white px-3 py-2 rounded-lg'>
          <option value='all'>Tous</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className='bg-gray-800 rounded-xl overflow-hidden'>
        {filtered.map((p, i) => (
          <div key={i} className='flex items-center justify-between p-4 border-b border-gray-700'>
            <div>
              <div className='text-white font-medium'>{p.companyName || p.name || 'Prospect'}</div>
              <div className='text-gray-400 text-sm'>{p.phone || p.email || ''}</div>
            </div>
            <div className='flex items-center gap-3'>
              <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[p.status] || 'bg-gray-700 text-gray-300'}`}>{p.status}</span>
              <span className='text-gray-400 text-sm'>{p.callAttempts || 0} appels</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Prospects;