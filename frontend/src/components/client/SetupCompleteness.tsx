import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, ChevronRight, HelpCircle } from '../icons';
import { pro } from '../../styles/pro-theme';

/**
 * Ce que la réceptionniste SAIT, et ce qu'il lui manque en premier.
 *
 * Retour du 13/09/2026 : « le compte est activable avec peu d'informations,
 * j'ai peur que l'IA invente ». Le bandeau « Démarrer avec Qwillio » cochait
 * « Personnaliser » dès un seul réglage ; cette carte dit combien il en manque
 * pour le MÉTIER du client, pondéré (le numéro de transfert et les horaires
 * pèsent plus qu'un champ), et pose les trois manques les plus lourds avec un
 * lien direct. Les questions d'appelants restées sans réponse y figurent
 * aussi : elles vivaient sous la page Réceptionniste, sous la ligne de
 * flottaison, c'est-à-dire là où personne ne les voyait.
 *
 * Le calcul vient du serveur (`/my-dashboard/overview`, champ `setup`), de la
 * même table que le formulaire et que le prompt : ce qu'on demande ici est
 * exactement ce que l'agent lira.
 */

export interface SetupItem {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  weight: number;
  to: string;
}

export interface SetupState {
  score: number;
  done: number;
  total: number;
  missing: SetupItem[];
  openGaps: number;
  niche: string;
}

/** « ce qu'un cabinet dentaire doit savoir » : le métier, en toutes lettres. */
const NICHE_PHRASE: Record<string, string> = {
  restaurant: 'un restaurant',
  dental: 'un cabinet dentaire',
  medical: 'un cabinet médical',
  salon: 'un salon',
  law: 'un cabinet d’avocats',
  real_estate: 'une agence immobilière',
  auto: 'un garage',
  home_services: 'une entreprise de services',
  veterinary: 'une clinique vétérinaire',
  fitness: 'une salle de sport',
  financial: 'un cabinet de conseil',
  default: 'votre activité',
};

export const GAPS_LINK = '/dashboard/receptionist#connaissances';

export default function SetupCompleteness({ setup }: { setup: SetupState | null | undefined }) {
  if (!setup) return null;
  const complete = setup.score >= 100;
  if (complete && setup.openGaps === 0) return null;

  const top = setup.missing.slice(0, 3);
  const rest = setup.missing.length - top.length;
  const trade = NICHE_PHRASE[setup.niche] ?? NICHE_PHRASE.default;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Ce que votre réceptionniste sait"
      className="rounded-2xl overflow-hidden border"
      style={{ background: pro.panel, borderColor: pro.border }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen size={15} style={{ color: complete ? pro.ok : pro.accent }} />
            <h3 className="text-[13px] font-semibold" style={{ color: pro.text }}>
              Ce que votre réceptionniste sait
            </h3>
          </div>
          <p className="text-[12px] mt-1" style={{ color: pro.textSec }}>
            <span className="tabular-nums font-semibold" style={{ color: pro.text }}>{setup.score} %</span>
            {' '}de ce qu{trade.startsWith('u') ? '’' : 'e '}{trade} doit savoir répondre au téléphone.
            {!complete && ' Ce qu’elle ne sait pas, elle ne l’invente pas : elle propose de faire rappeler.'}
          </p>
        </div>
        {!complete && (
          <Link
            to="/dashboard/setup/guide"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-4 text-[12.5px] font-medium text-[#0a0a0a] transition-opacity hover:opacity-90 active:scale-[0.97]"
          >
            Compléter en quelques minutes <ChevronRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="h-1 mx-5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(100, setup.score)}%`, background: complete ? pro.ok : pro.accent }}
        />
      </div>

      <ul className="mt-3">
        {top.map(item => (
          <li key={item.id}>
            <Link
              to={item.to}
              className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-white/[0.02]"
              style={{ borderTop: `1px solid ${pro.border}` }}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: pro.textSec }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium truncate" style={{ color: pro.text }}>{item.label}</span>
                <span className="block text-[11px] truncate" style={{ color: pro.textTer }}>{item.hint}</span>
              </span>
              <ChevronRight size={14} style={{ color: pro.textTer }} aria-hidden="true" />
            </Link>
          </li>
        ))}
        {setup.openGaps > 0 && (
          <li>
            <Link
              to={GAPS_LINK}
              className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-white/[0.02]"
              style={{ borderTop: `1px solid ${pro.border}` }}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)' }}>
                <HelpCircle size={12} style={{ color: '#F59E0B' }} aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium truncate" style={{ color: pro.text }}>
                  {setup.openGaps === 1
                    ? 'Une question d’appelant est restée sans réponse'
                    : `${setup.openGaps} questions d’appelants sont restées sans réponse`}
                </span>
                <span className="block text-[11px] truncate" style={{ color: pro.textTer }}>
                  Répondez une fois, l’agent saura la prochaine fois.
                </span>
              </span>
              <ChevronRight size={14} style={{ color: pro.textTer }} aria-hidden="true" />
            </Link>
          </li>
        )}
      </ul>
      {rest > 0 && (
        <p className="px-5 py-2.5 text-[11.5px]" style={{ color: pro.textTer, borderTop: `1px solid ${pro.border}` }}>
          {rest === 1 ? 'Et un autre point à compléter.' : `Et ${rest} autres points à compléter.`}
        </p>
      )}
    </motion.section>
  );
}
