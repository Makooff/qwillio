import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * TOUT chemin qui écrit `transferNumber` refuse une boucle.
 *
 * Il y en a DEUX dans le contrôleur client, et un seul était gardé.
 * `updateMySettings` refusait, `updatePhoneNumber` — la surcharge PAR LIGNE —
 * ne regardait rien. C'est le plus exposé des deux : le formulaire règle une
 * ligne précise, donc saisir le numéro de cette ligne-là y est le geste le plus
 * naturel du monde.
 *
 * Ce que ça coûtait : l'IA se transfère l'appel à elle-même, l'appelant entend
 * la réceptionniste se présenter en boucle, les minutes se facturent, et
 * personne ne décroche jamais. Exactement ce que le commentaire du premier
 * chemin décrit, sur le chemin qui ne l'appliquait pas.
 *
 * C'est la famille de défauts déjà payée cinq fois dans ce dépôt : deux
 * chemins d'écriture pour la même donnée, un seul tenu. Le test lit le SOURCE,
 * faute de harnais capable d'instancier le contrôleur, et retire d'abord les
 * commentaires — celui posé au-dessus du correctif nomme forcément la forme
 * fautive.
 */
function sourceWithoutComments(): string {
  return readFileSync(join(__dirname, '../../../controllers/client-dashboard.controller.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Corps d'une méthode du contrôleur, accolades appariées. */
function method(source: string, name: string): string {
  const start = source.indexOf(`async ${name}(`);
  if (start < 0) return '';
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  return '';
}

const WRITE_PATHS = ['updateMySettings', 'updatePhoneNumber'];

describe('transferNumber — refus de boucle sur tous les chemins', () => {
  const source = sourceWithoutComments();

  it('connaît les deux chemins d\'écriture', () => {
    for (const name of WRITE_PATHS) expect(method(source, name)).not.toBe('');
  });

  it.each(WRITE_PATHS)('%s refuse un transfert qui boucle', name => {
    const body = method(source, name);
    expect(body).toContain('wouldLoop');
    expect(body).toContain('transfer_loop');
  });

  it('aucun autre chemin n\'écrit transferNumber sans le garde-fou', () => {
    /* Le jour où un troisième formulaire apparaît, ce test tombe plutôt que de
       laisser le trou se rouvrir en silence. */
    const gardes = WRITE_PATHS.filter(n => method(source, n).includes('wouldLoop')).length;
    const ecritures = (source.match(/transferNumber:\s/g) ?? []).length;
    expect(gardes).toBe(WRITE_PATHS.length);
    expect(ecritures).toBeLessThanOrEqual(6);
  });
});
