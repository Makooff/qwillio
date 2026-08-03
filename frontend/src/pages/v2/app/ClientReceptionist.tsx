import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Bot, PhoneForwarded, AlertCircle,
  Activity, Globe, Clock, Shield, Calendar,
  MapPin, Settings,
  ChevronDown, ChevronRight, CheckCircle2, XCircle,
  BookOpen, Tag, HelpCircle, Clock3, Plus, X,
  type LucideIcon,
} from 'lucide-react';
import api from '../../../services/api';
import CharacterPicker, { type Character } from '../../../components/client/CharacterPicker';
import AssistantChat from '../../../components/client/AssistantChat';
import {
  Card, PageActions, Row, PrimaryBtn, GhostBtn,
  Field, Input, Select, Textarea, Toggle, Pill,
} from '../../../components/v2/app/Blocks';

/* Réceptionniste IA, registre produit V2 « instrument ». La logique est celle
   de la V1 (autosave 900 ms, OAuth Google Calendar, section mémorisée) ; seule
   la peau change: cards carbon hairline, kit Blocks, zéro ombre. */

const compactCls =
  'w-full h-9 bg-q2-obsidian border border-q2-graphite-d rounded-lg px-3 text-[12.5px] text-white placeholder:text-q2-fog focus:outline-none focus:border-q2-indigo/60 transition-colors duration-150 disabled:opacity-40';

interface KbItem { id: string; category: string; name: string; price: string; }
interface DayHours { open: boolean; from: string; to: string; }
type WeekDay = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday';
type WeekHours = Record<WeekDay, DayHours>;

const ITEM_CATEGORIES: { v: string; l: string }[] = [
  { v: 'service',    l: 'Service' },
  { v: 'menu',       l: 'Menu' },
  { v: 'tarif',      l: 'Tarif' },
  { v: 'produit',    l: 'Produit' },
  { v: 'prestation', l: 'Prestation' },
  { v: 'autre',      l: 'Autre' },
];

const DAYS: { k: WeekDay; l: string }[] = [
  { k: 'monday',    l: 'Lundi' },
  { k: 'tuesday',   l: 'Mardi' },
  { k: 'wednesday', l: 'Mercredi' },
  { k: 'thursday',  l: 'Jeudi' },
  { k: 'friday',    l: 'Vendredi' },
  { k: 'saturday',  l: 'Samedi' },
  { k: 'sunday',    l: 'Dimanche' },
];

const DEFAULT_HOURS: WeekHours = {
  monday:    { open: true,  from: '09:00', to: '18:00' },
  tuesday:   { open: true,  from: '09:00', to: '18:00' },
  wednesday: { open: true,  from: '09:00', to: '18:00' },
  thursday:  { open: true,  from: '09:00', to: '18:00' },
  friday:    { open: true,  from: '09:00', to: '18:00' },
  saturday:  { open: false, from: '10:00', to: '16:00' },
  sunday:    { open: false, from: '10:00', to: '16:00' },
};

const newId = () => Math.random().toString(36).slice(2, 10);

const PERSONALITY_PRESETS: { v: string; l: string; d: string }[] = [
  { v: 'warm',         l: 'Chaleureux',   d: 'Accueillant, empathique, sourire dans la voix' },
  { v: 'professional', l: 'Professionnel', d: 'Direct, précis, cadre formel' },
  { v: 'casual',       l: 'Décontracté',  d: 'Détendu, fluide, ton conversationnel' },
  { v: 'energetic',    l: 'Énergique',    d: 'Dynamique, enthousiaste, upbeat' },
  { v: 'luxury',       l: 'Premium',      d: 'Soigné, raffiné, langage soutenu' },
  { v: 'caring',       l: 'Bienveillant', d: 'Doux, rassurant, idéal pour santé / médical' },
];

/**
 * Une section: la rangée de réglage 56px du kit, dépliable. Elles s'ouvrent une
 * à la fois. Les sous-pages étaient l'autre option, mais tout le formulaire
 * partage un seul autosave: router aurait voulu dire soit remonter chaque
 * champ, soit recharger les réglages une fois par page.
 */
function Section({ title, hint, icon: Icon, children, id, openId, setOpenId }: {
  title: string;
  hint?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  id: string;
  openId: string | null;
  setOpenId: (v: string | null) => void;
}) {
  const open = openId === id;
  return (
    <Card pad={false}>
      <button
        type="button"
        onClick={() => setOpenId(open ? null : id)}
        aria-expanded={open}
        className="w-full min-h-[56px] flex items-center justify-between gap-3 px-4 text-left hover:bg-q2-obsidian/60 transition-colors duration-100 focus:outline-none focus-visible:bg-q2-obsidian"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <span className="w-8 h-8 shrink-0 rounded-lg bg-q2-obsidian flex items-center justify-center">
            <Icon size={15} aria-hidden="true" className="text-q2-lift" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-white truncate">{title}</p>
            {hint && <p className="text-[11.5px] text-q2-fog truncate">{hint}</p>}
          </div>
        </div>
        {open
          ? <ChevronDown size={14} className="text-q2-fog shrink-0" aria-hidden="true" />
          : <ChevronRight size={14} className="text-q2-fog shrink-0" aria-hidden="true" />}
      </button>
      {open && <div className="px-4 pb-5 pt-4 border-t border-q2-graphite-d">{children}</div>}
    </Card>
  );
}

function GroupLabel({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="q2-eyebrow text-q2-fog mb-3 flex items-center gap-2">
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </p>
  );
}

export default function ClientReceptionist() {
  const [overview, setOverview] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const hydrated = useRef(false);
  const skipAutosave = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [transferNumber, setTransferNumber] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentLanguage, setAgentLanguage] = useState('en');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [forwardingType, setForwardingType] = useState('');
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  // Google Calendar OAuth integration
  const [gcal, setGcal] = useState<{ connected: boolean; revoked?: boolean; upcoming?: { id: string; summary: string; start: string | null }[] } | null>(null);
  const [gcalBusy, setGcalBusy] = useState(false);
  // Knowledge base (stored inside vapiConfig JSON, exposed top-level)
  const [items, setItems] = useState<KbItem[]>([]);
  const [weekHours, setWeekHours] = useState<WeekHours>(DEFAULT_HOURS);
  const [faq, setFaq] = useState('');
  const [personalityPreset, setPersonalityPreset] = useState<string>('warm');
  const [personalityNotes, setPersonalityNotes] = useState('');
  const [characterId, setCharacterId] = useState<string>('marie');
  const [characters, setCharacters] = useState<Character[]>([]);
  // One section open at a time, remembered so a reload lands where you were.
  const [openId, setOpenId] = useState<string | null>(() => {
    try { return localStorage.getItem('qw.receptionistSection') || 'identite'; } catch { return 'identite'; }
  });
  useEffect(() => {
    try {
      if (openId) localStorage.setItem('qw.receptionistSection', openId);
      else localStorage.removeItem('qw.receptionistSection');
    } catch { /* nothing worth breaking the page over */ }
  }, [openId]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ov, st, gc, ch] = await Promise.all([
        api.get('/my-dashboard/overview'),
        api.get('/my-dashboard/settings').catch(() => ({ data: null })),
        api.get('/my-dashboard/integrations/google-calendar/status').catch(() => ({ data: { connected: false } })),
        api.get('/my-dashboard/characters').catch(() => ({ data: { characters: [] } })),
      ]);
      setCharacters(Array.isArray(ch.data?.characters) ? ch.data.characters : []);
      setGcal(gc.data);
      setOverview(ov.data);
      const s = st.data;
      setSettings(s);
      setBusinessName(s?.businessName || ov.data?.client?.businessName || '');
      setBusinessType(s?.businessType || '');
      setTransferNumber(s?.transferNumber || '');
      setAgentName(s?.agentName || '');
      setAgentLanguage(s?.agentLanguage || 'en');
      setContactPhone(s?.contactPhone || '');
      setAddress(s?.address || '');
      setCity(s?.city || '');
      setPostalCode(s?.postalCode || '');
      setForwardingType(s?.forwardingType || '');
      setGoogleCalendarId(s?.googleCalendarId || '');
      // Items: stored as array; if backend still has the legacy string, ignore.
      const rawItems = Array.isArray(s?.items) ? s.items : [];
      setItems(rawItems.map((it: any) => ({
        id:       it.id || newId(),
        category: it.category || 'service',
        name:     it.name || '',
        price:    it.price || '',
      })));
      // Hours: object {day: {open, from, to}}
      if (s?.hours && typeof s.hours === 'object' && !Array.isArray(s.hours)) {
        setWeekHours({ ...DEFAULT_HOURS, ...s.hours });
      } else {
        setWeekHours(DEFAULT_HOURS);
      }
      setFaq(s?.faq || '');
      setPersonalityPreset(s?.personalityPreset || 'warm');
      setPersonalityNotes(s?.personalityNotes || '');
      setCharacterId(s?.characterId || 'marie');
      // Values below come from the server, so they must not trigger an auto-save.
      hydrated.current = true;
      skipAutosave.current = true;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Google OAuth redirect lands back here with ?code=&state=, finish the handshake
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state || !state.startsWith('qwillio-gcal')) return;
    window.history.replaceState({}, '', window.location.pathname);
    setGcalBusy(true);
    api.post('/my-dashboard/integrations/google-calendar/callback', { code, state })
      .then(() => load())
      .catch(() => setError('Échec de la connexion Google Calendar'))
      .finally(() => setGcalBusy(false));
  }, [load]);

  const connectGcal = async () => {
    setGcalBusy(true);
    try {
      const { data } = await api.get('/my-dashboard/integrations/google-calendar/auth-url');
      window.location.href = data.url;
    } catch {
      setError('OAuth Google non configuré côté serveur');
      setGcalBusy(false);
    }
  };

  const disconnectGcal = async () => {
    setGcalBusy(true);
    try {
      await api.delete('/my-dashboard/integrations/google-calendar');
      setGcal({ connected: false });
    } catch {
      setError('Échec de la déconnexion Google Calendar');
    } finally {
      setGcalBusy(false);
    }
  };

  // Scroll to #transfer (or any other section) when the URL includes a hash
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    // wait one frame so the DOM with the new markup is mounted
    requestAnimationFrame(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [loading]);

  const autoSave = useCallback(async () => {
    try {
      await api.put('/my-dashboard/settings', {
        businessName, businessType, transferNumber, agentName,
        agentLanguage, contactPhone, address, city, postalCode,
        forwardingType, googleCalendarId,
        items: items.filter(i => i.name.trim()),
        hours: weekHours,
        faq,
        personalityPreset,
        personalityNotes,
        characterId,
      });
    } catch { /* silent, the next edit retries */ }
  }, [businessName, businessType, transferNumber, agentName, agentLanguage,
      contactPhone, address, city, postalCode, forwardingType, googleCalendarId,
      items, weekHours, faq, personalityPreset, personalityNotes, characterId]);

  // Auto-save: debounce after any edit. Skips the initial hydration from load()
  // so we never fire a redundant save on mount.
  useEffect(() => {
    if (!hydrated.current) return;
    if (skipAutosave.current) { skipAutosave.current = false; return; }
    const t = setTimeout(() => { void autoSave(); }, 900);
    return () => clearTimeout(t);
  }, [autoSave]);

  if (loading) return (
    <div className="max-w-3xl space-y-3" aria-busy="true">
      <div className="h-40 rounded-xl bg-q2-carbon border border-q2-graphite-d animate-pulse" />
      <div className="h-14 rounded-xl bg-q2-carbon border border-q2-graphite-d animate-pulse" />
      <div className="h-14 rounded-xl bg-q2-carbon border border-q2-graphite-d animate-pulse" />
      <div className="h-14 rounded-xl bg-q2-carbon border border-q2-graphite-d animate-pulse" />
    </div>
  );

  if (error) return (
    <div className="max-w-3xl">
      <Card>
        <div className="flex flex-col items-center justify-center text-center py-10">
          <span className="w-10 h-10 rounded-full bg-q2-obsidian flex items-center justify-center mb-4">
            <AlertCircle size={18} style={{ color: 'var(--q2p-bad)' }} aria-hidden="true" />
          </span>
          <p className="text-[13px] text-q2-fog mb-5">{error}</p>
          <PrimaryBtn onClick={load}>Réessayer</PrimaryBtn>
        </div>
      </Card>
    </div>
  );

  const client = overview?.client || {};
  const status = client.subscriptionStatus || 'active';
  const isPaused = status === 'paused';
  const isActive = status === 'active' || status === 'trialing';
  const phone = client.vapiPhoneNumber || settings?.vapiPhoneNumber;
  const fwdStatus = settings?.forwardingStatus;
  const fwdVerified = settings?.forwardingVerifiedAt;
  // Per-minute billing: the gauge is rendered by AssistantChat's header.
  const quota = overview?.minutes?.quota || settings?.monthlyMinutesQuota || 0;
  const used = overview?.minutes?.used || 0;
  // `planType` is a lowercase key ('starter'); shown to a customer it becomes
  // a name. One formatting, used by both the header and the Abonnement row.
  const planName = (() => {
    const k = client.planType || 'starter';
    return k.charAt(0).toUpperCase() + k.slice(1);
  })();

  return (
    <div className="max-w-3xl">
      <PageActions subtitle="Chaque modification est enregistrée automatiquement." />

      <div className="space-y-3">
        {/* Assistant conversationnel: parler pour configurer et onboarder. Il
            porte aussi l'identité (entreprise, plan), le numéro copiable,
            l'appel test live et la jauge de minutes. Il a son propre style
            interne: on l'accueille dans un conteneur neutre, sans le surcharger. */}
        <div>
          <AssistantChat
            isFr={agentLanguage !== 'en'}
            onConfigChanged={load}
            businessName={client.businessName || businessName}
            planLabel={planName}
            isTrial={!!client.isTrial}
            phone={phone}
            quota={{ used, total: quota }}
            /* Setup counts as done once the agent knows who it answers for and
               when. Those two are what every other answer depends on. */
            setupComplete={!!(businessName && businessType && weekHours)}
            /* Confirmed price lines land in the same knowledge base the form
               edits, so they stay reviewable and editable afterwards. */
            onItemsExtracted={(rows) => setItems(prev => [
              ...prev,
              ...rows.map(r => ({ id: newId(), category: r.category, name: r.name, price: r.price })),
            ])}
          />
        </div>

        {/* Bande d'état. Le numéro, le plan et la jauge de minutes sont dans
            l'entête du chat ; les compteurs d'appels et de leads vivent sur la
            page Appels et sur l'accueil. Il ne reste ici que ce qui n'existe
            nulle part ailleurs: l'état du transfert, et l'attente du numéro. */}
        <Card pad={false}>
          {!phone && (
            <Row
              first
              icon={AlertCircle}
              label="Numéro IA en cours d'attribution"
              hint="Votre ligne est réservée, l'activation prend quelques minutes"
            />
          )}
          <Row
            first={!!phone}
            icon={PhoneForwarded}
            label="Transfert d'appel"
            right={
              fwdVerified && transferNumber ? (
                <Pill tone="ok"><CheckCircle2 size={11} aria-hidden="true" /> Vérifié</Pill>
              ) : fwdStatus === 'pending' ? (
                <Pill tone="warn"><Clock size={11} aria-hidden="true" /> En attente</Pill>
              ) : (
                <Pill><XCircle size={11} aria-hidden="true" /> Non configuré</Pill>
              )
            }
          />
        </Card>

        {/* Identité de l'agent */}
        <Section title="Identité de l'agent" hint="Nom, langue, voix et caractère" id="identite" openId={openId} setOpenId={setOpenId} icon={Bot}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nom de l'agent" hint="Le prénom utilisé par l'IA pour se présenter">
              <Input type="text" value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Ex: Ashley, Marie..." />
            </Field>
            <Field label="Langue" hint="Langue parlée par votre réceptionniste IA">
              <Select value={agentLanguage} onChange={e => setAgentLanguage(e.target.value)}>
                <option value="en">Anglais (Ashley)</option>
                <option value="fr">Français (Marie)</option>
              </Select>
            </Field>
            <Field label="Nom de l'entreprise" hint="Utilisé par l'IA pour se présenter au téléphone">
              <Input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Ex: Plomberie Dupont" />
            </Field>
            <Field label="Type d'entreprise">
              <Select value={businessType} onChange={e => setBusinessType(e.target.value)}>
                <option value="">Sélectionner...</option>
                <option value="dental">Dentaire</option>
                <option value="medical">Médical</option>
                <option value="law">Juridique</option>
                <option value="salon">Salon</option>
                <option value="restaurant">Restaurant</option>
                <option value="garage">Garage auto</option>
                <option value="hotel">Hôtel</option>
                <option value="home_services">Services maison</option>
                <option value="other">Autre</option>
              </Select>
            </Field>
          </div>

          {/* Personnage (voix + personnalité) */}
          {characters.length > 0 && (
            <div className="mt-6">
              <GroupLabel>Personnage de la réceptionniste</GroupLabel>
              <p className="text-[12px] text-q2-fog mb-3 q2-body-text">
                Choisissez la voix et le caractère qui répond à vos appels. Cliquez sur le bouton lecture pour un aperçu.
              </p>
              <CharacterPicker
                characters={characters}
                value={characterId}
                onChange={setCharacterId}
                isFr={agentLanguage !== 'en'}
              />
            </div>
          )}

          {/* Ton (affinage optionnel) + personnalisation libre */}
          <div className="mt-6">
            <GroupLabel>Ton (affinage optionnel)</GroupLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PERSONALITY_PRESETS.map(p => {
                const sel = personalityPreset === p.v;
                return (
                  <button
                    key={p.v}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => setPersonalityPreset(p.v)}
                    className={`text-left p-3 rounded-xl border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
                      sel
                        ? 'bg-q2-indigo/10 border-q2-indigo/55'
                        : 'bg-q2-obsidian border-q2-graphite-d hover:border-q2-smoke-d'
                    }`}
                  >
                    <p className={`text-[13px] font-medium ${sel ? 'text-q2-lift' : 'text-white'}`}>{p.l}</p>
                    <p className="text-[11px] mt-0.5 text-q2-fog">{p.d}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <GroupLabel>Personnalisation</GroupLabel>
            <Textarea
              value={personalityNotes}
              onChange={e => setPersonalityNotes(e.target.value)}
              rows={4}
              placeholder="Précisez ce qui vous est propre : promotions en cours, mots à utiliser, à éviter, formule d'accueil…"
              className="resize-y leading-relaxed"
              style={{ minHeight: 100 }}
            />
          </div>
        </Section>

        {/* Connaissances IA: items list + week schedule */}
        <Section title="Base de connaissances" hint="Services, tarifs, horaires et FAQ" id="connaissances" openId={openId} setOpenId={setOpenId} icon={BookOpen}>
          <p className="text-[12px] text-q2-fog mb-5 q2-body-text">
            Ce que l'IA doit savoir pour répondre aux appelants : services, menu,
            tarifs, horaires, FAQ. Plus c'est précis, plus elle sera précise.
          </p>

          {/* Services / Menu / Tarifs */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <GroupLabel icon={Tag}>Services, menu, tarifs</GroupLabel>
              <span className="text-[11px] text-q2-fog tabular-nums mb-3">{items.length} élément{items.length > 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
              {items.length === 0 && (
                <div className="rounded-xl border border-dashed border-q2-graphite-d p-4 text-center">
                  <p className="text-[12px] text-q2-fog">Aucun élément : ajoutez votre premier service.</p>
                </div>
              )}
              {items.map(it => (
                <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    value={it.category}
                    onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, category: e.target.value } : x))}
                    className={`${compactCls} col-span-3`}
                    aria-label="Catégorie"
                  >
                    {ITEM_CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </select>
                  <input
                    value={it.name}
                    onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, name: e.target.value } : x))}
                    placeholder="Nom (ex. Coupe homme)"
                    className={`${compactCls} col-span-5`}
                    aria-label="Nom"
                  />
                  <input
                    value={it.price}
                    onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, price: e.target.value } : x))}
                    placeholder="Prix (ex. 25 €)"
                    className={`${compactCls} col-span-3`}
                    aria-label="Prix"
                  />
                  <button
                    type="button"
                    onClick={() => setItems(arr => arr.filter(x => x.id !== it.id))}
                    className="col-span-1 h-9 rounded-lg flex items-center justify-center text-q2-fog hover:text-white hover:bg-q2-obsidian transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                    title="Supprimer"
                    aria-label="Supprimer l'élément"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <GhostBtn
              type="button"
              onClick={() => setItems(arr => [...arr, { id: newId(), category: 'service', name: '', price: '' }])}
              className="mt-3"
            >
              <Plus size={13} aria-hidden="true" /> Ajouter un élément
            </GhostBtn>
          </div>

          {/* Horaires hebdomadaires */}
          <div className="mb-6">
            <GroupLabel icon={Clock3}>Horaires d'ouverture</GroupLabel>
            <div className="rounded-xl border border-q2-graphite-d overflow-hidden">
              {DAYS.map((d, i) => {
                const h = weekHours[d.k];
                return (
                  <div
                    key={d.k}
                    className={`grid grid-cols-12 gap-2 items-center px-3 py-2.5 ${i === 0 ? '' : 'border-t border-q2-graphite-d'}`}
                  >
                    <span className="col-span-3 text-[13px] font-medium text-white">{d.l}</span>
                    <div className="col-span-3 flex items-center gap-2">
                      <Toggle
                        checked={h.open}
                        onChange={() => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], open: !w[d.k].open } }))}
                        label={`${d.l} ouvert`}
                      />
                      <span
                        className="text-[11.5px] font-medium"
                        style={{ color: h.open ? 'var(--q2p-ok)' : 'var(--q2-fog)' }}
                      >
                        {h.open ? 'Ouvert' : 'Fermé'}
                      </span>
                    </div>
                    <input
                      type="time"
                      value={h.from}
                      disabled={!h.open}
                      onChange={e => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], from: e.target.value } }))}
                      className={`${compactCls} col-span-3`}
                      aria-label={`${d.l} ouverture`}
                    />
                    <input
                      type="time"
                      value={h.to}
                      disabled={!h.open}
                      onChange={e => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], to: e.target.value } }))}
                      className={`${compactCls} col-span-3`}
                      aria-label={`${d.l} fermeture`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* FAQ */}
          <div>
            <GroupLabel icon={HelpCircle}>FAQ</GroupLabel>
            <Textarea
              value={faq}
              onChange={e => setFaq(e.target.value)}
              rows={6}
              placeholder="Q : Faut-il réserver ?&#10;R : Oui, on privilégie le rendez-vous mais on accepte les walk-ins si le créneau est libre."
              className="resize-y leading-relaxed"
              style={{ minHeight: 140 }}
            />
          </div>
        </Section>

        {/* Transfert d'appel */}
        <div id="transfer" style={{ scrollMarginTop: 80 }}>
          <Section title="Transfert d'appel" hint="Vers qui basculer, et quand" id="transfert" openId={openId} setOpenId={setOpenId} icon={PhoneForwarded}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Numéro de transfert" hint="L'IA transfère les appels urgents à ce numéro">
                <Input type="tel" value={transferNumber} onChange={e => setTransferNumber(e.target.value)} placeholder="+1 (555) 000-0000" />
              </Field>
              <Field label="Type de transfert" hint="Quand transférer les appels à un humain">
                <Select value={forwardingType} onChange={e => setForwardingType(e.target.value)}>
                  <option value="">Automatique</option>
                  <option value="unconditional">Inconditionnel (tous les appels)</option>
                  <option value="busy">Si occupé</option>
                  <option value="no_answer">Si pas de réponse</option>
                  <option value="scheduled">Programmé (hors heures)</option>
                </Select>
              </Field>
            </div>
            {fwdVerified && transferNumber && (
              <div className="mt-4 flex items-center gap-2">
                <CheckCircle2 size={13} style={{ color: 'var(--q2p-ok)' }} aria-hidden="true" />
                <span className="text-[12px]" style={{ color: 'var(--q2p-ok)' }}>
                  Transfert vérifié le {new Date(fwdVerified).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}
          </Section>
        </div>

        {/* Contact et adresse */}
        <Section title="Coordonnées" hint="Adresse et téléphone de contact" id="coordonnees" openId={openId} setOpenId={setOpenId} icon={MapPin}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Téléphone de contact">
              <Input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
            </Field>
            <Field label="Adresse">
              <Input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Rue Principale" />
            </Field>
            <Field label="Ville">
              <Input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Montréal" />
            </Field>
            <Field label="Code postal">
              <Input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="H2X 1Y4" />
            </Field>
          </div>
          <div className="mt-5 rounded-xl border border-q2-graphite-d overflow-hidden">
            <Row first label="Contact principal" right={<span className="text-[12.5px] text-q2-mist">{settings?.contactName || client.contactName || 'Non renseigné'}</span>} />
            <Row label="Email" right={<span className="text-[12.5px] text-q2-mist">{settings?.contactEmail || client.contactEmail || 'Non renseigné'}</span>} />
            <Row label="Pays" right={<span className="text-[12.5px] text-q2-mist">{settings?.country || client.country || 'Non renseigné'}</span>} />
          </div>
        </Section>

        {/* Intégrations */}
        <Section title="Intégrations" hint="Agenda et outils connectés" id="integrations" openId={openId} setOpenId={setOpenId} icon={Calendar}>
          <div className="rounded-xl border border-q2-graphite-d overflow-hidden">
            {/* Google Calendar, vrai OAuth */}
            <Row
              first
              icon={Calendar}
              label="Google Calendar"
              hint="L'IA note les rendez-vous dans votre agenda et lit vos disponibilités"
              right={
                gcal?.connected ? (
                  <div className="flex items-center gap-2">
                    <Pill tone="ok"><CheckCircle2 size={11} aria-hidden="true" /> Connecté</Pill>
                    <GhostBtn onClick={disconnectGcal} disabled={gcalBusy}>Déconnecter</GhostBtn>
                  </div>
                ) : (
                  <PrimaryBtn onClick={connectGcal} disabled={gcalBusy}>
                    {gcalBusy ? 'Connexion…' : 'Connecter'}
                  </PrimaryBtn>
                )
              }
            />

            {gcal?.revoked && (
              <p className="px-4 pb-3 text-[11.5px]" style={{ color: 'var(--q2p-warn)' }}>
                Accès révoqué côté Google : reconnectez votre calendrier.
              </p>
            )}

            {/* Preuve de lecture: les prochains évènements du calendrier connecté */}
            {gcal?.connected && (gcal.upcoming?.length ?? 0) > 0 && (
              <div className="px-4 py-3 border-t border-q2-graphite-d space-y-1.5">
                <p className="q2-eyebrow text-q2-fog">Prochains rendez-vous</p>
                {gcal.upcoming!.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="truncate text-q2-mist">{ev.summary}</span>
                    <span className="shrink-0 tabular-nums text-q2-fog">
                      {ev.start ? new Date(ev.start).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Intégrations à venir, même vocabulaire de rangée */}
            {([
              { icon: Clock3,     name: 'Calendly',                desc: 'Synchronisez vos liens de réservation' },
              { icon: Globe,      name: 'Outlook / Microsoft 365', desc: 'Agenda et contacts Microsoft' },
              { icon: Tag,        name: 'Stripe',                  desc: 'Encaissements et factures liés aux appels' },
              { icon: Activity,   name: 'Slack',                   desc: 'Notification instantanée de chaque lead' },
              { icon: Settings,   name: 'Zapier',                  desc: 'Reliez Qwillio à 6000+ outils' },
            ] as { icon: LucideIcon; name: string; desc: string }[]).map(intg => (
              <Row
                key={intg.name}
                icon={intg.icon}
                label={intg.name}
                hint={intg.desc}
                right={<Pill>Bientôt</Pill>}
              />
            ))}

            <Row
              label="VAPI Assistant"
              right={
                settings?.vapiAssistantId
                  ? <Pill tone="ok">Configuré</Pill>
                  : <Pill tone="warn">En attente</Pill>
              }
            />
          </div>
        </Section>

        {/* Abonnement */}
        <Section title="Abonnement" hint="Plan, minutes et facturation" id="abonnement" openId={openId} setOpenId={setOpenId} icon={Shield}>
          <div className="rounded-xl border border-q2-graphite-d overflow-hidden">
            <Row first label="Plan" right={<Pill tone="accent">{planName}</Pill>} />
            <Row
              label="Statut"
              right={
                <Pill tone={isActive ? 'ok' : isPaused ? 'warn' : 'bad'}>
                  {status === 'active' ? 'Actif' : status === 'trialing' ? 'Essai' : status === 'paused' ? 'En pause' : status === 'cancelled' ? 'Annulé' : status}
                </Pill>
              }
            />
            {client.isTrial && client.trialEndDate && (
              <Row
                label="Fin de l'essai"
                right={<span className="text-[12.5px] tabular-nums" style={{ color: 'var(--q2p-warn)' }}>{new Date(client.trialEndDate).toLocaleDateString('fr-FR')}</span>}
              />
            )}
            {/* Minutes, pas appels: la facturation est à la minute, et les deux
                mêmes valeurs alimentent la jauge de l'entête du chat. */}
            <Row label="Quota mensuel" right={<span className="text-[12.5px] text-q2-mist tabular-nums">{quota} min</span>} />
            <Row label="Utilisées ce mois" right={<span className="text-[12.5px] text-q2-mist tabular-nums">{used} min</span>} />
            {settings?.activationDate && (
              <Row label="Activé le" right={<span className="text-[12.5px] text-q2-mist tabular-nums">{new Date(settings.activationDate).toLocaleDateString('fr-FR')}</span>} />
            )}
            {settings?.lastCallDate && (
              <Row label="Dernier appel" right={<span className="text-[12.5px] text-q2-mist tabular-nums">{new Date(settings.lastCallDate).toLocaleDateString('fr-FR')}</span>} />
            )}
          </div>
        </Section>

        {/* Aide */}
        <Card>
          <p className="text-[12px] text-q2-fog leading-relaxed q2-body-text">
            <span className="text-q2-lift font-medium">Besoin d'aide ?</span> Pour modifier la voix, le script personnalisé, ou les paramètres VAPI avancés de votre IA, contactez notre équipe via le Support. Nous nous occupons de tout en moins de 24h.
          </p>
        </Card>
      </div>
    </div>
  );
}
