import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { RefreshCw, Brain, Search, Info } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import SlideSheet from '../../components/ui/SlideSheet';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import { TableRowSkeleton } from '../../components/ui/Skeleton';

export default function AiDecisions() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const { toasts, add: toast, remove } = useToast();
  const LIMIT = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), ...(search && { search }) });
      const { data: res } = await api.get(`/ai/decisions?${params}`);
      setData(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
      setTotal(res.pagination?.total ?? (Array.isArray(res) ? res.length : 0));
    } catch { toast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">IA — Décisions</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">Journal des décisions automatiques</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8BA7]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher décisions..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50" />
      </div>

      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Type','Niche','Action','Résultat','Confiance','Date',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                : data.length === 0
                  ? <tr><td colSpan={7}><EmptyState icon={<Brain className="w-7 h-7" />} title="Aucune décision IA" /></td></tr>
                  : data.map((d: any) => (
                    <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] group">
                      <td className="px-4 py-3.5"><Badge label={d.type ?? 'decision'} variant="purple" size="xs" /></td>
                      <td className="px-4 py-3.5"><span className="text-xs text-[#F8F8FF]">{d.niche ?? '—'}</span></td>
                      <td className="px-4 py-3.5"><span className="text-xs text-[#8B8BA7] truncate max-w-[120px] block">{d.action ?? '—'}</span></td>
                      <td className="px-4 py-3.5">
                        <Badge label={d.outcome ?? d.result ?? 'processed'} dot size="xs" />
                      </td>
                      <td className="px-4 py-3.5">
                        {d.confidence != null && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <div className="h-full bg-[#7B5CF0] rounded-full" style={{ width: `${d.confidence * 100}%` }} />
                            </div>
                            <span className="text-xs text-[#8B8BA7]">{(d.confidence * 100).toFixed(0)}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5"><span className="text-xs text-[#8B8BA7]">{new Date(d.createdAt).toLocaleString('fr-FR')}</span></td>
                      <td className="px-4 py-3.5">
                        <button onClick={() => setSelected(d)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[#8B8BA7] hover:text-white transition-all opacity-0 group-hover:opacity-100">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4"><Pagination page={page} total={total} limit={LIMIT} onChange={setPage} /></div>
      </div>

      <SlideSheet open={!!selected} onClose={() => setSelected(null)}
        title="Détail décision IA"
        subtitle={selected ? new Date(selected.createdAt).toLocaleString('fr-FR') : ''}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0D0D15] rounded-xl p-3 text-center">
                <Badge label={selected.type ?? 'decision'} variant="purple" />
                <p className="text-[10px] text-[#8B8BA7] mt-1.5">Type</p>
              </div>
              <div className="bg-[#0D0D15] rounded-xl p-3 text-center">
                {selected.confidence != null
                  ? <p className="text-xl font-bold text-[#7B5CF0]">{(selected.confidence * 100).toFixed(0)}%</p>
                  : <p className="text-xl font-bold text-[#8B8BA7]">—</p>}
                <p className="text-[10px] text-[#8B8BA7] mt-1.5">Confiance</p>
              </div>
            </div>
            {selected.niche && <div className="flex justify-between text-xs p-3 bg-[#0D0D15] rounded-xl"><span className="text-[#8B8BA7]">Niche</span><span className="text-[#F8F8FF]">{selected.niche}</span></div>}
            {selected.action && (
              <div>
                <p className="text-xs text-[#8B8BA7] mb-2">Action</p>
                <p className="text-xs text-[#F8F8FF] bg-[#0D0D15] rounded-xl p-3">{selected.action}</p>
              </div>
            )}
            {selected.reasoning && (
              <div>
                <p className="text-xs text-[#8B8BA7] mb-2">Raisonnement</p>
                <p className="text-xs text-[#F8F8FF] bg-[#0D0D15] rounded-xl p-3 leading-relaxed">{selected.reasoning}</p>
              </div>
            )}
            {selected.data && (
              <div>
                <p className="text-xs text-[#8B8BA7] mb-2">Données</p>
                <pre className="text-[10px] text-[#F8F8FF] bg-[#0D0D15] rounded-xl p-3 overflow-x-auto leading-relaxed">{JSON.stringify(selected.data, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
