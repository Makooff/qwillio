import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, Phone, PhoneForwarded, Pause, Play, Check, AlertCircle,
  Activity, Save, Power,
} from 'lucide-react';
import api from '../../services/api';

const inputCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0D0D15] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50 transition-all disabled:opacity-50';

export default function ClientReceptionist() {
  const [overview, setOverview] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [transferNumber, setTransferNumber] = useState('');
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [ov, st] = await Promise.all([
          api.get('/my-dashboard/overview'),
          api.get('/my-dashboard/settings').catch(() => ({ data: null })),
        ]);
        setOverview(ov.data);
        const s = st.data;
        setSettings(s);
        setTransferNumber(s?.transferNumber || '');
        setBusinessName(s?.businessName || ov.data?.client?.businessName || '');
      } catch (err) {
        console.error('Receptionist fetch error', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/my-dashboard/settings', { transferNumber, businessName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save error', err);
    } finally {
      setSaving(false);
    }
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
    } catch (err) {
      console.error('Toggle error', err);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#7B5CF0] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const client = overview?.client || {};
  const status = client.subscriptionStatus || 'active';
  const isPaused = status === 'paused';
  const isActive = status === 'active' || status === 'trialing';

  return (
    <div className="max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-[#F8F8FF] tracking-tight">Réceptionniste IA</h1>
        <p className="text-sm text-[#8B8BA7]">Gérez votre agent IA et ses paramètres</p>
      </motion.div>

      {/* Status card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-6 mb-4 ${isActive ? 'border-emerald-400/20 bg-emerald-400/[0.04]' : 'border-amber-400/20 bg-amber-400/[0.04]'}`}
      >
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
                {client.businessName || 'Votre entreprise'} · {client.planType || 'starter'} plan
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling || status === 'cancelled'}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all disabled:opacity-40 ${
              isPaused
                ? 'bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 border border-emerald-400/20'
                : 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 border border-amber-400/20'
            }`}
          >
            {toggling ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isPaused ? (
              <><Play size={14} /> Activer</>
            ) : (
              <><Pause size={14} /> Mettre en pause</>
            )}
          </button>
        </div>
      </motion.div>

      {/* Phone number */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-xl border border-white/[0.06] bg-[#12121A] p-6 mb-4"
      >
        <h2 className="text-sm font-semibold text-[#F8F8FF] mb-4 flex items-center gap-2">
          <Phone size={16} className="text-[#7B5CF0]" />
          Numéro de téléphone IA
        </h2>
        {client.vapiPhoneNumber ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-3 rounded-xl bg-[#7B5CF0]/10 border border-[#7B5CF0]/20">
              <p className="text-lg font-mono font-bold text-[#7B5CF0]">{client.vapiPhoneNumber}</p>
            </div>
            <div className="text-xs text-[#8B8BA7]">
              <p>Partagez ce numéro</p>
              <p>avec vos clients</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-[#8B8BA7]">
            <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
            <p className="text-sm">Numéro de téléphone en cours d'attribution. Contactez le support si ce message persiste.</p>
          </div>
        )}
      </motion.div>

      {/* Stats quick view */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3 mb-4"
      >
        {[
          { label: 'Appels ce mois', value: overview?.calls?.thisMonth || 0, icon: Phone },
          { label: 'Leads captés', value: overview?.leads?.thisMonth || 0, icon: Activity },
          { label: `Quota ${overview?.calls?.quotaPercent || 0}%`, value: `${overview?.calls?.quotaUsed || 0}/${overview?.calls?.quota || 0}`, icon: Power },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-[#12121A] p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <s.icon size={13} className="text-[#8B8BA7]" />
              <span className="text-[11px] text-[#8B8BA7]">{s.label}</span>
            </div>
            <p className="text-lg font-bold text-[#F8F8FF]">{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Settings */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-xl border border-white/[0.06] bg-[#12121A] p-6"
      >
        <h2 className="text-sm font-semibold text-[#F8F8FF] mb-4 flex items-center gap-2">
          <PhoneForwarded size={16} className="text-[#7B5CF0]" />
          Paramètres de base
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Nom de l'entreprise</label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="Ex: Plomberie Dupont"
              className={inputCls}
            />
            <p className="text-[11px] text-[#8B8BA7] mt-1">Utilisé par l'IA pour se présenter</p>
          </div>
          <div>
            <label className="text-xs text-[#8B8BA7] mb-1.5 block">Numéro de transfert</label>
            <input
              type="tel"
              value={transferNumber}
              onChange={e => setTransferNumber(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className={inputCls}
            />
            <p className="text-[11px] text-[#8B8BA7] mt-1">L'IA transfère les appels urgents à ce numéro</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#7B5CF0] rounded-xl hover:bg-[#6a4ee0] disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          {saved && (
            <span className="text-sm text-emerald-400 flex items-center gap-1">
              <Check size={14} /> Sauvegardé
            </span>
          )}
        </div>
      </motion.div>

      {/* Info box */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="mt-4 rounded-xl border border-[#7B5CF0]/15 bg-[#7B5CF0]/[0.04] p-4"
      >
        <p className="text-xs text-[#8B8BA7] leading-relaxed">
          <span className="text-[#7B5CF0] font-medium">Configuration avancée</span> — Pour modifier la voix, le script, les horaires ou les paramètres VAPI de votre IA, contactez notre équipe via le Support. Nous nous occupons de tout.
        </p>
      </motion.div>
    </div>
  );
}
