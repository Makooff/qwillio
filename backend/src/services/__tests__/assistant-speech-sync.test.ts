import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Le source SANS ses commentaires.
 *
 * Un test qui lit du source doit parler du CODE. Sans ce nettoyage, la phrase
 * qui explique le défaut le fait rejouer: le commentaire posé juste au-dessus
 * du correctif nomme forcément la forme fautive, et le test tombe sur sa
 * propre explication. C'est arrivé du premier coup en écrivant ce fichier.
 */
const read = (rel: string) =>
  readFileSync(join(process.cwd(), 'src', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Deux défauts de l'assistant ENREGISTRÉ, figés ici (BEL-5 et la langue).
 *
 * Ils partagent une cause: c'est cet assistant-là qui décroche, puisque le
 * numéro entrant épingle son identifiant, et les deux chemins qui l'écrivent
 * avaient chacun leur propre idée de la langue et ignoraient le vocabulaire.
 */
describe('l\'assistant enregistré parle la bonne langue', () => {
  const onboarding = read('services/onboarding.service.ts');

  it('ne décide plus la langue avec un second isFrenchClient', () => {
    // C'était le défaut: la création connaissait le néerlandais, la
    // synchronisation non. Un client flamand repassait donc en ANGLAIS —
    // transcripteur ET voix — à la première sauvegarde d'un réglage.
    // Visé: les deux constructeurs de l'ASSISTANT. Le courriel de bienvenue
    // choisit sa langue ailleurs et pour d'autres raisons — ses gabarits ne
    // couvrent pas le néerlandais, ce qui est un autre sujet que celui-ci.
    expect(onboarding).not.toMatch(/buildVoice\(\{[^}]*isFrenchClient/s);
    expect(onboarding).not.toMatch(/buildRealtimePlans\(\s*this\.isFrenchClient\(client\)/);
  });

  it('lit la langue sur le PROFIL, la même source que l\'appel', () => {
    expect(onboarding).toMatch(/speechProfile\(/);
    expect(onboarding).toMatch(/profile\.language/);
  });

  it('souffle le vocabulaire du client au transcripteur, sur les DEUX écritures', () => {
    // `buildVocabularyField` était construit et testé, et n'était passé qu'à
    // `buildAssistantForCall` — l'assistant qui ne décroche jamais.
    const withVocabulary = onboarding.match(/buildRealtimePlans\([^)]*vocabulary/g) ?? [];
    expect(withVocabulary.length).toBe(2);
  });

  it('n\'appelle plus buildRealtimePlans sans options dans ce fichier', () => {
    // Un troisième chemin d'écriture ajouté demain retomberait dans le même
    // trou sans que rien ne le dise.
    expect(onboarding).not.toMatch(/buildRealtimePlans\([^,)]*\)/);
  });
});
