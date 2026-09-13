import { describe, it, expect } from 'vitest';
import { setupCompleteness, setupItems } from '../setup-completeness';
import { knowledgePreset } from '../../config/knowledge-presets';

/* Retour du 13/09/2026 : « le compte est activable avec peu d'informations ».
   Le score dit combien il manque, par métier, et quoi en premier. */

const empty = { businessType: 'dental', transferNumber: null, vapiConfig: null };

describe('setupCompleteness', () => {
  it('un compte neuf est à zéro, et le numéro de transfert vient en premier', () => {
    const s = setupCompleteness(empty);
    expect(s.score).toBe(0);
    expect(s.niche).toBe('dental');
    expect(s.missing[0].id).toBe('transferNumber');
    expect(s.missing[0].to).toContain('/dashboard/setup/guide');
    /* Puis ce qui pèse deux : horaires, services, urgence, annulation,
       mutuelles ; dans l'ordre du preset pour les champs. */
    expect(s.missing.slice(1, 6).map(i => i.id)).toEqual([
      'hours', 'services', 'field:insuranceAccepted', 'field:emergencyProtocol', 'field:cancellationPolicy',
    ]);
  });

  it('les champs sont ceux du preset du métier, avec leur exemple en indice', () => {
    const items = setupItems({ ...empty, businessType: 'restaurant' });
    const fields = items.filter(i => i.id.startsWith('field:'));
    expect(fields.map(i => i.id.slice(6))).toEqual(knowledgePreset('restaurant').fields.map(f => f.id));
    expect(fields[0].hint).toBe(knowledgePreset('restaurant').fields[0].placeholder);
  });

  it('compte ce qui est rempli et pondère', () => {
    const preset = knowledgePreset('dental');
    const knowledge = Object.fromEntries(preset.fields.map(f => [f.id, 'rempli']));
    const full = setupCompleteness({
      businessType: 'dental',
      transferNumber: '+32475000000',
      vapiConfig: {
        hours: { monday: { open: true, from: '09:00', to: '18:00' } },
        items: [{ name: 'Détartrage', price: '80 €' }],
        knowledge,
        faqEntries: [{ q: 'Parking ?', a: 'Oui' }],
      },
    });
    expect(full.score).toBe(100);
    expect(full.missing).toEqual([]);

    const half = setupCompleteness({ ...empty, transferNumber: '+32475000000', vapiConfig: { hours: {} } });
    /* 3 (transfert) + 2 (horaires) sur 3+2+2+ (6 champs: 3 lourds ×2 + 3 ×1 = 9) +1 = 17. */
    expect(half.score).toBe(Math.round((500) / 17));
    expect(half.missing.map(i => i.id)).not.toContain('transferNumber');
  });

  it('un espace ou un tableau ne comptent pas comme remplis', () => {
    const s = setupCompleteness({
      businessType: 'salon',
      transferNumber: '   ',
      vapiConfig: { hours: [], items: [{ name: ' ' }], knowledge: { cancellationPolicy: ' ' }, faq: '' },
    });
    expect(s.done).toBe(0);
  });

  it('porte les lacunes ouvertes, jamais négatives', () => {
    expect(setupCompleteness(empty, 3).openGaps).toBe(3);
    expect(setupCompleteness(empty, -1).openGaps).toBe(0);
  });

  it('un métier inconnu tombe sur le preset par défaut sans casser', () => {
    const s = setupCompleteness({ businessType: 'Boutique de vélos', transferNumber: null, vapiConfig: {} });
    expect(s.niche).toBe('default');
    expect(s.total).toBeGreaterThanOrEqual(4);
  });
});
