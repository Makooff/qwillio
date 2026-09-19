import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
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

/**
 * LE TEST NE REGARDAIT QUE `VOICE_REALTIME_MODEL` (19/09/2026).
 *
 * La leçon était figée pour UNE lecture, et deux autres endroits du dépôt
 * nommaient des identifiants temps réel sans que rien ne les surveille:
 *
 *  - `voice-lab.controller.ts` proposait `gpt-realtime-2.1` et
 *    `gpt-realtime-2.1-mini` dans une liste déroulante. Le premier est
 *    nommément refusé par Vapi, le second n'a jamais figuré au catalogue.
 *    Deux valeurs sur trois, à un clic, et un modèle refusé fait tomber
 *    l'assistant ENTIER (6octies).
 *  - `.env.example` recommandait `gpt-realtime-2.1` comme « la génération
 *    courante », c'est-à-dire le fichier dont on part pour configurer.
 *
 * C'est 6sexvicies dans sa forme la plus simple: quand une leçon nomme une
 * valeur interdite, TOUS les endroits qui l'écrivent comptent, pas seulement
 * celui où elle a été payée.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|#).*$/gm, '');

describe('aucun autre fichier ne nomme un identifiant refusé', () => {
  const files: Array<[string, string]> = [
    ['voice-lab.controller.ts', join(__dirname, '../../../controllers/voice-lab.controller.ts')],
    ['.env.example', join(__dirname, '../../../../.env.example')],
  ];

  for (const [label, path] of files) {
    it(`${label} ne propose aucune valeur que Vapi a refusée`, () => {
      /* Les commentaires sont retirés d'abord: celui qui explique un correctif
         nomme forcément la forme fautive, donc le test tomberait sur sa propre
         explication (piège déjà payé en 6vicies). */
      const body = stripComments(readFileSync(path, 'utf8'));
      for (const refused of REFUSED_BY_VAPI) {
        /* Borné à droite: `gpt-realtime` est un préfixe de tous les autres, et
           sans cette borne le test refuserait le catalogue entier. */
        expect(body).not.toMatch(new RegExp(`${refused}(?![\\w.-])`));
      }
    });

    it(`${label} ne nomme que des identifiants du catalogue`, () => {
      const body = stripComments(readFileSync(path, 'utf8'));
      const named = body.match(/gpt-(?:4o-)?(?:mini-)?realtime[\w.-]*/g) ?? [];
      for (const id of named) {
        expect(REALTIME_ACCEPTED_2026_09_10).toContain(id);
      }
    });
  }
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
