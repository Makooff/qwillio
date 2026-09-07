/**
 * La version courte : cinq planches, une pour la marque, quatre pour l'argument.
 *
 * Elle existe à côté de « Une minute quarante-huit », pas à sa place. Celle-là
 * raconte un appel en douze planches pour qui veut comprendre le mécanisme ;
 * celle-ci se feuillette en trente secondes, en pièce jointe d'un premier
 * courriel ou tendue au comptoir.
 *
 * D'où trois partis pris de forme, qui ne valent que pour ce document :
 * des énoncés en corps de titre plutôt que des paragraphes, une idée et une
 * seule par planche, et une dernière planche entièrement mauve, qui ne dit
 * qu'une chose : appelez-la.
 */

import { BRAND } from './content.mjs';
import { frame, mark, frenchSpacing, serifWords } from './render.mjs';

const LABEL = 'L’essentiel';

const VERBS = [
  {
    title: 'Elle décroche à la première sonnerie',
    body: 'La nuit, le week-end, et même quand votre ligne est déjà occupée. Personne ne tombe sur un répondeur.',
  },
  {
    title: 'Elle réserve dans votre agenda',
    body: 'Elle lit vos disponibilités pendant l’appel, pose le rendez-vous et le confirme par SMS.',
  },
  {
    title: 'Elle vous passe ce qui compte',
    body: 'Une urgence vous parvient avec son brief. Le reste vous attend, écrit, et ne vous interrompt pas.',
  },
];

const CALL = [
  { who: 'Client', line: 'Bonjour, vous auriez de la place jeudi ?' },
  { who: 'agent', line: 'Jeudi, j’ai 10 h 30 ou 16 h. Laquelle vous arrange ?' },
  { who: 'Client', line: '16 h, c’est parfait.' },
  { who: 'agent', line: 'C’est noté. Votre nom, et un numéro pour la confirmation ?' },
  { who: 'Client', line: 'Marc Dubois, 0470 12 34 56.' },
  { who: 'agent', line: 'Réservé jeudi à 16 h. Vous recevez le SMS tout de suite.' },
];

const DONE = [
  'Le rendez-vous est dans votre agenda.',
  'Le SMS de confirmation est parti.',
  'La fiche est écrite : demande, résultat, humeur.',
  'Le contact est dans votre CRM.',
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
      <p class="eyebrow">Réceptionniste IA</p>
      <h1 class="display big">Elle décroche.<br>Elle réserve.<br>Elle vous <i>prévient</i>.</h1>
      <p class="lead cover__lead">Un numéro qui répond 24 h sur 24, en français comme en anglais, et qui pose le rendez-vous avant de raccrocher.</p>
    </div>
    <div class="cover__meta">
      <span><strong>${BRAND.site}</strong> &nbsp;·&nbsp; ${BRAND.email} &nbsp;·&nbsp; ${BRAND.phone}</span>
      <span>${today}</span>
    </div>`,
  });
}

function verbs(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    veil: 'soft',
    body: `
    <div class="stack grow" style="justify-content:center">
      <p class="eyebrow">Ce qu’elle fait</p>
      <h2 class="h2" style="margin-bottom:38px">Trois choses, et c’est <i>tout</i>.</h2>
      <div class="verbs">
${VERBS.map(
  (v, i) => `        <div class="verbs__row">
          <span class="verbs__index">${String(i + 1).padStart(2, '0')}</span>
          <h3 class="verbs__title">${v.title}</h3>
          <p class="verbs__body">${v.body}</p>
        </div>`
).join('\n')}
      </div>
    </div>`,
  });
}

function call(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    tone: 'slide--band',
    body: `
    <div class="stack grow" style="justify-content:center">
      <p class="eyebrow">Un appel, en entier</p>
      <h2 class="h2" style="margin-bottom:34px">Quarante secondes, et le<br>rendez-vous <i>existe</i>.</h2>
      <div class="mini">
${CALL.map(
  (l) => `        <div class="mini__row">
          <span class="mini__who${l.who === 'agent' ? ' mini__who--agent' : ''}">${
            l.who === 'agent' ? BRAND.name : l.who
          }</span>
          <span class="mini__line">${l.line}</span>
        </div>`
).join('\n')}
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
    <div class="split split--45">
      <div class="stack" style="justify-content:center">
        <p class="eyebrow">Après</p>
        <h2 class="h2">Le lendemain matin,<br>il ne reste rien à <i>faire</i>.</h2>
        <p class="lead" style="margin-top:24px">C’est la différence entre une réceptionniste et un répondeur : elle n’a pas laissé de travail derrière elle.</p>
      </div>
      <div class="done">
${DONE.map((d) => `        <p class="done__item">${d}</p>`).join('\n')}
      </div>
    </div>`,
  });
}

function cta(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    tone: 'slide--brand',
    body: `
    <div class="stack grow" style="justify-content:center">
      <p class="eyebrow">Prochaine étape</p>
      <h2 class="display big" style="max-width:900px">Le plus simple,<br>c’est de l’<i>appeler</i>.</h2>
      <p class="lead" style="margin-top:28px;max-width:560px">Sept jours d’essai sur votre vrai numéro, sans frais d’installation, en ligne le jour même. Vous coupez le renvoi quand vous voulez.</p>
      <div class="contact" style="margin-top:40px">
        <span class="contact__item">${BRAND.phone}</span>
        <span class="contact__item">${BRAND.email}</span>
        <span class="contact__item">${BRAND.site}</span>
      </div>
    </div>`,
  });
}

const BUILDERS = [verbs, call, done, cta];

export const COMPACT = { slug: 'compact', label: LABEL };

export function renderCompactDeck({ today, cssHref = 'assets/deck.css' }) {
  const total = BUILDERS.length + 1;
  const slides = [cover(today), ...BUILDERS.map((b, i) => b(i + 2, total))];

  return frenchSpacing(
    serifWords(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Qwillio · l’essentiel</title>
<link rel="stylesheet" href="${cssHref}">
</head>
<body>
${slides.join('\n')}
</body>
</html>
`)
  );
}
