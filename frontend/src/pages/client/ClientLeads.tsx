import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Phone, Mail, MessageSquare, UserCheck, UserX, Star,
  List, Columns3, Search, X, ChevronRight, Plus, StickyNote
} from 'lucide-react';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';
import SentimentBadge from '../../components/client-dashboard/SentimentBadge';
import Pagination from '../../components/client-dashboard/Pagination';
import EmptyState from '../../components/client-dashboard/EmptyState';
import { formatDateTime } from '../../utils/format';

type ViewMode = 'table' | 'kanban';
type LeadStatus = '' | 'new' | 'contacted' | 'converted' | 'lost';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  new: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  contacted: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  converted: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  lost: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

const KANBAN_COLS: { key: string; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: '#3b82f6' },
  { key: 'contacted', label: 'Contacted', color: '#6366f1' },
  { key: 'converted', label: 'Converted', color: '#10b981' },
  { key: 'lost', label: 'Lost', color: '#ef4444' },
];

export default function ClientLeads() {
  const { t } = useLang();
  const [leads, setLeads] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus>('');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const fetchLeads = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/my-dashboard/leads?page=${page}&limit=50`);
      setLeads(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 0 });
    } catch (err) {
      console.error('Leads fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(1); }, [fetchLeads]);

  const handleStatusChange = async (leadId: string, status: string) => {
    try {
      await api.put(`/my-dashboard/leads/${leadId}/status`, { status });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, leadStatus: status } : l));
      if (selectedLead?.id === leadId) setSelectedLead((p: any) => ({ ...p, leadStatus: status }));
    } catch (err) {
      console.error('Status change error', err);
    }
  };

  const handleSaveNote = async (leadId: string) => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.put(`/my-dashboard/leads/${leadId}/notes`, { notes: noteText });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: noteText } : l));
      if (selectedLead?.id === leadId) setSelectedLead((p: any) => ({ ...p, notes: noteText }));
    } catch (err) {
      console.error('Save note error', err);
    } finally {
      setSavingNote(false);
    }
  };

  const getLeadStatus = (lead: any): string => {
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
          !(l.emailCollected || '').toLowerCase().includes(q))
        return false;
    }
    if (statusFilter && getLeadStatus(l) !== statusFilter) return false;
    return true;
  });

  // Stats
  const statCounts = {
    total: leads.length,
    new: leads.filter(l => getLeadStatus(l) === 'new').length,
    contacted: leads.filter(l => getLeadStatus(l) === 'contacted').length,
    converted: leads.filter(l => getLeadStatus(l) === 'converted').length,
    lost: leads.filter(l => getLeadStatus(l) === 'lost').length,
  };

  const kanbanLeads = (status: string) => filteredLeads.filter(l => getLeadStatus(l) === status);

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-[#86868b]">{pagination.total} qualified leads</p>
        </div>
        <div className="flex items-center gap-1 bg-[#f5f5f7] rounded-xl p-1">
          <button onClick={() => setView('table')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${view === 'table' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b]'}`}
          >
            <List size={14} />
          </button>
          <button onClick={() => setView('kanban')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${view === 'kanban' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b]'}`}
          >
            <Columns3 size={14} />
          </button>
        </div>
      </motion.div>

      {/* Stats pipeline */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {[
          { label: 'Total', value: statCounts.total, color: '#1d1d1f' },
          { label: 'New', value: statCounts.new, color: '#3b82f6' },
          { label: 'Contacted', value: statCounts.contacted, color: '#6366f1' },
          { label: 'Converted', value: statCounts.converted, color: '#10b981' },
          { label: 'Lost', value: statCounts.lost, color: '#ef4444' },
        ].map((s, i) => (
          <button key={i} onClick={() => setStatusFilter(i === 0 ? '' : s.label.toLowerCase() as LeadStatus)}
            className={`rounded-xl p-3 text-center transition-all border ${
              (i === 0 && !statusFilter) || statusFilter === s.label.toLowerCase()
                ? 'border-[#6366f1]/30 bg-[#6366f1]/5'
                : 'border-[#d2d2d7]/60 bg-white hover:bg-[#f5f5f7]'
            }`}
          >
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-[#86868b] font-medium">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" />
        <input
          type="text"
          placeholder="Search leads..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <EmptyState icon={Users} title="No leads found" description="Leads will appear once your AI qualifies callers" />
      ) : view === 'table' ? (
        /* ── TABLE VIEW ── */
        <>
          <div className="space-y-1.5">
            {filteredLeads.map((lead: any, idx: number) => {
              const status = getLeadStatus(lead);
              const sc = STATUS_COLORS[status] || STATUS_COLORS.new;
              return (
                <motion.div key={lead.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                  className="rounded-2xl border border-[#d2d2d7]/60 bg-white overflow-hidden hover:shadow-sm hover:border-[#d2d2d7] transition-all cursor-pointer group"
                  onClick={() => { setSelectedLead(lead); setNoteText(lead.notes || ''); }}
                >
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Users size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{lead.callerName || lead.nameCollected || 'Unknown'}</p>
                      <p className="text-[11px] text-[#86868b]">
                        {lead.callerNumber || lead.phoneCollected || ''}
                        {lead.emailCollected && ` · ${lead.emailCollected}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                        {status.toUpperCase()}
                      </span>
                      {lead.leadScore != null && (
                        <div className="hidden sm:flex items-center gap-1">
                          <Star size={12} className="text-[#6366f1]" />
                          <span className="text-xs font-bold text-[#6366f1]">{lead.leadScore}/10</span>
                        </div>
                      )}
                      <SentimentBadge sentiment={lead.sentiment} />
                      <span className="text-[10px] text-[#86868b] hidden lg:inline">{formatDateTime(lead.createdAt)}</span>
                      <ChevronRight size={14} className="text-[#d2d2d7] group-hover:text-[#6366f1] transition-colors" />
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
        /* ── KANBAN VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto">
          {KANBAN_COLS.map(col => {
            const items = kanbanLeads(col.key);
            return (
              <div key={col.key} className="min-w-[250px]">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px] rounded-2xl bg-[#f5f5f7]/50 p-2">
                  {items.map(lead => (
                    <motion.div key={lead.id} layout
                      className="rounded-xl bg-white border border-[#d2d2d7]/60 p-3.5 cursor-pointer hover:shadow-sm transition-all"
                      onClick={() => { setSelectedLead(lead); setNoteText(lead.notes || ''); }}
                    >
                      <p className="text-sm font-semibold truncate mb-1">{lead.callerName || lead.nameCollected || 'Unknown'}</p>
                      <p className="text-[11px] text-[#86868b] mb-2">{lead.callerNumber || ''}</p>
                      <div className="flex items-center justify-between">
                        <SentimentBadge sentiment={lead.sentiment} />
                        {lead.leadScore != null && (
                          <span className="text-[10px] font-bold text-[#6366f1]">{lead.leadScore}/10</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-[#86868b] text-center py-8">No leads</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Lead detail slide-over ── */}
      <AnimatePresence>
        {selectedLead && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-50" onClick={() => setSelectedLead(null)}
            />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]/60 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Lead details</h2>
                <button onClick={() => setSelectedLead(null)} className="w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]">
                  <X size={16} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {/* Name & info */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                    <Users size={24} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{selectedLead.callerName || selectedLead.nameCollected || 'Unknown'}</p>
                    <p className="text-sm text-[#86868b]">{formatDateTime(selectedLead.createdAt)}</p>
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-2">
                  {(selectedLead.callerNumber || selectedLead.phoneCollected) && (
                    <div className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] px-4 py-3">
                      <Phone size={14} className="text-[#86868b]" />
                      <span className="text-sm">{selectedLead.callerNumber || selectedLead.phoneCollected}</span>
                    </div>
                  )}
                  {selectedLead.emailCollected && (
                    <div className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] px-4 py-3">
                      <Mail size={14} className="text-[#86868b]" />
                      <span className="text-sm">{selectedLead.emailCollected}</span>
                    </div>
                  )}
                </div>

                {/* Lead score */}
                {selectedLead.leadScore != null && (
                  <div>
                    <p className="text-xs text-[#86868b] mb-1">Lead score</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 bg-[#f5f5f7] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-full transition-all"
                          style={{ width: `${selectedLead.leadScore * 10}%` }}
                        />
                      </div>
                      <span className="text-lg font-bold text-[#6366f1]">{selectedLead.leadScore}/10</span>
                    </div>
                  </div>
                )}

                {/* Sentiment */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#86868b]">Sentiment:</span>
                  <SentimentBadge sentiment={selectedLead.sentiment} />
                </div>

                {/* Status actions */}
                <div>
                  <p className="text-xs text-[#86868b] mb-2">Pipeline status</p>
                  <div className="grid grid-cols-2 gap-2">
                    {KANBAN_COLS.map(col => {
                      const isActive = getLeadStatus(selectedLead) === col.key;
                      const sc = STATUS_COLORS[col.key];
                      return (
                        <button key={col.key} onClick={() => handleStatusChange(selectedLead.id, col.key)}
                          className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                            isActive ? `${sc.bg} ${sc.text} ${sc.border}` : 'bg-white border-[#d2d2d7]/60 text-[#86868b] hover:bg-[#f5f5f7]'
                          }`}
                        >
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Summary */}
                {selectedLead.summary && (
                  <div>
                    <p className="text-xs text-[#86868b] mb-1">Call summary</p>
                    <p className="text-sm text-[#1d1d1f] leading-relaxed bg-[#f5f5f7] rounded-xl p-4">{selectedLead.summary}</p>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <p className="text-xs text-[#86868b] mb-1 flex items-center gap-1">
                    <StickyNote size={12} /> Notes
                  </p>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add notes about this lead..."
                    rows={3}
                    className="w-full px-4 py-3 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 resize-none"
                  />
                  <button
                    onClick={() => handleSaveNote(selectedLead.id)}
                    disabled={savingNote || !noteText.trim()}
                    className="mt-2 px-4 py-2 text-xs font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] disabled:opacity-40 transition-colors"
                  >
                    {savingNote ? 'Saving...' : 'Save note'}
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
