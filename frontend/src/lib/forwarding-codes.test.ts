import { describe, it, expect } from 'vitest';
import {
  FORWARDING_CODES, forwardingFor, activationCode, activationLink, cancelLink,
} from './forwarding-codes';

/**
 * Les codes de renvoi d'appel.
 *
 * La page donnait `*21*` à TOUT LE MONDE, y compris au client qui venait de
 * choisir « Si occupé ». Il croyait ne renvoyer que ce qu'il rate et renvoyait
 * tout: son téléphone ne sonnait plus, et rien ne le lui disait.
 */

describe('le code suit le type choisi', () => {
  it('donne un code DIFFÉRENT par type de renvoi', () => {
    /* Le défaut corrigé, en une assertion: quatre choix ne peuvent pas mener au
       même code, sinon le menu ne sert à rien. */
    const codes = Object.values(FORWARDING_CODES).map(c => c.activate);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('compose le numéro dans le code', () => {
    expect(activationCode('busy', '+32 470 11 22 33')).toBe('*67*+32470112233#');
    expect(activationCode('no_answer', '+32470112233')).toBe('*61*+32470112233#');
  });

  it("retombe sur le renvoi total quand rien n'est choisi", () => {
    // Le comportement historique, et le seul défaut sûr: mieux vaut que l'IA
    // prenne tout que de laisser des appels sans personne au bout.
    expect(forwardingFor('').type).toBe('unconditional');
    expect(forwardingFor(null).type).toBe('unconditional');
    expect(forwardingFor('nawak').type).toBe('unconditional');
  });

  it("échappe le dièse, sinon le clavier n'accepte pas le lien", () => {
    /* Un `#` brut dans un `tel:` est lu comme une ancre d'URL et disparaît: le
       code arrive tronqué sur le clavier et le renvoi n'est jamais activé. */
    expect(activationLink('busy', '+32470112233')).toBe('tel:*67*+32470112233%23');
    expect(activationLink('busy', '')).toBeUndefined();
    expect(cancelLink('busy')).toBe('tel:%23%2367%23');
  });
});

describe("ce que le client doit savoir avant de composer", () => {
  it('dit ce que ça FAIT, pas le nom du code', () => {
    // « Renvoi inconditionnel » ne veut rien dire pour un garagiste. « Votre
    // téléphone ne sonne plus » si.
    for (const c of Object.values(FORWARDING_CODES)) {
      expect(c.effect.length).toBeGreaterThan(30);
      expect(c.effect).not.toMatch(/inconditionnel|MMI|GSM/i);
    }
  });

  it("prévient de l'effet de bord qui surprend, sur chaque type", () => {
    /* Chacun a le sien, et c'est ce qui manquait: « si occupé » ne couvre PAS
       l'appel qu'on laisse sonner, et l'appelant tombe sur la messagerie au
       lieu de l'IA. Un client le découvrait en perdant un client. */
    for (const c of Object.values(FORWARDING_CODES)) {
      expect(c.caveat, 'chaque type doit dire ce qui surprend').toBeTruthy();
    }
  });

  it("ne promet pas un renvoi par HORAIRE, qui n'existe pas sur mobile", () => {
    /* Le menu propose « Programmé (hors heures) », mais aucun réseau mobile ne
       sait renvoyer selon l'heure. Promettre l'aurait fait découvrir au premier
       appel de 22 h pris par personne. */
    const prog = FORWARDING_CODES.scheduled;
    expect(prog.caveat).toMatch(/n'existe pas sur un mobile/i);
    expect(prog.effect).not.toMatch(/horaire|heure/i);
  });
});
