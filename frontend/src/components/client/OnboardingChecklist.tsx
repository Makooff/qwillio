import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Phone, PhoneCall, Settings, Rocket, X, PartyPopper,
  PhoneForwarded, ChevronRight,
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

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden border"
      style={{ background: pro.panel, borderColor: pro.border }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
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
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: allDone ? pro.ok : pro.accent }}
        />
      </div>

      {/* Steps list */}
      <div className="mt-4">
        {steps.map((s, i) => {
          const highlighted = !s.done && steps.slice(0, i).every(x => x.done);
          const rowClass = 'flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]';
          const rowStyle = {
            borderTop: `1px solid ${pro.border}`,
            background: highlighted ? 'rgba(123,92,240,0.05)' : undefined,
          } as const;
          const inner = (
            <>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: s.done ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                  border: highlighted ? `1px solid ${pro.accent}55` : undefined,
                }}
              >
                {s.done
                  ? <Check size={13} style={{ color: pro.ok }} />
                  : <s.icon size={12} style={{ color: highlighted ? pro.accent : pro.textSec }} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[13px] font-medium truncate ${s.done ? 'line-through' : ''}`}
                  style={{ color: s.done ? pro.textTer : pro.text }}
                >
                  {s.label}
                </p>
                {!s.done && (
                  <p className="text-[11px] truncate" style={{ color: pro.textTer }}>{s.hint}</p>
                )}
              </div>
              {!s.done && (
                <ChevronRight size={14} style={{ color: highlighted ? pro.accent : pro.textTer }} />
              )}
            </>
          );
          if (s.href) {
            return (
              <a key={i} href={s.href} className={rowClass} style={rowStyle}>{inner}</a>
            );
          }
          return (
            <Link key={i} to={s.to || '#'} className={rowClass} style={rowStyle}>{inner}</Link>
          );
        })}
      </div>
    </motion.div>
  );
}
