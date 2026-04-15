import React, { useEffect, useState } from 'react';

const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};
const fmt = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso), diff = Date.now() - d.getTime();
  if (diff < 3600000) return `il y a ${Math.floor(diff/60000)}min`;
  if (diff < 86400000) return `il y a ${Math.floor(diff/3600000)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

interface Prospect {
  id: string; businessName: string; industry: string; phone: string;
  score: number; status: string; city: string; createdAt: string; callCount: number;
}

const statusColor: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300',
  called: 'bg-yellow-500/20 text-yellow-300',
  interested: 'bg-green-500/20 text-green-300',
  not_interested: 'bg-red-500/20 text-red-300',
  converted: 'bg-purple-500/20 text-purple-300',
};

const Prospects: React.FC = () => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/prospects`, { headers: getHeaders() })
      .then(r => r.json()).then(d => setProspects(Array.isArray(d) ? d : d.prospects || []))
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = prospects.filter(p =>
    p.businessName?.toLowerCase().includes(search.toLowerCase()) ||
    p.city?.toLowerCase().includes(search.toLowerCase()) ||
    p.industry?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className='p-4 text-gray-400'>Chargement...</div>;

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <div className='flex items-center justify-between mb-4'>
        <h1 className='text-xl font-bold text-white'>Prospects</h1>
        <span className='text-gray-400 text-sm'>{filtered.length}</span>
      </div>
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder='Rechercher...'
        className='w-full mb-4 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm'
      />
      <div className='space-y-3'>
        {filtered.map(p => (
          <div key={p.id} className='bg-gray-800 rounded-xl p-4 border border-gray-700'>
            <div className='flex items-start justify-between gap-2 mb-2'>
              <div className='flex-1 min-w-0'>
                <div className='font-semibold text-white text-sm leading-tight truncate'>{p.businessName}</div>
                <div className='text-gray-400 text-xs mt-0.5'>{p.city} · {p.industry}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusColor[p.status] || 'bg-gray-700 text-gray-300'}`}>
                {p.status}
              </span>
            </div>
            <div className='flex items-center justify-between text-xs text-gray-500'>
              <span>{p.phone}</span>
              <div className='flex items-center gap-3'>
                <span>Score {p.score}</span>
                {p.callCount > 0 && <span>{p.callCount} appel{p.callCount > 1 ? 's' : ''}</span>}
                <span className='text-gray-600'>{fmt(p.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className='text-center text-gray-500 py-8'>Aucun prospect</div>}
      </div>
    </div>
  );
};

export default Prospects;