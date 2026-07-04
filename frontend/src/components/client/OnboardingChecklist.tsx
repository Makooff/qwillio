import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Phone, PhoneCall, Settings, Rocket, X, PartyPopper } from 'lucide-react';
import { motion } from 'framer-motion';

interface OnboardingClient {
  hasPhone?: boolean;
  hasTestCall?: boolean;
  hasCustomConfig?: boolean;
  isActive?: boolean;
  transferNumber?: string;
  vapiPhoneNumber?: string;
  subscriptionStatus?: string;
  businessName?: string;
}

interface Props {
  client: OnboardingClient;
  onDismiss?: () => void;
}

interface Step {
  label: string;
  done: boolean;
  to: string;
  icon: React.ElementType;
}

export default function OnboardingChecklist({ client, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const steps: Step[] = [
    {
      label: 'Compte créé',
      done: true,
      to: '/dashboard',
      icon: Check,
    },
    {
      label: 'Configurer votre numéro de téléphone',
      done: !!(client.hasPhone || client.transferNumber || client.vapiPhoneNumber),
      to: '/dashboard/receptionist',
      icon: Phone,
    },
    {
      label: 'Tester un appel de démonstration',
      done: !!client.hasTestCall,
      to: '/dashboard/calls',
      icon: PhoneCall,
    },
    {
      label: 'Personnaliser votre réceptionniste',
      done: !!client.hasCustomConfig,
      to: '/dashboard/receptionist',
      icon: Settings,
    },
    {
      label: 'Activer en production',
      done: !!(client.isActive || client.subscriptionStatus === 'active'),
      to: '/dashboard/billing',
      icon: Rocket,
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  const pct = Math.round((doneCount / steps.length) * 100);

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.06] p-5"
      style={{
        background: 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#F8F8FF]">
            {allDone ? 'Configuration terminée !' : 'Démarrer avec Qwillio'}
          </h3>
          <p className="text-[10px] text-[#8B8BA7] mt-0.5">
            {allDone
              ? 'Votre réceptionniste IA est prête.'
              : `${doneCount} sur ${steps.length} étapes complétées`}
          </p>
        </div>
        {allDone && (
          <button
            onClick={() => { setDismissed(true); onDismiss?.(); }}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4 text-[#8B8BA7]" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-5">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            background: allDone
              ? '#22C55E'
              : 'linear-gradient(90deg, #7B5CF0, #A78BFA)',
          }}
        />
      </div>

      {/* All done message */}
      {allDone ? (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/15 rounded-xl px-4 py-3">
          <PartyPopper className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-400">Félicitations !</p>
            <p className="text-xs text-[#8B8BA7]">
              Toutes les étapes sont complétées. Votre réceptionniste IA est en service.
            </p>
          </div>
        </div>
      ) : (
        /* Steps list */
        <div className="space-y-1">
          {steps.map((step, i) => (
            <Link
              key={i}
              to={step.done ? '#' : step.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                step.done
                  ? 'opacity-60 cursor-default'
                  : 'hover:bg-white/[0.03] cursor-pointer'
              }`}
              onClick={step.done ? (e) => e.preventDefault() : undefined}
            >
              {/* Checkbox circle */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
                  step.done
                    ? 'bg-emerald-500/20 border-emerald-500/30'
                    : 'border-white/[0.12] group-hover:border-[#7B5CF0]/40'
                }`}
              >
                {step.done ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <step.icon className="w-3.5 h-3.5 text-[#8B8BA7] group-hover:text-[#7B5CF0]" />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-sm flex-1 ${
                  step.done
                    ? 'text-[#8B8BA7] line-through'
                    : 'text-[#F8F8FF] group-hover:text-white'
                }`}
              >
                {step.label}
              </span>

              {/* Arrow for incomplete */}
              {!step.done && (
                <span className="text-xs text-[#8B8BA7] group-hover:text-[#7B5CF0] transition-colors">
                  Configurer &rarr;
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}
