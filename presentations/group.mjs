/**
 * La proposition pour un propriétaire qui possède plusieurs commerces.
 *
 * Ce n'est pas la concaténation des decks métier, et ce n'est pas non plus une
 * offre groupée au rabais : on vend UNE RÉCEPTIONNISTE PAR MAISON. C'est ce que
 * le produit fait réellement (`ClientPhoneNumber` porte un nom d'agent, une
 * voix, une phrase d'accueil, des consignes et un numéro de transfert PAR
 * LIGNE), et c'est aussi ce qui se défend le mieux : un client de la parfumerie
 * ne doit pas entendre la personne qui répond au bar.
 *
 * L'argument central tient en une phrase, posée sur la frise des heures :
 * aucune de ses affaires ne justifie une réceptionniste à plein temps, et
 * chacune en mérite une quand même.
 *
 * Le document doit se comprendre en le feuilletant. Chaque planche porte donc
 * UNE idée, et les textes tiennent en deux lignes. Ce qui impressionne n'est
 * pas la densité : c'est la frise, les quatre visages et l'addition.
 */

import { readFileSync } from 'node:fs';
import { BRAND, COMMON, SECTORS } from './content.mjs';
import { frame, head, mark, frenchSpacing, serifWords, eur } from './render.mjs';

const LABEL = 'Quatre commerces, un propriétaire';

const bySlug = Object.fromEntries(SECTORS.map((s) => [s.slug, s]));
const CONCESSION = bySlug['concession-automobile'];
const PATISSERIE = bySlug['patisserie-trompe-loeil'];
const BAR = bySlug['bar'];
const PARFUMERIE = bySlug['parfumerie'];

/**
 * Les portraits viennent du catalogue de voix du produit
 * (`backend/src/config/voice-characters.ts` et `frontend/public/characters`),
 * ils ne sont pas illustratifs : ce sont les visages que le client verra en
 * choisissant, et les phrases qui les décrivent sont leurs `taglineFr`.
 * Embarqués en base64 pour la même raison que la police : un PDF qui dépend
 * d'un fichier voisin finit par s'ouvrir sans ses images.
 */
const portrait = (id) =>
  `data:image/webp;base64,${readFileSync(
    new URL(`../frontend/public/characters/${id}.webp`, import.meta.url)
  ).toString('base64')}`;

const CREW = [
  {
    house: 'La concession',
    voice: 'lucas',
    name: 'Lucas',
    tagline: 'Posé et professionnel, direct et rassurant.',
    greeting: '« Concession, bonjour. »',
    transfer: 'Passe à la vente, à l’atelier ou aux pièces',
  },
  {
    house: 'La pâtisserie',
    voice: 'marie',
    name: 'Marie',
    tagline: 'Chaleureuse et accueillante, sourire dans la voix.',
    greeting: '« Pâtisserie, bonjour. »',
    transfer: 'Ne vous dérange que pour un devis à valider',
  },
  {
    house: 'Le bar',
    voice: 'hugo',
    name: 'Hugo',
    tagline: 'Détendu et direct, comme un collègue au comptoir.',
    greeting: '« Le comptoir, bonjour. »',
    transfer: 'Passe au responsable de salle, après 18 h',
  },
  {
    house: 'La parfumerie',
    voice: 'camille',
    name: 'Camille',
    tagline: 'Soignée et raffinée, pour une image premium.',
    greeting: '« Parfumerie, bonjour. »',
    transfer: 'Passe à la boutique, jamais pendant un conseil',
  },
];

/* Quand chaque téléphone sonne, sur une journée de 8 h à 2 h. Ce sont des
   heures d'ouverture et de coup de feu, pas des mesures : la planche le dit,
   et le client les corrigera de mémoire. C'est ce qu'on veut qu'il fasse. */
const DAY_START = 8;
const DAY_END = 26;
const HOURS = [8, 12, 16, 20, 24];

const CURVES = [
  {
    house: 'La concession',
    bars: [
      { from: 9, to: 12.5, level: 'peak', note: 'samedi matin' },
      { from: 14, to: 18, level: 'soft' },
    ],
  },
  {
    house: 'La pâtisserie',
    bars: [
      { from: 10, to: 12.5, level: 'soft' },
      { from: 15, to: 18.5, level: 'peak', note: 'commandes' },
    ],
  },
  {
    house: 'Le bar',
    bars: [
      { from: 17, to: 19, level: 'soft' },
      { from: 19, to: 23.5, level: 'peak', note: 'plein service' },
    ],
  },
  {
    house: 'La parfumerie',
    bars: [
      { from: 11, to: 14, level: 'soft' },
      { from: 15, to: 19, level: 'peak', note: 'samedi, décembre' },
    ],
  },
];

const CATCHES = [
  {
    house: 'La concession',
    line: '« La Golf grise à 18 900 €, elle est toujours disponible ? »',
    gain: 'Essai proposé, reprise notée, rendez-vous posé.',
  },
  {
    house: 'La pâtisserie',
    line: '« Un gâteau qui ressemble à un sac à main, pour le 24. »',
    gain: 'Date, parts, thème, allergies, photo par SMS. Le brief est complet.',
  },
  {
    house: 'Le bar',
    line: '« Vous avez de la place vendredi pour quinze personnes ? »',
    gain: 'Groupe qualifié et confirmé sans quitter le comptoir.',
  },
  {
    house: 'La parfumerie',
    line: '« Vous avez encore le coffret 100 ml ? Et la gravure ? »',
    gain: 'Produit mis de côté à un nom, créneau conseil posé.',
  },
];

const GROUP_GAINS = [
  {
    title: 'Vous n’êtes plus le standard',
    body: 'Ce qui vous parvient arrive avec son brief : qui appelle, pour quelle maison, et pourquoi.',
  },
  {
    title: 'Chaque maison garde sa voix',
    body:
      'Un client de la parfumerie n’entend pas celle qui répond au bar. C’est votre image, pas un centre d’appels.',
  },
  {
    title: 'Quatre réceptionnistes, un seul écran',
    body: 'Vous les réglez toutes au même endroit, et vous recevez une facture, pas quatre.',
  },
  {
    title: 'La cinquième prend une heure',
    body: 'Un rachat, une deuxième boutique, une ligne saisonnière : c’est un réglage, pas un projet.',
  },
];

const GROUP_TRUTH = [
  ...COMMON.truth.items,
  {
    title: 'Le portail ne compare pas encore vos quatre affaires',
    body:
      'Chaque appel est enregistré, résumé et cherchable. Mais les quatre maisons ne sont pas encore côte à côte dans un même écran. Nous le construirons.',
  },
];

/* ── Planches ───────────────────────────────────────────────────────── */

function cover(today) {
  return frame({
    label: LABEL,
    tone: 'cover',
    veil: 'lilac',
    foot: false,
    body: `
    <div class="lockup">${mark('lockup__mark')}<span class="lockup__word">${BRAND.name}</span></div>
    <div class="cover__mid">
      <p class="eyebrow">Proposition &nbsp;·&nbsp; quatre commerces, un propriétaire</p>
      <h1 class="display">Quatre maisons.<br>Quatre <i>réceptionnistes</i>.</h1>
      <p class="lead cover__lead">Une concession, une pâtisserie en trompe-l’œil, un bar, une parfumerie. Chacune a son téléphone, son public et ses heures de pointe. Chacune aura la sienne.</p>
    </div>
    <div class="cover__meta">
      <span><strong>${BRAND.site}</strong> &nbsp;·&nbsp; ${BRAND.email} &nbsp;·&nbsp; ${BRAND.phone}</span>
      <span>${today}</span>
    </div>`,
  });
}

function problem(n, total) {
  const day = [
    { mark: '9 h 10', text: 'La concession vous appelle : la grise est-elle encore là ?' },
    { mark: '14 h 30', text: 'La pâtisserie vous appelle : une pièce pour le 24, et personne n’ose annoncer le délai.' },
    { mark: '18 h 45', text: 'La parfumerie vous appelle : faites-vous la gravure ?' },
    { mark: '21 h 20', text: 'Le bar ne vous appelle pas. Personne n’a entendu le téléphone, et la table de quinze est partie ailleurs.' },
  ];
  return frame({
    n,
    total,
    label: LABEL,
    veil: 'soft',
    body: `
    <div class="split split--45">
      ${head({
        eyebrow: 'Le problème',
        title: 'Le standard de vos quatre affaires,<br>c’est <i>vous</i>.',
        lead: 'Tout ce qu’aucune des quatre ne sait traiter finit sur votre portable. Une journée ordinaire ressemble à ceci.',
      })}
      <div class="timeline">
${day
  .map(
    (st) => `        <div class="timeline__row">
          <span class="timeline__mark">${st.mark}</span>
          <span class="timeline__text">${st.text}</span>
        </div>`
  )
  .join('\n')}
      </div>
    </div>`,
  });
}

function curves(n, total) {
  const pos = (h) => ((h - DAY_START) / (DAY_END - DAY_START)) * 100;
  return frame({
    n,
    total,
    label: LABEL,
    body: `
    <div class="stack grow" style="justify-content:center">
    <div class="head-row" style="margin-bottom:30px">
      <div>
        <p class="eyebrow">Ce que personne ne regarde</p>
        <h2 class="h2">Vos quatre téléphones sonnent<br>à des <i>heures</i> différentes.</h2>
      </div>
      <p class="small head-row__note">Heures d’ouverture et coups de feu, de mémoire. Corrigez-les, le raisonnement tient.</p>
    </div>
    <div class="curves">
      <div class="curves__axis">
${HOURS.map((h) => `        <span class="curves__tick" style="left:${pos(h)}%">${h === 24 ? '00 h' : `${h} h`}</span>`).join('\n')}
      </div>
${CURVES.map(
  (row) => `      <div class="curves__row">
        <span class="curves__label">${row.house}</span>
        <span class="curves__track">
${row.bars
  .map(
    (b) =>
      `          <span class="curves__bar curves__bar--${b.level}" style="left:${pos(b.from)}%;width:${pos(b.to) - pos(b.from)}%">${
        b.note ? `<em>${b.note}</em>` : ''
      }</span>`
  )
  .join('\n')}
        </span>
      </div>`
).join('\n')}
    </div>
    <p class="close-line">Aucune de vos affaires ne justifie une réceptionniste à plein temps. Chacune en mérite une quand même.</p>
    </div>`,
  });
}

function intro(n, total) {
  const c = COMMON.intro;
  return frame({
    n,
    total,
    label: LABEL,
    tone: 'slide--dark',
    veil: 'glow',
    body: `
    <div class="split split--45">
      <div class="stack" style="justify-content:center">
        <p class="eyebrow">${c.eyebrow}</p>
        <h2 class="h2">${c.title}</h2>
        <p class="lead" style="margin-top:24px">${c.lead}</p>
      </div>
      <div class="points">
${c.points
  .map(
    (p, i) => `        <div class="points__row">
          <span class="points__index">${String(i + 1).padStart(2, '0')}</span>
          <div>
            <h3 class="h3">${p.title}</h3>
            <p class="points__body">${p.body}</p>
          </div>
        </div>`
  )
  .join('\n')}
      </div>
    </div>`,
  });
}

function crew(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    veil: 'soft',
    body: `
    <div class="head-row" style="margin-bottom:28px">
      <div>
        <p class="eyebrow">Votre équipe</p>
        <h2 class="h2">Voici vos quatre <i>réceptionnistes</i>.</h2>
      </div>
      <p class="small head-row__note">Le nom, la voix et la phrase d’accueil se choisissent maison par maison.</p>
    </div>
    <div class="crew">
${CREW.map(
  (c) => `      <div class="crew__card">
        <img class="crew__avatar" src="${portrait(c.voice)}" alt="">
        <p class="crew__house">${c.house}</p>
        <p class="crew__name">${c.name}</p>
        <p class="crew__greeting">${c.greeting}</p>
        <p class="crew__voice">${c.tagline}</p>
        <p class="crew__transfer">${c.transfer}</p>
      </div>`
).join('\n')}
    </div>
    <p class="close-line" style="margin-top:26px">Elles ne partagent ni la voix, ni les règles, ni le numéro. Vous, vous n’avez qu’un tableau de bord.</p>`,
  });
}

function catches(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    body: `
    <div style="margin-bottom:4px">
      <p class="eyebrow">Maison par maison</p>
      <h2 class="h2">L’appel qu’elle <i>rattrape</i>, chez chacune.</h2>
    </div>
    <div class="quad">
${CATCHES.map(
  (c) => `      <div class="quad__cell">
        <div class="quad__head"><span class="dot"></span><h3 class="h3">${c.house}</h3></div>
        <p class="quad__quote">${c.line}</p>
        <p class="quad__body">${c.gain}</p>
      </div>`
).join('\n')}
    </div>`,
  });
}

function call(n, total) {
  const s = CONCESSION;
  return frame({
    n,
    total,
    label: LABEL,
    body: `
    <div class="head-row" style="margin-bottom:22px">
      <div>
        <p class="eyebrow">Un appel en entier, samedi 11 h 04</p>
        <h2 class="h2">Elle ne note pas la demande.<br>Elle la <i>traite</i>.</h2>
      </div>
      <p class="small head-row__note">Pris à la concession, celle où un appel manqué coûte le plus cher.</p>
    </div>
    <div class="chat grow">
${s.call.lines
  .map(
    (l) => `      <div class="bubble bubble--${l.who === 'agent' ? 'agent' : 'caller'}">
        <span class="bubble__who">${l.who === 'agent' ? 'Lucas' : 'Client'}</span>${l.text}
      </div>
      ${l.note ? `<p class="chat__note">${l.note}</p>` : '<span></span>'}`
  )
  .join('\n')}
    </div>`,
  });
}

function natural(n, total) {
  const c = COMMON.natural;
  return frame({
    n,
    total,
    label: LABEL,
    body: `
    <div class="head-row" style="margin-bottom:24px">
      <div>
        <p class="eyebrow">${c.eyebrow}</p>
        <h2 class="h2">${c.title}</h2>
      </div>
      <p class="small head-row__note">Quatre comportements qui séparent une machine de quelqu’un qui répond.</p>
    </div>
    <div class="bento">
${c.items
  .map(
    (it) => `      <div class="bento__cell">
        <span class="bento__tick"></span>
        <h3 class="h3">${it.title}</h3>
        <p class="bento__body">${it.body}</p>
      </div>`
  )
  .join('\n')}
    </div>`,
  });
}

function after(n, total) {
  const c = COMMON.after;
  const s = CONCESSION;
  return frame({
    n,
    total,
    label: LABEL,
    body: `
    <div class="split split--55">
      <div class="stack" style="justify-content:center">
        <p class="eyebrow eyebrow--muted" style="margin-bottom:14px">La fiche d’appel</p>
        <div class="record">
          <div class="record__head">
            <span class="record__title">Ligne « La concession », par Lucas</span>
            <span class="record__dur">${s.record.duration}</span>
          </div>
          <div class="record__row">
            <span class="record__key">Demande</span>
            <span class="record__val">${s.record.intent}</span>
          </div>
          <div class="record__row">
            <span class="record__key">Résultat</span>
            <span class="record__val record__val--ok">${s.record.outcome}</span>
          </div>
          <div class="record__notes">
${s.record.lines.map((l) => `            <span class="record__note">${l}</span>`).join('\n')}
          </div>
        </div>
        <p class="small record__caption">La maison est en tête de fiche : vous savez d’où vient l’appel avant d’avoir lu la première ligne.</p>
      </div>
      <div class="stack" style="justify-content:center">
        <p class="eyebrow">${c.eyebrow}</p>
        <h2 class="h2">${c.title}</h2>
        <div class="points" style="margin-top:26px">
${c.points
  .map(
    (p, i) => `          <div class="points__row">
            <span class="points__index" style="color:var(--indigo)">${String(i + 1).padStart(2, '0')}</span>
            <div>
              <h3 class="h4">${p.title}</h3>
              <p class="points__body" style="color:var(--body)">${p.body}</p>
            </div>
          </div>`
  )
  .join('\n')}
        </div>
      </div>
    </div>`,
  });
}

function groupGains(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    body: `
    <div style="margin-bottom:4px">
      <p class="eyebrow">Ce que ça change</p>
      <h2 class="h2">Ce qu’on ne gagne qu’en en ayant <i>quatre</i>.</h2>
    </div>
    <div class="quad">
${GROUP_GAINS.map(
  (g) => `      <div class="quad__cell">
        <div class="quad__head"><span class="dot"></span><h3 class="h3">${g.title}</h3></div>
        <p class="quad__body">${g.body}</p>
      </div>`
).join('\n')}
    </div>`,
  });
}

function tally(n, total) {
  const rows = [
    { short: 'La concession', sector: CONCESSION },
    { short: 'La pâtisserie', sector: PATISSERIE },
    { short: 'Le bar', sector: BAR },
    { short: 'La parfumerie', sector: PARFUMERIE },
  ].map(({ short, sector }) => {
    const { missed, oneIn, value } = sector.cost;
    const occasions = Math.round((missed * BRAND.weeksPerYear) / oneIn);
    return { short, missed, oneIn, value, lost: occasions * value };
  });
  const lostTotal = rows.reduce((sum, r) => sum + r.lost, 0);

  return frame({
    n,
    total,
    label: LABEL,
    tone: 'slide--band',
    body: `
    <div class="stack grow" style="justify-content:center">
      <div style="margin-bottom:6px">
        <p class="eyebrow">Ce que ça coûte déjà</p>
        <h2 class="h2">Quatre fuites, une seule <i>addition</i>.</h2>
      </div>
      <div class="tally">
        <div class="tally__row tally__row--head">
          <span>Maison</span><span>Appels manqués</span><span>Dont acheteurs</span><span>Valeur</span><span>Par an</span>
        </div>
${rows
  .map(
    (r) => `        <div class="tally__row">
          <span class="tally__house">${r.short}</span>
          <span>${r.missed} par semaine</span>
          <span>1 sur ${r.oneIn}</span>
          <span>${eur(r.value)}</span>
          <span class="tally__sum">${eur(r.lost)}</span>
        </div>`
  )
  .join('\n')}
        <div class="tally__row tally__row--total">
          <span class="tally__house">Les quatre</span><span></span><span></span><span></span>
          <span class="tally__sum">≈ ${eur(lostTotal)}</span>
        </div>
      </div>
      <p class="small" style="margin-top:20px;max-width:860px">Hypothèses volontairement basses, sur ${BRAND.weeksPerYear} semaines. Remplacez-les par vos chiffres : la structure du calcul ne change pas.</p>
    </div>`,
  });
}

function setup(n, total) {
  const steps = [
    { title: 'Une maison d’abord', body: 'Celle qui perd le plus d’appels. Le renvoi se pose en une manipulation, sans changer de numéro.' },
    { title: 'Sept jours pour écouter', body: 'Vous lisez les appels réels de votre propre ligne. On corrige ce qui doit l’être.' },
    { title: 'Puis les trois autres', body: 'Chacune reçoit sa voix, son accueil et son transfert. Ce qui a été appris sert aux suivantes.' },
  ];
  return frame({
    n,
    total,
    label: LABEL,
    veil: 'soft',
    body: `
    <div class="head-row" style="margin-bottom:6px">
      <div>
        <p class="eyebrow">Mise en route</p>
        <h2 class="h2">Commencez par une maison,<br>pas par <i>quatre</i>.</h2>
      </div>
      <span class="chip chip--lit"><span class="dot"></span>Sans frais d’installation</span>
    </div>
    <div class="steps">
${steps
  .map(
    (st, i) => `      <div class="step">
        <span class="step__index">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="h3">${st.title}</h3>
        <p class="step__body">${st.body}</p>
      </div>`
  )
  .join('\n')}
    </div>
    <p class="setup__note" style="margin-top:36px">${COMMON.setup.note}</p>`,
  });
}

function truth(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    tone: 'slide--dark',
    body: `
    <div class="head-row">
      <div>
        <p class="eyebrow">${COMMON.truth.eyebrow}</p>
        <h2 class="h2">${COMMON.truth.title}</h2>
      </div>
      <p class="small head-row__note">Quatre choses qu’il vaut mieux lire ici que découvrir dans trois mois.</p>
    </div>
    <div class="cols cols--4">
${GROUP_TRUTH.map(
  (it, i) => `      <div class="cols__cell">
        <span class="cols__index">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="h3">${it.title}</h3>
        <p class="cols__body">${it.body}</p>
      </div>`
).join('\n')}
    </div>`,
  });
}

function cta(n, total) {
  const c = COMMON.cta;
  const steps = [
    { title: 'Un appel de démonstration', body: 'Vous appelez celle de votre choix. Dix minutes suffisent pour juger.' },
    { title: 'Sept jours d’essai', body: 'Sur une vraie ligne, avec vos vraies règles, sans frais d’installation.' },
    { title: 'Les trois autres quand vous le dites', body: 'Vous coupez le renvoi quand vous voulez. Il n’y a rien à désinstaller.' },
  ];
  return frame({
    n,
    total,
    label: LABEL,
    veil: 'lilac',
    body: `
    <div class="cta__grid">
      <div>
        <p class="eyebrow">${c.eyebrow}</p>
        <h2 class="h2">${c.title}</h2>
        <p class="lead" style="margin-top:24px">On commence par la maison de votre choix. Vous jugez sur ce que vous entendez, pas sur ce qui est écrit ici.</p>
      </div>
      <div>
        <div class="cta__steps">
${steps
  .map(
    (st, i) => `          <div class="cta__step">
            <span class="cta__index">${String(i + 1).padStart(2, '0')}</span>
            <div>
              <h3 class="h4">${st.title}</h3>
              <p class="cta__body">${st.body}</p>
            </div>
          </div>`
  )
  .join('\n')}
        </div>
        <div class="contact">
          <span class="contact__item contact__item--lit">${BRAND.phone}</span>
          <span class="contact__item">${BRAND.email}</span>
          <span class="contact__item">${BRAND.site}</span>
        </div>
      </div>
    </div>`,
  });
}

/* Quatorze planches, une idée par planche. La liste numérotée « pendant
   l'appel » a sauté : ce qu'elle disait (elle sait quelle maison, elle
   transfère au bon poste) se lit déjà sur les fiches des quatre
   réceptionnistes et dans l'appel joué. */
const BUILDERS = [problem, curves, intro, crew, catches, call, natural, after, groupGains, tally, setup, truth, cta];

export const GROUP = { slug: 'groupe', label: LABEL };

export function renderGroupDeck({ today, cssHref = 'assets/deck.css' }) {
  const total = BUILDERS.length + 1;
  const slides = [cover(today), ...BUILDERS.map((b, i) => b(i + 2, total))];

  return frenchSpacing(
    serifWords(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Qwillio · quatre réceptionnistes</title>
<link rel="stylesheet" href="${cssHref}">
</head>
<body>
${slides.join('\n')}
</body>
</html>
`)
  );
}
