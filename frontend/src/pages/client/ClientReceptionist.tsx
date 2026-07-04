import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, Phone, PhoneForwarded, Pause, Play, Check, AlertCircle,
  Activity, Save, Power, Globe, User, Clock, Shield, Calendar,
  Volume2, Languages, Building2, MapPin, RefreshCw, Settings,
  ChevronDown, ChevronRight, Copy, CheckCircle2, XCircle,
} from 'lucide-react';
import api from '../../services/api';

const inputCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0D0D15] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50 transition-all disabled:opacity-50';
const selectCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0D0D15] text-[#F8F8FF] focus:outline-none focus:border-[#7B5CF0]/50 transition-all disabled:opacity-50';

function Section({ title, icon: Icon, color, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/[0.06] bg-[#12121A] overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        {open ? <ChevronDown className="w-3.5 h-3.5 text-[#8B8BA7]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#8B8BA7]" />}
        <Icon size={16} style={{ color }} />
        <span className="text-sm font-semibold text-[#F8F8FF]">{title}</span>
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
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/my-dashboard/settings', {
        businessName, businessType, transferNumber, agentName,
        agentLanguage, contactPhone, address, city, postalCode,
        forwardingType, googleCalendarId,
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
      <div className="w-8 h-8 border-2 border-[#7B5CF0] border-t-transparent rounded-full animate-spin" />
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F8F8FF] tracking-tight">Réceptionniste IA</h1>
          <p className="text-sm text-[#8B8BA7]">Gérez votre agent IA et tous ses paramètres</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7]">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#7B5CF0] rounded-xl hover:bg-[#6a4ee0] disabled:opacity-50 transition-colors">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
            {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* ── Status card ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-5 ${isActive ? 'border-emerald-400/20 bg-emerald-400/[0.04]' : 'border-amber-400/20 bg-amber-400/[0.04]'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? 'bg-emerald-400/10' : 'bg-amber-400/10'}`}>
              <Bot size={24} className={isActive ? 'text-emerald-400' : 'text-amber-400'} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className={`text-sm font-semibold ${isActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isActive ? 'IA Active — répond aux appels' : 'IA en pause'}
                </span>
              </div>
              <p className="text-xs text-[#8B8BA7]">
                {client.businessName || businessName || 'Votre entreprise'} · Plan {client.planType || 'starter'}
                {client.isTrial && <span className="ml-1 text-amber-400">(essai)</span>}
              </p>
            </div>
          </div>
          <button onClick={handleToggle} disabled={toggling || status === 'cancelled'}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all disabled:opacity-40 ${
              isPaused
                ? 'bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 border border-emerald-400/20'
                : 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/20'
            }`}>
            {toggling ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : isPaused ? <><Play size={14} /> Activer</> : <><Pause size={14} /> Mettre en pause</>}
          </button>
        </div>
      </motion.div>

      {/* ── Phone + Stats row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Phone number */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-xl border border-white/[0.06] bg-[#12121A] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-3 flex items-center gap-2">
            <Phone size={15} className="text-[#7B5CF0]" /> Numéro IA
          </h3>
          {phone ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-xl bg-[#7B5CF0]/10 border border-[#7B5CF0]/20">
                <p className="text-lg font-mono font-bold text-[#7B5CF0]">{phone}</p>
              </div>
              <button onClick={copyPhone}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8BA7] transition-all">
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#8B8BA7]">
              <AlertCircle size={14} className="text-amber-400" />
              <p className="text-xs">En cours d'attribution</p>
            </div>
          )}
          {/* Forwarding status */}
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#8B8BA7]">Transfert d'appel</span>
              {fwdVerified ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 size={12} /> Vérifié</span>
              ) : fwdStatus === 'pending' ? (
                <span className="flex items-center gap-1 text-[11px] text-amber-400"><Clock size={12} /> En attente</span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-[#8B8BA7]"><XCircle size={12} /> Non configuré</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl border border-white/[0.06] bg-[#12121A] p-5">
          <h3 className="text-sm font-semibold text-[#F8F8FF] mb-3 flex items-center gap-2">
            <Activity size={15} className="text-[#22C55E]" /> Statistiques
          </h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Ce mois', value: overview?.calls?.thisMonth || 0, color: '#7B5CF0' },
              { label: 'Leads', value: overview?.leads?.thisMonth || 0, color: '#22C55E' },
              { label: 'Total', value: settings?.totalCallsMade || client.totalCallsMade || 0, color: '#3B82F6' },
            ].map((s, i) => (
              <div key={i} className="bg-[#0D0D15] rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[8px] text-[#8B8BA7] uppercase">{s.label}</p>
              </div>
            ))}
          </div>
          {/* Quota bar */}
          <div>
            <div className="flex justify-between text-[10px] text-[#8B8BA7] mb-1">
              <span>Quota mensuel</span>
              <span className="tabular-nums">{used} / {quota} ({quotaPct}%)</span>
            </div>
            <div className="h-2 rounded-full bg-[#0D0D15] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(quotaPct, 100)}%`,
                background: quotaPct > 90 ? '#EF4444' : quotaPct > 70 ? '#F59E0B' : '#7B5CF0',
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
      </Section>

      {/* ── Transfert d'appel ── */}
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
        {fwdVerified && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-400/5 border border-emerald-400/15">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span className="text-xs text-emerald-400">Transfert vérifié le {new Date(fwdVerified).toLocaleDateString('fr-FR')}</span>
          </div>
        )}
      </Section>

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
