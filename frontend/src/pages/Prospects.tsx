import { useEffect, useState } from 'react';
import api from '../services/api';
import { Prospect, PaginatedResponse } from '../types';
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Phone, Mail, X } from 'lucide-react';

const statusLabels: Record<string, string> = {
  new: 'Nouveau', contacted: 'Contacté', interested: 'Intéressé',
  qualified: 'Qualifié', converted: 'Converti', lost: 'Perdu',
};

const statusClasses: Record<string, string> = {
  new: 'badge-new', contacted: 'badge-contacted', interested: 'badge-interested',
  qualified: 'badge-qualified', converted: 'badge-converted', lost: 'badge-lost',
};

export default function Prospects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProspects = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20, sortBy: 'score', sortOrder: 'desc' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.businessType = typeFilter;

      const { data } = await api.get<PaginatedResponse<Prospect>>('/prospects', { params });
      setProspects(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch prospects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProspects(); }, [search, statusFilter, typeFilter]);

  const openDetail = async (id: string) => {
    const { data } = await api.get(`/prospects/${id}`);
    setSelected(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-500">{pagination.total} prospects au total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
            <option value="">Tous les status</option>
            {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input w-auto">
            <option value="">Tous les types</option>
            <option value="restaurant">Restaurant</option>
            <option value="hotel">Hôtel</option>
            <option value="salon">Salon</option>
            <option value="service">Service</option>
            <option value="medical">Médical</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Commerce</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ville</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Score</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Intérêt</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">Chargement...</td></tr>
            ) : prospects.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">Aucun prospect trouvé</td></tr>
            ) : prospects.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(p.id)}>
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{p.businessName}</p>
                  <p className="text-xs text-gray-500">{p.email || p.phone || ''}</p>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 capitalize">{p.businessType}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{p.city || '-'}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${
                    p.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                    p.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                  }`}>{p.score}</span>
                </td>
                <td className="px-6 py-4 text-center text-sm">
                  {p.interestLevel !== undefined && p.interestLevel !== null ? `${p.interestLevel}/10` : '-'}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`badge ${statusClasses[p.status] || 'badge-new'}`}>{statusLabels[p.status] || p.status}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1.5 rounded-lg hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); openDetail(p.id); }}>
                    <Eye className="w-4 h-4 text-gray-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
          <p className="text-sm text-gray-500">
            {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} sur {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => fetchProspects(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchProspects(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{selected.businessName}</h2>
                <p className="text-gray-500 capitalize">{selected.businessType} · {selected.city}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-primary-600">{selected.score}</p>
                  <p className="text-xs text-gray-500">Score</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold">{selected.interestLevel ?? '-'}</p>
                  <p className="text-xs text-gray-500">Intérêt /10</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <span className={`badge ${statusClasses[selected.status]}`}>{statusLabels[selected.status]}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Téléphone:</span> <span className="font-medium">{selected.phone || '-'}</span></div>
                <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selected.email || '-'}</span></div>
                <div><span className="text-gray-500">Contact:</span> <span className="font-medium">{selected.contactName || '-'}</span></div>
                <div><span className="text-gray-500">Google Rating:</span> <span className="font-medium">{selected.googleRating ? `${selected.googleRating}/5 (${selected.googleReviewsCount} avis)` : '-'}</span></div>
              </div>

              {selected.painPoints && selected.painPoints.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Besoins identifiés</h4>
                  <div className="flex flex-wrap gap-2">
                    {selected.painPoints.map((p, i) => (
                      <span key={i} className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {selected.callTranscript && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Dernier Transcript</h4>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {selected.callTranscript}
                  </div>
                </div>
              )}

              {selected.nextAction && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700"><strong>Prochaine action:</strong> {selected.nextAction}</p>
                  {selected.nextActionDate && <p className="text-xs text-blue-500 mt-1">Prévu: {new Date(selected.nextActionDate).toLocaleDateString('fr-FR')}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

