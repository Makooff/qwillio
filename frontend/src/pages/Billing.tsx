import React, { useEffect, useState } from 'react';

const API = 'https://qwillio.onrender.com';
const getHeaders = (): Record<string, string> => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

interface BillingData {
  mrr: number; arr: number; totalClients: number;
  byPlan: Record<string, { count: number; revenue: number }>;
  setupFeesThisMonth: number; totalRevenueThisMonth: number;
  growth: number;
}

const Billing: React.FC = () => {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/billing`, { headers: getHeaders() })
      .then(r => r.json()).then(setData).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className='min-h-screen bg-gray-950 flex items-center justify-center'>
      <div className='w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
    </div>
  );

  const d = data;
  const plans = Object.entries(d?.byPlan || {});

  return (
    <div className='min-h-screen bg-gray-950 text-white pb-8'>
      <div className='px-4 pt-6 pb-4'>
        <div className='text-xs text-gray-500 uppercase tracking-widest'>Admin</div>
        <h1 className='text-2xl font-bold mt-1'>Facturation</h1>
      </div>

      {/* MRR Hero */}
      <div className='mx-4 mb-4 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl p-5'>
        <div className='text-sm text-amber-400/70 mb-1'>Monthly Recurring Revenue</div>
        <div className='text-4xl font-bold text-amber-400'>{(d?.mrr ?? 0).toFixed(0)}€</div>
        <div className='text-xs text-gray-500 mt-1'>ARR: {(d?.arr ?? (d?.mrr ?? 0) * 12).toFixed(0)}€/an</div>
        {(d?.growth ?? 0) !== 0 && (
          <div className={`text-xs mt-2 font-medium ${(d?.growth ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(d?.growth ?? 0) > 0 ? '▲' : '▼'} {Math.abs(d?.growth ?? 0).toFixed(1)}% ce mois
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className='px-4 grid grid-cols-2 gap-3 mb-4'>
        <div className='bg-gray-900 border border-gray-800 rounded-2xl p-4'>
          <div className='text-xs text-gray-500 mb-1'>Clients actifs</div>
          <div className='text-2xl font-bold text-white'>{d?.totalClients ?? 0}</div>
        </div>
        <div className='bg-gray-900 border border-gray-800 rounded-2xl p-4'>
          <div className='text-xs text-gray-500 mb-1'>Ce mois</div>
          <div className='text-2xl font-bold text-green-400'>{(d?.totalRevenueThisMonth ?? 0).toFixed(0)}€</div>
        </div>
      </div>

      {/* Plans Breakdown */}
      {plans.length > 0 && (
        <div className='px-4'>
          <div className='text-xs text-gray-500 uppercase tracking-widest mb-3'>Répartition par plan</div>
          <div className='space-y-2'>
            {plans.map(([plan, info]) => {
              const pct = d?.mrr ? Math.round((info.revenue / d.mrr) * 100) : 0;
              return (
                <div key={plan} className='bg-gray-900 border border-gray-800 rounded-xl p-4'>
                  <div className='flex items-center justify-between mb-2'>
                    <span className='font-medium text-white capitalize'>{plan}</span>
                    <div className='text-right'>
                      <div className='text-sm font-semibold text-white'>{info.revenue.toFixed(0)}€/mois</div>
                      <div className='text-xs text-gray-500'>{info.count} client{info.count !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div className='h-1.5 bg-gray-800 rounded-full overflow-hidden'>
                    <div className='h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full'
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div className='text-xs text-gray-600 mt-1'>{pct}% du MRR</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {plans.length === 0 && !loading && (
        <div className='text-center py-16 text-gray-600'>
          <div className='text-4xl mb-3'>💳</div>
          <div>Aucune donnée de facturation</div>
        </div>
      )}
    </div>
  );
};

export default Billing;