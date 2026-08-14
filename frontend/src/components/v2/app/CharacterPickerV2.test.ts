import { describe, it, expect } from 'vitest';
import { previewUrl } from './CharacterPickerV2';

describe('previewUrl', () => {
  it('joue la voix du catalogue quand aucune voix ne la remplace', () => {
    expect(previewUrl('marie')).toBe('/my-dashboard/characters/marie/preview');
  });

  it("joue la voix de remplacement, celle que l'appelant entendra", () => {
    // Le defaut signale: cette fonction avait perdu le parametre que portait sa
    // version V1. La fiche auditionnait donc le catalogue pendant que l'appel
    // appliquait la voix de remplacement, deux voix pour un seul reglage.
    expect(previewUrl('marie', { voiceId: 'v_abc' }))
      .toBe('/my-dashboard/characters/marie/preview?voiceId=v_abc');
  });

  it('echappe la valeur, elle vient de la configuration du client', () => {
    expect(previewUrl('marie', { voiceId: 'a b&c' }))
      .toBe('/my-dashboard/characters/marie/preview?voiceId=a%20b%26c');
  });

  it('ignore une voix de remplacement vide plutot que de produire une URL bancale', () => {
    expect(previewUrl('marie', { voiceId: '' })).toBe('/my-dashboard/characters/marie/preview');
    expect(previewUrl('marie', null)).toBe('/my-dashboard/characters/marie/preview');
  });
});
