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
import { t, glass, inputStyle } from '../../styles/admin-theme';

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
          <h1 className="text-xl font-bold" style={{ color: t.text }}>IA — Décisions</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>Journal des décisions automatiques</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: t.textSec }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher décisions..."
          style={inputStyle}
          className="w-full pl-9 pr-4 py-2.5 placeholder-[#48484A] focus:outline-none focus:border-white/[0.18]" />
      </div>

      <div className="overflow-hidden" style={glass}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Type</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Niche</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Action</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Résult.</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Confiance</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Date</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
              : data.length === 0
                ? <tr><td colSpan={7}><EmptyState icon={<Brain className="w-7 h-7" />} title="Aucune décision IA" /></td></tr>
                : data.map((d: any) => (
                  <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] group">
                    <td className="px-3 py-3"><Badge label={d.type ?? 'decision'} size="xs" /></td>
                    <td className="hidden md:table-cell px-3 py-3"><span className="text-xs" style={{ color: t.text }}>{d.niche ?? '—'}</span></td>
                    <td className="px-3 py-3">
                      <span className="text-xs truncate max-w-[100px] md:max-w-[160px] block" style={{ color: t.textSec }}>{d.action ?? '—'}</span>
                      <p className="text-[10px] md:hidden" style={{ color: t.textSec }}>{d.niche ?? ''}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge label={d.outcome ?? d.result ?? 'processed'} dot size="xs" />
                    </td>
                    <td className="hidden md:table-cell px-3 py-3">
                      {d.confidence != null && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full bg-white/[0.25] rounded-full" style={{ width: `${d.confidence * 100}%` }} />
                          </div>
                          <span className="text-xs" style={{ color: t.textSec }}>{(d.confidence * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-3 py-3"><span className="text-xs" style={{ color: t.textSec }}>{new Date(d.createdAt).toLocaleString('fr-FR')}</span></td>
                    <td className="px-3 py-3">
                      <button onClick={() => setSelected(d)}
                        className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-all opacity-0 group-hover:opacity-100"
                        style={{ color: t.textSec }}>
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        <div className="px-4 pb-4"><Pagination page={page} total={total} limit={LIMIT} onChange={setPage} /></div>
      </div>

      <SlideSheet open={!!selected} onClose={() => setSelected(null)}
        title="Détail décision IA"
        subtitle={selected ? new Date(selected.createdAt).toLocaleString('fr-FR') : ''}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: t.elevated, borderRadius: t.rSm }}>
                <Badge label={selected.type ?? 'decision'} />
                <p className="text-[10px] mt-1.5" style={{ color: t.textSec }}>Type</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: t.elevated, borderRadius: t.rSm }}>
                {selected.confidence != null
                  ? <p className="text-xl font-bold" style={{ color: t.text }}>{(selected.confidence * 100).toFixed(0)}%</p>
                  : <p className="text-xl font-bold" style={{ color: t.textSec }}>—</p>}
                <p className="text-[10px] mt-1.5" style={{ color: t.textSec }}>Confiance</p>
              </div>
            </div>
            {selected.niche && <div className="flex justify-between text-xs p-3 rounded-xl" style={{ background: t.elevated, borderRadius: t.rSm }}><span style={{ color: t.textSec }}>Niche</span><span style={{ color: t.text }}>{selected.niche}</span></div>}
            {selected.action && (
              <div>
                <p className="text-xs mb-2" style={{ color: t.textSec }}>Action</p>
                <p className="text-xs p-3 rounded-xl" style={{ color: t.text, background: t.elevated, borderRadius: t.rSm }}>{selected.action}</p>
              </div>
            )}
            {selected.reasoning && (
              <div>
                <p className="text-xs mb-2" style={{ color: t.textSec }}>Raisonnement</p>
                <p className="text-xs leading-relaxed p-3 rounded-xl" style={{ color: t.text, background: t.elevated, borderRadius: t.rSm }}>{selected.reasoning}</p>
              </div>
            )}
            {selected.data && (
              <div>
                <p className="text-xs mb-2" style={{ color: t.textSec }}>Données</p>
                <pre className="text-[10px] overflow-x-auto leading-relaxed p-3 rounded-xl" style={{ color: t.text, background: t.elevated, borderRadius: t.rSm }}>{JSON.stringify(selected.data, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
