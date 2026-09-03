/**
 * La proposition de GROUPE : un seul propriétaire, quatre établissements,
 * un seul document.
 *
 * Ce n'est pas la concaténation des quatre decks. L'argument change de nature :
 * pris séparément, aucun des quatre commerces ne justifie une réceptionniste à
 * lui seul ; pris ensemble, ils la justifient largement, mais une personne ne
 * se partage pas en quatre comptoirs. C'est exactement ce qu'une ligne par
 * maison sur un seul compte sait faire, et c'est le fil du document.
 *
 * Tout ce qui est affirmé ici sur le produit est vérifié dans le code :
 * `ClientPhoneNumber` porte bien un libellé, une phrase d'accueil, une voix,
 * des consignes et un numéro de transfert PAR LIGNE, en surcharge de la
 * configuration du client ; le quota de minutes est compté par COMPTE, donc
 * mutualisé entre les lignes. Ce qui n'existe pas encore, la comparaison
 * chiffrée entre établissements dans le portail, est écrit noir sur blanc dans
 * la planche « Sans détour » plutôt que passé sous silence.
 */

import { BRAND, COMMON, SECTORS } from './content.mjs';
import { frame, head, mark, frenchSpacing, serifWords, eur } from './render.mjs';

const LABEL = 'Groupe, quatre établissements';

const byslug = Object.fromEntries(SECTORS.map((s) => [s.slug, s]));
const CONCESSION = byslug['concession-automobile'];
const PATISSERIE = byslug['patisserie-trompe-loeil'];
const BAR = byslug['bar'];
const PARFUMERIE = byslug['parfumerie'];

/* Les quatre maisons, dans l'ordre où elles apparaissent partout ensuite. */
const HOUSES = [
  { key: 'concession', short: 'La concession', sector: CONCESSION, tint: 'indigo' },
  { key: 'patisserie', short: 'Le laboratoire', sector: PATISSERIE, tint: 'violet' },
  { key: 'bar', short: 'Le bar', sector: BAR, tint: 'deep' },
  { key: 'parfumerie', short: 'La parfumerie', sector: PARFUMERIE, tint: 'lift' },
];

/**
 * Quand chaque téléphone sonne, sur une journée de 8 h à 2 h.
 *
 * Les bornes sont des heures d'ouverture et de coup de feu, pas des mesures :
 * la planche le dit, et le client corrigera de mémoire en les lisant. C'est
 * justement ce qu'on veut qu'il fasse.
 */
const DAY_START = 8;
const DAY_END = 26; // 2 h du matin
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
    house: 'Le laboratoire',
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

/* Les quatre lignes du compte, telles qu'elles se règlent réellement
   (`ClientPhoneNumber` : libellé, accueil, voix, transfert). */
const LINES = [
  {
    house: 'La concession',
    greeting: '« Concession, bonjour. »',
    transfer: 'Vente, atelier ou pièces, selon la demande',
  },
  {
    house: 'Le laboratoire',
    greeting: '« Atelier, bonjour. »',
    transfer: 'Vous, seulement pour un devis à valider',
  },
  {
    house: 'Le bar',
    greeting: '« Le comptoir, bonjour. »',
    transfer: 'Le responsable de salle, après 18 h',
  },
  {
    house: 'La parfumerie',
    greeting: '« Parfumerie, bonjour. »',
    transfer: 'La boutique, hors conseil en cabine',
  },
];

/* Ce qu'elle attrape dans chaque maison : une réplique, un gain. Les répliques
   sont reprises des scénarios de chaque deck, pas réécrites. */
const CATCHES = [
  {
    house: 'La concession',
    line: '« La Golf grise annoncée à 18 900 €, elle est toujours disponible ? »',
    gain: 'Elle propose l’essai, note la reprise, pose le rendez-vous. Votre vendeur ouvre le dossier en sachant.',
  },
  {
    house: 'Le laboratoire',
    line: '« Je voudrais un gâteau qui ressemble à un sac à main, pour le 24. »',
    gain: 'Date, parts, thème, allergies, photo d’inspiration par SMS. Le brief est complet avant que vous ouvriez la fiche.',
  },
  {
    house: 'Le bar',
    line: '« Vous avez de la place vendredi pour quinze personnes ? »',
    gain: 'La demande de groupe est qualifiée et confirmée par SMS sans que personne quitte le comptoir.',
  },
  {
    house: 'La parfumerie',
    line: '« Vous avez encore le coffret en 100 ml ? Et vous faites la gravure ? »',
    gain: 'Le produit est mis de côté à un nom, un créneau conseil est posé. L’appel finit en visite, pas en commande en ligne.',
  },
];

const GROUP_GAINS = [
  {
    title: 'Vous n’êtes plus le standard',
    body:
      'Aujourd’hui, ce qu’aucune des quatre maisons ne sait traiter remonte à vous. Elle filtre, et ce qui vous parvient arrive avec son brief : qui appelle, pour laquelle de vos affaires, et pourquoi.',
  },
  {
    title: 'Les minutes se mutualisent',
    body:
      'Un seul compte, un seul volume de minutes pour les quatre lignes. Le mois creux du laboratoire paie le décembre de la parfumerie, sans que vous ayez à arbitrer.',
  },
  {
    title: 'Une facture, un interlocuteur',
    body:
      'Pas quatre abonnements à suivre ni quatre prestataires à rappeler. Un compte, un contrat, une personne à qui parler quand quelque chose cloche.',
  },
  {
    title: 'La cinquième ligne se règle en une heure',
    body:
      'Ce qui a été appris sur la première maison sert aux suivantes. Un rachat, une deuxième boutique, une ligne saisonnière : c’est un réglage, pas un projet.',
  },
];

const GROUP_TRUTH = [
  ...COMMON.truth.items,
  {
    title: 'Le portail ne compare pas encore vos quatre affaires',
    body:
      'Chaque appel est enregistré, résumé et cherchable, mais le tableau de bord ne met pas encore les quatre établissements côte à côte. Nous le construirons, et vous serez le premier à en avoir besoin : autant que vous le sachiez avant de signer plutôt qu’au premier lundi matin.',
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
      <p class="eyebrow">Proposition &nbsp;·&nbsp; quatre établissements, un seul propriétaire</p>
      <h1 class="display">Quatre maisons.<br>Une seule qui <i>décroche</i>.</h1>
      <p class="lead cover__lead">Une concession, un laboratoire de pâtisserie, un bar, une parfumerie. Quatre lignes, quatre publics, quatre façons de sonner au mauvais moment. Voici ce qu’une seule réceptionniste peut faire pour les quatre.</p>
    </div>
    <div class="cover__meta">
      <span><strong>${BRAND.site}</strong> &nbsp;·&nbsp; ${BRAND.email} &nbsp;·&nbsp; ${BRAND.phone}</span>
      <span>${today}</span>
    </div>`,
  });
}

function problem(n, total) {
  const day = [
    { mark: '9 h 10', text: 'La concession vous appelle : un client demande si la grise est encore là.' },
    { mark: '14 h 30', text: 'Le laboratoire vous appelle : une cliente veut une pièce pour le 24, et personne n’ose annoncer le délai.' },
    { mark: '18 h 45', text: 'La parfumerie vous appelle : on demande si vous faites la gravure.' },
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
        lead:
          'Un gérant peut apprendre quatre métiers. Il ne peut pas tenir quatre comptoirs à la même heure, et c’est pourtant ce que quatre lignes lui demandent tous les jours.',
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
        <p class="eyebrow">Ce que personne ne voit</p>
        <h2 class="h2">Vos quatre téléphones ne sonnent pas<br>aux mêmes <i>heures</i>.</h2>
      </div>
      <p class="small head-row__note">Heures d’ouverture et coups de feu, de mémoire. Corrigez-les, le raisonnement tient quand même.</p>
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
    <p class="close-line">Aucune de vos quatre affaires ne justifie une réceptionniste à elle seule. Les quatre ensemble, oui, mais une personne ne se partage pas en quatre comptoirs.</p>
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

function lines(n, total) {
  return frame({
    n,
    total,
    label: LABEL,
    veil: 'soft',
    body: `
    <div class="stack grow" style="justify-content:center">
    <div class="head-row" style="margin-bottom:26px">
      <div>
        <p class="eyebrow">Comment ça se règle</p>
        <h2 class="h2">Un compte, quatre lignes,<br>quatre <i>réceptionnistes</i>.</h2>
      </div>
      <p class="small head-row__note">Chaque ligne porte sa voix, son accueil, ses consignes et son transfert. Ce qui est commun reste commun.</p>
    </div>
    <div class="lines">
${LINES.map(
  (l) => `      <div class="lines__row">
        <span class="lines__house">${l.house}</span>
        <span class="lines__greeting">${l.greeting}</span>
        <span class="lines__transfer">${l.transfer}</span>
      </div>`
).join('\n')}
    </div>
    <p class="small" style="margin-top:22px;max-width:820px">Un appelant qui compose la concession n’entend jamais parler du bar. Vous, vous n’avez qu’un identifiant, qu’un tableau de bord et qu’un volume de minutes pour les quatre.</p>
    </div>`,
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
        <p class="eyebrow">Un appel en entier, ${s.call.eyebrow.replace('Un appel, ', '')}</p>
        <h2 class="h2">Elle ne note pas la demande.<br>Elle la <i>traite</i>.</h2>
      </div>
      <p class="small head-row__note">L’exemple est pris à la concession, celle où un appel manqué coûte le plus cher.</p>
    </div>
    <div class="chat grow">
${s.call.lines
  .map(
    (l) => `      <div class="bubble bubble--${l.who === 'agent' ? 'agent' : 'caller'}">
        <span class="bubble__who">${l.who === 'agent' ? BRAND.name : 'Client'}</span>${l.text}
      </div>
      ${l.note ? `<p class="chat__note">${l.note}</p>` : '<span></span>'}`
  )
  .join('\n')}
    </div>`,
  });
}

function during(n, total) {
  const items = [
    {
      title: 'Elle sait de quelle maison il s’agit',
      body:
        'Le numéro composé décide de tout : l’accueil, la voix, les règles, le transfert. Elle n’a pas à demander à l’appelant où il croit avoir appelé.',
    },
    {
      title: 'Elle lit le bon agenda',
      body:
        'Un essai à la concession, un créneau conseil à la parfumerie, une table au bar : chaque ligne écrit dans le planning de sa maison.',
    },
    {
      title: 'Elle transfère au bon poste',
      body:
        'L’atelier, le responsable de salle, la boutique, ou vous. Chaque ligne a son numéro de secours, et vous n’êtes plus celui par défaut.',
    },
    {
      title: 'Elle vous briefe avant de vous passer l’appel',
      body:
        'À l’oral et par SMS : qui appelle, pour laquelle de vos affaires, et ce qu’il veut. Vous décrochez en sachant, ou vous ne décrochez pas.',
    },
  ];
  return frame({
    n,
    total,
    label: LABEL,
    veil: 'soft',
    body: `
    <div class="head-row" style="margin-bottom:26px">
      <div>
        <p class="eyebrow">Pendant l’appel</p>
        <h2 class="h2">Quatre lignes, aucune <i>confusion</i>.</h2>
      </div>
      <p class="small head-row__note">Chacune de ces lignes est un réglage du logiciel, pas une intention.</p>
    </div>
    <div class="ladder">
${items
  .map(
    (it, i) => `      <div class="ladder__row">
        <span class="ladder__index">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="h3">${it.title}</h3>
        <p class="body">${it.body}</p>
      </div>`
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
      <p class="small head-row__note">${c.lead}</p>
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
            <span class="record__title">Ligne « La concession »</span>
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
        <p class="small record__caption">La ligne appelée est en tête de fiche : vous savez de quelle maison vient l’appel avant d’avoir lu la première ligne.</p>
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
  const rows = HOUSES.map(({ short, sector }) => {
    const { missed, oneIn, value } = sector.cost;
    const occasions = Math.round((missed * BRAND.weeksPerYear) / oneIn);
    return { short, missed, oneIn, value, lost: occasions * value };
  });
  const total_eur = rows.reduce((sum, r) => sum + r.lost, 0);

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
          <span class="tally__sum">≈ ${eur(total_eur)}</span>
        </div>
      </div>
      <p class="small" style="margin-top:20px;max-width:900px">Hypothèses volontairement basses, sur ${BRAND.weeksPerYear} semaines d’activité. Remplacez chaque ligne par vos chiffres : c’est la structure du calcul qui compte, et elle ne change pas. Aucun de ces montants n’apparaît dans votre comptabilité, puisqu’un appel manqué ne laisse aucune trace.</p>
    </div>`,
  });
}

function setup(n, total) {
  const steps = [
    {
      title: 'On branche une seule maison',
      body: 'Celle qui perd le plus d’appels. Le renvoi se pose en une manipulation, sans changer de numéro.',
    },
    {
      title: 'Sept jours pour écouter',
      body: 'Vous lisez les transcriptions réelles de votre propre ligne, pas une démonstration. On corrige ce qui doit l’être.',
    },
    {
      title: 'On duplique sur les trois autres',
      body: 'Chaque ligne garde sa voix, son accueil et son transfert. Ce qui a été appris sur la première sert aux suivantes.',
    },
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
      <p class="small head-row__note">Quatre choses qu’un commercial vous dirait autrement, et qu’il vaut mieux lire ici que découvrir dans trois mois.</p>
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
    {
      title: 'Un appel de démonstration',
      body: 'Vous l’appelez, configurée pour celle de vos quatre maisons que vous voulez tester. Dix minutes suffisent pour juger.',
    },
    { title: 'Sept jours d’essai sur une ligne', body: 'Votre vrai numéro, vos vraies règles, sans frais d’installation.' },
    { title: 'Les trois autres quand vous le dites', body: 'Une par une ou toutes ensemble. Vous coupez le renvoi quand vous voulez, il n’y a rien à désinstaller.' },
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
        <p class="lead" style="margin-top:24px">On commence par la maison de votre choix, et vous jugez sur ce que vous entendez, pas sur ce qui est écrit dans ces pages.</p>
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

const BUILDERS = [problem, curves, intro, lines, catches, call, during, natural, after, groupGains, tally, setup, truth, cta];

export const GROUP = { slug: 'groupe', label: LABEL };

export function renderGroupDeck({ today, cssHref = 'assets/deck.css' }) {
  const total = BUILDERS.length + 1;
  const slides = [cover(today), ...BUILDERS.map((b, i) => b(i + 2, total))];

  return frenchSpacing(
    serifWords(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Qwillio · proposition de groupe</title>
<link rel="stylesheet" href="${cssHref}">
</head>
<body>
${slides.join('\n')}
</body>
</html>
`)
  );
}
