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

interface Lead {
  id: string; businessName: string; contactName: string; email: string;
  phone: string; industry: string; city: string; status: string; createdAt: string; notes: string;
}

const Leads: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/leads`, { headers: getHeaders() })
      .then(r => r.json()).then(d => setLeads(Array.isArray(d) ? d : d.leads || []))
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className='p-4 text-gray-400'>Chargement...</div>;

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <div className='flex items-center justify-between mb-4'>
        <h1 className='text-xl font-bold text-white'>Leads</h1>
        <span className='text-gray-400 text-sm'>{leads.length}</span>
      </div>
      <div className='space-y-3'>
        {leads.map(l => (
          <div key={l.id} className='bg-gray-800 rounded-xl p-4 border border-gray-700'>
            <div className='flex items-start justify-between gap-2 mb-1'>
              <div className='flex-1 min-w-0'>
                <div className='font-semibold text-white text-sm leading-tight truncate'>{l.businessName}</div>
                {l.contactName && <div className='text-gray-400 text-xs'>{l.contactName}</div>}
              </div>
              <span className='text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 shrink-0'>{l.status || 'lead'}</span>
            </div>
            <div className='text-xs text-gray-500 mt-1 space-y-0.5'>
              {l.email && <div>{l.email}</div>}
              {l.phone && <div>{l.phone}</div>}
              <div className='flex justify-between pt-1'>
                <span>{l.city} · {l.industry}</span>
                <span className='text-gray-600'>{fmt(l.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
        {leads.length === 0 && <div className='text-center text-gray-500 py-8'>Aucun lead</div>}
      </div>
    </div>
  );
};

export default Leads;