import React, { useEffect, useState } from 'react';

const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

interface BillingData {
  totalMrr: number;
  clientCount: number;
  byPlan: Record<string, number>;
}

const Billing: React.FC = () => {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/billing`, { headers: getHeaders() })
      .then(r => r.json()).then(setData).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className='p-8 text-gray-400'>Chargement...</div>;
  if (!data) return <div className='p-8 text-red-400'>Erreur de chargement</div>;

  return (
    <div className='p-8'>
      <h1 className='text-2xl font-bold text-white mb-6'>Facturation</h1>
      <div className='bg-gradient-to-r from-green-900 to-green-700 rounded-xl p-6 mb-6'>
        <div className='text-green-300 text-sm mb-1'>MRR Total</div>
        <div className='text-4xl font-bold text-white'>{data.totalMrr.toFixed(2)} €</div>
        <div className='text-green-300 text-sm mt-2'>{data.clientCount} clients actifs</div>
      </div>
      {Object.keys(data.byPlan).length > 0 && (
        <div className='bg-gray-800 rounded-xl p-6'>
          <h2 className='text-lg font-semibold text-white mb-4'>Par plan</h2>
          {Object.entries(data.byPlan).map(([plan, count]) => (
            <div key={plan} className='flex justify-between py-2 border-b border-gray-700'>
              <span className='text-gray-300'>{plan}</span>
              <span className='text-white font-medium'>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Billing;