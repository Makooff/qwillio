import RevealV2 from './RevealV2';
import ScreenShot from './ScreenShot';

/* Rangées « produit »: chaque rangée occupe toute la largeur, le texte tient
   sur environ 40 pour cent et l'illustration sur environ 60, le côté de
   l'illustration s'inverse d'une rangée à l'autre.

   Le visuel est une CAPTURE DU VRAI PORTAIL (demande utilisateur: « met le
   vrai design quand tu utilises des écrans »), RÉGÉNÉRÉE depuis le portail
   livré (voir ScreenShot.tsx et capture-screens.mjs). Un dessin, même fidèle,
   dérive du produit à la première évolution; une capture, non.

   La présentation suit la référence utilisateur (les sections Codex d'OpenAI):
   l'écran du produit dans un DEVICE ou en fenêtre flottante, au centre d'un
   panneau DRENCHED — dégradé indigo d'un côté, violet de l'autre, comme les
   deux cercles du logo. Le registre drenched ne bascule pas avec le thème:
   le panneau reste saturé en clair comme en sombre, c'est lui qui porte la
   couleur de la rangée.

   Rangée 1: la fiche d'appel dans un cadre iPhone (la capture est prise sur
   un vrai viewport iPhone 15 Pro, barre de statut comprise).
   Rangée 2: la carte « Volume d'appels » en fenêtre flottante sur le violet.

   Mobile: texte puis illustration empilés, pleine largeur. */

interface Feature {
  /** Nom du fichier dans `public/screens`, sans extension. */
  key: string;
  /** La capture est un écran d'IPHONE et part dans le cadre téléphone. */
  phone?: boolean;
  /** La couleur drenched du panneau: indigo côté Q, violet côté W. */
  tone: 'indigo' | 'violet';
  altFr: string;
  altEn: string;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
}

/* Les deux dégradés du registre drenched, un par rangée: la lumière vient
   d'en bas à gauche pour l'indigo, d'en haut à droite pour le violet — deux
   géométries, jamais deux fois la même.
   MAUVE SOMBRE (retour utilisateur: « pas de rose ni de mauve clair »): la
   lumière reste mauve mais profonde, et le panneau tombe vite au quasi-noir. */
const DRENCHED = {
  indigo: 'radial-gradient(130% 150% at 18% 115%, #453486 0%, #221842 48%, #100F13 85%)',
  violet: 'radial-gradient(125% 145% at 85% -12%, #4E2E7E 0%, #251741 48%, #100F13 85%)',
} as const;

const FEATURES: Feature[] = [
  {
    /* La fiche d'appel, pas la liste: c'est elle qui porte le résumé, le
       transcript et le lecteur d'enregistrement dont parle le texte. Prise
       sur iPhone: la promesse « tout arrive dans votre dashboard » tient dans
       la poche, et le device le dit sans une ligne de texte. */
    key: 'fiche-appel-phone',
    phone: true,
    tone: 'indigo',
    altFr: 'La fiche d’un appel dans le portail, sur téléphone: résumé, score du lead, enregistrement et transcript.',
    altEn: 'A call record in the portal, on a phone: summary, lead score, recording and transcript.',
    titleFr: 'Chaque appel documenté',
    titleEn: 'Every call documented',
    descFr:
      'Résumé, transcript, enregistrement, lead qualifié : tout arrive dans votre dashboard à la seconde où l’appel se termine. Rien ne se perd, rien n’est à ressaisir.',
    descEn:
      'Summary, transcript, recording, qualified lead: everything lands in your dashboard the second the call ends. Nothing gets lost, nothing needs retyping.',
  },
  {
    key: 'analytique',
    tone: 'violet',
    altFr: 'La page Analytique du portail: volume d’appels, sentiment, heures de pointe.',
    altEn: 'The portal analytics page: call volume, sentiment, peak hours.',
    /* La page Analytique, parce que c'est LÀ que se lisent les constats dont
       parle le texte: volume, sentiment, heures de pointe. Le constat
       hebdomadaire lui-même part par courriel et par SMS: il n'a pas d'écran,
       et en inventer un serait montrer une chose qui n'existe pas. */
    /* Le titre ne parle plus de « corriger en parlant »: la section « Mise en
       route » de la Home dit déjà exactement ça, et les deux se répondaient en
       écho (retour utilisateur). Ici, le sujet est le CONSTAT qui vous arrive
       tout seul chaque semaine. */
    titleFr: 'Chaque semaine, elle vous dit ce qui coince',
    titleEn: 'Every week she tells you what is stuck',
    /* Chaque promesse ici correspond à un constat réel du code :
       receptionist-learning.service.ts tourne tous les dimanches (bot-loop.ts,
       cron 0 2 * * 0) et receptionist-digest.service.ts envoie les constats
       actionnables au courriel et au téléphone du client (verbose_agent,
       knowledge_gaps, upset_callers, tool_failures sur l'agenda). */
    descFr:
      'Réponses trop longues, agenda déconnecté, questions absentes de sa base : le constat arrive sur votre courriel et votre téléphone, sans que vous ayez à ouvrir quoi que ce soit.',
    descEn:
      'Answers running long, calendar disconnected, questions missing from her knowledge base: the findings land in your inbox and on your phone, without you opening anything.',
  },
];

export default function FeatureCards({ isFr }: { isFr: boolean }) {
  return (
    <div className="mt-9 sm:mt-14 flex flex-col gap-12 sm:gap-20 md:gap-28">
      {FEATURES.map((f, i) => {
        const flipped = i % 2 === 1;
        return (
          <RevealV2 key={f.key} index={i}>
            <article
              className={`grid items-center gap-7 sm:gap-10 lg:gap-16 ${
                flipped
                  ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]'
                  : 'lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]'
              }`}
            >
              <div className={`min-w-0 ${flipped ? 'lg:order-2' : ''}`}>
                <h3 className="text-[22px] lg:text-[24px] leading-[1.2] tracking-[-0.01em] text-q2-ink mb-4">
                  {isFr ? f.titleFr : f.titleEn}
                </h3>
                <p className="text-[15px] leading-relaxed text-q2-body q2-body-text max-w-[440px]">
                  {isFr ? f.descFr : f.descEn}
                </p>
              </div>

              {/* Le panneau drenched: même géométrie et même respiration sur
                  les deux rangées, seule la couleur alterne. */}
              <div
                className={`min-w-0 rounded-[24px] sm:rounded-[28px] p-6 sm:p-10 lg:p-14 ${
                  flipped ? 'lg:order-1' : ''
                }`}
                style={{ background: DRENCHED[f.tone] }}
              >
                {f.phone ? (
                  /* Le cadre iPhone: coque quasi-noire, 10 px de bezel, coins
                     à 44/34 px — les cotes de l'iPhone 15 Pro ramenées à la
                     capture, qui porte déjà sa bande de statut. L'ombre fait
                     flotter le device au-dessus du dégradé. */
                  <div className="mx-auto w-full max-w-[280px] sm:max-w-[300px] rounded-[44px] border border-white/15 bg-[#0B0B0D] p-[10px] shadow-[0_36px_90px_-24px_rgba(0,0,0,0.7)]">
                    <ScreenShot
                      name={f.key}
                      alt={isFr ? f.altFr : f.altEn}
                      className="rounded-[34px]"
                    />
                  </div>
                ) : (
                  /* La fenêtre flotte: pas de coque, juste ses coins et une
                     ombre profonde qui la décolle du dégradé. Pas de filet:
                     `border-white/15` en semi-transparent sur le panneau violet
                     tournait au mauve (retour utilisateur), on l'enlève. */
                  <div className="rounded-[16px] overflow-hidden shadow-[0_28px_80px_-20px_rgba(0,0,0,0.6)]">
                    <ScreenShot name={f.key} alt={isFr ? f.altFr : f.altEn} />
                  </div>
                )}
              </div>
            </article>
          </RevealV2>
        );
      })}
    </div>
  );
}
