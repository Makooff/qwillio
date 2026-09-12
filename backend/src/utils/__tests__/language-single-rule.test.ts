import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * UNE règle de langue pour ce qui décide de l'APPEL.
 *
 * Le profil d'appel, la synchronisation de l'assistant enregistré et les
 * routes de voix du portail portaient chacun leur propre lecture de
 * `agentLanguage` + pays, et l'une d'elles laissait le pays renverser un
 * choix explicite: un client belge ne pouvait jamais passer son agent en
 * anglais depuis ses paramètres. Ces fichiers passent désormais par
 * `clientLocale`, et ce test empêche qu'une liste de pays y soit recopiée.
 *
 * Les commentaires sont retirés avant la lecture: celui posé au-dessus d'un
 * correctif nomme forcément la forme fautive (6vicies).
 */
const ROOT = join(__dirname, '..', '..');
const FILES = [
  'services/voice/realtime-context.service.ts',
  'services/onboarding.service.ts',
  'controllers/client-dashboard.controller.ts',
  'services/stripe.service.ts',
];

function code(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('la langue de l\'agent a une seule règle', () => {
  for (const rel of FILES) {
    it(`${rel} ne recopie pas de liste de pays`, () => {
      expect(code(rel)).not.toMatch(/\[\s*'FR'\s*,\s*'BE'/);
    });
    it(`${rel} importe client-locale`, () => {
      expect(code(rel)).toMatch(/from '(\.\.\/)+utils\/client-locale'/);
    });
  }

  it('aucun chemin de création ne pose la langue en dur sur un vrai client', () => {
    /* Les comptes de test (`server.ts` bootstrap, `admin.routes.ts`
       test-activate) restent en anglais à dessein: ce sont des comptes de
       démonstration nommés Ashley. Les deux chemins qui créent un CLIENT
       réel passent par `signupAgentLanguage`. */
    expect(code('services/stripe.service.ts')).toMatch(/agentLanguage:\s*signupAgentLanguage\(/);
    expect(code('services/admin-clients.service.ts')).toMatch(/agentLanguage:\s*signupAgentLanguage\(/);
  });
});
