import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Quote } from '../types';
import { Search, RefreshCw, Send, Eye, FileText, ExternalLink } from 'lucide-react';
import Badge from '../components/ui/Badge';
import SlideSheet from '../components/ui/SlideSheet';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/Toast';

export default function Quotes() {
  const [data, setData] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/quotes/');
      const all: Quote[] = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      let filtered = all;
      if (search) filtered = filtered.filter(q =>
        (q.prospect?.businessName ?? '').toLowerCase().includes(search.toLowerCase())
      );
      if (statusFilter) filtered = filtered.filter(q => q.status === statusFilter);
      setTotal(filtered.length);
      setData(filtered.slice((page - 1) * LIMIT, page * LIMIT));
    } catch { toast('Erreur chargement devis', 'error'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const sendQuote = async (id: string) => {
    setSending(id);
    try {
      await api.post('/quotes/send', { quoteId: id });
      toast('Devis envoyé', 'success');
      load();
    } catch { toast('Erreur envoi devis', 'error'); }
    finally { setSending(null); }
  };

  const resendContract = async (id: string) => {
    setResending(id);
    try {
      await api.post(`/quotes/${id}/resend-contract`);
      toast('Contrat renvoyé', 'success');
    } catch { toast('Erreur renvoi contrat', 'error'); }
    finally { setResending(null); }
  };

  const STATUS_OPTIONS = ['draft','sent','accepted','rejected','expired','signed'];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} remove={remove} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8F8FF]">Devis</h1>
          <p className="text-sm text-[#8B8BA7] mt-0.5">{total} devis</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8BA7]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom du prospect..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-[#12121A] border border-white/[0.06] text-sm text-[#F8F8FF] focus:outline-none">
          <option value="">Tous statuts</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-2xl bg-[#12121A] border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Prospect</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Pack</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Setup</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Mensuel</th>
              <th className="px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Statut</th>
              <th className="hidden md:table-cell px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase">Valide</th>
              <th className="px-3 py-3 text-left text-[10px] text-[#8B8BA7] font-medium uppercase"></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
              : data.length === 0
                ? <tr><td colSpan={7}><EmptyState icon={<FileText className="w-7 h-7" />} title="Aucun devis" /></td></tr>
                : data.map(q => (
                  <tr key={q.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                    <td className="px-3 py-3">
                      <p className="text-xs font-medium text-[#F8F8FF] truncate max-w-[110px] md:max-w-none">{q.prospect?.businessName ?? '—'}</p>
                      <p className="text-[10px] text-[#22C55E] md:hidden">${q.monthlyFee}/mo</p>
                      <p className="text-[10px] text-[#8B8BA7] hidden md:block">{q.prospect?.contactName ?? ''}</p>
                    </td>
                    <td className="hidden md:table-cell px-3 py-3"><Badge label={q.packageType} variant="purple" size="xs" /></td>
                    <td className="hidden md:table-cell px-3 py-3"><span className="text-xs text-[#F8F8FF]">${q.setupFee}</span></td>
                    <td className="hidden md:table-cell px-3 py-3"><span className="text-xs font-medium text-[#22C55E]">${q.monthlyFee}/mo</span></td>
                    <td className="px-3 py-3"><Badge label={q.status} dot size="xs" /></td>
                    <td className="hidden md:table-cell px-3 py-3">
                      <span className={`text-xs ${new Date(q.validUntil) < new Date() ? 'text-[#EF4444]' : 'text-[#8B8BA7]'}`}>
                        {new Date(q.validUntil).toLocaleDateString('fr-FR')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setSelected(q)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[#8B8BA7] hover:text-white transition-all"><Eye className="w-3.5 h-3.5" /></button>
                        {q.status === 'draft' && (
                          <button onClick={() => sendQuote(q.id)} disabled={sending === q.id}
                            className="p-1.5 rounded-lg hover:bg-[#7B5CF0]/10 text-[#8B8BA7] hover:text-[#7B5CF0] transition-all disabled:opacity-40"><Send className="w-3.5 h-3.5" /></button>
                        )}
                        {(q.status === 'sent' || q.status === 'accepted') && (
                          <button onClick={() => resendContract(q.id)} disabled={resending === q.id}
                            className="p-1.5 rounded-lg hover:bg-[#22C55E]/10 text-[#8B8BA7] hover:text-[#22C55E] transition-all disabled:opacity-40"><FileText className="w-3.5 h-3.5" /></button>
                        )}
                        {q.stripePaymentLink && (
                          <a href={q.stripePaymentLink} target="_blank" rel="noreferrer"
                            className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[#8B8BA7] hover:text-white transition-all"><ExternalLink className="w-3.5 h-3.5" /></a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        <div className="px-4 pb-4"><Pagination page={page} total={total} limit={LIMIT} onChange={setPage} /></div>
      </div>

      <SlideSheet open={!!selected} onClose={() => setSelected(null)}
        title={`Devis — ${selected?.prospect?.businessName ?? ''}`}
        subtitle={`#${selected?.id.slice(0, 8)}`}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0D0D15] rounded-xl p-4 text-center">
                <p className="text-xl font-bold text-[#F8F8FF]">${selected.setupFee}</p>
                <p className="text-[10px] text-[#8B8BA7] mt-1 uppercase tracking-wide">Setup</p>
              </div>
              <div className="bg-[#0D0D15] rounded-xl p-4 text-center">
                <p className="text-xl font-bold text-[#22C55E]">${selected.monthlyFee}/mo</p>
                <p className="text-[10px] text-[#8B8BA7] mt-1 uppercase tracking-wide">Mensuel</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0D0D15] rounded-xl">
              <span className="text-sm text-[#8B8BA7]">Statut</span>
              <Badge label={selected.status} dot />
            </div>
            <div className="space-y-2 text-xs">
              {[
                { l: 'Package', v: selected.packageType },
                { l: 'Contact', v: selected.prospect?.contactName },
                { l: 'Email', v: selected.prospect?.email },
                { l: 'Valide jusqu\'au', v: new Date(selected.validUntil).toLocaleDateString('fr-FR') },
                { l: 'Créé le', v: new Date(selected.createdAt).toLocaleDateString('fr-FR') },
              ].filter(x => x.v).map(({ l, v }) => (
                <div key={l} className="flex justify-between">
                  <span className="text-[#8B8BA7]">{l}</span>
                  <span className="text-[#F8F8FF]">{v}</span>
                </div>
              ))}
            </div>
            {selected.stripePaymentLink && (
              <a href={selected.stripePaymentLink} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#7B5CF0]/10 text-[#7B5CF0] border border-[#7B5CF0]/20 hover:bg-[#7B5CF0]/20 text-sm font-medium transition-all">
                <ExternalLink className="w-4 h-4" />Lien paiement Stripe
              </a>
            )}
            {selected.status === 'draft' && (
              <button onClick={() => { sendQuote(selected.id); setSelected(null); }} disabled={sending === selected.id}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#7B5CF0] text-white text-sm font-medium hover:bg-[#6D4FE0] transition-all disabled:opacity-50">
                <Send className="w-4 h-4" />Envoyer le devis
              </button>
            )}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
