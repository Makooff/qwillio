import { Phone, CheckCircle2, FileText, Mail, Smartphone, AlertTriangle, HelpCircle, CalendarCheck } from '../icons';

/* Les illustrations des rangées « produit » de l'accueil.
 *
 * C'étaient deux .webp: des captures d'écran du site, recadrées. Deux défauts,
 * l'un visible et l'autre non:
 *   - VISIBLE, sur un téléphone: une capture faite en 1600 px de large et
 *     rendue en 350 est illisible, et son contenu ne correspondait plus au
 *     texte à côté (une fenêtre de configuration servait de preuve à un
 *     paragraphe qui parle du constat hebdomadaire);
 *   - INVISIBLE: une image est morte. Elle ne suit ni la langue, ni le thème,
 *     ni un changement du dashboard, et elle vieillit sans prévenir.
 * Ces deux blocs sont donc du BALISAGE, repris des vrais écrans: la fiche
 * d'appel de `pages/client/ClientCalls.tsx`, et le constat hebdomadaire tel que
 * `services/voice/receptionist-digest.service.ts` l'envoie, phrases comprises.
 * Ils sont nets à toutes les tailles, bilingues, et se corrigent avec le
 * produit (demande utilisateur: « ne prends pas de simples captures du site,
 * reprends la section sur une carte »).
 *
 * Registre: le dashboard est sombre dans les deux thèmes, comme toute surface
 * « drenched » de la V2. Les valeurs ci-dessous sont donc celles du produit
 * (`#7349fe`, `#F5F5F7`, `#A1A1A8`), pas les jetons de page qui, eux, basculent.
 *
 * Décoratif: `aria-hidden`. Le paragraphe voisin dit déjà tout ce que ces
 * blocs montrent, et un lecteur d'écran n'a pas à traverser une maquette.
 */

const SURFACE = 'rounded-2xl border border-white/[0.07] bg-white/[0.04]';
const LABEL = 'text-[10px] uppercase tracking-[0.14em] text-[#A1A1A8]';

/** La fiche d'appel, telle qu'elle se remplit à la seconde où l'appel finit. */
export function CallRecordIllustration({ isFr }: { isFr: boolean }) {
  /* Trois valeurs COURTES, et c'est un choix de gabarit: sur 390 px chaque
     tuile ne dispose que d'un tiers de la largeur, et « Rendez-vous » ou une
     date complète y passaient à la ligne au milieu d'un mot. La date part donc
     sous le nom, où elle a toute la place. Les trois retenues sont aussi les
     trois que le paragraphe promet: la durée, l'humeur, le lead qualifié. */
  const metrics = [
    { label: isFr ? 'Durée' : 'Duration', value: isFr ? '2 min 08' : '2m 08s' },
    { label: 'Sentiment', value: isFr ? 'Positif' : 'Positive' },
    { label: 'Lead', value: '9/10' },
  ];

  return (
    <div className="p-4 sm:p-5" aria-hidden="true">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 rounded-xl bg-[#7349fe]/15 flex items-center justify-center flex-shrink-0">
          <Phone size={17} className="text-[#b9a8ff]" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#F5F5F7] leading-tight">Mme Lefèvre</p>
          <p className="text-[11.5px] text-[#A1A1A8] mt-0.5 tabular-nums truncate">
            +32 471 12 34 56
            {/* La date s'efface sous 640 px: tronquée, elle ne laissait qu'un
                « · A… » qui ne dit rien et donne l'air cassé. */}
            <span className="hidden sm:inline"> · {isFr ? '04/08, 12 h 58' : 'Aug 4, 12:58'}</span>
          </p>
        </div>
        {/* Le badge de réservation: le mot « rendez-vous » du texte, sur la
            fiche, à l'endroit exact où le produit l'écrit. */}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-[#5FD08A] bg-[#5FD08A]/10 px-2.5 py-1 rounded-full whitespace-nowrap">
          <CheckCircle2 size={11} />
          {isFr ? 'Réservé' : 'Booked'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {metrics.map(m => (
          <div key={m.label} className={`${SURFACE} px-3 py-2.5`}>
            <p className={`${LABEL} mb-1`}>{m.label}</p>
            <p className="text-[12.5px] font-medium text-[#F5F5F7] leading-tight">{m.value}</p>
          </div>
        ))}
      </div>

      <div className={`${SURFACE} p-3.5 mb-3`}>
        <p className={`${LABEL} mb-2`}>{isFr ? 'Résumé IA' : 'AI summary'}</p>
        <p className="text-[12.5px] leading-relaxed text-[#F5F5F7]/85">
          {isFr
            ? 'Rendez-vous confirmé mardi 14 h 30, coloration. Confirmation SMS envoyée.'
            : 'Appointment confirmed Tuesday 2:30 pm, colouring. SMS confirmation sent.'}
        </p>
      </div>

      {/* Transcript et enregistrement: les deux dernières promesses du
          paragraphe, et les deux dernières lignes de la vraie fiche. */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`${SURFACE} px-3 py-2.5 flex items-center gap-2`}>
          <FileText size={13} className="text-[#A1A1A8] flex-shrink-0" />
          <span className="text-[12px] text-[#F5F5F7]/80">Transcript</span>
        </div>
        <div className={`${SURFACE} px-3 py-2.5 flex items-center gap-2`}>
          <span className="w-6 h-6 rounded-full bg-[#7349fe] flex items-center justify-center flex-shrink-0">
            <svg width="7" height="8" viewBox="0 0 7 8" aria-hidden="true">
              <path d="M0 0l7 4-7 4z" fill="#fff" />
            </svg>
          </span>
          <span className="text-[12px] text-[#F5F5F7]/80 tabular-nums">0:00 / 2:08</span>
        </div>
      </div>
    </div>
  );
}

/** Le constat du dimanche, mot pour mot celui que le backend expédie. */
export function WeeklyDigestIllustration({ isFr }: { isFr: boolean }) {
  /* Ces trois lignes sont RECOPIÉES de `clientLine()`
     (receptionist-digest.service.ts): ce sont les seules qui parviennent au
     client, et les écrire autrement ici ferait de la maquette une promesse que
     le produit ne tient pas. */
  const findings = [
    {
      icon: AlertTriangle,
      tone: '#F2B34B',
      text: isFr
        ? 'Ses réponses sont trop longues : les appelants la coupent en pleine phrase.'
        : 'Her answers run too long: callers cut in mid-sentence.',
    },
    {
      icon: CalendarCheck,
      tone: '#F2B34B',
      text: isFr
        ? 'Votre agenda ne répond plus : reconnectez Google Agenda.'
        : 'Your calendar stopped responding: reconnect Google Calendar.',
    },
    {
      icon: HelpCircle,
      tone: '#A1A1A8',
      text: isFr
        ? 'Des questions reviennent sans réponse dans sa base de connaissances.'
        : 'Questions keep coming back that her knowledge base cannot answer.',
    },
  ];

  return (
    <div className="p-4 sm:p-5" aria-hidden="true">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <p className="text-[13.5px] font-semibold text-[#F5F5F7] leading-snug">
          {isFr ? 'Le point de la semaine' : 'This week on your receptionist'}
        </p>
        <span className="text-[11px] text-[#A1A1A8] tabular-nums whitespace-nowrap">2026-W32</span>
      </div>

      <ul className="space-y-2 mb-4" role="list">
        {findings.map(f => (
          <li key={f.text} className={`${SURFACE} p-3 flex items-start gap-2.5`}>
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-px"
              style={{ background: `${f.tone}1A` }}
            >
              <f.icon size={13} style={{ color: f.tone }} />
            </span>
            <p className="text-[12.5px] leading-[1.5] text-[#F5F5F7]/85">{f.text}</p>
          </li>
        ))}
      </ul>

      {/* Les deux canaux, parce que le paragraphe les promet et que le service
          les tente séparément: un courriel qui rebondit ne coûte pas le SMS. */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.07]">
        <span className="flex items-center gap-1.5 text-[11.5px] text-[#A1A1A8]">
          <Mail size={12} />
          {isFr ? 'Envoyé par courriel' : 'Sent by email'}
        </span>
        <span className="text-white/15" aria-hidden="true">·</span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-[#A1A1A8]">
          <Smartphone size={12} />
          {isFr ? 'et par SMS' : 'and by SMS'}
        </span>
        <span className="ml-auto text-[11.5px] font-semibold text-[#b9a8ff]">
          {isFr ? 'Chaque dimanche' : 'Every Sunday'}
        </span>
      </div>
    </div>
  );
}
