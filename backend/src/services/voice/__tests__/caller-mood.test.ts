import { describe, it, expect } from 'vitest';
import { assessMood, moodPromptBlock } from '../caller-mood';

describe('assessMood — detection', () => {
  it('reads a neutral opening as neutral', () => {
    expect(assessMood('bonjour je voudrais reserver une table', 'fr', 0).mood).toBe('neutral');
  });

  it('detects anger from explicit markers', () => {
    expect(assessMood('c\'est inadmissible, personne ne repond jamais', 'fr', 0).mood).toBe('upset');
    expect(assessMood('this is unacceptable, I am furious', 'en', 0).mood).toBe('upset');
  });

  it('detects the polite-but-cold register an upset professional uses', () => {
    // No swearing, no raised voice — still someone who has been let down.
    expect(assessMood('je vous appelle pour la troisieme fois', 'fr', 0).mood).toBe('upset');
  });

  it('treats a repeated contact as frustration even with no angry word', () => {
    const a = assessMood('j\'ai deja appele hier', 'fr', 0);
    expect(a.mood).toBe('upset');
    expect(a.signals).toContain('repeat_contact');
  });

  it('detects time pressure separately from anger', () => {
    expect(assessMood('je suis presse, faites vite', 'fr', 0).mood).toBe('rushed');
    expect(assessMood('quick question, I am in a rush', 'en', 0).mood).toBe('rushed');
  });

  it('ignores accents and punctuation', () => {
    expect(assessMood('C\'EST INADMISSIBLE !!!', 'fr', 0).mood).toBe('upset');
  });
});

describe('assessMood — escalation policy', () => {
  it('escalates rushed to upset', () => {
    expect(assessMood('c\'est scandaleux', 'fr', 1, 'rushed').mood).toBe('upset');
  });

  it('never de-escalates mid-call', () => {
    // The anger was paused, not resolved. Reverting to a cheerful register on
    // the next neutral sentence is exactly how a call goes wrong.
    expect(assessMood('d\'accord', 'fr', 2, 'upset').mood).toBe('upset');
    expect(assessMood('merci', 'fr', 2, 'rushed').mood).toBe('rushed');
  });

  it('stops re-assessing after the opening turns', () => {
    // Late anger is real, but by then the conversation has its own context and
    // a keyword match is more likely to be a quote than a mood.
    expect(assessMood('c\'est inadmissible', 'fr', 9, 'neutral').mood).toBe('neutral');
  });
});

describe('moodPromptBlock', () => {
  it('adds nothing for a neutral caller — the base prompt already covers it', () => {
    expect(moodPromptBlock('neutral', 'fr')).toBe('');
  });

  it('tells the agent to drop the enthusiasm for an upset caller', () => {
    const block = moodPromptBlock('upset', 'fr');
    expect(block).toMatch(/aucun enthousiasme/i);
    expect(block).toMatch(/transfert/i);
  });

  it('tells the agent to stop apologising in a loop', () => {
    expect(moodPromptBlock('upset', 'en')).toMatch(/do not keep apologising/i);
  });

  it('tells the agent to be brief for a rushed caller, without apologising', () => {
    const block = moodPromptBlock('rushed', 'en');
    expect(block).toMatch(/one sentence/i);
    expect(block).not.toMatch(/apolog/i);
  });

  it('stays short — it rides on every turn of the call', () => {
    for (const mood of ['upset', 'rushed'] as const) {
      for (const lang of ['fr', 'en'] as const) {
        expect(moodPromptBlock(mood, lang).length).toBeLessThan(400);
      }
    }
  });
});
