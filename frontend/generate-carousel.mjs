/**
 * Fabrique les quatre visuels du carrousel de l'accueil.
 *
 *   node generate-carousel.mjs
 *
 * Deux règles, et elles sont le résultat de deux retours successifs.
 *
 * 1. LE FOND EST GRIS, pas noir. Il vaut #1A1A1A, c'est-à-dire `--q2-obsidian`,
 *    un cran AU-DESSUS de la bande qui porte le carrousel (`--q2-band`, à
 *    #111111 en thème sombre). Un panneau doit être plus clair que la page qui
 *    le tient, sinon il se lit comme un trou et non comme une carte. Le noir
 *    #0A0A0A d'une première version faisait exactement ça.
 *
 * 2. RIEN DE FIGURATIF. La verrière, la page manuscrite, le fil de combiné et
 *    le nœud d'une première version étaient des dessins, et un dessin qui n'est
 *    pas tenu par un illustrateur se lit comme une image d'agrafe. Ce sont
 *    maintenant quatre champs de lumière, distincts par leur GÉOMÉTRIE (d'où
 *    la lumière vient, et comment elle se structure) et jamais par une simple
 *    variation de teinte: quatre dégradés jumeaux seraient la grille de cartes
 *    identiques que la charte interdit.
 *
 * Le sujet vit au centre: une latte repliée ne montre qu'une bande verticale de
 * 8 px prise au milieu, et une composition posée sur un bord y donnerait un
 * aplat.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const W = 1600, H = 900;
const OUT = new URL('./public/carousel/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const INDIGO = '#7A5FFF', VIOLET = '#CD6BFB', DEEP = '#7349FE';
/* La base: `--q2-obsidian`. Voir la règle 1 plus haut. */
const BASE = '#1A1A1A';

/* Le grain casse le lissé des dégradés, qui est ce qui trahit une image faite à
   la machine. La vignette ramène l'oeil au centre, là où la latte coupera. */
const FILM = `
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="11" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
  </filter>
  <radialGradient id="vig" cx="50%" cy="50%" r="78%">
    <stop offset="50%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.42"/>
  </radialGradient>
  <!-- La RÉGION est déclarée, et ce n'est pas décoratif: par défaut un filtre
       ne déborde que de 10 % de la boîte de l'objet, si bien qu'un halo large
       se retrouve tranché net et laisse un rectangle visible autour de lui.
       C'est ce qui cernait le point central et la couture d'une version. -->
  <filter id="blur60" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="60"/></filter>
  <filter id="blur28" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="28"/></filter>
  <filter id="blur14" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>`;

const frame = (defs, body) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${FILM}${defs}</defs>
  <rect width="${W}" height="${H}" fill="${BASE}"/>
  ${body}
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.9"/>
</svg>`;

/* ── 1. À PROPOS ──────────────────────────────────────────────────────────
   Une colonne de lumière qui monte du bas, traversée de strates fines. La
   lumière d'une pièce, à la verticale, sans rien dessiner de la pièce. */
function aPropos() {
  let strata = '';
  for (let i = 0; i < 26; i++) {
    const y = 250 + i * 26;
    const o = 0.10 + Math.max(0, 1 - Math.abs(i - 18) / 16) * 0.20;
    strata += `<rect x="${W / 2 - 470}" y="${y}" width="940" height="2"
      fill="#DCD6FF" opacity="${(o * 1.9).toFixed(3)}"/>`;
  }
  return frame(`
    <linearGradient id="shaft" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="${INDIGO}" stop-opacity="0.80"/>
      <stop offset="45%" stop-color="${DEEP}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${DEEP}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="pool1" cx="50%" cy="100%" r="62%">
      <stop offset="0%" stop-color="${INDIGO}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${INDIGO}" stop-opacity="0"/>
    </radialGradient>`,
    `<ellipse cx="${W / 2}" cy="${H - 30}" rx="820" ry="380" fill="url(#pool1)"/>
     <!-- Large, et non une colonne étroite: la carte ouverte du carrousel est
          BASSE ET LARGE, et une verticale fine s'y perdait dans deux tiers de
          vide. La composition doit tenir dans le cadrage où elle sera vue. -->
     <path d="M ${W / 2 - 560} ${H} L ${W / 2 - 300} 90 L ${W / 2 + 300} 90 L ${W / 2 + 560} ${H} Z"
       fill="url(#shaft)" filter="url(#blur28)"/>
     <g filter="url(#blur14)">${strata}</g>
     <!-- L'arête de la flaque, au sol: c'est elle qui donne une assise à la
          colonne, sans quoi la lumière flotte et l'image reste molle. -->
     <ellipse cx="${W / 2}" cy="${H - 14}" rx="520" ry="40" fill="#B9A8FF" opacity="0.55" filter="url(#blur28)"/>`);
}

/* ── 2. BLOG ──────────────────────────────────────────────────────────────
   Des lignes serrées au centre, longues et fines, qui s'éteignent aux deux
   bouts. Le rythme d'un texte, sans écrire un mot. */
function blog() {
  let rules = '';
  const n = 22;
  for (let i = 0; i < n; i++) {
    const y = 190 + i * 24;
    const t = i / (n - 1);
    // Les longueurs varient comme des lignes de paragraphe, la dernière courte.
    const len = (0.62 + Math.sin(i * 1.7) * 0.16 + (i === n - 1 ? -0.28 : 0)) * W;
    rules += `<rect x="${(W - len) / 2}" y="${y}" width="${len.toFixed(0)}" height="3" rx="1.5"
      fill="url(#rule)" opacity="${(0.30 + Math.sin(t * Math.PI) * 0.55).toFixed(3)}"/>`;
  }
  return frame(`
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#EDE9FF" stop-opacity="0"/>
      <stop offset="28%" stop-color="#EDE9FF" stop-opacity="0.9"/>
      <stop offset="72%" stop-color="#EDE9FF" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#EDE9FF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="wash2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${DEEP}" stop-opacity="0.40"/>
      <stop offset="60%" stop-color="${VIOLET}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${BASE}" stop-opacity="0"/>
    </linearGradient>`,
    `<rect width="${W}" height="${H}" fill="url(#wash2)"/>
     <!-- Une seule ligne tenue, plus haute et plus vive: le titre -->
     <rect x="${W / 2 - 260}" y="120" width="520" height="7" rx="3.5" fill="#FFFFFF" opacity="0.9"/>
     ${rules}`);
}

/* ── 3. CONTACT ───────────────────────────────────────────────────────────
   Des arcs concentriques qui s'éloignent du centre en s'affinant. Un signal
   qui part, ce que fait une ligne quand elle sonne. */
function contact() {
  const cx = W / 2, cy = H / 2;
  let arcs = '';
  for (let i = 1; i <= 9; i++) {
    const r = i * 78;
    arcs += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${(r * 0.62).toFixed(0)}"
      fill="none" stroke="url(#ring)" stroke-width="${(7 - i * 0.6).toFixed(2)}"
      opacity="${(0.9 - i * 0.085).toFixed(3)}"/>`;
  }
  return frame(`
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="0.4">
      <stop offset="0%" stop-color="${INDIGO}" stop-opacity="0.15"/>
      <stop offset="35%" stop-color="#B9A8FF"/>
      <stop offset="65%" stop-color="${VIOLET}"/>
      <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0.15"/>
    </linearGradient>
    <radialGradient id="core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#D8CCFF" stop-opacity="0.95"/>
      <stop offset="40%" stop-color="${INDIGO}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${INDIGO}" stop-opacity="0"/>
    </radialGradient>`,
    `<ellipse cx="${cx}" cy="${cy}" rx="560" ry="360" fill="url(#core)" filter="url(#blur60)"/>
     <g filter="url(#blur14)" opacity="0.55">${arcs}</g>
     ${arcs}
     <circle cx="${cx}" cy="${cy}" r="26" fill="#EFEAFF" opacity="0.95"/>
     <circle cx="${cx}" cy="${cy}" r="26" fill="#FFFFFF" filter="url(#blur28)"/>`);
}

/* ── 4. AFFILIATION ───────────────────────────────────────────────────────
   Deux champs qui se rejoignent au centre et s'y additionnent, indigo d'un
   côté, violet de l'autre. Deux parties, un intérêt commun. */
function affiliation() {
  return frame(`
    <radialGradient id="left" cx="24%" cy="50%" r="46%">
      <stop offset="0%" stop-color="${INDIGO}" stop-opacity="0.95"/>
      <stop offset="45%" stop-color="${DEEP}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${DEEP}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="right" cx="76%" cy="50%" r="46%">
      <stop offset="0%" stop-color="${VIOLET}" stop-opacity="0.95"/>
      <stop offset="45%" stop-color="${VIOLET}" stop-opacity="0.40"/>
      <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
    </radialGradient>`,
    /* Les deux champs se rejoignent AU CENTRE, et c'est là que l'image est la
       plus vive: c'est le recouvrement qui est le sujet. Une version les avait
       repoussés aux deux bords avec une couture blanche au milieu; le centre y
       était devenu gris, or c'est précisément la bande que montre une latte
       repliée, et la latte sortait donc en aplat neutre.
       `screen` et non une superposition simple: deux lumières qui se croisent
       s'ADDITIONNENT, elles ne se cachent pas l'une l'autre. */
    `<g style="mix-blend-mode:screen">
       <rect width="${W}" height="${H}" fill="url(#left)"/>
       <rect width="${W}" height="${H}" fill="url(#right)"/>
     </g>`);
}

const SHEETS = [
  ['a-propos', aPropos()],
  ['blog', blog()],
  ['contact', contact()],
  ['affiliation', affiliation()],
];

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

for (const [name, svg] of SHEETS) {
  await page.setContent(
    `<style>html,body{margin:0;background:${BASE}}svg{display:block}</style>${svg}`,
    { waitUntil: 'load' },
  );
  await page.waitForTimeout(250);
  const png = await page.screenshot({ type: 'png' });
  const file = `${OUT}${name}.webp`;
  await sharp(png).webp({ quality: 82 }).toFile(file);
  console.log(name, '->', file);
}

await browser.close();
