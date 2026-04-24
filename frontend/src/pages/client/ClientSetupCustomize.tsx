import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, ArrowLeft, ArrowRight, Check, Building2, Languages,
  Sparkles, Tag, Clock3, HelpCircle, MessageSquare, Plus, X,
} from 'lucide-react';
import api from '../../services/api';
import OrbsLoader from '../../components/OrbsLoader';
import { pro } from '../../styles/pro-theme';
import { Card } from '../../components/pro/ProBlocks';

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

const inputCls = 'w-full px-4 py-3 text-[15px] rounded-xl border border-white/[0.08] bg-[#0A0A0C] text-[#F5F5F7] placeholder-[#6B6B75] focus:outline-none focus:border-[#7B5CF0]/50 transition-all';
const compactInputCls = 'h-10 px-3 text-[14px] rounded-lg border border-white/[0.08] bg-[#0A0A0C] text-[#F5F5F7] placeholder-[#6B6B75] focus:outline-none focus:border-[#7B5CF0]/50 transition-all disabled:opacity-30';

const newId = () => Math.random().toString(36).slice(2, 10);

export default function ClientSetupCustomize() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  // Form state
  const [agentName, setAgentName] = useState('Ashley');
  const [agentLanguage, setAgentLanguage] = useState('en');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [personalityPreset, setPersonalityPreset] = useState('warm');
  const [personalityNotes, setPersonalityNotes] = useState('');
  const [items, setItems] = useState<KbItem[]>([]);
  const [weekHours, setWeekHours] = useState<WeekHours>(DEFAULT_HOURS);
  const [faq, setFaq] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/my-dashboard/settings');
        const s = res.data;
        if (s) {
          setAgentName(s.agentName || 'Ashley');
          setAgentLanguage(s.agentLanguage || 'en');
          setBusinessName(s.businessName || '');
          setBusinessType(s.businessType || '');
          setPersonalityPreset(s.personalityPreset || 'warm');
          setPersonalityNotes(s.personalityNotes || '');
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
            <label className="block text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
              Prénom de l'IA
            </label>
            <input value={agentName} onChange={e => setAgentName(e.target.value)}
                   placeholder="Ashley, Marie, Sophie…" className={inputCls} />
            <p className="text-[12px] mt-1.5" style={{ color: pro.textTer }}>
              C'est le prénom utilisé pour se présenter au téléphone.
            </p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
              Langue
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 'en', l: 'Anglais', d: 'Voix d\'Ashley' },
                { v: 'fr', l: 'Français', d: 'Voix de Marie' },
              ].map(opt => {
                const sel = agentLanguage === opt.v;
                return (
                  <button key={opt.v} type="button"
                          onClick={() => setAgentLanguage(opt.v)}
                          className="text-left p-4 rounded-xl border transition-colors"
                          style={{
                            background: sel ? `${pro.accent}1A` : pro.bg,
                            borderColor: sel ? `${pro.accent}77` : pro.border,
                            color: sel ? pro.accent : pro.text,
                          }}>
                    <p className="text-[14px] font-semibold">{opt.l}</p>
                    <p className="text-[11.5px] mt-0.5" style={{ color: sel ? `${pro.accent}CC` : pro.textTer }}>{opt.d}</p>
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
      hint: 'Le nom et le type d\'activité — pour adapter le ton',
      isValid: () => !!businessName.trim(),
      render: () => (
        <div className="space-y-5">
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
              Nom de l'entreprise
            </label>
            <input value={businessName} onChange={e => setBusinessName(e.target.value)}
                   placeholder="Ex. Plomberie Dupont" className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
              Type d'entreprise
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {BUSINESS_TYPES.map(opt => {
                const sel = businessType === opt.v;
                return (
                  <button key={opt.v} type="button"
                          onClick={() => setBusinessType(opt.v)}
                          className="text-left p-3 rounded-xl border transition-colors text-[13px] font-medium"
                          style={{
                            background: sel ? `${pro.accent}1A` : pro.bg,
                            borderColor: sel ? `${pro.accent}77` : pro.border,
                            color: sel ? pro.accent : pro.text,
                          }}>
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
      key: 'personality',
      icon: Sparkles,
      title: 'Ton et personnalité',
      hint: 'Comment votre IA doit parler aux appelants',
      isValid: () => !!personalityPreset,
      render: () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {PERSONALITY_PRESETS.map(p => {
            const sel = personalityPreset === p.v;
            return (
              <button key={p.v} type="button"
                      onClick={() => setPersonalityPreset(p.v)}
                      className="text-left p-4 rounded-xl border transition-colors"
                      style={{
                        background: sel ? `${pro.accent}1A` : pro.bg,
                        borderColor: sel ? `${pro.accent}77` : pro.border,
                        color: sel ? pro.accent : pro.text,
                      }}>
                <p className="text-[14px] font-semibold">{p.l}</p>
                <p className="text-[12px] mt-1" style={{ color: sel ? `${pro.accent}CC` : pro.textTer }}>{p.d}</p>
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
          <label className="block text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
            Précisions
          </label>
          <textarea value={personalityNotes} onChange={e => setPersonalityNotes(e.target.value)}
                    rows={6}
                    placeholder="Ex. : « Toujours rappeler la promotion en cours · Ne jamais dire le mot prix sans préciser HT · Privilégier le tutoiement »"
                    className={`${inputCls} resize-y leading-relaxed`}
                    style={{ minHeight: 160 }} />
          <p className="text-[12px] mt-2" style={{ color: pro.textTer }}>
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
              <div className="rounded-xl border border-dashed p-4 text-center"
                   style={{ borderColor: pro.border, color: pro.textTer }}>
                <p className="text-[13px]">Aucun élément — ajoutez un service ou un tarif.</p>
              </div>
            )}
            {items.map(it => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                <select value={it.category}
                        onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, category: e.target.value } : x))}
                        className={`${compactInputCls} col-span-3`}>
                  {ITEM_CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
                <input value={it.name}
                       onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, name: e.target.value } : x))}
                       placeholder="Nom (ex. Coupe homme)"
                       className={`${compactInputCls} col-span-5`} />
                <input value={it.price}
                       onChange={e => setItems(arr => arr.map(x => x.id === it.id ? { ...x, price: e.target.value } : x))}
                       placeholder="Prix"
                       className={`${compactInputCls} col-span-3`} />
                <button type="button"
                        onClick={() => setItems(arr => arr.filter(x => x.id !== it.id))}
                        className="col-span-1 h-10 rounded-lg flex items-center justify-center hover:bg-red-500/[0.08] hover:text-red-400 transition-colors"
                        style={{ color: pro.textTer }}>
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          <button type="button"
                  onClick={() => setItems(arr => [...arr, { id: newId(), category: 'service', name: '', price: '' }])}
                  className="inline-flex items-center gap-1.5 px-3 h-10 rounded-lg text-[13px] font-medium border transition-colors"
                  style={{ borderColor: pro.border, color: pro.text, background: pro.bg }}>
            <Plus size={14} /> Ajouter un élément
          </button>
          <p className="text-[12px] mt-3" style={{ color: pro.textTer }}>
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
        <div className="rounded-xl border overflow-hidden divide-y divide-white/[0.04]"
             style={{ borderColor: pro.border }}>
          {DAYS.map(d => {
            const h = weekHours[d.k];
            return (
              <div key={d.k} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5"
                   style={{ borderColor: pro.border }}>
                <span className="col-span-3 text-[13.5px] font-medium" style={{ color: pro.text }}>{d.l}</span>
                <button type="button"
                        onClick={() => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], open: !w[d.k].open } }))}
                        className="col-span-3 h-9 px-3 rounded-lg text-[11.5px] font-semibold uppercase tracking-wider transition-colors"
                        style={{
                          background: h.open ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.08)',
                          color:      h.open ? pro.ok : pro.bad,
                        }}>
                  {h.open ? 'Ouvert' : 'Fermé'}
                </button>
                <input type="time" value={h.from} disabled={!h.open}
                       onChange={e => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], from: e.target.value } }))}
                       className={`${compactInputCls} col-span-3`} />
                <input type="time" value={h.to} disabled={!h.open}
                       onChange={e => setWeekHours(w => ({ ...w, [d.k]: { ...w[d.k], to: e.target.value } }))}
                       className={`${compactInputCls} col-span-3`} />
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
        <textarea value={faq} onChange={e => setFaq(e.target.value)}
                  rows={8}
                  placeholder={`Q : Faut-il prendre rendez-vous ?\nR : Oui, on privilégie le rendez-vous mais on accepte les walk-ins si le créneau est libre.\n\nQ : Acceptez-vous les cartes bancaires ?\nR : Oui, toutes les cartes ainsi qu'Apple Pay et Google Pay.`}
                  className={`${inputCls} resize-y leading-relaxed font-mono`}
                  style={{ minHeight: 220, fontSize: 13 }} />
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
      });
      // mark customization done by setting hasCustomConfig flag (server reads
      // it from a few signals: agentName + items + hours)
      navigate('/dashboard');
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Échec de l\'enregistrement');
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
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={120} fullscreen={false} />
    </div>
  );

  const Icon = currentStep.icon;

  return (
    <div className="max-w-[760px] mx-auto space-y-4">
      {/* Header — back link + step counter */}
      <div className="flex items-center justify-between">
        <button onClick={prev}
                className="inline-flex items-center gap-1.5 text-[12.5px]"
                style={{ color: pro.textSec }}>
          <ArrowLeft size={13} /> {step === 0 ? 'Quitter' : 'Précédent'}
        </button>
        <span className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: pro.textTer }}>
          Étape {step + 1} / {totalSteps}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          style={{ background: pro.accent }}
        />
      </div>

      {/* Step card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          <Card>
            <div className="p-5 md:p-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: `${pro.accent}1F`, color: pro.accent }}>
                  <Icon size={18} />
                </div>
                <div>
                  <h1 className="text-[18px] font-semibold tracking-tight" style={{ color: pro.text }}>
                    {currentStep.title}
                  </h1>
                  <p className="text-[12.5px]" style={{ color: pro.textSec }}>{currentStep.hint}</p>
                </div>
              </div>

              <div className="mt-5">{currentStep.render()}</div>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Footer — next / finish */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={prev} disabled={saving}
                className="px-4 h-11 inline-flex items-center gap-1.5 text-[13px] font-medium rounded-xl disabled:opacity-40"
                style={{ background: pro.panel, color: pro.text, border: `1px solid ${pro.border}` }}>
          <ArrowLeft size={14} /> Précédent
        </button>
        <button onClick={next} disabled={!currentStep.isValid() || saving}
                className="flex-1 h-11 inline-flex items-center justify-center gap-1.5 text-[13px] font-medium rounded-xl disabled:opacity-40"
                style={{ background: pro.text, color: '#0B0B0D' }}>
          {step === totalSteps - 1
            ? (<><Check size={14} /> {saving ? 'Enregistrement…' : 'Terminer'}</>)
            : (<>Suivant <ArrowRight size={14} /></>)}
        </button>
      </div>
    </div>
  );
}
