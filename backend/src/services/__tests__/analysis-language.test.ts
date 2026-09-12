import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Les résumés d'appel arrivaient en ANGLAIS à un gérant francophone
 * (12/09/2026): le modèle d'analyse répond dans la langue de sa consigne, et
 * la consigne est en anglais. La langue du client est dite dans la consigne,
 * par `clientLocale`, la seule règle de langue (6vicies).
 */
const SRC = readFileSync(join(__dirname, '..', 'client-call.service.ts'), 'utf8');

describe("l'analyse d'appel parle la langue du client", () => {
  it('dit au modèle dans quelle langue écrire, par clientLocale', () => {
    expect(SRC).toMatch(/in \$\{ANALYSIS_LANGUAGE\[clientLocale\(client\)\]\}, the language of the business/);
  });

  it('couvre les trois langues servies', () => {
    expect(SRC).toMatch(/fr: 'French', en: 'English', nl: 'Dutch'/);
  });

  it('ne recrée pas une réservation quand une a été prise en direct', () => {
    expect(SRC).toMatch(/if \(extra\.liveBookingId\)/);
  });
});
