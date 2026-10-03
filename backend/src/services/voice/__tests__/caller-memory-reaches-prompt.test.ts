import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ── CE QU'ON SAIT DE L'APPELANT DOIT ARRIVER JUSQU'À LUI ────────────────────
 *
 * `CallerMemory.preferences` était écrit à CHAQUE appel (`mergePreferences`,
 * jusqu'à six entrées) et n'était lu par personne. `email` avait le même sort :
 * renseigné par `persistMemory`, jamais relu. Conséquence entendue au
 * téléphone : l'agent reposait à un habitué les questions dont la réponse
 * était en base depuis des semaines — le premier signe qu'une réceptionniste
 * ne reconnaît pas son interlocuteur.
 *
 * Ce n'était pas UN oubli mais QUATRE, sur la même chaîne :
 *
 *   1. `ClientCall` / Prisma relit la colonne — elle existait, donc étape OK ;
 *   2. `getCallerHistory` la transmet au worker  ← `select` incomplet ;
 *   3. la route `/caller` la sert au worker        ← réponse incomplète ;
 *   4. `storage.historique_appelant` RECONSTRUIT le dictionnaire, donc tout
 *      champ non énuméré est jeté en silence.
 *
 * Les étapes 3 et 4 sont les plus traîtres : le pont peut servir la donnée, le
 * worker peut la demander, et elle disparaît à la reconstruction sans qu'aucune
 * erreur ne soit levée. Un test de comportement sur le prompt ne les attrape
 * pas — seul un test qui lit les SOURCES le fait.
 */

// `__dirname` = <repo>/backend/src/services/voice/__tests__ — mesuré, pas
// supposé. Trois crans pour retrouver `src/`, puis six pour sortir du dépôt du
// pont et entrer dans celui du worker (frères sous Documents).
const race = (p: string) => readFileSync(join(__dirname, '..', '..', '..', p), 'utf8');
const worker = (p: string) =>
  readFileSync(join(__dirname, '..', '..', '..', '..', '..', '..',
                     'qwillio-voice-core', 'src', 'voice_core', p), 'utf8');

describe('les préférences et l\'email de l\'appelant', () => {
  it('sont lus en base, et pas seulement écrits', () => {
    const src = race('services/voice/realtime-context.service.ts');
    const bloc = src.slice(src.indexOf('callerMemory.findFirst'), src.indexOf('callerMemory.findFirst') + 700);
    expect(bloc).toContain('preferences: true');
    expect(bloc).toContain('email: true');
  });

  it('sont servis par la route /caller, que le worker interroge', () => {
    const src = race('routes/voice-core.routes.ts');
    const bloc = src.slice(src.indexOf('router.get(\'/caller\''), src.indexOf('router.get(\'/caller\'') + 2200);
    expect(bloc).toContain('preferences: memoire?.preferences');
    expect(bloc).toContain('email: memoire?.email');
  });

  it('survivent au dictionnaire reconstruit du worker', () => {
    // L'étape la plus silencieuse : `historique_appelant` réénumère les champs
    // un par un. Une clé absente de cette liste est perdue, sans erreur, alors
    // que le pont l'a bien envoyée.
    const src = worker('storage.py');
    const bloc = src.slice(src.indexOf('async def historique_appelant'),
                           src.indexOf('async def historique_appelant') + 1400);
    expect(bloc).toContain('"preferences"');
    expect(bloc).toContain('"email"');
  });

  it('atteignent l\'objet Appelant du prompt', () => {
    const src = worker('agent.py');
    expect(src).toContain('preferences=tuple(h.get("preferences")');
    expect(src).toContain('courriel_connu=h.get("email")');
  });

  it('sont affichés dans le bloc d\'historique, dans les trois langues', () => {
    const src = worker('prompts.py');
    const bloc = src.slice(src.indexOf('def bloc_historique'), src.indexOf('def construire'));
    expect(bloc).toContain('appelant.preferences');
    expect(bloc).toContain('appelant.courriel_connu');
    // Trois langues obligatoires : `_l` exige les trois à l'appel, mais un bloc
    // ajouté plus tard pourrait n'en passer qu'une sans que rien ne le dise.
    const lignesPref = bloc.slice(bloc.indexOf('appelant.preferences'));
    expect(lignesPref).toMatch(/fr|Ce qu'on sait/);
    expect(lignesPref).toMatch(/What we know/);
    expect(lignesPref).toMatch(/Wat we van hem weten/);
  });
});
