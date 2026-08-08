import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Phone, Mail, X, ChevronRight, StickyNote, Star, List, Columns3,
} from '../../components/icons';
import { fetchLive, peekLive } from '../../services/liveData';
import api from '../../services/api';
import SentimentBadge from '../../components/client-dashboard/SentimentBadge';
import Pagination from '../../components/client-dashboard/Pagination';
import EmptyState from '../../components/client-dashboard/EmptyState';
import { formatDateTime } from '../../utils/format';
import PageHeader from '../../components/dashboard/PageHeader';
import { LEAD_STATUS_ORDER, leadStatusStyle } from '../../components/dashboard/leadStatus';
import { mergeLeadsAndContacts, leadStatusOf, type ContactLike, type LeadRow } from '../../components/dashboard/leadRows';

type ViewMode = 'table' | 'kanban';
type LeadStatus = '' | 'new' | 'contacted' | 'converted' | 'lost';

/* Les couleurs et les libellés viennent d'un seul endroit, partagé avec le
   reste du tableau de bord: ils étaient écrits ici ET dans le CRM. */
const KANBAN_COLS = LEAD_STATUS_ORDER;

interface Lead {
  id: string;
  callerName: string;
  callerNumber: string;
  nameCollected: string;
  phoneCollected: string;
  emailCollected: string;
  leadStatus: string;
  leadScore: number | null;
  sentiment: string;
  summary: string;
  notes: string;
  tags: string[];
  createdAt: string;
}

interface PaginationState {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ClientLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus>('');
  const [contacts, setContacts] = useState<ContactLike[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const fetchLeads = useCallback(async (page = 1) => {
    const key = `/my-dashboard/leads?page=${page}&limit=50`;

    // The cached page goes up first, then the fresh one replaces it. Returning
    // to this tab should not blank a list that was correct a moment ago.
    const held = peekLive<{ data?: Lead[]; pagination?: PaginationState }>(key);
    if (held) {
      setLeads(held.data || []);
      if (held.pagination) setPagination(held.pagination);
    }
    setLoading(!held);

    try {
      const data = await fetchLive<{ data?: Lead[]; pagination?: PaginationState }>(key);
      setLeads(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 0 });
    } catch {
      // leads unavailable — the cached list, if any, stays on screen
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(1); }, [fetchLeads]);

  /* Les contacts du CRM, rapatriés ici.
   *
   * « Contacts » et « Leads » listaient les MÊMES personnes: un lead est un
   * appel qualifié, et le contact est créé depuis ce même appel. Deux entrées
   * de menu, deux vocabulaires d'état, une seule réalité. Le CRM n'est donc
   * plus une page: il est cette liste-ci, et sa fiche reste le détail.
   *
   * L'appariement se fait sur le TÉLÉPHONE réduit à ses chiffres. C'est la clé
   * que le dédoublonnage backend emploie déjà; le nom ne marcherait pas
   * (« M. Dupont » et « Dupont ») et l'e-mail manque une fois sur deux.
   */
  useEffect(() => {
    let alive = true;
    api.get('/crm/contacts', { params: { limit: 200 } })
      .then(({ data }) => { if (alive) setContacts(Array.isArray(data?.data) ? data.data : []); })
      /* Silencieux: le CRM est un PLUS sur cette page. S'il tombe, la liste
         des leads reste juste, et une bannière d'erreur ne dirait rien
         d'actionnable au client. */
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const handleStatusChange = async (leadId: string, status: string) => {
    try {
      await api.put(`/my-dashboard/leads/${leadId}/status`, { status });
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, leadStatus: status } : l));
      if (selectedLead?.id === leadId) setSelectedLead((p) => p ? { ...p, leadStatus: status } : p);
    } catch {
      // status change failed — ignore
    }
  };

  const handleSaveNote = async (leadId: string) => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.put(`/my-dashboard/leads/${leadId}/notes`, { notes: noteText });
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, notes: noteText } : l));
      if (selectedLead?.id === leadId) setSelectedLead((p) => p ? { ...p, notes: noteText } : p);
    } catch {
      // note save failed — ignore
    } finally {
      setSavingNote(false);
    }
  };


  /* La liste unique: les leads, enrichis de leur contact, PUIS les contacts
     qui n'ont pas d'appel à eux (saisis à la main, importés). Sans ce second
     paquet, fermer la page Contacts les ferait simplement disparaître. */
  const rows: LeadRow<Lead>[] = useMemo(() => mergeLeadsAndContacts(leads, contacts), [leads, contacts]);

  const filteredLeads = rows.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.name.toLowerCase().includes(q) &&
          !r.phone.toLowerCase().includes(q) &&
          !r.email.toLowerCase().includes(q) &&
          !r.tags.some(t => t.toLowerCase().includes(q))) return false;
    }
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  const statCounts = {
    total: rows.length,
    new: rows.filter(r => r.status === 'new').length,
    contacted: rows.filter(r => r.status === 'contacted').length,
    converted: rows.filter(r => r.status === 'converted').length,
    lost: rows.filter(r => r.status === 'lost').length,
  };

  return (
    <div>
      <PageHeader
        title="Leads et contacts"
        /* Le compte porte sur les LIGNES, pas sur la pagination des seuls
           appels: la liste contient aussi les fiches sans appel. */
        subtitle={`${rows.length} personne${rows.length > 1 ? 's' : ''}, appels qualifiés et fiches`}
        action={
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1">
            <button onClick={() => setView('table')} aria-label="Vue liste"
              className={`px-3 py-1.5 rounded-lg transition-colors ${view === 'table' ? 'bg-[#7349fe] text-white' : 'text-[#A1A1A8] hover:text-[#F5F5F7]'}`}
            >
              <List size={14} />
            </button>
            <button onClick={() => setView('kanban')} aria-label="Vue kanban"
              className={`px-3 py-1.5 rounded-lg transition-colors ${view === 'kanban' ? 'bg-[#7349fe] text-white' : 'text-[#A1A1A8] hover:text-[#F5F5F7]'}`}
            >
              <Columns3 size={14} />
            </button>
          </div>
        }
        /* Le pipeline reste propre a la page: ses cellules FILTRENT, elles ne
           font pas qu'afficher. La rangee standard ne saurait pas cliquer. */
        stats={
          <div className="grid grid-cols-5 divide-x divide-white/[0.06]" role="group" aria-label="Pipeline">
            {[
              { label: 'Total', value: statCounts.total, filter: '' as LeadStatus, color: undefined as string | undefined },
              ...LEAD_STATUS_ORDER.map(st => ({
                label: st.label,
                value: statCounts[st.key],
                filter: st.key as LeadStatus,
                color: st.color as string | undefined,
              })),
            ].map((s, i) => (
              <button
                key={i}
                onClick={() => setStatusFilter(s.filter)}
                aria-pressed={statusFilter === s.filter}
                className={`px-3 py-1 text-left first:pl-0 last:pr-0 transition-opacity ${statusFilter === s.filter ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
              >
                <p className="text-[26px] font-semibold tabular-nums leading-none" style={{ color: s.color || '#F5F5F7' }}>
                  {s.value}
                </p>
                <p className="text-[11px] text-[#A1A1A8] mt-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusFilter === s.filter ? (s.color || '#F5F5F7') : 'transparent', boxShadow: statusFilter === s.filter ? 'none' : `inset 0 0 0 1px ${s.color || '#3a3a3a'}` }} />
                  {s.label}
                </p>
              </button>
            ))}
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Rechercher un lead par nom, téléphone…',
          label: 'Rechercher dans les leads',
        }}
      />

      {loading ? (
        <div role="status" aria-label="Chargement" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04]">
              <div className="w-9 h-9 rounded-lg bg-white/[0.06] animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-44 rounded bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-28 rounded bg-white/[0.05] animate-pulse" />
              </div>
              <div className="h-5 w-14 rounded-full bg-white/[0.05] animate-pulse" />
            </div>
          ))}
        </div>
      ) : filteredLeads.length === 0 ? (
        <EmptyState icon={Users} title="Personne pour l'instant" description="Les leads apparaîtront une fois que votre IA qualifie les appelants, avec leur fiche." />
      ) : view === 'table' ? (
        <>
          <div>
            {filteredLeads.map((r, idx) => {
              const sc = leadStatusStyle(r.status);
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.02, 0.3), ease: [0.16, 1, 0.3, 1] }}
                  className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] cursor-pointer group transition-colors rounded-lg"
                  /* Un appel ouvre son panneau (notes, statut, résumé). Une
                     fiche sans appel ouvre le détail CRM, qui est le seul
                     endroit où elle existe. */
                  onClick={() => {
                    if (r.lead) { setSelectedLead(r.lead); setNoteText(r.lead.notes || ''); }
                    else if (r.contactId) navigate(`/dashboard/crm/${r.contactId}`);
                  }}
                >
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${sc.color}1a` }}
                    >
                      <Users size={16} style={{ color: sc.color }} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#F5F5F7] truncate">{r.name}</p>
                      <p className="text-[11px] text-[#A1A1A8] truncate">
                        {r.phone}
                        {r.email && ` · ${r.email}`}
                        {/* D'où vient la ligne: sans ça, une fiche saisie à la
                            main se lit comme un appel qu'on n'a jamais reçu. */}
                        {!r.lead && ' · fiche'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {r.tags.slice(0, 2).map(t => (
                        <span key={t} className="hidden lg:inline text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] text-[#A1A1A8] font-medium">{t}</span>
                      ))}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.pill}`}>
                        {sc.label.toUpperCase()}
                      </span>
                      {r.score != null && (
                        <div className="hidden sm:flex items-center gap-1">
                          <Star size={12} className="text-[#7349fe]" aria-hidden="true" />
                          <span className="text-xs font-bold text-[#7349fe]">{r.score}/10</span>
                        </div>
                      )}
                      {r.lead && <SentimentBadge sentiment={r.lead.sentiment} />}
                      {r.createdAt && <span className="text-[10px] text-[#A1A1A8] hidden lg:inline">{formatDateTime(r.createdAt)}</span>}
                      <ChevronRight size={14} className="text-white/20 group-hover:text-[#7349fe] transition-colors" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-4">
            <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total}
              onPageChange={p => fetchLeads(p)} label="leads"
            />
          </div>
        </>
      ) : (
        /* Kanban */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {KANBAN_COLS.map(col => {
            const items = filteredLeads.filter(r => r.status === col.key);
            return (
              <div key={col.key}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                  <span className="text-sm font-semibold text-[#F5F5F7]">{col.label}</span>
                  <span className="text-xs text-[#A1A1A8] bg-white/[0.06] px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px] rounded-xl bg-white/[0.02] border border-white/[0.04] p-2">
                  {items.map(r => (
                    <motion.div key={r.id} layout
                      className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5 cursor-pointer hover:border-white/[0.12] transition-colors"
                      onClick={() => {
                        if (r.lead) { setSelectedLead(r.lead); setNoteText(r.lead.notes || ''); }
                        else if (r.contactId) navigate(`/dashboard/crm/${r.contactId}`);
                      }}
                    >
                      <p className="text-sm font-semibold text-[#F5F5F7] truncate mb-1">{r.name}</p>
                      <p className="text-[11px] text-[#A1A1A8] mb-2 truncate">{r.phone}</p>
                      <div className="flex items-center justify-between">
                        {r.lead ? <SentimentBadge sentiment={r.lead.sentiment} /> : <span className="text-[10px] text-[#A1A1A8]">fiche</span>}
                        {r.score != null && (
                          <span className="text-[10px] font-bold text-[#7349fe]">{r.score}/10</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-[#A1A1A8] text-center py-8">Personne ici</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead detail slide-over */}
      <AnimatePresence>
        {selectedLead && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setSelectedLead(null)}
            />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white/[0.02] border-l border-white/[0.07] shadow-2xl z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white/[0.02]/90 backdrop-blur-xl border-b border-white/[0.07] px-6 py-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#F5F5F7]">Détails du lead</h2>
                <button onClick={() => setSelectedLead(null)}
                  className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.10] text-[#A1A1A8] hover:text-[#F5F5F7] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center">
                    <Users size={22} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#F5F5F7]">{selectedLead.callerName || selectedLead.nameCollected || 'Inconnu'}</p>
                    <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">{formatDateTime(selectedLead.createdAt)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {(selectedLead.callerNumber || selectedLead.phoneCollected) && (
                    <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.07] px-4 py-3">
                      <Phone size={14} className="text-[#A1A1A8]" />
                      <span className="text-sm text-[#F5F5F7]">{selectedLead.callerNumber || selectedLead.phoneCollected}</span>
                    </div>
                  )}
                  {selectedLead.emailCollected && (
                    <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.07] px-4 py-3">
                      <Mail size={14} className="text-[#A1A1A8]" />
                      <span className="text-sm text-[#F5F5F7]">{selectedLead.emailCollected}</span>
                    </div>
                  )}
                </div>

                {selectedLead.leadScore != null && (
                  <div>
                    <p className="text-xs text-[#A1A1A8] mb-2">Score lead</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-[#7349fe] rounded-full"
                          style={{ width: `${selectedLead.leadScore * 10}%` }}
                        />
                      </div>
                      <span className="text-lg font-bold text-[#7349fe]">{selectedLead.leadScore}/10</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#A1A1A8]">Sentiment :</span>
                  <SentimentBadge sentiment={selectedLead.sentiment} />
                </div>

                {/* Pipeline status */}
                <div>
                  <p className="text-xs text-[#A1A1A8] mb-2">Statut pipeline</p>
                  <div className="grid grid-cols-2 gap-2">
                    {KANBAN_COLS.map(col => {
                      const isActive = leadStatusOf(selectedLead) === col.key;
                      const sc = col;
                      return (
                        <button key={col.key} onClick={() => handleStatusChange(selectedLead.id, col.key)}
                          className={`px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${
                            isActive
                              ? `${sc.pill} ${sc.border}`
                              : 'bg-white/[0.04] border-white/[0.07] text-[#A1A1A8] hover:bg-white/[0.08]'
                          }`}
                        >
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedLead.summary && (
                  <div>
                    <p className="text-xs text-[#A1A1A8] mb-2">Résumé de l'appel</p>
                    <p className="text-sm text-[#F5F5F7] leading-relaxed bg-white/[0.04] rounded-xl p-4 border border-white/[0.07]">{selectedLead.summary}</p>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <p className="text-xs text-[#A1A1A8] mb-2 flex items-center gap-1">
                    <StickyNote size={12} /> Notes
                  </p>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Ajouter des notes sur ce lead..."
                    rows={3}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-white/[0.07] bg-[#0A0A0F] text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7349fe]/50 resize-none transition-colors"
                  />
                  <button
                    onClick={() => handleSaveNote(selectedLead.id)}
                    disabled={savingNote || !noteText.trim()}
                    className="mt-2 px-4 py-2 text-xs font-medium text-white bg-[#7349fe] rounded-xl hover:bg-[#6a4ee0] disabled:opacity-40 transition-colors"
                  >
                    {savingNote ? 'Enregistrement...' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
