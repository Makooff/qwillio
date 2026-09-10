import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) =>
  readFileSync(join(process.cwd(), 'src', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Un jeton d'accès Google ne prouve pas POUR QUI il a été délivré.
 *
 * `userinfo` répond à « à qui appartient ce jeton ». Sans vérifier l'audience,
 * on acceptait n'importe quel jeton Google, y compris celui d'une autre
 * application: son détenteur se connectait sous l'identité de la victime, sans
 * jamais avoir eu le moindre accès à Qwillio.
 */
describe('connexion Google — le jeton doit nous être destiné', () => {
  const auth = read('controllers/auth.controller.ts');

  it('interroge tokeninfo avant de lire le profil', () => {
    expect(auth).toMatch(/tokeninfo\?access_token=/);
    const tokenInfo = auth.search(/tokeninfo\?access_token=/);
    const userInfo = auth.search(/oauth2\/v3\/userinfo/);
    expect(tokenInfo).toBeGreaterThan(-1);
    expect(userInfo).toBeGreaterThan(tokenInfo);
  });

  it('compare l\'audience à NOTRE identifiant client', () => {
    expect(auth).toMatch(/tokenInfo\.aud\s*!==\s*env\.GOOGLE_CLIENT_ID/);
  });

  it('refuse quand notre identifiant client est absent', () => {
    // Sans identifiant configuré, une comparaison laxiste laisserait passer
    // tous les jetons: le vide ne doit jamais valoir « tout le monde ».
    expect(auth).toMatch(/!env\.GOOGLE_CLIENT_ID\s*\|\|/);
  });
});

describe('branchement Gmail — le state est signé, pas devinable', () => {
  const gmail = read('services/agent-email.service.ts');

  it('ne renvoie plus l\'identifiant du locataire en clair', () => {
    // `state: clientId` est connu ou devinable, ne change jamais, et n'est lié
    // à aucune session: il n'empêche donc pas ce que le state existe pour
    // empêcher.
    expect(gmail).not.toMatch(/state:\s*clientId/);
  });

  it('signe le state et le borne dans le temps', () => {
    expect(gmail).toMatch(/state:\s*jwt\.sign/);
    expect(gmail).toMatch(/expiresIn/);
  });

  it('vérifie le state au retour au lieu de le lire', () => {
    expect(gmail).toMatch(/verifyOAuthState/);
    expect(gmail).toMatch(/jwt\.verify/);
  });
});
