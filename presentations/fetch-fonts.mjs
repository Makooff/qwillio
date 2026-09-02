/**
 * Regenere assets/fonts.css: Outfit en base64, embarquee dans la feuille.
 *
 * Les PDF sont rendus par Chromium en local et relus n'importe ou. Une
 * @import vers Google Fonts marcherait le jour du build et laisserait un
 * fichier qui depend du reseau; ici la fonte est DANS le CSS, donc le rendu
 * est le meme hors ligne, et Chromium l'embarque dans le PDF.
 *
 *   node presentations/fetch-fonts.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WEIGHTS = [300, 400, 500, 600, 700];
const SRC = `https://fonts.googleapis.com/css2?family=Outfit:wght@${WEIGHTS.join(';')}&display=swap`;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const css = await (await fetch(SRC, { headers: { 'User-Agent': UA } })).text();

/* Google renvoie DEUX faces par graisse (latin et latin-ext), chacune avec sa
   plage de caracteres. Les deux sont gardees, plage comprise: le francais de
   ces decks contient des ligatures et des accents qui ne vivent pas tous dans
   la meme plage, et n'en embarquer qu'une ferait retomber un mot sur la fonte
   de secours, ce qui se voit. */
const faces = [...css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)].map(([, body]) => ({
  weight: /font-weight:\s*(\d+)/.exec(body)?.[1],
  url: /src:\s*url\(([^)]+)\)/.exec(body)?.[1],
  range: /unicode-range:\s*([^;]+);/.exec(body)?.[1],
}));
if (faces.length !== WEIGHTS.length * 2 || faces.some((f) => !f.weight || !f.url)) {
  throw new Error(`Faces inattendues: ${faces.length}`);
}

const blocks = [];
for (const { weight, url, range } of faces) {
  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  blocks.push(
    `@font-face {\n  font-family: 'Outfit';\n  font-style: normal;\n  font-weight: ${weight};\n` +
      `  font-display: block;\n` +
      (range ? `  unicode-range: ${range};\n` : '') +
      `  src: url(data:font/truetype;base64,${buf.toString('base64')}) format('truetype');\n}`
  );
  process.stdout.write(`Outfit ${weight} (${(buf.length / 1024).toFixed(0)} ko)\n`);
}

const out = join(dirname(fileURLToPath(import.meta.url)), 'assets', 'fonts.css');
writeFileSync(out, `/* Genere par fetch-fonts.mjs, ne pas editer a la main. */\n${blocks.join('\n')}\n`);
process.stdout.write(`Ecrit ${out}\n`);
