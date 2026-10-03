import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { shouldRecord } from '../realtime-context.service';

/**
 * L'enregistrement, vu du client : une OPTION qui se coche.
 *
 * Le reglage etait accepte en ecriture (`PUT /my-dashboard/settings` lit
 * `body.recordCalls`) depuis sa mise en place, et aucun ecran ne le lisait:
 * le commentaire de l'ecriture le disait deja (« atteignable qu'en ecrivant le
 * JSON brut a la main »). Un client ne peut pas cocher une option que la
 * lecture ne lui rend pas.
 *
 * Ces tests lisent le SOURCE du controleur, comme les autres garde-fous de ce
 * depot: ils n'executent pas la route, ils verifient que les trois maillons
 * (lecture, ecriture, regle) continuent d'exister et de se nommer pareil.
 */

const source = readFileSync(
  join(__dirname, '../../../controllers/client-dashboard.controller.ts'),
  'utf8',
);

describe("l'enregistrement est une option du client, et les trois maillons se repondent", () => {
  it('la lecture rend `recordCalls`', () => {
    /* Sans cette ligne, le portail recoit un objet ou le champ n'existe pas,
       l'interrupteur retombe sur son defaut, et le client croit avoir regle
       quelque chose que le serveur n'a jamais recu. */
    expect(source).toMatch(/recordCalls:\s*shouldRecord\(/);
  });

  it("la lecture passe par `shouldRecord`, pas par une copie de la regle", () => {
    /* `shouldRecord` est deja la fonction qui decide de la notice dite a
       l'appelant ET du demarrage reel de l'enregistrement. Une seconde
       condition ecrite ici divergerait de celle-la au premier reglage ajoute,
       et l'ecran finirait par afficher l'inverse de ce que l'agent annonce. */
    const ligne = source.split('\n').find((l) => l.includes('recordCalls:'));
    expect(ligne).toBeDefined();
    expect(ligne).toContain('shouldRecord(');
    expect(ligne).not.toMatch(/recordCalls:\s*(true|false|Boolean|!!)/);
  });

  it("l'ecriture accepte toujours `recordCalls`", () => {
    /* Le maillon qui existait deja. Si celui-ci tombe, l'interrupteur
       s'affiche, se clique, et ne change rien. */
    expect(source).toMatch(/typeof body\.recordCalls === 'boolean'/);
    expect(source).toMatch(/mergeVapiConfig\([^)]*recordCalls/);
  });

  it('la page du portail porte l\'option, et poste au bon endroit', () => {
    const page = readFileSync(
      join(__dirname, '../../../../../frontend/src/pages/client/ClientAccount.tsx'),
      'utf8',
    );
    // L'ecran existe.
    expect(page).toContain("label=\"Enregistrement des appels\"");
    // Il lit la valeur que le serveur rend.
    expect(page).toMatch(/data\?\.recordCalls/);
    // Et il ecrit sur la route qui l'accepte.
    expect(page).toMatch(/my-dashboard\/settings',\s*\{\s*recordCalls/);
  });
});

describe('la regle elle-meme ne bouge pas', () => {
  it('rien de regle vaut « enregistre » : le defaut sur des deux cotes de la loi', () => {
    expect(shouldRecord({ recordCalls: true })).toBe(true);
    expect(shouldRecord({ recordCalls: false })).toBe(false);
    // Un profil d'avant le champ, encore en cache.
    expect(shouldRecord({ recordCalls: undefined as unknown as boolean })).toBe(true);
  });
});
