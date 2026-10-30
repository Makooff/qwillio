import { useRef } from 'react';
import {
  ArrowRight, Play, Phone, CalendarCheck, PhoneForwarded, UserCheck,
  MessagesSquare, Mic, Camera, PhoneCall,
  type LucideIcon,
} from '../../components/icons';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import HeroBackdrop from '../../components/v2/HospitalityBackdrop';
import ProductIllustration from '../../components/v2/ProductIllustration';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';



import CircularReceptionists from '../../components/v2/CircularReceptionists';
import TextReveal from '../../components/v2/motion/TextReveal';
import TryVoiceButton from '../../components/v2/TryVoiceButton';
import StepFrame from '../../components/v2/motion/StepFrame';

/* Réceptionniste V2 « Papier & Signal » (DA/v2-direction.md).
   Récit: un réceptionniste qui agit pendant l'appel. Indigo = ce qui décroche
   (inbound). Aucun chiffre de latence de conversation, aucun témoignage.
   La prise de rendez-vous en direct est toujours conditionnée à l'agenda connecté. */

const NB = '\u00A0';


interface Pillar {
  icon: LucideIcon;
  num: string;
  title: string;
  body: string;
  panelLabel: string;
  panelRows: { label: string; meta?: string }[];
  panelNote?: string;
}

function Panel({ pillar, isFr }: { pillar: Pillar; isFr: boolean }) {
  const kind = pillar.num === '01' ? 'booking' : pillar.num === '02' ? 'transfer' : pillar.num === '03' ? 'returning' : 'conversation';
  return <ProductIllustration kind={kind} isFr={isFr} />;
}

export default function Receptionist() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const pillarsRef = useRef<HTMLDivElement>(null);

  useSEO({
    title: isFr
      ? 'Prise de rendez-vous pendant l’appel'
      : 'Appointment booking during the call',
    description: isFr
      ? 'Qwillio répond, lit votre agenda Google ou Outlook en direct, inscrit le rendez-vous pendant l’appel, vous résume l’appelant avant de vous le passer et reconnaît vos habitués. Français et anglais, conforme RGPD, à partir de 99 € par mois.'
      : 'Qwillio answers, reads your Google or Outlook calendar live, books the appointment during the call, briefs you before handing the caller over and recognises your regulars. French and English, GDPR compliant, from €99 a month.',
    canonical: 'https://qwillio.com/receptionist',
  });

  const pillars: Pillar[] = isFr
    ? [
        {
          icon: CalendarCheck,
          num: '01',
          title: 'Le rendez-vous est inscrit avant qu’il raccroche',
          body: 'Il consulte votre agenda Google ou Outlook et confirme le créneau choisi pendant l’appel. Vos clients peuvent aussi déplacer ou annuler un rendez-vous. Si le créneau vient d’être pris, il propose une autre heure.',
          panelLabel: 'Ce qui se passe pendant la phrase',
          panelRows: [
            { label: 'Un jour est prononcé, l’agenda est interrogé', meta: 'en avance' },
            { label: 'Le créneau choisi est écrit, confirmé' },
            { label: 'Déplacement et annulation pendant l’appel' },
          ],
          panelNote: `Fonctionne si votre agenda Google ou Outlook est connecté${NB}: sinon il note la demande et vous rappelez.`,
        },
        {
          icon: PhoneForwarded,
          num: '02',
          title: 'Il vous dit qui appelle avant de vous passer l’appel',
          body: 'Vous ne décrochez plus dans le vide. Avant de faire le pont, il vous résume à l’oral qui est en ligne et pourquoi, puis peut vous envoyer le même brief par SMS si ce canal est activé et votre numéro renseigné.',
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
          body: 'Vous pouvez l’interrompre pour préciser une demande. Après un silence prolongé, il vérifie si vous êtes toujours là. Face à un appelant agacé, ses consignes privilégient des réponses courtes et le passage à un humain.',
          panelLabel: 'Ce qu’il dit vraiment',
          panelRows: [
            { label: '« Pardon, allez-y. »', meta: 'coupé' },
            { label: '« Vous êtes toujours là ? »', meta: 'silence' },
            { label: '« Je peux vous passer quelqu’un. »', meta: 'passage à un humain' },
          ],
          panelNote: 'Les actions demandées restent soumises aux confirmations prévues.',
        },
      ]
    : [
        {
          icon: CalendarCheck,
          num: '01',
          title: 'The appointment is written before it hangs up',
          body: 'It checks your Google or Outlook calendar and confirms the chosen slot during the call. Customers can also reschedule or cancel an appointment. If the slot has just been taken, it offers another time.',
          panelLabel: 'What happens mid-sentence',
          panelRows: [
            { label: 'A day is named, the calendar is queried', meta: 'ahead' },
            { label: 'The chosen slot is written, confirmed' },
            { label: 'Reschedule or cancel during the call' },
          ],
          panelNote: 'Requires a connected Google or Outlook calendar: otherwise it takes the request and you call back.',
        },
        {
          icon: PhoneForwarded,
          num: '02',
          title: 'It tells you who is calling before it hands over',
          body: 'You no longer pick up blind. Before bridging the call, it tells you out loud who is on the line and why, then can send the same brief by text when messaging is enabled and your number is provided.',
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
          body: 'You can interrupt to clarify a request. After a long pause, it checks whether you are still there. With an annoyed caller, its instructions favour short answers and a handoff to a person.',
          panelLabel: 'What it actually says',
          panelRows: [
            { label: '"Sorry, go ahead."', meta: 'cut off' },
            { label: '"Are you still there?"', meta: 'silence' },
            { label: '"I can put you through to someone."', meta: 'human handoff' },
          ],
          panelNote: 'Requested actions still require the relevant confirmations.',
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
          title: 'Une demande de rappel plutôt qu’une impasse',
          body: 'Si une action échoue, il peut recueillir les coordonnées de l’appelant pour vous permettre de rappeler. Ce repli ne garantit pas la continuité d’une ligne coupée.',
        },
        {
          title: 'Chaque appel repart avec son analyse',
          body: 'Résumé et coordonnées sont réunis dans le portail. Confirmation, rappel et relance après absence dépendent des canaux activés et des coordonnées disponibles.',
        },
        {
          title: 'Chaque semaine, il vous dit ce qui cloche',
          body: 'Trop bavard, agenda déconnecté, questions revenues sans réponse dans sa base. Le bilan peut arriver par email et par SMS selon vos coordonnées et les canaux activés. Vous décidez des changements.',
        },
      ]
    : [
        {
          title: 'The lead is written during the call',
          body: 'Not at the end. A line that drops mid-sentence still leaves you something to call back.',
        },
        {
          title: 'A callback request rather than a dead end',
          body: 'If an action fails, it can collect the caller’s details so you can call back. This fallback cannot keep a disconnected line open.',
        },
        {
          title: 'Every call comes back analysed',
          body: 'Summary, sentiment and contact details are kept in the portal. Confirmations, reminders and no-show follow-ups depend on enabled channels and available contact details.',
        },
        {
          title: 'Every week it tells you what is off',
          body: 'Too talkative, calendar disconnected, questions its knowledge base could not answer. The report can arrive by email and text depending on your contact details and enabled channels. You decide what changes.',
        },
      ];

  return (
    <PublicShell>
      {/* HERO, asymétrique: titre whisper à gauche, le dashboard dans l'iPhone à droite */}
      <Section
        aria-label={isFr ? 'Réceptionniste IA Qwillio' : 'Qwillio AI receptionist'}
        className="relative -mt-16 !pt-32 md:!pt-40 overflow-hidden"
      >
        {/* Même décor que l’accueil, continu jusque sous la navigation. */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: 'linear-gradient(180deg, rgb(var(--q2-canvas)) 0%, rgb(var(--q2-band)) 14%, rgb(var(--q2-band)) 58%, rgb(var(--q2-canvas)) 100%)' }}
        />
        <HeroBackdrop />
        {/* Protéger le contraste du texte sur la vidéo, dans les deux thèmes. */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, rgb(var(--q2-canvas) / 0.88) 0%, rgb(var(--q2-canvas) / 0.78) 38%, rgb(var(--q2-canvas) / 0.24) 62%, transparent 85%)' }} />
        <Container className="relative grid lg:grid-cols-[1.1fr_1fr] gap-9 sm:gap-14 lg:gap-20 items-center">
          <RevealV2>
            <div>
              <Eyebrow tone="indigo" className="mb-4 sm:mb-6">
                {isFr ? 'Réceptionniste IA' : 'AI receptionist'}
              </Eyebrow>
              <Display className="mb-5 sm:mb-7 !text-[clamp(2rem,4.6vw,3.9rem)]">
                {isFr ? (
                  <>
                    Il ne prend pas<br />
                    le message<br />
                    il prend le<br />
                    <SerifWord>rendez-vous</SerifWord>
                  </>
                ) : (
                  <>
                    It doesn’t take a message. <SerifWord>It takes the appointment.</SerifWord>
                  </>
                )}
              </Display>
              <Lead className="max-w-[500px] mb-7 sm:mb-10 q2-body-text">
                {isFr
                  ? `Il répond, lit votre agenda Google ou Outlook en direct et inscrit le créneau avant la fin de la conversation. Il vous résume l’appelant avant de vous le passer, et reconnaît ceux qui rappellent. Français et anglais sur le même appel, à partir de 99${NB}€ par mois.`
                  : 'It answers, reads your Google or Outlook calendar live and writes the slot in before the conversation ends. It briefs you on the caller before handing over, and recognises the ones who call back. French and English on the same call, from €99 a month.'}
              </Lead>

              <div className="flex flex-wrap items-center gap-3 mb-8 sm:mb-12">
                <TryVoiceButton variant="primary">
                  <Play size={13} fill="currentColor" aria-hidden="true" />
                  {isFr ? 'Écouter une démo' : 'Hear a demo'}
                </TryVoiceButton>
                <PillLink to="/register" variant="outline" size="lg">
                  {isFr ? 'Essayer gratuitement' : 'Try it free'}
                  <ArrowRight size={15} aria-hidden="true" />
                </PillLink>
              </div>

              {/* Propriétés vérifiables du produit uniquement (DA/voix.md) */}
              <dl className="grid grid-cols-3 gap-x-3 sm:gap-x-6 gap-y-3 text-sm text-q2-body border-t border-q2-plate pt-5 sm:pt-6 max-w-[540px]">
                <div className="flex min-w-0 flex-col items-start gap-1 break-words">
                  <dt className="sr-only">{isFr ? 'Mode d’accueil' : 'Reception mode'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink">{isFr ? 'IA' : 'AI'}</dd>
                  <span>{isFr ? 'sans menu vocal' : 'no phone menus'}</span>
                </div>
                <div className="flex min-w-0 flex-col items-start gap-1 break-words">
                  <dt className="sr-only">{isFr ? 'Langues' : 'Languages'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink">FR/EN</dd>
                  <span>{isFr ? 'même appel' : 'same call'}</span>
                </div>
                <div className="flex min-w-0 flex-col items-start gap-1 break-words">
                  <dt className="sr-only">{isFr ? 'Disponibilité' : 'Uptime'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink tabular-nums">24/7</dd>
                  <span>{isFr ? 'horaires configurables' : 'configurable hours'}</span>
                </div>
              </dl>
            </div>
          </RevealV2>

          <RevealV2 index={2}>
            <ProductIllustration kind="overview" isFr={isFr} />
          </RevealV2>
        </Container>
      </Section>

      {/* PILIERS 1 à 4, rangées éditoriales alternées (jamais une grille de cards identiques) */}
      <Section hairline aria-labelledby="pillars-heading" className="relative">
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
          {/* `isolate`: le cadre et les etapes sont ranges dans CE conteneur et
              nulle part ailleurs, sinon un z-index negatif passerait derriere
              le fond de la section. */}
          <div ref={pillarsRef} className="relative isolate border-t border-q2-plate">
            {/* `pad={0}` et `radius={28}`: le cadre ne se calcule plus une boîte
                à lui, il reprend EXACTEMENT celle du panneau d'en face. Le
                bloc de texte porte désormais la même respiration (`p-6 sm:p-8`)
                et le même rayon qu'un `CardV2 large`, et la rangée est en
                `items-stretch`, si bien que les deux colonnes ont la même
                hauteur. Avant, une marge de 14 px autour d'un texte nu contre
                32 px de respiration en face donnait deux boîtes de tailles
                différentes sur une même ligne (retour utilisateur). */}
            <StepFrame scope={pillarsRef} radius={28} pad={0} className="hidden lg:block" />
            {pillars.map((pillar, i) => {
              const flip = i % 2 === 1;
              return (
                /* `relative z-10`: le cadre est un FOND. Il est en `absolute`,
                   donc sans cette couche il passait par-dessus le texte et,
                   depuis qu'il est opaque comme le panneau d'en face, il le
                   masquait entierement. */
                <RevealV2 key={pillar.num} as="article" className="relative z-10 border-b border-q2-plate">
                  {/* `items-stretch` (le défaut) et non `items-center`: c'est
                      lui qui donne aux deux colonnes la même hauteur, donc au
                      cadre la même boîte que le panneau. En `items-center`, le
                      `h-full` du panneau ne s'appliquait à rien. */}
                  <div className="grid lg:grid-cols-2 gap-7 sm:gap-10 lg:gap-20 py-8 sm:py-12 md:py-20">
                    {/* Le cadre encadre le TEXTE, pas le panneau: le texte
                        change de côté d'un pilier à l'autre, donc le cadre
                        traverse la scène en diagonale et se déforme sur tout
                        le trajet. Autour du panneau il n'aurait fait que
                        descendre. */}
                    {/* Même respiration qu'un `CardV2 large` (`p-6 sm:p-8`), et
                        le texte centré: le cadre a ainsi le même écart au-dessus
                        et au-dessous de son contenu que le panneau d'en face.
                        Sous `lg` le cadre n'est pas rendu, la marge y est donc
                        retirée pour ne pas décaler un texte qui n'a plus de
                        cadre autour de lui. */}
                    <div
                      data-step-frame
                      className={`lg:p-8 flex flex-col justify-center ${flip ? 'lg:order-2' : ''}`}
                    >
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
                    {/* `data-step-mask`: le cadre s'efface dans une bande autour
                        de ce panneau au lieu de le frôler en travers de la
                        scène. C'est ce qui évite les coins des cartes. */}
                    <div data-step-mask className={flip ? 'lg:order-1' : ''}>
                      <Panel pillar={pillar} isFr={isFr} />
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
        <Container className="grid lg:grid-cols-[1fr_1.55fr] gap-9 sm:gap-12 lg:gap-20 items-center">
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
            {/* Le chat de configuration, en CAPTURE DU VRAI PORTAIL (demande
                utilisateur). La conversation qu'on y lit a réellement eu lieu
                contre le composant livré, réponses comprises: voir
                capture-screens.mjs. Ce fut un temps du balisage redessiné,
                parce qu'une capture réduite à 350 px se lisait comme une
                grille de gris; le cadrage sur le haut de l'image règle ce
                point sans avoir à redessiner l'écran. */}
            <ProductIllustration kind="setup" isFr={isFr} />
          </RevealV2>
        </Container>
      </Section>

      {/* ── VOS RÉCEPTIONNISTES, galerie de presets: le même carrousel
          circulaire que la Home (demande utilisateur: « remplace la section
          des voix par celle qui est sur home »). Dix presets, aperçus des
          vraies voix, note de clonage comprise dans le composant. */}
      <Section aria-labelledby="team-heading" className="relative">
        <Container className="relative z-10">
          <RevealV2 className="mb-8 sm:mb-12 max-w-[640px]">
            <Eyebrow tone="indigo" className="mb-3 sm:mb-4">
              {isFr ? 'Vos réceptionnistes' : 'Your receptionists'}
            </Eyebrow>
            <H2 id="team-heading">
              <TextReveal>
                {isFr ? (
                  <>
                    Choisissez qui <SerifWord>décroche.</SerifWord>
                  </>
                ) : (
                  <>
                    Choose who <SerifWord>answers.</SerifWord>
                  </>
                )}
              </TextReveal>
            </H2>
            <p className="text-q2-body text-base leading-relaxed mt-4 q2-body-text">
              {isFr
                ? 'Un ton chaleureux, posé ou plus direct : écoutez les voix et choisissez celle qui correspond à votre accueil.'
                : 'Warm, composed or more direct: hear the voices and choose the one that fits your welcome.'}
            </p>
          </RevealV2>
          <RevealV2 index={1}>
            <CircularReceptionists isFr={isFr} />
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
            <ProductIllustration kind="knowledge" isFr={isFr} />
          </RevealV2>
        </Container>
      </Section>

      {/* PILIERS 7 à 9, bande taupe: ce qui revient au patron et ce qui est cadré */}
      <Section variant="band" hairline aria-labelledby="after-heading" className="relative">
        <Container>
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
        </Container>
      </Section>

      {/* CTA FINAL, drenched violet: une seule action chromatique */}
      <Section
        variant="drenched-violet"
        aria-label={isFr ? 'Démarrer avec Qwillio' : 'Get started with Qwillio'}
        className="relative overflow-hidden border-t border-q2-graphite-d"
      >
        {/* Plus de lueur mauve en clôture ni de filet lumineux entre sections
            (demande utilisateur), comme sur la Home. */}
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
                ? '7 jours d’essai gratuit. En mensuel, sans engagement, annulez en un clic.'
                : '7-day free trial. No commitment on monthly, cancel in one click.'}
            </p>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <PillLink to="/register" variant="chromatic" size="lg">
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
