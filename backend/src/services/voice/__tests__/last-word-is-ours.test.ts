import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { endCallFarewell } from '../system-prompt';

/**
 * LE DERNIER MOT APPARTENAIT AU MODÈLE, ET IL LE DISAIT EN ANGLAIS (19/09/2026).
 *
 * Relevé à l'horloge de Vapi sur un appel réel:
 *
 *   17:50:55.462  endCall démarre
 *   17:50:59.897  Bot started speaking turn 16  ← aucun transcript
 *   17:51:02.161  Bot stopped speaking turn 16
 *   17:51:02.164  endCall termine (durée propre: 12 ms)
 *
 * Le tour 15 avait déjà dit au revoir en français. Vapi attend que la file de
 * parole se vide avant de raccrocher, et le modèle, toujours connecté, a
 * rempli ces 2,3 secondes avec un tour de plus: « Hello, how can I help
 * you ? », son ouverture par défaut.
 *
 * La règle de langue est posée DEUX fois dans le prompt depuis le 17/09 et
 * elle a échoué les deux fois. 6duosexagesies dit quoi faire alors: ne pas la
 * réécrire une troisième fois au même rang. Ici on ne la réécrit pas du tout,
 * on supprime le TOUR — `endCallMessage` donne à Vapi une dernière phrase à
 * lui, dans la langue du client, et il ne reste plus de silence à meubler.
 */

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const onboarding = stripComments(
  readFileSync(join(__dirname, '../../onboarding.service.ts'), 'utf8'),
);

describe('la dernière phrase est la nôtre', () => {
  it('parle la langue du client, jamais un repli anglais', () => {
    expect(endCallFarewell('fr')).toMatch(/Merci de votre appel/);
    expect(endCallFarewell('nl')).toMatch(/Bedankt voor uw oproep/);
    expect(endCallFarewell('en')).toMatch(/Thank you for calling/);
    /* Le français et le néerlandais ne retombent pas dans la branche
       anglaise, qui est précisément le défaut qu'on ferme. */
    for (const lang of ['fr', 'nl'] as const) {
      expect(endCallFarewell(lang)).not.toMatch(/Thank you|how can I help/i);
    }
  });

  it('vouvoie, comme tout le reste de l\'appel', () => {
    for (const lang of ['fr', 'nl', 'en'] as const) {
      expect(endCallFarewell(lang)).not.toMatch(/\b(tu|toi|ton|ta|tes)\b/i);
    }
  });

  it('part par les DEUX écritures de l\'assistant enregistré', () => {
    /* Ce qui décrit comment l'agent PARLE se pose sur l'assistant enregistré
       par les deux écritures, jamais par une seule: c'est la règle qui a
       coûté le plus cher dans ce dépôt (6vicies, 6unvicies, 6duovicies). */
    const posts = onboarding.match(/endCallMessage: endCallFarewell\(/g) ?? [];
    expect(posts).toHaveLength(2);
    /* Et chacune avec SA langue: la création lit `lang`, la synchronisation
       `syncLang`. Les confondre rejouerait le client flamand repassé en
       anglais à la première sauvegarde (6vicies). */
    expect(onboarding).toMatch(/endCallMessage: endCallFarewell\(lang\)/);
    expect(onboarding).toMatch(/endCallMessage: endCallFarewell\(syncLang\)/);
  });

  it('est SOUMISE à l\'API vivante par `voice:validate`', () => {
    /* CE SCRIPT ÉCRIT SA PROPRE CHARGE, et c'est le piège de 6sexdecies: il
       validait les plans et pas la partie que personne ne relisait. Un champ
       ajouté aux écritures de production sans l'être ici rend un vert qui ne
       veut rien dire — et un champ refusé n'abîme pas un appel, il annule
       l'assistant ENTIER (6octies).
       Par `endCallFarewell` et non par une chaîne recopiée: une copie ne
       vieillirait pas avec l'original, et c'est l'original qui part chez
       Vapi. */
    const probe = stripComments(
      readFileSync(join(__dirname, '../../../scripts/validate-assistant.ts'), 'utf8'),
    );
    expect(probe).toMatch(/endCallMessage: endCallFarewell\(lang\)/);
  });

  it('la synchronisation porte aussi le drapeau qui autorise le raccroché', () => {
    /* `endCallMessage` sans `endCallFunctionEnabled` ne sert à rien: c'est
       l'outil qui déclenche la fin, la phrase ne fait que l'accompagner. */
    expect((onboarding.match(/endCallFunctionEnabled: true/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
