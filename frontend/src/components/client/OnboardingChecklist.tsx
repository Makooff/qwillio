import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Phone, PhoneCall, Settings, Rocket, X, PartyPopper,
  PhoneForwarded, ChevronRight, ChevronDown,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { pro } from '../../styles/pro-theme';

interface OnboardingClient {
  hasPhone?: boolean;
  hasTestCall?: boolean;
  hasCustomConfig?: boolean;
  hasCallForwarding?: boolean;
  isActive?: boolean;
  transferNumber?: string;
  vapiPhoneNumber?: string;
  forwardingVerifiedAt?: string | null;
  forwardingStatus?: string | null;
  subscriptionStatus?: string;
  businessName?: string;
}

interface Props {
  client: OnboardingClient;
  onDismiss?: () => void;
}

interface Step {
  label: string;
  hint: string;
  done: boolean;
  to?: string;    // internal react-router route
  href?: string;  // external / tel: link
  icon: React.ElementType;
}

export default function OnboardingChecklist({ client, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const forwardingDone = !!(
    client.hasCallForwarding ||
    client.forwardingVerifiedAt ||
    client.forwardingStatus === 'verified'
  );

  const qwillioNumber = client.vapiPhoneNumber;

  const steps: Step[] = [
    {
      label: 'Compte créé',
      hint:  'Bienvenue sur Qwillio',
      done:  true,
      to:    '/dashboard',
      icon:  Check,
    },
    {
      // ── The important one — expose the forwarding setup explicitly ──
      label: 'Rediriger vos appels vers Qwillio',
      hint:  'iPhone ou Android — guide pas à pas, activation en 1 clic',
      done:  forwardingDone,
      to:    '/dashboard/setup/call-forwarding',
      icon:  PhoneForwarded,
    },
    {
      label: 'Configurer votre numéro de contact',
      hint:  'Ajoutez le numéro interne vers lequel transférer les urgences',
      done:  !!(client.transferNumber || client.vapiPhoneNumber),
      to:    '/dashboard/receptionist#transfer',
      icon:  Phone,
    },
    {
      label: 'Tester un appel de démonstration',
      hint:  qwillioNumber
        ? `Touchez pour appeler ${qwillioNumber} et parler à Ashley`
        : 'Votre numéro Qwillio sera disponible après la configuration',
      done:  !!client.hasTestCall,
      // tel: launches the phone dialer directly when a number is set,
      // otherwise fall back to the receptionist page where the number
      // is displayed and can be copied.
      href:  qwillioNumber ? `tel:${qwillioNumber}` : undefined,
      to:    qwillioNumber ? undefined : '/dashboard/receptionist',
      icon:  PhoneCall,
    },
    {
      label: 'Personnaliser votre réceptionniste',
      hint:  'Étapes guidées : ton, services, horaires, FAQ',
      done:  !!client.hasCustomConfig,
      to:    '/dashboard/setup/customize',
      icon:  Settings,
    },
    {
      label: 'Activer en production',
      hint:  'Abonnement actif — appels comptabilisés dans votre quota',
      done:  !!(client.isActive || client.subscriptionStatus === 'active'),
      to:    '/dashboard/billing',
      icon:  Rocket,
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  const pct = Math.round((doneCount / steps.length) * 100);

  const pending = steps.filter(s => !s.done);
  const done = steps.filter(s => s.done);

  const renderRow = (s: Step, highlighted: boolean) => {
    const rowClass = 'flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-white/[0.02]';
    const rowStyle = {
      borderTop: `1px solid ${pro.border}`,
      background: highlighted ? 'rgba(255,255,255,0.03)' : undefined,
    } as const;
    const inner = (
      <>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: s.done ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)' }}
        >
          {s.done
            ? <Check size={12} style={{ color: pro.ok }} />
            : <span className="w-1.5 h-1.5 rounded-full" style={{ background: pro.textSec }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-medium truncate ${s.done ? 'line-through' : ''}`} style={{ color: s.done ? pro.textTer : pro.text }}>{s.label}</p>
          {highlighted && <p className="text-[11px] truncate" style={{ color: pro.textTer }}>{s.hint}</p>}
        </div>
        {!s.done && <ChevronRight size={14} style={{ color: pro.textTer }} />}
      </>
    );
    if (s.href) return <a key={s.label} href={s.href} className={rowClass} style={rowStyle}>{inner}</a>;
    return <Link key={s.label} to={s.to || '#'} className={rowClass} style={rowStyle}>{inner}</Link>;
  };

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden border"
      style={{ background: pro.panel, borderColor: pro.border }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {allDone
              ? <PartyPopper size={15} style={{ color: pro.ok }} />
              : <span className="w-1.5 h-1.5 rounded-full" style={{ background: pro.accent }} />
            }
            <h3 className="text-[13px] font-semibold" style={{ color: pro.text }}>
              {allDone ? 'Vous êtes prêt' : 'Démarrer avec Qwillio'}
            </h3>
          </div>
          <p className="text-[11.5px] mt-0.5" style={{ color: pro.textSec }}>
            {doneCount} / {steps.length} étape{doneCount > 1 ? 's' : ''} complétée{doneCount > 1 ? 's' : ''}
          </p>
        </div>
        {(allDone || onDismiss) && (
          <button
            onClick={() => { setDismissed(true); onDismiss?.(); }}
            className="p-1 rounded hover:bg-white/[0.06]"
            style={{ color: pro.textTer }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 mx-5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: allDone ? pro.ok : pro.accent }}
        />
      </div>

      {/* Steps — compact: active step(s) shown, completed ones collapsed */}
      <div className="mt-3">
        {pending.map((s, i) => renderRow(s, i === 0))}

        {done.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDone(v => !v)}
              className="w-full flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-white/[0.02]"
              style={{ borderTop: `1px solid ${pro.border}` }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(34,197,94,0.12)' }}
              >
                <Check size={12} style={{ color: pro.ok }} />
              </div>
              <span className="flex-1 text-left text-[12.5px]" style={{ color: pro.textSec }}>
                {done.length} étape{done.length > 1 ? 's' : ''} terminée{done.length > 1 ? 's' : ''}
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showDone ? 'rotate-180' : ''}`}
                style={{ color: pro.textTer }}
              />
            </button>
            {showDone && done.map(s => renderRow(s, false))}
          </>
        )}
      </div>
    </motion.div>
  );
}
