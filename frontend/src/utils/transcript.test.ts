import { describe, it, expect } from 'vitest';
import { parseTranscript } from './transcript';

describe('parseTranscript', () => {
  it('attribue chaque réplique au bon locuteur', () => {
    const out = parseTranscript('AI: Bonjour.\nUser: Un rendez-vous, svp.');
    expect(out).toEqual([
      { who: 'agent', text: 'Bonjour.' },
      { who: 'caller', text: 'Un rendez-vous, svp.' },
    ]);
  });

  it('accepte les autres noms de locuteur rendus par Vapi', () => {
    expect(parseTranscript('Assistant: A\nBot: B\nCustomer: C\nCaller: D').map(l => l.who))
      .toEqual(['agent', 'agent', 'caller', 'caller']);
  });

  /* Le cas qui compte: une ligne sans préfixe ne doit être ni perdue, ni
     attribuée d'office à l'agent. Un transcript mal formé reste lisible. */
  it('garde une ligne sans préfixe, sans lui inventer de locuteur', () => {
    expect(parseTranscript('Appel transféré au cabinet.')).toEqual([
      { who: null, text: 'Appel transféré au cabinet.' },
    ]);
  });

  it('ignore les lignes vides et les répliques sans texte', () => {
    expect(parseTranscript('AI: Bonjour.\n\n   \nUser:   \n')).toEqual([
      { who: 'agent', text: 'Bonjour.' },
    ]);
  });

  /* Deux points dans la phrase: seul le PREMIER sépare le locuteur du texte. */
  it('ne coupe pas la réplique au deuxième deux-points', () => {
    expect(parseTranscript('AI: Deux créneaux: jeudi 14 h 30, vendredi 10 h.')[0].text)
      .toBe('Deux créneaux: jeudi 14 h 30, vendredi 10 h.');
  });
});
