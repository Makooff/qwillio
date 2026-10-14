import { describe, it, expect } from 'vitest';

const TRANSCRIPT = 'Agent : Parfait, c’est réservé pour mardi.';

// RED: failures must remain pending, and evidence must actually exist.
describe('strict review contract', () => {
  const parse = (raw: string, transcript = TRANSCRIPT) => (parsePatterns as any)(raw, transcript);
  it.each(['', 'invalid', '{broken', '{}', '{"patterns":null}', '[]'])('rejects invalid response %s', raw => {
    expect(() => parse(raw)).toThrow();
  });
  it('rejects unknown kind rather than silently promoting it', () => {
    expect(() => parse(JSON.stringify({ patterns: [{ ...VALID, kind: 'other' }] }))).toThrow();
  });
  it('accepts knowledge without turning it into a global conversation rule', () => {
    expect(parse(JSON.stringify({ patterns: [{ ...VALID, kind: 'knowledge' }] }))[0].kind).toBe('knowledge');
  });
  it.each(['Agent : parfait, c’est réservé pour mardi.', 'Agent : C’est réservé mercredi.', "Agent : Parfait, c'est réservé pour mardi."])
    ('rejects paraphrased proof %s', quote => {
      expect(() => parse(JSON.stringify({ patterns: [{ ...VALID, quote }] }))).toThrow();
    });
  it('normalizes whitespace only', () => {
    expect(parse(JSON.stringify({ patterns: [{ ...VALID, quote: 'Agent :   Parfait, c’est réservé\npour mardi.' }] }))).toHaveLength(1);
  });
  it('rejects invented numeric facts and prices', () => {
    expect(() => parse(JSON.stringify({ patterns: [{ ...VALID, summary: 'Facturer 75 euros.' }] }))).toThrow();
  });
  it('does not omit the middle of the transcript', () => {
    const t = 'début '.repeat(1000) + 'PREUVE CENTRALE' + ' fin'.repeat(2000);
    expect(buildAnalysisUserMessage({ transcript: t, verdict: 'ok', codes: [], evidence: [] })).toContain('PREUVE CENTRALE');
  });
  it('provides authentic business context and bounded knowledge', () => {
    const msg = buildAnalysisUserMessage({ transcript: TRANSCRIPT, verdict: 'ok', codes: [], evidence: [],
      business: { niche: 'dental', businessName: 'Cabinet Test', country: 'BE', rules: ['Ne pas diagnostiquer'],
        requiredBusinessFacts: ['mutuelles acceptées'], sources: ['référence métier'], knowledge: ['parking cour intérieure', 'K'.repeat(20000)] } } as any);
    expect(msg).toContain('dental');
    expect(msg).toContain('Cabinet Test');
    expect(msg).toContain('Ne pas diagnostiquer');
    expect(msg).toContain('cour intérieure');
    expect(msg.length).toBeLessThan(8000);
  });
});
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserMessage,
  parsePatterns as parseReviewedPatterns,
} from '../call-patterns';
const parsePatterns = (raw: string, transcript = TRANSCRIPT) => parseReviewedPatterns(raw, transcript);

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
    const out = parsePatterns('```json\n{"patterns": [' + JSON.stringify(VALID) + ']}\n```');
    expect(out).toHaveLength(1);
  });

  it('rend une liste vide quand le modèle n’a rien à dire — le cas sain', () => {
    expect(parsePatterns('{"patterns": []}')).toEqual([]);
    expect(() => parsePatterns('')).toThrow();
    expect(() => parsePatterns('pas de json du tout')).toThrow();
    expect(() => parsePatterns('{cassé')).toThrow();
  });

  it('rejette une entrée sans quote : pas de preuve, pas d’enseignement', () => {
    const sansQuote = { ...VALID, quote: '' };
    expect(() => parsePatterns(JSON.stringify({ patterns: [sansQuote] }))).toThrow();
  });

  it('rejette un slug instable ou invalide — il casserait l’agrégation', () => {
    for (const slug of ['Appel du 12/09', 'x', 'avec espaces', 'MAJUSCULES!', '']) {
      expect(() => parsePatterns(JSON.stringify({ patterns: [{ ...VALID, slug }] }))).toThrow();
    }
  });

  it('refuse un kind inconnu et garde threshold', () => {
    const seuil = { ...VALID, slug: 'attente-trop-longue', kind: 'threshold' };
    const bizarre = { ...VALID, slug: 'registre-qui-glisse', kind: 'autre' };
    expect(parsePatterns(JSON.stringify({ patterns: [seuil] }))[0].kind).toBe('threshold');
    expect(() => parsePatterns(JSON.stringify({ patterns: [seuil, bizarre] }))).toThrow();
  });

  it('déduplique par slug et plafonne à trois', () => {
    const beaucoup = Array.from({ length: 6 }, (_, i) => ({ ...VALID, slug: `pattern-${i}` }));
    const out = parsePatterns(JSON.stringify({ patterns: beaucoup }));
    expect(out).toHaveLength(3);
    const doublons = parsePatterns(JSON.stringify({ patterns: [VALID, VALID] }));
    expect(doublons).toHaveLength(1);
  });

  it('borne le titre mais garde la preuve entière', () => {
    const long = { ...VALID, title: 't'.repeat(500), quote: 'q'.repeat(900) };
    const out = parsePatterns(JSON.stringify({ patterns: [long] }), long.quote);
    expect(out[0].title).toHaveLength(200);
    expect(out[0].quote).toHaveLength(900);
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

  it('garde le transcript intégral', () => {
    const t = 'début '.repeat(1000) + 'milieu '.repeat(5000) + 'fin '.repeat(1000);
    const msg = buildAnalysisUserMessage({ transcript: t, verdict: 'watch', codes: [], evidence: [] });
    expect(msg).toContain(t);
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
