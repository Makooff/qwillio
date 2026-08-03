import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckSquare, ChevronLeft, ChevronRight, Download, Filter, Mail, Phone,
  Plus, Search, Square, Tag, Trash2, Users, X,
} from 'lucide-react';
import api from '../../../services/api';
import {
  Card, DangerBtn, EmptyState, Field, GhostBtn, Input, PageActions, Pill,
  PrimaryBtn, Select, tableCls,
} from '../../../components/v2/app/Blocks';

/* CRM Contacts, registre produit V2 (DA/v2-direction.md, addendum).
   Logique de données identique à la V1: GET /crm/contacts (page, limit,
   search, status, tag), POST /crm/contacts, DELETE /crm/contacts/:id. */

type ContactStatus = 'active' | 'prospect' | 'client' | 'inactive' | 'lost';
type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: ContactStatus;
  leadScore: number;
  tags: string[];
  lastActivity: string;
  company?: string;
}

interface RawContact {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  leadScore?: number;
  tags?: string[];
  updatedAt?: string;
  niche?: string;
}

interface NewContactState {
  name: string;
  email: string;
  phone: string;
  company: string;
  status: ContactStatus;
}

type NewContactField = keyof Omit<NewContactState, 'status'>;

const STATUS_TONES: Record<ContactStatus, Tone> = {
  active: 'ok',
  prospect: 'info',
  client: 'accent',
  inactive: 'neutral',
  lost: 'bad',
};

function scoreTone(score: number): Tone {
  if (score >= 8) return 'ok';
  if (score >= 5) return 'warn';
  return 'bad';
}

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const ALL_TAGS = ['VIP', 'Hot Lead', 'Follow-up', 'New', 'Cold', 'Warm', 'Lost', 'Real Estate', 'Legal', 'Dental', 'Fitness', 'Auto'];
const PAGE_SIZE = 6;
const STATUSES: ContactStatus[] = ['active', 'prospect', 'client', 'inactive', 'lost'];

const FIELD_CONFIGS: Array<{ label: string; key: NewContactField; type: string; placeholder: string }> = [
  { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'Jane Smith' },
  { label: 'Email', key: 'email', type: 'email', placeholder: 'jane@example.com' },
  { label: 'Phone', key: 'phone', type: 'tel', placeholder: '+1 (555) 000-0000' },
  { label: 'Company', key: 'company', type: 'text', placeholder: 'Acme Corp' },
];

function StatusPill({ status }: { status: ContactStatus }) {
  return <Pill tone={STATUS_TONES[status] || 'neutral'}>{status.toUpperCase()}</Pill>;
}

export default function CrmContacts() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | ''>('');
  const [tagFilter, setTagFilter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [newContact, setNewContact] = useState<NewContactState>({
    name: '', email: '', phone: '', company: '', status: 'prospect',
  });

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (tagFilter) params.tag = tagFilter;
      const { data } = await api.get('/crm/contacts', { params });
      const mapped = (data.contacts || []).map((c: RawContact): Contact => ({
        id: c.id,
        name: c.name || 'Unknown',
        email: c.email || '',
        phone: c.phone || '',
        status: (c.status || 'prospect') as ContactStatus,
        leadScore: c.leadScore ?? 0,
        tags: c.tags || [],
        lastActivity: timeAgo(c.updatedAt),
        company: c.niche || '',
      }));
      setContacts(mapped);
      setTotal(data.pagination?.total || mapped.length);
    } catch {
      /* contacts indisponibles: la liste courante est conservée */
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tagFilter]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  useEffect(() => {
    if (!showAddPanel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAddPanel(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAddPanel]);

  const filtered = contacts.filter((c) => {
    if (minScore && c.leadScore < parseInt(minScore)) return false;
    if (maxScore && c.leadScore > parseInt(maxScore)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  const handleDelete = async () => {
    for (const id of selected) {
      try { await api.delete(`/crm/contacts/${id}`); } catch { /* suppression ignorée */ }
    }
    setSelected(new Set());
    fetchContacts();
  };

  const handleAddContact = async () => {
    if (!newContact.name) return;
    try {
      await api.post('/crm/contacts', {
        name: newContact.name,
        email: newContact.email,
        phone: newContact.phone,
        niche: newContact.company,
        status: newContact.status,
        tags: ['New'],
      });
      setNewContact({ name: '', email: '', phone: '', company: '', status: 'prospect' });
      setShowAddPanel(false);
      fetchContacts();
    } catch { /* création ignorée */ }
  };

  const segments: { key: ContactStatus | ''; label: string; count: number }[] = [
    { key: '', label: 'All', count: total },
    ...STATUSES.map((s) => ({
      key: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
      count: contacts.filter((c) => c.status === s).length,
    })),
  ];

  const pageBtn =
    'w-8 h-8 rounded-lg flex items-center justify-center text-[12px] text-q2-fog border border-q2-graphite-d hover:text-q2-mist hover:border-q2-smoke-d transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50';

  return (
    <div>
      <PageActions subtitle={`${total.toLocaleString('en-US')} contacts in your pipeline`}>
        <div className="relative w-[190px] sm:w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-q2-fog" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search contacts..."
            aria-label="Search contacts"
            className="pl-9 !py-[7px]"
          />
        </div>
        <PrimaryBtn type="button" onClick={() => setShowAddPanel(true)}>
          <Plus size={14} aria-hidden="true" /> Add Contact
        </PrimaryBtn>
      </PageActions>

      {/* Filtre de statut segmenté */}
      <div
        role="group"
        aria-label="Filter by status"
        className="inline-flex flex-wrap items-center gap-1 rounded-full bg-q2-obsidian border border-q2-graphite-d p-1 mb-4"
      >
        {segments.map((s) => (
          <button
            key={s.key || 'all'}
            type="button"
            onClick={() => { setStatusFilter(s.key); setPage(1); }}
            aria-pressed={statusFilter === s.key}
            className={`h-7 pl-3 pr-2.5 rounded-full text-[12px] font-medium inline-flex items-center gap-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
              statusFilter === s.key ? 'bg-q2-indigo text-white' : 'text-q2-fog hover:text-q2-mist'
            }`}
          >
            {s.label}
            <span className={`tabular-nums text-[11.5px] ${statusFilter === s.key ? 'text-white/70' : 'text-q2-mist'}`}>
              {s.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filtres secondaires */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select
          value={tagFilter}
          onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
          aria-label="Filter by tag"
          className="!w-auto !py-[7px]"
        >
          <option value="">All Tags</option>
          {ALL_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-q2-fog" aria-hidden="true" />
          <Input
            type="number" placeholder="Min" min={1} max={10} value={minScore}
            aria-label="Minimum lead score"
            onChange={(e) => { setMinScore(e.target.value); setPage(1); }}
            className="!w-[74px] !py-[7px] tabular-nums"
          />
          <span className="text-q2-fog text-[12px]">-</span>
          <Input
            type="number" placeholder="Max" min={1} max={10} value={maxScore}
            aria-label="Maximum lead score"
            onChange={(e) => { setMaxScore(e.target.value); setPage(1); }}
            className="!w-[74px] !py-[7px] tabular-nums"
          />
        </div>
      </div>

      {/* Actions groupées */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 px-4 py-3 rounded-xl border border-q2-graphite-d bg-q2-obsidian">
          <span className="text-[12.5px] font-medium text-white tabular-nums mr-1">{selected.size} selected</span>
          <GhostBtn type="button" className="h-8">
            <Tag size={12} aria-hidden="true" /> Tag
          </GhostBtn>
          <GhostBtn type="button" className="h-8">
            <Download size={12} aria-hidden="true" /> Export
          </GhostBtn>
          <DangerBtn type="button" onClick={handleDelete} className="h-8">
            <Trash2 size={12} aria-hidden="true" /> Delete
          </DangerBtn>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-q2-fog hover:text-q2-mist transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      <Card pad={false}>
        {loading ? (
          <div role="status" aria-busy="true" aria-label="Loading contacts" className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-44 rounded bg-q2-obsidian animate-pulse" />
                <div className="h-3 w-20 rounded bg-q2-obsidian animate-pulse ml-auto" />
                <div className="h-3 w-24 rounded bg-q2-obsidian animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No contacts match your filters" />
        ) : (
          <>
            {/* Desktop */}
            <div className={`hidden md:block ${tableCls.wrap}`}>
              <table className={tableCls.table}>
                <thead>
                  <tr>
                    <th scope="col" className={`${tableCls.th} w-9`}>
                      <button
                        type="button"
                        onClick={toggleAll}
                        aria-label="Select all contacts"
                        className="text-q2-fog hover:text-q2-mist transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded"
                      >
                        {selected.size === filtered.length && filtered.length > 0
                          ? <CheckSquare size={15} className="text-q2-lift" aria-hidden="true" />
                          : <Square size={15} aria-hidden="true" />}
                      </button>
                    </th>
                    <th scope="col" className={tableCls.th}>Name</th>
                    <th scope="col" className={tableCls.th}>Email</th>
                    <th scope="col" className={tableCls.th}>Phone</th>
                    <th scope="col" className={tableCls.th}>Status</th>
                    <th scope="col" className={tableCls.th}>Score</th>
                    <th scope="col" className={tableCls.th}>Tags</th>
                    <th scope="col" className={tableCls.th}>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className={tableCls.tr}>
                      <td className={tableCls.td}>
                        <button
                          type="button"
                          onClick={() => toggleSelect(c.id)}
                          aria-label={`Select ${c.name}`}
                          aria-pressed={selected.has(c.id)}
                          className="text-q2-fog hover:text-q2-mist transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded"
                        >
                          {selected.has(c.id)
                            ? <CheckSquare size={15} className="text-q2-lift" aria-hidden="true" />
                            : <Square size={15} aria-hidden="true" />}
                        </button>
                      </td>
                      <td className={tableCls.td}>
                        <span className="block text-white truncate max-w-[200px]">{c.name}</span>
                        {c.company && <span className="block text-[11.5px] text-q2-fog mt-0.5 truncate max-w-[200px]">{c.company}</span>}
                      </td>
                      <td className={tableCls.td}>
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <Mail size={12} className="text-q2-fog shrink-0" aria-hidden="true" />
                          <span className="truncate max-w-[170px]">{c.email || '-'}</span>
                        </span>
                      </td>
                      <td className={tableCls.td}>
                        <span className="inline-flex items-center gap-1.5">
                          <Phone size={12} className="text-q2-fog shrink-0" aria-hidden="true" />
                          {c.phone || '-'}
                        </span>
                      </td>
                      <td className={tableCls.td}><StatusPill status={c.status} /></td>
                      <td className={tableCls.td}>
                        <Pill tone={scoreTone(c.leadScore)}>{c.leadScore}/10</Pill>
                      </td>
                      <td className={tableCls.td}>
                        <span className="inline-flex flex-wrap gap-1">
                          {(c.tags || []).slice(0, 2).map((t) => (
                            <span key={t} className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-q2-obsidian text-q2-fog font-medium">{t}</span>
                          ))}
                          {(c.tags || []).length > 2 && <span className="text-[10.5px] text-q2-fog">+{c.tags.length - 2}</span>}
                        </span>
                      </td>
                      <td className={`${tableCls.td} text-q2-fog whitespace-nowrap`}>{c.lastActivity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <ul className="md:hidden">
              {filtered.map((c) => (
                <li key={c.id} className="border-b border-q2-graphite-d last:border-b-0 px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13.5px] font-medium text-white truncate">{c.name}</span>
                    <StatusPill status={c.status} />
                  </div>
                  <p className="text-[11.5px] text-q2-fog mt-1 tabular-nums truncate">
                    {c.phone || c.email || '-'}
                    {` · ${c.leadScore}/10 · ${c.lastActivity}`}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Pagination */}
        <nav aria-label="Pagination" className="flex items-center justify-between gap-4 px-4 py-3 border-t border-q2-graphite-d">
          <p className="text-[11.5px] text-q2-fog tabular-nums">
            Page {page} of {totalPages} ({total} contacts)
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              className={pageBtn}
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                aria-current={page === p ? 'page' : undefined}
                className={`${pageBtn} tabular-nums ${page === p ? 'bg-q2-indigo text-white border-q2-indigo' : ''}`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
              className={pageBtn}
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </nav>
      </Card>

      {/* Panneau latéral: ajout de contact */}
      <AnimatePresence>
        {showAddPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setShowAddPanel(false)}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-q2-void/70"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
              aria-label="Add Contact"
              className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-q2-carbon border-l border-q2-graphite-d overflow-y-auto"
            >
              <header className="sticky top-0 bg-q2-carbon border-b border-q2-graphite-d px-5 h-14 flex items-center justify-between gap-3">
                <p className="text-[14px] font-medium text-white">Add Contact</p>
                <button
                  type="button"
                  onClick={() => setShowAddPanel(false)}
                  aria-label="Close panel"
                  className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-q2-fog hover:text-white hover:bg-q2-obsidian transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </header>

              <div className="p-5 space-y-4">
                {FIELD_CONFIGS.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <Input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={newContact[f.key]}
                      onChange={(e) => setNewContact((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  </Field>
                ))}
                <Field label="Status">
                  <Select
                    value={newContact.status}
                    onChange={(e) => setNewContact((p) => ({ ...p, status: e.target.value as ContactStatus }))}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </Select>
                </Field>

                <div className="flex items-center gap-2 pt-1">
                  <PrimaryBtn type="button" onClick={handleAddContact} disabled={!newContact.name}>
                    Add Contact
                  </PrimaryBtn>
                  <GhostBtn type="button" onClick={() => setShowAddPanel(false)}>Cancel</GhostBtn>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
