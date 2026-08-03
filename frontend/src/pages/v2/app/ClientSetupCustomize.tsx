import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, ArrowLeft, ArrowRight, Check, Building2,
  Sparkles, Tag, Clock3, HelpCircle, MessageSquare, Plus, X,
} from 'lucide-react';
import { useToast } from '../../../hooks/useToast';
import ToastContainer from '../../../components/ui/Toast';
import api from '../../../services/api';
import CharacterPicker, { type Character } from '../../../components/client/CharacterPicker';
import { Card, PageActions, PrimaryBtn, GhostBtn, Input, Textarea, Toggle } from '../../../components/v2/app/Blocks';

/* Personnalisation guidée, registre produit V2. Logique identique à la V1
   (GET/PUT /my-dashboard/settings, /characters, CharacterPicker réutilisé).
   Le titre de page vient d'AppShell: la page ne rend que le titre d'étape. */

const compactCls =
  'w-full h-10 bg-q2-obsidian border border-q2-graphite-d rounded-lg px-3 text-[13px] text-white placeholder:text-q2-fog focus:outline-none focus:border-q2-indigo/60 transition-colors duration-150 disabled:opacity-40';

const choiceCls = (sel: boolean) =>
  `text-left rounded-xl border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
    sel ? 'bg-q2-indigo/10 border-q2-indigo/55' : 'bg-q2-obsidian border-q2-graphite-d hover:border-q2-smoke-d'
  }`;

interface KbItem { id: string; category: string; name: string; price: string; }
interface DayHours { open: boolean; from: string; to: string; }
type WeekDay = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday';
type WeekHours = Record<WeekDay, DayHours>;

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

const ITEM_CATEGORIES = [
  { v: 'service', l: 'Service' },
  { v: 'menu',    l: 'Menu' },
  { v: 'tarif',   l: 'Tarif' },
  { v: 'produit', l: 'Produit' },
  { v: 'autre',   l: 'Autre' },
];

const PERSONALITY_PRESETS = [
  { v: 'warm',         l: 'Chaleureux',    d: 'Accueillant, empathique, sourire dans la voix' },
  { v: 'professional', l: 'Professionnel', d: 'Direct, précis, cadre formel' },
  { v: 'casual',       l: 'Décontracté',   d: 'Détendu, fluide, ton conversationnel' },
  { v: 'energetic',    l: 'Énergique',     d: 'Dynamique, enthousiaste, upbeat' },
  { v: 'luxury',       l: 'Premium',       d: 'Soigné, raffiné, langage soutenu' },
  { v: 'caring',       l: 'Bienveillant',  d: 'Doux, rassurant, idéal pour santé' },
];

const BUSINESS_TYPES = [
  { v: 'dental',        l: 'Dentaire' },
  { v: 'medical',       l: 'Médical' },
  { v: 'law',           l: 'Juridique' },
  { v: 'salon',         l: 'Salon de beauté' },
  { v: 'restaurant',    l: 'Restaurant' },
  { v: 'garage',        l: 'Garage auto' },
  { v: 'hotel',         l: 'Hôtel' },
  { v: 'home_services', l: 'Services à domicile' },
  { v: 'other',         l: 'Autre' },
];

const newId = () => Math.random().toString(36).slice(2, 10);

function StepLabel({ children }: { children: React.ReactNode }) {
  return <p className="q2-eyebrow text-q2-fog mb-2">{children}</p>;
}

export default function ClientSetupCustomize() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const { toasts, add: addToast, remove: removeToast } = useToast();

  // Form state
  const [agentName, setAgentName] = useState('Ashley');
  const [agentLanguage, setAgentLanguage] = useState('en');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [personalityPreset, setPersonalityPreset] = useState('warm');
  const [personalityNotes, setPersonalityNotes] = useState('');
  const [characterId, setCharacterId] = useState('marie');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [items, setItems] = useState<KbItem[]>([]);
  const [weekHours, setWeekHours] = useState<WeekHours>(DEFAULT_HOURS);
  const [faq, setFaq] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [res, ch] = await Promise.all([
          api.get('/my-dashboard/settings'),
          api.get('/my-dashboard/characters').catch(() => ({ data: { characters: [] } })),
        ]);
        setCharacters(Array.isArray(ch.data?.characters) ? ch.data.characters : []);
        const s = res.data;
        if (s) {
          setAgentName(s.agentName || 'Ashley');
          setAgentLanguage(s.agentLanguage || 'en');
          setBusinessName(s.businessName || '');
          setBusinessType(s.businessType || '');
          setPersonalityPreset(s.personalityPreset || 'warm');
          setPersonalityNotes(s.personalityNotes || '');
          setCharacterId(s.characterId || 'marie');
          const rawItems = Array.isArray(s.items) ? s.items : [];
          setItems(rawItems.map((it: any) => ({
            id: it.id || newId(),
            category: it.category || 'service',
            name: it.name || '',
            price: it.price || '',
          })));
          if (s.hours && typeof s.hours === 'object' && !Array.isArray(s.hours)) {
            setWeekHours({ ...DEFAULT_HOURS, ...s.hours });
          }
          setFaq(s.faq || '');
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  const STEPS = [
    {
      key: 'identity',
      icon: Bot,
      title: 'Présentation de votre IA',
      hint: 'Le prénom et la langue que votre réceptionniste utilisera',
      isValid: () => !!agentName.trim(),
      render: () => (
        <div className="space-y-5">
          <div>
            <StepLabel>Prénom de l'IA</StepLabel>
            <Input value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Ashley, Marie, Sophie…" />
            <p className="text-[12px] text-q2-fog mt-1.5 q2-body-text">
              C'est le prénom utilisé pour se présenter au téléphone.
            </p>
          </div>
          <div>
            <StepLabel>Langue</StepLabel>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 'en', l: 'Anglais', d: 'Voix d\'Ashley' },
                { v: 'fr', l: 'Français', d: 'Voix de Marie' },
              ].map(opt => {
                const sel = agentLanguage === opt.v;
                return (
                  <button key={opt.v} type="button" aria-pressed={sel}
                          onClick={() => setAgentLanguage(opt.v)}
                          className={`${choiceCls(sel)} p-4`}>
                    <p className={`text-[14px] font-medium ${sel ? 'text-q2-lift' : 'text-white'}`}>{opt.l}</p>
                    <p className="text-[11.5px] mt-0.5 text-q2-fog">{opt.d}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'business',
      icon: Building2,
      title: 'Votre entreprise',
      hint: 'Le nom et le type d\'activité, pour adapter le ton',
      isValid: () => !!businessName.trim(),
      render: () => (
        <div className="space-y-5">
          <div>
            <StepLabel>Nom de l'entreprise</StepLabel>
            <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Ex. Plomberie Dupont" />
          </div>
          <div>
            <StepLabel>Type d'entreprise</StepLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {BUSINESS_TYPES.map(opt => {
                const sel = businessType === opt.v;
                return (
                  <button key={opt.v} type="button" aria-pressed={sel}
                          onClick={() => setBusinessType(opt.v)}
                          className={`${choiceCls(sel)} p-3 text-[13px] font-medium ${sel ? 'text-q2-lift' : 'text-white'}`}>
                    {opt.l}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'character',
      icon: Sparkles,
      title: 'Voix et personnage',
      hint: 'Choisissez qui répond à vos appels',
      isValid: () => !!characterId,
      render: () => (
        characters.length > 0 ? (
          <CharacterPicker
            characters={characters}
            value={characterId}
            onChange={setCharacterId}
            isFr={agentLanguage !== 'en'}
          />
        ) : (
          <p className="text-[13px] text-q2-fog">Chargement des voix…</p>
        )
      ),
    },
    {
      key: 'personality',
      icon: Sparkles,
      title: 'Ton (affinage optionnel)',
      hint: 'Comment votre IA doit parler aux appelants',
      isValid: () => !!personalityPreset,
      render: () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {PERSONALITY_PRESETS.map(p => {
            const sel = personalityPreset === p.v;
            return (
              <button key={p.v} type="button" aria-pressed={sel}
                      onClick={() => setPersonalityPreset(p.v)}
                      className={`${choiceCls(sel)} p-4`}>
                <p className={`text-[14px] font-medium ${sel ? 'text-q2-lift' : 'text-white'}`}>{p.l}</p>
                <p className="text-[12px] mt-1 text-q2-fog">{p.d}</p>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      key: 'personalization',
      icon: MessageSquare,
      title: 'Personnalisation',
      hint: 'Vos consignes spécifiques (optionnel)',
      isValid: () => true,
      render: () => (
        <div>
          <StepLabel>Précisions</StepLabel>
          <Textarea value={personalityNotes} onChange={e => setPersonalityNotes(e.target.value)}
                    rows={6}
                    placeholder="Ex. : « Toujours rappeler la promotion en cours · Ne jamais dire le mot prix sans préciser HT · Privilégier le tutoiement »"
                    className="resize-y leading-relaxed"
                    style={{ minHeight: 160 }} />
          <p className="text-[12px] text-q2-fog mt-2 q2-body-text">
            L'IA appliquera ces consignes en plus du ton choisi à l'étape précédente.
          </p>
        </div>
      ),
    },
    {
      key: 'items',
      icon: Tag,
      title: 'Services, menu et tarifs',
      hint: 'Ajoutez ce que l\'IA doit savoir vendre / proposer',
      isValid: () => true,
      render: () => (
        <div>
          <div className="space-y-2 mb-3">
            {items.length === 0 && (
              <div className="rounded-xl border border-dashed border-q2-graphite-d p-4 text-center">
                <p className="text-[13px] text-q2-fog">Aucun élément : ajoutez un service ou un tarif.</p>
              </div>
            )}
            {items.map(it => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                <select value={it.category}
                        onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, category: e.target.value } : x))}
                        className={`${compactCls} col-span-3`} aria-label="Catégorie">
                  {ITEM_CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
                <input value={it.name}
                       onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, name: e.target.value } : x))}
                       placeholder="Nom (ex. Coupe homme)"
                       className={`${compactCls} col-span-5`} aria-label="Nom" />
                <input value={it.price}
                       onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, price: e.target.value } : x))}
                       placeholder="Prix"
                       className={`${compactCls} col-span-3`} aria-label="Prix" />
                <button type="button"
                        onClick={() => setItems(arr => arr.filter(x => x.id !== it.id))}
                        className="col-span-1 h-10 rounded-lg flex items-center justify-center text-q2-fog hover:text-white hover:bg-q2-obsidian transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                        aria-label="Supprimer l'élément">
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <GhostBtn type="button"
                    onClick={() => setItems(arr => [...arr, { id: newId(), category: 'service', name: '', price: '' }])}>
            <Plus size={14} aria-hidden="true" /> Ajouter un élément
          </GhostBtn>
          <p className="text-[12px] text-q2-fog mt-3 q2-body-text">
            Vous pouvez en ajouter d'autres plus tard depuis votre Réceptionniste.
          </p>
        </div>
      ),
    },
    {
      key: 'hours',
      icon: Clock3,
      title: 'Horaires d\'ouverture',
      hint: 'L\'IA répondra "fermé" en dehors de ces créneaux',
      isValid: () => true,
      render: () => (
        <div className="rounded-xl border border-q2-graphite-d overflow-hidden">
          {DAYS.map((d, i) => {
            const h = weekHours[d.k];
            return (
              <div key={d.k}
                   className={`grid grid-cols-12 gap-2 items-center px-3 py-2.5 ${i === 0 ? '' : 'border-t border-q2-graphite-d'}`}>
                <span className="col-span-3 text-[13.5px] font-medium text-white">{d.l}</span>
                <div className="col-span-3 flex items-center gap-2">
                  <Toggle
                    checked={h.open}
                    onChange={() => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], open: !w[d.k].open } }))}
                    label={`${d.l} ouvert`}
                  />
                  <span className="text-[11.5px] font-medium"
                        style={{ color: h.open ? 'var(--q2p-ok)' : 'var(--q2-fog)' }}>
                    {h.open ? 'Ouvert' : 'Fermé'}
                  </span>
                </div>
                <input type="time" value={h.from} disabled={!h.open}
                       onChange={e => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], from: e.target.value } }))}
                       className={`${compactCls} col-span-3`} aria-label={`${d.l} ouverture`} />
                <input type="time" value={h.to} disabled={!h.open}
                       onChange={e => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], to: e.target.value } }))}
                       className={`${compactCls} col-span-3`} aria-label={`${d.l} fermeture`} />
              </div>
            );
          })}
        </div>
      ),
    },
    {
      key: 'faq',
      icon: HelpCircle,
      title: 'FAQ (optionnel)',
      hint: 'Questions fréquentes et réponses prêtes pour l\'IA',
      isValid: () => true,
      render: () => (
        <Textarea value={faq} onChange={e => setFaq(e.target.value)}
                  rows={8}
                  placeholder={`Q : Faut-il prendre rendez-vous ?\nR : Oui, on privilégie le rendez-vous mais on accepte les walk-ins si le créneau est libre.\n\nQ : Acceptez-vous les cartes bancaires ?\nR : Oui, toutes les cartes ainsi qu'Apple Pay et Google Pay.`}
                  className="resize-y leading-relaxed"
                  style={{ minHeight: 220 }} />
      ),
    },
  ] as const;

  const currentStep = STEPS[step];
  const totalSteps = STEPS.length;
  const progress = Math.round(((step + 1) / totalSteps) * 100);

  const saveAll = async () => {
    setSaving(true);
    try {
      await api.put('/my-dashboard/settings', {
        agentName, agentLanguage, businessName, businessType,
        items: items.filter(i => i.name.trim()),
        hours: weekHours,
        faq,
        personalityPreset,
        personalityNotes,
        characterId,
      });
      // mark customization done by setting hasCustomConfig flag (server reads
      // it from a few signals: agentName + items + hours)
      navigate('/dashboard');
    } catch (e: any) {
      addToast(e?.response?.data?.error || 'Échec de l\'enregistrement', 'error');
    } finally { setSaving(false); }
  };

  const next = async () => {
    if (!currentStep.isValid()) return;
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      await saveAll();
    }
  };

  const prev = () => {
    if (step === 0) navigate('/dashboard');
    else setStep(step - 1);
  };

  if (loading) return (
    <div className="max-w-[760px] space-y-3" aria-busy="true">
      <div className="h-1 rounded-full bg-q2-obsidian animate-pulse" />
      <div className="h-64 rounded-xl bg-q2-carbon border border-q2-graphite-d animate-pulse" />
    </div>
  );

  const Icon = currentStep.icon;

  return (
    <div className="max-w-[760px]">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <PageActions subtitle={`Étape ${step + 1} sur ${totalSteps} : ${currentStep.hint}`}>
        <GhostBtn onClick={prev} disabled={saving}>
          <ArrowLeft size={13} aria-hidden="true" /> {step === 0 ? 'Quitter' : 'Précédent'}
        </GhostBtn>
      </PageActions>

      <div className="space-y-3">
        {/* Progression */}
        <div
          className="h-1 rounded-full bg-q2-obsidian overflow-hidden"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-label="Progression de la personnalisation"
        >
          <div
            className="h-full rounded-full bg-q2-indigo transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Carte d'étape */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card>
              <div className="flex items-center gap-3 mb-5">
                <span className="w-9 h-9 shrink-0 rounded-xl bg-q2-obsidian flex items-center justify-center">
                  <Icon size={17} className="text-q2-lift" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-medium tracking-tight text-white truncate">{currentStep.title}</h2>
                  <p className="text-[12px] text-q2-fog truncate">{currentStep.hint}</p>
                </div>
              </div>

              {currentStep.render()}
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-2">
          <GhostBtn onClick={prev} disabled={saving} className="h-10">
            <ArrowLeft size={14} aria-hidden="true" /> Précédent
          </GhostBtn>
          <PrimaryBtn onClick={next} disabled={!currentStep.isValid() || saving} className="flex-1 h-10">
            {step === totalSteps - 1
              ? (<><Check size={14} aria-hidden="true" /> {saving ? 'Enregistrement…' : 'Terminer'}</>)
              : (<>Suivant <ArrowRight size={14} aria-hidden="true" /></>)}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}
