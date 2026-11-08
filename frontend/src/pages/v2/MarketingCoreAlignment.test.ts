import { describe, expect, it } from 'vitest';
import home from './Home.tsx?raw';
import receptionist from './Receptionist.tsx?raw';
import faq from './Faq.tsx?raw';
import pricing from './Pricing.tsx?raw';
import vertical from './Vertical.tsx?raw';
import city from './City.tsx?raw';
import sla from './legal/Sla.tsx?raw';
import privacy from './legal/Privacy.tsx?raw';
import receptionistCards from '../../components/v2/ReceptionistCards.tsx?raw';
import blogArticles from '../../content/blogArticles.ts?raw';
import { COMPARISON_PAGES } from '../../content/comparisons';

// Core-first alignment contracts. Every claim pinned here was checked against
// the voice-core + bridge runtime: Google/Outlook calendars, HubSpot sync +
// generic outbound webhook, consent-based recording, spam excluded from the
// billed quota, 7-day card-required trial, LiveKit-based voice runtime with
// a legacy Vapi rollback path only.
describe('No unimplemented connectors advertised as native', () => {
  const comparisons = JSON.stringify(COMPARISON_PAGES.flatMap((p) => [...p.content.en, ...p.content.fr]));

  it('drops Cal.com/Calendly from routed pages and comparisons', () => {
    for (const copy of [vertical, city, comparisons]) {
      expect(copy).not.toContain('Calendly');
      expect(copy).not.toContain('Cal.com');
    }
  });

  it('names only the implemented calendar providers', () => {
    expect(vertical).toContain('agenda Google ou Outlook connecté');
    expect(vertical).toContain('Google or Outlook calendar connected');
  });

  it('does not claim native Salesforce, Doctolib or Softpro connectors', () => {
    for (const copy of [comparisons, vertical]) {
      expect(copy).not.toContain('Salesforce');
      expect(copy).not.toContain('Doctolib');
      expect(copy).not.toContain('Softpro');
    }
  });

  it('does not promise inbound photo MMS', () => {
    expect(vertical).not.toContain('photos par SMS');
    expect(vertical).not.toContain('receives photos via inbound SMS');
  });

  it('frames practice software (PMS) connections as webhook-based in the blog', () => {
    expect(blogArticles).toContain('via webhook');
    expect(blogArticles).toContain('via un webhook');
  });
});

describe('Trial and pricing copy match the real funnel', () => {
  const comparisons = JSON.stringify(COMPARISON_PAGES.flatMap((p) => [...p.content.en, ...p.content.fr]));

  it('never claims a trial without a card', () => {
    for (const copy of [comparisons, pricing, faq]) {
      expect(copy).not.toContain('without entering a card');
      expect(copy).not.toContain('sans entrer de carte');
    }
  });

  it('states the card requirement on the Rosie page that used to contradict the Terms', () => {
    const rosie = COMPARISON_PAGES.find((p) => p.slug === 'rosie')!;
    const text = JSON.stringify([...rosie.content.en, ...rosie.content.fr]);
    expect(text).toContain('card required');
    expect(text).toContain('carte requise');
  });

  it('expresses allowances in minutes, not implicit per-call conversions', () => {
    expect(faq).not.toContain('soit environ 100 appels');
    expect(faq).not.toContain('roughly 100 calls');
  });
});

describe('Optional channels stay conditioned', () => {
  it('conditions SMS confirmations and reminders on an enabled channel in city pages', () => {
    expect(city).toContain('canal SMS est activé');
    expect(city).toContain('text channel is enabled');
  });

  it('keeps the vertical wins cards honest about the SMS channel', () => {
    expect(vertical).toContain('SMS activés et mobile renseigné');
    expect(vertical).toContain('texting enabled and mobile provided');
  });

  it('qualifies recording announcements with the client setting', () => {
    expect(vertical).toContain("lorsqu'il est activé");
    expect(vertical).toContain('when enabled');
    expect(receptionistCards).toContain('lorsqu’il est activé');
    expect(receptionistCards).toContain('when enabled');
  });

  it('keeps the verified spam quota claim intact', () => {
    expect(receptionistCards).toContain('non décomptés');
    expect(receptionistCards).toContain('not counted');
    expect(faq).toContain('ne les décompte pas de vos minutes incluses');
  });
});

describe('Legal pages describe the actual runtime', () => {
  it('measures uptime on platform endpoints, not on a single legacy provider', () => {
    expect(sla).not.toContain('Vapi');
    expect(sla).toContain('webhooks téléphoniques entrants');
    expect(sla).toContain('incoming telephony webhooks');
  });

  it('lists the LiveKit-based runtime and qualifies Vapi as a legacy-only subprocessor', () => {
    expect(privacy).toContain('LiveKit');
    expect(privacy).toContain('repli explicite');
    expect(privacy).toContain('explicit rollback only, VOICE_RUNTIME=vapi');
  });

  it('never turns self-hosting into an EU-residency guarantee', () => {
    expect(privacy).not.toMatch(/résidence|residency|hébergées en UE|hosted in the EU/i);
  });
});

describe('Demo copy distinguishes the public demo from a saved configuration', () => {
  it('does not promise unauthenticated callers can modify existing bookings', () => {
    for (const copy of [home, faq, receptionist]) {
      expect(copy).not.toContain('peuvent aussi déplacer ou annuler un rendez-vous');
      expect(copy).not.toContain('can also reschedule or cancel an appointment');
      expect(copy).toContain('vérification');
      expect(copy).toContain('verification');
    }
  });
  it('does not call the public browser demo "your real setup"', () => {
    expect(home).not.toContain('vraie config');
    expect(home).not.toContain('your real setup');
    expect(receptionist).not.toContain('vraie config');
    expect(receptionist).not.toContain('your real setup');
  });
});

describe('CRM and integration claims match native-vs-sync reality', () => {
  it('presents HubSpot as a sync plus a generic outbound webhook, not "native everything"', () => {
    expect(pricing).not.toContain('HubSpot natif');
    expect(pricing).not.toContain('Native HubSpot');
    expect(pricing).toContain('Sync HubSpot + webhook');
  });

  it('keeps the comparison CRM rows to the native CRM plus HubSpot/webhook', () => {
    const comparisons = JSON.stringify(COMPARISON_PAGES.flatMap((p) => [...p.content.en, ...p.content.fr]));
    expect(comparisons).toContain('HubSpot/webhook');
  });
});

describe('Implemented but previously unmarketed capabilities are surfaced', () => {
  it('mentions lead scoring and the weekly report on pricing', () => {
    expect(pricing).toContain('Score de lead');
    expect(pricing).toContain('Lead score');
  });

  it('mentions per-line greeting, instructions and transfer, not independent voices', () => {
    expect(pricing).toContain('Réglages par ligne');
    expect(pricing).toContain('per-line settings');
  });
});

describe('Competitor pages carry a freshness disclaimer and no unqualified hosting claims', () => {
  it('disclaims competitor facts on every comparison page', () => {
    for (const page of COMPARISON_PAGES) {
      const text = JSON.stringify([...page.content.en, ...page.content.fr]);
      expect(text).toContain('re-verify before deciding');
      expect(text).toContain('à revérifier avant de décider');
    }
  });

  it('does not assert an EU hosting option without qualification', () => {
    const comparisons = JSON.stringify(COMPARISON_PAGES.flatMap((p) => [...p.content.en, ...p.content.fr]));
    expect(comparisons).not.toContain('Yes (EU)');
  });
});
