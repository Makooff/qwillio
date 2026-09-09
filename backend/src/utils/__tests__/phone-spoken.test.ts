import { describe, it, expect } from 'vitest';
import { parseSpokenPhone } from '../phone-spoken';

/**
 * Les neuf préfixes principaux, dictés dans les deux groupements.
 *
 * Un fixe belge fait NEUF chiffres, un mobile dix: un normaliseur français,
 * câblé sur cinq paires, ne peut structurellement pas les lire. Et le
 * groupement à trois chiffres de Bruxelles (« zéro deux, cinq cent douze… »)
 * n'existe pas dans le graphe français.
 */
describe('parseSpokenPhone — les gabarits belges', () => {
  const belgian: Array<[string, string, string]> = [
    ['Bruxelles, groupé par trois', 'zéro deux cinq cent douze trente-quatre cinquante-six', '+3225123456'],
    ['Bruxelles, chiffre à chiffre', 'zéro deux cinq un deux trois quatre cinq six', '+3225123456'],
    ['Anvers', 'zéro trois deux cent trente-quatre cinquante-six septante-huit', '+3232345678'],
    ['Gand', 'zéro neuf deux cent vingt-trois quarante-cinq soixante-sept', '+3292234567'],
    ['Liège', 'zéro quatre deux cent vingt-trois quarante-cinq soixante-sept', '+3242234567'],
    ['Namur', 'zéro huitante et un vingt-trois quarante-cinq soixante-sept', '+3281234567'],
    ['Charleroi', 'zéro septante-et-un vingt-trois quarante-cinq soixante-sept', '+3271234567'],
    ['Courtrai', 'zéro cinquante-six vingt-trois quarante-cinq soixante-sept', '+3256234567'],
    ['mobile Proximus', 'zéro quatre septante-cinq douze trente-quatre cinquante-six', '+32475123456'],
    ['mobile, chiffre à chiffre', 'zéro quatre huit six douze trente-quatre cinquante-six', '+32486123456'],
  ];

  for (const [label, said, expected] of belgian) {
    it(`${label}: « ${said} »`, () => {
      const r = parseSpokenPhone(said, { country: 'BE' });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.e164).toBe(expected);
    });
  }

  it('distingue un mobile d\'un fixe, ce qui décide du canal de rappel', () => {
    const mobile = parseSpokenPhone('zéro quatre septante-cinq douze trente-quatre cinquante-six', { country: 'BE' });
    const fixe = parseSpokenPhone('zéro deux cinq cent douze trente-quatre cinquante-six', { country: 'BE' });
    expect(mobile.ok && mobile.kind).toBe('mobile');
    expect(fixe.ok && fixe.kind).toBe('fixed');
  });

  it('relit le numéro dans sa forme nationale, pas en E.164', () => {
    const r = parseSpokenPhone('zéro quatre septante-cinq douze trente-quatre cinquante-six', { country: 'BE' });
    // « plus trente-deux quatre cent septante-cinq » ne se relit pas au
    // téléphone: c'est la forme nationale qu'un appelant reconnaît.
    expect(r.ok && r.national.replace(/\s/g, '')).toBe('0475123456');
  });
});

describe('parseSpokenPhone — France et international', () => {
  it('lit un mobile français dicté à la française', () => {
    const r = parseSpokenPhone('zéro six douze trente-quatre cinquante-six soixante-dix-huit', { country: 'FR' });
    expect(r.ok && r.e164).toBe('+33612345678');
  });

  it('lit le même numéro dicté à la belge', () => {
    const r = parseSpokenPhone('zéro six douze trente-quatre cinquante-six septante-huit', { country: 'FR' });
    expect(r.ok && r.e164).toBe('+33612345678');
  });

  it('reconnaît un indicatif international dicté « plus trente-deux »', () => {
    const r = parseSpokenPhone('plus trente-deux quatre septante-cinq douze trente-quatre cinquante-six', {});
    expect(r.ok && r.e164).toBe('+32475123456');
  });

  /**
   * `0475 12 34 56` est un mobile belge ET un fixe français du Sud-Est. Aucune
   * analyse du numéro ne tranche: la séquence appartient aux deux plans. Seul
   * le contexte décide, et le meilleur contexte disponible est la ligne depuis
   * laquelle l'appelant appelle.
   */
  it('tranche l\'ambiguïté BE/FR sur la ligne de l\'appelant, pas sur celle du commerce', () => {
    const said = 'zéro quatre septante-cinq douze trente-quatre cinquante-six';

    // Commerce français, appelant belge: c'est un numéro belge.
    const fromBelgium = parseSpokenPhone(said, { country: 'FR', callerNumber: '+32475987654' });
    expect(fromBelgium.ok && fromBelgium.e164).toBe('+32475123456');

    // Sans cet indice, le pays du commerce l'emporte, et le numéro est
    // français: c'est faux une fois sur deux, et c'est pour ça que la
    // relecture à l'appelant reste indispensable.
    const noHint = parseSpokenPhone(said, { country: 'FR' });
    expect(noHint.ok && noHint.e164).toBe('+33475123456');
  });
});

/**
 * Le cœur de BEL-3: ce qui n'est pas un numéro ne doit pas devenir un numéro.
 * Un rappel sur un chiffre faux est un lead perdu, et un lead perdu ne se voit
 * nulle part.
 */
describe('parseSpokenPhone — ce qui doit être refusé', () => {
  it('refuse une longueur qui ne correspond à aucun gabarit', () => {
    // Neuf chiffres commençant par 04: trop court pour un mobile belge. La
    // métadonnée réduite de libphonenumber l'accepterait, pas la complète.
    const r = parseSpokenPhone('zéro quatre cinq un deux trois quatre cinq six', { country: 'BE' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid');
  });

  it('refuse un numéro tronqué', () => {
    const r = parseSpokenPhone('zéro quatre septante-cinq douze', { country: 'BE' });
    expect(r.ok).toBe(false);
  });

  it('distingue « rien dicté » de « mal dicté »', () => {
    const nothing = parseSpokenPhone('je vous rappellerai', { country: 'BE' });
    expect(nothing.ok).toBe(false);
    if (!nothing.ok) expect(nothing.reason).toBe('no_digits');
  });

  it('garde les chiffres entendus pour le journal, sans les rendre exploitables', () => {
    const r = parseSpokenPhone('zéro quatre septante-cinq douze', { country: 'BE' });
    expect(!r.ok && r.digits).toBe('047512');
  });
});
