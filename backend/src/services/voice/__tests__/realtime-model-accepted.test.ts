import { describe, it, expect } from 'vitest';
import { env } from '../../../config/env';

/**
 * Le modèle temps réel doit être un identifiant que Vapi accepte.
 *
 * Un modèle refusé ne dégrade pas un appel: il fait refuser l'assistant ENTIER
 * (6octies), et la branche temps réel n'a aucun secours.
 *
 * **Deux valeurs ont été posées ici avant la bonne, pour la même raison.**
 * `gpt-realtime-2.1`, lu dans le catalogue d'OpenAI. Puis `gpt-realtime`,
 * déduit d'un message d'erreur que le script coupait à 600 caractères. Les
 * deux fois, l'identifiant venait d'ailleurs que de l'intermédiaire qui reçoit
 * la charge, et les deux fois il était faux.
 *
 * **La liste ci-dessous n'est plus une déduction.** Elle est recopiée du corps
 * ENTIER d'un 400 de Vapi, relevé le 10/09/2026 une fois la troncature levée,
 * sur les trois variantes temps réel. C'est l'API vivante qui l'a dictée.
 *
 * Elle ne remplace pas `npm run voice:validate`, seule chose qui parle
 * vraiment à Vapi: un catalogue bouge, et celui-ci finira périmé. Elle
 * empêche seulement de reposer une valeur qui n'y a jamais figuré, ce qui est
 * exactement l'erreur commise deux fois.
 */
const REALTIME_ACCEPTED_2026_09_10 = [
  'gpt-4o-realtime-preview-2024-10-01',
  'gpt-4o-realtime-preview-2024-12-17',
  'gpt-4o-mini-realtime-preview-2024-12-17',
  'gpt-realtime-2025-08-28',
  'gpt-realtime-mini-2025-12-15',
  'gpt-realtime-2',
];

/**
 * Refusées à l'usage, sur les trois variantes, message d'erreur à l'appui.
 * Redondant avec la liste ci-dessus, et gardé quand même: le jour où quelqu'un
 * élargira le catalogue à la main, ces deux-là resteront nommées avec leur
 * date, donc leur histoire.
 */
const REFUSED_BY_VAPI = ['gpt-realtime-2.1', 'gpt-realtime'];

describe('VOICE_REALTIME_MODEL', () => {
  it('figure dans le catalogue temps réel que Vapi a énuméré', () => {
    expect(REALTIME_ACCEPTED_2026_09_10).toContain(env.VOICE_REALTIME_MODEL);
  });

  it('n\'est aucune des valeurs que Vapi a refusées', () => {
    expect(REFUSED_BY_VAPI).not.toContain(env.VOICE_REALTIME_MODEL);
  });

  it('a une valeur', () => {
    // Vide, le champ part quand même et emporte l'assistant.
    expect(env.VOICE_REALTIME_MODEL.trim().length).toBeGreaterThan(0);
  });

  it('ne confond pas le nom OpenAI avec l\'identifiant Vapi', () => {
    /* `gpt-realtime` est le nom du modèle chez OpenAI. Chez Vapi, seule la
       forme datée existe. La règle vaut pour toute la famille. */
    for (const bare of ['gpt-realtime', 'gpt-realtime-mini', 'gpt-4o-realtime-preview']) {
      expect(REALTIME_ACCEPTED_2026_09_10).not.toContain(bare);
    }
  });
});

describe('voice:validate — le corps de la réponse', () => {
  it('n\'est plus tronqué', async () => {
    /* Une réponse d'API se lit en entier ou ne se lit pas. C'est la troncature
       qui a fait conclure trop vite, la seconde fois. */
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const script = readFileSync(join(process.cwd(), 'src/scripts/validate-assistant.ts'), 'utf8');
    expect(script).not.toMatch(/body\.slice\(0,\s*\d+\)/);
  });
});
