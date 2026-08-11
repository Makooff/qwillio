import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../services/api';
import PageHeader from '../../components/dashboard/PageHeader';
import {
  ArrowLeft, Phone, Mail, MapPin, Globe, Star, Edit2,
  Phone as PhoneIcon, Mail as MailIcon, FileText, TrendingUp, MessageSquare,
  Calendar, Clock, CheckCircle, AlertCircle, Zap
} from '../../components/icons';

type TabKey = 'overview' | 'calls' | 'emails' | 'deals' | 'notes' | 'timeline';
type ActivityType = 'call' | 'email' | 'note' | 'deal_update' | 'sms';

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

const FALLBACK_CONTACT: Contact = {
  id: '?', name: 'Contact introuvable', email: '', phone: '',
  status: 'prospect', leadScore: 0, company: '', tags: [],
  address: '', website: '', rating: 0, createdAt: '', lastActivity: '',
  suggestedAction: '', enrichment: {}, notes: '',
};

const TYPE_CONFIG: Record<ActivityType, { icon: React.ElementType; bg: string; iconColor: string; label: string }> = {
  call:        { icon: PhoneIcon,    bg: 'bg-primary-50',    iconColor: 'text-primary-500',    label: 'Call' },
  email:       { icon: MailIcon,     bg: 'bg-primary-50',  iconColor: 'text-[#7349fe]',  label: 'Email' },
  note:        { icon: FileText,     bg: 'bg-amber-400/12', iconColor: 'text-amber-300',  label: 'Note' },
  deal_update: { icon: TrendingUp,   bg: 'bg-emerald-400/12', iconColor: 'text-emerald-300', label: 'Mise à jour' },
  sms:         { icon: MessageSquare,bg: 'bg-violet-300',  iconColor: 'text-violet-500',  label: 'SMS' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:   { bg: 'bg-emerald-400/12', text: 'text-emerald-300' },
  prospect: { bg: 'bg-primary-50',    text: 'text-primary-700' },
  client:   { bg: 'bg-primary-50',  text: 'text-primary-700' },
  inactive: { bg: 'bg-gray-100',   text: 'text-gray-600' },
  lost:     { bg: 'bg-red-400/12',     text: 'text-red-300' },
};

const STAGE_COLORS: Record<string, string> = {
  new: '#3b82f6', qualified: '#7349fe', appointment: '#f59e0b', client: '#10b981', inactive: '#6b7280', lost: '#ef4444',
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',  label: 'Aperçu' },
  { key: 'calls',     label: 'Appels' },
  { key: 'emails',    label: 'Emails' },
  { key: 'deals',     label: 'Affaires' },
  { key: 'notes',     label: 'Notes' },
  { key: 'timeline',  label: 'Historique' },
];

/**
 * La fiche telle que la route la renvoie, traduite vers la forme que cet ecran
 * affiche deja.
 *
 * Les champs sans equivalent en base (note, site, enrichissement, action
 * suggeree) restent VIDES plutot que remplis d'a-peu-pres: le rendu les cache
 * quand ils le sont, et une fiche muette vaut mieux qu'une fiche qui invente.
 */
function toContact(row: any): Contact {
  return {
    id: row.id,
    name: row.name || 'Sans nom',
    email: row.email || '',
    phone: row.phone || '',
    status: row.status || 'new',
    leadScore: row.leadScore ?? 0,
    company: row.niche || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    address: row.address || '',
    website: '',
    rating: 0,
    createdAt: row.createdAt ? new Date(row.createdAt).toLocaleDateString('fr-FR') : '',
    lastActivity: row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('fr-FR') : '',
    suggestedAction: '',
    enrichment: (row.enrichedData && typeof row.enrichedData === 'object') ? row.enrichedData : {},
    notes: row.notes || '',
  };
}

function toTimeline(rows: any[]): TimelineEntry[] {
  return (rows || []).map((a: any) => {
    const at = a.createdAt ? new Date(a.createdAt) : null;
    return {
      id: a.id,
      type: (['call', 'email', 'note', 'deal_update', 'sms'].includes(a.type) ? a.type : 'note') as ActivityType,
      description: a.description || '',
      timestamp: at ? at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
      date: at ? at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '',
    };
  });
}

export default function CrmContactDetail() {
  const { id } = useParams<{ id: string }>();

  /* Cet ecran affichait deux contacts en dur, Sarah Mitchell et James
     Kowalski, et n'importait meme pas `api`. Tant que le CRM etait vide, la
     demo ne genait personne; maintenant que les appels le remplissent, cliquer
     sur un vrai contact montrait la fiche d'un inconnu. */
  const [contact, setContact] = useState<Contact>({ ...FALLBACK_CONTACT, id: id || '?' });
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesState, setNotesState] = useState<'idle' | 'saved' | 'error'>('idle');

  /* Le bouton était un `type="submit"` sans formulaire et sans gestionnaire:
     on écrivait une note, on cliquait, rien ne partait et rien ne le disait.
     La route existait déjà (PUT /crm/contacts/:id accepte `notes`). */
  const saveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    setNotesState('idle');
    try {
      await api.put(`/crm/contacts/${id}`, { notes });
      setNotesState('saved');
      setTimeout(() => setNotesState('idle'), 4000);
    } catch {
      setNotesState('error');
    } finally {
      setSavingNotes(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // La route renvoie deja le contact avec ses activites et ses affaires: une
    // seule requete, pas trois.
    api.get(`/crm/contacts/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
        const mapped = toContact(data);
        setContact(mapped);
        setNotes(mapped.notes);
        setTimeline(toTimeline(data.activities));
        setDeals((data.deals || []).map((d: any) => ({
          id: d.id,
          title: d.title || '',
          value: Number(d.value) || 0,
          stage: d.stage || 'new',
          probability: d.probability ?? 50,
          closeDate: d.closeDate ? new Date(d.closeDate).toLocaleDateString('fr-FR') : '',
        })));
      })
      .catch(() => { /* la fiche de repli dit deja qu'on n'a rien trouve */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const sc = STATUS_COLORS[contact.status] || STATUS_COLORS.prospect;

  function scoreColor(score: number) {
    if (score >= 8) return 'text-emerald-300 bg-emerald-400/12';
    if (score >= 5) return 'text-amber-300 bg-amber-400/12';
    return 'text-red-300 bg-red-400/12';
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-4 w-32 rounded bg-black/[0.06] animate-pulse" />
        <div className="h-40 rounded-2xl bg-black/[0.04] animate-pulse" />
        <div className="h-64 rounded-2xl bg-black/[0.04] animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      {/* Retour, puis l'entête commune. La fiche portait un titre à elle,
          dans une carte peinte pour un fond CLAIR (`bg-white`, `#f5f5f7`)
          posée sur la coque sombre: un rectangle blanc au milieu du noir. */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-5">
        <Link to="/dashboard/leads" className="inline-flex items-center gap-1.5 text-sm text-[#A1A1A8] hover:text-[#7349fe] transition-colors">
          <ArrowLeft size={14} aria-hidden="true" /> Retour aux leads
        </Link>
      </motion.div>

      <PageHeader
        title={contact.name}
        subtitle={contact.company || undefined}
        action={
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            aria-label={editing ? 'Annuler la modification' : 'Modifier le contact'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl border border-white/[0.07] bg-white/[0.03] text-[#A1A1A8] hover:text-[#F5F5F7] transition-colors"
          >
            <Edit2 size={13} aria-hidden="true" /> {editing ? 'Annuler' : 'Modifier'}
          </button>
        }
        /* Ce qui identifie le contact tient lieu de rangée de chiffres: statut,
           score, étiquettes, puis ses coordonnées. */
        stats={
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                {contact.status.toUpperCase()}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${scoreColor(contact.leadScore)}`}>
                <Star size={10} className="inline mr-0.5" aria-hidden="true" />{contact.leadScore}/10
              </span>
              {contact.tags.map((tag: string) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] text-[#A1A1A8] font-medium">{tag}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                [contact.email, Mail],
                [contact.phone && contact.phone !== 'N/A' ? contact.phone : '', Phone],
                [contact.website, Globe],
                [contact.address, MapPin],
              ] as [string, typeof Mail][]).filter(([v]) => v).map(([v, Icon], i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06] bg-white/[0.02] text-sm">
                  <Icon size={13} className="text-[#A1A1A8]" aria-hidden="true" />
                  <span className="text-[#F5F5F7]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-full p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
              activeTab === tab.key ? 'bg-white/[0.08] text-[#F5F5F7]' : 'text-[#A1A1A8] hover:text-[#F5F5F7]'
            }`}>{tab.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Suggested next action */}
            <div className="rounded-2xl border border-[#7349fe]/20 bg-[#7349fe]/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-[#7349fe]" />
                <span className="text-sm font-semibold text-[#7349fe]">Suggested Next Action</span>
              </div>
              <p className="text-sm text-[#F5F5F7] leading-relaxed">{contact.suggestedAction}</p>
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact info */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
                <p className="text-xs font-semibold text-[#A1A1A8] uppercase tracking-wide mb-4">Coordonnées</p>
                <div className="space-y-3">
                  {[
                    { icon: Calendar, label: 'Ajouté le', value: contact.createdAt },
                    { icon: Clock,    label: 'Dernière activité', value: contact.lastActivity },
                    { icon: Star,     label: 'Note', value: contact.rating ? `${contact.rating}/5` : '—' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3">
                      <Icon size={14} className="text-[#A1A1A8]" />
                      <span className="text-xs text-[#A1A1A8] w-24">{label}</span>
                      <span className="text-sm font-medium text-[#F5F5F7]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enrichment data */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
                <p className="text-xs font-semibold text-[#A1A1A8] uppercase tracking-wide mb-4">Données enrichies</p>
                <div className="space-y-3">
                  {Object.entries(contact.enrichment || {}).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-3">
                      <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                      <span className="text-xs text-[#A1A1A8] w-24 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="text-sm font-medium text-[#F5F5F7]">{val}</span>
                    </div>
                  ))}
                  {Object.keys(contact.enrichment || {}).length === 0 && (
                    <p className="text-sm text-[#A1A1A8]">Aucune donnée enrichie</p>
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
              <div className="py-12 text-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
                <PhoneIcon size={32} className="mx-auto text-white/20 mb-3" />
                <p className="text-sm text-[#A1A1A8]">Aucun appel enregistré pour ce contact</p>
              </div>
            ) : timeline.filter(a => a.type === 'call').map((a: TimelineEntry) => (
              <div key={a.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <PhoneIcon size={14} className="text-primary-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#F5F5F7]">{a.description}</p>
                  <p className="text-xs text-[#A1A1A8] mt-0.5">{a.date} · {a.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EMAILS */}
        {activeTab === 'emails' && (
          <div className="space-y-2">
            {timeline.filter(a => a.type === 'email').length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
                <MailIcon size={32} className="mx-auto text-white/20 mb-3" />
                <p className="text-sm text-[#A1A1A8]">Aucun email enregistré pour ce contact</p>
              </div>
            ) : timeline.filter(a => a.type === 'email').map((a: TimelineEntry) => (
              <div key={a.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <MailIcon size={14} className="text-[#7349fe]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#F5F5F7]">{a.description}</p>
                  <p className="text-xs text-[#A1A1A8] mt-0.5">{a.date} · {a.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DEALS */}
        {activeTab === 'deals' && (
          <div className="space-y-2">
            {deals.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
                <TrendingUp size={32} className="mx-auto text-white/20 mb-3" />
                <p className="text-sm text-[#A1A1A8]">Aucune affaire liée à ce contact</p>
              </div>
            ) : deals.map((d: Deal) => (
              <div key={d.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-[#F5F5F7]">{d.title}</p>
                  <span className="text-sm font-bold text-emerald-300">{d.value.toLocaleString('fr-FR')} €</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${STAGE_COLORS[d.stage]}20`, color: STAGE_COLORS[d.stage] }}>
                    {d.stage.toUpperCase()}
                  </span>
                  <span className="text-xs text-[#A1A1A8]">{d.probability}% de probabilité</span>
                  <span className="text-xs text-[#A1A1A8]">Clôture : {d.closeDate}</span>
                </div>
                <div className="mt-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.probability}%`, background: STAGE_COLORS[d.stage] }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NOTES */}
        {activeTab === 'notes' && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <p className="text-xs font-semibold text-[#A1A1A8] uppercase tracking-wide mb-3">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ajoutez une note sur ce contact…"
              rows={6}
              className="w-full px-4 py-3 text-sm rounded-xl border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#7349fe]/30 resize-none"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={saveNotes}
                disabled={savingNotes}
                className="px-4 py-2 text-xs font-medium text-white bg-[#7349fe] rounded-full hover:bg-[#8259ff] disabled:opacity-60 active:scale-[0.97] transition-transform">
                {savingNotes ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              {notesState === 'saved' && (
                <span role="status" className="text-xs text-emerald-300">Note enregistrée</span>
              )}
              {notesState === 'error' && (
                <span role="alert" className="text-xs text-red-300">
                  L&apos;enregistrement a échoué. Réessayez.
                </span>
              )}
            </div>
          </div>
        )}

        {/* TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="relative pl-6">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-white/[0.08]" />
            {timeline.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
                <AlertCircle size={32} className="mx-auto text-white/20 mb-3" />
                <p className="text-sm text-[#A1A1A8]">Aucune activité enregistrée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {timeline.map((a: TimelineEntry, idx: number) => {
                  const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.note;
                  const Icon = cfg.icon;
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                      className="relative flex gap-3">
                      <div className={`absolute -left-6 w-6 h-6 rounded-full ${cfg.bg} border-2 border-[#0e0e10] flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon size={11} className={cfg.iconColor} />
                      </div>
                      <div className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.iconColor}`}>{cfg.label.toUpperCase()}</span>
                          <span className="text-[11px] text-[#A1A1A8]">{a.date} · {a.timestamp}</span>
                        </div>
                        <p className="text-[12px] text-[#A1A1A8] leading-relaxed">{a.description}</p>
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
