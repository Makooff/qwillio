import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot, AlertCircle, Activity, Globe, Calendar,
  Settings, Mic, PhoneCall,
  CheckCircle2, XCircle, ChevronDown, ChevronRight,
  CreditCard, MapPin, PhoneForwarded, Plug,
  Tag, HelpCircle, Clock3, Plus, X,
  type LucideIcon,
} from 'lucide-react';
import api from '../../../services/api';
import type { Character } from '../../../components/v2/app/CharacterPickerV2';
import CharacterCarousel from '../../../components/v2/app/CharacterCarousel';
import VoiceCloner, { type CustomVoice } from '../../../components/v2/app/VoiceCloner';
import AssistantChat from '../../../components/client/AssistantChat';
import {
  Card, PageActions, PrimaryBtn, GhostBtn, SectionHead,
  Field, Input, Select, Textarea, Toggle, Pill, EmptyState,
} from '../../../components/v2/app/Blocks';

/* Réceptionniste IA, registre produit V2 « instrument ». L'ouverture reste
   frameless (rangée de chiffres nue, filet dessous); les réglages reprennent la
   géométrie de la page Compte: cartes, en-têtes de section, rangées de 56px
   repliables. Ce qui se lit au repos (identité, base de connaissances) est
   déplié; le reste est en accordéon. La logique est celle de la V1 (autosave
   900 ms, OAuth Google Calendar, ancres de hash); seule la peau change.
   L'assistant conversationnel vit dans un panneau latéral: il configure, il ne
   présente pas la page. */

const fieldCls =
  'h-11 sm:h-9 bg-q2-obsidian border border-q2-graphite-d rounded-lg px-3 text-[12.5px] text-white placeholder:text-q2-fog focus:outline-none focus:border-q2-indigo/60 transition-colors duration-150 disabled:opacity-40';

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

/** Le défaut du serveur, identique en français et en anglais depuis que les
    personnages sont bilingues (voice-characters.ts, DEFAULT_CHARACTER_FR et
    DEFAULT_CHARACTER_EN). */
const DEFAULT_CHARACTER_ID = 'marie';

const PERSONALITY_PRESETS: { v: string; l: string; d: string }[] = [
  { v: 'warm',         l: 'Chaleureux',   d: 'Accueillant, empathique, sourire dans la voix' },
  { v: 'professional', l: 'Professionnel', d: 'Direct, précis, cadre formel' },
  { v: 'casual',       l: 'Décontracté',  d: 'Détendu, fluide, ton conversationnel' },
  { v: 'energetic',    l: 'Énergique',    d: 'Dynamique, enthousiaste, upbeat' },
  { v: 'luxury',       l: 'Premium',      d: 'Soigné, raffiné, langage soutenu' },
  { v: 'caring',       l: 'Bienveillant', d: 'Doux, rassurant, idéal pour santé / médical' },
];

/**
 * Rangée de chiffres nue, vocabulaire KpiSplit: pas de cadre, des filets
 * verticaux, un chiffre par colonne. Sur mobile la grille passe en 2x2, donc le
 * filet gauche de la troisième cellule (première de la seconde ligne) est
 * neutralisé puis rendu à partir de sm.
 */
interface KpiItem {
  label: string;
  value: string | number;
  hint?: string;
  hintColor?: string;
  /** Valeur textuelle longue (un numéro), rendue plus petite que les chiffres. */
  wide?: boolean;
}

function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 sm:gap-y-6 divide-x divide-q2-graphite-d [&>*:nth-child(3)]:border-l-0 sm:[&>*:nth-child(3)]:border-l">
      {items.map((k) => (
        <div key={k.label} className="px-2.5 sm:px-6 first:pl-0 last:pr-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog">{k.label}</p>
          <p
            className={`${k.wide ? 'text-[15px] sm:text-[19px]' : 'text-[22px] sm:text-[26px]'} font-light tracking-tight tabular-nums leading-none mt-2 sm:mt-2.5 text-white truncate`}
          >
            {k.value}
          </p>
          {k.hint && (
            <p className="text-[11px] sm:text-[11.5px] mt-2 sm:mt-2.5 truncate" style={{ color: k.hintColor || 'var(--q2-fog)' }}>
              {k.hint}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Une section dépliée: un en-tête de section, une phrase d'aide, une carte. Ce
 * qui se lit au repos vit ici, pas derrière un chevron.
 */
function OpenSect({ id, title, hint, right, children }: {
  id?: string;
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={id ? { scrollMarginTop: 80 } : undefined}
      aria-label={title}
    >
      <SectionHead title={title} action={right} />
      {hint && <p className="text-[12px] text-q2-fog -mt-1 mb-3 q2-body-text max-w-[70ch]">{hint}</p>}
      <Card>{children}</Card>
    </section>
  );
}

/**
 * Rangée repliable de la page Compte: 56px, icône carrée, libellé, indice,
 * chevron. Le panneau s'ouvre en dessous, dans la même carte.
 */
function AccRow({ id, icon: Icon, label, hint, right, open, onToggle, first = false, children }: {
  id?: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  right?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div id={id} style={id ? { scrollMarginTop: 80 } : undefined}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full min-h-[52px] sm:min-h-[56px] flex items-center justify-between gap-3 px-3.5 sm:px-4 text-left hover:bg-q2-obsidian/60 transition-colors duration-100 focus:outline-none focus-visible:bg-q2-obsidian ${
          first ? '' : 'border-t border-q2-graphite-d'
        }`}
      >
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
          <span className="w-8 h-8 shrink-0 rounded-lg bg-q2-obsidian flex items-center justify-center">
            <Icon size={15} aria-hidden="true" className="text-q2-lift" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] sm:text-[13.5px] font-medium text-white truncate">{label}</p>
            {hint && <p className="text-[11.5px] text-q2-fog truncate">{hint}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {right}
          {open ? (
            <ChevronDown size={14} className="text-q2-fog" aria-hidden="true" />
          ) : (
            <ChevronRight size={14} className="text-q2-fog" aria-hidden="true" />
          )}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-q2-graphite-d"
          >
            <div className="p-4 sm:p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GroupLabel({ icon: Icon, children, count }: {
  icon?: LucideIcon;
  children: React.ReactNode;
  count?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-3">
      <p className="q2-eyebrow text-q2-fog flex items-center gap-2">
        {Icon && <Icon size={12} aria-hidden="true" />}
        {children}
      </p>
      {count && <span className="text-[11px] text-q2-fog tabular-nums shrink-0">{count}</span>}
    </div>
  );
}

/** Ligne de réglage nue: icône, libellé, indice, valeur à droite, filet dessous. */
function LineRow({ icon: Icon, label, hint, right }: {
  icon?: LucideIcon;
  label: React.ReactNode;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 sm:py-3.5 border-b border-q2-graphite-d">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span className="w-8 h-8 shrink-0 rounded-lg bg-q2-obsidian flex items-center justify-center">
            <Icon size={14} aria-hidden="true" className="text-q2-lift" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-white truncate">{label}</p>
          {hint && <p className="text-[11.5px] text-q2-fog truncate">{hint}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">{right}</div>
    </div>
  );
}

/**
 * Panneau latéral droit. Esc, clic sur le voile et bouton de fermeture, focus
 * posé sur la fermeture à l'ouverture et rendu au déclencheur à la sortie
 * (géré par l'appelant, qui sait quel bouton a ouvert le panneau).
 */
function SidePanel({ open, label, onClose, children }: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(frame);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-q2-void/70"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-q2-carbon border-l border-q2-graphite-d flex flex-col"
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <header className="shrink-0 border-b border-q2-graphite-d px-4 sm:px-5 h-12 sm:h-14 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] sm:text-[13.5px] font-medium text-white truncate">{label}</p>
                <p className="text-[11.5px] text-q2-fog truncate">
                  Dictez vos changements, ou lancez un appel test
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Fermer le panneau"
                className="w-11 h-11 -mr-2 sm:mr-0 sm:w-8 sm:h-8 shrink-0 rounded-lg flex items-center justify-center text-q2-fog hover:text-white hover:bg-q2-obsidian transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <div className="flex-1 min-h-0 p-2.5 sm:p-3">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
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
  const [characterId, setCharacterId] = useState<string>(DEFAULT_CHARACTER_ID);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [customVoice, setCustomVoice] = useState<CustomVoice | null>(null);
  // Réglages en accordéon: une seule rangée ouverte à la fois, comme au Compte.
  const [openRow, setOpenRow] = useState<string | null>(null);
  const toggleRow = (k: string) => setOpenRow(o => (o === k ? null : k));
  // Assistant conversationnel: un panneau, ouvert à la demande.
  const [chatOpen, setChatOpen] = useState(false);
  const chatTrigger = useRef<HTMLButtonElement | null>(null);
  const openChat = (e: React.MouseEvent<HTMLButtonElement>) => {
    chatTrigger.current = e.currentTarget;
    setChatOpen(true);
  };
  const closeChat = useCallback(() => {
    setChatOpen(false);
    chatTrigger.current?.focus();
  }, []);

  // La voix clonée est une carte de plus dans la même grille, pas un widget à
  // part : la choisir est le même geste que choisir Marie. Elle emprunte la
  // persona du personnage par défaut, parce qu'un clone ne dit rien de la façon
  // de se comporter. Ce défaut ne dépend plus de la langue : les personnages
  // sont bilingues, le serveur répond Marie dans les deux cas.
  const pickerCharacters = useMemo<Character[]>(() => {
    if (!customVoice) return characters;
    const isFr = agentLanguage !== 'en';
    const base = characters.find(c => c.id === DEFAULT_CHARACTER_ID) || characters[0];
    if (!base) return characters;
    return [
      {
        ...base,
        id: 'custom',
        name: isFr ? 'Ma voix' : 'My voice',
        taglineFr: 'Votre voix, clonée',
        taglineEn: 'Your own cloned voice',
      },
      ...characters,
    ];
  }, [characters, customVoice, agentLanguage]);

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
      setCharacterId(s?.characterId || DEFAULT_CHARACTER_ID);
      setCustomVoice(s?.customVoice?.voiceId ? s.customVoice : null);
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
    // Une ancre qui pointe vers un réglage replié doit l'ouvrir, sinon elle
    // amène l'utilisateur devant un chevron fermé.
    setOpenRow(o => (o === hash ? o : hash));
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
    <div className="space-y-6 sm:space-y-8" aria-busy="true">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-q2-graphite-d">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-3 w-24 rounded bg-white/[0.06] animate-pulse" />
            <div className="h-7 w-16 rounded bg-white/[0.06] animate-pulse" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-3 w-32 rounded bg-white/[0.06] animate-pulse" />
          <div className="rounded-xl border border-q2-graphite-d bg-q2-carbon p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />
              <div className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <span className="w-12 h-12 rounded-2xl bg-q2-obsidian flex items-center justify-center mb-4">
        <AlertCircle size={18} style={{ color: 'var(--q2p-bad)' }} aria-hidden="true" />
      </span>
      <p className="text-[13px] text-q2-fog mb-5">{error}</p>
      <PrimaryBtn onClick={load}>Réessayer</PrimaryBtn>
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

  // Compteurs de la base de connaissances. La FAQ est du texte libre : on compte
  // les lignes qui ouvrent une question, c'est la façon dont elle est écrite.
  const filledItems = items.filter(i => i.name.trim()).length;
  const openDays = DAYS.filter(d => weekHours[d.k]?.open).length;
  const faqCount = faq.split('\n').filter(l => /^\s*(q\s*[:.)\-]|question)/i.test(l)).length;

  const transferLabel = fwdVerified && transferNumber
    ? 'Transfert vérifié'
    : fwdStatus === 'pending'
      ? 'Transfert en attente'
      : 'Transfert non configuré';
  const transferColor = fwdVerified && transferNumber
    ? 'var(--q2p-ok)'
    : fwdStatus === 'pending'
      ? 'var(--q2p-warn)'
      : 'var(--q2-fog)';

  const kpis: KpiItem[] = [
    {
      label: 'Services remplis',
      value: filledItems,
      hint: filledItems > 0 ? 'dans la base de connaissances' : 'aucune prestation annoncée',
    },
    {
      label: 'Jours ouverts',
      value: `${openDays} / 7`,
      hint: openDays > 0 ? 'horaires annoncés au téléphone' : 'fermé toute la semaine',
    },
    {
      label: 'Questions FAQ',
      value: faqCount,
      hint: faqCount > 0 ? 'réponses préparées' : 'aucune réponse préparée',
    },
    phone
      ? { label: 'Numéro IA', value: phone, wide: true, hint: transferLabel, hintColor: transferColor }
      : { label: 'Numéro IA', value: 'En attribution', wide: true, hint: 'Activation en quelques minutes', hintColor: 'var(--q2p-warn)' },
  ];

  const transferPill = fwdVerified && transferNumber ? (
    <Pill tone="ok"><CheckCircle2 size={11} aria-hidden="true" /> Vérifié</Pill>
  ) : fwdStatus === 'pending' ? (
    <Pill tone="warn"><Clock3 size={11} aria-hidden="true" /> En attente</Pill>
  ) : (
    <Pill><XCircle size={11} aria-hidden="true" /> Non configuré</Pill>
  );

  return (
    <div>
      <PageActions subtitle="Chaque modification est enregistrée automatiquement.">
        <GhostBtn onClick={openChat}>
          <Mic size={13} aria-hidden="true" /> Configurer en parlant
        </GhostBtn>
        <PrimaryBtn onClick={openChat}>
          <PhoneCall size={13} aria-hidden="true" /> Appel test live
        </PrimaryBtn>
      </PageActions>

      {/* Chiffres d'ouverture: ce que l'IA sait déjà, sans cadre, filet dessous */}
      <section aria-label="État de la configuration" className="pb-4 sm:pb-6 border-b border-q2-graphite-d">
        <KpiRow items={kpis} />
      </section>

      <p className="text-[11.5px] text-q2-fog pt-3.5 sm:pt-4 q2-body-text">
        Astuce : le panneau « Configurer en parlant » modifie ces réglages à votre place, et lance un appel test avec la voix choisie.
      </p>

      <div className="mt-5 sm:mt-7 space-y-5 sm:space-y-7">
      {/* Identité: dépliée, c'est le premier réglage que l'on vient toucher */}
      <OpenSect
        id="identite"
        title="Identité de l'agent"
        hint="Le nom que l'IA donne au téléphone, la langue principale de vos appels, et le personnage qui répond. Chaque personnage parle français et anglais."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nom de l'agent" hint="Le prénom utilisé par l'IA pour se présenter">
            <Input type="text" value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Ex: Marie, Lucas..." />
          </Field>
          <Field label="Langue" hint="Langue principale de vos appels">
            <Select value={agentLanguage} onChange={e => setAgentLanguage(e.target.value)}>
              <option value="en">Anglais</option>
              <option value="fr">Français</option>
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

        {characters.length > 0 && (
          <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-q2-graphite-d">
            <GroupLabel>Personnage de la réceptionniste</GroupLabel>
            <p className="text-[12px] text-q2-fog mb-4 q2-body-text max-w-[62ch]">
              Naviguez avec les flèches pour choisir qui répond à vos appels. Le bouton lecture donne un aperçu
              dans votre langue, le crayon ouvre le catalogue complet.
            </p>
            <CharacterCarousel
              characters={pickerCharacters}
              value={characterId}
              onChange={setCharacterId}
              isFr={agentLanguage !== 'en'}
            />
            <VoiceCloner
              voice={customVoice}
              isFr={agentLanguage !== 'en'}
              onChange={v => {
                setCustomVoice(v);
                // Cloner sélectionne la nouvelle voix ; supprimer ne doit pas
                // laisser la sélection pointer sur une carte disparue, donc on
                // retombe sur le défaut du serveur.
                setCharacterId(v ? 'custom' : DEFAULT_CHARACTER_ID);
              }}
            />
          </div>
        )}
      </OpenSect>

      {/* Ton et personnalisation, une seule carte */}
      <OpenSect
        title="Ton"
        hint="Affinage optionnel de la façon de parler. Le personnage porte la voix, le ton porte l'attitude."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          {PERSONALITY_PRESETS.map(p => {
            const sel = personalityPreset === p.v;
            return (
              <button
                key={p.v}
                type="button"
                aria-pressed={sel}
                onClick={() => setPersonalityPreset(p.v)}
                className="text-left py-3 pr-3 border-b border-q2-graphite-d transition-colors duration-150 hover:bg-white/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-150"
                    style={{ background: sel ? 'var(--q2-lift)' : 'var(--q2-border-d)' }}
                  />
                  <span className={`text-[13px] font-medium ${sel ? 'text-white' : 'text-q2-mist'}`}>{p.l}</span>
                </span>
                <span className="block text-[11.5px] mt-1 pl-4 text-q2-fog">{p.d}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-q2-graphite-d">
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
      </OpenSect>

      {/* Base de connaissances: dépliée, c'est le corps du réglage */}
      <OpenSect
        title="Base de connaissances"
        hint="Ce que l'IA doit savoir pour répondre aux appelants : services, menu, tarifs, horaires, FAQ. Plus c'est précis, plus elle sera précise."
      >
        <GroupLabel
          icon={Tag}
          count={filledItems > 0 ? `${filledItems} entrée${filledItems > 1 ? 's' : ''}` : 'Vide'}
        >
          Services et tarifs
        </GroupLabel>

        {items.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="Aucun service enregistré"
            description="Ajoutez vos prestations, votre menu ou vos tarifs pour que l'IA puisse les annoncer au téléphone."
          />
        ) : (
          <div>
            {items.map(it => (
              <div
                key={it.id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 py-2 sm:py-2.5 border-b border-q2-graphite-d"
              >
                <select
                  value={it.category}
                  onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, category: e.target.value } : x))}
                  className={`${fieldCls} w-[118px] shrink-0`}
                  aria-label="Catégorie"
                >
                  {ITEM_CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
                <input
                  value={it.name}
                  onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, name: e.target.value } : x))}
                  placeholder="Nom (ex. Coupe homme)"
                  className={`${fieldCls} flex-1 min-w-[140px]`}
                  aria-label="Nom"
                />
                <input
                  value={it.price}
                  onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, price: e.target.value } : x))}
                  placeholder="Prix (ex. 25 €)"
                  className={`${fieldCls} w-[104px] shrink-0`}
                  aria-label="Prix"
                />
                <button
                  type="button"
                  onClick={() => setItems(arr => arr.filter(x => x.id !== it.id))}
                  className="w-11 h-11 sm:w-9 sm:h-9 shrink-0 rounded-lg flex items-center justify-center text-q2-fog hover:text-white hover:bg-q2-obsidian transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                  title="Supprimer"
                  aria-label={`Supprimer ${it.name || "l'élément"}`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        <GhostBtn
          type="button"
          onClick={() => setItems(arr => [...arr, { id: newId(), category: 'service', name: '', price: '' }])}
          className="mt-4"
        >
          <Plus size={13} aria-hidden="true" /> Ajouter un élément
        </GhostBtn>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-0 lg:divide-x divide-q2-graphite-d mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-q2-graphite-d">
          <div className="lg:pr-10">
            <GroupLabel
              icon={Clock3}
              count={openDays > 0 ? `${openDays} jour${openDays > 1 ? 's' : ''} sur 7` : 'Fermé'}
            >
              Horaires d'ouverture
            </GroupLabel>
            {DAYS.map(d => {
              const h = weekHours[d.k];
              return (
                <div
                  key={d.k}
                  className="flex flex-wrap items-center gap-2 sm:gap-3 py-2 border-b border-q2-graphite-d last:border-b-0"
                >
                  <span className="w-[66px] sm:w-[78px] shrink-0 text-[13px] font-medium text-white">{d.l}</span>
                  <Toggle
                    checked={h.open}
                    onChange={() => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], open: !w[d.k].open } }))}
                    label={`${d.l} ouvert`}
                  />
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    <input
                      type="time"
                      value={h.from}
                      disabled={!h.open}
                      onChange={e => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], from: e.target.value } }))}
                      className={`${fieldCls} w-[84px] sm:w-[96px]`}
                      aria-label={`${d.l} ouverture`}
                    />
                    <span className="text-[11.5px] text-q2-fog">à</span>
                    <input
                      type="time"
                      value={h.to}
                      disabled={!h.open}
                      onChange={e => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], to: e.target.value } }))}
                      className={`${fieldCls} w-[84px] sm:w-[96px]`}
                      aria-label={`${d.l} fermeture`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:pl-10">
            <GroupLabel
              icon={HelpCircle}
              count={faqCount > 0 ? `${faqCount} question${faqCount > 1 ? 's' : ''}` : 'Vide'}
            >
              FAQ
            </GroupLabel>
            <Textarea
              value={faq}
              onChange={e => setFaq(e.target.value)}
              rows={8}
              placeholder="Q : Faut-il réserver ?&#10;R : Oui, on privilégie le rendez-vous mais on accepte les walk-ins si le créneau est libre."
              className="resize-y leading-relaxed"
              style={{ minHeight: 232 }}
              aria-label="FAQ"
            />
            <p className="mt-2 text-[11px] text-q2-fog">
              Une question par ligne commençant par Q, la réponse sur la ligne suivante.
            </p>
          </div>
        </div>
      </OpenSect>

      {/* Réglages: repliés par défaut, géométrie de la page Compte */}
      <section aria-label="Réglages">
        <SectionHead title="Réglages" />
        <Card pad={false}>

      <AccRow
        first
        id="transfer"
        icon={PhoneForwarded}
        label="Transfert d'appel"
        hint={transferNumber || 'Aucun numéro de transfert'}
        right={transferPill}
        open={openRow === 'transfer'}
        onToggle={() => toggleRow('transfer')}
      >
        <p className="text-[12px] text-q2-fog mb-4 q2-body-text max-w-[62ch]">
          Vers qui basculer, et quand. L'IA passe la main avec un résumé de ce qu'elle a compris.
        </p>
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
      </AccRow>

      <AccRow
        icon={MapPin}
        label="Coordonnées"
        hint={[address, city].filter(Boolean).join(', ') || 'Adresse, téléphone de contact'}
        open={openRow === 'coordonnees'}
        onToggle={() => toggleRow('coordonnees')}
      >
        <p className="text-[12px] text-q2-fog mb-4 q2-body-text max-w-[62ch]">
          Adresse et téléphone de contact, tels que l'IA les donne aux appelants.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
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
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-10">
          <LineRow
            label="Contact principal"
            right={<span className="text-[12.5px] text-q2-mist">{settings?.contactName || client.contactName || 'Non renseigné'}</span>}
          />
          <LineRow
            label="Email"
            right={<span className="text-[12.5px] text-q2-mist truncate">{settings?.contactEmail || client.contactEmail || 'Non renseigné'}</span>}
          />
          <LineRow
            label="Pays"
            right={<span className="text-[12.5px] text-q2-mist">{settings?.country || client.country || 'Non renseigné'}</span>}
          />
        </div>
      </AccRow>

      <AccRow
        icon={Plug}
        label="Intégrations"
        hint={gcal?.connected ? 'Google Calendar connecté' : 'Agenda et outils connectés'}
        right={gcal?.connected ? <Pill tone="ok">Actif</Pill> : undefined}
        open={openRow === 'integrations'}
        onToggle={() => toggleRow('integrations')}
      >
        <p className="text-[12px] text-q2-fog mb-4 q2-body-text max-w-[62ch]">
          L'IA note les rendez-vous là où vous les lisez déjà.
        </p>
        <LineRow
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
          <p className="py-3 text-[11.5px]" style={{ color: 'var(--q2p-warn)' }}>
            Accès révoqué côté Google : reconnectez votre calendrier.
          </p>
        )}

        {gcal?.connected && (gcal.upcoming?.length ?? 0) > 0 && (
          <div className="py-4 border-b border-q2-graphite-d space-y-1.5">
            <p className="q2-eyebrow text-q2-fog mb-2">Prochains rendez-vous</p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
          {([
            { icon: Clock3,   name: 'Calendly',                desc: 'Synchronisez vos liens de réservation' },
            { icon: Globe,    name: 'Outlook / Microsoft 365', desc: 'Agenda et contacts Microsoft' },
            { icon: Tag,      name: 'Stripe',                  desc: 'Encaissements et factures liés aux appels' },
            { icon: Activity, name: 'Slack',                   desc: 'Notification instantanée de chaque lead' },
            { icon: Settings, name: 'Zapier',                  desc: 'Reliez Qwillio à 6000+ outils' },
            { icon: Bot,      name: 'VAPI Assistant',          desc: 'Moteur vocal de votre réceptionniste' },
          ] as { icon: LucideIcon; name: string; desc: string }[]).map(intg => (
            <LineRow
              key={intg.name}
              icon={intg.icon}
              label={intg.name}
              hint={intg.desc}
              right={
                intg.name === 'VAPI Assistant'
                  ? (settings?.vapiAssistantId ? <Pill tone="ok">Configuré</Pill> : <Pill tone="warn">En attente</Pill>)
                  : <Pill>Bientôt</Pill>
              }
            />
          ))}
        </div>
      </AccRow>

      <AccRow
        icon={CreditCard}
        label="Abonnement"
        hint={`Plan ${planName}, ${quota} min incluses`}
        right={
          <Pill tone={isActive ? 'ok' : isPaused ? 'warn' : 'bad'}>
            {status === 'active' ? 'Actif' : status === 'trialing' ? 'Essai' : status === 'paused' ? 'En pause' : status === 'cancelled' ? 'Annulé' : status}
          </Pill>
        }
        open={openRow === 'abonnement'}
        onToggle={() => toggleRow('abonnement')}
      >
        <p className="text-[12px] text-q2-fog mb-4 q2-body-text max-w-[62ch]">
          Plan, minutes incluses et facturation. Les détails complets vivent sur la page Facturation.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
          <LineRow label="Plan" right={<Pill tone="accent">{planName}</Pill>} />
          <LineRow label="Quota mensuel" right={<span className="text-[12.5px] text-q2-mist tabular-nums">{quota} min</span>} />
          <LineRow label="Utilisées ce mois" right={<span className="text-[12.5px] text-q2-mist tabular-nums">{used} min</span>} />
          {client.isTrial && client.trialEndDate && (
            <LineRow
              label="Fin de l'essai"
              right={<span className="text-[12.5px] tabular-nums" style={{ color: 'var(--q2p-warn)' }}>{new Date(client.trialEndDate).toLocaleDateString('fr-FR')}</span>}
            />
          )}
          {settings?.activationDate && (
            <LineRow label="Activé le" right={<span className="text-[12.5px] text-q2-mist tabular-nums">{new Date(settings.activationDate).toLocaleDateString('fr-FR')}</span>} />
          )}
          {settings?.lastCallDate && (
            <LineRow label="Dernier appel" right={<span className="text-[12.5px] text-q2-mist tabular-nums">{new Date(settings.lastCallDate).toLocaleDateString('fr-FR')}</span>} />
          )}
        </div>
      </AccRow>

      <AccRow
        icon={HelpCircle}
        label="Besoin d'aide"
        hint="Voix sur mesure, script avancé, réglages VAPI"
        open={openRow === 'aide'}
        onToggle={() => toggleRow('aide')}
      >
        <p className="text-[12.5px] text-q2-mist leading-relaxed q2-body-text max-w-[70ch]">
          Pour modifier la voix, le script personnalisé, ou les paramètres VAPI avancés de votre IA, contactez notre équipe via le Support. Nous nous occupons de tout en moins de 24h.
        </p>
      </AccRow>

        </Card>
      </section>
      </div>

      {/* Assistant conversationnel, à la demande, jamais en travers de la page */}
      <SidePanel open={chatOpen} onClose={closeChat} label="Configurer en parlant">
        {/* AssistantChat fixe sa propre hauteur: dans un panneau, elle suit le panneau */}
        <div className="h-full [&>div]:!h-full">
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
      </SidePanel>
    </div>
  );
}
