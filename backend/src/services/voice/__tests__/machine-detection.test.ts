import { describe, it, expect } from 'vitest';
import { machineDetectionBlock } from '../machine-detection';

/**
 * REL-5: les deux erreurs ne coûtent pas la même chose.
 *
 * Classer une machine en humain gaspille quinze secondes. Classer un humain en
 * machine raccroche au nez d'une personne, et c'est irréparable: elle ne
 * rappellera pas, et personne chez nous ne saura jamais que c'est arrivé.
 */
describe('machineDetectionBlock', () => {
  for (const lang of ['fr', 'en'] as const) {
    it(`pose le verdict par défaut sur « humain » (${lang})`, () => {
      const block = machineDetectionBlock(lang);
      expect(block).toMatch(lang === 'fr' ? /dans le doute, c'est un HUMAIN/ : /when in doubt, it is a HUMAN/);
      expect(block).toMatch(lang === 'fr' ? /signe EXPLICITE/ : /EXPLICIT sign/);
    });

    it(`ne raccroche plus sur une voix « trop parfaite » (${lang})`, () => {
      // C'est la description exacte d'une secrétaire expérimentée qui décroche
      // mille fois par jour. Ce marqueur faisait raccrocher au nez des humains
      // les plus professionnels, c'est-à-dire les prospects les mieux tenus.
      const block = machineDetectionBlock(lang);
      /* L'assertion porte sur les PUCES, pas sur le texte entier: le bloc parle
         encore de la voix trop parfaite, mais pour dire qu'elle ne prouve rien.
         Ce qui compte est qu'elle ne figure plus dans la liste des signes qui
         font raccrocher. */
      const markers = block.split('\n').filter(l => l.startsWith('- '));
      expect(markers.some(l => /trop parfaite|perfectly polished|trop lisse|too smooth/.test(l))).toBe(false);
      expect(block).toMatch(lang === 'fr' ? /ne prouve RIEN/ : /proves NOTHING/);
    });

    it(`garde la salutation d'une syllabe comme signal vert (${lang})`, () => {
      const block = machineDetectionBlock(lang);
      expect(block).toMatch(lang === 'fr' ? /"Allô \?", "Oui \?"/ : /"Hello\?", "Yeah\?"/);
    });

    it(`ne garde comme marqueur d'IA qu'une auto-présentation ou un menu (${lang})`, () => {
      const block = machineDetectionBlock(lang);
      expect(block).toMatch(lang === 'fr' ? /se présente lui-même comme un assistant/ : /introduces itself as a virtual/);
    });
  }
});
