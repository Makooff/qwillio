import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { findIntegration } from '../config/integrations';

// ═══════════════════════════════════════════════════════════
// CRM SYNC SERVICE
// Pushes Qwillio contacts / calls / deals to external CRMs.
// Supported providers: webhook (generic), hubspot
// ═══════════════════════════════════════════════════════════

export class CrmSyncService {
  /**
   * Depuis quand une intégration NEUVE synchronise.
   *
   * `lastSync` est nul tant que rien n'a jamais été envoyé, et le remplacer par
   * `new Date(0)` faisait partir TOUT l'historique du client : ses contacts,
   * ses appels et ses affaires depuis toujours. Le cron envoyant par paquets de
   * 200, un client avec 500 contacts déclenchait une première salve, puis une
   * seconde quinze minutes plus tard, sans rien pour dire que c'était un
   * rattrapage.
   *
   * Le jour où un client branche Zapier, il reçoit donc dans son CRM des appels
   * d'il y a des mois, et il conclut que Qwillio envoie n'importe quoi. Le vrai
   * reproche n'est pas le volume : c'est qu'aucun des deux côtés ne peut dire
   * « ceci est le passé, ceci est le direct ».
   *
   * On démarre donc à la mise en place de l'intégration. Ce qui compte pour un
   * CRM branché sur une réceptionniste, c'est ce que l'agent produit À PARTIR DE
   * MAINTENANT ; l'historique, lui, se rattrape à la demande — c'est un geste
   * explicite, pas un effet de bord de la première minute.
   *
   * Le repli reste `now()` et non `now() - 15 min` : un export manuel peut
   * arriver juste après la création, et une fenêtre en arrière ferait rater ce
   * qui vient d'être capté. Rater un appel coûte plus cher que d'en envoyer un
   * de trop.
   */
  private static readonly DEPART_SANS_HISTORIQUE = true;

  async syncIntegration(integration: {
    id: string;
    clientId: string;
    provider: string;
    accessToken: string | null;
    config: unknown;
    lastSync: Date | null;
    createdAt?: Date | null;
  }): Promise<void> {
    /* `createdAt` quand il est fourni : c'est l'instant où le client a branché
       l'intégration, donc le premier moment où il pouvait attendre quelque
       chose. `now()` en dernier recours — jamais `new Date(0)`. */
    const since =
      integration.lastSync ??
      (CrmSyncService.DEPART_SANS_HISTORIQUE
        ? (integration.createdAt ?? new Date())
        : new Date(0));

    switch (integration.provider) {
      /* Zapier, Make et n8n ne sont pas trois intégrations: ce sont trois noms
         commerciaux du MÊME mécanisme, une URL qui reçoit du JSON. Les traiter
         séparément aurait produit trois copies du même code, et trois endroits
         où corriger le prochain défaut. Le nom sert à l'affichage, rien de
         plus. */
      case 'webhook':
      case 'zapier':
      case 'make':
      case 'n8n':
        await this.syncWebhook(integration, since);
        break;
      case 'slack':
        await this.syncSlack(integration, since);
        break;
      case 'hubspot':
        await this.syncHubspot(integration, since);
        break;
      default: {
        /* Un RELAIS (Pipedrive, Notion, Airtable...) est le mécanisme
           `webhook` sous un nom commercial: le client colle l'URL de son
           scénario Make ou Zapier, et le corps envoyé est le même. On le
           stocke donc sous SON nom plutôt que sous `webhook`, sinon
           `@@unique([clientId, provider])` n'en laisserait brancher qu'un
           seul par client, et le deuxième écraserait le premier en silence.
           C'est le catalogue qui tranche, à un seul endroit. */
        const entry = findIntegration(integration.provider);
        if (entry?.transport === 'relay') {
          await this.syncWebhook(integration, since);
          break;
        }
        logger.debug(`[CrmSync] Provider "${integration.provider}" — no sync handler, skipping`);
      }
    }
  }

  // ─── SSRF guard — blocks private/internal network targets ──
  validateWebhookUrl(url: string): void {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error('Invalid webhook URL'); }
    if (parsed.protocol !== 'https:') throw new Error('Webhook URL must use HTTPS');
    const host = parsed.hostname.toLowerCase();
    const blocked = /^(localhost$|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1$|0\.0\.0\.0$)/;
    if (blocked.test(host)) throw new Error('Webhook URL targets a private or internal network');
  }

  // ─── Webhook provider ────────────────────────────────────
  // POSTs changed records to any URL (Zapier, Make, n8n, custom).
  private async syncWebhook(integration: any, since: Date): Promise<void> {
    const cfg = (integration.config ?? {}) as Record<string, unknown>;
    const webhookUrl = cfg.webhookUrl as string | undefined;
    if (!webhookUrl) return;
    this.validateWebhookUrl(webhookUrl);

    const TAKE = 200;
    const [contacts, calls, deals] = await Promise.all([
      prisma.contact.findMany({
        where: { clientId: integration.clientId, updatedAt: { gte: since } },
        orderBy: { updatedAt: 'asc' },
        take: TAKE,
        select: { id: true, name: true, email: true, phone: true, status: true, leadScore: true, tags: true, createdAt: true, updatedAt: true },
      }),
      prisma.clientCall.findMany({
        where: { clientId: integration.clientId, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        take: TAKE,
        select: { id: true, status: true, durationSeconds: true, direction: true, outcome: true, createdAt: true },
      }),
      prisma.deal.findMany({
        where: { clientId: integration.clientId, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        take: TAKE,
        select: { id: true, title: true, stage: true, value: true, probability: true, closeDate: true, createdAt: true },
      }),
    ]);
    if (contacts.length === TAKE || calls.length === TAKE || deals.length === TAKE) {
      logger.warn(`[CrmSync] Hit take:${TAKE} limit for client ${integration.clientId} — some records may be deferred to next sync`);
    }

    if (contacts.length === 0 && calls.length === 0 && deals.length === 0) return;

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.secret ? { 'X-Qwillio-Secret': String(cfg.secret) } : {}) },
      body: JSON.stringify({
        source: 'qwillio',
        syncedAt: new Date().toISOString(),
        counts: { contacts: contacts.length, calls: calls.length, deals: deals.length },
        contacts,
        calls,
        deals,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`Webhook returned HTTP ${res.status}`);
    logger.debug(`[CrmSync] Webhook synced — ${contacts.length} contacts, ${calls.length} calls, ${deals.length} deals`);
  }

  // ─── Slack ───────────────────────────────────────────────
  /**
   * Une URL de webhook entrant Slack, et rien d'autre.
   *
   * Slack n'attend pas nos objets: il attend `{ text }`. Lui envoyer le même
   * corps que Zapier afficherait un bloc de JSON dans le canal, ce que
   * personne ne lit. On n'envoie donc que ce qui mérite une notification —
   * les appels qui ont produit un lead — et on l'écrit en français.
   *
   * Le silence est voulu quand il n'y a rien: une intégration qui écrit
   * « 0 nouveau lead » toutes les quinze minutes se fait couper au bout d'un
   * jour, et emporte avec elle les notifications qui comptaient.
   */
  private async syncSlack(integration: any, since: Date): Promise<void> {
    const cfg = (integration.config ?? {}) as Record<string, unknown>;
    const webhookUrl = cfg.webhookUrl as string | undefined;
    if (!webhookUrl) return;
    this.validateWebhookUrl(webhookUrl);

    const leads = await prisma.clientCall.findMany({
      where: { clientId: integration.clientId, isLead: true, isSpam: false, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: {
        nameCollected: true, phoneCollected: true, callerNumber: true,
        emailCollected: true, summary: true, createdAt: true,
      },
    });
    if (leads.length === 0) return;

    const lines = leads.map(l => {
      const who = l.nameCollected || l.phoneCollected || l.callerNumber || 'Appelant inconnu';
      const contact = [l.phoneCollected || l.callerNumber, l.emailCollected].filter(Boolean).join(' · ');
      const summary = (l.summary || '').replace(/\s+/g, ' ').slice(0, 200);
      return `• *${who}*${contact ? ` — ${contact}` : ''}${summary ? `\n  ${summary}` : ''}`;
    });

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${leads.length} nouveau${leads.length > 1 ? 'x' : ''} lead${leads.length > 1 ? 's' : ''} au téléphone\n${lines.join('\n')}`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Slack returned HTTP ${res.status}`);
  }

  // ─── HubSpot provider ────────────────────────────────────
  // Upserts contacts (keyed by email) via HubSpot v3 batch API.
  private async syncHubspot(integration: any, since: Date): Promise<void> {
    const token = integration.accessToken;
    if (!token) return;

    const contacts = await prisma.contact.findMany({
      where: { clientId: integration.clientId, updatedAt: { gte: since }, email: { not: null } },
      take: 100,
      select: { name: true, email: true, phone: true, status: true, leadScore: true },
    });

    if (contacts.length === 0) return;

    const inputs = contacts.map((c) => ({
      idProperty: 'email',
      id: c.email!,
      properties: {
        email:      c.email ?? '',
        firstname:  c.name?.split(' ')[0] ?? '',
        lastname:   c.name?.split(' ').slice(1).join(' ') ?? '',
        phone:      c.phone ?? '',
        hs_lead_status: (c.status ?? 'new').toUpperCase(),
        qwillio_score:  String(c.leadScore ?? 0),
      },
    }));

    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ inputs }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HubSpot API ${res.status}: ${body.slice(0, 200)}`);
    }

    logger.debug(`[CrmSync] HubSpot: upserted ${inputs.length} contacts`);
  }
}

export const crmSyncService = new CrmSyncService();
