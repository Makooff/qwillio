import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Users, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import StatusBadge from '../components/dashboard/StatusBadge';
import SlideSheet from '../components/dashboard/SlideSheet';
import SkeletonLoader from '../components/dashboard/SkeletonLoader';
import EmptyState from '../components/dashboard/EmptyState';
import { format } from 'date-fns';

const PAGE_SIZE = 25;
const PLAN_COLORS: Record<string, string> = {
  starter: 'text-[#8B8BA7]', pro: 'text-[#7B5CF0]', enterprise: 'text-[#6EE7B7]',
};

function Avatar({ name }: { name: string }) {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';
  return (
    <div className="w-8 h-8 rounded-full bg-[#7B5CF0]/20 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-[#7B5CF0]">{initials}</span>
    </div>
  );
}

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ search: '', plan: '', status: '', sort: 'newest' });
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: PAGE_SIZE };
      if (filters.plan) params.plan = filters.plan;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      params.sort = filters.sort;
      const { data } = await api.get('/clients', { params });
      setClients(Array.isArray(data?.clients) ? data.clients : Array.isArray(data) ? data : []);
      setTotal(data?.total ?? 0);
    } catch { setClients([]); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useEffect(() => {
    const h = () => fetchClients();
    window.addEventListener('admin-refresh', h);
    return () => window.removeEventListener('admin-refresh', h);
  }, [fetchClients]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const handleAction = async (clientId: string, action: 'pause' | 'resume' | 'cancel') => {
    setActioning(clientId);
    try {
      if (action === 'pause') await api.post(`/clients/${clientId}/pause`);
      else if (action === 'resume') await api.post(`/clients/${clientId}/resume`);
      else if (action === 'cancel') await api.post(`/clients/${clientId}/cancel`);
      fetchClients();
      if (selected?.id === clientId) setSelected(null);
    } catch { /* silent */ }
    finally { setActioning(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Clients</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">{total.toLocaleString()} total</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-sm text-[#8B8BA7] hover:text-[#F8F8FF] bg-[#12121A] border border-white/[0.06] rounded-xl hover:border-[#7B5CF0]/30 transition-all">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name / email..."
          value={filters.search}
          onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
          className="px-3 py-2 text-sm bg-[#12121A] border border-white/[0.08] rounded-xl text-[#F8F8FF] placeholder-[#8B8BA7] outline-none focus:border-[#7B5CF0]/50 transition-colors w-52"
        />
        <select value={filters.plan} onChange={e => { setFilters(f => ({ ...f, plan: e.target.value })); setPage(1); }}
          className="px-3 py-2 text-sm bg-[#12121A] border border-white/[0.08] rounded-xl text-[#F8F8FF] outline-none focus:border-[#7B5CF0]/50">
          <option value="">All plans</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}
          className="px-3 py-2 text-sm bg-[#12121A] border border-white/[0.08] rounded-xl text-[#F8F8FF] outline-none focus:border-[#7B5CF0]/50">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filters.sort} onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
          className="px-3 py-2 text-sm bg-[#12121A] border border-white/[0.08] rounded-xl text-[#F8F8FF] outline-none focus:border-[#7B5CF0]/50">
          <option value="newest">Newest</option>
          <option value="mrr">MRR ↓</option>
          <option value="calls">Calls ↓</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Client', 'Plan', 'MRR', 'Calls / Mo', 'Status', 'Next Billing', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold tracking-[0.08em] uppercase text-[#8B8BA7]">{h}</th>
                ))}
              </tr>
            </thead>
            {loading ? (
              <SkeletonLoader rows={10} cols={7} />
            ) : clients.length === 0 ? (
              <tbody><tr><td colSpan={7}>
                <EmptyState icon={<Users className="w-6 h-6" />} title="No clients yet" description="Clients will appear here after they sign up and onboard." />
              </td></tr></tbody>
            ) : (
              <tbody>
                {clients.map((client: any, i: number) => {
                  const callsPct = client.monthlyCallsQuota
                    ? Math.min(100, Math.round((client.callsThisMonth ?? 0) / client.monthlyCallsQuota * 100))
                    : 0;
                  const trialDays = client.trialEndDate
                    ? Math.max(0, Math.ceil((new Date(client.trialEndDate).getTime() - Date.now()) / 86400000))
                    : null;
                  return (
                    <tr key={client.id ?? i} onClick={() => setSelected(client)}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors group">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={client.businessName ?? client.contactName ?? '?'} />
                          <div>
                            <p className="text-sm font-medium text-[#F8F8FF]">{client.businessName ?? '—'}</p>
                            <p className="text-xs text-[#8B8BA7]">{client.contactEmail ?? ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold capitalize ${PLAN_COLORS[client.planType ?? 'starter']}`}>
                          {client.planType ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-medium text-[#22C55E] tabular-nums">
                        ${(client.monthlyFee ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs text-[#F8F8FF] tabular-nums">{client.callsThisMonth ?? 0}/{client.monthlyCallsQuota ?? '?'}</p>
                        <div className="w-16 h-1 bg-white/[0.06] rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-[#7B5CF0] rounded-full" style={{ width: `${callsPct}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={client.isTrial ? 'trial' : (client.subscriptionStatus ?? client.status ?? 'active')} size="sm" />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#8B8BA7]">
                        {client.isTrial && trialDays !== null
                          ? <span className={trialDays < 7 ? 'text-[#EF4444]' : ''}>{trialDays}d trial left</span>
                          : client.nextBillingDate ? format(new Date(client.nextBillingDate), 'MMM d') : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          {client.subscriptionStatus !== 'paused' ? (
                            <button onClick={() => handleAction(client.id, 'pause')} disabled={actioning === client.id}
                              className="px-2 py-1 text-[10px] font-medium text-[#F59E0B] border border-[#F59E0B]/30 rounded-lg hover:bg-[#F59E0B]/10 transition-all">
                              Pause
                            </button>
                          ) : (
                            <button onClick={() => handleAction(client.id, 'resume')} disabled={actioning === client.id}
                              className="px-2 py-1 text-[10px] font-medium text-[#22C55E] border border-[#22C55E]/30 rounded-lg hover:bg-[#22C55E]/10 transition-all">
                              Resume
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-xs text-[#8B8BA7]">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.06] disabled:opacity-30 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${p === page ? 'bg-[#7B5CF0] text-white' : 'text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.06]'}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.06] disabled:opacity-30 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Client detail sheet */}
      <SlideSheet open={!!selected} onClose={() => setSelected(null)}
        title={selected?.businessName ?? 'Client'} subtitle={selected?.contactEmail}>
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar name={selected.businessName ?? ''} />
              <StatusBadge status={selected.isTrial ? 'trial' : (selected.subscriptionStatus ?? 'active')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Plan', value: selected.planType ?? '—' },
                { label: 'MRR', value: `$${(selected.monthlyFee ?? 0).toLocaleString()}` },
                { label: 'Contact', value: selected.contactName ?? '—' },
                { label: 'Phone', value: selected.contactPhone ?? '—' },
                { label: 'Industry', value: selected.businessType ?? '—' },
                { label: 'Country', value: selected.country ?? '—' },
              ].map(f => (
                <div key={f.label} className="bg-[#0D0D15] rounded-xl p-3">
                  <p className="text-[10px] text-[#8B8BA7] uppercase tracking-wide mb-1">{f.label}</p>
                  <p className="text-sm text-[#F8F8FF] font-medium">{f.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              {selected.subscriptionStatus !== 'paused' ? (
                <button onClick={() => handleAction(selected.id, 'pause')} disabled={actioning === selected.id}
                  className="w-full px-4 py-2.5 text-sm font-medium text-[#F59E0B] border border-[#F59E0B]/30 rounded-xl hover:bg-[#F59E0B]/10 transition-all">
                  Pause subscription
                </button>
              ) : (
                <button onClick={() => handleAction(selected.id, 'resume')} disabled={actioning === selected.id}
                  className="w-full px-4 py-2.5 text-sm font-medium text-[#22C55E] border border-[#22C55E]/30 rounded-xl hover:bg-[#22C55E]/10 transition-all">
                  Resume subscription
                </button>
              )}
              <button onClick={() => handleAction(selected.id, 'cancel')} disabled={actioning === selected.id}
                className="w-full px-4 py-2.5 text-sm font-medium text-[#EF4444] border border-[#EF4444]/20 rounded-xl hover:bg-[#EF4444]/10 transition-all">
                Cancel subscription
              </button>
            </div>
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
