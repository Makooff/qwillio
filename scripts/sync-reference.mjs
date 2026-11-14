#!/usr/bin/env node
/** Synchronise un inventaire factuel, sans prétendre vérifier la production. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const check = process.argv.includes('--check');
const foundations = JSON.parse(read('frontend/src/design-system/tokens.json'));
const getToken = expression => expression.split('.').slice(1).reduce((value, key) => value[key], foundations);
const path = 'docs/REFERENCE-GENEREE.md';
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.map(value => String(value).replaceAll('|', '\\|')).join(' | ')} |`),
].join('\n');
const vars = block => [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
  .map(([, key, value]) => [`\`${key}\``, `\`${value.trim().replace(/\s+/g, ' ')}\``]);
const v2 = stripComments(read('frontend/src/styles/v2.css'));
const light = v2.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
const dark = v2.match(/\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\}/)?.[1];
if (!light || !dark) throw new Error('Blocs de thème V2 introuvables : adapter le générateur à la nouvelle structure.');
const source = stripComments(read('frontend/src/App.tsx'));
const routes = [...source.matchAll(/<Route\b[^>]*?\bpath=["']([^"']+)["']/g)].map(([, path]) => path);
const mounts = [...stripComments(read('backend/src/server.ts')).matchAll(/app\.use\(['"]([^'"]+)['"],\s*(\w+Routes)\)/g)]
  .map(([, path, router]) => [`\`${path}\``, `\`${router}\``]);
const theme = stripComments(read('frontend/src/styles/admin-theme.ts'));
const tokenBlock = theme.match(/export const t = \{([\s\S]*?)\} as const/)?.[1];
if (!tokenBlock || routes.length === 0 || mounts.length === 0) throw new Error('Extraction incomplète : vérifier le générateur.');
const tokens = tokenBlock.split('\n').flatMap(line => {
  const match = line.match(/^\s*(\w+)\s*:\s*(.+)/);
  if (!match) return [];
  const [, key, expression] = match;
  let value;
  if (expression.startsWith("'")) value = expression.match(/^'([^']*)'/)?.[1];
  else if (expression.startsWith('tokens.')) value = getToken(expression.match(/^(tokens\.[\w.]+)/)[1]);
  else if (expression.startsWith('radiusPx(')) value = foundations.radius[expression.match(/radiusPx\('([^']+)'\)/)[1]] + 'px';
  if (value === undefined) throw new Error(`Expression de token non traitée : ${key}. Adapter le générateur.`);
  return [[`\`t.${key}\``, `\`${value}\``]];
});
const exports = [...read('frontend/src/styles/design-system.ts').matchAll(/export (?:const|function) (\w+)/g)].map(([, name]) => `\`${name}\``);
const plans = read('backend/src/config/plans.ts');
const plansBlock = plans.match(/export const PLANS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? '';
const planRows = [...plansBlock.matchAll(/^  ([a-z][\w-]*):\s*\{([\s\S]*?)^  \},?/gm)].map(([, id, body]) => {
  const number = key => body.match(new RegExp(`\\b${key}:\\s*([\\d.]+)`))?.[1] ?? 'non extrait';
  return [id, number('monthlyPriceEur'), number('includedMinutes'), number('overagePerMinuteEur'), number('trialDays')];
});
if (planRows.length === 0) throw new Error('Extraction des forfaits incomplète : adapter le générateur.');
for (const [variable, value] of Object.entries({
  '--q2-indigo': foundations.color.brand.primary,
  '--q2-violet': foundations.color.brand.violet,
  '--q2-deep': foundations.color.brand.deep,
  '--q2-lift': foundations.color.brand.lift,
  '--q2-void': foundations.color.product.canvas,
  '--q2-carbon': foundations.color.product.sidebar,
  '--q2-obsidian': foundations.color.product.hover,
})) {
  const actual = vars(light).find(([name]) => name === `\`${variable}\``)?.[1];
  if (actual?.toLowerCase() !== `\`${value}\``.toLowerCase()) throw new Error(`Fondations et v2.css divergent pour ${variable}. Mettre à jour leurs consommateurs ensemble.`);
}
const foundationTable = table(['Rayon sémantique', 'px'], Object.entries(foundations.radius));
const spacingTable = table(['Clé Tailwind / token', 'px'], Object.entries(foundations.space));
const typeTable = table(['Rôle', 'Taille', 'Graisse', 'Interligne'], Object.entries(foundations.type).filter(([, value]) => typeof value === 'object').map(([key, value]) => [key, value.size, value.weight, value.lineHeight]));
const output = `# Référence générée depuis le code

<!-- Généré par scripts/sync-reference.mjs. Modifier les sources puis npm run sync:reference. -->

Cet inventaire est mécanique : il ne certifie ni les droits d’accès, ni le fonctionnement de bout en bout, ni l’activation en production. Une route ou un export présent n’est pas une promesse commerciale. Les segments enfants doivent être composés avec leur route parente dans App.tsx.

[Charte](../DESIGN.md) · [État fonctionnel](FONCTIONNALITES.md) · [Consignes communes](../AGENTS.md)

## Fondations partagées

Source : [tokens.json](../frontend/src/design-system/tokens.json), consommée par Tailwind et les helpers TypeScript du produit. La charte précise les rôles et l’état d’adoption.

${foundationTable}

${spacingTable}

${typeTable}

## Site V2 : variables par défaut

Source : [v2.css](../frontend/src/styles/v2.css), bloc :root. Les canaux RVB sont conservés tels quels pour les opacités Tailwind.

${table(['Variable', 'Valeur dans le code'], vars(light))}

## Site V2 : substitutions du thème sombre explicite

Source : même fichier, bloc [data-theme='dark']. Le mode système est également défini dans la feuille ; le générateur ne remplace pas un test des trois modes.

${table(['Variable', 'Valeur dans le code'], vars(dark))}

## Portail et administration : tokens t

Source : [admin-theme.ts](../frontend/src/styles/admin-theme.ts). Les valeurs ne définissent pas à elles seules le style de toutes les pages historiques.

${table(['Token', 'Valeur dans le code'], tokens)}

Exports de la couche sémantique [design-system.ts](../frontend/src/styles/design-system.ts) : ${exports.join(', ')}.

## Offre configurée

Source : [plans.ts](../backend/src/config/plans.ts). Vérifier séparément l’alignement Stripe et le parcours de paiement.

${table(['Plan', 'EUR/mois', 'Minutes', 'EUR/min supplémentaire', 'Jours d’essai'], planRows)}

## Déclarations de routes frontend

Source : [App.tsx](../frontend/src/App.tsx). Segments littéraux, dans l’ordre du fichier ; les redirections et routes imbriquées restent à lire dans leur contexte.

${routes.map(path => `- \`${path}\``).join('\n')}

## Points de montage des routeurs backend

Source : [server.ts](../backend/src/server.ts). Cet inventaire vise les montages directs de routeurs nommés *Routes ; il ne recense pas tous les endpoints ni middlewares.

${table(['Préfixe', 'Routeur'], mounts)}
`;
let current = '';
try { current = read(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (check && current !== output) {
  console.error('La référence ne correspond plus au code. Exécuter npm run sync:reference puis relire les documents concernés.');
  process.exitCode = 1;
} else if (!check) {
  writeFileSync(resolve(root, path), output);
  console.log(`Référence synchronisée : ${path}`);
} else console.log('Référence conforme au code.');
