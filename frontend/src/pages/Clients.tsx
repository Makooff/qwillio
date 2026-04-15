import React, { useEffect, useState } from 'react';

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
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

interface Client {
  id: string; businessName: string; contactName: string; email: string;
  phone: string; plan: string; monthlyFee: number; status: string;
  city: string; industry: string; createdAt: string;
}

const planColor: Record<string, string> = {
  starter: 'bg-gray-700/50 text-gray-300',
  pro: 'bg-blue-500/20 text-blue-300',
  business: 'bg-purple-500/20 text-purple-300',
  enterprise: 'bg-amber-500/20 text-amber-300',
};

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/clients`, { headers: getHeaders() })
      .then(r => r.json())
      .then(d => setClients(Array.isArray(d) ? d : d.clients || []))
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c =>
    c.businessName?.toLowerCase().includes(search.toLowerCase()) ||
    c.contactName?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );
  const mrr = filtered.reduce((s, c) => s + (c.monthlyFee || 0), 0);

  if (loading) return (
    <div className='min-h-screen bg-gray-950 flex items-center justify-center'>
      <div className='w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
    </div>
  );

  return (
    <div className='min-h-screen bg-gray-950 text-white pb-8'>
      <div className='px-4 pt-6 pb-4'>
        <div className='text-xs text-gray-500 uppercase tracking-widest'>Admin</div>
        <div className='flex items-end justify-between mt-1'>
          <h1 className='text-2xl font-bold'>Clients</h1>
          <div className='text-right'>
            <div className='text-xs text-gray-500'>MRR total</div>
            <div className='text-lg font-bold text-amber-400'>{mrr.toFixed(0)}€</div>
          </div>
        </div>
      </div>

      <div className='px-4 mb-4'>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder='Rechercher un client...'
          className='w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50' />
      </div>

      <div className='px-4 mb-3 text-xs text-gray-600'>{filtered.length} client{filtered.length !== 1 ? 's' : ''}</div>

      <div className='px-4 space-y-3'>
        {filtered.map(c => (
          <div key={c.id} className='bg-gray-900 border border-gray-800 rounded-2xl p-4'>
            <div className='flex items-start justify-between gap-2 mb-3'>
              <div className='flex-1 min-w-0'>
                <div className='font-semibold text-white leading-tight truncate'>{c.businessName}</div>
                {c.contactName && <div className='text-xs text-gray-500 mt-0.5'>{c.contactName}</div>}
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 font-medium ${planColor[c.plan?.toLowerCase()] || 'bg-gray-800 text-gray-400'}`}>
                {c.plan || 'N/A'}
              </span>
            </div>
            <div className='grid grid-cols-2 gap-2 text-xs'>
              <div className='bg-gray-800/50 rounded-xl p-2.5'>
                <div className='text-gray-500 mb-0.5'>Mensuel</div>
                <div className='text-white font-semibold'>{(c.monthlyFee || 0).toFixed(0)}€/mois</div>
              </div>
              <div className='bg-gray-800/50 rounded-xl p-2.5'>
                <div className='text-gray-500 mb-0.5'>Ville</div>
                <div className='text-white truncate'>{c.city || '—'}</div>
              </div>
            </div>
            {c.email && (
              <div className='mt-2.5 flex items-center justify-between text-xs'>
                <span className='text-gray-600 truncate flex-1'>{c.email}</span>
                <span className='text-gray-700 ml-2 shrink-0'>{fmt(c.createdAt)}</span>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className='text-center py-16 text-gray-600'>
            <div className='text-4xl mb-3'>👥</div>
            <div>Aucun client trouvé</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Clients;