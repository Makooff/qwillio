import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Prospect } from '../types';
import {
  Search, Phone, Trash2, Eye, RefreshCw, Star, MapPin, Building2,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import SlideSheet from '../components/ui/SlideSheet';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';

type SortKey = 'score' | 'businessName' | 'createdAt' | 'interestLevel';
type SortDir = 'asc' | 'desc';
const STATUS_OPTIONS = ['new','qualified','interested','converted','not_interested','do_not_call','voicemail','no_answer','callback'];
const SORT_LABELS: Record<SortKey, string> = { score:'Score', businessName:'Nom', createdAt:'Date', interestLevel:'Intérêt' };

export default function Prospects() {
  const [data, setData] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [toDelete, setToDelete] = useState<Prospect | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [calling, setCalling] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: String(LIMIT),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        sort: sortKey, dir: sortDir,
      });
      const { data: res } = await api.get(`/prospects/?${params}`);
      setData(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
      setTotal(res.pagination?.total ?? (Array.isArray(res) ? res.length : 0));
    } catch { toast('Erreur de chargement', 'error'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, sortKey, sortDir]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const triggerCall = async (p: Prospect) => {
    setCalling(p.id);
    try {
      await api.post(`/prospects/${p.id}/call`);
      toast(`Appel déclenché — ${p.businessName}`, 'success');
    } catch { toast('Erreur déclenchement appel', 'error'); }
    finally { setCalling(null); }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/prospects/${toDelete.id}`);
      toast(`${toDelete.businessName} supprimé`, 'success');
      setToDelete(null);
      load();
    } catch { toast('Erreur suppression', 'error'); }
    finally { setDeleting(false); }
  };

  const SortBtn = ({ k }: { k: SortKey }) => (
    <button onClick={() => handleSort(k)}
      className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium transition-all
        ${sortKey === k ? 'bg-[#7B5CF0]/10 text-[#7B5CF0] border border-[#7B5CF0]/20' : 'bg-[#12121A] border border-white/[0.06] text-[#8B8BA7] hover:text-white'}`}>
      {SORT_LABELS[k]}
      {sortKey === k && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  );

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Prospects</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">{total} au total</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8BA7]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher nom, ville, secteur..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50">
          <option value="">Tous statuts</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1">
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => <SortBtn key={k} k={k} />)}
        </div>
      </div>

      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Entreprise','Contact','Statut','Score','Secteur','Créé le',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                : data.length === 0
                  ? <tr><td colSpan={7}><EmptyState icon={<Building2 className="w-7 h-7" />} title="Aucun prospect" description="Les prospects apparaîtront ici une fois le bot démarré." /></td></tr>
                  : data.map(p => (
                    <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#7B5CF0]/10 flex items-center justify-center text-[#7B5CF0] text-xs font-bold flex-shrink-0">
                            {(p.businessName ?? 'X')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-[#F8F8FF] text-xs truncate max-w-[150px]">{p.businessName}</p>
                            {p.city && <p className="text-[10px] text-[#8B8BA7] flex items-center gap-0.5 mt-0.5"><MapPin className="w-2.5 h-2.5" />{p.city}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs text-[#F8F8FF]">{p.contactName ?? '—'}</p>
                        {p.phone && <p className="text-[10px] text-[#8B8BA7]">{p.phone}</p>}
                      </td>
                      <td className="px-4 py-3.5"><Badge label={p.status} dot size="xs" /></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-[#F59E0B]" />
                          <span className="text-xs font-semibold text-[#F8F8FF]">{p.score}</span>
                          {p.interestLevel !== undefined && <span className="text-[10px] text-[#8B8BA7]">({p.interestLevel}/10)</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><span className="text-xs text-[#8B8BA7]">{p.businessType ?? p.sector ?? '—'}</span></td>
                      <td className="px-4 py-3.5"><span className="text-xs text-[#8B8BA7]">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</span></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setSelected(p)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[#8B8BA7] hover:text-white transition-all"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => triggerCall(p)} disabled={calling === p.id} className="p-1.5 rounded-lg hover:bg-[#22C55E]/10 text-[#8B8BA7] hover:text-[#22C55E] transition-all disabled:opacity-40"><Phone className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setToDelete(p)} className="p-1.5 rounded-lg hover:bg-[#EF4444]/10 text-[#8B8BA7] hover:text-[#EF4444] transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4"><Pagination page={page} total={total} limit={LIMIT} onChange={setPage} /></div>
      </div>

      <SlideSheet open={!!selected} onClose={() => setSelected(null)}
        title={selected?.businessName ?? 'Prospect'}
        subtitle={[selected?.city, selected?.businessType].filter(Boolean).join(' · ')}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0D0D15] rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-[#7B5CF0]">{selected.score}</p>
                <p className="text-[10px] text-[#8B8BA7] mt-1 uppercase tracking-wide">Score</p>
              </div>
              <div className="bg-[#0D0D15] rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-[#F8F8FF]">{selected.interestLevel ?? '—'}{selected.interestLevel ? '/10' : ''}</p>
                <p className="text-[10px] text-[#8B8BA7] mt-1 uppercase tracking-wide">Intérêt</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0D0D15] rounded-xl">
              <span className="text-sm text-[#8B8BA7]">Statut</span>
              <Badge label={selected.status} dot />
            </div>
            <div className="space-y-2">
              {[
                { l: 'Contact', v: selected.contactName },
                { l: 'Téléphone', v: selected.phone },
                { l: 'Email', v: selected.email },
                { l: 'Ville', v: selected.city },
                { l: 'Secteur', v: selected.businessType ?? selected.sector },
                { l: 'Rating Google', v: selected.googleRating ? `${selected.googleRating}★ (${selected.googleReviewsCount} avis)` : null },
                { l: 'Prochaine action', v: selected.nextAction },
              ].filter(x => x.v).map(({ l, v }) => (
                <div key={l} className="flex items-start justify-between gap-3 text-xs">
                  <span className="text-[#8B8BA7]">{l}</span>
                  <span className="text-[#F8F8FF] text-right">{v}</span>
                </div>
              ))}
            </div>
            {selected.painPoints?.length > 0 && (
              <div>
                <p className="text-xs text-[#8B8BA7] mb-2">Points douloureux</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.painPoints.map((pp: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444] text-[10px] border border-[#EF4444]/20">{pp}</span>
                  ))}
                </div>
              </div>
            )}
            {selected.callTranscript && (
              <div>
                <p className="text-xs text-[#8B8BA7] mb-2">Transcription</p>
                <p className="text-xs text-[#F8F8FF] bg-[#0D0D15] rounded-xl p-3 leading-relaxed max-h-48 overflow-y-auto">{selected.callTranscript}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => triggerCall(selected)} disabled={calling === selected.id}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 hover:bg-[#22C55E]/20 text-sm font-medium transition-all disabled:opacity-50">
                <Phone className="w-4 h-4" />{calling === selected.id ? 'En cours...' : 'Appeler'}
              </button>
              <button onClick={() => { setToDelete(selected); setSelected(null); }}
                className="px-3 py-2.5 rounded-xl bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 hover:bg-[#EF4444]/20 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </SlideSheet>

      <ConfirmDialog open={!!toDelete} title="Supprimer le prospect"
        message={`Supprimer "${toDelete?.businessName}" ? Action irréversible.`}
        confirmLabel="Supprimer" loading={deleting}
        onConfirm={doDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
