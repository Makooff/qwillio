import { useEffect, useState } from 'react';
import api from '../services/api';
import { Client, PaginatedResponse } from '../types';
import { Building2, Phone, CreditCard, X, ChevronLeft, ChevronRight } from 'lucide-react';

const planColors: Record<string, string> = {
  basic: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-amber-100 text-amber-700',
};

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('active');
  const [planFilter, setPlanFilter] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchClients = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.planType = planFilter;

      const { data } = await api.get<PaginatedResponse<Client>>('/clients', { params });
      setClients(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, [statusFilter, planFilter]);

  const openDetail = async (id: string) => {
    const { data } = await api.get(`/clients/${id}`);
    setSelected(data);
  };

  const totalMRR = clients.reduce((sum, c) => sum + Number(c.monthlyFee), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500">{pagination.total} clients · MRR: {totalMRR.toLocaleString('fr-FR')}€</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex gap-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="">Tous les status</option>
          <option value="active">Actifs</option>
          <option value="past_due">En retard</option>
          <option value="canceled">Annulés</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="input w-auto">
          <option value="">Tous les plans</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Client Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-gray-500">Chargement...</div>
        ) : clients.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-gray-500">Aucun client trouvé</div>
        ) : clients.map((client) => (
          <div key={client.id} className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(client.id)}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-primary-100 to-purple-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{client.businessName}</h3>
                  <p className="text-xs text-gray-500 capitalize">{client.businessType} · {client.city || ''}</p>
                </div>
              </div>
              <span className={`badge ${planColors[client.planType] || 'bg-gray-100 text-gray-700'}`}>
                {client.planType.toUpperCase()}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">MRR</span>
                <span className="font-semibold text-emerald-600">{Number(client.monthlyFee).toLocaleString('fr-FR')}€/mois</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`badge ${client.subscriptionStatus === 'active' ? 'badge-active' : 'badge-lost'}`}>
                  {client.subscriptionStatus === 'active' ? 'Actif' : client.subscriptionStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Appels totaux</span>
                <span className="font-medium">{client.totalCallsMade}</span>
              </div>
              {client.vapiPhoneNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Tél IA</span>
                  <span className="font-mono text-xs">{client.vapiPhoneNumber}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Onboarding: {client.onboardingStatus === 'completed' ? '✅' : client.onboardingStatus === 'failed' ? '❌' : '⏳'}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(client.createdAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => fetchClients(pagination.page - 1)} disabled={pagination.page <= 1} className="btn-secondary text-sm disabled:opacity-50">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-gray-500">Page {pagination.page} / {pagination.totalPages || 1}</span>
        <button onClick={() => fetchClients(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="btn-secondary text-sm disabled:opacity-50">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{selected.businessName}</h2>
                <p className="text-gray-500">{selected.planType.toUpperCase()} · {Number(selected.monthlyFee)}€/mois</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Contact:</span> <span className="font-medium">{selected.contactName}</span></div>
                <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selected.contactEmail}</span></div>
                <div><span className="text-gray-500">Téléphone:</span> <span className="font-medium">{selected.contactPhone || '-'}</span></div>
                <div><span className="text-gray-500">Tél IA:</span> <span className="font-mono font-medium">{selected.vapiPhoneNumber || '-'}</span></div>
                <div><span className="text-gray-500">Setup fee:</span> <span className="font-medium">{Number(selected.setupFee)}€</span></div>
                <div><span className="text-gray-500">Appels totaux:</span> <span className="font-medium">{selected.totalCallsMade}</span></div>
              </div>

              {selected.payments && selected.payments.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Historique Paiements</h4>
                  <div className="space-y-2">
                    {selected.payments.map((p: any) => (
                      <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">{Number(p.amount)}€</span>
                          <span className="text-gray-500 ml-2">{p.paymentType === 'setup_fee' ? 'Setup' : 'Abonnement'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge ${p.status === 'succeeded' ? 'badge-active' : 'badge-lost'}`}>
                            {p.status === 'succeeded' ? '✅' : '❌'}
                          </span>
                          <span className="text-gray-400 text-xs">{p.paidAt ? new Date(p.paidAt).toLocaleDateString('fr-FR') : '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

