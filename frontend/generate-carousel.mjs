/**
 * Fabrique les quatre visuels du carrousel de l'accueil.
 *
 * Ce ne sont PAS des photographies générées: le registre drenched de la charte
 * est graphique, et une photo de banque d'images sortie d'un générateur est
 * exactement ce qui a été refusé ailleurs sur la page (« trop IA »). Chaque
 * panneau est donc une composition dessinée, à une seule source de lumière,
 * distincte des trois autres par sa GÉOMÉTRIE et non par sa teinte.
 *
 * Le sujet vit au centre: une latte repliée ne montre qu'une bande verticale de
 * 8 px prise au milieu, et un sujet posé sur un bord y donnerait un aplat.
 *
 *   node .gen-carousel.mjs
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const W = 1600, H = 900;
const OUT = new URL('./public/carousel/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const INDIGO = '#7A5FFF', VIOLET = '#CD6BFB', VOID = '#0A0A0A', CARBON = '#161718';

/* Le grain et la vignette, communs aux quatre. Le grain casse le lissé des
   dégradés, qui est ce qui trahit une image faite à la machine; la vignette
   ramène l'oeil au centre, là où la latte coupera. */
const FILM = `
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="7" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.055"/></feComponentTransfer>
  </filter>
  <radialGradient id="vig" cx="50%" cy="50%" r="72%">
    <stop offset="55%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.62"/>
  </radialGradient>`;

const frame = (defs, body) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${FILM}${defs}</defs>
  <rect width="${W}" height="${H}" fill="${VOID}"/>
  ${body}
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.9"/>
</svg>`;

/* ── 1. À PROPOS — la fenêtre ─────────────────────────────────────────────
   Une verrière vue de face, la dernière lumière du jour derrière. Qui, et
   depuis où: un atelier, le soir, personne au premier plan. */
function aPropos() {
  const cols = 5, rows = 4;
  const gw = 720, gh = 470, gx = (W - gw) / 2, gy = (H - gh) / 2 - 30;
  const cw = gw / cols, ch = gh / rows;
  let panes = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // La lumière tombe du bas-centre: les carreaux du bas sont les plus vifs.
      const dx = (c + 0.5) / cols - 0.5, dy = (r + 0.5) / rows;
      const lit = Math.max(0, 1 - Math.hypot(dx * 1.5, dy - 0.92) * 1.45);
      panes += `<rect x="${gx + c * cw + 5}" y="${gy + r * ch + 5}" width="${cw - 10}" height="${ch - 10}"
        fill="url(#sky)" opacity="${(0.16 + lit * 0.84).toFixed(3)}"/>`;
    }
  }
  let bars = '';
  for (let c = 1; c < cols; c++) bars += `<rect x="${gx + c * cw - 3}" y="${gy}" width="6" height="${gh}" fill="${VOID}"/>`;
  for (let r = 1; r < rows; r++) bars += `<rect x="${gx}" y="${gy + r * ch - 3}" width="${gw}" height="6" fill="${VOID}"/>`;

  // La pluie: des traits fins, verticaux, seulement sur les carreaux.
  let rain = '';
  for (let i = 0; i < 90; i++) {
    const x = gx + Math.random() * gw, y = gy + Math.random() * gh, l = 14 + Math.random() * 46;
    rain += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + 2).toFixed(1)}" y2="${(y + l).toFixed(1)}"
      stroke="#fff" stroke-opacity="${(0.05 + Math.random() * 0.1).toFixed(3)}" stroke-width="1.2"/>`;
  }

  return frame(`
    <linearGradient id="sky" x1="0" y1="1" x2="0.25" y2="0">
      <stop offset="0%" stop-color="${INDIGO}"/>
      <stop offset="42%" stop-color="#3A2C7A"/>
      <stop offset="100%" stop-color="${CARBON}"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${INDIGO}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${VOID}" stop-opacity="0"/>
    </linearGradient>`,
    `<g clip-path="none">${panes}</g>
     ${bars}
     ${rain}
     <rect x="${gx - 14}" y="${gy - 14}" width="${gw + 28}" height="${gh + 28}" fill="none" stroke="#2A2C31" stroke-width="10"/>
     <!-- La lumière qui tombe au sol, sous la verrière: c'est elle qui pose la pièce -->
     <path d="M ${gx - 120} ${H} L ${gx + 40} ${gy + gh} L ${gx + gw - 40} ${gy + gh} L ${gx + gw + 120} ${H} Z" fill="url(#floor)"/>
     <rect x="0" y="${H - 118}" width="${W}" height="118" fill="${VOID}" opacity="0.86"/>`);
}

/* ── 2. BLOG — la page ────────────────────────────────────────────────────
   Des lignes d'écriture, une rature, une marge. Aucun mot lisible: un texte
   serait tranché par le repli du panneau, et daterait l'image. */
function blog() {
  /* De la VRAIE écriture, pas des barres arrondies: des rectangles de longueurs
     variables sont le vocabulaire d'un squelette de chargement, et c'est
     exactement ce qu'ils donnaient à lire. Chaque ligne est donc un tracé
     cursif, irrégulier, coupé en mots. Illisible par construction: un texte
     lisible serait tranché par le repli du panneau, et daterait l'image. */
  let seed = 20260902;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

  const bx = 470, bw = 700, top = 200, lh = 52;
  const lines = [0.97, 0.9, 1, 0.74, 0.95, 1, 0.63, 0.92, 0.98, 0.5];

  /** Un mot: des boucles de HAUTEURS très inégales, avec des hampes et des
      jambages. Des sinusoïdes régulières se lisaient comme un motif décoratif,
      pas comme une main qui écrit: c'est l'irrégularité qui fait l'écriture. */
  const word = (x, y, w) => {
    // Chaque mot dérive un peu de sa ligne, comme une main qui n'est pas réglée.
    const drift = (rnd() - 0.5) * 4;
    let d = `M ${x.toFixed(1)} ${(y + drift).toFixed(1)}`;
    let cx = x;
    let up = rnd() > 0.5;
    let i = 0;
    while (cx < x + w) {
      const step = 8 + rnd() * 15;
      // Une lettre sur cinq porte une hampe ou un jambage, deux à trois fois
      // plus haut que le corps: c'est ce qui casse la vague.
      const tall = rnd() < 0.22;
      const amp = (tall ? 20 + rnd() * 16 : 4 + rnd() * 7) * (up ? -1 : 1);
      const y2 = y + drift + (rnd() - 0.5) * 4;
      d += ` C ${(cx + step * (0.2 + rnd() * 0.2)).toFixed(1)} ${(y + drift + amp).toFixed(1)},` +
           ` ${(cx + step * (0.6 + rnd() * 0.25)).toFixed(1)} ${(y + drift + amp).toFixed(1)},` +
           ` ${(cx + step).toFixed(1)} ${y2.toFixed(1)}`;
      cx += step;
      // Deux bosses du même côté de temps en temps: sans cela, l'alternance
      // stricte redonne une vague.
      if (rnd() > 0.28) up = !up;
      i++;
    }
    return d;
  };

  let ink = '';
  lines.forEach((len, i) => {
    const y = top + i * lh;
    const width = bw * len;
    let x = bx;
    // Des mots, séparés par des blancs: c'est le rythme qui fait lire « écrit ».
    while (x < bx + width - 20) {
      const w = 34 + rnd() * 96;
      const draw = Math.min(w, bx + width - x);
      ink += `<path d="${word(x, y, draw)}" fill="none" stroke="#E8E4DE"` +
             ` stroke-opacity="${(0.34 + rnd() * 0.3).toFixed(3)}"` +
             ` stroke-width="${(2.4 + rnd() * 1.4).toFixed(2)}" stroke-linecap="round"/>`;
      x += draw + 14 + rnd() * 20;
    }
  });

  // Le titre: plus gros, plus appuyé, et plus court que les lignes.
  const title = `<path d="${word(bx, top - 78, 300)}" fill="none" stroke="#F7F5F2"
    stroke-opacity="0.92" stroke-width="6" stroke-linecap="round"/>`;

  // La rature: un aller-retour sur la ligne 7, en violet.
  const sy = top + 6 * lh;
  const strike = `<path d="M ${bx - 12} ${sy + 2} C ${bx + 200} ${sy - 6}, ${bx + 320} ${sy + 8}, ${bx + bw * 0.63 + 14} ${sy - 1}
                          C ${bx + 300} ${sy + 6}, ${bx + 160} ${sy - 4}, ${bx - 4} ${sy + 5}"
    fill="none" stroke="${VIOLET}" stroke-opacity="0.9" stroke-width="3.4" stroke-linecap="round"/>`;

  // La marge: trois annotations courtes, de la même main, en indigo.
  let marg = '';
  [1, 5, 8].forEach(i => {
    marg += `<path d="${word(bx - 92, top + i * lh, 58)}" fill="none" stroke="${INDIGO}"
      stroke-opacity="0.78" stroke-width="2.6" stroke-linecap="round"/>`;
  });

  return frame(`
    <linearGradient id="lamp" x1="0.05" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="${INDIGO}" stop-opacity="0.26"/>
      <stop offset="50%" stop-color="${INDIGO}" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="${VOID}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="sheet" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="#1C1D21"/>
      <stop offset="100%" stop-color="#101113"/>
    </linearGradient>`,
    `<rect width="${W}" height="${H}" fill="url(#lamp)"/>
     <rect x="${bx - 150}" y="70" width="${bw + 300}" height="${H - 90}" rx="10" fill="url(#sheet)"/>
     <!-- Le pli central du carnet, une seule arête -->
     <rect x="${bx - 150}" y="70" width="3" height="${H - 90}" fill="#000" opacity="0.5"/>
     <g transform="rotate(-0.8 ${W / 2} ${H / 2}) skewX(-4)">${title}${marg}${ink}${strike}</g>
     <g transform="rotate(-21 ${bx + bw - 60} ${H - 150})">
       <rect x="${bx + bw - 250}" y="${H - 156}" width="250" height="10" rx="5" fill="#26282D"/>
       <rect x="${bx + bw - 250}" y="${H - 156}" width="250" height="4" rx="2" fill="#3A3D44"/>
       <path d="M ${bx + bw} ${H - 156} l 34 5 l -34 5 z" fill="${VIOLET}" opacity="0.92"/>
     </g>`);
}

/* ── 3. CONTACT — le cordon ───────────────────────────────────────────────
   Le fil spiralé d'un combiné, qui traverse le cadre. Le seul des quatre qui a
   le droit d'être littéral: c'est le produit en un objet. */
function contact() {
  const cy = H / 2, coils = 26, span = 1180, x0 = (W - span) / 2;
  let path = '';
  for (let i = 0; i <= coils; i++) {
    const t = i / coils;
    const x = x0 + span * t;
    // L'amplitude enfle au centre et retombe aux bords: le fil s'éloigne.
    const amp = 96 * Math.sin(Math.PI * t) + 26;
    const step = span / coils;
    path += `${i === 0 ? `M ${x} ${cy}` : ''} C ${x + step * 0.28} ${cy - amp}, ${x + step * 0.72} ${cy - amp}, ${x + step} ${cy}` +
            ` C ${x + step * 1.28} ${cy + amp}, ${x + step * 1.72} ${cy + amp}, ${x + step * 2} ${cy}`;
    if (i > coils - 2) break;
  }
  return frame(`
    <linearGradient id="cord" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${INDIGO}" stop-opacity="0"/>
      <stop offset="22%" stop-color="${INDIGO}" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#B79BFF"/>
      <stop offset="78%" stop-color="${VIOLET}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="pool" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${INDIGO}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${INDIGO}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation="16"/>
    </filter>`,
    `<ellipse cx="${W / 2}" cy="${cy}" rx="620" ry="300" fill="url(#pool)"/>
     <!-- L'ombre portée du fil, décalée: elle donne le sol -->
     <path d="${path}" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="26"
       stroke-linecap="round" transform="translate(0 34)" filter="url(#soft)"/>
     <path d="${path}" fill="none" stroke="url(#cord)" stroke-width="19" stroke-linecap="round"/>
     <!-- Le liseré du dessus: une seule source, en haut à gauche -->
     <path d="${path}" fill="none" stroke="#FFFFFF" stroke-opacity="0.30" stroke-width="4"
       stroke-linecap="round" transform="translate(-3 -5)"/>`);
}

/* ── 4. AFFILIATION — le nœud ─────────────────────────────────────────────
   Deux liens noués, chacun sortant par un bord opposé. Le nœud plutôt que la
   poignée de main: la commission est récurrente, elle ne se conclut pas en
   une fois. */
function affiliation() {
  const cx = W / 2, cy = H / 2;
  const a = `M -40 ${cy + 210} C ${cx - 430} ${cy + 120}, ${cx - 250} ${cy - 190}, ${cx - 20} ${cy - 40}
             C ${cx + 210} ${cy + 110}, ${cx + 300} ${cy - 150}, ${W + 40} ${cy - 200}`;
  const b = `M -40 ${cy - 210} C ${cx - 430} ${cy - 120}, ${cx - 250} ${cy + 190}, ${cx - 20} ${cy + 40}
             C ${cx + 210} ${cy - 110}, ${cx + 300} ${cy + 150}, ${W + 40} ${cy + 200}`;
  const strand = (d, grad, w) =>
    `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="${w + 10}" transform="translate(0 26)" filter="url(#soft2)"/>
     <path d="${d}" fill="none" stroke="url(#${grad})" stroke-width="${w}" stroke-linecap="round"/>
     <path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="3" transform="translate(0 -6)"/>`;
  return frame(`
    <linearGradient id="ga" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${INDIGO}" stop-opacity="0"/>
      <stop offset="30%" stop-color="${INDIGO}"/>
      <stop offset="70%" stop-color="${INDIGO}"/>
      <stop offset="100%" stop-color="${INDIGO}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="gb" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${VIOLET}" stop-opacity="0"/>
      <stop offset="30%" stop-color="${VIOLET}"/>
      <stop offset="70%" stop-color="${VIOLET}"/>
      <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="knotglow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8E76FF" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#8E76FF" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft2" x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>`,
    `<ellipse cx="${cx}" cy="${cy}" rx="520" ry="330" fill="url(#knotglow)"/>
     ${strand(a, 'ga', 22)}
     ${strand(b, 'gb', 22)}`);
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
    `<style>html,body{margin:0;background:${VOID}}svg{display:block}</style>${svg}`,
    { waitUntil: 'load' },
  );
  await page.waitForTimeout(250);
  const png = await page.screenshot({ type: 'png' });
  const file = `${OUT}${name}.webp`;
  await sharp(png).webp({ quality: 82 }).toFile(file);
  console.log(name, '->', file);
}

await browser.close();
