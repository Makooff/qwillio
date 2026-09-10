import { describe, it, expect, vi } from 'vitest';
import { fillerFor } from '../voice-tools';

vi.mock('../../../config/database', () => ({ prisma: {} }));

const { receptionistLearningService } = await import('../receptionist-learning.service');

/** `toolFindings` est privé: on l'appelle par son nom, comme le fait l'analyse. */
const findings = (toolCalls: Array<{ name: string; ms: number }>) =>
  (receptionistLearningService as any).toolFindings([{ toolCalls }]) as Array<{
    code: string; severity: string; detail: string; action: string;
  }>;

const silence = (calls: Array<{ name: string; ms: number }>) =>
  findings(calls).find(f => f.code === 'tool_silence')!;

describe('LAT-10 — le silence qu\'un appel d\'outil laisse vraiment', () => {
  it('ne compte pas un outil lent qui est COUVERT par du meublage', () => {
    // Le contrat de meublage est ce qui décide, pas le chronomètre: une phrase
    // de meublage jouée à l'invocation ne laisse aucun silence, même sur trois
    // secondes d'API distante.
    const covered = ['checkAvailability', 'bookAppointment'].filter(
      t => fillerFor(t, 'fr', 'start').length > 0,
    );
    expect(covered.length).toBeGreaterThan(0);
    const f = silence(covered.map(name => ({ name, ms: 3_000 })));
    expect(f.severity).toBe('info');
    expect(f.detail).toContain(`0/${covered.length}`);
  });

  it('compte un outil NON couvert qui dépasse le budget', () => {
    const f = silence([{ name: 'outilSansMeublage', ms: 900 }]);
    expect(f.severity).toBe('warn');
    expect(f.detail).toContain('1/1');
    expect(f.action).toContain('outilSansMeublage');
  });

  it('ne compte pas un outil non couvert qui reste sous le budget', () => {
    // 500 ms est le plafond, pas le seuil d'alerte: en dessous, l'appelant
    // n'entend pas un trou.
    expect(silence([{ name: 'outilSansMeublage', ms: 400 }]).severity).toBe('info');
  });

  it('ignore les échecs, qui sont comptés ailleurs', () => {
    // Un outil en erreur a déjà son propre relevé; le compter ici ferait
    // remonter deux fois le même incident sous deux noms différents.
    expect(silence([{ name: 'checkAvailability:error', ms: 9_000 }]).severity).toBe('info');
  });

  it('publie le chiffre même quand il est bon', () => {
    // Sans dénominateur affiché, un taux qui remonte ne se voit pas remonter.
    const f = silence([{ name: 'checkAvailability', ms: 100 }]);
    expect(f).toBeDefined();
    expect(f.severity).toBe('info');
  });
});
