import RevealV2 from './RevealV2';
import ScreenShot from './ScreenShot';

/* Rangées « produit »: chaque rangée occupe toute la largeur, le texte tient
   sur environ 40 pour cent et la capture sur environ 60, le côté de
   l'illustration s'inverse d'une rangée à l'autre.

   La capture FLOTTE sur la section, sans plate ni boîte autour (référence
   utilisateur: les sections Codex d'OpenAI). Ce qui la décolle de la bande
   est son ombre portée et son filet clair, pas un fond de carte. Elle déborde
   par le côté extérieur au-delà de lg: le visuel sort de son conteneur au
   lieu d'y être enfermé.

   Le visuel est une CAPTURE DU VRAI PORTAIL (demande utilisateur: « met le
   vrai design quand tu utilises des écrans »), RÉGÉNÉRÉE depuis le portail
   livré (voir ScreenShot.tsx et capture-screens.mjs). Un dessin, même fidèle,
   dérive du produit à la première évolution; une capture, non.

   Mobile: texte puis image empilés, image pleine largeur. */

interface Feature {
  /** Nom du fichier dans `public/screens`, sans extension. */
  key: string;
  /** La capture est en PORTRAIT et doit être bridée en largeur. Voir plus bas. */
  portrait?: boolean;
  altFr: string;
  altEn: string;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
}

const FEATURES: Feature[] = [
  {
    /* La fiche d'appel, pas la liste: c'est elle qui porte le résumé, le
       transcript et le lecteur d'enregistrement dont parle le texte. La liste
       ne montrait qu'appelant, durée et sentiment (retour utilisateur). */
    key: 'fiche-appel',
    portrait: true,
    altFr: 'La fiche d’un appel dans le portail: résumé, score du lead, coordonnées.',
    altEn: 'A call record in the portal: summary, lead score, contact details.',
    titleFr: 'Chaque appel documenté',
    titleEn: 'Every call documented',
    descFr:
      'Résumé, transcript, enregistrement, lead qualifié : tout arrive dans votre dashboard à la seconde où l’appel se termine. Rien ne se perd, rien n’est à ressaisir.',
    descEn:
      'Summary, transcript, recording, qualified lead: everything lands in your dashboard the second the call ends. Nothing gets lost, nothing needs retyping.',
  },
  {
    key: 'analytique',
    altFr: 'La page Analytique du portail: volume d’appels, sentiment, heures de pointe.',
    altEn: 'The portal analytics page: call volume, sentiment, peak hours.',
    /* La page Analytique, parce que c'est LÀ que se lisent les constats dont
       parle le texte: volume, sentiment, heures de pointe. Le visuel a montré
       un temps la fenêtre de configuration, c'est-à-dire le sujet d'une autre
       section (retour utilisateur: « sélectionne bien le contenu qui
       correspond au texte »). Le constat hebdomadaire lui-même part par
       courriel et par SMS: il n'a pas d'écran, et en inventer un serait
       montrer une chose qui n'existe pas. */
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

              {/* La plate est RETIRÉE (référence utilisateur: les sections
                  Codex d'OpenAI, où la capture flotte directement sur la
                  section). La capture porte ses coins arrondis, un filet
                  clair et une vraie ombre portée, sans boîte autour: c'est
                  l'ombre, pas un fond de carte, qui la décolle de la bande.
                  Le débordement latéral au-delà de lg reste: le visuel sort
                  de sa colonne au lieu d'y être enfermé. */}
              <div
                className={`min-w-0 ${f.portrait ? 'mx-auto max-w-[420px]' : ''} ${flipped ? 'lg:order-1' : ''}`}
              >
                {/* Une capture en PORTRAIT est bridée en largeur et centrée.
                    La fiche d'appel fait 896 x 1280: étalée sur toute la
                    colonne large, elle sortait à plus de 800 px de haut
                    (retour utilisateur: « trop IA et trop grand »).
                    Elle ne déborde pas non plus par le côté: le débordement
                    sert à faire sortir un visuel LARGE de son conteneur, il
                    n'a aucun sens sur un visuel centré plus étroit que lui. */}
                {/* Filet CLAIR dans les deux cas: le panneau photographié est
                    à #171717 et la bande est sombre en thème sombre, un filet
                    de la couleur de la page ne séparerait rien. L'ombre est
                    profonde et douce: c'est elle qui fait flotter la capture
                    (référence Codex). */}
                <div
                  className={`rounded-[16px] overflow-hidden border border-white/10 shadow-[0_24px_70px_-18px_rgba(0,0,0,0.45)] ${
                    f.portrait
                      ? 'mx-auto w-full'
                      : `${flipped ? 'lg:-ml-6' : 'lg:-mr-6'}`
                  }`}
                >
                  <ScreenShot name={f.key} alt={isFr ? f.altFr : f.altEn} />
                </div>
              </div>
            </article>
          </RevealV2>
        );
      })}
    </div>
  );
}
