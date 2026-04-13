import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Search, RefreshCw, FileText, Phone, Clock, Play, Pause, Volume2 } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import SlideSheet from '../../components/ui/SlideSheet';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { t, glass, inputStyle } from '../../styles/admin-theme';

const OUTCOMES = ['','interested','voicemail','no_answer','rejected','converted','callback','not_interested'];
function fmtDuration(s?: number) { if (!s) return '—'; return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function scoreColor(s: number) { return s >= 7 ? t.success : s >= 4 ? t.warning : t.danger; }

export default function AdminCalls() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [minScore, setMinScore] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), ...(search&&{search}), ...(outcome&&{outcome}), ...(minScore&&{minScore}) });
      const { data: res } = await api.get(`/dashboard/calls?${params}`);
      setData(Array.isArray(res.calls) ? res.calls : (Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : [])));
      setTotal(res.total ?? res.pagination?.total ?? (Array.isArray(res) ? res.length : 0));
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
          <h1 className="text-xl font-bold" style={{ color: t.text }}>Appels</h1>
          <p className="text-sm mt-0.5" style={{ color: t.textSec }}>{total} appel{total>1?'s':''}</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-all" style={{ color: t.textSec }}><RefreshCw className="w-4 h-4"/></button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: t.textSec }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..."
            style={inputStyle}
            className="w-full pl-8 pr-3 py-2 placeholder-[#48484A] focus:outline-none focus:border-white/[0.18]"/>
        </div>
        <select value={outcome} onChange={e=>setOutcome(e.target.value)}
          style={inputStyle}
          className="px-3 py-2 focus:outline-none">
          <option value="">Résultat</option>
          {OUTCOMES.filter(Boolean).map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        <select value={minScore} onChange={e=>setMinScore(e.target.value)}
          style={inputStyle}
          className="px-3 py-2 focus:outline-none">
          <option value="">Score</option>
          {[3,5,7,8,9].map(s=><option key={s} value={String(s)}>≥{s}</option>)}
        </select>
      </div>

      <div className="overflow-hidden" style={glass}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${t.border}` }}>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Entreprise</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Résult.</th>
              <th className="px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Score</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Durée</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] font-medium uppercase" style={{ color: t.textSec }}>Date</th>
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
                  <p className="text-xs font-medium truncate max-w-[120px] md:max-w-none" style={{ color: t.text }}>{c.prospect?.businessName??c.businessName??'—'}</p>
                  <p className="text-[10px] md:hidden" style={{ color: t.textSec }}>{fmtDuration(c.duration??c.durationSeconds)}</p>
                </td>
                <td className="px-3 py-3"><Badge label={c.outcome??'unknown'} dot size="xs"/></td>
                <td className="px-3 py-3">
                  {(c.interestScore??c.interestLevel)!=null
                    ? <span className="text-xs font-bold" style={{color:scoreColor(c.interestScore??c.interestLevel)}}>{c.interestScore??c.interestLevel}/10</span>
                    : <span className="text-xs" style={{ color: t.textSec }}>—</span>}
                </td>
                <td className="hidden md:table-cell px-3 py-3">
                  <span className="flex items-center gap-1 text-xs" style={{ color: t.textSec }}><Clock className="w-3 h-3"/>{fmtDuration(c.duration??c.durationSeconds)}</span>
                </td>
                <td className="hidden md:table-cell px-3 py-3">
                  <span className="text-xs" style={{ color: t.textSec }}>{new Date(c.createdAt??c.startedAt).toLocaleDateString('fr-FR')}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {c.recordingUrl&&<button onClick={()=>setSelected(c)} title="Écouter" className="p-1.5 rounded-lg hover:bg-white/[0.08]" style={{ color: t.textSec }}><Volume2 className="w-3.5 h-3.5"/></button>}
                    {c.transcript&&<button onClick={()=>setSelected(c)} title="Transcription" className="p-1.5 rounded-lg hover:bg-white/[0.08]" style={{ color: t.textSec }}><FileText className="w-3.5 h-3.5"/></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 pb-4"><Pagination page={page} total={total} limit={LIMIT} onChange={setPage}/></div>
      </div>

      <SlideSheet open={!!selected} onClose={()=>{setSelected(null);setPlayingId(null);}}
        title={selected?.businessName??selected?.prospect?.businessName??'Détail appel'}
        subtitle={[selected?.outcome, fmtDuration(selected?.duration??selected?.durationSeconds)].filter(Boolean).join(' · ')}>
        {selected&&(
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: t.elevated, borderRadius: t.rSm }}>
                <p className="text-base font-bold" style={{color:scoreColor((selected.interestScore??selected.interestLevel)??0)}}>{selected.interestScore??selected.interestLevel??'—'}{(selected.interestScore??selected.interestLevel)?'/10':''}</p>
                <p className="text-[10px] mt-0.5" style={{ color: t.textSec }}>Score</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: t.elevated, borderRadius: t.rSm }}>
                <p className="text-base font-bold" style={{ color: t.text }}>{fmtDuration(selected.duration??selected.durationSeconds)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: t.textSec }}>Durée</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: t.elevated, borderRadius: t.rSm }}>
                <Badge label={selected.outcome??'unknown'} dot size="xs"/>
                <p className="text-[10px] mt-1" style={{ color: t.textSec }}>Résultat</p>
              </div>
            </div>
            {selected.recordingUrl&&(
              <div>
                <p className="text-xs mb-2" style={{ color: t.textSec }}>Enregistrement</p>
                <div className="rounded-xl p-3" style={{ background: t.elevated, borderRadius: t.rSm }}>
                  <button onClick={()=>setPlayingId(playingId===selected.id?null:selected.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                      playingId===selected.id
                        ? 'bg-white/[0.06] border border-white/[0.08]'
                        : 'bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10]'
                    }`}
                    style={{ color: playingId===selected.id ? t.danger : t.textSec }}>
                    {playingId===selected.id ? <><Pause className="w-3.5 h-3.5"/> Pause</> : <><Play className="w-3.5 h-3.5"/> Écouter l'appel</>}
                  </button>
                  {playingId===selected.id&&(
                    <audio controls autoPlay className="w-full mt-3 h-8" src={selected.recordingUrl}
                      onEnded={()=>setPlayingId(null)} />
                  )}
                </div>
              </div>
            )}
            {selected.summary&&<div><p className="text-xs mb-2" style={{ color: t.textSec }}>Résumé IA</p><p className="text-xs leading-relaxed rounded-xl p-3" style={{ color: t.text, background: t.elevated, borderRadius: t.rSm }}>{selected.summary}</p></div>}
            {selected.transcript&&<div><p className="text-xs mb-2" style={{ color: t.textSec }}>Transcription</p><p className="text-xs leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl p-3" style={{ color: t.text, background: t.elevated, borderRadius: t.rSm }}>{selected.transcript}</p></div>}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
