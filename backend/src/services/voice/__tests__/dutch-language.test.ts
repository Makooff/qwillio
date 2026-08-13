import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, firstMessageVariants } from '../system-prompt';
import { buildTranscriber, buildStartSpeakingPlan } from '../speech-plans';
import { routeIntent } from '../intent-router';
import type { CallerHistory, ClientVoiceProfile } from '../realtime-context.service';

/**
 * Néerlandais (roadmap 2.1) — la moitié flamande du marché belge.
 *
 * NL est un OPT-IN par client (`agentLanguage: 'nl'`), jamais déduit du pays.
 * Ces tests verrouillent que le pipeline entier parle néerlandais, conformité
 * comprise: greeting, notice, prompt, transcriber, intents.
 */

const profile: ClientVoiceProfile = {
  clientId: 'client_1',
  businessName: 'De Toonbank',
  businessType: 'restaurant',
  agentName: 'Lotte',
  language: 'nl',
  timezone: 'Europe/Brussels',
  transferNumber: '+3225550000',
  instructions: 'Geef nooit prijzen door de telefoon.',
  services: ['lunch', 'diner'],
  openingHours: '12u-14u en 19u-22u',
  bookingEnabled: true,
  calendarConnected: true,
  planType: 'pro',
  characterId: null,
  customVoice: null,
  country: 'BE',
  customLlm: true,
  voiceMode: 'auto',
  hasKnowledgeBase: false,
  recordCalls: true,
};

const newCaller: CallerHistory = {
  previousCalls: 0,
  lastCallAt: null,
  lastSummary: null,
  knownName: null,
  hasUpcomingBooking: false,
};

describe('premier message NL', () => {
  it('salue en néerlandais avec divulgation IA et notice d\'enregistrement', () => {
    for (const v of firstMessageVariants(profile, null)) {
      expect(v).toMatch(/AI-assistent/);
      expect(v).toContain('Dit gesprek wordt opgenomen.');
      expect(v).toContain('De Toonbank');
      expect(v).not.toMatch(/bonjour|Thanks for calling/i);
    }
  });

  it('reconnaît un appelant connu, en néerlandais', () => {
    for (const v of firstMessageVariants(profile, 'Jan')) {
      expect(v).toContain('Jan');
      expect(v).toMatch(/AI-assistent/);
    }
  });
});

describe('system prompt NL', () => {
  const prompt = buildSystemPrompt(profile, newCaller);

  it('est intégralement en néerlandais: identité, règles, sécurité', () => {
    expect(prompt).toContain('receptionist van De Toonbank');
    expect(prompt).toContain('SPREEKREGELS');
    expect(prompt).toMatch(/^VEILIGHEID — slotregel/m);
    expect(prompt).not.toContain('SPEAKING RULES');
    expect(prompt).not.toContain('RÈGLES DE PAROLE');
  });

  it('porte la règle « ne jamais nier être une IA » en NL', () => {
    expect(prompt).toMatch(/AI-spraakassistent[\s\S]*bevestig/);
  });

  it('contrat outils et consignes client en NL', () => {
    expect(prompt).toContain('AFSPRAKEN:');
    expect(prompt).toContain('INSTRUCTIES VAN DE KLANT');
    expect(prompt).toContain('Geef nooit prijzen');
  });
});

describe('transcriber NL', () => {
  it('parle à Deepgram en néerlandais, sur le modèle qui le supporte nommément', () => {
    const t = buildTranscriber('nl');
    expect(t.language).toBe('nl');
    expect(t.model).toBe('nova-2');
  });

  it('utilise le détecteur de tour Vapi (documenté hors anglais)', () => {
    expect(buildStartSpeakingPlan('nl').smartEndpointingPlan.provider).toBe('vapi');
  });
});

describe('intents NL', () => {
  it('classe un backchannel flamand sans appeler le modèle', () => {
    const result = routeIntent('ja ja', 'nl', { turnIndex: 3 });
    expect(result.kind).toBe('backchannel');
  });

  it('répond en néerlandais à un contrôle de présence', () => {
    const result = routeIntent('hallo hallo', 'nl', { turnIndex: 0 });
    expect(result.kind).toBe('presence_check');
    if (result.kind === 'presence_check' && 'reply' in result) {
      expect(String((result as { reply?: string }).reply ?? '')).toMatch(/ik|Ja|luister|Zegt/);
    }
  });

  it('escalade une vraie demande métier vers le modèle', () => {
    const result = routeIntent('ik wil graag een afspraak maken voor dinsdag', 'nl', { turnIndex: 2 });
    expect(result.kind).toBe('reasoning');
  });
});
