import { describe, it, expect } from 'vitest';
import { knowledgeFieldsBlock, knowledgePreset } from '../knowledge-presets';

/**
 * Les champs nommés, et le chemin sur lequel ils avaient disparu.
 *
 * Le formulaire du portail propose des champs par métier — « Mutuelles
 * acceptées », « Politique d'annulation », « Accès et stationnement ». Le
 * prompt de l'assistant enregistré les posait; celui du chemin temps réel ne
 * connaissait que les entrées `businessKnowledge`. Le client remplissait, l'écran
 * disait enregistré, et l'agent répondait qu'il ne savait pas.
 */
describe('knowledgeFieldsBlock', () => {
  it('rend le LIBELLÉ du métier, jamais l\'identifiant', () => {
    const preset = knowledgePreset('restaurant');
    const field = preset.fields.find(f => f.id === 'cancellationPolicy');
    expect(field, 'le preset restaurant doit porter cancellationPolicy').toBeDefined();

    const block = knowledgeFieldsBlock({ cancellationPolicy: 'Gratuite jusqu\'à 4 h avant' }, 'restaurant');

    /* Le modèle lit une phrase française, pas du camelCase: un identifiant se
       devine mal, et se devine différemment d'un tour à l'autre. */
    expect(block).toContain(field!.label);
    expect(block).not.toContain('cancellationPolicy');
    expect(block).toContain('Gratuite jusqu\'à 4 h avant');
  });

  it('garde une clé inconnue plutôt que de la perdre', () => {
    /* Elle vient d'un preset qui a changé depuis. Une valeur écrite par un
       client vaut mieux brute que jetée en silence. */
    const block = knowledgeFieldsBlock({ champDisparu: 'Livraison le samedi' }, 'restaurant');
    expect(block).toContain('champDisparu: Livraison le samedi');
  });

  it('ignore le vide, et ne rend RIEN plutôt qu\'un en-tête seul', () => {
    // Un « BUSINESS DETAILS: » suivi de rien coûterait des tokens à chaque tour
    // et n'apprendrait rien au modèle.
    expect(knowledgeFieldsBlock({ a: '   ', b: '' }, 'restaurant')).toBe('');
    expect(knowledgeFieldsBlock({}, 'restaurant')).toBe('');
    expect(knowledgeFieldsBlock(null, 'restaurant')).toBe('');
    expect(knowledgeFieldsBlock(['pas un objet'], 'restaurant')).toBe('');
  });

  it('tient sur un métier inconnu', () => {
    // `knowledgePreset` retombe toujours sur une niche; le bloc doit sortir
    // quand même, libellé par défaut ou pas.
    expect(knowledgeFieldsBlock({ parkingAccess: 'Parking à 50 m' }, 'métier inexistant'))
      .toContain('Parking à 50 m');
  });
});

/**
 * Les champs nommés survivent au prompt, y compris sur une grosse base.
 *
 * Le bloc est tronqué à 4 000 caractères par `sanitizeUntrusted`. C'est pour
 * ça que l'orchestrateur met les champs nommés EN PREMIER: ils décrivent
 * l'entreprise, et une FAQ volumineuse ne doit pas les pousser hors du prompt.
 * L'ordre inverse serait invisible — le prompt se construirait sans erreur, et
 * l'agent ignorerait simplement l'entreprise.
 */
describe('les champs nommés dans le prompt', () => {
  it('survit à une base de connaissances qui déborde', async () => {
    const { buildSystemPrompt } = await import('../../services/voice/system-prompt');
    const { profileFor, SCENARIOS } = await import('../../evals/scenarios');

    const fields = knowledgeFieldsBlock({ parkingAccess: 'Parking Flagey, 50 m' }, 'restaurant');
    const enormousFaq = 'FAQ: ' + 'une entrée de connaissance très bavarde. '.repeat(300);
    const block = [fields, enormousFaq].join('\n\n');

    const prompt = buildSystemPrompt(
      profileFor(SCENARIOS[0]),
      { previousCalls: 0, lastCallAt: null, lastSummary: null, knownName: null, hasUpcomingBooking: false },
      block,
    );

    expect(prompt).toContain('Parking Flagey');
    // La FAQ, elle, est bien coupée: c'est la preuve que la troncature mord.
    expect(prompt.length).toBeLessThan(block.length);
  });
});
