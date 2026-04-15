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

interface Call {
  id: string; prospectName: string; status: string; duration: number;
  outcome: string; createdAt: string; vapiCallId: string;
}

const outcomeColor: Record<string, string> = {
  interested: 'bg-green-500/20 text-green-300',
  not_interested: 'bg-red-500/20 text-red-300',
  no_answer: 'bg-gray-500/20 text-gray-300',
  callback: 'bg-yellow-500/20 text-yellow-300',
  converted: 'bg-purple-500/20 text-purple-300',
};

const Calls: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/calls`, { headers: getHeaders() })
      .then(r => r.json()).then(d => setCalls(Array.isArray(d) ? d : d.calls || []))
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className='p-4 text-gray-400'>Chargement...</div>;

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <div className='flex items-center justify-between mb-4'>
        <h1 className='text-xl font-bold text-white'>Appels</h1>
        <span className='text-gray-400 text-sm'>{calls.length}</span>
      </div>
      <div className='space-y-3'>
        {calls.map(c => (
          <div key={c.id} className='bg-gray-800 rounded-xl p-4 border border-gray-700'>
            <div className='flex items-start justify-between gap-2 mb-2'>
              <div className='font-semibold text-white text-sm leading-tight flex-1 min-w-0 truncate'>
                {c.prospectName || 'Inconnu'}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${outcomeColor[c.outcome] || 'bg-gray-700 text-gray-300'}`}>
                {c.outcome || c.status}
              </span>
            </div>
            <div className='flex items-center justify-between text-xs text-gray-500'>
              <span>{c.duration ? `${Math.floor(c.duration / 60)}m${c.duration % 60}s` : '\u2014'}</span>
              <span className='text-gray-600'>{fmt(c.createdAt)}</span>
            </div>
          </div>
        ))}
        {calls.length === 0 && <div className='text-center text-gray-500 py-8'>Aucun appel</div>}
      </div>
    </div>
  );
};

export default Calls;