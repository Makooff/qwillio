import { describe, it, expect, beforeEach } from 'vitest';
import { spokenPrefix } from '../spoken-prefix';
import { callSessionStore } from '../call-session.store';
import { llmStreamService } from '../llm-stream.service';

/** 90 caractères à 15 c/s, soit six secondes d'énoncé. */
const SIX_SECONDS =
  'Bonjour, je vous propose mardi neuf heures, mercredi quatorze heures ou jeudi matin.';

describe('spokenPrefix — ce que l\'appelant a entendu', () => {
  it('coupe un énoncé de six secondes interrompu à une seconde et demie', () => {
    const heard = spokenPrefix(SIX_SECONDS, 1_500, 'fr');
    expect(heard.truncated).toBe(true);
    // Un quart du temps: on garde le début, jamais la fin.
    expect(SIX_SECONDS.startsWith(heard.text.replace('…', ''))).toBe(true);
    expect(heard.text.length).toBeLessThan(SIX_SECONDS.length / 2);
    // Le créneau du milieu n'a jamais été joué: il ne doit pas rester.
    expect(heard.text).not.toContain('quatorze heures');
  });

  it('ne tranche pas un mot en deux', () => {
    const words = SIX_SECONDS.split(/\s+/);
    for (const ms of [400, 900, 1_500, 2_600, 3_800]) {
      const kept = spokenPrefix(SIX_SECONDS, ms, 'fr').text.replace('…', '');
      if (!kept) continue;
      const keptWords = kept.split(/\s+/);
      // Chaque mot gardé est un mot ENTIER de l'énoncé, au même rang. La
      // ponctuation faible tombe sur le dernier, remplacée par les points de
      // suspension.
      keptWords.forEach((w, i) => expect(words[i].replace(/[,;:]$/, '')).toBe(w.replace(/[,;:]$/, '')));
    }
  });

  it('ne touche à rien quand l\'énoncé a eu le temps d\'être joué', () => {
    const heard = spokenPrefix(SIX_SECONDS, 6_000, 'fr');
    expect(heard.truncated).toBe(false);
    expect(heard.text).toBe(SIX_SECONDS);
  });

  it('ne rogne pas les derniers dixièmes, où l\'estimation ne vaut plus rien', () => {
    // 5,3 s sur 6: l'écart est du bruit de mesure, pas une part manquée.
    expect(spokenPrefix(SIX_SECONDS, 5_300, 'fr').truncated).toBe(false);
  });

  it('rend un énoncé vide quand rien n\'a été entendu', () => {
    expect(spokenPrefix(SIX_SECONDS, 0, 'fr').text).toBe('…');
    expect(spokenPrefix(SIX_SECONDS, -10, 'fr').text).toBe('…');
  });

  it('laisse un texte vide tel quel', () => {
    expect(spokenPrefix('', 1_000, 'fr')).toEqual({ text: '', truncated: false });
  });
});

describe('llmStreamService — l\'historique envoyé au modèle', () => {
  const base = { clientId: 'cl1', callerNumber: null, language: 'fr' as const };
  const rewrite = (req: any, id: string) =>
    (llmStreamService as any).withHeardOnly(req, id, 'fr') as { messages: any[] };

  beforeEach(() => {
    for (const id of ['c1', 'c2', 'c3']) callSessionStore.end?.(id);
  });

  it('ne porte que ce qui a été joué après une interruption', () => {
    callSessionStore.start({ vapiCallId: 'c1', ...base });
    callSessionStore.assistantStartedSpeaking('c1', 10_000);
    callSessionStore.recordBargeIn('c1', 11_500);

    const out = rewrite(
      { messages: [{ role: 'assistant', content: SIX_SECONDS }, { role: 'user', content: 'attendez' }] },
      'c1',
    );
    expect(out.messages[0].content).not.toBe(SIX_SECONDS);
    expect(out.messages[0].content).not.toContain('quatorze heures');
    expect(out.messages[1].content).toBe('attendez');
  });

  it('ne coupe qu\'une fois: le tour d\'après retrouve un historique intact', () => {
    callSessionStore.start({ vapiCallId: 'c2', ...base });
    callSessionStore.assistantStartedSpeaking('c2', 10_000);
    callSessionStore.recordBargeIn('c2', 11_500);

    const req = { messages: [{ role: 'assistant', content: SIX_SECONDS }] };
    rewrite(req, 'c2');
    const second = rewrite({ messages: [{ role: 'assistant', content: SIX_SECONDS }] }, 'c2');
    expect(second.messages[0].content).toBe(SIX_SECONDS);
  });

  it('ne touche à rien sans interruption', () => {
    callSessionStore.start({ vapiCallId: 'c3', ...base });
    const req = { messages: [{ role: 'assistant', content: SIX_SECONDS }] };
    expect(rewrite(req, 'c3')).toBe(req);
  });

  it('laisse passer une interruption sur une session inconnue', () => {
    const req = { messages: [{ role: 'assistant', content: SIX_SECONDS }] };
    expect(rewrite(req, 'inconnu')).toBe(req);
  });
});
