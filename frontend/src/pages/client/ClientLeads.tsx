import { useEffect, useState, useCallback } from 'react';
import { Users, Phone, Mail, MessageSquare, UserCheck, UserX, Star } from 'lucide-react';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';
import SentimentBadge from '../../components/client-dashboard/SentimentBadge';
import Pagination from '../../components/client-dashboard/Pagination';
import EmptyState from '../../components/client-dashboard/EmptyState';
import { formatDateTime } from '../../utils/format';

export default function ClientLeads() {
  const { t } = useLang();
  const [leads, setLeads] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const fetchLeads = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/my-dashboard/leads?page=${page}&limit=20`);
      setLeads(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 });
    } catch (err) {
      console.error('Leads fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(1); }, [fetchLeads]);

  const handleSaveNote = async (leadId: string) => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.put(`/my-dashboard/leads/${leadId}/notes`, { notes: noteText });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: noteText } : l));
      setNoteText('');
    } catch (err) {
      console.error('Save note error', err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleStatusChange = async (leadId: string, status: string) => {
    try {
      await api.put(`/my-dashboard/leads/${leadId}/status`, { status });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, leadStatus: status } : l));
    } catch (err) {
      console.error('Status change error', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">{t('cdash.leads.title')}</h1>

      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('cdash.leads.empty')}
          description={t('cdash.leads.emptyDesc')}
        />
      ) : (
        <>
          <div className="space-y-3">
            {leads.map((lead: any) => {
              const isExpanded = expandedId === lead.id;
              return (
                <div key={lead.id} className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] overflow-hidden">
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#e8e8ed]/50 transition-colors"
                    onClick={() => { setExpandedId(isExpanded ? null : lead.id); setNoteText(lead.notes || ''); }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Users size={16} className="text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {lead.callerName || lead.nameCollected || t('cdash.calls.unknown')}
                        </p>
                        <p className="text-xs text-[#86868b]">
                          {lead.callerNumber || lead.phoneCollected || ''}
                          {lead.emailCollected && ` · ${lead.emailCollected}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <SentimentBadge sentiment={lead.sentiment} />
                      {lead.leadScore != null && (
                        <div className="hidden sm:flex items-center gap-1.5">
                          <Star size={13} className="text-[#6366f1]" />
                          <span className="text-xs font-semibold text-[#6366f1]">{lead.leadScore}/10</span>
                        </div>
                      )}
                      <span className="text-xs text-[#86868b] hidden md:inline">{formatDateTime(lead.createdAt)}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-[#d2d2d7]/40 space-y-4">
                      {/* Contact info */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        {(lead.callerNumber || lead.phoneCollected) && (
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-[#86868b]" />
                            <span>{lead.callerNumber || lead.phoneCollected}</span>
                          </div>
                        )}
                        {lead.emailCollected && (
                          <div className="flex items-center gap-2">
                            <Mail size={14} className="text-[#86868b]" />
                            <span>{lead.emailCollected}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Star size={14} className="text-[#86868b]" />
                          <span>{t('cdash.leads.score')}: {lead.leadScore || '-'}/10</span>
                        </div>
                      </div>

                      {/* Lead score bar */}
                      {lead.leadScore != null && (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2.5 bg-[#d2d2d7]/30 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#6366f1] rounded-full transition-all"
                              style={{ width: `${Math.min(lead.leadScore * 10, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Summary */}
                      {lead.summary && (
                        <p className="text-sm text-[#1d1d1f]/80">{lead.summary}</p>
                      )}

                      {/* Status actions */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#86868b] mr-1">{t('cdash.leads.status')}:</span>
                        <button
                          onClick={() => handleStatusChange(lead.id, 'contacted')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                            lead.leadStatus === 'contacted' ? 'bg-indigo-100 text-indigo-700' : 'text-[#86868b] hover:bg-[#e8e8ed]'
                          }`}
                        >
                          <MessageSquare size={12} /> {t('cdash.leads.markContacted')}
                        </button>
                        <button
                          onClick={() => handleStatusChange(lead.id, 'converted')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                            lead.leadStatus === 'converted' ? 'bg-emerald-100 text-emerald-700' : 'text-[#86868b] hover:bg-[#e8e8ed]'
                          }`}
                        >
                          <UserCheck size={12} /> {t('cdash.leads.markConverted')}
                        </button>
                        <button
                          onClick={() => handleStatusChange(lead.id, 'lost')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                            lead.leadStatus === 'lost' ? 'bg-red-100 text-red-700' : 'text-[#86868b] hover:bg-[#e8e8ed]'
                          }`}
                        >
                          <UserX size={12} /> {t('cdash.leads.markLost')}
                        </button>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="text-xs text-[#86868b] mb-1 block">{t('cdash.leads.notes')}</label>
                        <textarea
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          placeholder={t('cdash.leads.addNote')}
                          rows={2}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 resize-none"
                        />
                        <button
                          onClick={() => handleSaveNote(lead.id)}
                          disabled={savingNote || !noteText.trim()}
                          className="mt-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#6366f1] rounded-lg hover:bg-[#4f46e5] disabled:opacity-40 transition-colors"
                        >
                          {savingNote ? '...' : t('cdash.leads.saveNote')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={(p) => fetchLeads(p)}
              label={t('cdash.nav.leads').toLowerCase()}
            />
          </div>
        </>
      )}
    </div>
  );
}
