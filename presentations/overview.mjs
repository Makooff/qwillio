/**
 * La présentation générale de Qwillio.
 *
 * Celle qu'on envoie quand on ne sait pas encore à qui on parle : pas de
 * métier, pas de chiffres propres à un secteur, pas de nom de client. Onze
 * planches, une idée par planche, et trois choses à montrer plutôt qu'à dire :
 * un appel joué en entier, ce qui reste après, et à quoi elle se branche.
 *
 * Elle réutilise les arguments produit de `content.mjs` (COMMON) : ce sont les
 * mêmes que dans les decks métier, et deux versions divergentes du même
 * argument, c'est une version fausse dès la première correction.
 */

import { BRAND, COMMON } from './content.mjs';
import { frame, head, mark, frenchSpacing, serifWords } from './render.mjs';

const LABEL = 'Présentation';

/* Ce qu'elle accomplit pendant un appel. Chaque ligne est un outil réel du
   runtime, repris de la page d'accueil (`pages/v2/Home.tsx`). */
const DURING = [
  {
    title: 'Elle vérifie le créneau',
    body:
      'Agenda connecté, elle lit vos disponibilités pendant que votre client parle. Deux appels en même temps ne peuvent pas réserver la même heure.',
  },
  {
    title: 'Elle inscrit le rendez-vous',
    body:
      'La réservation est créée avant de raccrocher, pas dans un message à rappeler. Votre client reçoit la confirmation par SMS.',
  },
  {
    title: 'Elle vous briefe avant de transférer',
    body:
      'Quand un appel doit vous parvenir, elle dit d’abord qui appelle et pourquoi, à l’oral et par SMS. Vous décrochez en sachant.',
  },
  {
    title: 'Elle reconnaît vos habitués',
    body:
      'Un client déjà venu est salué par son prénom. Elle se souvient des appels précédents et ne redemande pas ce qu’elle sait.',
  },
];

/* Un appel volontairement banal : celui que tout le monde reçoit. */
const CALL = [
  {
    who: 'caller',
    text: 'Bonjour, j’aurais voulu passer cette semaine. Vous avez de la place jeudi ?',
    note: 'Elle lit votre agenda pendant qu’il parle, pas après avoir raccroché.',
  },
  { who: 'agent', text: 'Jeudi, j’ai 10 h 30 ou 16 h. Laquelle vous arrange ?' },
  { who: 'caller', text: '16 h, c’est parfait.' },
  {
    who: 'agent',
    text: 'C’est noté. Votre nom, et un numéro pour la confirmation ?',
    note: 'Ce qu’elle demande, c’est vous qui le décidez, dans le chat.',
  },
  { who: 'caller', text: 'Marc Dubois, 0470 12 34 56.' },
  {
    who: 'agent',
    text: 'Merci. C’est réservé jeudi à 16 h, vous recevez le SMS tout de suite.',
    note: 'Le rendez-vous existe dans l’agenda avant qu’elle raccroche.',
  },
];

/* Trois niveaux, tels qu'ils sont écrits dans `config/integrations.ts`. La
   distinction n'est pas cosmétique : « natif » veut dire que le logiciel le
   traite lui-même, « par relais » qu'il passe par un webhook. La confondre,
   c'est promettre une lecture d'agenda là où il n'y a qu'une écriture. */
const WIRED = [
  {
    label: 'Nativement',
    body: 'Elle lit et écrit elle-même, sans intermédiaire.',
    items: ['Google Agenda', 'HubSpot', 'Slack'],
    lit: true,
  },
  {
    label: 'Par relais, sans une ligne de code',
    body: 'Zapier, Make, n8n ou un simple webhook, que vous branchez vous-même.',
    items: ['Pipedrive', 'Salesforce', 'Notion', 'Airtable', 'Google Sheets'],
    lit: false,
  },
];

/* Les métiers qui ont leur page sur le site. La liste sert à se reconnaître,
   pas à exclure : la dernière ligne de la planche le dit. */
const TRADES = [
  'Garage et concession',
  'Restaurant et bar',
  'Cabinet dentaire',
  'Kinésithérapie',
  'Plomberie et dépannage',
  'Cabinet comptable',
  'Avocat',
  'Notaire',
  'Agence immobilière',
  'Salon de coiffure',
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
      <h1 class="display">Elle ne prend pas de messages.<br>Elle prend des <i>rendez-vous</i>.</h1>
      <p class="lead cover__lead">Elle décroche 24 h sur 24, tient une vraie conversation en français comme en anglais, vérifie votre agenda pendant l’appel et confirme le rendez-vous par SMS.</p>
    </div>
    <div class="cover__meta">
      <span><strong>${BRAND.site}</strong> &nbsp;·&nbsp; ${BRAND.email} &nbsp;·&nbsp; ${BRAND.phone}</span>
      <span>${today}</span>
    </div>`,
  });
}

function problem(n, total) {
  const steps = [
    { mark: '0 s', text: 'Le téléphone sonne. Vous êtes avec un client, en intervention, ou déjà en ligne.' },
    { mark: '20 s', text: 'L’appelant tombe sur la messagerie. Il ne laisse pas de message : neuf sur dix n’en laissent jamais.' },
    { mark: '1 min', text: 'Il appelle le suivant sur sa liste. Là-bas, quelqu’un décroche.' },
    { mark: 'Jamais', text: 'Vous ne saurez pas ce qu’il voulait, ni combien il valait. Rien n’en garde la trace.' },
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
        title: 'Un appel manqué ne laisse<br>aucune <i>trace</i>.',
        lead:
          'Une commande ratée se voit dans les comptes. Un appel manqué, non : il n’apparaît nulle part, et c’est pour ça qu’on ne le corrige jamais.',
      })}
      <div class="timeline">
${steps
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

function during(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    veil: 'soft',
    body: `
    <div class="head-row" style="margin-bottom:26px">
      <div>
        <p class="eyebrow">Pendant l’appel</p>
        <h2 class="h2">Quatre choses qu’un répondeur<br>ne fait <i>pas</i>.</h2>
      </div>
      <p class="small head-row__note">Chacune est une action du logiciel, pas une intention.</p>
    </div>
    <div class="ladder">
${DURING.map(
  (it, i) => `      <div class="ladder__row">
        <span class="ladder__index">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="h3">${it.title}</h3>
        <p class="body">${it.body}</p>
      </div>`
).join('\n')}
    </div>`,
  });
}

function call(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    body: `
    <div class="head-row" style="margin-bottom:22px">
      <div>
        <p class="eyebrow">Un appel, en entier</p>
        <h2 class="h2">Elle ne note pas la demande.<br>Elle la <i>traite</i>.</h2>
      </div>
      <p class="small head-row__note">Quarante secondes, et le rendez-vous existe.</p>
    </div>
    <div class="chat grow">
${CALL.map(
  (l) => `      <div class="bubble bubble--${l.who === 'agent' ? 'agent' : 'caller'}">
        <span class="bubble__who">${l.who === 'agent' ? BRAND.name : 'Client'}</span>${l.text}
      </div>
      ${l.note ? `<p class="chat__note">${l.note}</p>` : '<span></span>'}`
).join('\n')}
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
            <span class="record__title">Appel du jeudi 14 h 12</span>
            <span class="record__dur">1 min 48</span>
          </div>
          <div class="record__row">
            <span class="record__key">Demande</span>
            <span class="record__val">Rendez-vous cette semaine</span>
          </div>
          <div class="record__row">
            <span class="record__key">Résultat</span>
            <span class="record__val record__val--ok">Réservé jeudi 16 h</span>
          </div>
          <div class="record__notes">
            <span class="record__note">Marc Dubois, 0470 12 34 56</span>
            <span class="record__note">Confirmation SMS envoyée</span>
            <span class="record__note">Humeur : détendue</span>
          </div>
        </div>
        <p class="small record__caption">Reçue par e-mail et posée dans votre agenda pendant que l’appelant raccroche, sans une seule saisie de votre part.</p>
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

function wired(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    tone: 'slide--band',
    body: `
    <div class="stack grow" style="justify-content:center">
      <div style="margin-bottom:34px">
        <p class="eyebrow">Intégrations</p>
        <h2 class="h2">Branchée à ce que vous<br>utilisez <i>déjà</i>.</h2>
      </div>
${WIRED.map(
  (g) => `      <div class="wired__group">
        <div class="wired__head">
          <h3 class="h3">${g.label}</h3>
          <p class="body">${g.body}</p>
        </div>
        <div class="wired__items">
${g.items.map((i) => `          <span class="chip${g.lit ? ' chip--lit' : ''}">${i}</span>`).join('\n')}
        </div>
      </div>`
).join('\n')}
      <p class="small" style="margin-top:26px">Ce qui n’est pas dans la liste passe par un webhook. La lecture d’un agenda pendant l’appel, elle, se code : nous ne la ferons pas passer par un relais.</p>
    </div>`,
  });
}

function trades(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    body: `
    <div class="stack grow" style="justify-content:center">
      <div class="head-row" style="margin-bottom:30px">
        <div>
          <p class="eyebrow">Pour qui</p>
          <h2 class="h2">Partout où l’on ne peut pas<br><i>décrocher</i> en travaillant.</h2>
        </div>
        <p class="small head-row__note">Les métiers où elle tourne déjà, et où elle a sa page sur le site.</p>
      </div>
      <div class="trades">
${TRADES.map((t) => `        <span class="trades__item"><span class="dot"></span>${t}</span>`).join('\n')}
      </div>
      <p class="close-line">Le vôtre n’y est pas ? Elle se règle en lui parlant, pas en choisissant un modèle dans une liste.</p>
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
    <div class="head-row" style="margin-bottom:6px">
      <div>
        <p class="eyebrow">${c.eyebrow}</p>
        <h2 class="h2">${c.title}</h2>
      </div>
      <span class="chip chip--lit"><span class="dot"></span>Sans frais d’installation</span>
    </div>
    <div class="steps">
${c.steps
  .map(
    (st, i) => `      <div class="step">
        <span class="step__index">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="h3">${st.title}</h3>
        <p class="step__body">${st.body}</p>
      </div>`
  )
  .join('\n')}
    </div>
    <p class="setup__note" style="margin-top:36px">${c.note}</p>`,
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
  const c = COMMON.cta;
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
        <p class="lead" style="margin-top:24px">${c.lead}</p>
      </div>
      <div>
        <div class="cta__steps">
${c.steps
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

const BUILDERS = [problem, during, call, natural, after, wired, trades, setup, truth, cta];

export const OVERVIEW = { slug: 'presentation', label: LABEL };

export function renderOverviewDeck({ today, cssHref = 'assets/deck.css' }) {
  const total = BUILDERS.length + 1;
  const slides = [cover(today), ...BUILDERS.map((b, i) => b(i + 2, total))];

  return frenchSpacing(
    serifWords(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Qwillio · présentation</title>
<link rel="stylesheet" href="${cssHref}">
</head>
<body>
${slides.join('\n')}
</body>
</html>
`)
  );
}
