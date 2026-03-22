import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Plus, X, Phone, Mail, Tag, Star, Trash2,
  Download, ChevronLeft, ChevronRight, Filter, CheckSquare,
  Square, MoreHorizontal, Edit2
} from 'lucide-react';

type ContactStatus = 'active' | 'prospect' | 'client' | 'inactive' | 'lost';

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

const STATUS_COLORS: Record<ContactStatus, { bg: string; text: string }> = {
  active:   { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  prospect: { bg: 'bg-blue-50',    text: 'text-blue-700' },
  client:   { bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  inactive: { bg: 'bg-gray-100',   text: 'text-gray-600' },
  lost:     { bg: 'bg-red-50',     text: 'text-red-700' },
};

function scoreColor(score: number) {
  if (score >= 8) return 'text-emerald-600 bg-emerald-50';
  if (score >= 5) return 'text-amber-600 bg-amber-50';
  return 'text-red-500 bg-red-50';
}

const DEMO_CONTACTS: Contact[] = [
  { id: '1', name: 'Sarah Mitchell', email: 'sarah@brighthomerealty.com', phone: '+1 (555) 201-4892', status: 'client', leadScore: 9, tags: ['VIP', 'Real Estate'], lastActivity: '2 hours ago', company: 'Bright Home Realty' },
  { id: '2', name: 'James Kowalski', email: 'james.k@automax.net', phone: '+1 (555) 384-7120', status: 'prospect', leadScore: 7, tags: ['Auto', 'Hot Lead'], lastActivity: '5 hours ago', company: 'AutoMax' },
  { id: '3', name: 'Priya Nair', email: 'priya@zenithlaw.com', phone: '+1 (555) 910-3345', status: 'active', leadScore: 8, tags: ['Legal', 'Follow-up'], lastActivity: 'Yesterday', company: 'Zenith Law Group' },
  { id: '4', name: 'Marcus Williams', email: 'mwilliams@plumbpro.co', phone: '+1 (555) 762-0088', status: 'prospect', leadScore: 5, tags: ['Plumbing', 'New'], lastActivity: '2 days ago', company: 'PlumbPro' },
  { id: '5', name: 'Chloe Dubois', email: 'chloe@spaelite.fr', phone: '+1 (555) 448-5571', status: 'inactive', leadScore: 3, tags: ['Spa', 'Cold'], lastActivity: '1 week ago', company: 'Spa Elite' },
  { id: '6', name: 'Derek Fontaine', email: 'derek@sunrisedental.com', phone: '+1 (555) 593-2214', status: 'client', leadScore: 10, tags: ['Dental', 'VIP'], lastActivity: '3 hours ago', company: 'Sunrise Dental' },
  { id: '7', name: 'Amara Osei', email: 'amara@fitlifegym.io', phone: '+1 (555) 867-4430', status: 'active', leadScore: 6, tags: ['Fitness', 'Warm'], lastActivity: '4 days ago', company: 'FitLife Gym' },
  { id: '8', name: 'Tom Harrington', email: 'tom@valleyinsurance.com', phone: '+1 (555) 321-9987', status: 'lost', leadScore: 2, tags: ['Insurance', 'Lost'], lastActivity: '2 weeks ago', company: 'Valley Insurance' },
  { id: '9', name: 'Linda Park', email: 'linda@parkaccounting.com', phone: '+1 (555) 174-6603', status: 'prospect', leadScore: 7, tags: ['Accounting', 'Follow-up'], lastActivity: '1 day ago', company: 'Park Accounting' },
  { id: '10', name: 'Ryan Castillo', email: 'ryan@rcroofing.com', phone: '+1 (555) 509-8832', status: 'active', leadScore: 8, tags: ['Roofing', 'Hot Lead'], lastActivity: '6 hours ago', company: 'RC Roofing' },
];

const ALL_TAGS = ['VIP', 'Hot Lead', 'Follow-up', 'New', 'Cold', 'Warm', 'Lost', 'Real Estate', 'Legal', 'Dental', 'Fitness', 'Auto'];
const PAGE_SIZE = 6;

export default function CrmContacts() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | ''>('');
  const [tagFilter, setTagFilter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>(DEMO_CONTACTS);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', company: '', status: 'prospect' as ContactStatus });

  const filtered = contacts.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
    }
    if (statusFilter && c.status !== statusFilter) return false;
    if (tagFilter && !c.tags.includes(tagFilter)) return false;
    if (minScore && c.leadScore < parseInt(minScore)) return false;
    if (maxScore && c.leadScore > parseInt(maxScore)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === paginated.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginated.map(c => c.id)));
    }
  };

  const handleDelete = () => {
    setContacts(prev => prev.filter(c => !selected.has(c.id)));
    setSelected(new Set());
  };

  const handleAddContact = () => {
    if (!newContact.name) return;
    const c: Contact = {
      id: Date.now().toString(),
      name: newContact.name,
      email: newContact.email,
      phone: newContact.phone,
      company: newContact.company,
      status: newContact.status,
      leadScore: 5,
      tags: ['New'],
      lastActivity: 'Just now',
    };
    setContacts(prev => [c, ...prev]);
    setNewContact({ name: '', email: '', phone: '', company: '', status: 'prospect' });
    setShowAddModal(false);
  };

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM Contacts</h1>
          <p className="text-sm text-[#86868b]">{contacts.length} contacts in your pipeline</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#6366f1] text-white text-sm font-medium rounded-xl hover:bg-[#4f46e5] transition-colors"
        >
          <Plus size={16} /> Add Contact
        </button>
      </motion.div>

      {/* Stat pills */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {(['', 'active', 'prospect', 'client', 'lost'] as const).map((s, i) => {
          const labels = ['All', 'Active', 'Prospect', 'Client', 'Lost'];
          const counts = [contacts.length, ...(['active','prospect','client','lost'] as ContactStatus[]).map(st => contacts.filter(c => c.status === st).length)];
          const colors = ['#1d1d1f', '#10b981', '#3b82f6', '#6366f1', '#ef4444'];
          return (
            <button key={i} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-xl p-3 text-center transition-all border ${
                statusFilter === s ? 'border-[#6366f1]/30 bg-[#6366f1]/5' : 'border-[#d2d2d7]/60 bg-white hover:bg-[#f5f5f7]'
              }`}
            >
              <p className="text-xl font-bold" style={{ color: colors[i] }}>{counts[i]}</p>
              <p className="text-[10px] text-[#86868b] font-medium">{labels[i]}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" />
          <input
            type="text" placeholder="Search contacts..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
          className="px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 text-[#1d1d1f]">
          <option value="">All Statuses</option>
          {(['active','prospect','client','inactive','lost'] as ContactStatus[]).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select value={tagFilter} onChange={e => { setTagFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 text-[#1d1d1f]">
          <option value="">All Tags</option>
          {ALL_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-[#86868b]" />
          <input type="number" placeholder="Min score" min={1} max={10} value={minScore}
            onChange={e => { setMinScore(e.target.value); setPage(1); }}
            className="w-20 px-2 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
          />
          <span className="text-[#86868b] text-sm">–</span>
          <input type="number" placeholder="Max score" min={1} max={10} value={maxScore}
            onChange={e => { setMaxScore(e.target.value); setPage(1); }}
            className="w-20 px-2 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
          />
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-4 px-4 py-3 bg-[#6366f1]/5 border border-[#6366f1]/20 rounded-xl">
          <span className="text-sm font-medium text-[#6366f1]">{selected.size} selected</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-colors">
            <Tag size={12} /> Tag
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-colors">
            <Download size={12} /> Export
          </button>
          <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors">
            <Trash2 size={12} /> Delete
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[#86868b] hover:text-[#1d1d1f]">
            <X size={14} />
          </button>
        </motion.div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white overflow-hidden mb-4">
        {/* Table header */}
        <div className="grid grid-cols-[2rem_2fr_1.5fr_1.2fr_1fr_1.2fr_1.5fr_1fr_2rem] items-center gap-3 px-5 py-3 border-b border-[#f5f5f7] bg-[#fafafa]">
          <button onClick={toggleAll} className="text-[#86868b] hover:text-[#6366f1]">
            {selected.size === paginated.length && paginated.length > 0
              ? <CheckSquare size={15} className="text-[#6366f1]" />
              : <Square size={15} />
            }
          </button>
          {['Name', 'Email', 'Phone', 'Status', 'Score', 'Tags', 'Last Activity', ''].map((h, i) => (
            <span key={i} className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {/* Rows */}
        {paginated.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={36} className="mx-auto text-[#d2d2d7] mb-3" />
            <p className="text-sm text-[#86868b]">No contacts match your filters</p>
          </div>
        ) : (
          paginated.map((c, idx) => {
            const sc = STATUS_COLORS[c.status];
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                className="grid grid-cols-[2rem_2fr_1.5fr_1.2fr_1fr_1.2fr_1.5fr_1fr_2rem] items-center gap-3 px-5 py-3.5 border-b border-[#f5f5f7] last:border-0 hover:bg-[#fafafa] transition-colors group">
                <button onClick={() => toggleSelect(c.id)} className="text-[#86868b] hover:text-[#6366f1]">
                  {selected.has(c.id)
                    ? <CheckSquare size={15} className="text-[#6366f1]" />
                    : <Square size={15} />
                  }
                </button>
                <div>
                  <p className="text-sm font-semibold text-[#1d1d1f] truncate">{c.name}</p>
                  {c.company && <p className="text-[11px] text-[#86868b] truncate">{c.company}</p>}
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Mail size={12} className="text-[#86868b] flex-shrink-0" />
                  <span className="text-[12px] text-[#1d1d1f] truncate">{c.email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone size={12} className="text-[#86868b] flex-shrink-0" />
                  <span className="text-[12px] text-[#1d1d1f]">{c.phone}</span>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full w-fit ${sc.bg} ${sc.text}`}>
                  {c.status.toUpperCase()}
                </span>
                <div className="flex items-center gap-1.5">
                  <Star size={12} className="text-[#6366f1]" />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${scoreColor(c.leadScore)}`}>
                    {c.leadScore}/10
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.tags.slice(0, 2).map(t => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#f5f5f7] text-[#86868b] font-medium">{t}</span>
                  ))}
                  {c.tags.length > 2 && <span className="text-[10px] text-[#86868b]">+{c.tags.length - 2}</span>}
                </div>
                <span className="text-[11px] text-[#86868b]">{c.lastActivity}</span>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity text-[#86868b] hover:text-[#6366f1]">
                  <MoreHorizontal size={15} />
                </button>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#86868b]">
          Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} contacts
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#d2d2d7]/60 bg-white disabled:opacity-40 hover:bg-[#f5f5f7] transition-colors">
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-xs font-medium border transition-colors ${
                page === p ? 'bg-[#6366f1] text-white border-[#6366f1]' : 'border-[#d2d2d7]/60 bg-white hover:bg-[#f5f5f7] text-[#1d1d1f]'
              }`}
            >{p}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#d2d2d7]/60 bg-white disabled:opacity-40 hover:bg-[#f5f5f7] transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Add Contact Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
              onClick={() => setShowAddModal(false)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-semibold">Add Contact</h2>
                  <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'Jane Smith' },
                    { label: 'Email', key: 'email', type: 'email', placeholder: 'jane@example.com' },
                    { label: 'Phone', key: 'phone', type: 'tel', placeholder: '+1 (555) 000-0000' },
                    { label: 'Company', key: 'company', type: 'text', placeholder: 'Acme Corp' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-medium text-[#86868b] mb-1 block">{f.label}</label>
                      <input type={f.type} placeholder={f.placeholder}
                        value={(newContact as any)[f.key]}
                        onChange={e => setNewContact(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-medium text-[#86868b] mb-1 block">Status</label>
                    <select value={newContact.status} onChange={e => setNewContact(p => ({ ...p, status: e.target.value as ContactStatus }))}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 bg-white">
                      {(['active','prospect','client','inactive','lost'] as ContactStatus[]).map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleAddContact}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] transition-colors">
                    Add Contact
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
