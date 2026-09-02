/**
 * Le gabarit : il transforme le contenu en planches.
 *
 * Une fonction par type de planche, et une seule regle a retenir : la mise en
 * page appartient a la feuille de style, le HTML ne porte que la structure.
 * Une valeur de couleur ou une taille ecrite ici serait une valeur que
 * personne ne retrouverait le jour ou la charte bouge.
 */

import { readFileSync } from 'node:fs';
import { BRAND, COMMON, SECTORS } from './content.mjs';

export { SECTORS };

/* Le logo vient de sa SOURCE (DA/logo.md : « la seule definition du trace »),
   il n'est pas redessine ici. Les dimensions fixes du fichier partent, la
   taille est reglee par la classe. */
const LOGO_SVG = readFileSync(new URL('../frontend/public/qwillio-logo-512.svg', import.meta.url), 'utf8')
  .replace(/\s(width|height)="\d+"/g, '')
  .replace(/<\/?svg[^>]*>/g, (tag) => (tag.startsWith('</') ? tag : tag.replace('<svg', '<svg class="mark"')))
  .trim();

const mark = (cls) => LOGO_SVG.replace('class="mark"', `class="${cls}"`);

/* ── Typographie francaise ──────────────────────────────────────────── */

const NBSP = ' ';
const NNBSP = ' ';

/**
 * Pose les espaces insecables du francais (DA/typographie.md).
 *
 * Le texte est decoupe sur les balises avant d'etre traite : une regle
 * appliquee au HTML entier finirait par reecrire un attribut, et une classe
 * cassee ne se voit qu'a l'impression.
 */
export function frenchSpacing(html) {
  return String(html)
    .split(/(<[^>]*>)/)
    .map((chunk, i) => (i % 2 === 1 ? chunk : spaceText(chunk)))
    .join('');
}

function spaceText(t) {
  return (
    t
      .replace(/ +:/g, `${NBSP}:`)
      .replace(/ +([;!?])/g, `${NNBSP}$1`)
      .replace(/« +/g, `«${NNBSP}`)
      .replace(/ +»/g, `${NNBSP}»`)
      /* « 15 h 30 » est un seul bloc : couper apres le « h » en fin de ligne
         donnerait une heure orpheline. */
      .replace(/(\d) h (\d)/g, `$1${NBSP}h${NBSP}$2`)
      .replace(/(\d) +(€|%|km|ml|kg|h\b|min\b|s\b)/g, `$1${NBSP}$2`)
      /* Separateur de milliers, sauf a l'interieur d'un numero de telephone
         (un groupe suivi d'un autre groupe de chiffres). */
      .replace(/\b(\d{1,3}) (\d{3})\b(?! ?\d)/g, `$1${NBSP}$2`)
  );
}

/* `toLocaleString` sépare les milliers par une espace fine, invisible aux
   tailles d'affichage du deck. Elle est remplacée par une insécable
   normale, comme partout ailleurs dans les textes. */
/**
 * Le mot en serif italique des titres.
 *
 * Le contenu le note `<i>`, qui est court a ecrire et se relit ; la charte,
 * elle, demande une fonte serif ET la couleur de marque (DA/typographie.md).
 * Sans cette conversion, le navigateur se contente d'incliner Outfit, ce qui
 * donne un faux italique gris : l'effet passe inapercu, et c'est exactement
 * ce qu'il ne doit pas faire.
 */
const serifWords = (html) =>
  String(html)
    /* Un mot en italique suivi d'un point laisse un blanc : la chasse de
       l'italique compte le debord du jambage, que la ponctuation droite ne
       reprend pas. Le cas est repere ici, ou l'on voit ce qui suit le mot,
       et corrige par une classe. */
    .replace(/<i>([\s\S]*?)<\/i>(?=[.,;:!?])/g, '<span class="serif serif--tight">$1</span>')
    .replace(/<i>/g, '<span class="serif">')
    .replace(/<\/i>/g, '</span>');

const eur = (n) => `${n.toLocaleString('fr-FR').replace(/\u202F/g, NBSP)} €`;

/* ── Ossature d'une planche ─────────────────────────────────────────── */

function frame({ n, total, label, tone = '', veil = '', body, foot = true }) {
  return `
<section class="slide${tone ? ` ${tone}` : ''}">
  ${veil ? `<div class="veil veil--${veil}"></div>` : ''}
  <div class="slide__body">
${body}
  </div>
  ${
    foot
      ? `<div class="slide__foot">
    <span class="slide__foot-left">${mark('mark')}<span>${BRAND.name} &nbsp;·&nbsp; ${label}</span></span>
    <span class="slide__num">${String(n).padStart(2, '0')} / ${total}</span>
  </div>`
      : '<div class="slide__foot"></div>'
  }
</section>`;
}

/* Bloc de titre gauche, commun a la moitie des planches. */
const head = ({ eyebrow, title, lead, muted = false }) => `
      <div>
        <p class="eyebrow${muted ? ' eyebrow--muted' : ''}">${eyebrow}</p>
        <h2 class="h2">${title}</h2>
        ${lead ? `<p class="lead" style="margin-top:22px">${lead}</p>` : ''}
      </div>`;

/* ── 01. Couverture ─────────────────────────────────────────────────── */

function cover(s, today) {
  return frame({
    label: s.label,
    tone: 'cover',
    veil: 'lilac',
    foot: false,
    body: `
    <div class="lockup">${mark('lockup__mark')}<span class="lockup__word">${BRAND.name}</span></div>
    <div class="cover__mid">
      <p class="eyebrow">Réceptionniste IA &nbsp;·&nbsp; ${s.label}</p>
      <h1 class="display">${s.cover.title}</h1>
      <p class="lead cover__lead">${s.cover.lead}</p>
    </div>
    <div class="cover__meta">
      <span><strong>${BRAND.site}</strong> &nbsp;·&nbsp; ${BRAND.email} &nbsp;·&nbsp; ${BRAND.phone}</span>
      <span>${today}</span>
    </div>`,
  });
}

/* ── 02. Le probleme ────────────────────────────────────────────────── */

function pain(s, n, total) {
  return frame({
    n,
    total,
    label: s.label,
    veil: 'soft',
    body: `
    <div class="split split--45">
      ${head({ eyebrow: s.pain.eyebrow, title: s.pain.title, lead: s.pain.lead })}
      <div class="timeline">
${s.pain.steps
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

/* ── 03. Le calcul ──────────────────────────────────────────────────── */

function cost(s, n, total) {
  const { missed, oneIn, value, valueLabel, outcome } = s.cost;
  const opportunities = Math.round((missed * BRAND.weeksPerYear) / oneIn);
  const lost = opportunities * value;

  return frame({
    n,
    total,
    label: s.label,
    tone: 'slide--band',
    body: `
    <div class="stack grow" style="justify-content:center">
    ${head({
      eyebrow: 'Ce que ça coûte déjà',
      title: 'Un appel manqué ne laisse aucune trace<br>dans vos <i>comptes</i>.',
    })}
    <div class="calc">
      <div class="calc__cell">
        <div class="calc__value">${missed}</div>
        <p class="calc__label">appels manqués par semaine, une hypothèse basse</p>
      </div>
      <div class="calc__cell">
        <div class="calc__value">1<span class="calc__unit"> sur ${oneIn}</span></div>
        <p class="calc__label">${outcome} si quelqu’un avait décroché</p>
      </div>
      <div class="calc__cell">
        <div class="calc__value">${eur(value)}</div>
        <p class="calc__label">${valueLabel}</p>
      </div>
    </div>
    <div class="result">
      <div class="result__num">≈ <em>${eur(lost)}</em> par an</div>
      <p class="result__text">${missed} appels manqués par semaine, sur ${BRAND.weeksPerYear} semaines d’activité, soit ${opportunities} occasions perdues dans l’année à ${eur(value)} pièce. Ce montant ne figure sur aucune ligne de votre comptabilité, et c’est bien le problème.</p>
    </div>
    <p class="small" style="margin-top:18px">Chiffres d’illustration. Remplacez-les par les vôtres : la structure du calcul, elle, ne change pas.</p>
    </div>`,
  });
}

/* ── 04. Qwillio ────────────────────────────────────────────────────── */

function intro(s, n, total) {
  const c = COMMON.intro;
  return frame({
    n,
    total,
    label: s.label,
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

/* ── 05. La conversation ────────────────────────────────────────────── */

function call(s, n, total) {
  return frame({
    n,
    total,
    label: s.label,
    body: `
    <div style="margin-bottom:26px">
      <p class="eyebrow">${s.call.eyebrow}</p>
      <h2 class="h2">${s.call.title}</h2>
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

/* ── 06. Pendant l'appel ────────────────────────────────────────────── */

function during(s, n, total) {
  return frame({
    n,
    total,
    label: s.label,
    veil: 'soft',
    body: `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:48px;margin-bottom:26px">
      <div>
        <p class="eyebrow">${s.during.eyebrow}</p>
        <h2 class="h2">${s.during.title}</h2>
      </div>
      <p class="small" style="max-width:250px;text-align:right">Chacune de ces lignes est une action du logiciel, pas une intention.</p>
    </div>
    <div class="ladder">
${s.during.items
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

/* ── 07. Au naturel ─────────────────────────────────────────────────── */

function natural(s, n, total) {
  const c = COMMON.natural;
  return frame({
    n,
    total,
    label: s.label,
    body: `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:48px;margin-bottom:24px">
      <div>
        <p class="eyebrow">${c.eyebrow}</p>
        <h2 class="h2">${c.title}</h2>
      </div>
      <p class="small" style="max-width:280px;text-align:right">${c.lead}</p>
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

/* ── 08. Apres l'appel ──────────────────────────────────────────────── */

function after(s, n, total) {
  const c = COMMON.after;
  return frame({
    n,
    total,
    label: s.label,
    body: `
    <div class="split split--55">
      <div class="stack" style="justify-content:center">
        <p class="eyebrow eyebrow--muted" style="margin-bottom:14px">La fiche d’appel</p>
        <div class="record">
        <div class="record__head">
          <span class="record__title">${s.call.eyebrow}</span>
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
${s.record.lines.map((l) => `          <span class="record__note">${l}</span>`).join('\n')}
        </div>
        </div>
        <p class="small" style="margin-top:16px;max-width:520px">Reçue par e-mail et posée dans votre agenda pendant que l’appelant raccroche, sans une seule saisie de votre part.</p>
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

/* ── 09. Mise en route ──────────────────────────────────────────────── */

function setup(s, n, total) {
  const c = COMMON.setup;
  return frame({
    n,
    total,
    label: s.label,
    veil: 'soft',
    body: `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:48px;margin-bottom:6px">
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

/* ── 10. Ce que ca change ───────────────────────────────────────────── */

function gains(s, n, total) {
  return frame({
    n,
    total,
    label: s.label,
    body: `
    <div style="margin-bottom:4px">
      <p class="eyebrow">${s.gains.eyebrow}</p>
      <h2 class="h2">${s.gains.title}</h2>
    </div>
    <div class="quad">
${s.gains.items
  .map(
    (it) => `      <div class="quad__cell">
        <div class="quad__head"><span class="dot"></span><h3 class="h3">${it.title}</h3></div>
        <p class="quad__body">${it.body}</p>
      </div>`
  )
  .join('\n')}
    </div>
    <p class="close-line">${s.closeLine}</p>`,
  });
}

/* ── 11. Sans detour ────────────────────────────────────────────────── */

function truth(s, n, total) {
  const c = COMMON.truth;
  return frame({
    n,
    total,
    label: s.label,
    tone: 'slide--dark',
    body: `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:56px">
      <div>
        <p class="eyebrow">${c.eyebrow}</p>
        <h2 class="h2">${c.title}</h2>
      </div>
      <p class="small" style="max-width:330px;text-align:right;color:var(--fog)">${c.lead}</p>
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

/* ── 12. Prochaine etape ────────────────────────────────────────────── */

function cta(s, n, total) {
  const c = COMMON.cta;
  return frame({
    n,
    total,
    label: s.label,
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

/* ── Le deck ────────────────────────────────────────────────────────── */

const BUILDERS = [pain, cost, intro, call, during, natural, after, setup, gains, truth, cta];

export function renderDeck(sector, { today, cssHref = 'assets/deck.css' }) {
  const total = BUILDERS.length + 1;
  const slides = [cover(sector, today), ...BUILDERS.map((b, i) => b(sector, i + 2, total))];

  return frenchSpacing(serifWords(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Qwillio · ${sector.label}</title>
<link rel="stylesheet" href="${cssHref}">
</head>
<body>
${slides.join('\n')}
</body>
</html>
`));
}
