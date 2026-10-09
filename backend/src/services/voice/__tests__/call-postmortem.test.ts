import { describe, it, expect } from 'vitest';
import { postMortemOf, readSignals, type CallSignals } from '../call-postmortem';

/** Un appel qui s'est bien passé, sauf ce que le test remplace. */
function call(over: Partial<CallSignals> = {}): CallSignals {
  return {
    transcript: 'Bonjour, je voudrais un rendez-vous jeudi.\nAgent: Bien sûr, à quelle heure ?',
    outcome: 'completed',
    sentiment: 'neutral',
    callerName: 'Marie Dupont',
    isLead: true,
    bookingRequested: true,
    bookingDate: '2026-10-15T10:00:00.000Z',
    durationSeconds: 62,
    metadata: {},
    ...over,
  };
}

/** Un appel du chemin Vapi, avec ses métriques temps réel. */
function vapi(realtime: Record<string, unknown>, over: Partial<CallSignals> = {}): CallSignals {
  return call({ metadata: { realtime }, ...over });
}

/** Un appel du chemin voice-core, dont les métriques n'ont pas la même forme. */
function voiceCore(latency: Record<string, unknown>, over: Partial<CallSignals> = {}): CallSignals {
  return call({ metadata: { source: 'voice-core', room: 'call-x', brain: 'cascade', latency }, ...over });
}

describe('postMortemOf — l\'appel qui va bien', () => {
  it('ne dit rien d\'un appel qui n\'a rien produit d\'anormal', () => {
    const m = postMortemOf(call());
    expect(m.verdict).toBe('ok');
    expect(m.codes).toEqual([]);
    expect(m.needsDeveloper).toBe(false);
    expect(m.clientAction).toBeNull();
  });
});

describe('postMortemOf — ce qui appartient au code', () => {
  it('nomme l\'outil en panne plutôt que de dire qu\'un outil a échoué', () => {
    const m = postMortemOf(vapi({ toolCalls: [{ name: 'checkAvailability:error', ms: 120 }] }));
    expect(m.verdict).toBe('broken');
    expect(m.codes).toContain('tool_failed');
    expect(m.needsDeveloper).toBe(true);
    expect(m.evidence[0]).toContain('checkAvailability x1');
  });

  it('marque le repli du modèle, avec sa raison', () => {
    const m = postMortemOf(vapi({ llmFailures: ['OpenAI responded 429'] }));
    expect(m.codes).toContain('model_failed');
    expect(m.verdict).toBe('broken');
    expect(m.evidence.join(' ')).toContain('429');
  });

  it('attrape la ligne muette quand l\'appel a duré', () => {
    const m = postMortemOf(call({ transcript: '   ', durationSeconds: 40 }));
    expect(m.codes).toContain('dead_line');
    expect(m.verdict).toBe('broken');
  });

  it('laisse passer une ligne muette de deux secondes : ce n\'est pas une panne', () => {
    expect(postMortemOf(call({ transcript: '', durationSeconds: 2 })).codes).not.toContain('dead_line');
  });

  it('refuse un rendez-vous sans nom — la famille des rendez-vous au nom de l\'agent', () => {
    const m = postMortemOf(vapi({ bookingId: 'bk_1' }, { callerName: null }));
    expect(m.codes).toContain('booking_without_name');
    expect(m.needsDeveloper).toBe(true);
  });

  it('ne dit rien d\'un rendez-vous qui porte un nom', () => {
    expect(postMortemOf(vapi({ bookingId: 'bk_1' })).codes).not.toContain('booking_without_name');
  });
});

describe('postMortemOf — ce qui se règle chez le client', () => {
  it('signale un appelant engagé qui repart sans rien, et dit quoi faire', () => {
    const m = postMortemOf(vapi({ callerTurns: 6 }, { outcome: 'missed' }));
    expect(m.codes).toContain('engaged_then_lost');
    expect(m.verdict).toBe('watch');
    expect(m.clientAction).toMatch(/connaissances/i);
  });

  it('ne conclut pas d\'un appelant parti au premier tour', () => {
    expect(postMortemOf(vapi({ callerTurns: 1 }, { outcome: 'missed' })).codes).not.toContain(
      'engaged_then_lost',
    );
  });

  it('signale une recherche en cours d\'appel comme une lacune du prompt', () => {
    const m = postMortemOf(vapi({ toolCalls: [{ name: 'lookupKnowledgeFaq', ms: 80 }] }));
    expect(m.codes).toContain('knowledge_lookup');
    expect(m.clientAction).toBeTruthy();
  });
});

describe('postMortemOf — le rythme', () => {
  it('signale l\'agent qui parle par-dessus', () => {
    expect(postMortemOf(vapi({ hardBargeIns: 3 })).codes).toContain('agent_talks_over');
  });

  it('signale la fin de tour qui fait attendre (chemin Vapi)', () => {
    expect(postMortemOf(vapi({ latency: { total: { p95: 1400 } } })).codes).toContain('slow_turns');
  });

  it('signale la fin de tour qui fait attendre (chemin voice-core)', () => {
    const m = postMortemOf(voiceCore({ tours: 9, total_p95: 1500 }));
    expect(m.codes).toContain('slow_turns');
  });
});

describe('readSignals — les deux formes de métriques', () => {
  it('nomme le chemin, parce que les deux ne se lisent pas pareil', () => {
    expect(readSignals({ source: 'voice-core', latency: {} }).source).toBe('voice-core');
    expect(readSignals({ realtime: {} }).source).toBe('vapi');
    expect(readSignals(null).source).toBe('unknown');
  });

  it('ne déguise pas les tours de l\'AGENT en tours de l\'appelant', () => {
    // voice-core ne compte que les tours de l'agent : les confondre ferait
    // croire à un appel engagé sur un appel où l'appelant a à peine parlé.
    const m = postMortemOf(voiceCore({ tours: 12 }, { outcome: 'missed' }));
    expect(m.codes).not.toContain('engaged_then_lost');
  });

  it('laisse le chiffre absent plutôt que d\'inventer un zéro', () => {
    const s = readSignals({ source: 'voice-core', latency: { total_p50: 500 } });
    expect(s.callerTurns).toBeUndefined();
    expect(s.hardBargeIns).toBeUndefined();
    expect(s.totalP95).toBeUndefined();
  });
});

describe('postMortemOf — ce que l\'appelant a ressenti', () => {
  it('signale une réclamation — l\'appel le plus mécontent portait un voyant vert', () => {
    const m = postMortemOf(call({ outcome: 'complaint' }));
    expect(m.codes).toContain('caller_unhappy');
    expect(m.verdict).toBe('watch');
    expect(m.clientAction).toMatch(/satisfait/i);
    expect(m.evidence.join(' ')).toContain('réclamation');
  });

  it('signale un appelant mécontent même quand l\'issue dit que l\'appel a servi', () => {
    const m = postMortemOf(call({ outcome: 'info_provided', sentiment: 'negative' }));
    expect(m.codes).toContain('caller_unhappy');
    expect(m.evidence.join(' ')).toContain('sentiment négatif');
  });

  it('le lit aussi sur le chemin voice-core, sans tours d\'appelant à sa disposition', () => {
    // `callerTurns` n'existe pas sur ce chemin : une condition posée dessus
    // aurait rendu ce code muet sur tous les appels voice-core.
    const m = postMortemOf(voiceCore({ total_p95: 400 }, { outcome: 'complaint' }));
    expect(m.codes).toContain('caller_unhappy');
  });

  it('ne transforme jamais un client mécontent en correctif de code', () => {
    const m = postMortemOf(call({ outcome: 'complaint' }));
    expect(m.needsDeveloper).toBe(false);
    expect(m.verdict).not.toBe('broken');
  });

  it('laisse un appel satisfait tranquille', () => {
    expect(postMortemOf(call({ sentiment: 'positive' })).codes).toEqual([]);
  });

  it('ne masque pas un vrai défaut : le code de développeur reste prioritaire', () => {
    const m = postMortemOf(
      vapi({ toolCalls: [{ name: 'createBooking:error', ms: 90 }] }, { outcome: 'complaint' }),
    );
    expect(m.verdict).toBe('broken');
    expect(m.codes).toEqual(expect.arrayContaining(['tool_failed', 'caller_unhappy']));
    expect(m.needsDeveloper).toBe(true);
  });
});
