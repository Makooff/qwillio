import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Check, Phone, Settings as SettingsIcon,
  Apple, Bot, Smartphone, Copy, ArrowRight,
} from 'lucide-react';
import api from '../../services/api';

type Platform = 'ios' | 'android' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'unknown';
}

export default function ClientSetupForwarding() {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<Platform>('ios');
  const [number, setNumber] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    if (p !== 'unknown') setPlatform(p);
  }, []);

  useEffect(() => {
    api.get('/my-dashboard/overview')
      .then(r => setNumber(r.data?.client?.vapiPhoneNumber ?? r.data?.client?.transferNumber ?? ''))
      .catch(() => {});
  }, []);

  const numberClean = useMemo(() => (number || '').replace(/[^\d+]/g, ''), [number]);
  // GSM forwarding MMI code — works on iOS and Android, opens the dialer with
  // the code so the user just presses Call.
  const forwardMmi = numberClean ? `*21*${numberClean}#` : '*21*NUMBER#';
  const forwardLink = numberClean ? `tel:*21*${numberClean}%23` : undefined;
  const cancelLink = 'tel:%23%2321%23';

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const iosSteps = [
    { icon: SettingsIcon, title: 'Ouvre Réglages',        body: 'Sur ton iPhone, ouvre l\'app Réglages.' },
    { icon: Phone,        title: 'Téléphone → Renvoi d\'appel', body: 'Dans Réglages, sélectionne Téléphone, puis Renvoi d\'appel.' },
    { icon: Check,        title: 'Active le renvoi',      body: 'Active l\'interrupteur Renvoi d\'appel.' },
    { icon: Bot,          title: `Saisis le numéro Qwillio`, body: `Dans Transférer vers, entre ${numberClean || 'ton numéro Qwillio'}.` },
  ];

  const androidSteps = [
    { icon: Phone,        title: 'Ouvre l\'app Téléphone',    body: 'Lance l\'app Téléphone (ou Dialer).' },
    { icon: SettingsIcon, title: 'Menu → Paramètres',         body: 'Appuie sur ⋮ ou ☰ puis Paramètres.' },
    { icon: Phone,        title: 'Comptes d\'appel → Renvoi', body: 'Ouvre Comptes d\'appel (ou Appels) → Renvoi d\'appel.' },
    { icon: Check,        title: 'Activer "Toujours renvoyer"', body: 'Sélectionne Toujours renvoyer puis Activer.' },
    { icon: Bot,          title: `Saisis le numéro Qwillio`, body: `Entre ${numberClean || 'ton numéro Qwillio'}, puis Activer.` },
  ];

  const steps = platform === 'android' ? androidSteps : iosSteps;

  return (
    <div className="max-w-xl mx-auto pb-16">
      {/* Top bar */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9A9AA5]">
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[#F2F2F2]">Renvoi d'appel</h1>
      </div>

      <p className="text-[13px] text-[#9A9AA5] mb-6 leading-relaxed">
        Configure ton téléphone pour que chaque appel entrant soit pris en charge automatiquement par ton réceptionniste Qwillio.
      </p>

      {/* Platform selector */}
      <div className="flex p-1 rounded-full border border-white/[0.06] bg-white/[0.03] mb-6">
        {([
          { id: 'ios',     icon: Apple,      label: 'iPhone'  },
          { id: 'android', icon: Smartphone, label: 'Android' },
        ] as const).map(p => {
          const active = platform === p.id;
          return (
            <button key={p.id} onClick={() => setPlatform(p.id)}
              className="flex-1 flex items-center justify-center gap-2 h-9 rounded-full text-[13px] font-medium transition-colors"
              style={{
                background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: active ? '#F2F2F2' : '#9A9AA5',
              }}>
              <p.icon size={14} /> {p.label}
            </button>
          );
        })}
      </div>

      {/* Quick action — one-tap GSM code */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 mb-6">
        <p className="text-[11px] uppercase tracking-wider text-[#9A9AA5] mb-2">Activation en 1 clic</p>
        <div className="flex items-center gap-2">
          <a
            href={forwardLink}
            onClick={e => { if (!forwardLink) e.preventDefault(); }}
            className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[13px] font-semibold transition-colors ${
              forwardLink
                ? 'bg-[#F2F2F2] text-[#0B0B0D] hover:bg-white'
                : 'bg-white/[0.04] text-[#6B6B75] cursor-not-allowed'
            }`}
          >
            <Phone size={14} /> Composer {forwardMmi}
          </a>
          <button onClick={() => copy(forwardMmi)}
            className="w-11 h-11 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] text-[#9A9AA5] flex items-center justify-center transition-colors"
            title="Copier le code">
            {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
          </button>
        </div>
        <p className="text-[11px] text-[#6B6B75] mt-2 leading-relaxed">
          Le code MMI ouvre directement le clavier. Appuie sur Appeler pour activer le renvoi immédiatement. Fonctionne sur iPhone comme Android.
        </p>
      </div>

      {/* Step-by-step */}
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-[#9A9AA5] mb-3">Étape par étape — {platform === 'android' ? 'Android' : 'iPhone'}</p>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
          {steps.map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-start gap-3 p-4 border-b border-white/[0.04] last:border-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold"
                   style={{ background: 'rgba(255,255,255,0.06)', color: '#E5E5EA' }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <s.icon size={13} className="text-[#9A9AA5]" />
                  <p className="text-[13px] font-semibold text-[#F2F2F2]">{s.title}</p>
                </div>
                <p className="text-[12px] text-[#9A9AA5] leading-relaxed">{s.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cancel forwarding */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 mb-6">
        <p className="text-[13px] font-semibold text-[#F2F2F2] mb-1">Désactiver plus tard</p>
        <p className="text-[12px] text-[#9A9AA5] mb-3">Compose <code className="font-mono">##21#</code> depuis ton téléphone pour couper le renvoi.</p>
        <a href={cancelLink}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] text-[12px] font-medium text-[#E5E5EA] transition-colors">
          <Phone size={12} /> Composer ##21#
        </a>
      </div>

      {/* Done */}
      <Link to="/dashboard/receptionist"
        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[#F2F2F2] text-[#0B0B0D] text-[13px] font-semibold hover:bg-white transition-colors">
        J'ai configuré mon téléphone <ArrowRight size={14} />
      </Link>
    </div>
  );
}
