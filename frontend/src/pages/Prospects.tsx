import { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { Prospect, PaginatedResponse } from '../types';
import {
  Search, ChevronLeft, ChevronRight, Eye, Phone, X,
  SlidersHorizontal, Download, CheckSquare, Square as SquareIcon,
  ArrowUpDown, PhoneCall, StickyNote, CheckCircle,
  SkipForward, Filter,
} from 'lucide-react';

const statusLabels: Record<string, string> = {
  new: 'Nouveau', contacted: 'Contacté', interested: 'Intéressé',
  qualified: 'Qualifié', converted: 'Converti', lost: 'Perdu',
};
const statusClasses: Record<string, string> = {
  new: 'badge-new', contacted: 'badge-contacted', interested: 'badge-interested',
  qualified: 'badge-qualified', converted: 'badge-converted', lost: 'badge-lost',
};
const NICHES = ['home_services', 'dental', 'salon', 'restaurant', 'law', 'garage'];

export default function Prospects() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [nicheFilter, setNicheFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sortBy, setSortBy] = useState<'priorityScore' | 'score' | 'createdAt' | 'lastCallDate'>('priorityScore');
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState('');
  const [noteModal, setNoteModal] = useState<{ id: string; name: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [callLoading, setCallLoading] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const fetchProspects = async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20, sortBy, sortOrder: 'desc' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (nicheFilter) params.niche = nicheFilter;
      if (cityFilter) params.city = cityFilter;

      const { data } = await api.get<PaginatedResponse<Prospect>>('/prospects', { params });
      setProspects(data.data);
      setPagination(data.pagination);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to fetch prospects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProspects(); }, [search, statusFilter, nicheFilter, cityFilter, sortBy]);

  const openDetail = async (id: string) => {
    const { data } = await api.get(`/prospects/${id}`);
    setSelected(data);
  };

  // Selection helpers
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === prospects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prospects.map((p) => p.id)));
    }
  };

  // Bulk actions
  const bulkUpdate = async (action: 'called' | 'skip') => {
    if (selectedIds.size === 0) return;
    setBulkLoading(action);
    try {
      const status = action === 'called' ? 'contacted' : 'lost';
      await Promise.all(
        [...selectedIds].map((id) => api.put(`/prospects/${id}`, { status }))
      );
      await fetchProspects(pagination.page);
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setBulkLoading('');
    }
  };

  const exportCSV = () => {
    const ids = selectedIds.size > 0 ? [...selectedIds] : prospects.map((p) => p.id);
    const rows = prospects.filter((p) => ids.includes(p.id));
    const header = ['Nom', 'Type', 'Ville', 'Téléphone', 'Email', 'Score', 'Status', 'Intérêt', 'Niche'];
    const lines = rows.map((p) => [
      p.businessName, p.businessType, p.city || '', p.phone || '', p.email || '',
      p.score, statusLabels[p.status] || p.status, p.interestLevel ?? '', (p as any).niche || '',
    ].map((v) => `"${v}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospects_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Call now
  const callNow = async (prospectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCallLoading(prospectId);
    try {
      await api.post('/bot/trigger/call', { prospectId });
    } catch (error) {
      console.error('Call trigger failed:', error);
    } finally {
      setCallLoading(null);
    }
  };

  // Add note
  const openNote = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteModal({ id, name });
    setNoteText('');
    setTimeout(() => noteRef.current?.focus(), 100);
  };

  const saveNote = async () => {
    if (!noteModal) return;
    try {
      await api.put(`/prospects/${noteModal.id}`, { notes: noteText });
      setNoteModal(null);
    } catch (error) {
      console.error('Note save failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-500">{pagination.total} prospects au total</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 btn-secondary text-sm">
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="w-4 h-4" />
          Filtres et tri
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Search */}
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
          {/* Status */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
            <option value="">Tous les status</option>
            {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {/* Niche */}
          <select value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)} className="input w-auto">
            <option value="">Toutes les niches</option>
            {NICHES.map((n) => <option key={n} value={n}>{n.replace('_', ' ')}</option>)}
          </select>
          {/* City */}
          <input
            type="text"
            placeholder="Ville..."
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="input w-36"
          />
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="input w-auto"
          >
            <option value="priorityScore">Score priorité ↓</option>
            <option value="score">Score ↓</option>
            <option value="createdAt">Date ajout ↓</option>
            <option value="lastCallDate">Dernier appel ↓</option>
          </select>
        </div>

        {/* Score range */}
        <div className="flex items-center gap-4 text-sm">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600 w-24">Score:</span>
          <input type="number" min={0} max={100} value={minScore}
            onChange={(e) => setMinScore(+e.target.value)}
            className="input w-20 py-1 text-sm" />
          <span className="text-gray-400">–</span>
          <input type="number" min={0} max={100} value={maxScore}
            onChange={(e) => setMaxScore(+e.target.value)}
            className="input w-20 py-1 text-sm" />
        </div>
      </div>

      {/* ── Bulk actions bar ─────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-purple-700">{selectedIds.size} sélectionné(s)</span>
          <button
            onClick={() => bulkUpdate('called')}
            disabled={bulkLoading === 'called'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-60"
          >
            <CheckCircle className="w-4 h-4" />
            {bulkLoading === 'called' ? 'En cours…' : 'Marquer contacté'}
          </button>
          <button
            onClick={() => bulkUpdate('skip')}
            disabled={bulkLoading === 'skip'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 disabled:opacity-60"
          >
            <SkipForward className="w-4 h-4" />
            {bulkLoading === 'skip' ? 'En cours…' : 'Ignorer'}
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
            <Download className="w-4 h-4" /> Exporter
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-purple-600 text-sm hover:underline">
            Désélectionner
          </button>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────── */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3">
                <button onClick={toggleSelectAll}>
                  {selectedIds.size === prospects.length && prospects.length > 0
                    ? <CheckSquare className="w-4 h-4 text-purple-600" />
                    : <SquareIcon className="w-4 h-4 text-gray-400" />
                  }
                </button>
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Commerce</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Niche / Type</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ville</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                <button onClick={() => setSortBy('score')} className="flex items-center gap-1 mx-auto hover:text-gray-800">
                  Score <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Intérêt</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-500">Chargement...</td></tr>
            ) : prospects.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-500">Aucun prospect trouvé</td></tr>
            ) : prospects
                .filter((p) => p.score >= minScore && p.score <= maxScore)
                .map((p) => (
              <tr
                key={p.id}
                className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(p.id) ? 'bg-purple-50' : ''}`}
                onClick={() => openDetail(p.id)}
              >
                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                  <button onClick={(e) => toggleSelect(p.id, e)}>
                    {selectedIds.has(p.id)
                      ? <CheckSquare className="w-4 h-4 text-purple-600" />
                      : <SquareIcon className="w-4 h-4 text-gray-300 hover:text-gray-500" />
                    }
                  </button>
                </td>
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{p.businessName}</p>
                  <p className="text-xs text-gray-500">{p.email || p.phone || ''}</p>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                  {(p as any).niche ? (
                    <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">{(p as any).niche.replace('_', ' ')}</span>
                  ) : (
                    p.businessType
                  )}
                </td>
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
                  <div className="flex items-center justify-end gap-1">
                    <button
                      title="Appeler maintenant"
                      onClick={(e) => callNow(p.id, e)}
                      disabled={callLoading === p.id}
                      className="p-1.5 rounded-lg hover:bg-emerald-100 text-gray-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                    >
                      <PhoneCall className="w-4 h-4" />
                    </button>
                    <button
                      title="Ajouter une note"
                      onClick={(e) => openNote(p.id, p.businessName, e)}
                      className="p-1.5 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <StickyNote className="w-4 h-4" />
                    </button>
                    <button
                      title="Voir les détails"
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      onClick={(e) => { e.stopPropagation(); openDetail(p.id); }}
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
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

      {/* ── Add Note Modal ───────────────────────────────── */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setNoteModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Note — {noteModal.name}</h2>
              <button onClick={() => setNoteModal(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                ref={noteRef}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Ajouter une note..."
                rows={4}
                className="input resize-none"
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => setNoteModal(null)} className="btn-secondary text-sm">Annuler</button>
                <button onClick={saveNote} className="btn-primary text-sm">Sauvegarder</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────── */}
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
                    {selected.painPoints.map((point, i) => (
                      <span key={i} className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs">{point}</span>
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

              <div className="flex gap-3 pt-2">
                <button
                  onClick={(e) => { setSelected(null); callNow(selected.id, e); }}
                  className="flex items-center gap-2 btn-success text-sm"
                >
                  <Phone className="w-4 h-4" /> Appeler maintenant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
