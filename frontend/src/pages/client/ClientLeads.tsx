import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Phone, Mail, X, ChevronRight, StickyNote, Star, List, Columns3, Search,
} from 'lucide-react';
import api from '../../services/api';
import SentimentBadge from '../../components/client-dashboard/SentimentBadge';
import Pagination from '../../components/client-dashboard/Pagination';
import EmptyState from '../../components/client-dashboard/EmptyState';
import { formatDateTime } from '../../utils/format';
import { SubPageHeader } from '../../components/dashboard/OverviewBlocks';

type ViewMode = 'table' | 'kanban';
type LeadStatus = '' | 'new' | 'contacted' | 'converted' | 'lost';

const STATUS_STYLES: Record<string, { pill: string; border: string }> = {
  new:       { pill: 'bg-blue-400/10 text-blue-400',    border: 'border-blue-400/20' },
  contacted: { pill: 'bg-[#493cbe]/10 text-[#493cbe]', border: 'border-[#493cbe]/20' },
  converted: { pill: 'bg-emerald-400/10 text-emerald-400', border: 'border-emerald-400/20' },
  lost:      { pill: 'bg-red-400/10 text-red-400',      border: 'border-red-400/20' },
};

const KANBAN_COLS = [
  { key: 'new',       label: 'Nouveau',   color: '#60a5fa' },
  { key: 'contacted', label: 'Contacté',  color: '#493cbe' },
  { key: 'converted', label: 'Converti',  color: '#34d399' },
  { key: 'lost',      label: 'Perdu',     color: '#f87171' },
];

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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('table');
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
      // leads unavailable — list stays empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(1); }, [fetchLeads]);

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

  const getLeadStatus = (lead: Lead): string => {
    if (lead.leadStatus) return lead.leadStatus;
    if (lead.tags?.includes('converted')) return 'converted';
    if (lead.tags?.includes('contacted')) return 'contacted';
    if (lead.tags?.includes('lost')) return 'lost';
    return 'new';
  };

  const filteredLeads = leads.filter(l => {
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
    new: leads.filter(l => getLeadStatus(l) === 'new').length,
    contacted: leads.filter(l => getLeadStatus(l) === 'contacted').length,
    converted: leads.filter(l => getLeadStatus(l) === 'converted').length,
    lost: leads.filter(l => getLeadStatus(l) === 'lost').length,
  };

  return (
    <div>
      <SubPageHeader
        title="Leads"
        subtitle={`${pagination.total} leads qualifiés`}
        action={
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1">
            <button onClick={() => setView('table')} aria-label="Vue liste"
              className={`px-3 py-1.5 rounded-lg transition-colors ${view === 'table' ? 'bg-[#493cbe] text-white' : 'text-[#A1A1A8] hover:text-[#F5F5F7]'}`}
            >
              <List size={14} />
            </button>
            <button onClick={() => setView('kanban')} aria-label="Vue kanban"
              className={`px-3 py-1.5 rounded-lg transition-colors ${view === 'kanban' ? 'bg-[#493cbe] text-white' : 'text-[#A1A1A8] hover:text-[#F5F5F7]'}`}
            >
              <Columns3 size={14} />
            </button>
          </div>
        }
      />

      {/* Pipeline — frameless figures split by hairlines, click to filter */}
      <motion.section
        aria-label="Pipeline"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-5 divide-x divide-white/[0.06] pb-6 mb-6 border-b border-white/[0.06]"
      >
        {[
          { label: 'Total', value: statCounts.total, filter: '' as LeadStatus, color: undefined as string | undefined },
          { label: 'Nouveau', value: statCounts.new, filter: 'new' as LeadStatus, color: '#60a5fa' },
          { label: 'Contacté', value: statCounts.contacted, filter: 'contacted' as LeadStatus, color: '#493cbe' },
          { label: 'Converti', value: statCounts.converted, filter: 'converted' as LeadStatus, color: '#34d399' },
          { label: 'Perdu', value: statCounts.lost, filter: 'lost' as LeadStatus, color: '#f87171' },
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
      </motion.section>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A8]" />
        <input
          type="text"
          placeholder="Rechercher des leads..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none focus:border-[#493cbe]/50 transition-colors"
        />
      </div>

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
        <EmptyState icon={Users} title="Aucun lead trouvé" description="Les leads apparaîtront une fois que votre IA qualifie les appelants" />
      ) : view === 'table' ? (
        <>
          <div>
            {filteredLeads.map((lead, idx) => {
              const status = getLeadStatus(lead);
              const sc = STATUS_STYLES[status] || STATUS_STYLES.new;
              return (
                <motion.div key={lead.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.02, 0.3), ease: [0.16, 1, 0.3, 1] }}
                  className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] cursor-pointer group transition-colors rounded-lg"
                  onClick={() => { setSelectedLead(lead); setNoteText(lead.notes || ''); }}
                >
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                      <Users size={16} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#F5F5F7] truncate">{lead.callerName || lead.nameCollected || 'Inconnu'}</p>
                      <p className="text-[11px] text-[#A1A1A8]">
                        {lead.callerNumber || lead.phoneCollected || ''}
                        {lead.emailCollected && ` · ${lead.emailCollected}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.pill}`}>
                        {status.toUpperCase()}
                      </span>
                      {lead.leadScore != null && (
                        <div className="hidden sm:flex items-center gap-1">
                          <Star size={12} className="text-[#493cbe]" />
                          <span className="text-xs font-bold text-[#493cbe]">{lead.leadScore}/10</span>
                        </div>
                      )}
                      <SentimentBadge sentiment={lead.sentiment} />
                      <span className="text-[10px] text-[#A1A1A8] hidden lg:inline">{formatDateTime(lead.createdAt)}</span>
                      <ChevronRight size={14} className="text-white/20 group-hover:text-[#493cbe] transition-colors" />
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
            const items = filteredLeads.filter(l => getLeadStatus(l) === col.key);
            return (
              <div key={col.key}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                  <span className="text-sm font-semibold text-[#F5F5F7]">{col.label}</span>
                  <span className="text-xs text-[#A1A1A8] bg-white/[0.06] px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px] rounded-xl bg-white/[0.02] border border-white/[0.04] p-2">
                  {items.map(lead => (
                    <motion.div key={lead.id} layout
                      className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5 cursor-pointer hover:border-white/[0.12] transition-colors"
                      onClick={() => { setSelectedLead(lead); setNoteText(lead.notes || ''); }}
                    >
                      <p className="text-sm font-semibold text-[#F5F5F7] truncate mb-1">{lead.callerName || lead.nameCollected || 'Inconnu'}</p>
                      <p className="text-[11px] text-[#A1A1A8] mb-2">{lead.callerNumber || ''}</p>
                      <div className="flex items-center justify-between">
                        <SentimentBadge sentiment={lead.sentiment} />
                        {lead.leadScore != null && (
                          <span className="text-[10px] font-bold text-[#493cbe]">{lead.leadScore}/10</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-[#A1A1A8] text-center py-8">Aucun lead</p>
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
                        <div className="h-full bg-[#493cbe] rounded-full"
                          style={{ width: `${selectedLead.leadScore * 10}%` }}
                        />
                      </div>
                      <span className="text-lg font-bold text-[#493cbe]">{selectedLead.leadScore}/10</span>
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
                      const isActive = getLeadStatus(selectedLead) === col.key;
                      const sc = STATUS_STYLES[col.key];
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
                    className="w-full px-4 py-3 text-sm rounded-xl border border-white/[0.07] bg-[#0A0A0F] text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none focus:border-[#493cbe]/50 resize-none transition-colors"
                  />
                  <button
                    onClick={() => handleSaveNote(selectedLead.id)}
                    disabled={savingNote || !noteText.trim()}
                    className="mt-2 px-4 py-2 text-xs font-medium text-white bg-[#493cbe] rounded-xl hover:bg-[#6a4ee0] disabled:opacity-40 transition-colors"
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
