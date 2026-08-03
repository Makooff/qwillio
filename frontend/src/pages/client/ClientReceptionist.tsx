import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, PhoneForwarded, AlertCircle,
  Activity, Power, Globe, User, Clock, Shield, Calendar,
  Volume2, Languages, Building2, MapPin, Settings,
  ChevronDown, ChevronRight, CheckCircle2, XCircle,
  BookOpen, Tag, HelpCircle, Clock3, Plus, X,
} from 'lucide-react';
import api from '../../services/api';
import CharacterPicker, { type Character } from '../../components/client/CharacterPicker';
import AssistantChat from '../../components/client/AssistantChat';
import VoiceCloner, { type CustomVoice } from '../../components/client/VoiceCloner';

const inputCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7349fe]/50 transition-colors disabled:opacity-50';
const selectCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] focus:outline-none focus:border-[#7349fe]/50 transition-colors disabled:opacity-50';
const compactInputCls = 'h-9 px-3 text-[13px] rounded-lg border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] placeholder-[#6B6B75] focus:outline-none focus:border-[#7349fe]/50 transition-colors disabled:opacity-50';

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
 * One section, on the vocabulary of the account settings page: a 58px row with
 * a 32px icon tile, a label, a hint, and a chevron.
 *
 * They open one at a time rather than all at once. Sub-pages were the other
 * option, but the whole form shares one autosave effect, so routing would have
 * meant either lifting every field or loading the settings once per page. An
 * accordion gives the same "one thing at a time" reading without splitting
 * state that has no reason to be split.
 */
function Section({ title, hint, icon: Icon, children, id, openId, setOpenId }: {
  title: string;
  hint?: string;
  icon: React.ElementType;
  color?: string;
  children: React.ReactNode;
  id: string;
  openId: string | null;
  setOpenId: (v: string | null) => void;
}) {
  const open = openId === id;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
      <button
        type="button"
        onClick={() => setOpenId(open ? null : id)}
        aria-expanded={open}
        className="w-full flex items-center gap-3.5 px-4 h-[58px] text-left group transition-colors hover:bg-white/[0.02]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: 'rgba(255,255,255,0.05)' }}>
          <Icon size={14} className="text-[#F5F5F7]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#F5F5F7] truncate">{title}</p>
          {hint && <p className="text-[11.5px] text-[#6B6B75] truncate">{hint}</p>}
        </div>
        {open
          ? <ChevronDown size={14} className="text-[#6B6B75] flex-shrink-0" />
          : <ChevronRight size={14} className="text-[#6B6B75] opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
      </button>
      {open && <div className="px-4 pb-5 pt-1 border-t border-white/[0.05]">{children}</div>}
    </motion.div>
  );
}

function Row({ l, v, c }: { l: string; v: string; c?: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-white/[0.03] last:border-0">
      <span className="text-[11px] text-[#8B8BA7]">{l}</span>
      <span className="text-[11px] font-semibold" style={{ color: c ?? '#F8F8FF' }}>{v}</span>
    </div>
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
  const [customVoice, setCustomVoice] = useState<CustomVoice | null>(null);
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

  // The cloned voice is one more card in the same grid, not a separate widget:
  // choosing it is the same gesture as choosing Marie. It carries the language
  // default's persona because a clone says nothing about how to behave.
  const pickerCharacters = useMemo<Character[]>(() => {
    if (!customVoice) return characters;
    const isFr = agentLanguage !== 'en';
    const base = characters.find(c => c.id === (isFr ? 'marie' : 'ashley')) || characters[0];
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
      setCharacterId(s?.characterId || 'marie');
      setCustomVoice(s?.customVoice?.voiceId ? s.customVoice : null);
      // Values below come from the server → don't trigger an auto-save.
      hydrated.current = true;
      skipAutosave.current = true;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Google OAuth redirect lands back here with ?code=&state= — finish the handshake
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
    } catch { /* silent — the next edit retries */ }
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
    <div className="max-w-3xl space-y-4" aria-busy="true">
      <div className="space-y-2"><div className="h-6 w-48 rounded-lg bg-white/[0.06] animate-pulse" /><div className="h-4 w-64 rounded bg-white/[0.05] animate-pulse" /></div>
      <div className="h-40 rounded-2xl bg-white/[0.04] animate-pulse" />
      <div className="h-40 rounded-2xl bg-white/[0.04] animate-pulse" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <AlertCircle className="w-10 h-10 text-[#EF4444] mb-3" />
      <p className="text-sm text-[#8B8BA7]">{error}</p>
      <button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-[#7349fe] text-white text-sm">Réessayer</button>
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
    <div className="max-w-3xl space-y-4">
      {/* Assistant conversationnel : parler pour configurer et onboarder.
          Il porte aussi l'identité de la page (titre, entreprise, plan), le
          numéro copiable, l'appel test live et la jauge de minutes, pour que
          tout ce qui décrit la réceptionniste soit au même endroit. */}
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

      {/* Bande d'état. Le numéro, le plan et la jauge de minutes sont
          désormais dans l'entête du chat ; les compteurs d'appels et de leads
          vivent sur la page Appels et sur l'accueil. Il ne reste ici que ce
          qui n'existe nulle part ailleurs : l'état du transfert d'appel, et
          l'attente d'attribution du numéro. */}
      <div className="space-y-3">
        {!phone && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <AlertCircle size={13} className="text-amber-400 flex-shrink-0" />
            <p className="text-[12px] text-[#9A9AA5]">Numéro IA en cours d'attribution</p>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <PhoneForwarded size={13} className="text-[#9A9AA5] flex-shrink-0" />
            <span className="text-[12px] text-[#9A9AA5] truncate">Transfert d'appel</span>
          </div>
          {fwdVerified && transferNumber ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 flex-shrink-0"><CheckCircle2 size={12} /> Vérifié</span>
          ) : fwdStatus === 'pending' ? (
            <span className="flex items-center gap-1 text-[11px] text-amber-400 flex-shrink-0"><Clock size={12} /> En attente</span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-[#6B6B75] flex-shrink-0"><XCircle size={12} /> Non configuré</span>
          )}
        </motion.div>
      </div>

      {/* —— Agent identity —— */}
      <Section title="Identité de l'agent" hint="Nom, langue, voix et caractère" id="identite" openId={openId} setOpenId={setOpenId} icon={Bot}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Nom de l'agent</label>
            <input type="text" value={agentName} onChange={e => setAgentName(e.target.value)}
              placeholder="Ex: Ashley, Marie..." className={inputCls} />
            <p className="text-[10px] text-[#8B8BA7] mt-1">Le prénom utilisé par l'IA pour se présenter</p>
          </div>
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Langue</label>
            <select value={agentLanguage} onChange={e => setAgentLanguage(e.target.value)} className={selectCls}>
              <option value="en">Anglais (Ashley)</option>
              <option value="fr">Français (Marie)</option>
            </select>
            <p className="text-[10px] text-[#8B8BA7] mt-1">Langue parlée par votre réceptionniste IA</p>
          </div>
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Nom de l'entreprise</label>
            <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
              placeholder="Ex: Plomberie Dupont" className={inputCls} />
            <p className="text-[10px] text-[#8B8BA7] mt-1">Utilisé par l'IA pour se présenter au téléphone</p>
          </div>
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Type d'entreprise</label>
            <select value={businessType} onChange={e => setBusinessType(e.target.value)} className={selectCls}>
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
            </select>
          </div>
        </div>

        {/* —— Personnage (voix + personnalité) —— */}
        {characters.length > 0 && (
          <div className="mt-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5] mb-3">
              Personnage de la réceptionniste
            </label>
            <p className="text-[12px] text-[#8B8BA7] mb-3 leading-relaxed">
              Choisissez la voix et le caractère qui répond à vos appels. Cliquez sur ▶ pour un aperçu.
            </p>
            <CharacterPicker
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
                // Cloning selects the new voice; deleting it must not leave the
                // selection pointing at a card that no longer exists.
                setCharacterId(v ? 'custom' : (agentLanguage === 'en' ? 'ashley' : 'marie'));
              }}
            />
          </div>
        )}

        {/* —— Ton (affinage optionnel) + personnalisation libre —— */}
        <div className="mt-6">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5] mb-3">
            Ton (affinage optionnel)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {PERSONALITY_PRESETS.map(p => {
              const sel = personalityPreset === p.v;
              return (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setPersonalityPreset(p.v)}
                  className="text-left p-3 rounded-xl border transition-colors"
                  style={{
                    background: sel ? 'rgba(122,95,255,0.10)' : '#0A0A0C',
                    borderColor: sel ? 'rgba(122,95,255,0.55)' : 'rgba(255,255,255,0.08)',
                    color: sel ? '#7349fe' : '#F2F2F2',
                  }}
                >
                  <p className="text-[13px] font-semibold">{p.l}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: sel ? 'rgba(122,95,255,0.85)' : '#8B8BA7' }}>{p.d}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5] mb-2">
            Personnalisation
          </label>
          <textarea
            value={personalityNotes}
            onChange={e => setPersonalityNotes(e.target.value)}
            rows={4}
            placeholder="Précisez ce qui vous est propre : promotions en cours, mots à utiliser, à éviter, formule d'accueil…"
            className={`${inputCls} resize-y leading-relaxed`}
            style={{ minHeight: 100 }}
          />
        </div>
      </Section>

      {/* —— Connaissances IA — items list + week schedule —— */}
      <Section title="Base de connaissances" hint="Services, tarifs, horaires et FAQ" id="connaissances" openId={openId} setOpenId={setOpenId} icon={BookOpen}>
        <p className="text-[12px] text-[#9A9AA5] mb-5 leading-relaxed">
          Ce que l'IA doit savoir pour répondre aux appelants : services, menu,
          tarifs, horaires, FAQ. Plus c'est précis, plus elle sera précise.
        </p>

        {/* —— Services / Menu / Tarifs —— */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5]">
              <Tag size={12} /> Services, menu, tarifs
            </label>
            <span className="text-[11px] text-[#6B6B75]">{items.length} élément{items.length > 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-2">
            {items.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/[0.08] p-4 text-center">
                <p className="text-[12px] text-[#6B6B75]">Aucun élément — ajoutez votre premier service.</p>
              </div>
            )}
            {items.map(it => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={it.category}
                  onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, category: e.target.value } : x))}
                  className={`${compactInputCls} col-span-3`}
                >
                  {ITEM_CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
                <input
                  value={it.name}
                  onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, name: e.target.value } : x))}
                  placeholder="Nom (ex. Coupe homme)"
                  className={`${compactInputCls} col-span-5`}
                />
                <input
                  value={it.price}
                  onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, price: e.target.value } : x))}
                  placeholder="Prix (ex. 25â‚¬)"
                  className={`${compactInputCls} col-span-3`}
                />
                <button
                  type="button"
                  onClick={() => setItems(arr => arr.filter(x => x.id !== it.id))}
                  className="col-span-1 h-9 rounded-lg flex items-center justify-center hover:bg-red-500/[0.08] hover:text-red-400 transition-colors text-[#6B6B75]"
                  title="Supprimer"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setItems(arr => [...arr, { id: newId(), category: 'service', name: '', price: '' }])}
            className="mt-3 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-[12.5px] font-medium border border-white/[0.08] hover:bg-white/[0.04] transition-colors text-[#F2F2F2]"
          >
            <Plus size={13} /> Ajouter un élément
          </button>
        </div>

        {/* —— Horaires hebdomadaires —— */}
        <div className="mb-6">
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5] mb-3">
            <Clock3 size={12} /> Horaires d'ouverture
          </label>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
            {DAYS.map(d => {
              const h = weekHours[d.k];
              return (
                <div key={d.k} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5">
                  <span className="col-span-3 text-[13px] font-medium text-[#F2F2F2]">{d.l}</span>
                  <button
                    type="button"
                    onClick={() => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], open: !w[d.k].open } }))}
                    className="col-span-3 h-8 px-3 rounded-lg text-[11.5px] font-semibold uppercase tracking-wider transition-colors"
                    style={{
                      background: h.open ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.08)',
                      color:      h.open ? '#22C55E' : '#EF4444',
                    }}
                  >
                    {h.open ? 'Ouvert' : 'Fermé'}
                  </button>
                  <input
                    type="time"
                    value={h.from}
                    disabled={!h.open}
                    onChange={e => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], from: e.target.value } }))}
                    className={`${compactInputCls} col-span-3 disabled:opacity-30`}
                  />
                  <input
                    type="time"
                    value={h.to}
                    disabled={!h.open}
                    onChange={e => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], to: e.target.value } }))}
                    className={`${compactInputCls} col-span-3 disabled:opacity-30`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* —— FAQ —— */}
        <div className="mb-6">
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5] mb-2">
            <HelpCircle size={12} /> FAQ
          </label>
          <textarea
            value={faq}
            onChange={e => setFaq(e.target.value)}
            rows={6}
            placeholder="Q : Faut-il réserver ?&#10;R : Oui, on privilégie le rendez-vous mais on accepte les walk-ins si le créneau est libre."
            className={`${inputCls} resize-y leading-relaxed`}
            style={{ minHeight: 140 }}
          />
        </div>

      </Section>

      {/* —— Transfert d'appel —— */}
      <div id="transfer" style={{ scrollMarginTop: 80 }}>
      <Section title="Transfert d'appel" hint="Vers qui basculer, et quand" id="transfert" openId={openId} setOpenId={setOpenId} icon={PhoneForwarded}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Numéro de transfert</label>
            <input type="tel" value={transferNumber} onChange={e => setTransferNumber(e.target.value)}
              placeholder="+1 (555) 000-0000" className={inputCls} />
            <p className="text-[10px] text-[#8B8BA7] mt-1">L'IA transfère les appels urgents à ce numéro</p>
          </div>
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Type de transfert</label>
            <select value={forwardingType} onChange={e => setForwardingType(e.target.value)} className={selectCls}>
              <option value="">Automatique</option>
              <option value="unconditional">Inconditionnel (tous les appels)</option>
              <option value="busy">Si occupé</option>
              <option value="no_answer">Si pas de réponse</option>
              <option value="scheduled">Programmé (hors heures)</option>
            </select>
            <p className="text-[10px] text-[#8B8BA7] mt-1">Quand transférer les appels à un humain</p>
          </div>
        </div>
        {fwdVerified && transferNumber && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-400/5 border border-emerald-400/15">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span className="text-xs text-emerald-400">Transfert vérifié le {new Date(fwdVerified).toLocaleDateString('fr-FR')}</span>
          </div>
        )}
      </Section>
      </div>

      {/* —— Contact & adresse —— */}
      <Section title="Coordonnées" hint="Adresse et téléphone de contact" id="coordonnees" openId={openId} setOpenId={setOpenId} icon={MapPin}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Téléphone de contact</label>
            <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
              placeholder="+1 (555) 000-0000" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Adresse</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="123 Rue Principale" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Ville</label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)}
              placeholder="Montréal" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Code postal</label>
            <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)}
              placeholder="H2X 1Y4" className={inputCls} />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-white/[0.04]">
          <Row l="Contact principal" v={settings?.contactName || client.contactName || '—'} />
          <Row l="Email" v={settings?.contactEmail || client.contactEmail || '—'} />
          <Row l="Pays" v={settings?.country || client.country || '—'} />
        </div>
      </Section>

      {/* —— Intégrations —— */}
      <Section title="Intégrations" hint="Agenda et outils connectés" id="integrations" openId={openId} setOpenId={setOpenId} icon={Calendar}>
        <div className="space-y-3">
          {/* Google Calendar — real OAuth connect */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                <Calendar size={16} className="text-white/70" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#F8F8FF]">Google Calendar</p>
                <p className="text-[11px] text-[#8B8BA7] leading-snug">
                  L'IA note les rendez-vous dans votre agenda et lit vos disponibilités
                </p>
              </div>
              {gcal?.connected ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-[#22C55E]">
                    <CheckCircle2 size={13} /> Connecté
                  </span>
                  <button
                    onClick={disconnectGcal}
                    disabled={gcalBusy}
                    className="px-3 py-1.5 text-[11px] font-medium rounded-lg text-white/60 bg-white/[0.06] hover:bg-white/[0.10] transition-colors disabled:opacity-50"
                  >
                    Déconnecter
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectGcal}
                  disabled={gcalBusy}
                  className="px-3.5 py-2 text-[12px] font-medium rounded-lg text-white bg-[#7349fe] hover:bg-[#8a6fff] transition-colors disabled:opacity-50"
                >
                  {gcalBusy ? 'Connexion…' : 'Connecter'}
                </button>
              )}
            </div>

            {gcal?.revoked && (
              <p className="mt-2 text-[11px] text-[#F59E0B]">
                Accès révoqué côté Google : reconnectez votre calendrier.
              </p>
            )}

            {/* Read proof: next events from the connected calendar */}
            {gcal?.connected && (gcal.upcoming?.length ?? 0) > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-[#8B8BA7]">Prochains rendez-vous</p>
                {gcal.upcoming!.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="truncate text-white/80">{ev.summary}</span>
                    <span className="flex-shrink-0 tabular-nums text-white/40">
                      {ev.start ? new Date(ev.start).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coming-soon integrations, same card format */}
          {([
            { icon: Clock3,     name: 'Calendly',            desc: 'Synchronisez vos liens de réservation' },
            { icon: Globe,      name: 'Outlook / Microsoft 365', desc: 'Agenda et contacts Microsoft' },
            { icon: Tag,        name: 'Stripe',              desc: 'Encaissements et factures liés aux appels' },
            { icon: Activity,   name: 'Slack',               desc: 'Notification instantanée de chaque lead' },
            { icon: Settings,   name: 'Zapier',              desc: 'Reliez Qwillio à 6000+ outils' },
          ] as { icon: typeof Calendar; name: string; desc: string }[]).map(intg => (
            <div key={intg.name} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 opacity-70">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                <intg.icon size={16} className="text-white/60" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#F8F8FF]">{intg.name}</p>
                <p className="text-[11px] text-[#8B8BA7] leading-snug">{intg.desc}</p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-medium text-white/50">
                Bientôt
              </span>
            </div>
          ))}

          <div className="pt-3 border-t border-white/[0.04]">
            <Row l="VAPI Assistant" v={settings?.vapiAssistantId ? 'Configuré' : 'En attente'} c={settings?.vapiAssistantId ? '#22C55E' : '#F59E0B'} />
          </div>
        </div>
      </Section>

      {/* —— Subscription info —— */}
      <Section title="Abonnement" hint="Plan, minutes et facturation" id="abonnement" openId={openId} setOpenId={setOpenId} icon={Shield}>
        <Row l="Plan" v={planName} c="#7349fe" />
        <Row l="Statut" v={
          status === 'active' ? 'Actif' : status === 'trialing' ? 'Essai' : status === 'paused' ? 'En pause' : status === 'cancelled' ? 'Annulé' : status
        } c={isActive ? '#22C55E' : isPaused ? '#F59E0B' : '#EF4444'} />
        {client.isTrial && client.trialEndDate && (
          <Row l="Fin de l'essai" v={new Date(client.trialEndDate).toLocaleDateString('fr-FR')} c="#F59E0B" />
        )}
        {/* Minutes, not calls: billing is per minute, and the same two values
            feed the gauge in the chat header. */}
        <Row l="Quota mensuel" v={`${quota} min`} />
        <Row l="Utilisées ce mois" v={`${used} min`} />
        {settings?.activationDate && <Row l="Activé le" v={new Date(settings.activationDate).toLocaleDateString('fr-FR')} />}
        {settings?.lastCallDate && <Row l="Dernier appel" v={new Date(settings.lastCallDate).toLocaleDateString('fr-FR')} />}
      </Section>

      {/* —— Info box —— */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="rounded-xl border border-[#7349fe]/15 bg-[#7349fe]/[0.04] p-4">
        <p className="text-xs text-[#8B8BA7] leading-relaxed">
          <span className="text-[#7349fe] font-medium">Besoin d'aide ?</span> — Pour modifier la voix, le script personnalisé, ou les paramètres VAPI avancés de votre IA, contactez notre équipe via le Support. Nous nous occupons de tout en moins de 24h.
        </p>
      </motion.div>
    </div>
  );
}
