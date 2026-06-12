import { describe, it, expect } from 'vitest';
import {
  brandHighlight,
  renderQuoteTemplate,
  renderTrialWelcomeTemplate,
  renderBookingReminderTemplate,
  renderRescheduleTemplate,
} from '../email-renderers';

/**
 * The email renderers are pure (data -> HTML). These tests pin the key data
 * that must appear in each template, locking behavior so the layer can be
 * refactored safely.
 */
describe('brandHighlight', () => {
  it('renders the label and value', () => {
    const html = brandHighlight('Your AI number', '+1 415 555 0102');
    expect(html).toContain('Your AI number');
    expect(html).toContain('+1 415 555 0102');
  });
});

describe('renderQuoteTemplate', () => {
  it('includes business, package, prices, features and the payment link', () => {
    const html = renderQuoteTemplate({
      contactName: 'John',
      businessName: 'Acme Dental',
      packageType: 'pro',
      setupPrice: 0,
      monthlyPrice: 1297,
      features: ['24/7 receptionist', 'Auto booking'],
      validUntil: new Date('2026-12-31'),
      paymentLink: 'https://pay.qwillio.com/abc',
      lang: 'en',
    });
    expect(html).toContain('Acme Dental');
    expect(html).toContain('PRO package');
    expect(html).toContain('$1297/mo');
    expect(html).toContain('24/7 receptionist');
    expect(html).toContain('Auto booking');
    expect(html).toContain('https://pay.qwillio.com/abc');
  });

  it('falls back to "there" when no contact name (EN)', () => {
    const html = renderQuoteTemplate({
      contactName: '', businessName: 'X', packageType: 'basic',
      setupPrice: 0, monthlyPrice: 497, features: [],
      validUntil: new Date(), paymentLink: 'l', lang: 'en',
    });
    expect(html).toContain('Hi there,');
  });

  it('defaults to French when no language is given', () => {
    const html = renderQuoteTemplate({
      contactName: 'Jean', businessName: 'Acme Dentaire', packageType: 'pro',
      setupPrice: 0, monthlyPrice: 1297, features: ['Réceptionniste 24/7'],
      validUntil: new Date('2026-12-31'), paymentLink: 'https://pay.qwillio.com/abc',
    });
    expect(html).toContain('Votre devis personnalisé');
    expect(html).toContain('Forfait PRO');
    expect(html).toContain('1297 $/mois');
  });
});

describe('renderTrialWelcomeTemplate', () => {
  it('includes the calls quota', () => {
    const html = renderTrialWelcomeTemplate({
      contactName: 'Mia', businessName: 'Bloom Spa', packageType: 'pro',
      trialEndDate: new Date('2026-07-01'), trialCallsQuota: 800, lang: 'en',
    });
    expect(html).toContain('Bloom Spa');
    expect(html).toContain('800 calls during the trial period');
  });
});

describe('renderBookingReminderTemplate', () => {
  const base = {
    to: 'c@x.com', customerName: 'Sam', businessName: 'Bright Dental',
    bookingDate: new Date('2026-06-15T00:00:00Z'), bookingTime: '2:00 PM',
    serviceType: 'Cleaning', specialRequests: null as string | null, businessPhone: '+15551234567',
    lang: 'en' as const,
  };

  it('shows appointment details and a reschedule call button when a phone is set', () => {
    const html = renderBookingReminderTemplate(base);
    expect(html).toContain('Sam');
    expect(html).toContain('Bright Dental');
    expect(html).toContain('Cleaning');
    expect(html).toContain('tel:+15551234567');
  });

  it('includes a Notes line only when special requests exist', () => {
    expect(renderBookingReminderTemplate(base)).not.toContain('Notes');
    expect(
      renderBookingReminderTemplate({ ...base, specialRequests: 'Wheelchair access' }),
    ).toContain('Wheelchair access');
  });

  it('falls back to generic text when no phone is provided', () => {
    const html = renderBookingReminderTemplate({ ...base, businessPhone: '' });
    expect(html).toContain('please contact us directly');
    expect(html).not.toContain('tel:');
  });
});

describe('renderRescheduleTemplate', () => {
  it('includes the customer and a tel link', () => {
    const html = renderRescheduleTemplate({
      to: 'c@x.com', customerName: 'Lee', businessName: 'Z',
      originalDate: new Date('2026-06-10'), businessPhone: '+15559999999',
    });
    expect(html).toContain('Lee');
    expect(html).toContain('tel:+15559999999');
  });
});
