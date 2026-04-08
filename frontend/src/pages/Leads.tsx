import React, { useEffect, useState } from 'react';

const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const STAGES = ['contacted', 'qualified', 'proposal'];
const LABELS: Record<string, string> = { contacted: 'Contacté', qualified: 'Qualifié', proposal: 'Proposition' };

const Leads: React.FC = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/leads`, { headers: getHeaders() })
      .then(r => r.json()).then(setLeads).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className='p-8 text-gray-400'>Chargement...</div>;

  return (
    <div className='p-8'>
      <h1 className='text-2xl font-bold text-white mb-6'>Pipeline Leads</h1>
      <div className='grid grid-cols-3 gap-4'>
        {STAGES.map(stage => (
          <div key={stage} className='bg-gray-800 rounded-xl p-4'>
            <div className='text-gray-400 text-sm mb-3'>{LABELS[stage]} ({leads.filter(l => l.status === stage).length})</div>
            {leads.filter(l => l.status === stage).map((l, i) => (
              <div key={i} className='bg-gray-700 rounded-lg p-3 mb-2'>
                <div className='text-white text-sm font-medium'>{l.companyName || l.name || 'Prospect'}</div>
                <div className='text-gray-400 text-xs'>{l.phone || l.email || ''}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leads;