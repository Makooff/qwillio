/**
 * Régression — écrans autonomes routés + closer.
 *
 * L'instruction utilisateur « ALL » étend la règle « fond neutre + contour
 * mauve + pilule » aux pages autonomes encore en fond mauve et à l'espace
 * closer. Cet audit statique verrouille les contrôles des fichiers concernés:
 * pas de remplissage mauve plein, pas de lavage mauve inline > 15 %, pas de
 * rayon plafonné sur les boutons de commande, et états de sélection exposés.
 */
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

const sources = import.meta.glob('./**/*.tsx', { as: 'raw', eager: true });

const TARGETS = [
  'Onboarding.tsx',
  'SelfOnboard.tsx',
  'ClientPortal.tsx',
  'closer/CloserSession.tsx',
  'closer/CloserProspects.tsx',
  'closer/CloserFollowUps.tsx',
  'closer/CloserAccount.tsx',
];

function read(rel: string): string {
  const key = `./${rel}`;
  const mod = sources[key];
  if (typeof mod !== 'string') throw new Error(`source introuvable: ${key}`);
  return mod;
}

// Inspect only opening control attributes, never child icons/progress bars.
function controls(rel: string): string {
  const file = ts.createSourceFile(rel, read(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const attrs: string[] = [];
  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        ['button', 'motion.button', 'select'].includes(node.tagName.getText(file))) {
      attrs.push(node.attributes.getText(file));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return attrs.join('\n');
}

// Remplissage mauve plein sur un contrôle. Les barres de progression, charts
// et puces de statut ne sont pas des contrôles et restent hors cible.
const FULL_PURPLE_FILL = /bg-\[(?:#7349fe|#8a6fff|#7a5fff)\](?=\s+(?:text-|border|hover:|disabled:|transition))/i;
const HOVER_PURPLE_FILL = /hover:bg-\[(?:#7349fe|#8a6fff|#7a5fff)\]/i;
const INLINE_PURPLE_WASH_ON_CONTROL = /background:\s*'rgba\(122,\s*95,\s*255,\s*0?\.(?:1[6-9]|[2-9][0-9]*)\)'/i;
const CLOSER_SOLID_ACCENT_FILL = /background:\s*pro\.(?:accent|text)\b/;

describe('pages autonomes + closer — fond neutre, contour mauve', () => {
  for (const rel of TARGETS) {
    it(`${rel} — aucun remplissage mauve plein sur contrôle`, () => {
      expect(controls(rel)).not.toMatch(FULL_PURPLE_FILL);
    });

    it(`${rel} — aucun lavage mauve inline > 15 %`, () => {
      expect(controls(rel)).not.toMatch(INLINE_PURPLE_WASH_ON_CONTROL);
    });
  }

  for (const rel of TARGETS.filter(p => p.startsWith('closer/'))) {
    it(`${rel} — aucun fond accent/solide inline sur contrôle`, () => {
      expect(controls(rel)).not.toMatch(CLOSER_SOLID_ACCENT_FILL);
    });
  }

  it('SelfOnboard — le survol ne redevient pas mauve', () => {
    expect(read('SelfOnboard.tsx')).not.toMatch(HOVER_PURPLE_FILL);
  });
});

describe('pages autonomes + closer — commandes en pilule', () => {
  for (const rel of TARGETS) {
    it(`${rel} — aucun bouton de commande en rounded-lg/xl`, () => {
      expect(controls(rel)).not.toMatch(/className=\{?["`][^"`]*rounded-(?:lg|xl)/);
    });
  }

  it('Onboarding — les selects sont en pilule', () => {
    expect(read('Onboarding.tsx')).toMatch(/<select[\s\S]{0,300}?rounded-full/);
  });

  it('SelfOnboard — le select métier est en pilule', () => {
    expect(read('SelfOnboard.tsx')).toMatch(/<select[\s\S]{0,300}?rounded-full/);
  });
});

describe('pages autonomes + closer — sélections accessibles', () => {
  // Count JSX selection templates, not the number of options rendered by map().
  const ARIA_PRESSED: Array<[string, number]> = [
    ['Onboarding.tsx', 1],
    ['SelfOnboard.tsx', 1],
    ['ClientPortal.tsx', 1],
    ['closer/CloserSession.tsx', 2],
    ['closer/CloserFollowUps.tsx', 1],
  ];

  for (const [rel, min] of ARIA_PRESSED) {
    it(`${rel} — aria-pressed présent (>= ${min})`, () => {
      const count = (read(rel).match(/aria-pressed=/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(min);
    });
  }
});
