import type { CSSProperties, ReactNode } from 'react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Play, Phone, CalendarCheck, PhoneForwarded, UserCheck,
  MessagesSquare, Mic, Camera, PhoneCall, Shield,
  type LucideIcon,
} from '../../components/icons';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import CardV2 from '../../components/v2/CardV2';
import HeroPhone3D from '../../components/ui/HeroPhone3D';
import VoiceCard, { type VoiceData } from '../../components/landing/VoiceCard';
import TryVoiceButton from '../../components/v2/TryVoiceButton';
import StepFrame from '../../components/v2/motion/StepFrame';

/* Réceptionniste V2 « Papier & Signal » (DA/v2-direction.md).
   Récit: un réceptionniste qui agit pendant l'appel. Indigo = ce qui décroche
   (inbound). Aucun chiffre de latence de conversation, aucun témoignage.
   La prise de rendez-vous en direct est toujours conditionnée à l'agenda connecté. */

const NB = '\u00A0';

/* Intensit\u00E9 d'un halo d\u00E9coratif (.q2-halo, v2.css), en variable CSS */
const halo = (opacity: number) => ({ '--q2-halo-o': String(opacity) }) as CSSProperties;

interface Pillar {
  icon: LucideIcon;
  num: string;
  title: string;
  body: string;
  panelLabel: string;
  panelRows: { label: string; meta?: string }[];
  panelNote?: string;
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <CardV2 variant="band" large className="h-full">
      <p className="q2-eyebrow text-q2-body mb-6">{label}</p>
      {children}
    </CardV2>
  );
}

export default function Receptionist() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const pillarsRef = useRef<HTMLDivElement>(null);

  useSEO({
    title: isFr
      ? 'Réceptionniste IA qui prend le rendez-vous pendant l’appel'
      : 'AI receptionist that books during the call',
    description: isFr
      ? 'Qwillio répond, lit votre agenda Google en direct, inscrit le rendez-vous pendant l’appel, vous résume l’appelant avant de vous le passer et reconnaît vos habitués. Français et anglais, conforme RGPD, à partir de 99 € par mois.'
      : 'Qwillio answers, reads your Google calendar live, books the appointment during the call, briefs you before handing the caller over and recognises your regulars. French and English, GDPR compliant, from €99 a month.',
    canonical: 'https://qwillio.com/receptionist',
  });

  const voices: VoiceData[] = [
    {
      id: 'marie',
      name: 'Marie',
      accent: isFr ? 'Français · France et Belgique' : 'French · France and Belgium',
      vibe: isFr
        ? 'Chaleureuse et accueillante, sourire dans la voix.'
        : 'Warm and welcoming, a smile in her voice.',
      swatch: '#7a5fff',
      ring: 'rgba(122,95,255,0.45)',
      initials: 'MA',
      lang: isFr ? 'fr-FR' : 'en-US',
      sample: isFr
        ? 'Bonjour, merci d’appeler ! Comment puis-je vous aider aujourd’hui ?'
        : 'Hello, thanks for calling! How can I help you today?',
    },
    {
      id: 'lucas',
      name: 'Lucas',
      accent: isFr ? 'Français · France et Belgique' : 'French · France and Belgium',
      vibe: isFr
        ? 'Posé et professionnel, direct et rassurant.'
        : 'Composed and professional, direct and reassuring.',
      swatch: '#cd6bfb',
      ring: 'rgba(205,107,251,0.45)',
      initials: 'LU',
      lang: isFr ? 'fr-FR' : 'en-US',
      sample: isFr
        ? `Bonjour, vous êtes bien au secrétariat. Que puis-je faire pour vous${NB}?`
        : 'Hello, you’ve reached the front desk. What can I do for you?',
    },
  ];

  // Les huit autres personnages du catalogue (voice-characters.ts). Chacun a
  // son portrait et sa voix ; le tag dit l'accent porté par la voix, pas la
  // langue: tous répondent en français comme en anglais.
  const otherVoices = isFr
    ? [
        { id: 'camille', name: 'Camille', note: 'Soignée et raffinée, pour une image premium.', tag: 'FR' },
        { id: 'lea', name: 'Léa', note: 'Dynamique et enthousiaste, pleine d’énergie.', tag: 'FR' },
        { id: 'sofia', name: 'Sofia', note: 'Naturelle et décontractée, ton conversationnel.', tag: 'FR' },
        { id: 'nour', name: 'Nour', note: 'Douce et rassurante, idéale pour la santé.', tag: 'FR' },
        { id: 'adrien', name: 'Adrien', note: 'Chaleureux et avenant, met à l’aise tout de suite.', tag: 'FR' },
        { id: 'hugo', name: 'Hugo', note: 'Détendu et direct, comme un collègue au comptoir.', tag: 'FR' },
        { id: 'theo', name: 'Théo', note: 'Énergique et motivé, ça s’entend au téléphone.', tag: 'FR' },
        { id: 'julien', name: 'Julien', note: 'Distingué et posé, pour une maison haut de gamme.', tag: 'FR' },
      ]
    : [
        { id: 'camille', name: 'Camille', note: 'Polished and refined, for a premium brand.', tag: 'FR' },
        { id: 'lea', name: 'Léa', note: 'Dynamic and upbeat, full of energy.', tag: 'FR' },
        { id: 'sofia', name: 'Sofia', note: 'Natural and easy-going, conversational tone.', tag: 'FR' },
        { id: 'nour', name: 'Nour', note: 'Soft and reassuring, ideal for healthcare.', tag: 'FR' },
        { id: 'adrien', name: 'Adrien', note: 'Warm and approachable, puts callers at ease.', tag: 'FR' },
        { id: 'hugo', name: 'Hugo', note: 'Relaxed and direct, like a colleague at the desk.', tag: 'FR' },
        { id: 'theo', name: 'Théo', note: 'Energetic and driven, you can hear it on the line.', tag: 'FR' },
        { id: 'julien', name: 'Julien', note: 'Distinguished and composed, for a high-end house.', tag: 'FR' },
      ];

  const tones = isFr
    ? ['Chaleureux', 'Professionnel', 'Décontracté', 'Énergique', 'Haut de gamme', 'Rassurant']
    : ['Warm', 'Professional', 'Casual', 'Energetic', 'Premium', 'Reassuring'];

  const trades: { label: string; href: string }[] = isFr
    ? [
        { label: 'Dentiste', href: '/dentiste' },
        { label: 'Avocat', href: '/avocat' },
        { label: 'Notaire', href: '/notaire' },
        { label: 'Plombier', href: '/plombier' },
        { label: 'Garagiste', href: '/garagiste' },
        { label: 'Kiné', href: '/kine' },
        { label: 'Restaurant', href: '/restaurant' },
        { label: 'Immobilier', href: '/immobilier' },
        { label: 'Coiffeur', href: '/coiffeur' },
        { label: 'Fiduciaire', href: '/fiduciaire' },
      ]
    : [
        { label: 'Dental', href: '/dentiste' },
        { label: 'Legal', href: '/avocat' },
        { label: 'Notary', href: '/notaire' },
        { label: 'Plumbing', href: '/plombier' },
        { label: 'Garage', href: '/garagiste' },
        { label: 'Physio', href: '/kine' },
        { label: 'Restaurant', href: '/restaurant' },
        { label: 'Real estate', href: '/immobilier' },
        { label: 'Hair salon', href: '/coiffeur' },
        { label: 'Accounting', href: '/fiduciaire' },
      ];

  const pillars: Pillar[] = isFr
    ? [
        {
          icon: CalendarCheck,
          num: '01',
          title: 'Le rendez-vous est inscrit avant qu’il raccroche',
          body: 'Dès qu’un jour est prononcé, la disponibilité part en avance vers votre agenda Google. Le créneau retenu est écrit confirmé, pas mis de côté pour plus tard. Deux appels au même moment ne peuvent pas repartir avec le même créneau.',
          panelLabel: 'Ce qui se passe pendant la phrase',
          panelRows: [
            { label: 'Un jour est prononcé, l’agenda est interrogé', meta: 'en avance' },
            { label: 'Le créneau choisi est écrit, confirmé' },
            { label: 'Un créneau retenu disparaît des autres appels' },
          ],
          panelNote: `Fonctionne si votre agenda Google est connecté${NB}: sinon il note la demande et vous rappelez.`,
        },
        {
          icon: PhoneForwarded,
          num: '02',
          title: 'Il vous dit qui appelle avant de vous passer l’appel',
          body: 'Vous ne décrochez plus dans le vide. Avant de faire le pont, il vous résume à l’oral qui est en ligne et pourquoi, puis vous envoie le même brief par SMS, avec le numéro et l’état d’esprit de l’appelant.',
          panelLabel: 'Le SMS de brief',
          panelRows: [
            { label: 'Qui appelle', meta: 'nom et numéro' },
            { label: 'Ce qu’il veut', meta: 'motif' },
            { label: 'Dans quel état', meta: 'pressé, contrarié' },
          ],
          panelNote: 'Si le transfert saute, vous avez le numéro sous les yeux.',
        },
        {
          icon: UserCheck,
          num: '03',
          title: 'Vos habitués sont reconnus, pas réinterrogés',
          body: 'Un client qui rappelle est salué par son prénom. Ce qu’il a dit la dernière fois est déjà là, son rendez-vous à venir aussi. Il ne redemande pas ce qu’il sait déjà, et ça s’entend dès la première seconde.',
          panelLabel: 'D’un appel à l’autre',
          panelRows: [
            { label: 'Salué par son prénom au décrochage' },
            { label: 'Résumé du dernier appel disponible' },
            { label: 'Rendez-vous à venir connu' },
          ],
          panelNote: 'La mémoire se limite à ce qui sert l’appel suivant, effaçable sur demande.',
        },
        {
          icon: MessagesSquare,
          num: '04',
          title: 'Une conversation, pas un serveur vocal',
          body: 'Coupez-le, il s’arrête net. Une toux ne le coupe pas. Pendant que vous parlez il glisse des « mhm », jamais un « oui » qui vaudrait engagement. Un blanc trop long et il demande si vous êtes toujours là. Un appelant agacé obtient des phrases courtes, zéro discours commercial, et un humain proposé plus tôt.',
          panelLabel: 'Ce qu’il dit vraiment',
          panelRows: [
            { label: '« Pardon, allez-y. »', meta: 'coupé' },
            { label: '« Vous êtes toujours là ? »', meta: 'silence' },
            { label: '« mhm »', meta: 'pendant que vous parlez' },
          ],
          panelNote: 'Un acquiescement n’est jamais interprété comme un accord.',
        },
      ]
    : [
        {
          icon: CalendarCheck,
          num: '01',
          title: 'The appointment is written before it hangs up',
          body: 'The moment a day is named, availability is fetched ahead of the request from your Google calendar. The chosen slot is written confirmed, not parked for later. Two calls at the same moment cannot walk away with the same slot.',
          panelLabel: 'What happens mid-sentence',
          panelRows: [
            { label: 'A day is named, the calendar is queried', meta: 'ahead' },
            { label: 'The chosen slot is written, confirmed' },
            { label: 'A held slot disappears from other calls' },
          ],
          panelNote: 'Requires a connected Google calendar: otherwise it takes the request and you call back.',
        },
        {
          icon: PhoneForwarded,
          num: '02',
          title: 'It tells you who is calling before it hands over',
          body: 'You no longer pick up blind. Before bridging the call, it tells you out loud who is on the line and why, then sends you the same brief by text, with the number and the caller’s state of mind.',
          panelLabel: 'The brief text',
          panelRows: [
            { label: 'Who is calling', meta: 'name and number' },
            { label: 'What they want', meta: 'reason' },
            { label: 'In what state', meta: 'rushed, upset' },
          ],
          panelNote: 'If the transfer drops, you already have the number.',
        },
        {
          icon: UserCheck,
          num: '03',
          title: 'Your regulars are recognised, not re-interviewed',
          body: 'A returning customer is greeted by first name. What they said last time is already there, so is their upcoming appointment. It does not ask again for what it already knows, and you hear that in the first second.',
          panelLabel: 'From one call to the next',
          panelRows: [
            { label: 'Greeted by first name at pickup' },
            { label: 'Summary of the last call on hand' },
            { label: 'Upcoming appointment known' },
          ],
          panelNote: 'Memory is limited to what serves the next call, erasable on request.',
        },
        {
          icon: MessagesSquare,
          num: '04',
          title: 'A conversation, not a phone menu',
          body: 'Cut in and it stops dead. A cough does not cut it off. While you speak it slips in a quiet "mhm", never a "yes" that could pass for consent. After a long pause it asks whether you are still there. An annoyed caller gets short sentences, no sales talk, and a human offered sooner.',
          panelLabel: 'What it actually says',
          panelRows: [
            { label: '"Sorry, go ahead."', meta: 'cut off' },
            { label: '"Are you still there?"', meta: 'silence' },
            { label: '"mhm"', meta: 'while you speak' },
          ],
          panelNote: 'A backchannel is never read as agreement.',
        },
      ];

  const configFacts: { icon: LucideIcon; title: string; body: string }[] = isFr
    ? [
        {
          icon: Mic,
          title: 'Dictée vocale',
          body: 'Dites la consigne au lieu de la taper. Même chat, même effet.',
        },
        {
          icon: Camera,
          title: 'Tarifs par photo',
          body: 'Photographiez votre carte, relisez les lignes lues, confirmez. Aucune image conservée.',
        },
        {
          icon: PhoneCall,
          title: 'Appel test',
          body: 'Appelez-le depuis votre navigateur avant de brancher votre vraie ligne.',
        },
      ]
    : [
        {
          icon: Mic,
          title: 'Voice dictation',
          body: 'Say the instruction instead of typing it. Same chat, same effect.',
        },
        {
          icon: Camera,
          title: 'Rates from a photo',
          body: 'Photograph your rate card, review the lines read, confirm. No image is kept.',
        },
        {
          icon: PhoneCall,
          title: 'Test call',
          body: 'Call it from your browser before you point your real line at it.',
        },
      ];

  const afterCall = isFr
    ? [
        {
          title: 'Le lead est écrit pendant l’appel',
          body: 'Pas à la fin. Une ligne qui coupe en pleine phrase laisse quand même de quoi rappeler.',
        },
        {
          title: 'En cas de pépin technique, il ne dit jamais « erreur »',
          body: 'Il prend les coordonnées de l’appelant et propose un rappel. L’appelant n’entend jamais la panne.',
        },
        {
          title: 'Chaque appel repart avec son analyse',
          body: 'Résumé, sentiment, lead scoré. Le client final reçoit son SMS de confirmation, et un rappel 24 h avant le rendez-vous sur les plans Pro et Enterprise.',
        },
        {
          title: 'Chaque semaine, il vous dit ce qui cloche',
          body: 'Trop bavard, agenda déconnecté, questions revenues sans réponse dans sa base. Le constat part sur votre courriel et votre téléphone, vous décidez : il ne se réécrit pas tout seul.',
        },
      ]
    : [
        {
          title: 'The lead is written during the call',
          body: 'Not at the end. A line that drops mid-sentence still leaves you something to call back.',
        },
        {
          title: 'On a technical hiccup it never says "error"',
          body: 'It takes the caller’s details and offers a callback. The caller never hears the failure.',
        },
        {
          title: 'Every call comes back analysed',
          body: 'Summary, sentiment, scored lead. The customer gets their confirmation text, plus a reminder 24 h before the appointment on Pro and Enterprise plans.',
        },
        {
          title: 'Every week it tells you what is off',
          body: 'Too talkative, calendar disconnected, questions its knowledge base could not answer. The findings land in your inbox and on your phone, you decide: it does not rewrite itself.',
        },
      ];

  const guarantees = isFr
    ? [
        'Annonce d’enregistrement au décrochage, conforme RGPD',
        'Données hébergées dans l’Union européenne',
        'Les appels spam sont écartés et ne comptent pas dans vos minutes',
        'Disponible 24/7, français et anglais sur le même appel',
        `À partir de 99${NB}€ par mois, sans engagement`,
      ]
    : [
        'Recording announced at pickup, GDPR compliant',
        'Data hosted in the European Union',
        'Spam calls are filtered out and never counted against your minutes',
        'Available 24/7, French and English on the same call',
        'From €99 a month, no commitment',
      ];

  return (
    <PublicShell>
      {/* HERO, asymétrique: titre whisper à gauche, le dashboard dans l'iPhone à droite */}
      <Section
        aria-label={isFr ? 'Réceptionniste IA Qwillio' : 'Qwillio AI receptionist'}
        className="relative !pt-16 md:!pt-24 overflow-hidden"
      >
        {/* Voile lilas du hero, accordé au fond des avatars */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: 'linear-gradient(180deg, rgb(var(--q2-band)) 0%, rgb(var(--q2-band)) 55%, rgb(var(--q2-canvas)) 100%)' }}
        />
        <Container className="relative grid lg:grid-cols-[1.1fr_1fr] gap-9 sm:gap-14 lg:gap-20 items-center">
          <RevealV2>
            <div>
              <Eyebrow tone="indigo" className="mb-4 sm:mb-6">
                {isFr ? 'Réceptionniste IA' : 'AI receptionist'}
              </Eyebrow>
              <Display className="mb-5 sm:mb-7">
                {isFr ? (
                  <>
                    Il ne prend pas le message. <SerifWord>Il prend le rendez-vous.</SerifWord>
                  </>
                ) : (
                  <>
                    It doesn’t take a message. <SerifWord>It takes the appointment.</SerifWord>
                  </>
                )}
              </Display>
              <Lead className="max-w-[500px] mb-7 sm:mb-10 q2-body-text">
                {isFr
                  ? `Il répond, lit votre agenda Google en direct et inscrit le créneau avant la fin de la conversation. Il vous résume l’appelant avant de vous le passer, et reconnaît ceux qui rappellent. Français et anglais sur le même appel, à partir de 99${NB}€ par mois.`
                  : 'It answers, reads your Google calendar live and writes the slot in before the conversation ends. It briefs you on the caller before handing over, and recognises the ones who call back. French and English on the same call, from €99 a month.'}
              </Lead>

              <div className="flex flex-wrap items-center gap-3 mb-8 sm:mb-12">
                <TryVoiceButton variant="chromatic">
                  <Play size={13} fill="currentColor" aria-hidden="true" />
                  {isFr ? 'Écouter une démo' : 'Hear a demo'}
                </TryVoiceButton>
                <PillLink to="/register" variant="outline" size="lg">
                  {isFr ? 'Essayer gratuitement' : 'Try it free'}
                  <ArrowRight size={15} aria-hidden="true" />
                </PillLink>
              </div>

              {/* Propriétés vérifiables du produit uniquement (DA/voix.md) */}
              <dl className="flex flex-wrap items-baseline gap-x-6 sm:gap-x-9 gap-y-3 text-sm text-q2-body border-t border-q2-plate pt-5 sm:pt-6 max-w-[540px]">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Temps de décrochage' : 'Pickup time'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink tabular-nums">&lt;1&nbsp;s</dd>
                  <span>{isFr ? 'décrochage' : 'pickup'}</span>
                </div>
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Langues' : 'Languages'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink">FR/EN</dd>
                  <span>{isFr ? 'même appel' : 'same call'}</span>
                </div>
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Disponibilité' : 'Uptime'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink tabular-nums">24/7</dd>
                  <span>{isFr ? 'jamais fermé' : 'always on'}</span>
                </div>
              </dl>
            </div>
          </RevealV2>

          <RevealV2 index={2}>
            <HeroPhone3D isFr={isFr} />
          </RevealV2>
        </Container>
      </Section>

      {/* PILIERS 1 à 4, rangées éditoriales alternées (jamais une grille de cards identiques) */}
      <Section hairline aria-labelledby="pillars-heading">
        <Container>
          <RevealV2 className="mb-4 md:mb-10">
            <div className="grid lg:grid-cols-[1fr_1fr] gap-6 sm:gap-8 lg:gap-16 items-end">
              <div>
                <Eyebrow tone="indigo" className="mb-3 sm:mb-4">
                  {isFr ? 'Pendant l’appel' : 'During the call'}
                </Eyebrow>
                <H2 id="pillars-heading" className="max-w-[560px]">
                  {isFr ? (
                    <>
                      La conversation avance, <SerifWord>le travail aussi.</SerifWord>
                    </>
                  ) : (
                    <>
                      The conversation moves, <SerifWord>so does the work.</SerifWord>
                    </>
                  )}
                </H2>
              </div>
              <p className="text-q2-body text-base leading-relaxed max-w-[440px] q2-body-text lg:pb-2">
                {isFr
                  ? 'La plupart des répondeurs intelligents notent une demande et vous la repassent. Celui-ci ouvre l’agenda, écrit le rendez-vous, envoie la confirmation et vous brieffe. Vous récupérez un dossier, pas une liste de rappels à faire.'
                  : 'Most smart answering services take a request and hand it back to you. This one opens the calendar, writes the appointment, sends the confirmation and briefs you. What you get back is a handled case, not a callback list.'}
              </p>
            </div>
          </RevealV2>

          {/* Le cadre voyage d'un panneau à l'autre en se déformant par les
              coins: panneau à droite, puis en bas à gauche, et ainsi de suite.
              Il est posé en absolu sur CE conteneur, qui doit donc être son
              repère (`relative`). */}
          <div ref={pillarsRef} className="relative border-t border-q2-plate">
            <StepFrame scope={pillarsRef} radius={30} pad={14} className="hidden lg:block" />
            {pillars.map((pillar, i) => {
              const flip = i % 2 === 1;
              return (
                <RevealV2 key={pillar.num} as="article" className="border-b border-q2-plate">
                  <div className="grid lg:grid-cols-2 gap-7 sm:gap-10 lg:gap-20 items-center py-8 sm:py-12 md:py-20">
                    {/* Le cadre encadre le TEXTE, pas le panneau: le texte
                        change de côté d'un pilier à l'autre, donc le cadre
                        traverse la scène en diagonale et se déforme sur tout
                        le trajet. Autour du panneau il n'aurait fait que
                        descendre. */}
                    <div data-step-frame className={flip ? 'lg:order-2' : ''}>
                      <div className="flex items-center gap-3 mb-4 sm:mb-6">
                        <span className="w-11 h-11 rounded-full bg-q2-plate flex items-center justify-center">
                          <pillar.icon size={18} className="text-q2-indigo" aria-hidden="true" />
                        </span>
                        <span className="q2-eyebrow text-q2-body tabular-nums">{pillar.num}</span>
                      </div>
                      <h3 className="q2-h3 text-q2-ink mb-3 max-w-[420px]">{pillar.title}</h3>
                      <p className="text-q2-body text-[15px] leading-relaxed max-w-[440px] q2-body-text">
                        {pillar.body}
                      </p>
                    </div>
                    <div className={flip ? 'lg:order-1' : ''}>
                      <Panel label={pillar.panelLabel}>
                        <ul className="divide-y divide-q2-plate" role="list">
                          {pillar.panelRows.map((row) => (
                            <li
                              key={row.label}
                              className="flex items-baseline justify-between gap-5 py-4 first:pt-0"
                            >
                              <span className="text-q2-graphite text-[15px] leading-snug q2-body-text">
                                {row.label}
                              </span>
                              {row.meta ? (
                                <span className="text-q2-body text-[13px] whitespace-nowrap">{row.meta}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        {pillar.panelNote ? (
                          <p className="mt-5 pt-5 border-t border-q2-plate text-q2-body text-[13px] leading-relaxed q2-body-text">
                            {pillar.panelNote}
                          </p>
                        ) : null}
                      </Panel>
                    </div>
                  </div>
                </RevealV2>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* PILIER 5, drenched indigo: la seule action chromatique est la pilule du mockup */}
      {/* overflow-hidden: le halo de la capture déborde de 24px sur petit
          écran, il doit être coupé par la section et non pousser la page */}
      <Section variant="drenched-indigo" aria-labelledby="config-heading" className="relative overflow-hidden">
        <div aria-hidden="true" className="q2-hairline-lit absolute inset-x-0 top-0" />
        <Container className="grid lg:grid-cols-[1fr_1.05fr] gap-9 sm:gap-12 lg:gap-20 items-center">
          <RevealV2>
            <Eyebrow tone="indigo" onDark className="mb-3 sm:mb-4">
              {isFr ? 'Configuration' : 'Setup'}
            </Eyebrow>
            <H2 id="config-heading" onDark className="max-w-[520px]">
              {isFr ? (
                <>
                  Dites-lui ce qui change, <SerifWord>il change.</SerifWord>
                </>
              ) : (
                <>
                  Tell it what changed, <SerifWord>it changes.</SerifWord>
                </>
              )}
            </H2>
            <p className="mt-5 sm:mt-6 text-q2-mist text-base leading-relaxed max-w-[440px] q2-body-text">
              {isFr
                ? 'Pas de formulaire à quinze champs. Vous écrivez ou vous dictez une phrase, le réglage est appliqué et relu devant vous. Ce qui touche vos tarifs demande toujours une confirmation avant d’être écrit.'
                : 'No fifteen-field form. You write or dictate one sentence, the setting is applied and read back to you. Anything touching your rates always asks for confirmation before it is written.'}
            </p>

            <ul className="mt-8 sm:mt-10 border-t border-q2-graphite-d" role="list">
              {configFacts.map((fact) => (
                <li key={fact.title} className="flex items-start gap-4 border-b border-q2-graphite-d py-4 sm:py-5">
                  <fact.icon size={16} className="mt-0.5 shrink-0 text-q2-lift" aria-hidden="true" />
                  <div>
                    <p className="text-white text-[15px] mb-1">{fact.title}</p>
                    <p className="text-q2-fog text-[13.5px] leading-relaxed q2-body-text max-w-[380px]">
                      {fact.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </RevealV2>

          <RevealV2 index={1}>
            {/* Vraie capture du chat de configuration du dashboard */}
            <figure className="relative">
              {/* Même traitement que le suivi d'appel sur la Home: la capture
                  est posée dans une lueur, jamais découpée dans le noir */}
              <div
                aria-hidden="true"
                className="q2-halo q2-halo-dark -inset-6 sm:-inset-10 rounded-[64px]"
                style={halo(0.24)}
              />
              <div className="relative q2-lit rounded-xl overflow-hidden border border-q2-graphite-d bg-q2-carbon">
                <img
                  src="/screens/chat-config.webp"
                  alt={
                    isFr
                      ? 'Le chat de configuration du dashboard Qwillio : un horaire modifié en une phrase'
                      : 'The Qwillio dashboard configuration chat: an opening hour changed in one sentence'
                  }
                  loading="lazy"
                  className="w-full h-auto block"
                />
              </div>
              <figcaption className="relative mt-3 px-1 text-[12.5px] text-q2-fog q2-body-text">
                {isFr ? 'Capture du dashboard, compte de démonstration.' : 'Dashboard screenshot, demo account.'}
              </figcaption>
            </figure>
          </RevealV2>
        </Container>
      </Section>

      {/* VOIX ET TON, bande taupe: deux aperçus jouables puis la liste hairline */}
      <Section variant="band" hairline aria-labelledby="voices-heading">
        <Container>
          <RevealV2 className="mb-8 sm:mb-12 md:mb-16">
            <div className="flex items-end justify-between gap-6 sm:gap-8 flex-wrap">
              <div>
                <Eyebrow tone="indigo" className="mb-3 sm:mb-4">
                  {isFr ? 'Voix et ton' : 'Voice and tone'}
                </Eyebrow>
                <H2 id="voices-heading" className="max-w-[640px]">
                  {isFr ? (
                    <>
                      Dix réceptionnistes. <SerifWord>Six façons de les porter.</SerifWord>
                    </>
                  ) : (
                    <>
                      Ten receptionists. <SerifWord>Six ways to carry them.</SerifWord>
                    </>
                  )}
                </H2>
              </div>
              <p className="text-q2-body text-sm max-w-[320px] leading-relaxed q2-body-text">
                {isFr
                  ? 'Dix personnages, chacun parle français et anglais. Vous les écoutez avant de choisir, le ton se règle séparément. Et si aucun n’est le bon, clonez votre voix.'
                  : 'Ten characters, each speaks French and English. You listen before you pick, the tone is set separately. And if none is the right one, clone your own voice.'}
              </p>
            </div>
          </RevealV2>

          <RevealV2 className="mb-8 sm:mb-12">
            <div className="flex items-center gap-x-5 gap-y-3 flex-wrap border-y border-q2-plate py-5 sm:py-6">
              <span className="q2-eyebrow text-q2-body">{isFr ? 'Langues' : 'Languages'}</span>
              <ul className="flex flex-wrap gap-2" role="list">
                {[
                  isFr ? 'Français' : 'French',
                  'English',
                  isFr ? 'Les deux sur le même appel' : 'Both on the same call',
                ].map((item) => (
                  <li key={item}>
                    <span className="inline-flex items-center text-xs px-3.5 py-2 rounded-full bg-q2-canvas border border-q2-plate text-q2-graphite font-medium">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </RevealV2>

          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <RevealV2>
              <VoiceCard v={voices[0]} large />
            </RevealV2>
            <RevealV2 index={1}>
              <VoiceCard v={voices[1]} large />
            </RevealV2>
          </div>

          <RevealV2 index={2}>
            <CardV2 variant="canvas" large>
              <div className="grid md:grid-cols-[1fr_1.4fr] gap-7 sm:gap-8 md:gap-12">
                <div>
                  <p className="q2-eyebrow text-q2-body mb-4">{isFr ? 'Les huit autres' : 'The other eight'}</p>
                  <p className="text-q2-body text-sm leading-relaxed q2-body-text max-w-[260px]">
                    {isFr
                      ? 'Chacun arrive avec un ton par défaut, que vous pouvez remplacer par n’importe lequel des six.'
                      : 'Each comes with a default tone, which you can swap for any of the six.'}
                  </p>
                  <ul className="mt-6 flex flex-wrap gap-2" role="list">
                    {tones.map((tone) => (
                      <li
                        key={tone}
                        className="inline-flex items-center rounded-full bg-q2-band px-3.5 py-1.5 text-[12.5px] font-medium text-q2-graphite"
                      >
                        {tone}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Sous 640px la note passe sous le nom au lieu de se
                    comprimer en colonne de trente pixels */}
                <ul className="border-t border-q2-plate" role="list">
                  {otherVoices.map((voice) => (
                    <li
                      key={voice.name}
                      className="grid grid-cols-[32px_1fr_auto] sm:grid-cols-[32px_72px_1fr_auto] gap-x-3 sm:gap-x-4 gap-y-0.5 items-center border-b border-q2-plate py-3"
                    >
                      <img
                        src={`/characters/${voice.id}.webp`}
                        alt=""
                        loading="lazy"
                        width={32}
                        height={32}
                        className="row-span-2 sm:row-span-1 w-8 h-8 rounded-full object-cover"
                      />
                      <span className="text-q2-ink text-[15px]">{voice.name}</span>
                      <span className="col-start-2 sm:col-start-3 row-start-2 sm:row-start-1 text-q2-body text-[13.5px] leading-snug q2-body-text">
                        {voice.note}
                      </span>
                      <span className="col-start-3 sm:col-start-4 row-start-1 q2-eyebrow text-q2-body">
                        {voice.tag}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardV2>
          </RevealV2>

          {/* Clonage de voix: fonction reelle du dashboard (VoiceCloner),
              conditions honnetes: consentement, 20-90 s, remplacable,
              supprimable. On ne promet pas l'appel test avec la voix clonee. */}
          <RevealV2 index={3} className="mt-5">
            <CardV2 variant="canvas" large>
              <div className="grid md:grid-cols-[1fr_1.4fr] gap-6 sm:gap-8 md:gap-12 items-start">
                <div>
                  <p className="q2-eyebrow text-q2-indigo mb-4">{isFr ? 'Ou la vôtre' : 'Or your own'}</p>
                  <p className="text-[22px] font-light tracking-tight text-q2-ink leading-snug max-w-[300px]">
                    {isFr ? (
                      <>
                        Clonez votre voix, elle répond avec votre <SerifWord>timbre.</SerifWord>
                      </>
                    ) : (
                      <>
                        Clone your voice, she answers with your <SerifWord>timbre.</SerifWord>
                      </>
                    )}
                  </p>
                </div>
                <ul className="border-t border-q2-plate" role="list">
                  {(isFr
                    ? [
                        'De 20 à 90 secondes d’enregistrement suffisent, au micro ou depuis un fichier audio.',
                        'Consentement explicite exigé : la voix doit être la vôtre, ou enregistrée avec un accord écrit.',
                        'Utilisable seconde après seconde : pas d’entraînement de plusieurs heures.',
                        'Vous la remplacez ou la supprimez quand vous voulez, l’ancienne est effacée.',
                      ]
                    : [
                        '20 to 90 seconds of recording are enough, from the mic or an audio file.',
                        'Explicit consent required: the voice must be yours, or recorded with written permission.',
                        'Usable within seconds: no hours-long training.',
                        'Replace or delete it whenever you want, the previous one is erased.',
                      ]
                  ).map((line) => (
                    <li
                      key={line}
                      className="border-b border-q2-plate py-3.5 text-[14px] text-q2-body leading-relaxed q2-body-text"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </CardV2>
          </RevealV2>
        </Container>
      </Section>

      {/* PILIER 6, canvas: connaissances prioritaires et scripts par métier */}
      <Section aria-labelledby="knowledge-heading">
        <Container className="grid lg:grid-cols-[1fr_1.1fr] gap-9 sm:gap-12 lg:gap-20 items-start">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-3 sm:mb-4">
              {isFr ? 'Vos réponses' : 'Your answers'}
            </Eyebrow>
            <H2 id="knowledge-heading" className="max-w-[460px]">
              {isFr ? (
                <>
                  Il répond avec vos mots, <SerifWord>pas les nôtres.</SerifWord>
                </>
              ) : (
                <>
                  It answers in your words, <SerifWord>not ours.</SerifWord>
                </>
              )}
            </H2>
            <p className="mt-5 sm:mt-6 text-q2-body text-base leading-relaxed max-w-[420px] q2-body-text">
              {isFr
                ? 'Vos règles de maison et vos réponses les plus utilisées sont dans sa tête en permanence. Le reste, il va le chercher quand la question tombe, et il retrouve la bonne réponse même formulée autrement. Vous pouvez donc en avoir des centaines sans alourdir chaque appel.'
                : 'Your house rules and your most-used answers sit in its head permanently. The rest it looks up when the question lands, and it finds the right answer even when the wording differs. So you can keep hundreds of entries without weighing down every call.'}
            </p>
          </RevealV2>

          <RevealV2 index={1}>
            <CardV2 variant="band" large>
              <p className="q2-eyebrow text-q2-body mb-6">{isFr ? 'Deux mémoires' : 'Two memories'}</p>
              <ul className="divide-y divide-q2-plate" role="list">
                {(isFr
                  ? [
                      { label: 'Règles de maison et réponses prioritaires', meta: 'toujours en tête' },
                      { label: 'Le reste de votre base de connaissances', meta: 'à la demande' },
                      { label: 'Scripts spécialisés par métier', meta: 'inclus' },
                    ]
                  : [
                      { label: 'House rules and priority answers', meta: 'always in mind' },
                      { label: 'The rest of your knowledge base', meta: 'on demand' },
                      { label: 'Trade-specific scripts', meta: 'included' },
                    ]
                ).map((row) => (
                  <li key={row.label} className="flex items-baseline justify-between gap-5 py-4 first:pt-0">
                    <span className="text-q2-graphite text-[15px] leading-snug q2-body-text">{row.label}</span>
                    <span className="text-q2-body text-[13px] whitespace-nowrap">{row.meta}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-7 pt-6 border-t border-q2-plate q2-eyebrow text-q2-body mb-4">
                {isFr ? 'Métiers couverts' : 'Trades covered'}
              </p>
              <nav aria-label={isFr ? 'Métiers couverts' : 'Trades covered'} className="flex flex-wrap gap-2.5">
                {trades.map((trade) => (
                  <Link
                    key={trade.href}
                    to={trade.href}
                    className="inline-flex items-center min-h-[44px] rounded-full bg-q2-canvas border border-q2-plate px-4 py-2 text-[13px] font-medium text-q2-ink hover:border-q2-indigo hover:text-q2-indigo transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40"
                  >
                    {trade.label}
                  </Link>
                ))}
              </nav>
            </CardV2>
          </RevealV2>
        </Container>
      </Section>

      {/* PILIERS 7 à 9, bande taupe: ce qui revient au patron et ce qui est cadré */}
      <Section variant="band" hairline aria-labelledby="after-heading">
        <Container className="grid lg:grid-cols-[1.5fr_1fr] gap-9 sm:gap-12 lg:gap-20 items-start">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-3 sm:mb-4">
              {isFr ? 'Après l’appel' : 'After the call'}
            </Eyebrow>
            <H2 id="after-heading" className="max-w-[520px] mb-7 sm:mb-10">
              {isFr ? (
                <>
                  Ce qui vous revient, <SerifWord>et ce qui est cadré.</SerifWord>
                </>
              ) : (
                <>
                  What comes back to you, <SerifWord>and what is fenced in.</SerifWord>
                </>
              )}
            </H2>
            <ol className="border-t border-q2-plate" role="list">
              {afterCall.map((item, i) => (
                <li key={item.title} className="border-b border-q2-plate py-5 sm:py-6">
                  <div className="grid md:grid-cols-[48px_1fr] gap-2 md:gap-6">
                    <span className="q2-eyebrow text-q2-body tabular-nums" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-q2-ink text-[16px] mb-1.5">{item.title}</h3>
                      <p className="text-q2-body text-[14.5px] leading-relaxed q2-body-text max-w-[520px]">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </RevealV2>

          <RevealV2 index={1}>
            <CardV2 variant="canvas" large className="lg:sticky lg:top-24">
              <p className="flex items-center gap-2.5 q2-eyebrow text-q2-body mb-6">
                <Shield size={13} className="text-q2-indigo" aria-hidden="true" />
                {isFr ? 'Ce qui ne bouge pas' : 'What does not move'}
              </p>
              <ul className="divide-y divide-q2-plate" role="list">
                {guarantees.map((line) => (
                  <li
                    key={line}
                    className="text-q2-graphite text-[14.5px] leading-relaxed q2-body-text py-4 first:pt-0 last:pb-0"
                  >
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-6 pt-5 border-t border-q2-plate text-q2-body text-[13px] leading-relaxed q2-body-text">
                {isFr
                  ? 'La prise de rendez-vous en direct suppose un agenda Google connecté. Sans agenda, il prend la demande et vous rappelez.'
                  : 'Live booking assumes a connected Google calendar. Without one, it takes the request and you call back.'}
              </p>
            </CardV2>
          </RevealV2>
        </Container>
      </Section>

      {/* CTA FINAL, drenched violet: une seule action chromatique */}
      <Section
        variant="drenched-violet"
        aria-label={isFr ? 'Démarrer avec Qwillio' : 'Get started with Qwillio'}
        className="relative overflow-hidden border-t border-q2-graphite-d"
      >
        <div aria-hidden="true" className="q2-hairline-lit absolute inset-x-0 top-0" />
        <div
          aria-hidden="true"
          className="q2-halo q2-halo-violet absolute left-1/2 -translate-x-1/2 -bottom-40 w-[760px] h-[320px]"
          style={halo(0.3)}
        />
        <Container className="relative grid lg:grid-cols-[1.5fr_1fr] gap-8 sm:gap-10 items-end">
          <RevealV2>
            <Display as="h2" onDark>
              {isFr ? (
                <>
                  Votre ligne sonne déjà. <SerifWord>Autant qu’on décroche.</SerifWord>
                </>
              ) : (
                <>
                  Your line is already ringing. <SerifWord>Someone may as well answer.</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1} className="flex flex-col items-start gap-5 lg:items-end pb-2">
            <p className="text-q2-fog text-[15px] leading-relaxed max-w-[320px] lg:text-right q2-body-text">
              {isFr
                ? '7 jours d’essai gratuit. Sans engagement, annulable en un clic.'
                : '7-day free trial. No commitment, cancel in one click.'}
            </p>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <PillLink to="/register" variant="chromatic" size="lg" className="q2-pill-lit">
                {isFr ? 'Créer un compte' : 'Create an account'}
                <ArrowRight size={16} aria-hidden="true" />
              </PillLink>
              <TryVoiceButton variant="onDark">
                <Phone size={14} aria-hidden="true" />
                {isFr ? 'Appeler la démo' : 'Call the demo'}
              </TryVoiceButton>
            </div>
          </RevealV2>
        </Container>
      </Section>
    </PublicShell>
  );
}
