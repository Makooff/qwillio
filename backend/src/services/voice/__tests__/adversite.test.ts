import { describe, it, expect } from 'vitest';
import { buildRealtimePlans } from '../speech-plans';
import { callSessionStore } from '../call-session.store';
import { spokenPrefix } from '../spoken-prefix';

/**
 * Les modes d'échec adverses, chacun avec une assertion explicite (TST-6).
 *
 * Ce fichier ne couvre QUE les axes atteignables en texte. Le bruit à SNR
 * fixe, les accents et la double-parole audio demandent un harnais audio qui
 * n'existe pas (TST-1, TST-2): les y simuler en texte donnerait un test vert
 * qui ne prouve rien, ce qui est pire que pas de test du tout.
 */

const base = { clientId: 'cl1', callerNumber: null, language: 'fr' as const };
/** 90 caractères, soit six secondes d'énoncé au débit de référence. */
const UTTERANCE =
  'Bonjour, je vous propose mardi neuf heures, mercredi quatorze heures ou jeudi matin.';

describe('interruption injectée à 200, 500 et 1500 ms', () => {
  /* Les trois instants du critère, et ils ne se ressemblent pas: les deux
     premiers tombent sous le plancher de l'interruption dure, le troisième
     au-dessus. C'est ce qui décide si l'agent s'excuse au tour suivant. */
  const cases = [
    { ms: 200, hard: false },
    { ms: 500, hard: false },
    { ms: 1_500, hard: true },
  ];

  for (const { ms, hard } of cases) {
    it(`à ${ms} ms: interruption ${hard ? 'dure' : 'douce'}, historique tronqué à l'avenant`, () => {
      const id = `adv_${ms}`;
      callSessionStore.start({ vapiCallId: id, ...base });
      callSessionStore.assistantStartedSpeaking(id, 10_000);
      expect(callSessionStore.recordBargeIn(id, 10_000 + ms)).toBe(hard);

      // La phrase de reprise n'existe que sur une interruption dure: s'excuser
      // d'avoir été coupé au bout de 200 ms serait plus étrange que le silence.
      expect(callSessionStore.takeRecoveryLine(id, 'fr') !== null).toBe(hard);

      const heard = spokenPrefix(UTTERANCE, ms, 'fr');
      expect(heard.truncated).toBe(true);
      // Plus l'interruption est tardive, plus l'appelant en a entendu.
      expect(heard.text.length).toBeGreaterThanOrEqual(1);
    });
  }

  it('ce qui reste dans l\'historique croît avec le temps d\'écoute', () => {
    const lengths = [200, 500, 1_500].map(ms => spokenPrefix(UTTERANCE, ms, 'fr').text.length);
    expect(lengths[0]).toBeLessThanOrEqual(lengths[1]);
    expect(lengths[1]).toBeLessThan(lengths[2]);
  });
});

describe('double-parole d\'une seconde et demie', () => {
  it('compte comme une vraie interruption, pas comme un signe d\'écoute', () => {
    callSessionStore.start({ vapiCallId: 'adv_dt', ...base });
    callSessionStore.assistantStartedSpeaking('adv_dt', 0);
    expect(callSessionStore.recordBargeIn('adv_dt', 1_500)).toBe(true);
    expect(callSessionStore.get('adv_dt')!.hardBargeIns).toBe(1);
  });

  it('mais un acquiescement coupé court n\'en est pas une', () => {
    callSessionStore.start({ vapiCallId: 'adv_ack', ...base });
    callSessionStore.assistantStartedSpeaking('adv_ack', 0);
    // 300 ms d'énoncé: l'agent disait « mm-hmm », pas une phrase.
    expect(callSessionStore.recordBargeIn('adv_ack', 300)).toBe(false);
    expect(callSessionStore.get('adv_ack')!.hardBargeIns).toBe(0);
  });
});

describe('silence total de l\'appelant', () => {
  it('l\'appel est relancé plusieurs fois avant d\'être abandonné', () => {
    const plans = buildRealtimePlans('fr') as any;
    expect(plans.messagePlan?.idleMessages?.length).toBeGreaterThan(0);
    expect(plans.messagePlan.idleTimeoutSeconds).toBeGreaterThan(0);
    // Un seul rappel laisserait mourir l'appel sur un silence de deux secondes;
    // un rappel sans plafond harcèlerait une ligne raccrochée.
    expect(plans.messagePlan.idleMessageMaxSpokenCount).toBeGreaterThan(1);
  });
});

describe('DTMF pendant que l\'agent parle', () => {
  it('le clavier est armé sur TOUS les appels, pas seulement après un échec', () => {
    // L'assistant ne se reconstruit pas en cours d'appel: un plan armé
    // seulement après un échec de dictée ne serait jamais armé du tout.
    const plans = buildRealtimePlans('fr') as any;
    expect(plans.keypadInputPlan?.enabled).toBe(true);
  });

  it('les délimiteurs sont un TABLEAU — l\'API vivante l\'a tranché', () => {
    const plans = buildRealtimePlans('fr') as any;
    expect(Array.isArray(plans.keypadInputPlan.delimiters)).toBe(true);
    expect(plans.keypadInputPlan.delimiters).toContain('#');
  });
});

describe('raccrochage brutal en plein tour', () => {
  it('la session rend ses compteurs même coupée pendant que l\'agent parlait', () => {
    callSessionStore.start({ vapiCallId: 'adv_hangup', ...base });
    callSessionStore.appendTranscript('adv_hangup', 'user', 'je voudrais un rendez-vous');
    callSessionStore.assistantStartedSpeaking('adv_hangup', 0);

    const session = callSessionStore.get('adv_hangup')!;
    // L'agent tient encore la parole: c'est l'état dans lequel le rapport de
    // fin arrive quand l'appelant raccroche au milieu d'une phrase.
    expect(session.assistantSpeakingSince).not.toBeNull();
    expect(session.transcript.length).toBe(1);
    expect(() => callSessionStore.end('adv_hangup')).not.toThrow();
    expect(callSessionStore.get('adv_hangup')).toBeNull();
  });
});
