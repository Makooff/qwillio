import { describe, it, expect } from 'vitest';
import { normalizeUtterance, routeIntent, estimateTokensSaved } from '../intent-router';

describe('normalizeUtterance', () => {
  it('strips accents, punctuation and casing', () => {
    expect(normalizeUtterance('D\'accord !')).toBe('d accord');
    expect(normalizeUtterance('Très bien.')).toBe('tres bien');
    expect(normalizeUtterance('  OK??  ')).toBe('ok');
  });

  it('collapses curly and straight apostrophes the same way', () => {
    expect(normalizeUtterance('j’ai pas compris')).toBe(normalizeUtterance("j'ai pas compris"));
  });
});

describe('routeIntent — deflected turns', () => {
  it('treats a bare acknowledgement as a backchannel and stays silent', () => {
    const d = routeIntent('ok', 'en', { turnIndex: 2 });
    expect(d.kind).toBe('backchannel');
    expect(d.handledLocally).toBe(true);
    expect(d.reply).toBe('');
  });

  it('handles French acknowledgements with accents', () => {
    const d = routeIntent('D\'accord', 'fr', { turnIndex: 3 });
    expect(d.kind).toBe('backchannel');
    expect(d.handledLocally).toBe(true);
  });

  it('answers the opening hello locally', () => {
    const d = routeIntent('hello', 'en', { turnIndex: 0 });
    expect(d.kind).toBe('presence_check');
    expect(d.handledLocally).toBe(true);
    expect(d.reply).not.toBe('');
  });

  it('does not treat a mid-call "bonjour" as an opening greeting', () => {
    const d = routeIntent('bonjour', 'fr', { turnIndex: 4 });
    expect(d.kind).toBe('reasoning');
    expect(d.handledLocally).toBe(false);
  });

  it('closes on a farewell', () => {
    expect(routeIntent('goodbye', 'en').kind).toBe('farewell');
    expect(routeIntent('au revoir', 'fr').kind).toBe('farewell');
  });

  it('classifies empty audio as noise', () => {
    const d = routeIntent('   ', 'en');
    expect(d.kind).toBe('noise');
    expect(d.handledLocally).toBe(true);
  });
});

describe('routeIntent — escalation guards', () => {
  it('escalates anything carrying a business marker, even when short', () => {
    for (const utterance of ['ok book it', 'oui pour le rdv', 'cancel', 'vos horaires ?', 'how much']) {
      const d = routeIntent(utterance, utterance.match(/[éèà]|oui|vos/) ? 'fr' : 'en');
      expect(d.handledLocally, `"${utterance}" must reach the model`).toBe(false);
      expect(d.kind).toBe('reasoning');
    }
  });

  it('escalates once the utterance is long enough to carry a request', () => {
    const d = routeIntent('yeah sure that works for me then', 'en');
    expect(d.handledLocally).toBe(false);
    expect(d.reason).toMatch(/too long/);
  });

  it('acknowledges a repeat request locally but still runs the model', () => {
    const d = routeIntent('sorry', 'en');
    expect(d.kind).toBe('repeat_request');
    // The restatement needs conversation state, so the model must still run.
    expect(d.handledLocally).toBe(false);
    // ...but the caller hears something immediately.
    expect(d.reply).not.toBe('');
  });

  it('never short-circuits an unrecognised utterance', () => {
    const d = routeIntent('my dishwasher exploded', 'en');
    expect(d.kind).toBe('reasoning');
    expect(d.handledLocally).toBe(false);
  });
});

/**
 * LEG-3: la porte de sortie humaine.
 *
 * C'est la seule phrase d'un appel où l'appelant dit que la machine ne lui
 * suffit pas. La rater, c'est retenir quelqu'un qui a demandé à partir.
 */
describe('routeIntent — demande d\'un humain', () => {
  const asks = [
    ['fr', 'conseiller'],
    ['fr', 'je voudrais parler a un conseiller'],
    ['fr', 'est ce que je peux parler a quelqu un de l equipe s il vous plait'],
    ['fr', 'passez moi une personne'],
    ['fr', 'je ne veux pas un robot'],
    ['en', 'can I speak to a human please'],
    ['en', 'operator'],
    ['en', 'put me through to someone'],
    ['nl', 'kan ik met iemand spreken'],
  ] as const;

  for (const [lang, utterance] of asks) {
    it(`reconnaît « ${utterance} » (${lang})`, () => {
      const d = routeIntent(utterance, lang);
      expect(d.kind).toBe('human_handoff');
      // Rien n'est répondu ici: c'est le transfert qui répond.
      expect(d.handledLocally).toBe(false);
      expect(d.reply).toBe('');
    });
  }

  /**
   * L'ordre verbe → nom porte tout le risque de faux positif. Ces phrases
   * nomment une personne ET un verbe de déplacement, et ne demandent aucun
   * transfert: les traiter comme tel raccrocherait au nez d'un client qui
   * prenait rendez-vous.
   */
  const notAsks = [
    ['fr', 'est ce que quelqu un peut passer demain matin'],
    ['fr', 'la personne qui est venue la derniere fois etait tres bien'],
    ['en', 'someone will pass by tomorrow'],
  ] as const;

  for (const [lang, utterance] of notAsks) {
    it(`ne confond pas « ${utterance} » avec une demande de transfert`, () => {
      expect(routeIntent(utterance, lang).kind).not.toBe('human_handoff');
    });
  }

  it('passe avant la coupure sur la longueur, qui trierait la formule la plus courante', () => {
    // Plus de cinq mots: sans la priorité, ce tour partirait dans le
    // tout-venant et le transfert dépendrait de nouveau du modèle.
    const d = routeIntent('bonjour est ce que je pourrais parler a un conseiller maintenant', 'fr');
    expect(d.wordCount).toBeGreaterThan(5);
    expect(d.kind).toBe('human_handoff');
  });
});

describe('estimateTokensSaved', () => {
  it('counts only the locally handled turns', () => {
    const decisions = [
      routeIntent('ok', 'en', { turnIndex: 1 }),
      routeIntent('mhm', 'en', { turnIndex: 2 }),
      routeIntent('I need to book a table', 'en'),
    ];
    expect(estimateTokensSaved(decisions)).toBe(2 * (1_450 + 38));
  });

  it('is zero when every turn escalates', () => {
    expect(estimateTokensSaved([routeIntent('can I cancel my appointment', 'en')])).toBe(0);
  });
});
