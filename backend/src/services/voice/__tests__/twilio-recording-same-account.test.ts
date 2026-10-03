import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';


/**
 * ── LE CLIENT DU TRUNK N'EST PAS CELUI DES APPELS ───────────────────────────
 *
 * Défaut du 03/10, et il a coûté tous les enregistrements : le service
 * utilisait `twilioTrunkClient()` — régional, `ie1`/`dublin`, clé API créée en
 * Irlande — pour créer et relire des enregistrements d'appels. L'hôte régional
 * ne connaît pas les ressources de Programmable Voice du compte, et répondait :
 *
 *     The requested resource /2010-04-01/Accounts/AC2b11ee…/Calls/CA8f62f6…
 *     /Recordings.json was not found
 *
 * Le message accuse le SID, qui était bon — il venait de l'en-tête SIP
 * `X-Twilio-CallSid`. Ce qui était faux, c'est l'ADRESSE.
 *
 * Ce test lit la source et refuse le retour du client régional dans ce fichier.
 * Un test de comportement ne l'attraperait pas : les deux clients exposent la
 * même interface, donc un mock satisfait les deux et le défaut ne se voit
 * qu'en production, sur un 404 qu'on lit comme un problème de données.
 */
describe('le client Twilio des enregistrements', () => {
  it('n\'est pas le client régional du trunk', () => {
    const source = readFileSync(
      join(__dirname, '..', 'twilio-recording.service.ts'),
      'utf8',
    );
    expect(source).toContain('twilioAccountClient');
    expect(source).not.toContain('twilioTrunkClient');
  });

  it('sert le média depuis l\'hôte du compte, pas depuis la région du trunk', () => {
    const source = readFileSync(
      join(__dirname, '..', 'twilio-recording.service.ts'),
      'utf8',
    );
    // L'hôte fixe : un enregistrement vit chez le compte, quel que soit
    // l'endroit où le trunk a été créé.
    expect(source).toContain("return 'https://api.twilio.com';");
    expect(source).not.toContain('api.${edge}.${region}.twilio.com');
  });
});
