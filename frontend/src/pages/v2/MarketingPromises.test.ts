import { describe, expect, it } from 'vitest';
import home from './Home.tsx?raw';
import receptionist from './Receptionist.tsx?raw';
import faq from './Faq.tsx?raw';
import pricing from './Pricing.tsx?raw';
import agent from './Agent.tsx?raw';
import benefits from '../../components/v2/MarketingSections.tsx?raw';
import voices from '../../components/v2/CircularReceptionists.tsx?raw';

// Public copy contracts complement rendered UI tests. Offline product tests do
// not establish acoustic immunity, delivery guarantees or production uptime.
describe('Marketing promises match supported product paths', () => {
  it('keeps the hero calendar-dependent without an unconditional SMS promise', () => {
    const hero = home.match(/<Lead\b[^>]*>[\s\S]*?<\/Lead>/)?.[0];
    expect(hero).toBeDefined();
    expect(hero).toContain('agenda connecté');
    expect(hero).toContain('connected calendar');
    expect(hero).not.toContain('confirme le rendez-vous par SMS');
    expect(hero).not.toContain('confirms the booking by SMS');
  });

  it('qualifies the shared voice-gallery cloning note, not only the FAQ', () => {
    const note = voices.split('function VoiceCloneNote(')[1]?.split('export default')[0];
    expect(note).toContain('mode cascade');
    expect(note).toContain('cascade mode');
    expect(note).toContain('consentement');
    expect(note).toContain('consent');
  });

  it('does not present unmeasured pickup latency as a fact', () => {
    expect(receptionist).not.toContain('&lt;1&nbsp;s');
  });

  it('names both implemented calendar providers on the homepage and FAQ', () => {
    for (const copy of [home, faq]) {
      expect(copy).toContain('Google ou Outlook');
      expect(copy).toContain('Google or Outlook');
    }
  });

  it('surfaces moving and cancelling bookings in both languages', () => {
    for (const copy of [home, faq]) {
      expect(copy).toContain('déplacer ou annuler');
      expect(copy).toContain('reschedule or cancel');
    }
  });

  it('does not promise cough immunity or inaudible failures', () => {
    const copy = home + receptionist + faq;
    for (const claim of [
      'Une toux ne', 'A cough', 'n’entend jamais la panne',
      'never hears the failure', 'never hears an error message',
      'n’entend jamais un message d’erreur', 'stops dead',
    ]) expect(copy).not.toContain(claim);
  });

  it('does not turn conflict protection into an unconditional guarantee', () => {
    const copy = home + receptionist + faq;
    for (const claim of [
      'Deux appels simultanés ne peuvent pas',
      'Deux appels au même moment ne peuvent pas',
      'Deux appels en même temps ne peuvent pas',
      'Two simultaneous calls cannot', 'Two simultaneous calls can never',
      'Two calls at the same moment cannot',
    ]) expect(copy).not.toContain(claim);
  });

  it('conditions automated texts on an enabled channel and reachable number', () => {
    expect(benefits).toContain('SMS activés');
    expect(benefits).toContain('text messaging enabled');
    expect(benefits).toContain('numéro');
    expect(benefits).toContain('number');
    expect(receptionist).toContain('coordonnées disponibles');
    expect(receptionist).toContain('available contact details');
  });

  it('documents cloned-voice engine compatibility instead of instant availability', () => {
    expect(faq).toContain('mode cascade');
    expect(faq).toContain('cascade mode');
    expect(faq).not.toContain('la voix clonée est utilisable dans la foulée');
    expect(faq).not.toContain('the cloned voice is usable right away');
    expect(home).not.toContain('clonée en 90 secondes');
  });

  it('identifies the native CRM instead of implying every CRM has a native connector', () => {
    expect(pricing).toContain('HubSpot');
    expect(pricing).not.toContain('Intégrations CRM natives');
    expect(pricing).not.toContain('Native CRM integrations');
  });

  it('keeps unreleased Agent modules explicitly marked as upcoming', () => {
    expect(agent).toContain("isFr ? 'Bientôt' : 'Coming soon'");
    expect(agent).toContain('au lancement');
    expect(agent).toContain('at launch');
  });
});
