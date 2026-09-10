import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (abs: string) =>
  readFileSync(abs, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const back = (rel: string) => read(join(process.cwd(), 'src', rel));
const front = (rel: string) => read(join(process.cwd(), '..', 'frontend', 'src', rel));

/**
 * La connexion Google passe par un CODE, pas par un jeton remis au navigateur.
 *
 * Le flux implicite remet au navigateur un jeton d'accès directement
 * utilisable, ne porte pas de paramètre d'état, et c'est ce que la console
 * Google signale comme vulnérable à l'usurpation.
 */
describe('connexion Google — flux par code', () => {
  it('les deux boutons demandent le flux par code', () => {
    for (const f of ['components/GoogleAuthButton.tsx', 'pages/v2/auth/AuthShell.tsx']) {
      const src = front(f);
      expect(src, f).toMatch(/flow:\s*'auth-code'/);
      expect(src, f).not.toMatch(/flow:\s*'implicit'/);
    }
  });

  it('aucun bouton n\'envoie plus un jeton d\'accès', () => {
    for (const f of ['components/GoogleAuthButton.tsx', 'pages/v2/auth/AuthShell.tsx']) {
      expect(front(f), f).not.toMatch(/tokenResponse\.access_token/);
    }
  });

  it('le serveur échange le code avec le secret client', () => {
    const auth = back('controllers/auth.controller.ts');
    expect(auth).toMatch(/new OAuth2Client\(env\.GOOGLE_CLIENT_ID,\s*env\.GOOGLE_CLIENT_SECRET,\s*'postmessage'\)/);
    expect(auth).toMatch(/getToken\(code\)/);
  });

  it('vérifie l\'audience du jeton d\'identité obtenu', () => {
    // L'échange prouve qu'on détient le secret; l'audience prouve que le jeton
    // rendu nous désigne. Les deux, pas l'un ou l'autre.
    const auth = back('controllers/auth.controller.ts');
    const exchange = auth.search(/getToken\(code\)/);
    const verify = auth.slice(exchange).search(/verifyIdToken\(\{\s*idToken,\s*audience:\s*env\.GOOGLE_CLIENT_ID/);
    expect(verify).toBeGreaterThan(-1);
  });

  it('accepte encore les deux anciennes formes', () => {
    /* Le site et l'API se déploient séparément: retirer les anciens chemins
       maintenant déconnecterait tout le monde pendant l'intervalle où l'un des
       deux est en avance sur l'autre. */
    const auth = back('controllers/auth.controller.ts');
    expect(auth).toMatch(/const \{ credential, access_token, code \} = req\.body/);
    expect(auth).toMatch(/tokeninfo\?access_token=/);
  });
});
