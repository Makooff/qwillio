import { describe, it, expect } from 'vitest';
import { toCatalogVoice } from '../voice-catalog.service';

const raw = (over: Record<string, unknown> = {}) => ({
  voice_id: 'v_1',
  name: 'Camille',
  category: 'premade',
  preview_url: 'https://example.test/v_1.mp3',
  labels: { gender: 'female', accent: 'french', use_case: 'narration' },
  ...over,
});

describe('toCatalogVoice', () => {
  it('keeps the fields the picker needs to make a choice', () => {
    expect(toCatalogVoice(raw())).toEqual({
      voiceId: 'v_1',
      name: 'Camille',
      gender: 'female',
      accent: 'french',
      description: 'narration',
      previewUrl: 'https://example.test/v_1.mp3',
      cloned: false,
    });
  });

  it('rejects an entry without a usable voice id', () => {
    // An empty id would be sent to ElevenLabs on a live call. Dropping the row
    // costs one voice in a list; keeping it costs a silent agent.
    for (const bad of [null, undefined, 'string', 42, {}, { voice_id: '' }, { voice_id: 7 }]) {
      expect(toCatalogVoice(bad)).toBeNull();
    }
  });

  it('survives missing labels rather than throwing', () => {
    // ElevenLabs omits labels on some voices, and has changed this shape before.
    const v = toCatalogVoice(raw({ labels: undefined, preview_url: undefined }));
    expect(v).toMatchObject({ voiceId: 'v_1', gender: null, accent: null, previewUrl: null });
  });

  it('treats blank strings as absent', () => {
    const v = toCatalogVoice(raw({ labels: { gender: '   ', accent: '' } }));
    expect(v?.gender).toBeNull();
    expect(v?.accent).toBeNull();
  });

  it('names an unnamed voice instead of showing an empty row', () => {
    expect(toCatalogVoice(raw({ name: '' }))?.name).toBe('Sans nom');
  });

  it('marks cloned and professional voices as the account owner own', () => {
    // These are the ones the owner made deliberately; the list surfaces them
    // first so a library of stock voices does not bury them.
    expect(toCatalogVoice(raw({ category: 'cloned' }))?.cloned).toBe(true);
    expect(toCatalogVoice(raw({ category: 'professional' }))?.cloned).toBe(true);
    expect(toCatalogVoice(raw({ category: 'premade' }))?.cloned).toBe(false);
  });

  it('falls back to a label when the voice carries no description', () => {
    expect(toCatalogVoice(raw({ description: undefined }))?.description).toBe('narration');
    expect(toCatalogVoice(raw({ description: 'Voix posée' }))?.description).toBe('Voix posée');
  });
});
