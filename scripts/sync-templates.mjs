#!/usr/bin/env node
/**
 * Generates the readable mirrors of the transactional email and SMS copy.
 *
 * The code stays the source of truth: these files exist so the wording can be
 * reviewed without reading TypeScript, and they are regenerated rather than
 * hand-written so they cannot drift into saying something the product does not.
 *
 *   node scripts/sync-templates.mjs           writes the mirrors
 *   node scripts/sync-templates.mjs --check   fails if they are out of date
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const EMAIL_SRC = 'backend/src/services/email-renderers.ts';
const SMS_SRC = 'backend/src/services/sms-templates.ts';

/** Turn an HTML fragment into something a human reads in a diff. */
function textify(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(l => l.trim()).filter(Boolean).join('\n')
    .trim();
}

const EMAILS = [
  ['devis', 'renderQuoteTemplate', "Envoi d'un devis à un prospect"],
  ['relance', 'renderFollowUpTemplate', 'Relance après un appel sans suite'],
  ['bienvenue', 'renderWelcomeTemplate', 'Compte créé'],
  ['bienvenue-essai', 'renderTrialWelcomeTemplate', "Début des 7 jours d'essai"],
  ['essai-bientot-fini', 'renderTrialEndingTemplate', "Avant la fin de l'essai"],
  ['essai-expire', 'renderTrialExpiredTemplate', 'Essai terminé sans conversion'],
  ['rappel-3-mois', 'renderCallback3MonthsTemplate', "Rappel d'un prospect tiède"],
  ['rappel-rdv', 'renderBookingReminderTemplate', 'Avant un rendez-vous pris par l’IA'],
  ['reset-mot-de-passe', 'renderPasswordResetTemplate', 'Demande de réinitialisation'],
  ['replanification', 'renderRescheduleTemplate', 'Rendez-vous déplacé'],
];

const src = readFileSync(join(root, EMAIL_SRC), 'utf8');
const outputs = [];

for (const [slug, fn, when] of EMAILS) {
  const i = src.indexOf(`export function ${fn}`);
  if (i === -1) {
    console.error(`✗ ${fn} introuvable dans ${EMAIL_SRC}`);
    process.exitCode = 1;
    continue;
  }
  // Up to the next exported function, or end of file.
  const next = src.indexOf('\nexport function ', i + 1);
  const body = src.slice(i, next === -1 ? undefined : next);

  const strings = [...body.matchAll(/`([^`]{40,})`/g)].map(m => m[1]);
  const copy = strings.map(textify).filter(Boolean).join('\n\n---\n\n');

  outputs.push([
    join('emails/transactionnels', `${slug}.md`),
    `<!-- source: ${EMAIL_SRC} · ${fn} -->
<!-- Généré par scripts/sync-templates.mjs. Modifier le code, puis relancer. -->

# ${slug}

**Quand** : ${when}
**Code** : \`${EMAIL_SRC}\` · \`${fn}()\`

Les \`\${...}\` sont les variables remplies à l'envoi.

---

${copy || '_(Ce template compose son contenu à partir du gabarit commun ; voir le code.)_'}
`,
  ]);
}

// SMS: one file, the whole object is short enough to read in one go.
const smsSrc = readFileSync(join(root, SMS_SRC), 'utf8');
const smsBody = smsSrc.slice(smsSrc.indexOf('export const smsTemplates'));
outputs.push([
  join('sms/transactionnels', 'tous.md'),
  `<!-- source: ${SMS_SRC} · smsTemplates -->
<!-- Généré par scripts/sync-templates.mjs. Modifier le code, puis relancer. -->

# SMS transactionnels

**Code** : \`${SMS_SRC}\`

Un SMS coûte à l'envoi et se lit en trois secondes. Chaque message dit qui appelle,
pourquoi, et ce qu'il y a à faire. Les \`\${...}\` sont remplis à l'envoi.

\`\`\`ts
${smsBody.trim()}
\`\`\`
`,
]);

let stale = 0;
for (const [rel, content] of outputs) {
  const abs = join(root, rel);
  const current = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  if (current === content) continue;
  stale++;
  if (check) {
    console.error(`✗ ${rel} n'est plus à jour avec le code`);
  } else {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    console.log(`✓ ${rel}`);
  }
}

if (check && stale) {
  console.error(`\n${stale} fichier(s) à regénérer : npm run sync:templates`);
  process.exit(1);
}
if (check) console.log('✓ les miroirs sont à jour');
