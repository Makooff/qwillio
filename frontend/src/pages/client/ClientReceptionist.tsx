import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, Phone, PhoneForwarded, Pause, Play, Check, AlertCircle,
  Activity, Save, Power, Globe, User, Clock, Shield, Calendar,
  Volume2, Languages, Building2, MapPin, Settings,
  ChevronDown, ChevronRight, Copy, CheckCircle2, XCircle,
  BookOpen, Tag, HelpCircle, Clock3, Plus, X,
} from 'lucide-react';
import api from '../../services/api';
import OrbsLoader from "../../components/OrbsLoader";

const inputCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50 transition-all disabled:opacity-50';
const selectCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50 transition-all disabled:opacity-50';
const compactInputCls = 'h-9 px-3 text-[13px] rounded-lg border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] placeholder-[#6B6B75] focus:outline-none focus:border-[#7B5CF0]/50 transition-all disabled:opacity-50';

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

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; color?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        {open ? <ChevronDown className="w-3.5 h-3.5 text-[#6B6B75]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#6B6B75]" />}
        <Icon size={15} className="text-[#9A9AA5]" />
        <span className="text-[13px] font-semibold text-[#F2F2F2]">{title}</span>
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);
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
  // Knowledge base (stored inside vapiConfig JSON, exposed top-level)
  const [items, setItems] = useState<KbItem[]>([]);
  const [weekHours, setWeekHours] = useState<WeekHours>(DEFAULT_HOURS);
  const [faq, setFaq] = useState('');
  const [personalityPreset, setPersonalityPreset] = useState<string>('warm');
  const [personalityNotes, setPersonalityNotes] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ov, st] = await Promise.all([
        api.get('/my-dashboard/overview'),
        api.get('/my-dashboard/settings').catch(() => ({ data: null })),
      ]);
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
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const handleSave = async () => {
    setSaving(true);
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
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleToggle = async () => {
    const status = overview?.client?.subscriptionStatus;
    if (!status) return;
    setToggling(true);
    try {
      if (status === 'paused') {
        await api.post('/my-dashboard/resume');
        setOverview((p: any) => ({ ...p, client: { ...p.client, subscriptionStatus: p.client.isTrial ? 'trialing' : 'active' } }));
      } else {
        await api.post('/my-dashboard/pause');
        setOverview((p: any) => ({ ...p, client: { ...p.client, subscriptionStatus: 'paused' } }));
      }
    } catch { /* silent */ }
    finally { setToggling(false); }
  };

  const copyPhone = () => {
    const phone = overview?.client?.vapiPhoneNumber || settings?.vapiPhoneNumber;
    if (phone) { navigator.clipboard.writeText(phone); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <OrbsLoader size={40} fullscreen={false} />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <AlertCircle className="w-10 h-10 text-[#EF4444] mb-3" />
      <p className="text-sm text-[#8B8BA7]">{error}</p>
      <button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-[#7B5CF0] text-white text-sm">Réessayer</button>
    </div>
  );

  const client = overview?.client || {};
  const status = client.subscriptionStatus || 'active';
  const isPaused = status === 'paused';
  const isActive = status === 'active' || status === 'trialing';
  const phone = client.vapiPhoneNumber || settings?.vapiPhoneNumber;
  const fwdStatus = settings?.forwardingStatus;
  const fwdVerified = settings?.forwardingVerifiedAt;
  const quota = overview?.calls?.quota || settings?.monthlyCallsQuota || 0;
  const used = overview?.calls?.quotaUsed || 0;
  const quotaPct = quota > 0 ? Math.round((used / quota) * 100) : 0;

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header — neutral, less ornamentation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold text-[#F2F2F2] tracking-tight">Réceptionniste IA</h1>
          <p className="text-[12.5px] text-[#9A9AA5]">Gérez votre agent IA et tous ses paramètres</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#0B0B0D] bg-[#F2F2F2] rounded-xl hover:bg-white disabled:opacity-50 transition-colors">
          {saving ? <div className="w-3.5 h-3.5 border-2 border-[#0B0B0D] border-t-transparent rounded-full animate-spin" /> : <Save size={13} />}
          {saving ? 'Sauvegarde…' : saved ? 'Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>

      {/* ── Status card ── neutral surface, single colour dot only */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Bot size={18} className="text-[#E5E5EA]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="text-[13px] font-semibold text-[#F2F2F2] truncate">
                  {isActive ? 'IA active' : 'IA en pause'}
                </span>
              </div>
              <p className="text-[11.5px] text-[#9A9AA5] truncate">
                {client.businessName || businessName || 'Votre entreprise'} · Plan {client.planType || 'starter'}
                {client.isTrial && <span className="ml-1 text-amber-400">(essai)</span>}
              </p>
            </div>
          </div>
          <button onClick={handleToggle} disabled={toggling || status === 'cancelled'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-[#E5E5EA] transition-colors disabled:opacity-40 flex-shrink-0">
            {toggling ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : isPaused ? <><Play size={12} /> Activer</> : <><Pause size={12} /> Mettre en pause</>}
          </button>
        </div>
      </motion.div>

      {/* ── Phone + Stats row — flat neutral surfaces ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Phone number */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Phone size={13} className="text-[#9A9AA5]" />
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#9A9AA5]">Numéro IA</h3>
          </div>
          {phone ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <p className="text-[15px] font-mono font-semibold text-[#F2F2F2] tabular-nums">{phone}</p>
              </div>
              <button onClick={copyPhone}
                className="p-2.5 rounded-xl hover:bg-white/[0.06] text-[#9A9AA5] transition-colors">
                {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#9A9AA5]">
              <AlertCircle size={13} className="text-amber-400" />
              <p className="text-[12px]">En cours d'attribution</p>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9A9AA5]">Transfert d'appel</span>
              {fwdVerified && transferNumber ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 size={12} /> Vérifié</span>
              ) : fwdStatus === 'pending' ? (
                <span className="flex items-center gap-1 text-[11px] text-amber-400"><Clock size={12} /> En attente</span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-[#6B6B75]"><XCircle size={12} /> Non configuré</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats — uniform white numbers */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={13} className="text-[#9A9AA5]" />
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[#9A9AA5]">Statistiques</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Ce mois', value: overview?.calls?.thisMonth || 0 },
              { label: 'Leads',   value: overview?.leads?.thisMonth || 0 },
              { label: 'Total',   value: settings?.totalCallsMade || client.totalCallsMade || 0 },
            ].map((s, i) => (
              <div key={i} className="bg-[#0A0A0C] rounded-lg p-2.5 text-center">
                <p className="text-[18px] font-semibold tabular-nums text-[#F2F2F2]">{s.value}</p>
                <p className="text-[9px] text-[#9A9AA5] uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {/* Quota bar */}
          <div>
            <div className="flex justify-between text-[10px] text-[#9A9AA5] mb-1">
              <span>Quota mensuel</span>
              <span className="tabular-nums">{used} / {quota} ({quotaPct}%)</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(quotaPct, 100)}%`,
                background: quotaPct > 90 ? '#EF4444' : quotaPct > 70 ? '#F59E0B' : '#E5E5EA',
              }} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Agent identity ── */}
      <Section title="Identité de l'agent" icon={Bot} color="#7B5CF0">
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

        {/* ── Personnalité (preset + personnalisation libre) ── */}
        <div className="mt-6">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#9A9AA5] mb-3">
            Ton et personnalité
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
                    background: sel ? 'rgba(123,92,240,0.10)' : '#0A0A0C',
                    borderColor: sel ? 'rgba(123,92,240,0.55)' : 'rgba(255,255,255,0.08)',
                    color: sel ? '#7B5CF0' : '#F2F2F2',
                  }}
                >
                  <p className="text-[13px] font-semibold">{p.l}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: sel ? 'rgba(123,92,240,0.85)' : '#8B8BA7' }}>{p.d}</p>
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

      {/* ── Connaissances IA — items list + week schedule ── */}
      <Section title="Base de connaissances" icon={BookOpen} color="#7B5CF0" defaultOpen={false}>
        <p className="text-[12px] text-[#9A9AA5] mb-5 leading-relaxed">
          Ce que l'IA doit savoir pour répondre aux appelants : services, menu,
          tarifs, horaires, FAQ. Plus c'est précis, plus elle sera précise.
        </p>

        {/* ── Services / Menu / Tarifs ── */}
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
                  placeholder="Prix (ex. 25€)"
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

        {/* ── Horaires hebdomadaires ── */}
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

        {/* ── FAQ ── */}
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

      {/* ── Transfert d'appel ── */}
      <div id="transfer" style={{ scrollMarginTop: 80 }}>
      <Section title="Transfert d'appel" icon={PhoneForwarded} color="#3B82F6">
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

      {/* ── Contact & adresse ── */}
      <Section title="Coordonnées" icon={MapPin} color="#F59E0B" defaultOpen={false}>
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

      {/* ── Intégrations ── */}
      <Section title="Intégrations" icon={Calendar} color="#8B5CF6" defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Google Calendar ID</label>
            <input type="text" value={googleCalendarId} onChange={e => setGoogleCalendarId(e.target.value)}
              placeholder="example@group.calendar.google.com" className={inputCls} />
            <p className="text-[10px] text-[#8B8BA7] mt-1">Connectez votre calendrier pour que l'IA puisse prendre des rendez-vous</p>
          </div>
          <div className="pt-3 border-t border-white/[0.04]">
            <Row l="Google Calendar" v={googleCalendarId ? 'Connecté' : 'Non connecté'} c={googleCalendarId ? '#22C55E' : '#8B8BA7'} />
            <Row l="VAPI Assistant" v={settings?.vapiAssistantId ? 'Configuré' : 'En attente'} c={settings?.vapiAssistantId ? '#22C55E' : '#F59E0B'} />
          </div>
        </div>
      </Section>

      {/* ── Subscription info ── */}
      <Section title="Abonnement" icon={Shield} color="#22C55E" defaultOpen={false}>
        <Row l="Plan" v={(client.planType || 'starter').charAt(0).toUpperCase() + (client.planType || 'starter').slice(1)} c="#7B5CF0" />
        <Row l="Statut" v={
          status === 'active' ? 'Actif' : status === 'trialing' ? 'Essai' : status === 'paused' ? 'En pause' : status === 'cancelled' ? 'Annulé' : status
        } c={isActive ? '#22C55E' : isPaused ? '#F59E0B' : '#EF4444'} />
        {client.isTrial && client.trialEndDate && (
          <Row l="Fin de l'essai" v={new Date(client.trialEndDate).toLocaleDateString('fr-FR')} c="#F59E0B" />
        )}
        <Row l="Quota mensuel" v={`${quota} appels`} />
        <Row l="Utilisés ce mois" v={`${used} appels`} />
        {settings?.activationDate && <Row l="Activé le" v={new Date(settings.activationDate).toLocaleDateString('fr-FR')} />}
        {settings?.lastCallDate && <Row l="Dernier appel" v={new Date(settings.lastCallDate).toLocaleDateString('fr-FR')} />}
      </Section>

      {/* ── Info box ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="rounded-xl border border-[#7B5CF0]/15 bg-[#7B5CF0]/[0.04] p-4">
        <p className="text-xs text-[#8B8BA7] leading-relaxed">
          <span className="text-[#7B5CF0] font-medium">Besoin d'aide ?</span> — Pour modifier la voix, le script personnalisé, ou les paramètres VAPI avancés de votre IA, contactez notre équipe via le Support. Nous nous occupons de tout en moins de 24h.
        </p>
      </motion.div>
    </div>
  );
}
