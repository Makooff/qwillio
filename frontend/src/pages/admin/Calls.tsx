import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Search, RefreshCw, FileText, Phone, Clock } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import SlideSheet from '../../components/ui/SlideSheet';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

const OUTCOMES = ['','interested','voicemail','no_answer','rejected','converted','callback','not_interested'];
function fmtDuration(s?: number) { if (!s) return '—'; return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function scoreColor(s: number) { return s >= 7 ? '#22C55E' : s >= 4 ? '#F59E0B' : '#EF4444'; }

export default function AdminCalls() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [minScore, setMinScore] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const { toasts, add: toast, remove } = useToast();
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), ...(search&&{search}), ...(outcome&&{outcome}), ...(minScore&&{minScore}) });
      const { data: res } = await api.get(`/dashboard/calls?${params}`);
      setData(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
      setTotal(res.pagination?.total ?? (Array.isArray(res) ? res.length : 0));
    } catch { toast('Erreur chargement','error'); }
    finally { setLoading(false); }
  }, [page, search, outcome, minScore]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, outcome, minScore]);

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Appels</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">{total} appel{total>1?'s':''}</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7]"><RefreshCw className="w-4 h-4"/></button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B8BA7]"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50"/>
        </div>
        <select value={outcome} onChange={e=>setOutcome(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none">
          <option value="">Résultat</option>
          {OUTCOMES.filter(Boolean).map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        <select value={minScore} onChange={e=>setMinScore(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none">
          <option value="">Score</option>
          {[3,5,7,8,9].map(s=><option key={s} value={String(s)}>≥{s}</option>)}
        </select>
      </div>

      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Entreprise</th>
              <th className="px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Résult.</th>
              <th className="px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Score</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Durée</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Date</th>
              <th className="px-3 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({length:6}).map((_,i)=>(
              <tr key={i} className="border-b border-white/[0.04]">
                {[1,2,3].map(j=><td key={j} className="px-3 py-3"><div className="h-3 bg-white/[0.06] rounded animate-pulse w-20"/></td>)}
                <td className="hidden md:table-cell px-3 py-3"><div className="h-3 bg-white/[0.06] rounded animate-pulse w-12"/></td>
                <td className="hidden md:table-cell px-3 py-3"><div className="h-3 bg-white/[0.06] rounded animate-pulse w-16"/></td>
                <td/>
              </tr>
            )) : data.length===0 ? (
              <tr><td colSpan={6}><EmptyState icon={<Phone className="w-7 h-7"/>} title="Aucun appel"/></td></tr>
            ) : data.map((c:any)=>(
              <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                <td className="px-3 py-3">
                  <p className="text-xs font-medium text-[#F8F8FF] truncate max-w-[120px] md:max-w-none">{c.prospect?.businessName??c.businessName??'—'}</p>
                  <p className="text-[10px] text-[#8B8BA7] md:hidden">{fmtDuration(c.durationSeconds)}</p>
                </td>
                <td className="px-3 py-3"><Badge label={c.outcome??'unknown'} dot size="xs"/></td>
                <td className="px-3 py-3">
                  {c.interestLevel!=null
                    ? <span className="text-xs font-bold" style={{color:scoreColor(c.interestLevel)}}>{c.interestLevel}/10</span>
                    : <span className="text-xs text-[#8B8BA7]">—</span>}
                </td>
                <td className="hidden md:table-cell px-3 py-3">
                  <span className="flex items-center gap-1 text-xs text-[#8B8BA7]"><Clock className="w-3 h-3"/>{fmtDuration(c.durationSeconds)}</span>
                </td>
                <td className="hidden md:table-cell px-3 py-3">
                  <span className="text-xs text-[#8B8BA7]">{new Date(c.createdAt??c.startedAt).toLocaleDateString('fr-FR')}</span>
                </td>
                <td className="px-3 py-3">
                  {c.transcript&&<button onClick={()=>setSelected(c)} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[#8B8BA7] hover:text-white opacity-0 group-hover:opacity-100 transition-all"><FileText className="w-3.5 h-3.5"/></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 pb-4"><Pagination page={page} total={total} limit={LIMIT} onChange={setPage}/></div>
      </div>

      <SlideSheet open={!!selected} onClose={()=>setSelected(null)}
        title={selected?.prospect?.businessName??'Détail appel'}
        subtitle={[selected?.outcome, fmtDuration(selected?.durationSeconds)].filter(Boolean).join(' · ')}>
        {selected&&(
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0D0D15] rounded-xl p-3 text-center">
                <p className="text-base font-bold" style={{color:scoreColor(selected.interestLevel??0)}}>{selected.interestLevel??'—'}{selected.interestLevel?'/10':''}</p>
                <p className="text-[10px] text-[#8B8BA7] mt-0.5">Score</p>
              </div>
              <div className="bg-[#0D0D15] rounded-xl p-3 text-center">
                <p className="text-base font-bold text-[#F8F8FF]">{fmtDuration(selected.durationSeconds)}</p>
                <p className="text-[10px] text-[#8B8BA7] mt-0.5">Durée</p>
              </div>
              <div className="bg-[#0D0D15] rounded-xl p-3 text-center">
                <Badge label={selected.outcome??'unknown'} dot size="xs"/>
                <p className="text-[10px] text-[#8B8BA7] mt-1">Résultat</p>
              </div>
            </div>
            {selected.summary&&<div><p className="text-xs text-[#8B8BA7] mb-2">Résumé IA</p><p className="text-xs text-[#F8F8FF] bg-[#0D0D15] rounded-xl p-3 leading-relaxed">{selected.summary}</p></div>}
            {selected.transcript&&<div><p className="text-xs text-[#8B8BA7] mb-2">Transcription</p><p className="text-xs text-[#F8F8FF] bg-[#0D0D15] rounded-xl p-3 leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">{selected.transcript}</p></div>}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
