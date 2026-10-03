import { describe, it, expect } from 'vitest';
import { smsTemplates } from '../sms-templates';
import { PLANS } from '../../config/plans';

describe('smsTemplates — bilingual selection', () => {
  it('renders the welcome SMS in French with the FR opt-out line', () => {
    const body = smsTemplates.welcome({ firstName: 'Marie', agentName: 'Marie', registrationLink: 'https://x', lang: 'fr' });
    expect(body).toContain('Bonjour Marie');
    expect(body).toContain('essai gratuit');
    expect(body).toContain('Répondez STOP pour vous désinscrire.');
  });

  it('renders the welcome SMS in English with the EN opt-out line', () => {
    const body = smsTemplates.welcome({ firstName: 'John', agentName: 'Ashley', registrationLink: 'https://x', lang: 'en' });
    expect(body).toContain('Hi John');
    /* Le nombre vient de `PLANS`, pas d'un litteral.
       Ce test figeait « free 30-day trial » alors que la duree reelle est
       `PLANS.solo.trialDays` = 7. Il a rendu service en tombant quand le texte
       a ete corrige: c'est exactement ce qu'on veut d'un test sur une promesse
       commerciale. L'ecrire en dur ici le rendrait complice de la prochaine
       divergence au lieu de la signaler. */
    expect(body).toContain(`free ${PLANS.solo.trialDays}-day trial`);
    expect(body).not.toContain('30-day');
    expect(body).toContain('Reply STOP to opt out.');
  });

  it('formats the booking confirmation date in fr-CA when French', () => {
    const body = smsTemplates.bookingConfirm({
      firstName: 'Léa', businessName: 'Plomberie Inc', date: '2026-01-15', time: '10:00', service: 'consultation', lang: 'fr',
    });
    expect(body).toContain('rendez-vous chez Plomberie Inc');
    expect(body).toContain('à 10:00');
    expect(body).toContain('(consultation)');
    // fr-CA long weekday for 2026-01-15 is "jeudi"
    expect(body.toLowerCase()).toContain('jeudi');
  });

  it('formats the booking confirmation date in en-US when English', () => {
    const body = smsTemplates.bookingConfirm({
      firstName: 'Léa', businessName: 'Plomberie Inc', date: '2026-01-15', time: '10:00', service: 'consultation', lang: 'en',
    });
    expect(body).toContain('at 10:00');
    expect(body.toLowerCase()).toContain('thursday');
  });

  it('booking reminder falls back to "demain" / "tomorrow" when no time', () => {
    expect(smsTemplates.bookingReminder({ firstName: 'A', businessName: 'B', time: null, service: null, lang: 'fr' })).toContain('demain');
    expect(smsTemplates.bookingReminder({ firstName: 'A', businessName: 'B', time: null, service: null, lang: 'en' })).toContain('tomorrow');
  });
});
