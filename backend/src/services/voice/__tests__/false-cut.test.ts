import { describe, it, expect } from 'vitest';
import { endsMidThought, isFalseCut, FALSE_CUT_WINDOW_MS } from '../false-cut';
import { callSessionStore } from '../call-session.store';

describe('endsMidThought — l\'appelant avait-il fini ?', () => {
  it('une phrase ponctuée est finie', () => {
    expect(endsMidThought('Je voudrais un rendez-vous.', 'fr')).toBe(false);
    expect(endsMidThought('Vous êtes ouverts demain ?', 'fr')).toBe(false);
  });

  it('un mot de liaison en dernier ne finit rien', () => {
    expect(endsMidThought('Je voudrais un rendez-vous demain et', 'fr')).toBe(true);
    expect(endsMidThought('C\'est pour ma mère qui', 'fr')).toBe(true);
    expect(endsMidThought('Je voulais savoir si', 'fr')).toBe(true);
  });

  it('une virgule finale est un aveu de suite', () => {
    expect(endsMidThought('Alors, je m\'appelle Marc,', 'fr')).toBe(true);
  });

  it('une phrase complète sans ponctuation reste une phrase complète', () => {
    expect(endsMidThought('je voudrais un rendez-vous demain matin', 'fr')).toBe(false);
  });

  it('a sa propre liste par langue', () => {
    // « een » est un déterminant néerlandais et rien du tout en français.
    expect(endsMidThought('ik wil een', 'nl')).toBe(true);
    expect(endsMidThought('ik wil een', 'fr')).toBe(false);
    expect(endsMidThought('I would like to book a', 'en')).toBe(true);
  });

  it('ne trébuche pas sur le vide', () => {
    expect(endsMidThought('', 'fr')).toBe(false);
    expect(endsMidThought('   ', 'fr')).toBe(false);
  });
});

describe('isFalseCut — les deux conditions, jamais une seule', () => {
  it('compte une reprise immédiate sur une phrase inachevée', () => {
    expect(isFalseCut(400, 'je voudrais un rendez-vous et', 'fr')).toBe(true);
  });

  it('ne compte pas une réaction tardive, même sur une phrase inachevée', () => {
    // Passé la fenêtre, l'appelant a ENTENDU l'agent: c'est lui qui coupe.
    expect(isFalseCut(FALSE_CUT_WINDOW_MS + 1, 'je voudrais un rendez-vous et', 'fr')).toBe(false);
  });

  it('ne compte pas une reprise immédiate après une phrase finie', () => {
    // « non non » lâché aussitôt: l'appelant réagit, il n'a pas été coupé.
    expect(isFalseCut(300, 'Je voudrais un rendez-vous.', 'fr')).toBe(false);
  });

  it('ne compte rien sans tour précédent', () => {
    expect(isFalseCut(300, null, 'fr')).toBe(false);
  });
});

describe('callSessionStore — le compteur sur un appel', () => {
  const base = { clientId: 'cl1', callerNumber: null, language: 'fr' as const };

  it('relève le faux découpage sans en faire une interruption dure', () => {
    callSessionStore.start({ vapiCallId: 'fc1', ...base });
    callSessionStore.appendTranscript('fc1', 'user', 'je voudrais un rendez-vous et');
    callSessionStore.assistantStartedSpeaking('fc1', 10_000);
    // 400 ms d'énoncé: sous le plancher de l'interruption dure.
    expect(callSessionStore.recordBargeIn('fc1', 10_400)).toBe(false);
    expect(callSessionStore.get('fc1')!.falseCuts).toBe(1);
  });

  it('ne relève rien quand l\'appelant avait fini sa phrase', () => {
    callSessionStore.start({ vapiCallId: 'fc2', ...base });
    callSessionStore.appendTranscript('fc2', 'user', 'Je voudrais un rendez-vous.');
    callSessionStore.assistantStartedSpeaking('fc2', 10_000);
    callSessionStore.recordBargeIn('fc2', 10_400);
    expect(callSessionStore.get('fc2')!.falseCuts).toBe(0);
  });

  it('ne relève rien quand l\'agent ne parlait pas', () => {
    callSessionStore.start({ vapiCallId: 'fc3', ...base });
    callSessionStore.appendTranscript('fc3', 'user', 'je voudrais un rendez-vous et');
    callSessionStore.recordBargeIn('fc3', 10_400);
    expect(callSessionStore.get('fc3')!.falseCuts).toBe(0);
  });
});
