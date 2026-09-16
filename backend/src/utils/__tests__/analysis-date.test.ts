import { describe, it, expect } from 'vitest';
import { analysisDateRule, parseAnalysisDate } from '../analysis-date';

/**
 * La date rendue par le modèle d'analyse, relue avant d'être posée en base.
 *
 * Le cas qui a fait naître ce module est le premier test: un compte réel
 * portait `2023-09-18` pour une conversation de septembre 2026, et la ligne
 * était donc invisible partout (le calendrier du portail charge un mois,
 * `lookupBooking` et `rescheduleBooking` ne lisent que les rendez-vous à
 * venir). L'appelant demandait à déplacer un rendez-vous qu'il avait, et
 * l'agent répondait « AUCUNE RESERVATION » neuf fois.
 */

const TODAY = '2026-09-16';

describe("la ligne relevée en production", () => {
  it('REFUSE 2023-09-18 vu de septembre 2026', () => {
    const r = parseAnalysisDate('2023-09-18', TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toMatch(/PASSÉE/);
    /* La raison nomme les DEUX dates: sans le « nous sommes le », une alerte
       « date passée » ne dit pas de combien ni par rapport à quoi. */
    expect(r.reason).toContain('2023-09-18');
    expect(r.reason).toContain(TODAY);
  });

  it("ne CORRIGE jamais l'année en la remplaçant", () => {
    /* Remplacer 2023 par 2026 fabriquerait un rendez-vous que personne n'a
       dit: une déduction qui a l'air d'une lecture. Le refus est la réponse. */
    const r = parseAnalysisDate('2023-09-18', TODAY);
    expect(r).not.toHaveProperty('date');
    expect(r).not.toHaveProperty('ymd');
  });
});

describe('ce qui est accepté', () => {
  it('une date du futur, au format attendu', () => {
    const r = parseAnalysisDate('2026-09-18', TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.ymd).toBe('2026-09-18');
  });

  it("AUJOURD'HUI, qui n'est pas passé", () => {
    expect(parseAnalysisDate(TODAY, TODAY).ok).toBe(true);
  });

  it('un horodatage ISO complet, dont on ne garde que le jour', () => {
    /* La consigne dit « YYYY-MM-DD » mais le modèle rend parfois l'ISO
       entier: le refuser perdrait une réservation valide. */
    const r = parseAnalysisDate('2026-09-18T09:00:00.000Z', TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.ymd).toBe('2026-09-18');
  });

  it('stocke à MIDI UTC, pas à minuit', () => {
    /* Un jour stocké à minuit se relit la veille dans un fuseau à l'ouest, et
       le serveur est en Oregon. Même choix que `parseDate` côté outils. */
    const r = parseAnalysisDate('2026-09-18', TODAY);
    if (!r.ok) throw new Error('unreachable');
    expect(r.date.toISOString()).toBe('2026-09-18T12:00:00.000Z');
  });
});

describe('ce qui est refusé', () => {
  it('une forme que `new Date` aurait acceptée à sa façon', () => {
    /* « 18/09/2026 » est lu différemment selon le moteur, et « September 18 »
       n'a pas d'année du tout: les confier à `new Date` est ce qui a produit
       la ligne de 2023. */
    for (const raw of ['18/09/2026', 'September 18', 'next Friday', '2026-9-18']) {
      expect(parseAnalysisDate(raw, TODAY).ok).toBe(false);
    }
  });

  it("un jour qui n'existe pas", () => {
    /* `new Date('2026-02-31T12:00:00Z')` ne lève pas, il glisse au 3 mars:
       un rendez-vous poserait alors une date que personne n'a dite. */
    const r = parseAnalysisDate('2026-02-31', TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toMatch(/inexistant/);
  });

  it('rien du tout', () => {
    for (const raw of [null, undefined, '', '   ', 42, {}]) {
      expect(parseAnalysisDate(raw, TODAY).ok).toBe(false);
    }
  });
});

describe("la consigne donnée au modèle", () => {
  it("dit la date du jour, sans quoi l'année reste à inventer", () => {
    const rule = analysisDateRule(TODAY);
    expect(rule).toContain(TODAY);
    expect(rule).toMatch(/YYYY-MM-DD/);
    expect(rule).toMatch(/[Nn]ever guess a year/);
  });

  it("reste en anglais, comme le reste de la consigne d'analyse", () => {
    /* La langue de la consigne décide de la langue de la réponse:
       `ANALYSIS_LANGUAGE` existe précisément pour forcer l'autre sens sur les
       champs libres, donc traduire cette ligne ferait basculer le reste. */
    expect(analysisDateRule(TODAY)).not.toMatch(/aujourd|jamais|année/i);
  });
});
