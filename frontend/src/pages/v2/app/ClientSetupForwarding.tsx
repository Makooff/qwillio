import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Check, Phone, Settings as SettingsIcon,
  Apple, Bot, Smartphone, Copy, ArrowRight,
} from 'lucide-react';
import api from '../../../services/api';
import { Card, PageActions, PrimaryBtn, GhostBtn } from '../../../components/v2/app/Blocks';

/* Renvoi d'appel, registre produit V2. Logique identique à la V1: détection
   iOS/Android, code MMI *21*, liens tel:, PUT settings. Le titre de page est
   rendu par AppShell. */

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
  const [confirming, setConfirming] = useState(false);

  const confirmForwarding = async () => {
    setConfirming(true);
    try {
      await api.put('/my-dashboard/settings', { forwardingStatus: 'verified' });
    } catch { /* non bloquant, on avance quand même */ }
    navigate('/dashboard');
  };

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
  // GSM forwarding MMI code, works on iOS and Android: opens the dialer with
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
    { icon: Phone,        title: 'Téléphone puis Renvoi d\'appel', body: 'Dans Réglages, sélectionne Téléphone, puis Renvoi d\'appel.' },
    { icon: Check,        title: 'Active le renvoi',      body: 'Active l\'interrupteur Renvoi d\'appel.' },
    { icon: Bot,          title: 'Saisis le numéro Qwillio', body: `Dans Transférer vers, entre ${numberClean || 'ton numéro Qwillio'}.` },
  ];

  const androidSteps = [
    { icon: Phone,        title: 'Ouvre l\'app Téléphone',    body: 'Lance l\'app Téléphone (ou Dialer).' },
    { icon: SettingsIcon, title: 'Menu puis Paramètres',      body: 'Appuie sur ⋮ ou ☰ puis Paramètres.' },
    { icon: Phone,        title: 'Comptes d\'appel puis Renvoi', body: 'Ouvre Comptes d\'appel (ou Appels), puis Renvoi d\'appel.' },
    { icon: Check,        title: 'Activer "Toujours renvoyer"', body: 'Sélectionne Toujours renvoyer puis Activer.' },
    { icon: Bot,          title: 'Saisis le numéro Qwillio', body: `Entre ${numberClean || 'ton numéro Qwillio'}, puis Activer.` },
  ];

  const steps = platform === 'android' ? androidSteps : iosSteps;

  return (
    <div className="max-w-xl">
      <PageActions subtitle="Configure ton téléphone pour que chaque appel entrant soit pris en charge automatiquement par ton réceptionniste Qwillio.">
        <GhostBtn onClick={() => navigate(-1)}>
          <ChevronLeft size={14} aria-hidden="true" /> Retour
        </GhostBtn>
      </PageActions>

      <div className="space-y-3">
        {/* Sélecteur de plateforme */}
        <div className="flex p-1 rounded-full border border-q2-graphite-d bg-q2-carbon">
          {([
            { id: 'ios',     icon: Apple,      label: 'iPhone'  },
            { id: 'android', icon: Smartphone, label: 'Android' },
          ] as const).map(p => {
            const active = platform === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                aria-pressed={active}
                className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-full text-[13px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
                  active ? 'bg-q2-obsidian text-white' : 'text-q2-fog hover:text-q2-mist'
                }`}
              >
                <p.icon size={14} aria-hidden="true" /> {p.label}
              </button>
            );
          })}
        </div>

        {/* Action rapide: le code GSM en un tap */}
        <Card>
          <p className="q2-eyebrow text-q2-fog mb-3">Activation en 1 clic</p>
          <div className="flex items-center gap-2">
            <a
              href={forwardLink}
              onClick={e => { if (!forwardLink) e.preventDefault(); }}
              aria-disabled={!forwardLink}
              className={`flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-full text-[13px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
                forwardLink
                  ? 'bg-q2-indigo text-white hover:bg-q2-deep'
                  : 'bg-q2-obsidian text-q2-fog cursor-not-allowed'
              }`}
            >
              <Phone size={14} aria-hidden="true" /> Composer <span className="tabular-nums">{forwardMmi}</span>
            </a>
            <button
              type="button"
              onClick={() => copy(forwardMmi)}
              className="w-10 h-10 shrink-0 rounded-full border border-q2-graphite-d text-q2-fog hover:text-q2-mist hover:border-q2-smoke-d flex items-center justify-center transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
              title="Copier le code"
              aria-label="Copier le code"
            >
              {copied
                ? <Check size={15} style={{ color: 'var(--q2p-ok)' }} aria-hidden="true" />
                : <Copy size={15} aria-hidden="true" />}
            </button>
          </div>
          <p className="text-[11.5px] text-q2-fog mt-3 leading-relaxed q2-body-text">
            Le code MMI ouvre directement le clavier. Appuie sur Appeler pour activer le renvoi immédiatement. Fonctionne sur iPhone comme Android.
          </p>
        </Card>

        {/* Étape par étape */}
        <div>
          <p className="q2-eyebrow text-q2-fog mb-3">
            Étape par étape : {platform === 'android' ? 'Android' : 'iPhone'}
          </p>
          <Card pad={false}>
            {steps.map((s, i) => (
              <div
                key={s.title}
                className={`flex items-start gap-3.5 px-4 py-3.5 ${i === 0 ? '' : 'border-t border-q2-graphite-d'}`}
              >
                <span className="w-8 h-8 shrink-0 rounded-full bg-q2-obsidian flex items-center justify-center text-[12px] font-medium text-q2-lift tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <s.icon size={13} className="text-q2-fog" aria-hidden="true" />
                    <p className="text-[13.5px] font-medium text-white">{s.title}</p>
                  </div>
                  <p className="text-[12px] text-q2-fog leading-relaxed q2-body-text">{s.body}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Désactivation */}
        <Card>
          <p className="text-[13.5px] font-medium text-white mb-1">Désactiver plus tard</p>
          <p className="text-[12px] text-q2-fog mb-3 q2-body-text">
            Compose <code className="tabular-nums text-q2-mist">##21#</code> depuis ton téléphone pour couper le renvoi.
          </p>
          <a
            href={cancelLink}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-q2-graphite-d text-[12.5px] font-medium text-q2-mist hover:border-q2-smoke-d transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
          >
            <Phone size={12} aria-hidden="true" /> Composer ##21#
          </a>
        </Card>

        {/* Confirmation */}
        <PrimaryBtn onClick={confirmForwarding} disabled={confirming} className="w-full h-10">
          {confirming ? 'Enregistrement…' : (<>J'ai configuré mon téléphone <ArrowRight size={14} aria-hidden="true" /></>)}
        </PrimaryBtn>
      </div>
    </div>
  );
}
