import { describe, it, expect } from 'vitest';
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserMessage,
  parsePatterns,
} from '../call-patterns';

/**
 * Le parse est le seul endroit où un enseignement faux peut entrer dans la
 * boucle : un slug instable casse l'agrégation, une quote inventée casse la
 * relecture, une liste inventée casse la confiance. Ces tests figent le
 * contrat que le service applique sans le relire.
 */

const VALID = {
  slug: 'reservation-annoncee-avant-outil',
  kind: 'conversation',
  title: 'Réservation annoncée avant le retour de l’outil',
  summary: 'L’agent dit « c’est réservé » avant RESERVE. La règle : annoncer seulement après le retour outil.',
  quote: 'Agent : Parfait, c’est réservé pour mardi.',
};

describe('parsePatterns', () => {
  it('lit le JSON propre', () => {
    const out = parsePatterns(JSON.stringify({ patterns: [VALID] }));
    expect(out).toHaveLength(1);
    expect(out[0].slug).toBe('reservation-annoncee-avant-outil');
    expect(out[0].kind).toBe('conversation');
  });

  it('défait une clôture de code autour du JSON', () => {
    const out = parsePatterns('Voici l’analyse :\n```json\n{"patterns": [' + JSON.stringify(VALID) + ']}\n```');
    expect(out).toHaveLength(1);
  });

  it('rend une liste vide quand le modèle n’a rien à dire — le cas sain', () => {
    expect(parsePatterns('{"patterns": []}')).toEqual([]);
    expect(parsePatterns('')).toEqual([]);
    expect(parsePatterns('pas de json du tout')).toEqual([]);
    expect(parsePatterns('{cassé')).toEqual([]);
  });

  it('rejette une entrée sans quote : pas de preuve, pas d’enseignement', () => {
    const sansQuote = { ...VALID, quote: '' };
    expect(parsePatterns(JSON.stringify({ patterns: [sansQuote] }))).toEqual([]);
  });

  it('rejette un slug instable ou invalide — il casserait l’agrégation', () => {
    for (const slug of ['Appel du 12/09', 'x', 'avec espaces', 'MAJUSCULES!', '']) {
      const out = parsePatterns(JSON.stringify({ patterns: [{ ...VALID, slug }] }));
      expect(out).toEqual([]);
    }
  });

  it('normalise un kind inconnu en conversation et garde threshold', () => {
    const seuil = { ...VALID, slug: 'attente-trop-longue', kind: 'threshold' };
    const bizarre = { ...VALID, slug: 'registre-qui-glisse', kind: 'autre' };
    const out = parsePatterns(JSON.stringify({ patterns: [seuil, bizarre] }));
    expect(out[0].kind).toBe('threshold');
    expect(out[1].kind).toBe('conversation');
  });

  it('déduplique par slug et plafonne à trois', () => {
    const beaucoup = Array.from({ length: 6 }, (_, i) => ({ ...VALID, slug: `pattern-${i}` }));
    const out = parsePatterns(JSON.stringify({ patterns: beaucoup }));
    expect(out).toHaveLength(3);
    const doublons = parsePatterns(JSON.stringify({ patterns: [VALID, VALID] }));
    expect(doublons).toHaveLength(1);
  });

  it('tronque les champs qui débordent', () => {
    const long = { ...VALID, title: 't'.repeat(500), quote: 'q'.repeat(900) };
    const out = parsePatterns(JSON.stringify({ patterns: [long] }));
    expect(out[0].title).toHaveLength(200);
    expect(out[0].quote).toHaveLength(500);
  });
});

describe('buildAnalysisUserMessage', () => {
  it('donne le verdict mesuré avant le transcript', () => {
    const msg = buildAnalysisUserMessage({
      transcript: 'Agent : bonjour',
      verdict: 'broken',
      codes: ['dead_line'],
      evidence: ['aucun mot pour 42 s'],
    });
    expect(msg).toContain('Verdict des règles : broken (dead_line)');
    expect(msg).toContain('aucun mot pour 42 s');
    expect(msg.indexOf('Verdict')).toBeLessThan(msg.indexOf('TRANSCRIPT'));
  });

  it('réduit un très long transcript en gardant les deux bouts', () => {
    const t = 'début '.repeat(1000) + 'milieu '.repeat(5000) + 'fin '.repeat(1000);
    const msg = buildAnalysisUserMessage({ transcript: t, verdict: 'watch', codes: [], evidence: [] });
    expect(msg).toContain('caractères centraux omis');
    expect(msg.length).toBeLessThan(t.length);
    expect(msg.startsWith('Verdict')).toBe(true);
  });
});

describe('ANALYSIS_SYSTEM_PROMPT', () => {
  it('exige la liste vide plutôt que le pattern inventé', () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain('liste vide');
    expect(ANALYSIS_SYSTEM_PROMPT).toContain('slug');
    expect(ANALYSIS_SYSTEM_PROMPT).toContain('verbatim');
  });
});
