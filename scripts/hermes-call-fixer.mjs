#!/usr/bin/env node
/**
 * hermes-call-fixer — le maillon qui manquait : un appel cassé devient un
 * correctif, sans que Mathieu ait à recopier un transcript dans Hermes.
 *
 * La chaîne, de bout en bout :
 *
 *   fin d'appel ──> `call-postmortem` (backend, toutes les 5 min)
 *                    │  verdict rangé dans `ClientCall.metadata.mortem`
 *                    └─ verdict « broken » ──> `autofix-store`
 *                                               │  empreinte par client + codes
 *                                               │  (dédupliqué : dix appels
 *                                               │   cassés du même client =
 *                                               │   UNE proposition)
 *                                               └─> Discord : approuver / rejeter
 *
 *   CE SCRIPT ──> GET /api/autofix/list?status=approved
 *                  └─ une session Hermes jetable par proposition approuvée
 *                       └─ reproduit, corrige, teste, commit sur une branche
 *                            └─ POST /api/autofix/:id/mark-applied
 *
 * Ce qui n'est PAS automatique, et pourquoi : rien ne part SEUL. Une
 * proposition doit être approuvée dans Discord. `call-postmortem` note chaque
 * appel, mais rien ne réécrit `voice-core` sur un appel bizarre — un agent qui
 * corrige tout seul sur une semaine de données bruitées est la façon dont une
 * réceptionniste qui marche devient une réceptionniste cassée. Le clic sur
 * « approuver » EST la décision ; ce script ne fait que supprimer le travail
 * manuel qui vient après.
 *
 * Usage :
 *   node scripts/hermes-call-fixer.mjs --dry-run        # montre, n'exécute rien
 *   node scripts/hermes-call-fixer.mjs                  # une proposition
 *   node scripts/hermes-call-fixer.mjs --limit 3
 *
 * Variables d'environnement :
 *   QWILLIO_API_URL   défaut https://qwillio-eu.onrender.com
 *   AUTOFIX_TOKEN     le même que côté Render (sans lui, l'API répond 503)
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Les deux dépôts, surchargeables par l'environnement.
 *
 * Les chemins par défaut sont ceux de la machine de Mathieu ; la surcharge
 * existe pour une worktree, une autre machine, et pour pouvoir tester ce script
 * sur deux dépôts jetables plutôt que sur les vrais.
 */
const BRIDGE = process.env.QWILLIO_BRIDGE ?? 'C:/Users/matpo/Documents/qwillio-bridge';
const VOICE_CORE = process.env.QWILLIO_VOICE_CORE ?? 'C:/Users/matpo/Documents/qwillio-voice-core';

/** Les deux dépôts, parce que la moitié des défauts d'appel vit dans le Python. */
const REPOS = [BRIDGE, VOICE_CORE];

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const has = name => args.includes(`--${name}`);

const DRY = has('dry-run');
const LIMIT = Number(flag('limit', '1'));
const API = (flag('api') ?? process.env.QWILLIO_API_URL ?? 'https://qwillio-eu.onrender.com').replace(/\/$/, '');
const TOKEN = flag('token') ?? process.env.AUTOFIX_TOKEN ?? '';
const REPO = flag('repo', BRIDGE);
const PROVIDER = flag('provider');
const MODEL = flag('model');
const TIMEOUT_MIN = Number(flag('timeout', '25'));

function die(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function sh(cmd, cmdArgs, opts = {}) {
  return new Promise(resolve => {
    const child = spawn(cmd, cmdArgs, { ...opts, shell: false, windowsHide: true });
    let out = '';
    child.stdout?.on('data', d => (out += d));
    child.stderr?.on('data', d => (out += d));
    child.on('error', err => resolve({ code: -1, out: String(err) }));
    child.on('close', code => resolve({ code, out }));
  });
}

/**
 * Un dépôt sale = on s'arrête.
 *
 * C'est la règle du handoff, et elle n'est pas négociable : Mathieu travaille
 * dans ces dépôts en même temps que nous. Une session qui corrige sur un arbre
 * de travail modifié commite du travail qui n'est pas le sien, ou écrase le
 * sien au premier `git checkout`. Mieux vaut ne rien faire et le dire.
 *
 * Le refus porte sur les fichiers SUIVIS, pas sur les non suivis : un fichier
 * jamais ajouté (un brouillon, ce handoff lui-même) ne risque rien, et refuser
 * pour ça rendrait le script inutilisable les trois quarts du temps. Il est
 * signalé, et la consigne de commit dit de n'ajouter que les fichiers touchés.
 */
async function preflight() {
  for (const repo of REPOS) {
    if (!existsSync(join(repo, '.git'))) die(`dépôt absent ou non-git : ${repo}`);

    const tracked = await sh('git', ['-C', repo, 'status', '--porcelain', '--untracked-files=no']);
    if (tracked.code !== 0) die(`git status impossible dans ${repo}`);
    if (tracked.out.trim()) {
      die(
        `modifications non commitées dans ${repo} :\n${tracked.out.trim()}\n` +
          'Range-les (ou commite-les) avant de lancer le correcteur — il ne touche pas à un arbre sale.',
      );
    }

    const untracked = await sh('git', ['-C', repo, 'status', '--porcelain', '--untracked-files=all']);
    if (untracked.out.trim()) {
      const names = untracked.out.trim().split('\n').map(l => l.trim()).join(', ');
      console.log(`   ⓘ ${repo.split('/').pop()} : non suivis → ${names}`);
    }
  }
}

function buildPrompt(fix) {
  return `Tu es le correcteur post-appel de Qwillio. Une proposition de correctif a été APPROUVÉE par Mathieu ; tu l'appliques.

## La proposition

- Identifiant : ${fix.id}
- Titre : ${fix.title}
- Risque déclaré : ${fix.riskLevel}
- Empreinte : ${fix.errorFingerprint}

### Ce qui a été mesuré
${fix.errorMessage}

### Contexte de la proposition
${fix.reasoning}
${fix.diff ? `\n### Diff proposé\n\`\`\`diff\n${fix.diff}\n\`\`\`\n` : ''}
## Les deux dépôts

- pont (Node/TS, backend + frontend) : \`${BRIDGE}\`
- cœur vocal (Python, worker LiveKit) : \`${VOICE_CORE}\`

## Méthode — dans cet ordre, et pas un autre

1. **Reproduire AVANT de corriger.** Trouve le transcript de l'appel en base
   (\`ClientCall.transcript\`) et les métriques (\`ClientCall.metadata\`), ou lis les
   transcripts réels déjà figés dans les tests. Une correction écrite sans
   reproduction est une hypothèse déguisée en correctif : c'est la faute que ce
   projet a payée six fois sur l'épellation des noms.
2. **Corriger la CAUSE, pas le symptôme.** Si le défaut vient d'un garde manquant,
   le garde va dans le code, pas dans le prompt (le prompt est une probabilité, le
   code est une certitude).
3. **Écrire le test qui échoue sans la correction**, et le faire passer.
4. **Lancer les tests du périmètre touché**, depuis la racine du dépôt concerné :
   - pont : \`cd backend && npx --no-install tsc --noEmit && npx --no-install vitest run\`
   - cœur vocal : \`.\\.venv\\Scripts\\python.exe -m pytest --basetemp=.pytest-tmp -q\`
5. **Committer sur une branche** \`fix/appel-${fix.id}\`, avec un message qui dit la
   panne et pas le fichier. \`git add\` **uniquement les fichiers que tu as touchés** —
   jamais \`git add -A\`, qui embarquerait les brouillons non suivis du dépôt.

## Interdits — absolus

- **Ne pousse rien, ne merge rien, ne déploie rien.** Tu t'arrêtes au commit local.
  Mathieu approuve le push.
- **Ne touche à aucun fichier \`.env\` / \`.env.local\`.** Jamais.
- **Jamais** \`prisma migrate reset\`, **jamais** \`prisma db push\` contre la
  production, **jamais** \`npm audit fix --force\`.
- Ne « nettoie » pas les gardes de \`tools.py\` ni leurs commentaires : chacune porte
  la panne réelle qui l'a fait naître.
- Si la proposition est fausse, dis-le et arrête-toi. Un correctif refusé avec sa
  raison vaut mieux qu'un correctif appliqué qui ne répare rien.

## Ce que tu rends

Un rapport court : ce que tu as reproduit, ce que tu as changé (fichiers), les tests
lancés et leur résultat réel, le nom de la branche, et ce qui reste à faire côté
humain. Termine par une ligne \`LESSON: <leçon impérative et la preuve>\` ou \`LESSON: NONE\`.
`;
}

function hermesArgs(promptFile) {
  const a = ['chat', '--query-file', promptFile, '--oneshot', '--quiet', '--in', REPO];
  if (PROVIDER) a.push('--provider', PROVIDER);
  if (MODEL) a.push('-m', MODEL);
  return a;
}

async function fetchApproved() {
  const res = await fetch(`${API}/api/autofix/list?status=approved&limit=${LIMIT}`, {
    headers: { 'X-Autofix-Token': TOKEN },
  });
  if (res.status === 503) die('AUTOFIX_TOKEN n\'est pas configuré côté Render : la boucle ne peut pas être lue.');
  if (res.status === 401) die('AUTOFIX_TOKEN refusé : la valeur locale et celle de Render diffèrent.');
  if (!res.ok) die(`lecture des propositions impossible : HTTP ${res.status}`);
  const body = await res.json();
  return (body.fixes ?? []).slice(0, LIMIT);
}

async function markApplied(id, note) {
  const res = await fetch(`${API}/api/autofix/${encodeURIComponent(id)}/mark-applied`, {
    method: 'POST',
    headers: { 'X-Autofix-Token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  return res.ok;
}

async function main() {
  if (!TOKEN && !DRY) die('AUTOFIX_TOKEN manquant (variable d\'environnement ou --token).');

  console.log(`→ propositions approuvées : ${API}`);
  await preflight();
  console.log('✓ les deux dépôts sont propres');

  if (DRY && !TOKEN) {
    console.log('(mode --dry-run sans jeton : la lecture des propositions passe, l\'appel ne part pas)');
  }

  const fixes = await fetchApproved();
  if (!fixes.length) {
    console.log('✓ rien à faire');
    return;
  }

  console.log(`${fixes.length} proposition(s) à appliquer`);

  for (const fix of fixes) {
    console.log(`\n── ${fix.title} (${fix.riskLevel})`);

    const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'qwillio-fix-'));
    const promptFile = join(dir, 'task.md');
    writeFileSync(promptFile, buildPrompt(fix), 'utf8');

    const command = ['hermes', ...hermesArgs(promptFile)];
    if (DRY) {
      // Le seul mode vérifiable sans dépenser un appel de modèle : on montre
      // exactement ce qui partirait. Le prompt, lui, est déjà écrit sur le
      // disque — c'est ce qui permet de le relire avant d'approuver.
      console.log(`   commande : ${command.join(' ')}`);
      console.log(`   prompt   : ${promptFile}`);
      continue;
    }

    console.log(`   session Hermes jetable (${TIMEOUT_MIN} min max)…`);
    const { code, out } = await sh('hermes', hermesArgs(promptFile), {
      cwd: REPO,
      timeout: TIMEOUT_MIN * 60 * 1000,
    });

    console.log(out.trim().split('\n').slice(-40).join('\n'));

    if (code === 0) {
      const marked = await markApplied(fix.id, out.slice(-2000));
      console.log(marked ? '   ✓ marquée appliquée' : '   ⚠ correctif fait mais statut non enregistré');
    } else {
      console.log(`   ✖ session terminée en erreur (code ${code}) — rien n'est marqué, à relire`);
    }
  }
}

main().catch(error => die(error?.stack ?? String(error)));
