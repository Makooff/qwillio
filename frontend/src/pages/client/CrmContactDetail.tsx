import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, Mail, MapPin, Globe, Star, Edit2, Tag,
  Phone as PhoneIcon, Mail as MailIcon, FileText, TrendingUp, MessageSquare,
  Building2, Calendar, Clock, CheckCircle, AlertCircle, Zap
} from 'lucide-react';

type TabKey = 'overview' | 'calls' | 'emails' | 'deals' | 'notes' | 'timeline';
type ActivityType = 'call' | 'email' | 'note' | 'deal_update' | 'sms';

const DEMO_CONTACTS: Record<string, any> = {
  '1': {
    id: '1', name: 'Sarah Mitchell', email: 'sarah@brighthomerealty.com', phone: '+1 (555) 201-4892',
    status: 'client', leadScore: 9, company: 'Bright Home Realty', tags: ['VIP', 'Real Estate'],
    address: '4820 Oak Street, Phoenix, AZ 85001', website: 'brighthomerealty.com',
    rating: 4.8, createdAt: 'Feb 14, 2026', lastActivity: '2 hours ago',
    suggestedAction: 'Schedule quarterly check-in — Sarah is a top client. Upsell opportunity for analytics add-on.',
    enrichment: { employees: '12–50', industry: 'Real Estate', annualRevenue: '$2.4M', timezone: 'MST' },
    notes: 'Very responsive. Prefers Zoom calls. Referred 2 clients already. VIP treatment always.',
  },
  '2': {
    id: '2', name: 'James Kowalski', email: 'james.k@automax.net', phone: '+1 (555) 384-7120',
    status: 'prospect', leadScore: 7, company: 'AutoMax', tags: ['Auto', 'Hot Lead'],
    address: '901 Commerce Blvd, Dallas, TX 75201', website: 'automax.net',
    rating: 4.2, createdAt: 'Mar 10, 2026', lastActivity: '5 hours ago',
    suggestedAction: 'Follow up by Friday — James is waiting on GM approval. Send a 1-page ROI summary to close.',
    enrichment: { employees: '50–200', industry: 'Automotive Dealerships', annualRevenue: '$8.1M', timezone: 'CST' },
    notes: 'Decision requires GM sign-off. Budget approved. Very interested in the lead qualifier feature.',
  },
};

const FALLBACK_CONTACT = {
  id: '?', name: 'Contact Not Found', email: 'unknown@example.com', phone: 'N/A',
  status: 'prospect', leadScore: 5, company: 'Unknown', tags: [],
  address: '', website: '', rating: 0, createdAt: 'N/A', lastActivity: 'N/A',
  suggestedAction: 'No data available.', enrichment: {}, notes: '',
};

const DEMO_TIMELINE: Record<string, any[]> = {
  '1': [
    { id: 't1', type: 'call',        description: 'Inbound call — discussed renewal. Very happy with the service.', timestamp: '10:32 AM', date: 'Mar 22' },
    { id: 't2', type: 'deal_update', description: 'Renewal deal created: $4,200 for Year 2.', timestamp: '10:45 AM', date: 'Mar 22' },
    { id: 't3', type: 'email',       description: 'Sent renewal proposal with updated pricing.', timestamp: '11:00 AM', date: 'Mar 20' },
    { id: 't4', type: 'note',        description: 'Sarah referred Linda Park. Added to CRM.', timestamp: '2:00 PM', date: 'Mar 18' },
  ],
  '2': [
    { id: 't5', type: 'call',        description: 'Discovery call — 18 min. Strong interest.', timestamp: '3:22 PM', date: 'Mar 21' },
    { id: 't6', type: 'email',       description: 'Sent follow-up proposal email.', timestamp: '8:50 AM', date: 'Mar 22' },
    { id: 't7', type: 'note',        description: 'GM approval expected by end of week.', timestamp: '2:10 PM', date: 'Mar 21' },
  ],
};

const DEMO_DEALS: Record<string, any[]> = {
  '1': [{ id: 'd1', title: 'Realty AI Assistant', value: 4200, stage: 'client', probability: 90, closeDate: 'Mar 28' }],
  '2': [{ id: 'd2', title: 'Auto Dealership Agent', value: 5100, stage: 'appointment', probability: 70, closeDate: 'Apr 5' }],
};

const TYPE_CONFIG: Record<ActivityType, { icon: React.ElementType; bg: string; iconColor: string; label: string }> = {
  call:        { icon: PhoneIcon,    bg: 'bg-blue-50',    iconColor: 'text-blue-500',    label: 'Call' },
  email:       { icon: MailIcon,     bg: 'bg-indigo-50',  iconColor: 'text-indigo-500',  label: 'Email' },
  note:        { icon: FileText,     bg: 'bg-amber-50',   iconColor: 'text-amber-500',   label: 'Note' },
  deal_update: { icon: TrendingUp,   bg: 'bg-emerald-50', iconColor: 'text-emerald-500', label: 'Deal Update' },
  sms:         { icon: MessageSquare,bg: 'bg-purple-50',  iconColor: 'text-purple-500',  label: 'SMS' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:   { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  prospect: { bg: 'bg-blue-50',    text: 'text-blue-700' },
  client:   { bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  inactive: { bg: 'bg-gray-100',   text: 'text-gray-600' },
  lost:     { bg: 'bg-red-50',     text: 'text-red-700' },
};

const STAGE_COLORS: Record<string, string> = {
  new: '#3b82f6', qualified: '#8b5cf6', appointment: '#f59e0b', client: '#10b981', inactive: '#6b7280', lost: '#ef4444',
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',  label: 'Overview' },
  { key: 'calls',     label: 'Calls' },
  { key: 'emails',    label: 'Emails' },
  { key: 'deals',     label: 'Deals' },
  { key: 'notes',     label: 'Notes' },
  { key: 'timeline',  label: 'Timeline' },
];

export default function CrmContactDetail() {
  const { id } = useParams<{ id: string }>();
  const contact = (id && DEMO_CONTACTS[id]) ? DEMO_CONTACTS[id] : { ...FALLBACK_CONTACT, id: id || '?' };
  const timeline = (id && DEMO_TIMELINE[id]) ? DEMO_TIMELINE[id] : [];
  const deals = (id && DEMO_DEALS[id]) ? DEMO_DEALS[id] : [];

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(contact.notes || '');

  const sc = STATUS_COLORS[contact.status] || STATUS_COLORS.prospect;

  function scoreColor(score: number) {
    if (score >= 8) return 'text-emerald-600 bg-emerald-50';
    if (score >= 5) return 'text-amber-600 bg-amber-50';
    return 'text-red-500 bg-red-50';
  }

  return (
    <div>
      {/* Back link */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-5">
        <Link to="/dashboard/crm" className="inline-flex items-center gap-1.5 text-sm text-[#86868b] hover:text-[#6366f1] transition-colors">
          <ArrowLeft size={14} /> Back to Contacts
        </Link>
      </motion.div>

      {/* Contact header card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-bold">{contact.name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">{contact.name}</h1>
              {contact.company && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building2 size={13} className="text-[#86868b]" />
                  <span className="text-sm text-[#86868b]">{contact.company}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                  {contact.status.toUpperCase()}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${scoreColor(contact.leadScore)}`}>
                  <Star size={10} className="inline mr-0.5" />{contact.leadScore}/10
                </span>
                {contact.tags.map((tag: string) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-[#f5f5f7] text-[#86868b] font-medium">{tag}</span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => setEditing(!editing)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-colors flex-shrink-0">
            <Edit2 size={13} /> Edit
          </button>
        </div>

        {/* Contact info pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {contact.email && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f5f7] text-sm">
              <Mail size={13} className="text-[#86868b]" />
              <span className="text-[#1d1d1f]">{contact.email}</span>
            </div>
          )}
          {contact.phone && contact.phone !== 'N/A' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f5f7] text-sm">
              <Phone size={13} className="text-[#86868b]" />
              <span className="text-[#1d1d1f]">{contact.phone}</span>
            </div>
          )}
          {contact.website && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f5f7] text-sm">
              <Globe size={13} className="text-[#86868b]" />
              <span className="text-[#1d1d1f]">{contact.website}</span>
            </div>
          )}
          {contact.address && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f5f7] text-sm">
              <MapPin size={13} className="text-[#86868b]" />
              <span className="text-[#1d1d1f]">{contact.address}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#f5f5f7] rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.key ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}>{tab.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Suggested next action */}
            <div className="rounded-2xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-[#6366f1]" />
                <span className="text-sm font-semibold text-[#6366f1]">Suggested Next Action</span>
              </div>
              <p className="text-sm text-[#1d1d1f] leading-relaxed">{contact.suggestedAction}</p>
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact info */}
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5">
                <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wide mb-4">Contact Info</p>
                <div className="space-y-3">
                  {[
                    { icon: Calendar, label: 'Added', value: contact.createdAt },
                    { icon: Clock,    label: 'Last Activity', value: contact.lastActivity },
                    { icon: Star,     label: 'Rating', value: contact.rating ? `${contact.rating}/5` : 'N/A' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3">
                      <Icon size={14} className="text-[#86868b]" />
                      <span className="text-xs text-[#86868b] w-24">{label}</span>
                      <span className="text-sm font-medium text-[#1d1d1f]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enrichment data */}
              <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5">
                <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wide mb-4">Enrichment Data</p>
                <div className="space-y-3">
                  {Object.entries(contact.enrichment || {}).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-3">
                      <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                      <span className="text-xs text-[#86868b] w-24 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="text-sm font-medium text-[#1d1d1f]">{val as string}</span>
                    </div>
                  ))}
                  {Object.keys(contact.enrichment || {}).length === 0 && (
                    <p className="text-sm text-[#86868b]">No enrichment data available</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CALLS */}
        {activeTab === 'calls' && (
          <div className="space-y-2">
            {timeline.filter(a => a.type === 'call').length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-[#d2d2d7]/60 bg-white">
                <PhoneIcon size={32} className="mx-auto text-[#d2d2d7] mb-3" />
                <p className="text-sm text-[#86868b]">No calls logged for this contact</p>
              </div>
            ) : timeline.filter(a => a.type === 'call').map((a: any) => (
              <div key={a.id} className="rounded-2xl border border-[#d2d2d7]/60 bg-white px-5 py-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <PhoneIcon size={14} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1d1d1f]">{a.description}</p>
                  <p className="text-xs text-[#86868b] mt-0.5">{a.date} · {a.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EMAILS */}
        {activeTab === 'emails' && (
          <div className="space-y-2">
            {timeline.filter(a => a.type === 'email').length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-[#d2d2d7]/60 bg-white">
                <MailIcon size={32} className="mx-auto text-[#d2d2d7] mb-3" />
                <p className="text-sm text-[#86868b]">No emails logged for this contact</p>
              </div>
            ) : timeline.filter(a => a.type === 'email').map((a: any) => (
              <div key={a.id} className="rounded-2xl border border-[#d2d2d7]/60 bg-white px-5 py-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <MailIcon size={14} className="text-indigo-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1d1d1f]">{a.description}</p>
                  <p className="text-xs text-[#86868b] mt-0.5">{a.date} · {a.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DEALS */}
        {activeTab === 'deals' && (
          <div className="space-y-2">
            {deals.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-[#d2d2d7]/60 bg-white">
                <TrendingUp size={32} className="mx-auto text-[#d2d2d7] mb-3" />
                <p className="text-sm text-[#86868b]">No deals linked to this contact</p>
              </div>
            ) : deals.map((d: any) => (
              <div key={d.id} className="rounded-2xl border border-[#d2d2d7]/60 bg-white px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[#1d1d1f]">{d.title}</p>
                  <span className="text-sm font-bold text-emerald-600">${d.value.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${STAGE_COLORS[d.stage]}20`, color: STAGE_COLORS[d.stage] }}>
                    {d.stage.toUpperCase()}
                  </span>
                  <span className="text-xs text-[#86868b]">{d.probability}% probability</span>
                  <span className="text-xs text-[#86868b]">Close: {d.closeDate}</span>
                </div>
                <div className="mt-3 h-1.5 bg-[#f5f5f7] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.probability}%`, background: STAGE_COLORS[d.stage] }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NOTES */}
        {activeTab === 'notes' && (
          <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5">
            <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wide mb-3">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about this contact..."
              rows={6}
              className="w-full px-4 py-3 text-sm rounded-xl border border-[#d2d2d7]/60 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 resize-none"
            />
            <button className="mt-3 px-4 py-2 text-xs font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] transition-colors">
              Save Notes
            </button>
          </div>
        )}

        {/* TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="relative pl-6">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-[#d2d2d7]/40" />
            {timeline.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-[#d2d2d7]/60 bg-white">
                <AlertCircle size={32} className="mx-auto text-[#d2d2d7] mb-3" />
                <p className="text-sm text-[#86868b]">No activity recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {timeline.map((a: any, idx: number) => {
                  const cfg = TYPE_CONFIG[a.type as ActivityType] || TYPE_CONFIG.note;
                  const Icon = cfg.icon;
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                      className="relative flex gap-3">
                      <div className={`absolute -left-6 w-6 h-6 rounded-full ${cfg.bg} border-2 border-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon size={11} className={cfg.iconColor} />
                      </div>
                      <div className="flex-1 rounded-2xl border border-[#d2d2d7]/60 bg-white px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.iconColor}`}>{cfg.label.toUpperCase()}</span>
                          <span className="text-[11px] text-[#86868b]">{a.date} · {a.timestamp}</span>
                        </div>
                        <p className="text-[12px] text-[#86868b] leading-relaxed">{a.description}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
