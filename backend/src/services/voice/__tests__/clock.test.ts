import { describe, it, expect } from 'vitest';
import { clockLine, vapiClockLine, todayIso, spokenDate, spokenDateAloud } from '../clock';

/**
 * La date, dite à l'agent.
 *
 * Appel réel du 12/09/2026: « un détartrage la semaine prochaine », et l'agent
 * propose « lundi 17 juin », qui n'est ni un lundi ni à venir. Rien ne lui
 * disait quel jour on était.
 */
const NOW = new Date('2026-09-12T04:31:00Z');

describe('clockLine', () => {
  it('dit le jour de la semaine, la date et l\'heure dans le fuseau de l\'entreprise', () => {
    const line = clockLine('fr', 'Europe/Brussels', NOW);
    expect(line).toContain('samedi 12 septembre 2026');
    expect(line).toContain('06:31');
    expect(line).toContain('Europe/Brussels');
  });

  it('existe dans les trois langues', () => {
    expect(clockLine('en', 'Europe/Brussels', NOW)).toContain('Saturday, 12 September 2026');
    expect(clockLine('nl', 'Europe/Brussels', NOW)).toContain('zaterdag 12 september 2026');
  });

  it('dit que les dates relatives se comptent d\'aujourd\'hui', () => {
    expect(clockLine('fr', 'Europe/Paris', NOW)).toMatch(/à partir d'aujourd'hui/);
  });
});

describe('vapiClockLine', () => {
  it('porte le gabarit que Vapi remplit à chaque appel, dans le fuseau donné', () => {
    /* L'assistant enregistré a un prompt FIGÉ: une date réelle y serait
       fausse dès le lendemain. */
    const line = vapiClockLine('fr', 'Europe/Brussels');
    expect(line).toContain('{{"now" | date: "%A %d %B %Y, %H:%M", "Europe/Brussels"}}');
    expect(line).toMatch(/^Nous sommes le /);
  });
});

describe('todayIso', () => {
  it('rend le jour du FUSEAU, pas celui d\'UTC', () => {
    // 23h30 UTC, c'est déjà demain à Bruxelles.
    expect(todayIso('Europe/Brussels', new Date('2026-09-12T23:30:00Z'))).toBe('2026-09-13');
    expect(todayIso('America/New_York', new Date('2026-09-12T23:30:00Z'))).toBe('2026-09-12');
  });
});

describe('spokenDate', () => {
  it('nomme le jour de la semaine, que le modèle ne calcule pas', () => {
    expect(spokenDate(new Date('2026-09-16T12:00:00Z'), 'fr', 'Europe/Brussels')).toBe('mercredi 16 septembre 2026');
  });
});

/**
 * L'ANNÉE NE SE DIT QUE QUAND ELLE APPREND QUELQUE CHOSE (21/09/2026).
 *
 * Appel réel: « Vous avez rendez-vous le vendredi 25 septembre, 2 0 2 6 à 14 ».
 * Cartesia épelle l'année chiffre par chiffre. Relevé le 13/09 avec « à traiter
 * si ça se répète » (6sextrigesies); ça vient de se répéter.
 *
 * DEUX fonctions, et les tests de `clockLine` ci-dessus disent pourquoi: la
 * version longue sert à RAISONNER, et une date du jour sans année est ce qui a
 * fait écrire `2023-09-18` en base (6octoquadragesies).
 */
describe('spokenDateAloud', () => {
  const TZ = 'Europe/Brussels';
  const sept2026 = new Date('2026-09-21T12:00:00Z');

  it("tait l'année courante, que l'appelant n'a pas besoin d'entendre épeler", () => {
    const said = spokenDateAloud(new Date('2026-09-25T12:00:00Z'), 'fr', TZ, sept2026);
    expect(said).toContain('vendredi');
    expect(said).toContain('25 septembre');
    expect(said).not.toContain('2026');
  });

  it("garde une AUTRE année, parce que là elle est un fait", () => {
    /* Une réservation de mars 2027 lue sans son année a fait chercher le modèle
       en septembre 2026 (6octoquinquagesies). */
    expect(spokenDateAloud(new Date('2027-03-22T12:00:00Z'), 'fr', TZ, sept2026)).toContain('2027');
  });

  it('nomme toujours le jour de la semaine, dans les trois langues', () => {
    /* `weekdayNote` lit le PREMIER mot de cette chaîne pour interdire au modèle
       d'annoncer un autre jour (6novoquinquagesies). */
    for (const lang of ['fr', 'en', 'nl'] as const) {
      const said = spokenDateAloud(new Date('2026-09-25T12:00:00Z'), lang, TZ, sept2026);
      expect(said.split(' ')[0].length).toBeGreaterThan(2);
      expect(said).not.toMatch(/2026/);
    }
  });

  it("la version longue, elle, garde l'année: c'est celle qui sert à raisonner", () => {
    expect(spokenDate(new Date('2026-09-25T12:00:00Z'), 'fr', TZ)).toContain('2026');
  });
});
