// Conversational assistant for the client dashboard: the client can chat (text
// or voice via the browser) with their receptionist's "manager" to get info,
// configure the agent, and complete onboarding. Backed by OpenAI function
// calling — the model can read and update the client's config through the same
// validated writer the settings form uses (client-config.service).

import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { listCharacters, resolveCharacter } from '../config/voice-characters';
import { applyConfigPatch, buildVapiConfigPatch, type VapiConfigPatch } from './client-config.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatMode = 'config' | 'onboarding' | 'receptionist';

export interface ChatResult {
  reply: string;
  configChanged: boolean;
  config: Record<string, any>;
}

const MAX_TOOL_ROUNDS = 4;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_config',
      description: 'Read the current receptionist configuration (hours, services/items, FAQ, personality, character).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_config',
      description: 'Update one or more receptionist settings. Only include fields you want to change.',
      parameters: {
        type: 'object',
        properties: {
          faq: { type: 'string', description: 'Free-text FAQ / knowledge the receptionist should know.' },
          personalityNotes: { type: 'string', description: 'Free-text tone/behavior refinement.' },
          personalityPreset: {
            type: 'string',
            enum: ['warm', 'professional', 'casual', 'energetic', 'luxury', 'caring'],
            description: 'Personality tone preset.',
          },
          characterId: {
            type: 'string',
            description: 'Receptionist character id (voice + persona). Use list_characters to see valid ids.',
          },
          hours: {
            type: 'object',
            description: 'Weekly opening hours object, e.g. { "monday": { "open": true, "from": "09:00", "to": "18:00" } }.',
          },
          items: {
            type: 'array',
            description: 'Services / menu / price list.',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                name: { type: 'string' },
                price: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_characters',
      description: 'List the available receptionist characters (id, name, language, personality) the client can pick.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

export class AssistantChatService {
  async chat(clientId: string, messages: ChatMessage[], mode: ChatMode = 'config'): Promise<ChatResult> {
    if (!env.OPENAI_API_KEY) {
      return {
        reply: "L'assistant conversationnel n'est pas encore configuré (clé OpenAI manquante).",
        configChanged: false,
        config: {},
      };
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        businessName: true, businessType: true, agentLanguage: true, country: true,
        transferNumber: true, vapiConfig: true, vapiPhoneNumber: true,
      },
    });
    if (!client) throw new Error('Client not found');

    let config = (client.vapiConfig as any) || {};
    let configChanged = false;

    const isFr = client.agentLanguage === 'fr'
      || ['FR', 'BE', 'LU', 'MC', 'CH'].includes(String(client.country || '').toUpperCase());

    const convo: any[] = [
      { role: 'system', content: this.systemPrompt(client, isFr, mode) },
      ...messages.slice(-16).map(m => ({ role: m.role, content: m.content })),
    ];

    let reply = '';
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await this.callOpenAI(convo, mode);
      if (!res) break;
      const msg = res.choices?.[0]?.message;
      if (!msg) break;
      convo.push(msg);

      const toolCalls = msg.tool_calls || [];
      if (!toolCalls.length) {
        reply = msg.content || '';
        break;
      }

      for (const call of toolCalls) {
        const { output, changed } = await this.runTool(clientId, call, () => config, (c) => { config = c; });
        if (changed) configChanged = true;
        convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output) });
      }
    }

    return { reply: reply || (isFr ? "D'accord." : 'Okay.'), configChanged, config };
  }

  private async runTool(
    clientId: string,
    call: any,
    getConfig: () => Record<string, any>,
    setConfig: (c: Record<string, any>) => void,
  ): Promise<{ output: any; changed: boolean }> {
    const name = call.function?.name;
    let args: any = {};
    try { args = JSON.parse(call.function?.arguments || '{}'); } catch { /* ignore */ }

    if (name === 'get_config') {
      const c = getConfig();
      return {
        output: {
          characterId: c.characterId ?? null,
          personalityPreset: c.personalityPreset ?? null,
          personalityNotes: c.personalityNotes ?? null,
          faq: c.faq ?? null,
          hours: c.hours ?? null,
          items: c.items ?? [],
        },
        changed: false,
      };
    }
    if (name === 'list_characters') {
      return {
        output: listCharacters().map(ch => ({
          id: ch.id, name: ch.name, language: ch.language, accent: ch.accent,
          gender: ch.gender, personality: ch.personaKey, tagline: ch.taglineFr,
        })),
        changed: false,
      };
    }
    if (name === 'update_config') {
      const patch: VapiConfigPatch = {
        faq: args.faq,
        personalityNotes: args.personalityNotes,
        personalityPreset: args.personalityPreset,
        characterId: args.characterId,
        hours: args.hours,
        items: args.items,
      };
      // Validate what actually changed before persisting (drops invalid values).
      const validated = buildVapiConfigPatch(getConfig(), patch);
      const next = await applyConfigPatch(clientId, patch);
      setConfig(next);
      return { output: { ok: true, applied: this.diffKeys(validated, patch) }, changed: true };
    }
    return { output: { error: `unknown tool ${name}` }, changed: false };
  }

  private diffKeys(_validated: Record<string, any>, patch: VapiConfigPatch): string[] {
    return Object.keys(patch).filter(k => (patch as any)[k] !== undefined);
  }

  private systemPrompt(client: any, isFr: boolean, mode: ChatMode): string {
    const lang = isFr ? 'French' : 'English';
    const cfg = (client.vapiConfig as any) || {};

    // Receptionist mode: roleplay the client's actual AI receptionist so the
    // owner can test how it answers callers. No config changes here.
    if (mode === 'receptionist') {
      const character = resolveCharacter({
        characterId: cfg.characterId,
        isFrench: isFr,
        country: client.country,
      });
      const items = Array.isArray(cfg.items) ? cfg.items.slice(0, 40)
        .map((i: any) => `- ${i.name}${i.price ? ` (${i.price})` : ''}`).join('\n') : '';
      return [
        `You are ${character.name}, the AI phone receptionist for "${client.businessName}" (${client.businessType || 'business'}).`,
        `This is a TEST conversation: the business owner is playing a caller to hear how you answer. Behave exactly as you would on a real call. Reply in ${lang}, spoken and natural, one short turn at a time.`,
        cfg.faq ? `Business knowledge:\n${String(cfg.faq).slice(0, 2000)}` : '',
        items ? `Services / prices:\n${items}` : '',
        cfg.personalityNotes ? `Tone notes: ${String(cfg.personalityNotes).slice(0, 500)}` : '',
        client.transferNumber ? `You can offer to transfer to a human if asked.` : '',
        `Never invent prices or facts you don't have — take a message instead. Do not mention that you are a test or an AI language model.`,
      ].filter(Boolean).join('\n');
    }

    const base = [
      `You are the setup assistant for Qwillio, an AI phone receptionist for small businesses.`,
      `You are helping the owner of "${client.businessName}" (${client.businessType || 'business'}) configure and understand their AI receptionist. Reply in ${lang}, concise and friendly.`,
      `You can answer questions about how the receptionist works, and change settings on the owner's behalf using the tools.`,
      `When the owner asks to change something (hours, services/prices, FAQ, personality, or which character/voice answers), call update_config. Confirm what you changed in plain language.`,
      `Never invent prices, phone numbers, or business facts — ask the owner. Keep answers short unless asked for detail.`,
      client.vapiPhoneNumber ? `Their AI phone number is ${client.vapiPhoneNumber}.` : `Their AI phone number is not provisioned yet.`,
      client.transferNumber ? `Calls can transfer to ${client.transferNumber}.` : `No human transfer number is set yet.`,
    ];

    if (mode === 'onboarding') {
      base.push(
        `ONBOARDING MODE: proactively guide the owner through first-time setup. Check what's missing — a chosen character/voice, opening hours, services & prices, FAQ, a transfer number — and walk them through it ONE step at a time, asking a single clear question each turn. Apply each answer with update_config as you go, then move to the next missing piece. Celebrate progress briefly.`,
      );
    } else {
      base.push(
        `CONFIG MODE: the owner already knows their setup; just make the changes they ask for and answer questions. Don't run a full onboarding unless asked.`,
      );
    }
    return base.join('\n');
  }

  private async callOpenAI(messages: any[], mode: ChatMode): Promise<any | null> {
    try {
      // Receptionist (test) mode is a pure roleplay — no config tools.
      const useTools = mode !== 'receptionist';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          ...(useTools ? { tools: TOOLS, tool_choice: 'auto' } : {}),
          temperature: mode === 'receptionist' ? 0.7 : 0.4,
          max_tokens: 500,
        }),
      });
      if (!res.ok) {
        logger.error(`[AssistantChat] OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      logger.error('[AssistantChat] OpenAI call failed:', err);
      return null;
    }
  }
}

export const assistantChatService = new AssistantChatService();
