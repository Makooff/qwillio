import { describe, it, expect, beforeEach } from 'vitest';
import { callSessionStore } from '../call-session.store';

const base = { vapiCallId: 'call_1', clientId: 'client_1', callerNumber: '+33612345678', language: 'fr' as const };

describe('callSessionStore', () => {
  beforeEach(() => callSessionStore.reset());

  it('buffers the transcript in memory instead of writing per utterance', () => {
    callSessionStore.start(base);
    callSessionStore.appendTranscript('call_1', 'user', 'bonjour');
    callSessionStore.appendTranscript('call_1', 'assistant', 'bonjour, que puis-je faire ?');
    expect(callSessionStore.transcriptText('call_1')).toBe('Caller: bonjour\nAI: bonjour, que puis-je faire ?');
  });

  it('ignores empty utterances and unknown calls', () => {
    callSessionStore.start(base);
    callSessionStore.appendTranscript('call_1', 'user', '   ');
    callSessionStore.appendTranscript('ghost_call', 'user', 'hello');
    expect(callSessionStore.transcriptText('call_1')).toBe('');
    expect(callSessionStore.get('ghost_call')).toBeNull();
  });

  it('counts caller turns and measures the reply latency', async () => {
    callSessionStore.start(base);
    callSessionStore.appendTranscript('call_1', 'user', 'je voudrais un rendez-vous');
    await new Promise(r => setTimeout(r, 15));
    callSessionStore.appendTranscript('call_1', 'assistant', 'bien sûr');

    const session = callSessionStore.get('call_1')!;
    expect(session.callerTurns).toBe(1);
    expect(session.turnLatencies).toHaveLength(1);
    expect(session.turnLatencies[0]).toBeGreaterThanOrEqual(10);
  });

  it('does not record a latency for an assistant turn nobody prompted', () => {
    callSessionStore.start(base);
    callSessionStore.appendTranscript('call_1', 'assistant', 'first message');
    expect(callSessionStore.get('call_1')!.turnLatencies).toHaveLength(0);
  });

  it('hands the session back once and forgets it', () => {
    callSessionStore.start(base);
    callSessionStore.recordDeflection('call_1');
    callSessionStore.recordBargeIn('call_1');

    const ended = callSessionStore.end('call_1');
    expect(ended?.deflectedTurns).toBe(1);
    expect(ended?.bargeIns).toBe(1);
    expect(callSessionStore.end('call_1')).toBeNull();
    expect(callSessionStore.liveCount()).toBe(0);
  });

  describe('appels simultanés', () => {
    /* La promesse vendue est « la ligne ne sonne jamais occupé ». Elle tient
       déjà: l'assistant est reconstruit à chaque appel, donc rien n'est
       « occupé ». Ce qui manquait, c'est de pouvoir le PROUVER, et de voir
       venir le seul vrai plafond, la concurrence du compte Vapi partagée par
       toute la flotte. */

    const second = { ...base, vapiCallId: 'call_2' };
    const autreClient = { ...base, vapiCallId: 'call_3', clientId: 'client_2' };

    it('accepte plusieurs appels pour le même client, sans en refuser aucun', () => {
      callSessionStore.start(base);
      callSessionStore.start(second);

      expect(callSessionStore.liveCountFor('client_1')).toBe(2);
      // Les deux sessions existent bel et bien: aucune n'a évincé l'autre.
      expect(callSessionStore.get('call_1')).not.toBeNull();
      expect(callSessionStore.get('call_2')).not.toBeNull();
    });

    it('ne mélange pas les clients', () => {
      // Le compteur sert à dire QUI sature. Compter globalement pointerait le
      // mauvais client, et donc le mauvais correctif.
      callSessionStore.start(base);
      callSessionStore.start(autreClient);

      expect(callSessionStore.liveCountFor('client_1')).toBe(1);
      expect(callSessionStore.liveCountFor('client_2')).toBe(1);
      expect(callSessionStore.liveCount()).toBe(2);
    });

    it('retient le PIC, que le compteur instantané ne dit pas', () => {
      /* Personne ne regarde l'écran à l'instant précis où deux appels se
         croisent: à froid le compteur vaut zéro et laisse croire qu'un seul
         appel passe à la fois. C'est le pic qui sert à dimensionner. */
      callSessionStore.start(base);
      callSessionStore.start(second);
      callSessionStore.end('call_1');
      callSessionStore.end('call_2');

      const c = callSessionStore.concurrency();
      expect(c.live).toBe(0);
      expect(c.peakLive).toBe(2);
      expect(c.peakPerClient).toContainEqual({ clientId: 'client_1', peak: 2 });
    });

    it('désigne le client le plus chargé à cet instant', () => {
      callSessionStore.start(base);
      callSessionStore.start(second);
      callSessionStore.start(autreClient);

      expect(callSessionStore.concurrency().busiest).toEqual({ clientId: 'client_1', live: 2 });
    });

    it('ne dit personne quand la ligne est calme', () => {
      // L'état normal. Le panneau de santé doit pouvoir l'afficher sans cas
      // particulier côté écran.
      expect(callSessionStore.concurrency().busiest).toBeNull();
    });

    it("ne publie AUCUN identifiant de client dans la forme anonyme", () => {
      /* `/api/webhooks/vapi/health` vit sur le routeur des webhooks, qui n'a pas
         d'authentification: tout ce qu'on y écrit est lisible par qui interroge
         l'URL. Le détail par client passe par `/api/admin/system`. */
      callSessionStore.start(base);
      callSessionStore.start(autreClient);

      const publie = JSON.stringify(callSessionStore.concurrencySummary());
      expect(publie).not.toContain('client_1');
      expect(publie).not.toContain('client_2');
      // Et il reste utile: la saturation se voit sans savoir qui la cause.
      expect(callSessionStore.concurrencySummary()).toEqual({ live: 2, peakLive: 2, busiestLive: 1 });
    });

    it('repart de zéro à la remise à zéro, pics compris', () => {
      /* Ce sont des mesures d'exploitation, pas des données: les persister
         coûterait une écriture sur le chemin critique de l'appel, ce que ce
         magasin existe précisément pour éviter. */
      callSessionStore.start(base);
      callSessionStore.start(second);
      callSessionStore.reset();

      expect(callSessionStore.concurrency()).toMatchObject({ live: 0, peakLive: 0, busiest: null });
      expect(callSessionStore.concurrency().peakPerClient).toEqual([]);
    });
  });

  describe('slot holds', () => {
    it('keeps a slot promised on one live call away from a parallel call', () => {
      const day = new Date('2026-09-14T12:00:00Z');
      callSessionStore.holdSlot('client_1', day, '14:00');
      expect(callSessionStore.heldSlots('client_1', day)).toEqual(['14:00']);
    });

    it('scopes holds per client and per day', () => {
      const day = new Date('2026-09-14T12:00:00Z');
      const otherDay = new Date('2026-09-15T12:00:00Z');
      callSessionStore.holdSlot('client_1', day, '14:00');
      expect(callSessionStore.heldSlots('client_2', day)).toEqual([]);
      expect(callSessionStore.heldSlots('client_1', otherDay)).toEqual([]);
    });
  });
});
