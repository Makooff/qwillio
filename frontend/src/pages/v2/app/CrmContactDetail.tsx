import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, Building2, Calendar, CheckCircle, Clock, Edit2,
  FileText, Globe, Mail, MapPin, MessageSquare, Phone, Star, TrendingUp, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Card, EmptyState, GhostBtn, PageActions, Pill, PrimaryBtn, Textarea,
} from '../../../components/v2/app/Blocks';

/* Détail contact CRM, registre produit V2 (DA/v2-direction.md, addendum).
   Aucun appel API en V1: les données de démonstration sont portées telles quelles. */

type TabKey = 'overview' | 'calls' | 'emails' | 'deals' | 'notes' | 'timeline';
type ActivityType = 'call' | 'email' | 'note' | 'deal_update' | 'sms';
type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

interface ContactEnrichment {
  employees?: string;
  industry?: string;
  annualRevenue?: string;
  timezone?: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  leadScore: number;
  company: string;
  tags: string[];
  address: string;
  website: string;
  rating: number;
  createdAt: string;
  lastActivity: string;
  suggestedAction: string;
  enrichment: ContactEnrichment;
  notes: string;
}

interface TimelineEntry {
  id: string;
  type: ActivityType;
  description: string;
  timestamp: string;
  date: string;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability: number;
  closeDate: string;
}

const DEMO_CONTACTS: Record<string, Contact> = {
  '1': {
    id: '1', name: 'Sarah Mitchell', email: 'sarah@brighthomerealty.com', phone: '+1 (555) 201-4892',
    status: 'client', leadScore: 9, company: 'Bright Home Realty', tags: ['VIP', 'Real Estate'],
    address: '4820 Oak Street, Phoenix, AZ 85001', website: 'brighthomerealty.com',
    rating: 4.8, createdAt: 'Feb 14, 2026', lastActivity: '2 hours ago',
    suggestedAction: 'Schedule quarterly check-in – Sarah is a top client. Upsell opportunity for analytics add-on.',
    enrichment: { employees: '12–50', industry: 'Real Estate', annualRevenue: '$2.4M', timezone: 'MST' },
    notes: 'Very responsive. Prefers Zoom calls. Referred 2 clients already. VIP treatment always.',
  },
  '2': {
    id: '2', name: 'James Kowalski', email: 'james.k@automax.net', phone: '+1 (555) 384-7120',
    status: 'prospect', leadScore: 7, company: 'AutoMax', tags: ['Auto', 'Hot Lead'],
    address: '901 Commerce Blvd, Dallas, TX 75201', website: 'automax.net',
    rating: 4.2, createdAt: 'Mar 10, 2026', lastActivity: '5 hours ago',
    suggestedAction: 'Follow up by Friday – James is waiting on GM approval. Send a 1-page ROI summary to close.',
    enrichment: { employees: '50–200', industry: 'Automotive Dealerships', annualRevenue: '$8.1M', timezone: 'CST' },
    notes: 'Decision requires GM sign-off. Budget approved. Very interested in the lead qualifier feature.',
  },
};

const FALLBACK_CONTACT: Contact = {
  id: '?', name: 'Contact Not Found', email: 'unknown@example.com', phone: 'N/A',
  status: 'prospect', leadScore: 5, company: 'Unknown', tags: [],
  address: '', website: '', rating: 0, createdAt: 'N/A', lastActivity: 'N/A',
  suggestedAction: 'No data available.', enrichment: {}, notes: '',
};

const DEMO_TIMELINE: Record<string, TimelineEntry[]> = {
  '1': [
    { id: 't1', type: 'call', description: 'Inbound call – discussed renewal. Very happy with the service.', timestamp: '10:32 AM', date: 'Mar 22' },
    { id: 't2', type: 'deal_update', description: 'Renewal deal created: $4,200 for Year 2.', timestamp: '10:45 AM', date: 'Mar 22' },
    { id: 't3', type: 'email', description: 'Sent renewal proposal with updated pricing.', timestamp: '11:00 AM', date: 'Mar 20' },
    { id: 't4', type: 'note', description: 'Sarah referred Linda Park. Added to CRM.', timestamp: '2:00 PM', date: 'Mar 18' },
  ],
  '2': [
    { id: 't5', type: 'call', description: 'Discovery call – 18 min. Strong interest.', timestamp: '3:22 PM', date: 'Mar 21' },
    { id: 't6', type: 'email', description: 'Sent follow-up proposal email.', timestamp: '8:50 AM', date: 'Mar 22' },
    { id: 't7', type: 'note', description: 'GM approval expected by end of week.', timestamp: '2:10 PM', date: 'Mar 21' },
  ],
};

const DEMO_DEALS: Record<string, Deal[]> = {
  '1': [{ id: 'd1', title: 'Realty AI Assistant', value: 4200, stage: 'client', probability: 90, closeDate: 'Mar 28' }],
  '2': [{ id: 'd2', title: 'Auto Dealership Agent', value: 5100, stage: 'appointment', probability: 70, closeDate: 'Apr 5' }],
};

const TYPE_CONFIG: Record<ActivityType, { icon: LucideIcon; tone: Tone; label: string }> = {
  call: { icon: Phone, tone: 'info', label: 'Call' },
  email: { icon: Mail, tone: 'accent', label: 'Email' },
  note: { icon: FileText, tone: 'warn', label: 'Note' },
  deal_update: { icon: TrendingUp, tone: 'ok', label: 'Deal Update' },
  sms: { icon: MessageSquare, tone: 'neutral', label: 'SMS' },
};

const STATUS_TONES: Record<string, Tone> = {
  active: 'ok',
  prospect: 'info',
  client: 'accent',
  inactive: 'neutral',
  lost: 'bad',
};

const STAGE_TONES: Record<string, Tone> = {
  new: 'info', qualified: 'accent', appointment: 'warn', client: 'ok', inactive: 'neutral', lost: 'bad',
};

const STAGE_COLORS: Record<string, string> = {
  new: 'var(--q2p-info)',
  qualified: 'var(--q2-lift)',
  appointment: 'var(--q2p-warn)',
  client: 'var(--q2p-ok)',
  inactive: '#8A8F98',
  lost: 'var(--q2p-bad)',
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'calls', label: 'Calls' },
  { key: 'emails', label: 'Emails' },
  { key: 'deals', label: 'Deals' },
  { key: 'notes', label: 'Notes' },
  { key: 'timeline', label: 'Timeline' },
];

function scoreTone(score: number): Tone {
  if (score >= 8) return 'ok';
  if (score >= 5) return 'warn';
  return 'bad';
}

function InfoLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-q2-graphite-d first:border-t-0">
      <Icon size={13} className="text-q2-fog shrink-0" aria-hidden="true" />
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog w-28 shrink-0">{label}</span>
      <span className="text-[13px] text-white tabular-nums truncate">{value}</span>
    </div>
  );
}

function EntryRow({ entry, icon: Icon }: { entry: TimelineEntry; icon: LucideIcon }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-t border-q2-graphite-d first:border-t-0">
      <span className="w-8 h-8 shrink-0 rounded-lg bg-q2-obsidian flex items-center justify-center">
        <Icon size={14} className="text-q2-lift" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] text-white q2-body-text">{entry.description}</p>
        <p className="text-[11.5px] text-q2-fog mt-0.5 tabular-nums">{entry.date} · {entry.timestamp}</p>
      </div>
    </div>
  );
}

export default function CrmContactDetail() {
  const { id } = useParams<{ id: string }>();
  const contact: Contact = (id && DEMO_CONTACTS[id]) ? DEMO_CONTACTS[id] : { ...FALLBACK_CONTACT, id: id || '?' };
  const timeline: TimelineEntry[] = (id && DEMO_TIMELINE[id]) ? DEMO_TIMELINE[id] : [];
  const deals: Deal[] = (id && DEMO_DEALS[id]) ? DEMO_DEALS[id] : [];

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(contact.notes || '');

  const contactLines: { icon: LucideIcon; value: string }[] = [
    ...(contact.email ? [{ icon: Mail, value: contact.email }] : []),
    ...(contact.phone && contact.phone !== 'N/A' ? [{ icon: Phone, value: contact.phone }] : []),
    ...(contact.website ? [{ icon: Globe, value: contact.website }] : []),
    ...(contact.address ? [{ icon: MapPin, value: contact.address }] : []),
  ];

  const calls = timeline.filter((a) => a.type === 'call');
  const emails = timeline.filter((a) => a.type === 'email');

  return (
    <div>
      <PageActions
        subtitle={
          <Link
            to="/dashboard/crm"
            className="inline-flex items-center gap-1.5 text-[13px] text-q2-fog hover:text-q2-mist transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Back to Contacts
          </Link>
        }
      >
        <GhostBtn
          type="button"
          onClick={() => setEditing(!editing)}
          aria-label={editing ? 'Cancel editing contact' : 'Edit contact'}
        >
          <Edit2 size={13} aria-hidden="true" /> Edit
        </GhostBtn>
      </PageActions>

      {/* Identité du contact */}
      <Card className="mb-5">
        <div className="flex items-start gap-4">
          <span className="w-14 h-14 shrink-0 rounded-xl bg-q2-indigo flex items-center justify-center text-white text-[18px] font-medium">
            {contact.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <h2 className="text-[18px] font-medium text-white tracking-tight truncate">{contact.name}</h2>
            {contact.company && (
              <span className="inline-flex items-center gap-1.5 mt-0.5">
                <Building2 size={12} className="text-q2-fog" aria-hidden="true" />
                <span className="text-[12.5px] text-q2-fog">{contact.company}</span>
              </span>
            )}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <Pill tone={STATUS_TONES[contact.status] || 'neutral'}>{contact.status.toUpperCase()}</Pill>
              <Pill tone={scoreTone(contact.leadScore)}>
                <Star size={10} aria-hidden="true" />
                {contact.leadScore}/10
              </Pill>
              {contact.tags.map((tag: string) => <Pill key={tag}>{tag}</Pill>)}
            </div>
          </div>
        </div>

        {contactLines.length > 0 && (
          <div className="mt-5 rounded-xl border border-q2-graphite-d overflow-hidden">
            {contactLines.map(({ icon: Icon, value }) => (
              <div key={value} className="flex items-center gap-2.5 px-4 py-2.5 border-t border-q2-graphite-d first:border-t-0">
                <Icon size={13} className="text-q2-fog shrink-0" aria-hidden="true" />
                <span className="text-[13px] text-q2-mist truncate">{value}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Onglets */}
      <div
        role="tablist"
        aria-label="Contact sections"
        className="inline-flex flex-wrap items-center gap-1 rounded-full bg-q2-obsidian border border-q2-graphite-d p-1 mb-5"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`h-7 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
              activeTab === tab.key ? 'bg-q2-indigo text-white' : 'text-q2-fog hover:text-q2-mist'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-q2-indigo/35 bg-q2-indigo/[0.07] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-q2-lift" aria-hidden="true" />
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-lift">Suggested Next Action</span>
            </div>
            <p className="text-[13px] text-q2-mist leading-relaxed q2-body-text">{contact.suggestedAction}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card pad={false}>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog px-4 pt-4 pb-2">Contact Info</p>
              <div className="border-t border-q2-graphite-d">
                <InfoLine icon={Calendar} label="Added" value={contact.createdAt} />
                <InfoLine icon={Clock} label="Last Activity" value={contact.lastActivity} />
                <InfoLine icon={Star} label="Rating" value={contact.rating ? `${contact.rating}/5` : 'N/A'} />
              </div>
            </Card>

            <Card pad={false}>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog px-4 pt-4 pb-2">Enrichment Data</p>
              <div className="border-t border-q2-graphite-d">
                {Object.entries(contact.enrichment || {}).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3 px-4 py-3 border-t border-q2-graphite-d first:border-t-0">
                    <CheckCircle size={13} className="shrink-0" style={{ color: 'var(--q2p-ok)' }} aria-hidden="true" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog w-28 shrink-0">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span className="text-[13px] text-white tabular-nums truncate">{val}</span>
                  </div>
                ))}
                {Object.keys(contact.enrichment || {}).length === 0 && (
                  <p className="text-[13px] text-q2-fog px-4 py-4">No enrichment data available</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* CALLS */}
      {activeTab === 'calls' && (
        <Card pad={false}>
          {calls.length === 0 ? (
            <EmptyState icon={Phone} title="No calls logged for this contact" />
          ) : (
            calls.map((a) => <EntryRow key={a.id} entry={a} icon={Phone} />)
          )}
        </Card>
      )}

      {/* EMAILS */}
      {activeTab === 'emails' && (
        <Card pad={false}>
          {emails.length === 0 ? (
            <EmptyState icon={Mail} title="No emails logged for this contact" />
          ) : (
            emails.map((a) => <EntryRow key={a.id} entry={a} icon={Mail} />)
          )}
        </Card>
      )}

      {/* DEALS */}
      {activeTab === 'deals' && (
        <Card pad={false}>
          {deals.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No deals linked to this contact" />
          ) : (
            deals.map((d: Deal) => (
              <div key={d.id} className="px-4 py-4 border-t border-q2-graphite-d first:border-t-0">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-[13.5px] font-medium text-white truncate">{d.title}</p>
                  <span className="text-[13.5px] font-medium tabular-nums" style={{ color: 'var(--q2p-ok)' }}>
                    ${d.value.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <Pill tone={STAGE_TONES[d.stage] || 'neutral'}>{d.stage.toUpperCase()}</Pill>
                  <span className="text-[11.5px] text-q2-fog tabular-nums">{d.probability}% probability</span>
                  <span className="text-[11.5px] text-q2-fog tabular-nums">Close: {d.closeDate}</span>
                </div>
                <div className="h-1.5 rounded-full bg-q2-obsidian overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.probability}%`, background: STAGE_COLORS[d.stage] }} />
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      {/* NOTES */}
      {activeTab === 'notes' && (
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-2">Notes</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this contact..."
            rows={6}
            aria-label="Notes about this contact"
            className="resize-none"
          />
          <div className="mt-3">
            <PrimaryBtn type="button">Save Notes</PrimaryBtn>
          </div>
        </Card>
      )}

      {/* TIMELINE */}
      {activeTab === 'timeline' && (
        <Card pad={false}>
          {timeline.length === 0 ? (
            <EmptyState icon={AlertCircle} title="No activity recorded yet" />
          ) : (
            timeline.map((a: TimelineEntry) => {
              const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.note;
              const Icon = cfg.icon;
              return (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3.5 border-t border-q2-graphite-d first:border-t-0">
                  <span className="w-8 h-8 shrink-0 rounded-lg bg-q2-obsidian flex items-center justify-center">
                    <Icon size={14} className="text-q2-lift" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <Pill tone={cfg.tone}>{cfg.label.toUpperCase()}</Pill>
                      <span className="text-[11.5px] text-q2-fog tabular-nums whitespace-nowrap">{a.date} · {a.timestamp}</span>
                    </div>
                    <p className="text-[13px] text-q2-mist leading-relaxed q2-body-text">{a.description}</p>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      )}
    </div>
  );
}
