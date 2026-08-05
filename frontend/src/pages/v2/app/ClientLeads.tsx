import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Mail, Phone, Search, Users, X } from '../../../components/icons';
import api from '../../../services/api';
import { formatDateTime } from '../../../utils/format';
import {
  Card, EmptyState, GhostBtn, Input, PageActions, Pill, PrimaryBtn, Textarea, tableCls,
} from '../../../components/v2/app/Blocks';

/* Leads, registre produit V2 (DA/v2-direction.md, addendum). Logique de
   données identique à la V1: GET /my-dashboard/leads, PUT status et notes. */

type LeadStatus = '' | 'new' | 'contacted' | 'converted' | 'lost';

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

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

const STATUSES: { key: 'new' | 'contacted' | 'converted' | 'lost'; label: string; tone: Tone }[] = [
  { key: 'new', label: 'Nouveau', tone: 'info' },
  { key: 'contacted', label: 'Contacté', tone: 'accent' },
  { key: 'converted', label: 'Converti', tone: 'ok' },
  { key: 'lost', label: 'Perdu', tone: 'bad' },
];

const SENTIMENT_META: Record<string, { label: string; tone: Tone }> = {
  positive: { label: 'Positif', tone: 'ok' },
  neutral: { label: 'Neutre', tone: 'warn' },
  negative: { label: 'Négatif', tone: 'bad' },
};

function SentimentPill({ sentiment }: { sentiment?: string | null }) {
  const meta = SENTIMENT_META[(sentiment || 'neutral').toLowerCase()];
  return <Pill tone={meta ? meta.tone : 'neutral'}>{meta ? meta.label : sentiment}</Pill>;
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUSES.find((s) => s.key === status);
  return <Pill tone={meta ? meta.tone : 'neutral'}>{meta ? meta.label : status}</Pill>;
}

function PageNav({
  page,
  totalPages,
  total,
  label,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  label: string;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const btn =
    'w-8 h-8 rounded-lg flex items-center justify-center text-q2-fog border border-q2-graphite-d hover:text-q2-mist hover:border-q2-smoke-d transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50';
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 px-4 py-3 border-t border-q2-graphite-d"
    >
      <p className="text-[11.5px] text-q2-fog tabular-nums">
        {total.toLocaleString('fr-FR')} {label} · page {page} sur {totalPages}
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Page précédente" className={btn}>
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Page suivante" className={btn}>
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-q2-graphite-d first:border-t-0">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog">{label}</span>
      <span className="text-[13px] text-white tabular-nums text-right break-all">{value}</span>
    </div>
  );
}

export default function ClientLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus>('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const fetchLeads = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/my-dashboard/leads?page=${page}&limit=50`);
      setLeads(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 0 });
    } catch {
      /* leads indisponibles: la liste reste vide */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(1); }, [fetchLeads]);

  useEffect(() => {
    if (!selectedLead) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedLead(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedLead]);

  const handleStatusChange = async (leadId: string, status: string) => {
    try {
      await api.put(`/my-dashboard/leads/${leadId}/status`, { status });
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, leadStatus: status } : l));
      if (selectedLead?.id === leadId) setSelectedLead((p) => p ? { ...p, leadStatus: status } : p);
    } catch {
      /* changement de statut échoué */
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
      /* sauvegarde de la note échouée */
    } finally {
      setSavingNote(false);
    }
  };

  const getLeadStatus = (lead: Lead): string => {
    if (lead.leadStatus) return lead.leadStatus;
    if (lead.tags?.includes('converted')) return 'converted';
    if (lead.tags?.includes('contacted')) return 'contacted';
    if (lead.tags?.includes('lost')) return 'lost';
    return 'new';
  };

  const filteredLeads = leads.filter((l) => {
    if (search) {
      const q = search.toLowerCase();
      if (!(l.callerName || '').toLowerCase().includes(q) &&
          !(l.callerNumber || '').toLowerCase().includes(q) &&
          !(l.emailCollected || '').toLowerCase().includes(q)) return false;
    }
    if (statusFilter && getLeadStatus(l) !== statusFilter) return false;
    return true;
  });

  const statCounts = {
    total: leads.length,
    new: leads.filter((l) => getLeadStatus(l) === 'new').length,
    contacted: leads.filter((l) => getLeadStatus(l) === 'contacted').length,
    converted: leads.filter((l) => getLeadStatus(l) === 'converted').length,
    lost: leads.filter((l) => getLeadStatus(l) === 'lost').length,
  };

  const pipeline: { filter: LeadStatus; label: string; count: number }[] = [
    { filter: '', label: 'Tous', count: statCounts.total },
    { filter: 'new', label: 'Nouveau', count: statCounts.new },
    { filter: 'contacted', label: 'Contacté', count: statCounts.contacted },
    { filter: 'converted', label: 'Converti', count: statCounts.converted },
    { filter: 'lost', label: 'Perdu', count: statCounts.lost },
  ];

  const openLead = (lead: Lead) => {
    setSelectedLead(lead);
    setNoteText(lead.notes || '');
  };

  return (
    <div>
      <PageActions subtitle={`${pagination.total.toLocaleString('fr-FR')} leads qualifiés`}>
        <div className="relative w-[190px] sm:w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-q2-fog" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un lead"
            aria-label="Rechercher dans les leads"
            className="pl-9 !py-[7px]"
          />
        </div>
      </PageActions>

      {/* Pipeline cliquable */}
      <div
        role="group"
        aria-label="Filtrer par étape du pipeline"
        className="inline-flex flex-wrap items-center gap-1 rounded-full bg-q2-obsidian border border-q2-graphite-d p-1 mb-4"
      >
        {pipeline.map((p) => (
          <button
            key={p.filter || 'all'}
            type="button"
            onClick={() => setStatusFilter(p.filter)}
            aria-pressed={statusFilter === p.filter}
            className={`h-7 pl-3 pr-2.5 rounded-full text-[12px] font-medium inline-flex items-center gap-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
              statusFilter === p.filter ? 'bg-q2-indigo text-white' : 'text-q2-fog hover:text-q2-mist'
            }`}
          >
            {p.label}
            <span className={`tabular-nums text-[11.5px] ${statusFilter === p.filter ? 'text-white/70' : 'text-q2-mist'}`}>
              {p.count}
            </span>
          </button>
        ))}
      </div>

      <Card pad={false}>
        {loading ? (
          <div role="status" aria-busy="true" aria-label="Chargement des leads" className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-44 rounded bg-q2-obsidian animate-pulse" />
                <div className="h-3 w-20 rounded bg-q2-obsidian animate-pulse ml-auto" />
                <div className="h-3 w-24 rounded bg-q2-obsidian animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredLeads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun lead trouvé"
            description="Les leads apparaîtront une fois que votre IA qualifie les appelants"
          />
        ) : (
          <>
            {/* Desktop */}
            <div className={`hidden md:block ${tableCls.wrap}`}>
              <table className={tableCls.table}>
                <thead>
                  <tr>
                    <th scope="col" className={tableCls.th}>Lead</th>
                    <th scope="col" className={tableCls.th}>Statut</th>
                    <th scope="col" className={tableCls.th}>Score</th>
                    <th scope="col" className={tableCls.th}>Sentiment</th>
                    <th scope="col" className={tableCls.th}>Date</th>
                    <th scope="col" className={tableCls.th}><span className="sr-only">Détail</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const status = getLeadStatus(lead);
                    const contact = [lead.callerNumber || lead.phoneCollected, lead.emailCollected]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <tr key={lead.id} className={`${tableCls.tr} cursor-pointer`} onClick={() => openLead(lead)}>
                        <td className={tableCls.td}>
                          <span className="block text-white truncate max-w-[260px]">
                            {lead.callerName || lead.nameCollected || 'Inconnu'}
                          </span>
                          {contact && <span className="block text-[11.5px] text-q2-fog mt-0.5 truncate max-w-[260px]">{contact}</span>}
                        </td>
                        <td className={tableCls.td}><StatusPill status={status} /></td>
                        <td className={tableCls.td}>
                          {lead.leadScore != null ? `${lead.leadScore}/10` : '-'}
                        </td>
                        <td className={tableCls.td}><SentimentPill sentiment={lead.sentiment} /></td>
                        <td className={`${tableCls.td} text-q2-fog whitespace-nowrap`}>{formatDateTime(lead.createdAt)}</td>
                        <td className={`${tableCls.td} w-10`}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openLead(lead); }}
                            aria-label={`Voir le détail du lead ${lead.callerName || lead.nameCollected || 'inconnu'}`}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-q2-fog hover:text-q2-mist transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                          >
                            <ChevronRight size={14} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <ul className="md:hidden">
              {filteredLeads.map((lead) => (
                <li key={lead.id} className="border-b border-q2-graphite-d last:border-b-0">
                  <button
                    type="button"
                    onClick={() => openLead(lead)}
                    className="w-full text-left px-4 py-3.5 hover:bg-q2-obsidian/50 transition-colors duration-100 focus:outline-none focus-visible:bg-q2-obsidian"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13.5px] font-medium text-white truncate">
                        {lead.callerName || lead.nameCollected || 'Inconnu'}
                      </span>
                      <StatusPill status={getLeadStatus(lead)} />
                    </div>
                    <p className="text-[11.5px] text-q2-fog mt-1 tabular-nums truncate">
                      {lead.callerNumber || lead.phoneCollected || 'Pas de numéro'}
                      {lead.leadScore != null && ` · ${lead.leadScore}/10`}
                      {` · ${formatDateTime(lead.createdAt)}`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>

            <PageNav
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              label="leads"
              onChange={(p) => fetchLeads(p)}
            />
          </>
        )}
      </Card>

      {/* Panneau latéral de détail */}
      <AnimatePresence>
        {selectedLead && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setSelectedLead(null)}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-q2-void/70"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
              aria-label="Détail du lead"
              className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-q2-carbon border-l border-q2-graphite-d overflow-y-auto"
            >
              <header className="sticky top-0 bg-q2-carbon border-b border-q2-graphite-d px-5 h-14 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-white truncate">
                    {selectedLead.callerName || selectedLead.nameCollected || 'Lead inconnu'}
                  </p>
                  <p className="text-[11.5px] text-q2-fog truncate">{formatDateTime(selectedLead.createdAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  aria-label="Fermer le panneau"
                  className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-q2-fog hover:text-white hover:bg-q2-obsidian transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </header>

              <div className="p-5 space-y-5">
                <div className="rounded-xl border border-q2-graphite-d overflow-hidden">
                  {(selectedLead.callerNumber || selectedLead.phoneCollected) && (
                    <Detail
                      label="Téléphone"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Phone size={12} className="text-q2-fog" aria-hidden="true" />
                          {selectedLead.callerNumber || selectedLead.phoneCollected}
                        </span>
                      }
                    />
                  )}
                  {selectedLead.emailCollected && (
                    <Detail
                      label="Email"
                      value={
                        <span className="inline-flex items-center gap-2">
                          <Mail size={12} className="text-q2-fog" aria-hidden="true" />
                          {selectedLead.emailCollected}
                        </span>
                      }
                    />
                  )}
                  {selectedLead.leadScore != null && (
                    <Detail label="Score lead" value={`${selectedLead.leadScore}/10`} />
                  )}
                  <Detail label="Sentiment" value={<SentimentPill sentiment={selectedLead.sentiment} />} />
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-2">Statut pipeline</p>
                  <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-q2-obsidian border border-q2-graphite-d p-1">
                    {STATUSES.map((s) => {
                      const isActive = getLeadStatus(selectedLead) === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => handleStatusChange(selectedLead.id, s.key)}
                          aria-pressed={isActive}
                          className={`h-7 px-3 rounded-full text-[12px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
                            isActive ? 'bg-q2-indigo text-white' : 'text-q2-fog hover:text-q2-mist'
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedLead.summary && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-2">Résumé de l'appel</p>
                    <p className="text-[13px] text-q2-mist leading-relaxed bg-q2-obsidian border border-q2-graphite-d rounded-xl p-4 q2-body-text">
                      {selectedLead.summary}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-2">Notes</p>
                  <Textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Ajouter des notes sur ce lead"
                    rows={4}
                    className="resize-none"
                    aria-label="Notes sur ce lead"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <PrimaryBtn
                      type="button"
                      onClick={() => handleSaveNote(selectedLead.id)}
                      disabled={savingNote || !noteText.trim()}
                    >
                      {savingNote ? 'Enregistrement' : 'Sauvegarder'}
                    </PrimaryBtn>
                    {selectedLead.notes && noteText !== selectedLead.notes && (
                      <GhostBtn type="button" onClick={() => setNoteText(selectedLead.notes || '')}>
                        Annuler
                      </GhostBtn>
                    )}
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
