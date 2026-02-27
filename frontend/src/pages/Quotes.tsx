import { useEffect, useState } from 'react';
import api from '../services/api';
import { Quote, PaginatedResponse } from '../types';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const statusLabels: Record<string, string> = {
  draft: 'Brouillon', sent: 'Envoyé', viewed: 'Vu', accepted: 'Accepté', expired: 'Expiré', rejected: 'Refusé',
};

const statusClasses: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  const fetchQuotes = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedResponse<Quote>>('/quotes', { params: { page, limit: 20 } });
      setQuotes(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuotes(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Devis</h1>
        <p className="text-gray-500">{pagination.total} devis au total</p>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Commerce</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Package</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Setup</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Mensuel</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">Chargement...</td></tr>
            ) : quotes.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">Aucun devis</td></tr>
            ) : quotes.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{q.prospect?.businessName || 'N/A'}</p>
                  <p className="text-xs text-gray-500">{q.prospect?.email || ''}</p>
                </td>
                <td className="px-6 py-4 text-sm font-semibold uppercase">{q.packageType}</td>
                <td className="px-6 py-4 text-sm text-right">{Number(q.setupFee)}€</td>
                <td className="px-6 py-4 text-sm text-right font-semibold">{Number(q.monthlyFee)}€/mois</td>
                <td className="px-6 py-4 text-center">
                  <span className={`badge ${statusClasses[q.status] || ''}`}>{statusLabels[q.status] || q.status}</span>
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-500">{new Date(q.createdAt).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
          <p className="text-sm text-gray-500">Page {pagination.page} / {pagination.totalPages || 1}</p>
          <div className="flex gap-2">
            <button onClick={() => fetchQuotes(pagination.page - 1)} disabled={pagination.page <= 1} className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => fetchQuotes(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

