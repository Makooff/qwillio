import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { endCallFarewell } from '../system-prompt';

/**
 * CE QUI EST FIGÉ NE PEUT PAS DÉPENDRE DU MOMENT.
 *
 * `endCallMessage` est écrit dans l'assistant à la SYNCHRONISATION, des
 * semaines avant l'appel qui l'entendra. Il disait « bonne journée », et un
 * appel du soir du 21/09/2026 s'est terminé ainsi:
 *
 *   modèle: « Bonne soirée à vous. »
 *   Vapi:   « Merci de votre appel. Bonne journée. »
 *
 * Le modèle avait juste, lui: il connaît l'heure. Cette phrase ne la connaît
 * pas. C'est la même raison qui fait passer la date du prompt figé par un
 * gabarit que Vapi remplit plutôt que par une date réelle (6novovicies).
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* Les mots qui nomment un moment, dans les trois langues servies. « soir » et
   « avond » comptent autant que « journée »: une phrase figée qui souhaite une
   bonne soirée a tort toutes les matinées. */
const HOUR_WORDS = /journ[ée]e|soir[ée]e?|matin|good day|great day|good morning|good evening|fijne dag|goede dag|avond|ochtend/i;

describe('la dernière phrase ne connaît pas l\'heure, donc elle ne la nomme pas', () => {
  it('ne souhaite plus une bonne journée, dans aucune des trois langues', () => {
    for (const lang of ['fr', 'en', 'nl'] as const) {
      expect(endCallFarewell(lang)).not.toMatch(HOUR_WORDS);
    }
  });

  it('dit quand même au revoir, et assez longuement pour occuper la file', () => {
    /* Sa raison d'être: Vapi attend que la file de parole se vide avant de
       raccrocher, et le modèle meuble le silence en anglais (6quatersexagesies).
       Une phrase vide rouvrirait ce trou. */
    for (const lang of ['fr', 'en', 'nl'] as const) {
      expect(endCallFarewell(lang).trim().length).toBeGreaterThan(15);
    }
  });

  it("l'autre assistant figé porte la même règle", () => {
    /* Quand une leçon nomme une forme interdite, TOUS les endroits qui
       l'écrivent comptent (6quinquesexagesies): `buildVapiAssistantConfig` a
       son propre `endCallMessage`, et il disait « bonne journée » aussi. */
    const src = stripComments(readFileSync(join(__dirname, '../../../config/vapi-templates.ts'), 'utf8'));
    const block = src.slice(src.indexOf('endCallMessage:'));
    expect(block.slice(0, 200)).not.toMatch(HOUR_WORDS);
  });
});
