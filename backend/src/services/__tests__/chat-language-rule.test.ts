import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Le chat du portail ne mélange plus les langues.
 *
 * Relevé sur une vraie conversation, 11/09/2026: « Great! If you need any
 * changes or have questions in the future, feel free to ask. Bonne journée! »
 * Deux langues dans une seule phrase, puis un tour entier en français après un
 * tour entier en anglais.
 *
 * Deux causes, et il fallait les deux.
 *
 * 1. La consigne de langue était ENFOUIE au milieu d'un long prompt
 *    (« Reply in French, concise and friendly »), donc recouverte par ce qui
 *    l'entourait, et le modèle reflétait la langue de son interlocuteur.
 * 2. Elle ne disait pas de ne pas MÉLANGER. Répondre « dans la bonne langue »
 *    n'exclut pas, pour un modèle, d'y glisser une formule d'une autre.
 */
function source(): string {
  return readFileSync(join(__dirname, '..', 'assistant-chat.service.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('la langue du chat de configuration', () => {
  const src = source();

  it('lit la langue par la règle PARTAGÉE, pas par une copie locale', () => {
    /* La règle qui vivait ici mettait le pays au-dessus du réglage, et ne
       connaissait pas le néerlandais. */
    expect(src).toContain('clientLocale(client)');
    expect(src).not.toMatch(/const\s+isFr\s*=\s*client\.agentLanguage/);
  });

  it('connaît les TROIS langues', () => {
    // Le chat était binaire: un client flamand n'avait que l'anglais.
    expect(src).toMatch(/nl:\s*'Dutch'/);
  });

  it('interdit explicitement de mélanger', () => {
    expect(src).toContain('Never mix languages inside a reply');
  });

  it('pose la règle EN TÊTE des deux prompts', () => {
    /* Une consigne de langue enfouie se fait recouvrir. Les deux modes du chat,
       configuration et test de réceptionniste, la portent en premier. */
    const posee = src.split('languageRule(lang)').length - 1;
    expect(posee).toBeGreaterThanOrEqual(2);
  });

  it('ne laisse plus un appelant décider de la langue à la place du client', () => {
    /* `voiceConfigPrompt(client, fr)` était un huitième endroit où la règle
       pouvait diverger. */
    expect(src).not.toMatch(/voiceConfigPrompt\([^)]*isFr/);
  });
});
