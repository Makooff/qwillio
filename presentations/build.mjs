/**
 * Genere les PDF : un par metier, dans chaque format.
 *
 *   node presentations/build.mjs            tout
 *   node presentations/build.mjs bar        un seul metier
 *   node presentations/build.mjs --a4       un seul format
 *   node presentations/build.mjs --png      en plus, une image par planche
 *
 * Le rendu passe par Chromium en mode impression : c'est le seul moteur
 * disponible ici qui sache la grille CSS et les polices embarquees, et le
 * format de page vient de la feuille (@page), pas de la ligne de commande.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { renderDeck, SECTORS } from './render.mjs';
import { renderGroupDeck, GROUP } from './group.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(HERE, 'build');
const PDF = join(HERE, 'pdf');

/* Chromium est fourni par l'image (Playwright), il n'est pas telecharge. */
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium';

const FLAGS = [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--no-pdf-header-footer',
  '--disable-dbus',
  /* Les polices sont en data: dans la feuille, donc rien a attendre du
     reseau. Le budget couvre la mise en page, pas un chargement. */
  '--virtual-time-budget=3000',
];

/**
 * Les deux formats livres.
 *
 * `shot` est la taille de fenetre des images de relecture : Chromium reserve
 * 87 px de barre invisible en mode headless, donc la hauteur demandee est
 * celle de la planche PLUS cette barre, faute de quoi le bas est rogne.
 */
const FORMATS = [
  { id: '16-9', label: '16:9', css: '../assets/deck.css', suffix: '', shot: [1280, 807] },
  { id: 'a4', label: 'A4', css: '../assets/deck-a4.css', suffix: '-a4', shot: [794, 1210] },
];

const today = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());
const args = process.argv.slice(2);
const wantPng = args.includes('--png');
const askedFormats = FORMATS.filter((f) => args.includes(`--${f.id}`));
const formats = askedFormats.length ? askedFormats : FORMATS;
const only = args.filter((a) => !a.startsWith('--'));

/* La proposition de groupe est un document a part : meme charte, meme
   contenu de base, mais un recit qui lui est propre (un proprietaire, quatre
   maisons). Elle se demande par son slug comme un metier. */
const ALL = [...SECTORS, GROUP];
const targets = only.length ? ALL.filter((s) => only.includes(s.slug)) : ALL;
if (!targets.length) {
  console.error(`Document inconnu. Disponibles : ${ALL.map((s) => s.slug).join(', ')}`);
  process.exit(1);
}

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });
mkdirSync(PDF, { recursive: true });

const chrome = (extra) => execFileSync(CHROME, [...FLAGS, ...extra], { stdio: ['ignore', 'ignore', 'pipe'] });

for (const format of formats) {
  for (const sector of targets) {
    const name = `${sector.slug}${format.suffix}`;
    const html =
      sector === GROUP
        ? renderGroupDeck({ today, cssHref: format.css })
        : renderDeck(sector, { today, cssHref: format.css });
    const htmlPath = join(BUILD, `${name}.html`);
    writeFileSync(htmlPath, html);

    const pdfPath = join(PDF, `qwillio-${name}.pdf`);
    chrome([`--print-to-pdf=${pdfPath}`, `file://${htmlPath}`]);
    console.log(`${format.label.padEnd(4)} ${sector.label} → ${pdfPath.replace(`${HERE}/`, '')}`);

    if (wantPng) {
      /* Une planche par image, pour relire la mise en page sans ouvrir le
         PDF. Le document est redecoupe sur ses <section> plutot que capture
         d'un seul bloc : une capture pleine hauteur ne se relit pas. */
      const shots = join(BUILD, 'png', name);
      mkdirSync(shots, { recursive: true });
      const headEnd = html.indexOf('<body>') + '<body>'.length;
      const headHtml = html.slice(0, headEnd).replace('../assets/', '../../../assets/');
      const sections = html.slice(headEnd).split('<section ').slice(1);
      sections.forEach((sec, i) => {
        const page = join(shots, `${String(i + 1).padStart(2, '0')}.html`);
        writeFileSync(
          page,
          `${headHtml}<style>.slide{margin:0!important;box-shadow:none!important}</style><section ${
            sec.split('</section>')[0]
          }</section></body></html>`
        );
        chrome([
          `--window-size=${format.shot[0]},${format.shot[1]}`,
          '--hide-scrollbars',
          `--screenshot=${page.replace('.html', '.png')}`,
          `file://${page}`,
        ]);
      });
      console.log(`     ${sections.length} images dans ${shots.replace(`${HERE}/`, '')}`);
    }
  }
}
