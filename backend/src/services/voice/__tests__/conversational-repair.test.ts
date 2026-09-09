import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildIdleMessagePlan,
  newRepairState,
  recoveryLine,
  silenceNudge,
} from '../conversational-repair';
import { buildBackchannelPlan, buildRealtimePlans } from '../speech-plans';
import { callSessionStore } from '../call-session.store';
import { callSessionStore } from '../call-session.store';

describe('recoveryLine — restraint is the feature', () => {
  it('says nothing when the interruption cut a backchannel', () => {
    // Apologising for an "mm-hmm" draws attention to something the caller did
    // not even notice.
    expect(recoveryLine(newRepairState(), false, 5, 'fr')).toBeNull();
  });

  it('speaks after a real interruption', () => {
    expect(recoveryLine(newRepairState(), true, 5, 'fr')).not.toBeNull();
  });

  it('does not apologise twice in a row', () => {
    const state = newRepairState();
    expect(recoveryLine(state, true, 5, 'en')).not.toBeNull();
    expect(recoveryLine(state, true, 6, 'en')).toBeNull();
    expect(recoveryLine(state, true, 7, 'en')).toBeNull();
  });

  it('allows another one once the cooldown has passed', () => {
    const state = newRepairState();
    recoveryLine(state, true, 5, 'en');
    expect(recoveryLine(state, true, 8, 'en')).not.toBeNull();
  });

  it('caps the total per call, however choppy the conversation', () => {
    const state = newRepairState();
    const lines = [0, 10, 20, 30, 40].map(turn => recoveryLine(state, true, turn, 'en'));
    expect(lines.filter(Boolean)).toHaveLength(2);
  });

  it('speaks the caller language', () => {
    expect(recoveryLine(newRepairState(), true, 0, 'fr')).toMatch(/Pardon|prie|écoute/);
    expect(recoveryLine(newRepairState(), true, 0, 'en')).toMatch(/Sorry|go on|listening/);
  });
});

describe('silence handling', () => {
  it('asks whether the caller is still there, in their language', () => {
    expect(silenceNudge('fr')).toMatch(/là|entendez/);
    expect(silenceNudge('en')).toMatch(/there|hear/);
  });

  it('nudges well before the hang-up deadline — they are different events', () => {
    const plan = buildIdleMessagePlan('fr', 6, 2);
    expect(plan.idleTimeoutSeconds).toBe(6);
    expect(plan.idleTimeoutSeconds).toBeLessThan(10);
    expect(plan.idleMessageMaxSpokenCount).toBe(2);
    expect(plan.idleMessages.length).toBeGreaterThan(0);
  });

  it('clamps to what Vapi accepts rather than shipping a rejected assistant', () => {
    // Out-of-range values do not disable the nudge, they reject the whole
    // assistant — every call for that client dies, not just the idle line.
    expect(buildIdleMessagePlan('fr', 4, 2).idleTimeoutSeconds).toBe(5);
    expect(buildIdleMessagePlan('fr', 900, 2).idleTimeoutSeconds).toBe(60);
    expect(buildIdleMessagePlan('fr', 6, 0).idleMessageMaxSpokenCount).toBe(1);
    expect(buildIdleMessagePlan('fr', 6, 99).idleMessageMaxSpokenCount).toBe(10);
  });

  it('ships the idle plan alongside the silence timeout, not instead of it', () => {
    const plans = buildRealtimePlans('en') as Record<string, any>;
    expect(plans.messagePlan.idleTimeoutSeconds).toBeLessThan(plans.silenceTimeoutSeconds);
  });
});

describe('backchannels', () => {
  it('is on by default — silence through a long explanation reads as a machine', () => {
    expect((buildRealtimePlans('fr') as Record<string, any>).backchannelingEnabled).toBe(true);
  });

  it('never acknowledges with a word that implies agreement', () => {
    // "yes" / "d'accord" mid-sentence reads as agreeing to something nobody
    // promised.
    for (const lang of ['fr', 'en'] as const) {
      const words = buildBackchannelPlan(lang).words.map(w => w.toLowerCase());
      expect(words).not.toContain('yes');
      expect(words).not.toContain('oui');
      expect(words).not.toContain("d'accord");
    }
  });

  it('waits before the first acknowledgement so it reads as attention', () => {
    expect(buildBackchannelPlan('en').startDelaySeconds).toBeGreaterThan(1);
  });
});

describe('barge-in classification', () => {
  const base = { vapiCallId: 'c1', clientId: 'client_1', callerNumber: null, language: 'fr' as const };

  it('treats an interruption of a backchannel as soft', () => {
    callSessionStore.reset();
    callSessionStore.start(base);
    callSessionStore.assistantStartedSpeaking('c1', 1_000);
    // Caller keeps talking 200ms into an "mm-hmm" — not an interruption.
    expect(callSessionStore.recordBargeIn('c1', 1_200)).toBe(false);
    expect(callSessionStore.get('c1')!.hardBargeIns).toBe(0);
    // Still counted in the raw total, which is what pacing analysis uses.
    expect(callSessionStore.get('c1')!.bargeIns).toBe(1);
  });

  it('treats an interruption of a real sentence as hard', () => {
    callSessionStore.reset();
    callSessionStore.start(base);
    callSessionStore.assistantStartedSpeaking('c1', 1_000);
    expect(callSessionStore.recordBargeIn('c1', 3_000)).toBe(true);
    expect(callSessionStore.get('c1')!.hardBargeIns).toBe(1);
  });

  it('is soft when the assistant was not speaking at all', () => {
    callSessionStore.reset();
    callSessionStore.start(base);
    expect(callSessionStore.recordBargeIn('c1', 3_000)).toBe(false);
  });

  it('clears the speaking mark so one utterance yields one classification', () => {
    callSessionStore.reset();
    callSessionStore.start(base);
    callSessionStore.assistantStartedSpeaking('c1', 1_000);
    callSessionStore.recordBargeIn('c1', 3_000);
    expect(callSessionStore.recordBargeIn('c1', 3_100)).toBe(false);
  });
});

/**
 * TUR-8 relevait que `recoveryLine` était écrite ET testée mais appelée depuis
 * AUCUN point du runtime: du code mort, pas une fonctionnalité. Ces cas testent
 * le branchement, pas la règle — la règle est testée plus haut.
 */
describe('le branchement de la phrase de reprise', () => {
  beforeEach(() => callSessionStore.reset());

  const open = () =>
    callSessionStore.start({ vapiCallId: 'c1', clientId: 'cl1', callerNumber: null, language: 'fr' });

  /** Coupe l'agent après `ms` de parole, et rend le verdict du magasin. */
  function bargeInAfter(ms: number): boolean {
    const now = Date.now();
    callSessionStore.assistantStartedSpeaking('c1', now - ms);
    return callSessionStore.recordBargeIn('c1', now);
  }

  it('rend une phrase après une coupure en pleine phrase', () => {
    open();
    expect(bargeInAfter(3000)).toBe(true);
    expect(callSessionStore.takeRecoveryLine('c1', 'fr')).toBeTruthy();
  });

  it('ne rend rien quand rien n\'a été coupé', () => {
    open();
    expect(callSessionStore.takeRecoveryLine('c1', 'fr')).toBeNull();
  });

  it('ne s\'excuse pas d\'avoir coupé court un acquiescement', () => {
    open();
    // 200 ms de parole: un « mm-hmm », que l'appelant n'a même pas remarqué.
    expect(bargeInAfter(200)).toBe(false);
    expect(callSessionStore.takeRecoveryLine('c1', 'fr')).toBeNull();
  });

  it('consomme le drapeau, donc ne s\'excuse pas deux fois de la même coupure', () => {
    open();
    bargeInAfter(3000);
    expect(callSessionStore.takeRecoveryLine('c1', 'fr')).toBeTruthy();
    expect(callSessionStore.takeRecoveryLine('c1', 'fr')).toBeNull();
  });

  it('garde la retenue du module: pas deux excuses d\'affilée', () => {
    open();
    bargeInAfter(3000);
    expect(callSessionStore.takeRecoveryLine('c1', 'fr')).toBeTruthy();
    // Deuxième coupure au tour suivant: le refroidissement de trois tours la tait.
    bargeInAfter(3000);
    expect(callSessionStore.takeRecoveryLine('c1', 'fr')).toBeNull();
  });

  it('ne rend rien sur un appel inconnu', () => {
    expect(callSessionStore.takeRecoveryLine('jamais-vu', 'fr')).toBeNull();
    expect(callSessionStore.takeRecoveryLine(null, 'fr')).toBeNull();
  });
});
