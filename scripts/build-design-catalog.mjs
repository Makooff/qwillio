#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const tokens = JSON.parse(read('frontend/src/design-system/tokens.json'));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const css = [
  `--qw-control-y:${tokens.control.product.md.paddingY}px`, `--qw-control-x:${tokens.control.product.md.paddingX}px`, `--qw-control-height:${tokens.control.product.md.minHeight}px`, `--qw-control-gap:${tokens.control.gap}px`, `--qw-control-sm-y:${tokens.control.product.sm.paddingY}px`, `--qw-control-sm-x:${tokens.control.product.sm.paddingX}px`, `--qw-control-sm-height:${tokens.control.product.sm.minHeight}px`, `--qw-public-height:${tokens.control.public.minHeight}px`, `--qw-font:${tokens.type.family}`, `--qw-mono:${tokens.type.mono}`, `--qw-primary:${tokens.color.brand.primary}`,
  ...Object.entries(tokens.radius).map(([key, value]) => `--qw-radius-${key}:${value}px`),
].join(';');
const palette = Object.entries(tokens.color.brand).map(([key, value]) => `<div><div class="swatch" style="background:${escape(value)}"></div><p class="colorname">${escape({primary:'Indigo Q',deep:'Profond',violet:'Violet W',lift:'Lift',onDark:'Encre sombre',white:'Blanc de marque'}[key])}</p><code>${escape(value)}</code></div>`).join('');
const spacing = ['1','2','3','4','6','8','12','16'].map(key => `<div class="spacingRow"><code>${key}</code><span class="spacebar" style="--n:${tokens.space[key]}"></span><span>${tokens.space[key]} px</span></div>`).join('');
const radii = ['input','surface','overlay','editorial','editorialMobile','editorialLarge','pill','inset'].map(key => `<div class="radiusItem"><div class="radiusBox" style="--r:${tokens.radius[key]}px"></div><p>${escape({input:'Champ',surface:'Carte produit',overlay:'Overlay',editorial:'Éditorial',editorialMobile:'Grande / mobile',editorialLarge:'Grande / desktop',pill:'Commande',inset:'Puits'}[key])}</p><code>${tokens.radius[key]} px</code></div>`).join('');
const wave = [6,11,8,21,29,17,10,24,35,26,16,9,22,30,18,11,25,33,20,12,9,18,28,20,13,7].map(n => `<i style="--h:${n}px"></i>`).join('');
const output = read('scripts/design-catalog.template.html').replace('/* QWILLIO_TOKENS */',`:root{${css}}`).replace('<!-- QWILLIO_PALETTE -->',palette).replace('<!-- QWILLIO_SPACING -->',spacing).replace('<!-- QWILLIO_RADII -->',radii).replace('<!-- QWILLIO_WAVE -->',wave);
const path = 'docs/design-system/index.html';
let current = ''; try { current = read(path); } catch (error) { if(error.code!=='ENOENT') throw error; }
if (process.argv.includes('--check')) {
  if(current!==output) { console.error('Catalogue à synchroniser : npm run sync:design'); process.exitCode=1; }
  else console.log('Catalogue conforme aux fondations.');
} else { writeFileSync(resolve(root,path),output); console.log(`Catalogue généré : ${path}`); }
