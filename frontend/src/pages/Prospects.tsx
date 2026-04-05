import { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { Prospect, PaginatedResponse } from '../types';
import {
  Search, ChevronLeft, ChevronRight, Eye, Phone, X,
  SlidersHorizontal, Download, CheckSquare, Square as SquareIcon,
  ArrowUpDown, PhoneCall, StickyNote, CheckCircle,
  SkipForward, Filter, Settings, ChevronDown, ChevronUp,
  Save, RotateCcw, CheckCircle2, AlertCircle, MapPin, Zap,
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

const NICHE_LABELS: Record<string, string> = {
  home_services: 'Home Services', dental: 'Dental', salon: 'Salon',
  restaurant: 'Restaurant', law: 'Law', garage: 'Garage / Auto',
};

interface ProspectConfig {
  apifyActorId: string;
  targetNiches: string[];
  apifyTargetCities: string[];
  prospectionQuotaPerDay: number;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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

  // ── Prospection config section ─────────────────────────
  const [configOpen, setConfigOpen] = useState(false);
  const [lastProspection, setLastProspection] = useState<string | null>(null);
  const [prospectConfig, setProspectConfig] = useState<ProspectConfig>({
    apifyActorId: '', targetNiches: [], apifyTargetCities: [], prospectionQuotaPerDay: 100,
  });
  const [configLoaded, setConfigLoaded] = useState(false);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState('');
  const [prospectSave, setProspectSave] = useState<SaveStatus>('idle');
  const [apifyCityInput, setApifyCityInput] = useState('');

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

  // ── Prospection config helpers ─────────────────────────
  const loadConfig = async () => {
    if (configLoaded) return;
    try {
      const [configRes, statusRes] = await Promise.all([
        api.get('/admin/bot-config'),
        api.get('/bot/status'),
      ]);
      const d = configRes.data;
      setProspectConfig({
        apifyActorId: d.apifyActorId ?? '',
        targetNiches: d.targetNiches ?? [],
        apifyTargetCities: d.apifyTargetCities ?? [],
        prospectionQuotaPerDay: d.prospectionQuotaPerDay ?? 100,
      });
      setLastProspection(statusRes.data?.lastProspection ?? null);
      setConfigLoaded(true);
    } catch (err) {
      console.error('Failed to load prospection config:', err);
    }
  };

  const toggleConfigOpen = () => {
    if (!configOpen) loadConfig();
    setConfigOpen((v) => !v);
  };

  const setPC = (key: keyof ProspectConfig, value: unknown) =>
    setProspectConfig((prev) => ({ ...prev, [key]: value }));

  const toggleNiche = (niche: string) => {
    setPC('targetNiches', prospectConfig.targetNiches.includes(niche)
      ? prospectConfig.targetNiches.filter((n) => n !== niche)
      : [...prospectConfig.targetNiches, niche]);
  };

  const addApifyCity = () => {
    const trimmed = apifyCityInput.trim();
    if (!trimmed || prospectConfig.apifyTargetCities.includes(trimmed)) return;
    setPC('apifyTargetCities', [...prospectConfig.apifyTargetCities, trimmed]);
    setApifyCityInput('');
  };

  const removeApifyCity = (city: string) => {
    setPC('apifyTargetCities', prospectConfig.apifyTargetCities.filter((c) => c !== city));
  };

  const saveProspectConfig = async () => {
    setProspectSave('saving');
    try {
      await api.post('/admin/bot-config', {
        apifyActorId: prospectConfig.apifyActorId,
        targetNiches: prospectConfig.targetNiches,
        apifyTargetCities: prospectConfig.apifyTargetCities,
        prospectionQuotaPerDay: prospectConfig.prospectionQuotaPerDay,
      });
      setProspectSave('saved');
      setTimeout(() => setProspectSave('idle'), 2500);
    } catch {
      setProspectSave('error');
      setTimeout(() => setProspectSave('idle'), 3000);
    }
  };

  const triggerScraping = async () => {
    setScrapeLoading(true);
    setScrapeMessage('');
    try {
      const { data } = await api.post('/prospecting/trigger/scrape');
      setScrapeMessage(data.message || 'Prospection lancée !');
    } catch (err: any) {
      setScrapeMessage(err.response?.data?.error || 'Erreur lors du lancement');
    } finally {
      setScrapeLoading(false);
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

      {/* ── Configuration Prospection ────────────────────── */}
      <div className="card">
        <button
          onClick={toggleConfigOpen}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Settings className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h2 className="text-base font-semibold text-gray-900">Configuration Prospection</h2>
              <p className="text-sm text-gray-400 mt-0.5">Apify, niches, villes cibles, quota</p>
            </div>
            {configLoaded && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                prospectConfig.apifyActorId
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-600'
              }`}>
                {prospectConfig.apifyActorId ? 'Apify connecté' : 'Apify non configuré'}
              </span>
            )}
          </div>
          {configOpen
            ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
            : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
          }
        </button>

        {configOpen && (
          <div className="mt-6 space-y-5">
            {/* Status bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 mb-0.5">Statut Apify</p>
                <p className={`font-medium text-sm ${prospectConfig.apifyActorId ? 'text-emerald-600' : 'text-red-500'}`}>
                  {prospectConfig.apifyActorId ? 'Connecté' : 'Non configuré'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 mb-0.5">Dernière prospection</p>
                <p className="font-medium text-sm text-gray-800">
                  {lastProspection ? new Date(lastProspection).toLocaleString('fr-FR') : 'Jamais'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 mb-0.5">Quota quotidien</p>
                <p className="font-medium text-sm text-gray-800">{prospectConfig.prospectionQuotaPerDay} prospects/jour</p>
              </div>
            </div>

            {/* Launch button */}
            <div className="flex items-center gap-4">
              <button
                onClick={triggerScraping}
                disabled={scrapeLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-violet-500/25 disabled:opacity-60 transition-all"
              >
                {scrapeLoading
                  ? <><RotateCcw className="w-4 h-4 animate-spin" /> Lancement…</>
                  : <><Zap className="w-4 h-4" /> Lancer une prospection maintenant</>
                }
              </button>
              {scrapeMessage && (
                <span className={`text-sm font-medium ${scrapeMessage.startsWith('Erreur') ? 'text-red-600' : 'text-emerald-600'}`}>
                  {scrapeMessage}
                </span>
              )}
            </div>

            {/* Config fields */}
            <div className="border border-gray-100 rounded-xl p-5 bg-white space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Paramètres Apify</h3>
                <button
                  onClick={saveProspectConfig}
                  disabled={prospectSave === 'saving'}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-all"
                >
                  {prospectSave === 'saving' && <><RotateCcw className="w-4 h-4 animate-spin" /> Sauvegarde…</>}
                  {prospectSave === 'saved' && <><CheckCircle2 className="w-4 h-4" /> Sauvegardé !</>}
                  {prospectSave === 'error' && <><AlertCircle className="w-4 h-4" /> Erreur</>}
                  {prospectSave === 'idle' && <><Save className="w-4 h-4" /> Sauvegarder</>}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Apify Actor ID</label>
                  <input
                    type="text"
                    value={prospectConfig.apifyActorId}
                    onChange={(e) => setPC('apifyActorId', e.target.value)}
                    placeholder="apify/google-maps-scraper"
                    className="input font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quota par jour</label>
                  <input
                    type="number" min={1} max={1000}
                    value={prospectConfig.prospectionQuotaPerDay}
                    onChange={(e) => setPC('prospectionQuotaPerDay', +e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Niches cibles</label>
                <div className="flex gap-2 flex-wrap">
                  {NICHES.map((n) => (
                    <button
                      key={n}
                      onClick={() => toggleNiche(n)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border-2 ${
                        prospectConfig.targetNiches.includes(n)
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-gray-200 text-gray-500 hover:border-emerald-300'
                      }`}
                    >
                      {NICHE_LABELS[n]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Villes cibles (Apify)</label>
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={apifyCityInput}
                      onChange={(e) => setApifyCityInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addApifyCity(); } }}
                      placeholder="Ex: Paris, Lyon..."
                      className="input pl-9"
                    />
                  </div>
                  <button onClick={addApifyCity} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                    Ajouter
                  </button>
                </div>
                {prospectConfig.apifyTargetCities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {prospectConfig.apifyTargetCities.map((city) => (
                      <span key={city} className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-sm">
                        {city}
                        <button onClick={() => removeApifyCity(city)} className="hover:text-violet-900 font-bold leading-none">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
