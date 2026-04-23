import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { RefreshCw, Brain, Search, Info, Check, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import SlideSheet from '../../components/ui/SlideSheet';
import Pagination from '../../components/ui/Pagination';
import QwillioLoader from '../../components/QwillioLoader';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, IconBtn, GhostBtn, Pill,
} from '../../components/pro/ProBlocks';

type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

const fmtDateTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `${date} · ${time}`;
};

const outcomeColor = (outcome?: string): PillColor => {
  const v = (outcome || '').toLowerCase();
  if (['approved', 'auto_approved', 'success', 'ok'].includes(v)) return 'ok';
  if (['rejected', 'failed', 'error', 'denied'].includes(v)) return 'bad';
  if (['pending', 'needs_review', 'review'].includes(v)) return 'warn';
  return 'neutral';
};

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

  // KPI counts (best-effort from current page data)
  const totalCount = total || data.length;
  const autoApproved = data.filter((d: any) => {
    const v = (d.outcome ?? d.result ?? '').toLowerCase();
    return v === 'approved' || v === 'auto_approved' || v === 'success' || v === 'ok';
  }).length;
  const needsReview = data.filter((d: any) => {
    const v = (d.outcome ?? d.result ?? '').toLowerCase();
    return v === 'pending' || v === 'needs_review' || v === 'review';
  }).length;
  const rejected = data.filter((d: any) => {
    const v = (d.outcome ?? d.result ?? '').toLowerCase();
    return v === 'rejected' || v === 'failed' || v === 'error' || v === 'denied';
  }).length;

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="IA — Décisions"
        subtitle="Journal des décisions automatiques"
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </IconBtn>
        }
      />

      {/* KPI Grid */}
      <section>
        <SectionHead title="Aperçu" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Décisions totales" value={totalCount} hint="Toutes dates confondues" />
          <Stat label="Auto-approuvées" value={autoApproved} hint="Sur la page en cours" />
          <Stat label="À examiner" value={needsReview} hint="Sur la page en cours" />
          <Stat label="Rejetées" value={rejected} hint="Sur la page en cours" />
        </div>
      </section>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-2.5 px-4 h-11">
          <Search className="w-4 h-4" style={{ color: pro.textTer }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher décisions…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder-[#6B6B75]"
            style={{ color: pro.text }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[11px]" style={{ color: pro.textSec }}>
              Effacer
            </button>
          )}
        </div>
      </Card>

      {/* Decision list */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <QwillioLoader size={120} fullscreen={false} />
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center" style={{ color: pro.textTer }}>
            <Brain className="w-7 h-7 mx-auto mb-3" />
            <p className="text-[13px]">Aucune décision IA</p>
          </div>
        ) : (
          data.map((d: any, i: number) => {
            const outcome = d.outcome ?? d.result ?? 'processed';
            return (
              <div
                key={d.id}
                className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Brain size={14} style={{ color: pro.text }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Pill color="neutral">{d.type ?? 'decision'}</Pill>
                    <Pill color={outcomeColor(outcome)}>{outcome}</Pill>
                    {d.confidence != null && (
                      <span className="text-[11px] tabular-nums" style={{ color: pro.textTer }}>
                        {(d.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                    {d.action ?? '—'}
                  </p>
                  <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                    {d.niche ? `${d.niche} · ` : ''}{fmtDateTime(d.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <GhostBtn size="sm" onClick={() => setSelected(d)}>
                    <Info size={12} /> Détail
                  </GhostBtn>
                  <IconBtn title="Approuver">
                    <Check className="w-4 h-4" />
                  </IconBtn>
                  <IconBtn title="Rejeter">
                    <X className="w-4 h-4" />
                  </IconBtn>
                </div>
              </div>
            );
          })
        )}
        <div className="px-4 pb-4 pt-2">
          <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
        </div>
      </Card>

      <SlideSheet open={!!selected} onClose={() => setSelected(null)}
        title="Détail décision IA"
        subtitle={selected ? fmtDateTime(selected.createdAt) : ''}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3 text-center border"
                   style={{ background: pro.panel, borderColor: pro.border }}>
                <Pill color="neutral">{selected.type ?? 'decision'}</Pill>
                <p className="text-[10px] mt-1.5 uppercase tracking-wider" style={{ color: pro.textTer }}>Type</p>
              </div>
              <div className="rounded-xl p-3 text-center border"
                   style={{ background: pro.panel, borderColor: pro.border }}>
                {selected.confidence != null
                  ? <p className="text-xl font-semibold tabular-nums" style={{ color: pro.text }}>{(selected.confidence * 100).toFixed(0)}%</p>
                  : <p className="text-xl font-semibold" style={{ color: pro.textSec }}>—</p>}
                <p className="text-[10px] mt-1.5 uppercase tracking-wider" style={{ color: pro.textTer }}>Confiance</p>
              </div>
            </div>
            {selected.niche && (
              <div className="flex justify-between text-xs p-3 rounded-xl border"
                   style={{ background: pro.panel, borderColor: pro.border }}>
                <span style={{ color: pro.textSec }}>Niche</span>
                <span style={{ color: pro.text }}>{selected.niche}</span>
              </div>
            )}
            {selected.action && (
              <div>
                <p className="text-xs mb-2 uppercase tracking-wider" style={{ color: pro.textTer }}>Action</p>
                <p className="text-xs p-3 rounded-xl border"
                   style={{ color: pro.text, background: pro.panel, borderColor: pro.border }}>
                  {selected.action}
                </p>
              </div>
            )}
            {selected.reasoning && (
              <div>
                <p className="text-xs mb-2 uppercase tracking-wider" style={{ color: pro.textTer }}>Raisonnement</p>
                <p className="text-xs leading-relaxed p-3 rounded-xl border"
                   style={{ color: pro.text, background: pro.panel, borderColor: pro.border }}>
                  {selected.reasoning}
                </p>
              </div>
            )}
            {selected.data && (
              <div>
                <p className="text-xs mb-2 uppercase tracking-wider" style={{ color: pro.textTer }}>Données</p>
                <pre className="text-[10px] overflow-x-auto leading-relaxed p-3 rounded-xl border"
                     style={{ color: pro.text, background: pro.panel, borderColor: pro.border }}>
                  {JSON.stringify(selected.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </SlideSheet>
    </div>
  );
}
