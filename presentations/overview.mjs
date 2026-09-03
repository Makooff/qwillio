/**
 * La présentation générale de Qwillio.
 *
 * Elle ne suit PAS le déroulé des decks métier (problème, produit, preuve,
 * prochaine étape). Une première version le faisait, et c'était le même
 * document avec d'autres mots : même ossature, mêmes pièces, même rythme.
 *
 * Celle-ci a son propre fil : un seul appel, raconté seconde par seconde, de
 * la première sonnerie au SMS. Chaque planche est un instant de cet appel,
 * porte son minutage, une réplique de la conversation, et ce que le logiciel
 * fait à ce moment-là. Le lecteur ne lit pas un argumentaire, il écoute un
 * appel, et la démonstration se fait toute seule.
 *
 * Conséquences de forme, voulues : une frise de progression revient sur chaque
 * planche (c'est elle qui tient le document), la couverture et le dénouement
 * sont en registre sombre alors que les decks métier sont clairs de bout en
 * bout, et il n'y a ici ni bento, ni quadrant, ni bulles de conversation.
 */

import { BRAND, COMMON } from './content.mjs';
import { frame, mark, frenchSpacing, serifWords } from './render.mjs';

const LABEL = 'Un appel, seconde par seconde';

/** La durée de l'appel raconté, en secondes. Le minutage en dépend. */
const DURATION = 108;

const BEATS = [
  {
    t: '0:00',
    at: 0,
    title: 'Ça sonne une fois.',
    who: 'agent',
    line: '« Cabinet, bonjour. Je suis l’assistante, et l’appel est enregistré. »',
    mech: [
      'Elle décroche à la première sonnerie, y compris quand votre ligne est déjà occupée.',
      'Elle annonce ce qu’elle est. Personne ne l’apprend après coup.',
    ],
  },
  {
    t: '0:06',
    at: 6,
    title: 'Il parle.<br>Elle ne le <i>coupe</i> pas.',
    who: 'caller',
    line: '« Bonjour, j’aurais voulu passer cette semaine. Jeudi, si c’est possible. »',
    mech: [
      'Elle glisse des « mhm » pendant qu’il parle, jamais un « oui » qui vaudrait engagement.',
      'Coupez-la en pleine phrase : elle s’arrête net.',
    ],
  },
  {
    t: '0:19',
    at: 19,
    title: 'Elle regarde votre <i>agenda</i>.',
    lead: 'Pendant qu’il finit sa phrase, elle a déjà lu jeudi. Il n’y a pas de « je vous rappelle pour confirmer ».',
    mech: [
      'Elle lit vos vraies disponibilités pendant qu’il est encore en ligne.',
      'Deux appels en même temps ne peuvent pas réserver la même heure.',
    ],
  },
  {
    t: '0:33',
    at: 33,
    title: 'Elle propose.<br>Il <i>choisit</i>.',
    who: 'agent',
    line: '« Jeudi, j’ai 10 h 30 ou 16 h. Laquelle vous arrange ? »',
    mech: ['Deux créneaux, jamais une liste de douze. C’est ce qui fait décider quelqu’un.'],
  },
  {
    t: '0:52',
    at: 52,
    title: 'Elle note ce que vous<br>lui avez <i>demandé</i> de noter.',
    who: 'caller',
    line: '« Marc Dubois, 0470 12 34 56. »',
    mech: [
      'Les questions sont les vôtres. Vous les changez en lui parlant dans le chat.',
      'Un habitué n’a rien à redonner : elle se souvient de ses appels précédents.',
    ],
  },
  {
    t: '1:20',
    at: 80,
    title: 'Elle décide si ça doit<br>vous <i>parvenir</i>.',
    lead: 'La plupart des appels n’ont aucune raison de vous interrompre. Celui-là non plus.',
    mech: [
      'Une urgence : elle vous appelle, dit qui et pourquoi, puis passe la ligne.',
      'Un démarcheur : elle raccroche, et la minute n’est pas décomptée.',
    ],
  },
];

/* Ce qui existe au moment où elle raccroche. C'est le dénouement du récit, et
   la seule planche où l'on énumère. */
const DONE = [
  'Le rendez-vous est dans votre agenda.',
  'Le client a reçu son SMS de confirmation.',
  'La fiche est écrite : demande, résultat, humeur.',
  'La transcription est horodatée et cherchable.',
  'Le contact est parti dans votre CRM.',
];

/* Les appels qui ne ressemblent pas à celui-là. Un produit qui ne montre que
   son cas idéal ne se croit pas. */
const EDGES = [
  {
    case: 'Un blanc de dix secondes',
    behaviour: 'Elle relance « vous êtes toujours là ? » au lieu de raccrocher.',
  },
  {
    case: 'Un appelant agacé',
    behaviour: 'Phrases courtes, zéro discours commercial, un humain proposé plus tôt.',
  },
  {
    case: 'Il passe à l’anglais',
    behaviour: 'Elle suit, sur le même appel, sans transfert ni touche à composer.',
  },
  {
    case: 'Une question hors sujet',
    behaviour: 'Elle dit qu’elle ne sait pas, et propose de faire rappeler. Elle n’invente pas.',
  },
];

/* ── Pièces communes aux planches d'appel ───────────────────────────── */

const rail = (at) => {
  const pct = Math.round((at / DURATION) * 1000) / 10;
  return `
    <div class="rail">
      <span class="rail__end">0:00</span>
      <span class="rail__track">
        <span class="rail__fill" style="width:${pct}%"></span>
        <span class="rail__dot" style="left:${pct}%"></span>
      </span>
      <span class="rail__end">1:48</span>
    </div>`;
};

/* ── Planches ───────────────────────────────────────────────────────── */

function cover(today) {
  return frame({
    label: LABEL,
    tone: 'cover slide--dark',
    veil: 'glow',
    foot: false,
    body: `
    <div class="lockup">${mark('lockup__mark')}<span class="lockup__word">${BRAND.name}</span></div>
    <div class="cover__mid">
      <p class="eyebrow">Réceptionniste IA</p>
      <h1 class="display">Une minute<br><i>quarante-huit</i>.</h1>
      <p class="lead cover__lead">Ce qui se passe, seconde par seconde, quand elle décroche à votre place. Un seul appel, du premier bip au SMS de confirmation.</p>
    </div>
    <div class="cover__meta">
      <span><strong>${BRAND.site}</strong> &nbsp;·&nbsp; ${BRAND.email} &nbsp;·&nbsp; ${BRAND.phone}</span>
      <span>${today}</span>
    </div>`,
  });
}

function beat(b, n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    veil: n % 2 === 0 ? 'soft' : '',
    body: `
    ${rail(b.at)}
    <div class="beat">
      <div class="beat__side">
        <p class="beat__time">${b.t}</p>
        <h2 class="h2">${b.title}</h2>
        ${b.lead ? `<p class="lead" style="margin-top:22px;max-width:520px">${b.lead}</p>` : ''}
        ${
          b.line
            ? `<p class="beat__line beat__line--${b.who}">
          <span class="beat__who">${b.who === 'agent' ? BRAND.name : 'L’appelant'}</span>
          ${b.line}
        </p>`
            : ''
        }
      </div>
      <div class="beat__mech">
        <p class="beat__mech-label">Ce que fait le logiciel</p>
${b.mech.map((m) => `        <p class="beat__mech-item">${m}</p>`).join('\n')}
      </div>
    </div>`,
  });
}

function done(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    tone: 'slide--dark',
    veil: 'glow',
    body: `
    ${rail(DURATION)}
    <div class="beat">
      <div class="beat__side">
        <p class="beat__time">1:48</p>
        <h2 class="h2">Elle raccroche.<br>Tout est déjà <i>fait</i>.</h2>
        <p class="lead" style="margin-top:22px">Aucune de ces cinq choses ne vous attend le lendemain matin. C’est la différence entre une réceptionniste et un répondeur.</p>
      </div>
      <div class="done">
${DONE.map((d) => `        <p class="done__item">${d}</p>`).join('\n')}
      </div>
    </div>`,
  });
}

function edges(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    body: `
    <div class="head-row" style="margin-bottom:30px">
      <div>
        <p class="eyebrow">Et quand ça ne se passe pas comme ça</p>
        <h2 class="h2">Les appels qui ne ressemblent<br>pas à <i>celui-là</i>.</h2>
      </div>
      <p class="small head-row__note">Un produit qui ne montre que son cas idéal ne se croit pas.</p>
    </div>
    <div class="edges">
${EDGES.map(
  (e) => `      <div class="edges__row">
        <span class="edges__case">${e.case}</span>
        <span class="edges__behaviour">${e.behaviour}</span>
      </div>`
).join('\n')}
    </div>`,
  });
}

function setup(n, total) {
  const c = COMMON.setup;
  return frame({
    n,
    total,
    label: LABEL,
    veil: 'soft',
    body: `
    <div class="stack grow" style="justify-content:center">
      <div style="margin-bottom:36px">
        <p class="eyebrow">${c.eyebrow}</p>
        <h2 class="h2">Cet appel-là peut avoir lieu<br>chez vous <i>demain</i>.</h2>
      </div>
      <div class="track">
${c.steps
  .map(
    (st, i) => `        <div class="track__step">
          <span class="track__index">${String(i + 1).padStart(2, '0')}</span>
          <h3 class="h3">${st.title}</h3>
          <p class="track__body">${st.body}</p>
        </div>`
  )
  .join('\n')}
      </div>
      <p class="setup__note">${c.note}</p>
    </div>`,
  });
}

function truth(n, total) {
  const c = COMMON.truth;
  return frame({
    n,
    total,
    label: LABEL,
    tone: 'slide--dark',
    body: `
    <div class="head-row">
      <div>
        <p class="eyebrow">${c.eyebrow}</p>
        <h2 class="h2">${c.title}</h2>
      </div>
      <p class="small head-row__note">${c.lead}</p>
    </div>
    <div class="cols">
${c.items
  .map(
    (it, i) => `      <div class="cols__cell">
        <span class="cols__index">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="h3">${it.title}</h3>
        <p class="cols__body">${it.body}</p>
      </div>`
  )
  .join('\n')}
    </div>`,
  });
}

function cta(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    veil: 'lilac',
    body: `
    <div class="stack grow" style="justify-content:center">
      <p class="eyebrow">Prochaine étape</p>
      <h2 class="h2" style="max-width:900px">Le plus court chemin<br>reste de l’<i>appeler</i>.</h2>
      <p class="lead" style="margin-top:24px;max-width:600px">Dix minutes au téléphone valent mieux que ces douze pages. Ensuite, sept jours d’essai sur votre vrai numéro, sans frais d’installation, et vous coupez le renvoi quand vous voulez.</p>
      <div class="contact" style="margin-top:36px">
        <span class="contact__item contact__item--lit">${BRAND.phone}</span>
        <span class="contact__item">${BRAND.email}</span>
        <span class="contact__item">${BRAND.site}</span>
      </div>
    </div>`,
  });
}

export const OVERVIEW = { slug: 'presentation', label: LABEL };

export function renderOverviewDeck({ today, cssHref = 'assets/deck.css' }) {
  const tail = [done, edges, setup, truth, cta];
  const total = 1 + BEATS.length + tail.length;

  const slides = [
    cover(today),
    ...BEATS.map((b, i) => beat(b, i + 2, total)),
    ...tail.map((fn, i) => fn(BEATS.length + 2 + i, total)),
  ];

  return frenchSpacing(
    serifWords(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Qwillio · une minute quarante-huit</title>
<link rel="stylesheet" href="${cssHref}">
</head>
<body>
${slides.join('\n')}
</body>
</html>
`)
  );
}
