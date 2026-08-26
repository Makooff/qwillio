import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, PhoneForwarded, Phone, AlertCircle,
  Activity, Power, Globe, User, Clock, Shield, Calendar,
  Volume2, Languages, Building2, Settings,
  CheckCircle2, XCircle,
  BookOpen, Tag, HelpCircle, Clock3, Plus, X,
} from '../../components/icons';
import api from '../../services/api';
/* Le cache `liveData` vient de master, le carrousel vient d'ici: les deux se
   cumulent. CharacterPicker (la grille) n'est plus importé, c'est le carrousel
   qui a pris sa place dans le rendu. */
import { invalidateLive, fetchLive, peekLive } from '../../services/liveData';
import { type Character } from '../../components/client/CharacterPicker';
import CharacterCarousel from '../../components/v2/app/CharacterCarousel';
import AssistantChat from '../../components/client/AssistantChat';
import VoiceCloner, { type CustomVoice } from '../../components/client/VoiceCloner';
import OwnNumber from '../../components/client/OwnNumber';
import { HubGroup, HubRow, HubPanel } from '../../components/client/SettingsHub';

/**
 * The endpoints this tab reads, as the cache knows them.
 *
 * Spelled out in one place because they have to match the strings the boot
 * warms exactly — a query string out of step is a cache miss, which is a
 * spinner.
 */
const RECEPTIONIST_KEYS = {
  overview: '/my-dashboard/overview',
  settings: '/my-dashboard/settings',
  gcal: '/my-dashboard/integrations/google-calendar/status',
  characters: '/my-dashboard/characters',
};

const inputCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7349fe]/50 transition-colors disabled:opacity-50';
const selectCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] focus:outline-none focus:border-[#7349fe]/50 transition-colors disabled:opacity-50';
const compactInputCls = 'h-9 px-3 text-[13px] rounded-lg border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] placeholder-[#6B6B75] focus:outline-none focus:border-[#7349fe]/50 transition-colors disabled:opacity-50';

interface KbItem { id: string; category: string; name: string; price: string; }
interface FaqEntry { q: string; a: string; }
/**
 * Ce que le serveur propose pour le métier du client.
 *
 * Le type est ici, le CONTENU vient de `/my-dashboard/settings`. C'est
 * volontaire: quatre tables de niches existaient déjà côté backend et ne
 * s'accordaient pas. En poser une cinquième dans le front aurait garanti qu'un
 * client voie les questions d'un métier et les présets d'un autre.
 */
interface KnowledgePresets {
  itemCategories: { v: string; l: string }[];
  fields: { id: string; label: string; placeholder: string; multiline?: boolean }[];
  faq: FaqEntry[];
}
interface DayHours { open: boolean; from: string; to: string; }
type WeekDay = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday';
type WeekHours = Record<WeekDay, DayHours>;

/**
 * Pour AFFICHER le métier, pas pour le choisir: le choix est dans Paramètres,
 * qui porte la liste. Ici on ne fait que traduire la valeur enregistrée.
 */
const BUSINESS_TYPE_LABELS: Record<string, string> = {
  dental: 'Dentaire',
  medical: 'Médical',
  law: 'Juridique',
  salon: 'Salon',
  restaurant: 'Restaurant',
  garage: 'Garage auto',
  hotel: 'Hôtel',
  home_services: 'Services maison',
  other: 'Autre',
};

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
 * Une rangée du hub, et son panneau.
 *
 * C'était un accordéon. Sur un téléphone, ouvert, le contenu poussait tout ce
 * qui suit hors de l'écran et on perdait le fil entre le réglage modifié et la
 * liste parcourue; fermé, la page n'était que cinq titres empilés.
 *
 * L'argument d'origine tient toujours: la sauvegarde automatique est une seule
 * chose pour toute la page, et des sous-pages routées l'auraient coupée en
 * cinq. Le panneau le respecte, puisque c'est le MÊME arbre React — même état,
 * même sauvegarde — simplement posé au-dessus au lieu d'être déplié.
 */
function Section({ title, hint, icon, children, id, openId, setOpenId, right }: {
  title: string;
  hint?: string;
  icon: React.ElementType;
  color?: string;
  children: React.ReactNode;
  id: string;
  openId: string | null;
  setOpenId: (v: string | null) => void;
  right?: React.ReactNode;
}) {
  const open = openId === id;
  return (
    <>
      <HubRow title={title} hint={hint} icon={icon} right={right} onOpen={() => setOpenId(id)} />
      <HubPanel open={open} onClose={() => setOpenId(null)} title={title} hint={hint}>
        {children}
      </HubPanel>
    </>
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

/**
 * Une intégration qui se branche en collant une URL.
 *
 * Slack, Zapier, Make et n8n n'ont pas d'OAuth: leur URL EST le secret. C'est
 * ce qui les rend brancharbles par le client tout seul, et c'est pourquoi
 * elles étaient les seules à mériter d'être ouvertes avant les autres.
 *
 * Le champ est de type `password`: cette URL donne le droit d'écrire dans le
 * canal Slack de l'entreprise, elle ne se laisse pas lire par-dessus l'épaule.
 */
function WebhookIntegration({
  icon: Icon, provider, name, desc, help, connected, onChanged,
}: {
  icon: React.ElementType;
  provider: string;
  name: string;
  desc: string;
  help: string;
  connected: { provider: string; syncStatus?: string; lastSync?: string | null }[];
  onChanged: () => void;
}) {
  const existing = connected.find(i => i.provider === provider);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true); setErr(null);
    try {
      await api.post(`/crm/integrations/${provider}/connect`, { config: { webhookUrl: url.trim() } });
      setUrl(''); setOpen(false);
      onChanged();
    } catch (e: any) {
      // Le message du serveur, pas un générique: c'est lui qui dit « HTTPS
      // obligatoire » ou « réseau interne », donc ce qu'il faut corriger.
      setErr(e?.response?.data?.error || 'Connexion impossible');
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.post(`/crm/integrations/${provider}/disconnect`);
      onChanged();
    } catch { /* l'état reste, le client peut réessayer */ }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
          <Icon size={16} className="text-white/60" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#F8F8FF]">{name}</p>
          <p className="text-[11px] text-[#8B8BA7] leading-snug">{desc}</p>
        </div>
        {existing ? (
          <button
            type="button" onClick={disconnect} disabled={busy}
            className="flex-shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium text-[#8B8BA7] transition-colors hover:bg-white/[0.06] hover:text-[#F8F8FF] disabled:opacity-40"
          >
            Déconnecter
          </button>
        ) : (
          <button
            type="button" onClick={() => setOpen(o => !o)}
            className="flex-shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
            style={{ background: 'rgba(122,95,255,0.16)', color: '#b9a8ff' }}
          >
            {open ? 'Annuler' : 'Connecter'}
          </button>
        )}
      </div>

      {existing && (
        /* La dernière synchro, parce qu'une intégration « connectée » qui
           n'a rien envoyé depuis trois jours n'est pas connectée. */
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400">
          <CheckCircle2 size={12} aria-hidden="true" />
          Connecté
          <span className="text-[#8B8BA7]">
            {existing.lastSync
              ? `· dernière synchro le ${new Date(existing.lastSync).toLocaleDateString('fr-FR')}`
              : '· première synchro dans les 15 minutes'}
          </span>
        </p>
      )}

      {open && !existing && (
        <div className="mt-3 space-y-2">
          <input
            type="password" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://…" autoComplete="off" className={compactInputCls + ' w-full'}
          />
          <p className="text-[11px] leading-snug text-[#8B8BA7]">{help}</p>
          {err && <p className="text-[11px] text-red-400">{err}</p>}
          <button
            type="button" onClick={connect} disabled={busy || !url.trim()}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40"
            style={{ background: '#7A5FFF', color: '#fff' }}
          >
            {busy ? 'Connexion…' : 'Enregistrer'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ClientReceptionist() {
  const [overview, setOverview] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  // Held data means no spinner, on the very first render as much as on the
  // fetch below: a skeleton that flashes for one frame is still a flash.
  const [loading, setLoading] = useState(() => peekLive(RECEPTIONIST_KEYS.settings) === undefined);
  const hydrated = useRef(false);
  const skipAutosave = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  /* Lus, jamais écrits ici: ils se règlent dans Paramètres. Cette page en a
     encore besoin pour parler la bonne langue dans les aperçus de voix et pour
     savoir si la configuration de départ est complète. */
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [agentLanguage, setAgentLanguage] = useState('en');
  const [transferNumber, setTransferNumber] = useState('');
  const [agentName, setAgentName] = useState('');
  const [forwardingType, setForwardingType] = useState('');
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  // Google Calendar OAuth integration
  const [integrations, setIntegrations] = useState<{ provider: string; syncStatus?: string; lastSync?: string | null }[]>([]);
  const [gcal, setGcal] = useState<{ connected: boolean; revoked?: boolean; upcoming?: { id: string; summary: string; start: string | null }[] } | null>(null);
  const [gcalBusy, setGcalBusy] = useState(false);
  /* Lue une fois au montage: elle n'est écrite qu'avant un départ vers Google,
     et la page est rechargée au retour. */
  const [gcalRedirectUri] = useState<string | null>(
    () => sessionStorage.getItem('gcalRedirectUri'),
  );
  // Knowledge base (stored inside vapiConfig JSON, exposed top-level)
  const [items, setItems] = useState<KbItem[]>([]);
  const [weekHours, setWeekHours] = useState<WeekHours>(DEFAULT_HOURS);
  /* La FAQ en paires, plus une zone de texte. Le serveur rend le texte que
     l'agent lit a partir de ces entrees: une seule source, et la mise en forme
     ne depend plus de la discipline du client a ecrire « Q : » puis « R : ». */
  const [faqEntries, setFaqEntries] = useState<FaqEntry[]>([]);
  /* Les champs nommes du metier, par identifiant de preset. */
  const [knowledge, setKnowledge] = useState<Record<string, string>>({});
  /* Ce que le serveur propose pour ce metier. Null tant que rien n'est charge:
     la page n'invente aucune liste de niches de son cote. */
  const [presets, setPresets] = useState<KnowledgePresets | null>(null);
  const [personalityPreset, setPersonalityPreset] = useState<string>('warm');
  const [personalityNotes, setPersonalityNotes] = useState('');
  const [characterId, setCharacterId] = useState<string>('marie');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [customVoice, setCustomVoice] = useState<CustomVoice | null>(null);
  /* Le moteur vocal. `auto` suit le réglage global de la plateforme ;
     `realtime` et `classic` l'emportent, par client. Existait dans le
     backend sans aucun moyen de le changer. */
  const [voiceMode, setVoiceMode] = useState<'auto' | 'realtime' | 'classic'>('auto');
  /* Prix de l'option temps réel, à la minute. 0 = non vendue. */
  const [realtimeSurcharge, setRealtimeSurcharge] = useState(0);
  /* Ce que « Automatique » vaut sur CE serveur. Calculé côté backend par la
     règle qui sert les appels: recopier la précédence ici la ferait diverger
     au premier changement de réglage global. */
  const [autoResolvesTo, setAutoResolvesTo] = useState<'realtime' | 'classic'>('classic');
  /* La SYNTHÈSE, par client. `null` suit le réglage de la plateforme. Posée
     ici pour pouvoir comparer les trois moteurs à l'oreille sur le même
     compte, entre deux appels, sans redéployer. */
  const [ttsProvider, setTtsProvider] = useState<'11labs' | 'cartesia' | null>(null);
  const [ttsProviderDefault, setTtsProviderDefault] = useState<'11labs' | 'cartesia'>('11labs');
  /* Un seul panneau ouvert à la fois, et AUCUN à l'arrivée.
   *
   * Cet état était initialisé à `'identite'` et mémorisé dans `localStorage`:
   * la page ouvrait donc un panneau dès qu'on y arrivait, quel que soit le
   * chemin emprunté pour venir. C'est ce qui faisait que l'onglet de la barre
   * du bas semblait mener droit à « Identité de l'agent » alors qu'il vise la
   * page. On arrive sur le hub, avec le chat: le reste se choisit. */
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    // Reste des versions précédentes: sans ça, la clé traîne dans le
    // navigateur de ceux qui ont déjà ouvert la page.
    try { localStorage.removeItem('qw.receptionistSection'); } catch { /* sans conséquence */ }
  }, []);

  /* Les catégories du métier quand il y en a, la liste générique sinon. */
  const itemCategories = presets?.itemCategories?.length ? presets.itemCategories : ITEM_CATEGORIES;

  /* On ne propose que ce qui n'est pas déjà là: reproposer une question que le
     client vient d'ajouter fait douter qu'elle ait été prise. */
  const suggestedFaq = useMemo(() => {
    const asked = new Set(faqEntries.map(e => e.q.trim().toLowerCase()));
    return (presets?.faq ?? []).filter(s => !asked.has(s.q.trim().toLowerCase()));
  }, [presets, faqEntries]);

  const selectedCharacter = useMemo<Character | null>(
    () => characters.find(c => c.id === characterId) || characters[0] || null,
    [characters, characterId],
  );

  const load = useCallback(async () => {
    setError(null);
    // Everything this tab needs was fetched while the launch animation played,
    // and is kept current in the background. Reading the cache first is what
    // makes coming back to the tab instant; the request behind it only corrects
    // what is already on screen.
    setLoading(peekLive(RECEPTIONIST_KEYS.settings) === undefined);
    try {
      const [ov, st, gc, ch] = await Promise.all([
        fetchLive<any>(RECEPTIONIST_KEYS.overview).then(data => ({ data })),
        fetchLive<any>(RECEPTIONIST_KEYS.settings).then(data => ({ data })).catch(() => ({ data: null })),
        fetchLive<any>(RECEPTIONIST_KEYS.gcal).then(data => ({ data })).catch(() => ({ data: { connected: false } })),
        fetchLive<any>(RECEPTIONIST_KEYS.characters).then(data => ({ data })).catch(() => ({ data: { characters: [] } })),
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
      setFaqEntries(Array.isArray(s?.faqEntries) ? s.faqEntries : []);
      setKnowledge(s?.knowledge && typeof s.knowledge === 'object' ? s.knowledge : {});
      setPresets(s?.knowledgePresets || null);
      setPersonalityPreset(s?.personalityPreset || 'warm');
      setPersonalityNotes(s?.personalityNotes || '');
      setCharacterId(s?.characterId || 'marie');
      setCustomVoice(s?.customVoice?.voiceId ? s.customVoice : null);
      setVoiceMode(s?.voiceMode === 'realtime' || s?.voiceMode === 'classic' ? s.voiceMode : 'auto');
      setRealtimeSurcharge(Number(s?.realtimeSurchargeEur) > 0 ? Number(s.realtimeSurchargeEur) : 0);
      setAutoResolvesTo(s?.autoResolvesTo === 'realtime' ? 'realtime' : 'classic');
      setTtsProvider(s?.ttsProvider === 'cartesia' || s?.ttsProvider === '11labs' ? s.ttsProvider : null);
      setTtsProviderDefault(s?.ttsProviderDefault === 'cartesia' ? 'cartesia' : '11labs');
      // Values below come from the server → don't trigger an auto-save.
      hydrated.current = true;
      skipAutosave.current = true;
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIntegrations = useCallback(() => {
    api.get('/crm/integrations')
      .then(({ data }) => setIntegrations(Array.isArray(data) ? data : []))
      .catch(() => setIntegrations([]));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadIntegrations(); }, [loadIntegrations]);

  /* Le fragment de l'URL ouvre un panneau, pour qui en vise un explicitement
   * (`/dashboard/receptionist#integrations` depuis un email, par exemple). La
   * barre du bas, elle, ne porte plus de fragment: elle mène à la page.
   * On écoute `hashchange` parce qu'un même lien suivi deux fois ne change pas
   * de route: React Router ne rend rien, et sans cet écouteur le panneau
   * refermé ne se rouvrirait jamais. */
  useEffect(() => {
    const open = () => {
      const id = window.location.hash.replace('#', '');
      if (id) setOpenId(id);
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);

  /* Fermer le panneau efface le fragment.
     Sans ça, l'URL reste `#identite` panneau fermé: réappuyer sur l'onglet IA
     mène à la MÊME adresse, aucun événement n'est émis, et le panneau ne se
     rouvre jamais. `replaceState` plutôt que `location.hash = ''`: il ne
     déclenche pas `hashchange`, donc pas de boucle avec l'effet ci-dessus, et
     il n'ajoute pas une entrée dans l'historique à chaque fermeture. */
  useEffect(() => {
    if (openId === null && window.location.hash) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }, [openId]);

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
      /* On retient l'adresse de retour AVANT de partir chez Google.
         Si Google refuse (`redirect_uri_mismatch`), il ne dit jamais quelle
         adresse a été envoyée, et le retour se fait sur sa page à lui: on ne
         peut plus rien afficher. Gardée ici, elle est lisible au retour. */
      if (data.redirectUri) sessionStorage.setItem('gcalRedirectUri', data.redirectUri);
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
      // Ce que cette page envoie, c'est ce qu'elle laisse modifier, et rien de
      // plus. L'entreprise (nom, métier, langue) et les coordonnées se règlent
      // dans Paramètres: les poster ici aussi ferait écraser, 900 ms après la
      // moindre frappe, ce que le client vient d'y saisir — par la copie que
      // cette page a chargée au montage. Une perte de données sans symptôme.
      await api.put('/my-dashboard/settings', {
        transferNumber, agentName,
        forwardingType, googleCalendarId,
        items: items.filter(i => i.name.trim()),
        hours: weekHours,
        faqEntries,
        knowledge,
        personalityPreset,
        personalityNotes,
        characterId,
        customVoice,
        voiceMode,
        // Chaîne vide plutôt que `null`: c'est ce que le backend lit comme
        // « rends-moi au réglage global ».
        ttsProvider: ttsProvider ?? '',
      });
      // The dashboard is holding a copy of these settings, and it is wrong from
      // the instant this call returns.
      invalidateLive('/my-dashboard/');
    } catch { /* silent — the next edit retries */ }
  }, [transferNumber, agentName, forwardingType, googleCalendarId,
      items, weekHours, faqEntries, knowledge, personalityPreset, personalityNotes, characterId, customVoice, voiceMode, ttsProvider]);

  // Auto-save: debounce after any edit. Skips the initial hydration from load()
  // so we never fire a redundant save on mount.
  useEffect(() => {
    if (!hydrated.current) return;
    if (skipAutosave.current) { skipAutosave.current = false; return; }
    const t = setTimeout(() => { void autoSave(); }, 900);
    return () => clearTimeout(t);
  }, [autoSave]);

  if (loading) return (
    /* Même largeur que la page chargée: à `max-w-3xl`, le squelette se
       recadrait au moment où le contenu arrivait, et la page sautait sous
       l'oeil du client. Signalé en revue. */
    /* MÊME largeur que la page chargée: sinon elle s'élargit d'un coup à la
       fin du chargement, sur un grand écran. */
    <div className="max-w-[1600px] space-y-4" aria-busy="true">
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
  /* La précédence des moteurs, telle que `useSpeechToSpeech` l'applique côté
     serveur, et elle vient d'être corrigée des deux côtés à la fois:
       1. une voix ENREGISTRÉE passe avant tout, le classique étant la seule
          chaîne qui sache la prononcer;
       2. puis un « temps réel » explicitement demandé, qui l'emporte désormais
          sur une voix de bibliothèque. Avant, n'importe quelle voix choisie
          bloquait le temps réel, et le sélecteur de mode ne servait plus à
          rien sans que rien ne le dise;
       3. puis une voix choisie, qui fait pencher vers le classique en `auto`;
       4. puis ce que vaut « Automatique » sur ce serveur.
     Recalculé à chaque rendu pour que le sélecteur réponde AVANT
     l'enregistrement, sinon le client change de mode et ne voit rien bouger. */
  const effectiveEngine: 'realtime' | 'classic' =
    customVoice?.cloned ? 'classic'
    : voiceMode === 'realtime' ? 'realtime'
    : customVoice ? 'classic'
    : voiceMode === 'auto' ? autoResolvesTo
    : voiceMode;
  const engineReason =
    customVoice?.cloned ? 'votre voix enregistrée, qui passe avant ce réglage'
    : voiceMode === 'realtime' ? null
    : customVoice ? 'la voix choisie ci-dessus, que seul le classique sait dire'
    : voiceMode === 'auto' ? 'réglage automatique'
    // « Automatique » ne dit pas quelle synthèse il retient: la ligne ci-dessus
    // la nomme, cette raison-ci dit d'où elle vient.
    : ttsProvider === null ? 'synthèse par défaut de la plateforme'
    : null;

  // `planType` is a lowercase key ('starter'); shown to a customer it becomes
  // a name. One formatting, used by both the header and the Abonnement row.
  const planName = (() => {
    const k = client.planType || 'starter';
    return k.charAt(0).toUpperCase() + k.slice(1);
  })();

  return (
    /* Deux colonnes à partir de `lg`: le chat À DROITE sur deux tiers, les
       réglages À DROITE sur un tiers (demande utilisateur).
       La page prend la LARGEUR de la fenêtre, plus les 1152 px de `max-w-6xl`
       (demande utilisateur: « met en plein écran le chat »). Le cap laissait
       plus de 100 px de vide à droite sur un portable de 1512, pendant que le
       chat, lui, restait à 763. Le plafond de 1600 px reste, non pour la
       fenêtre mais pour la LIGNE: au delà, une bulle de conversation devient
       une bande de texte qu'on ne relit plus.
       Le chat reste PREMIER dans le DOM: c'est ce qu'on vient faire ici neuf
       fois sur dix, donc il doit rester en tête au clavier et en haut sur
       mobile, où la grille retombe à une colonne. `order` ne déplace que le
       rendu, à partir de `lg`. */
    <div className="max-w-[1600px] pb-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      {/* LE CHAT À GAUCHE, les réglages à droite (demande utilisateur: c'était
          l'inverse). Il est aussi COLLANT: à pleine hauteur, il resterait
          autrement à défiler avec une colonne de réglages bien plus longue que
          lui, et on perdrait de vue ce qu'on est venu faire. */}
      {/* `lg:top-8` et non `top-2`: c'est la marge de `<main>` (`md:p-8`), donc
          la position que la carte occupe DÉJÀ avant tout défilement. Avec
          `top-2`, elle remontait de 24 px en se collant, et sa hauteur pleine
          fenêtre lui faisait alors dépasser le bas de l'écran. */}
      <div className="lg:order-1 lg:col-span-2 lg:sticky lg:top-8">
      {/* Assistant conversationnel : parler pour configurer et onboarder.
          Il porte aussi l'identité de la page (titre, entreprise, plan), le
          numéro copiable, l'appel test live et la jauge de minutes, pour que
          tout ce qui décrit la réceptionniste soit au même endroit. */}
      <AssistantChat
        /* L'état du transfert, posé sur la ligne du numéro: même sujet, même
           endroit. « Transfert » plutôt que « Transfert d'appel »: à côté du
           numéro, le mot suffit. */
        numberBadge={
          fwdVerified && transferNumber ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 flex-shrink-0">
              <CheckCircle2 size={12} aria-hidden="true" /> Transfert
            </span>
          ) : fwdStatus === 'pending' ? (
            <span className="flex items-center gap-1 text-[11px] text-amber-400 flex-shrink-0">
              <Clock size={12} aria-hidden="true" /> Transfert
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-[#6B6B75] flex-shrink-0">
              <XCircle size={12} aria-hidden="true" /> Transfert
            </span>
          )
        }
        isFr={agentLanguage !== 'en'}
        /* Le portrait du personnage choisi, pour que l'entête du chat dise à
           qui l'on parle. Il vient de la même source que le carrousel. */
        avatarUrl={selectedCharacter?.avatar || null}
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

      {/* La colonne des réglages. Tout ce qui se règle vit ici, à droite du
          chat sur grand écran, et sous lui sur mobile. */}
      <div className="lg:order-2 lg:col-span-1 space-y-4">

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

        {/* La rangée « Transfert d'appel » à elle seule est partie: elle
            occupait une bande entière pour un mot et une pastille. L'état vit
            désormais sur la ligne du numéro, à gauche de l'icône « copier »
            (retour utilisateur) — c'est là qu'on le cherche, puisque c'est le
            même sujet. */}
      </div>

      {/* Des rangées groupées, comme la page Paramètres: l'agent d'abord, ce
          qu'il fait des appels ensuite, le compte à la fin. Trois groupes de
          deux, deux et une: on lit une intention par groupe au lieu de cinq
          titres à la file. */}
      <HubGroup label="L'agent">
      {/* En TÊTE du groupe, avant même l'identité de l'agent: tant que ce
          numéro n'est pas déclaré, le renvoi d'appel ne peut pas être
          reconnu, et le client n'a qu'une ligne qu'il ne peut souvent même
          pas composer depuis son pays. Régler la voix d'une réceptionniste
          que personne ne peut joindre vient après. */}
      <Section title="Votre numéro" hint="Celui que vos clients composent déjà" id="mon-numero" openId={openId} setOpenId={setOpenId} icon={Phone}>
        <OwnNumber isFr={agentLanguage !== 'en'} />
      </Section>
      <Section title="Identité de l'agent" hint="Nom, voix et caractère" id="identite" openId={openId} setOpenId={setOpenId} icon={Bot}>
        {/* Le champ « Nom de l'agent », le rappel entreprise/métier/langue et
            le titre du personnage sont partis (demande utilisateur). Chacun
            disait deux fois la même chose: le nom se change au crayon, sur le
            carrousel, à côté du visage qui le porte; l'entreprise et la langue
            s'éditent dans Paramètres, qui en est la source; et un carrousel de
            visages n'a pas besoin qu'on annonce que ce sont des visages. */}

        {/* —— Personnage (voix + personnalité) —— */}
        {characters.length > 0 && (
          <div>
            {/* Carrousel plutôt que grille (demande utilisateur): un visage à la
                fois, son nom au-dessus, sa voix en dessous, écoute et crayon à
                portée. Le crayon ouvre le menu en verre, qui porte à la fois
                les personnages et les voix ElevenLabs à jour, avec recherche et
                filtres. `VoicePicker`, qui doublait ce rôle sous la grille,
                disparaît: c'était deux listes pour un seul choix. */}
            <CharacterCarousel
              characters={characters}
              value={characterId}
              agentName={agentName}
              onAgentName={setAgentName}
              // The character carries a tone of its own; selecting one applies
              // it, and the tone buttons below stay available to override it.
              onChange={id => {
                const c = characters.find(x => x.id === id);
                setCharacterId(id);
                if (c) setPersonalityPreset(c.personaKey);
              }}
              isFr={agentLanguage !== 'en'}
              override={customVoice}
              onOverride={setCustomVoice}
              /* Le ton se règle DANS la fiche, sous le visage: c'est là qu'il
                 est décrit, et il n'a plus de section à lui. */
              toneId={personalityPreset}
              onTone={setPersonalityPreset}
              tones={PERSONALITY_PRESETS}
            >
              {/* La personnalisation descend dans la fiche (demande
                  utilisateur): elle précise ce que dit CE personnage, avec CE
                  ton, et se lisait jusqu'ici comme un réglage de page. */}
              <label
                htmlFor="perso-notes"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5] mb-2"
              >
                Personnalisation
              </label>
              <textarea
                id="perso-notes"
                value={personalityNotes}
                onChange={e => setPersonalityNotes(e.target.value)}
                rows={4}
                placeholder="Précisez ce qui vous est propre : promotions en cours, mots à utiliser, à éviter, formule d'accueil…"
                className={`${inputCls} resize-y leading-relaxed`}
                style={{ minHeight: 100 }}
              />
            </CharacterCarousel>
            <VoiceCloner
              voice={customVoice}
              isFr={agentLanguage !== 'en'}
              // A clone is selected the moment it exists, and deleting it falls
              // back to the character's own voice — the character itself never
              // moves.
              onChange={v => setCustomVoice(v ? { ...v, cloned: true } : null)}
            />

            {/* —— Moteur vocal ——
                Deux architectures, pas deux réglages de confort. En temps réel
                le modèle entend et répond en audio, sans passer par du texte :
                latence plus basse, interruptions naturelles, il perçoit le ton.
                En classique la parole est transcrite, un modèle répond, une
                voix la prononce : c'est la seule chaîne qui utilise la voix
                choisie ci-dessus, et la seule qui sache parler avec une voix
                clonée.
                Ce choix vivait dans le backend sans aucun moyen de le changer,
                alors que c'est lui qui décide de ce que l'appelant entend. */}
            <div className="mt-6 pt-6 border-t border-white/[0.06]">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5] mb-2">
                Moteur vocal
              </label>
              {/* UN seul choix, quatre entrées, alors que le réglage en porte
                  deux (le mode et la synthèse). C'est délibéré: « lequel des
                  trois sonne le mieux » est une question, pas deux, et deux
                  rangées de boutons obligeraient à savoir que le fournisseur
                  de synthèse n'existe qu'en mode classique. La combinaison est
                  faite ici, une fois. */}
              <div className="flex flex-wrap gap-2">
                {([
                  { id: 'auto', label: 'Automatique', mode: 'auto', tts: null },
                  { id: '11labs', label: 'Classique · ElevenLabs', mode: 'classic', tts: '11labs' },
                  { id: 'cartesia', label: 'Classique · Cartesia', mode: 'classic', tts: 'cartesia' },
                  {
                    id: 'realtime',
                    label: realtimeSurcharge > 0
                      ? `Temps réel · OpenAI · +${realtimeSurcharge.toFixed(2).replace('.', ',')} €/min`
                      : 'Temps réel · OpenAI',
                    mode: 'realtime',
                    tts: null,
                  },
                ] as const).map(m => {
                  const active = m.mode === voiceMode
                    && (m.mode !== 'classic' || m.tts === ttsProvider);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setVoiceMode(m.mode); setTtsProvider(m.tts); }}
                      aria-pressed={active}
                      className={`h-9 px-4 text-[13px] rounded-lg border transition-colors ${
                        active
                          ? 'border-[#7349fe] bg-[#7349fe]/15 text-[#F5F5F7]'
                          : 'border-white/[0.08] bg-[#0A0A0C] text-[#9A9AA5] hover:text-[#F5F5F7]'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2.5 text-[12px] text-[#9A9AA5] leading-relaxed">
                {voiceMode === 'realtime'
                  ? realtimeSurcharge > 0
                    ? `Temps réel : le plus fluide et le plus rapide, il perçoit le ton de l'appelant. La voix choisie ci-dessus n'est pas utilisée dans ce mode, le modèle parle avec la sienne. Option facturée ${realtimeSurcharge.toFixed(2).replace('.', ',')} € par minute réellement passée dans ce mode, en plus de votre forfait.`
                    : "Temps réel : le plus fluide et le plus rapide, il perçoit le ton de l'appelant. La voix choisie ci-dessus n'est pas utilisée dans ce mode, le modèle parle avec la sienne."
                  : voiceMode === 'classic'
                    ? ttsProvider === 'cartesia'
                      ? "Classique par Cartesia : la voix choisie ci-dessus est celle que l'appelant entend. Sonic produit des respirations et des hésitations, et démarre plus vite qu'ElevenLabs."
                      : "Classique par ElevenLabs : la voix choisie ci-dessus est celle que l'appelant entend. Un peu plus de délai avant chaque réponse."
                    : realtimeSurcharge > 0
                      ? 'Automatique : mode classique, sans supplément. Le temps réel ne s’active que si vous le choisissez.'
                      : 'Automatique : suit le réglage par défaut de la plateforme.'}
              </p>
              {/* —— Le moteur RÉELLEMENT utilisé ——
                  Le bouton dit ce qu'on a choisi, pas ce qui se passe. Une voix
                  clonée l'emporte sur « Temps réel », et « Automatique » ne
                  résout pas au même moteur selon le serveur : dans les deux cas
                  l'écran affichait un mode et l'appel en jouait un autre, ce
                  qui se vit comme une panne (« j'entends pas de différence
                  quand je change de mode »). La règle est donc dite. */}
              <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-relaxed">
                <span className="text-[#9A9AA5]">Moteur utilisé pour vos appels :</span>
                <span className="font-semibold text-[#7349fe]">
                  {effectiveEngine === 'realtime'
                    ? 'Temps réel · OpenAI'
                    : `Classique · ${(ttsProvider ?? ttsProviderDefault) === 'cartesia' ? 'Cartesia' : 'ElevenLabs'}`}
                </span>
                {engineReason && <span className="text-[#8B8BA7]">({engineReason})</span>}
              </p>
            </div>
          </div>
        )}

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
                  {itemCategories.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
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

        {/* —— Ce que votre métier doit préciser ——

            Des champs NOMMÉS, et non le pavé de texte libre d'avant. La zone
            libre demandait au client de deviner ce que sa réceptionniste avait
            besoin de savoir; ici la question est posée. La liste vient du
            serveur, résolue depuis son métier: la page ne porte aucune liste de
            niches, et ne peut donc pas diverger de celle du backend. */}
        {presets?.fields?.length ? (
          <div className="mb-6">
            <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5] mb-1">
              <BookOpen size={12} /> Précisions {businessType ? `« ${BUSINESS_TYPE_LABELS[businessType] ?? businessType} »` : 'métier'}
            </label>
            <p className="text-[11.5px] text-[#6B6B75] mb-3 leading-relaxed">
              Ce que vos appelants demandent le plus souvent. Laissez vide ce qui ne vous concerne pas.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {presets.fields.map(f => (
                <div key={f.id} className={f.multiline ? 'md:col-span-2' : undefined}>
                  <label className="text-xs text-[#8B8BA7] mb-1.5 block">{f.label}</label>
                  {f.multiline ? (
                    <textarea
                      value={knowledge[f.id] ?? ''}
                      onChange={e => setKnowledge(k => ({ ...k, [f.id]: e.target.value }))}
                      rows={2} placeholder={f.placeholder}
                      className={`${inputCls} resize-y leading-relaxed`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={knowledge[f.id] ?? ''}
                      onChange={e => setKnowledge(k => ({ ...k, [f.id]: e.target.value }))}
                      placeholder={f.placeholder}
                      className={inputCls}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* —— FAQ —— */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5]">
              <HelpCircle size={12} /> FAQ
            </label>
            <span className="text-[11px] text-[#6B6B75]">{faqEntries.length} question{faqEntries.length > 1 ? 's' : ''}</span>
          </div>
          <p className="text-[11.5px] text-[#6B6B75] mb-3 leading-relaxed">
            Une question, sa réponse. C'est mot pour mot ce que l'IA répondra.
          </p>

          <div className="space-y-2">
            {faqEntries.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/[0.08] p-4 text-center">
                <p className="text-[12px] text-[#6B6B75]">Aucune question. Ajoutez-en une, ou piochez ci-dessous.</p>
              </div>
            )}
            {faqEntries.map((entry, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={entry.q}
                    onChange={e => setFaqEntries(list => list.map((x, j) => j === i ? { ...x, q: e.target.value } : x))}
                    placeholder="Faut-il réserver ?"
                    className={`${inputCls} font-medium`}
                  />
                  <button
                    type="button"
                    onClick={() => setFaqEntries(list => list.filter((_, j) => j !== i))}
                    aria-label={`Supprimer la question « ${entry.q || 'sans titre'} »`}
                    className="mt-1.5 flex-shrink-0 text-[#6B6B75] hover:text-[#EF4444] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <textarea
                  value={entry.a}
                  onChange={e => setFaqEntries(list => list.map((x, j) => j === i ? { ...x, a: e.target.value } : x))}
                  rows={2}
                  placeholder="Oui, on privilégie le rendez-vous, mais on accepte les passages si le créneau est libre."
                  className={`${inputCls} mt-2 resize-y leading-relaxed`}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFaqEntries(list => [...list, { q: '', a: '' }])}
            className="mt-2 flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-lg text-[#C6C6D0] bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
          >
            <Plus size={13} /> Ajouter une question
          </button>

          {/* Les suggestions du métier. Elles arrivent avec une réponse par
              défaut plausible, que le client corrige: partir d'une phrase à
              rectifier demande moins que partir d'un champ vide. */}
          {suggestedFaq.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] text-[#6B6B75] mb-2">Suggestions pour votre métier</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedFaq.map(s => (
                  <button
                    key={s.q}
                    type="button"
                    onClick={() => setFaqEntries(list => [...list, { q: s.q, a: s.a }])}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11.5px] rounded-lg text-[#9A9AA5] bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:text-[#F8F8FF] transition-colors"
                  >
                    <Plus size={11} /> {s.q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </Section>

      </HubGroup>

      {/* —— Transfert d'appel —— */}
      <HubGroup label="Les appels">
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

      {/* La section « Coordonnées » est partie dans Paramètres, avec l'identité
          de l'entreprise: adresse, ville, code postal et téléphone de contact
          décrivent le client, et n'avaient rien à faire au milieu des réglages
          de sa réceptionniste. */}

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

            {/* L'adresse de retour, en toutes lettres.
                « Erreur 400 : redirect_uri_mismatch » est le refus le plus
                opaque de Google: il ne dit pas QUELLE adresse a été envoyée,
                alors que la comparaison se fait caractère par caractère — un
                `www`, un slash final, un `http` suffisent. L'afficher ici
                permet de la coller telle quelle dans la console Google au lieu
                de deviner ce que le serveur a en mémoire. */}
            {!gcal?.connected && gcalRedirectUri && (
              <p className="mt-2 text-[10.5px] leading-snug text-[#6B6B75] break-all">
                Adresse de retour envoyée à Google :{' '}
                <span className="font-mono text-[#8B8BA7]">{gcalRedirectUri}</span>
                <br />
                Elle doit figurer, à l'identique, dans « URI de redirection autorisés » de la console Google.
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

          {/* Les intégrations qui se branchent avec une URL.
              Elles étaient affichées « Bientôt » alors que le service de
              synchronisation savait déjà les servir, et que le cron tourne
              toutes les quinze minutes: il manquait la porte, pas la pièce. */}
          <WebhookIntegration
            icon={Activity}
            provider="slack"
            name="Slack"
            desc="Chaque nouveau lead annoncé dans votre canal"
            help="Slack → Applications → Incoming Webhooks → Ajouter. Copiez l'URL qui commence par https://hooks.slack.com/."
            connected={integrations}
            onChanged={loadIntegrations}
          />
          <WebhookIntegration
            icon={Settings}
            provider="zapier"
            name="Zapier, Make ou n8n"
            desc="Vos contacts, appels et affaires envoyés vers 6000+ outils"
            help="Créez un déclencheur « Webhooks by Zapier → Catch Hook » (ou un webhook Make / n8n) et collez l'URL fournie."
            connected={integrations}
            onChanged={loadIntegrations}
          />

          {/* Ce qui reste réellement à faire. Ces trois-là demandent un
              parcours OAuth complet chez le fournisseur, pas une URL. */}
          {([
            { icon: Clock3,     name: 'Calendly',            desc: 'Synchronisez vos liens de réservation' },
            { icon: Globe,      name: 'Outlook / Microsoft 365', desc: 'Agenda et contacts Microsoft' },
            { icon: Tag,        name: 'Stripe',              desc: 'Encaissements et factures liés aux appels' },
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
      </HubGroup>

      <HubGroup label="Le compte">
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
      </HubGroup>

      {/* Le pavé « Besoin d'aide ? » est parti (demande utilisateur). Il
          invitait à écrire au support pour changer la voix et le script, deux
          choses que la page fait elle-même désormais: le carrousel choisit la
          voix, le chat modifie le script en parlant. Il renvoyait donc vers
          nous pour ce qui est à portée de clic, et le mot « VAPI » nommait au
          client un fournisseur dont il n'a pas à connaître l'existence.
          Le Support reste dans le menu, à sa place. */}
      </div>
      </div>
    </div>
  );
}
