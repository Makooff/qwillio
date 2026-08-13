import { describe, it, expect } from 'vitest';
import {
  requiresPriorConsent,
  isWithinCallingWindow,
  publicHolidays,
  maxCallsPerMonth,
} from '../outbound-legal';

/**
 * Ces tests encodent du droit, pas une préférence produit. Chaque cas cite la
 * règle qu'il protège, pour qu'une modification ultérieure sache ce qu'elle
 * défait.
 */

describe('consentement préalable, par pays', () => {
  it('exige le consentement en France (loi 2025-594, depuis le 11/08/2026)', () => {
    expect(requiresPriorConsent('FR')).toBe(true);
  });

  it("ne l'exige pas en Belgique, restée en opt-out", () => {
    // C'est la divergence introduite le 11/08/2026: une règle unique pour les
    // deux pays serait illégale d'un côté ou inutilement bridée de l'autre.
    expect(requiresPriorConsent('BE')).toBe(false);
  });

  it('exige le consentement pour un pays inconnu', () => {
    // On ne compose pas un numéro dont on ne sait pas quelle loi le protège.
    expect(requiresPriorConsent('DE')).toBe(true);
    expect(requiresPriorConsent(null)).toBe(true);
    expect(requiresPriorConsent(undefined)).toBe(true);
  });
});

describe('fenêtres françaises (décret 2022-1313)', () => {
  // 13/08/2026 est un jeudi. En août Paris est à UTC+2.
  const jeudi = (utcHour: number, min = 0) =>
    new Date(Date.UTC(2026, 7, 13, utcHour, min));

  it('autorise 11 h, dans la fenêtre du matin', () => {
    expect(isWithinCallingWindow('FR', jeudi(9)).allowed).toBe(true);
  });

  it('autorise 15 h, dans la fenêtre de l’après-midi', () => {
    expect(isWithinCallingWindow('FR', jeudi(13)).allowed).toBe(true);
  });

  it('REFUSE 13 h 30: la coupure de midi est dans le décret', () => {
    // 11h30 UTC = 13h30 Paris. C'est le piège du décret: la journée n'est pas
    // une plage continue de 10 h à 20 h.
    const verdict = isWithinCallingWindow('FR', jeudi(11, 30));
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('outside_hours');
  });

  it('refuse avant 10 h et à partir de 20 h', () => {
    expect(isWithinCallingWindow('FR', jeudi(7, 30)).allowed).toBe(false); // 9h30
    expect(isWithinCallingWindow('FR', jeudi(18)).allowed).toBe(false);    // 20h00
  });

  it('refuse le samedi et le dimanche', () => {
    // 15 et 16 août 2026 = samedi et dimanche.
    expect(isWithinCallingWindow('FR', new Date(Date.UTC(2026, 7, 15, 9))).reason).toBe('weekend');
    expect(isWithinCallingWindow('FR', new Date(Date.UTC(2026, 7, 16, 9))).reason).toBe('weekend');
  });

  it('refuse un jour férié tombant en semaine', () => {
    // 1er mai 2026 = vendredi, Fête du Travail.
    const verdict = isWithinCallingWindow('FR', new Date(Date.UTC(2026, 4, 1, 9)));
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('public_holiday');
  });

  it('tient compte de l’heure d’hiver', () => {
    // 15/01/2026 est un jeudi; Paris est alors à UTC+1.
    // 08:30 UTC = 09:30 Paris → trop tôt. 09:30 UTC = 10:30 Paris → bon.
    expect(isWithinCallingWindow('FR', new Date(Date.UTC(2026, 0, 15, 8, 30))).allowed).toBe(false);
    expect(isWithinCallingWindow('FR', new Date(Date.UTC(2026, 0, 15, 9, 30))).allowed).toBe(true);
  });

  it('LÈVE la contrainte horaire quand le consentement existe', () => {
    // Le décret prévoit explicitement que l'encadrement des jours et horaires
    // ne s'applique pas si la personne a donné son consentement exprès et
    // préalable. Un prospect qui a demandé un rappel peut donc l'être un
    // dimanche.
    expect(isWithinCallingWindow('FR', new Date(Date.UTC(2026, 7, 16, 9)), true).allowed).toBe(true);
    expect(isWithinCallingWindow('FR', jeudi(11, 30), true).allowed).toBe(true);
  });
});

describe('jours fériés mobiles', () => {
  it('calcule les fériés adossés à Pâques 2026 (5 avril)', () => {
    const fr = publicHolidays('FR', 2026);
    expect(fr.has('04-06')).toBe(true); // Lundi de Pâques
    expect(fr.has('05-14')).toBe(true); // Ascension (Pâques + 39)
    expect(fr.has('05-25')).toBe(true); // Lundi de Pentecôte (Pâques + 50)
  });

  it('suit Pâques d’une année à l’autre au lieu de figer les dates', () => {
    // Pâques 2027 tombe le 28 mars: le lundi de Pâques change donc de mois.
    // Une table codée en dur serait fausse dès le 1er janvier suivant.
    expect(publicHolidays('FR', 2027).has('03-29')).toBe(true);
    expect(publicHolidays('FR', 2027).has('04-06')).toBe(false);
  });

  it('distingue les fêtes nationales française et belge', () => {
    expect(publicHolidays('FR', 2026).has('07-14')).toBe(true);
    expect(publicHolidays('BE', 2026).has('07-14')).toBe(false);
    expect(publicHolidays('BE', 2026).has('07-21')).toBe(true);
  });
});

describe('plafond mensuel', () => {
  it('retient quatre sollicitations par mois en France', () => {
    expect(maxCallsPerMonth('FR')).toBe(4);
  });

  it('n’en fixe pas ailleurs', () => {
    expect(maxCallsPerMonth('BE')).toBeNull();
    expect(maxCallsPerMonth('US')).toBeNull();
  });
});
