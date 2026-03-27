import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { OAuth2Client } from 'google-auth-library';
import type { AgentEmailConfig } from '@prisma/client';

interface GmailTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

interface ClassificationResult {
  classification: string;
  confidence: number;
  needsFollowUp: boolean;
  suggestedReply: string | null;
}

interface EmailListOpts {
  classification?: string;
  page?: number;
  limit?: number;
}

export class AgentEmailService {

  // ═══════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════

  private getOAuth2Client(): OAuth2Client {
    return new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${env.API_BASE_URL}/api/agent/email/oauth/callback`
    );
  }

  private async gmailFetch(accessToken: string, path: string, options?: RequestInit) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`Gmail API error: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  private encodeEmail(to: string, from: string, subject: string, body: string, inReplyTo?: string): string {
    const lines = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
    ];
    if (inReplyTo) {
      lines.push(`In-Reply-To: ${inReplyTo}`);
      lines.push(`References: ${inReplyTo}`);
    }
    lines.push('', body);
    return Buffer.from(lines.join('\r\n')).toString('base64url');
  }

  private async callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json() as any;
    return data.choices[0].message.content;
  }

  private parseGmailBody(payload: any): string {
    // Try text/plain first
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    // Check parts for multipart messages
    if (payload.parts) {
      // Prefer text/plain
      const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        return Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }

      // Fallback to text/html with tag stripping
      const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
      if (htmlPart?.body?.data) {
        const html = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      // Recurse into nested multipart
      for (const part of payload.parts) {
        if (part.parts) {
          const nested = this.parseGmailBody(part);
          if (nested) return nested;
        }
      }
    }

    // Direct body fallback
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    return '';
  }

  private getHeader(headers: any[], name: string): string {
    const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
    return header?.value || '';
  }

  // ═══════════════════════════════════════════
  // 1. OAUTH URL GENERATION
  // ═══════════════════════════════════════════

  getOAuthUrl(clientId: string): string {
    const client = this.getOAuth2Client();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
      state: clientId,
    });
    return url;
  }

  // ═══════════════════════════════════════════
  // 2. OAUTH CALLBACK
  // ═══════════════════════════════════════════

  async handleOAuthCallback(code: string, clientId: string): Promise<{ success: boolean }> {
    const client = this.getOAuth2Client();
    const { tokens } = await client.getToken(code);

    const gmailToken: GmailTokens = {
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token || '',
      expiry_date: tokens.expiry_date || 0,
    };

    await prisma.agentEmailConfig.upsert({
      where: { clientId },
      update: { gmailToken: gmailToken as any },
      create: {
        clientId,
        gmailToken: gmailToken as any,
        active: true,
      },
    });

    logger.info(`Gmail OAuth completed for client ${clientId}`);
    return { success: true };
  }

  // ═══════════════════════════════════════════
  // 3. TOKEN REFRESH
  // ═══════════════════════════════════════════

  async refreshAccessToken(config: AgentEmailConfig): Promise<string> {
    const tokens = config.gmailToken as unknown as GmailTokens;
    if (!tokens?.refresh_token) {
      throw new Error(`No refresh token for client ${config.clientId}`);
    }

    // If token is still valid (with 5-minute buffer), return it
    if (tokens.expiry_date && Date.now() < tokens.expiry_date - 5 * 60 * 1000) {
      return tokens.access_token;
    }

    const client = this.getOAuth2Client();
    client.setCredentials({ refresh_token: tokens.refresh_token });
    const { credentials } = await client.refreshAccessToken();

    const updatedToken: GmailTokens = {
      access_token: credentials.access_token || tokens.access_token,
      refresh_token: credentials.refresh_token || tokens.refresh_token,
      expiry_date: credentials.expiry_date || 0,
    };

    await prisma.agentEmailConfig.update({
      where: { id: config.id },
      data: { gmailToken: updatedToken as any },
    });

    return updatedToken.access_token;
  }

  // ═══════════════════════════════════════════
  // 4. SYNC EMAILS
  // ═══════════════════════════════════════════

  async syncEmails(clientId: string): Promise<number> {
    const config = await prisma.agentEmailConfig.findUnique({ where: { clientId } });
    if (!config || !config.gmailToken || !config.active) {
      logger.warn(`Email sync skipped: no active config for client ${clientId}`);
      return 0;
    }

    const accessToken = await this.refreshAccessToken(config);

    // Fetch unread messages list
    const listResult: any = await this.gmailFetch(accessToken, '/messages?q=is:unread&maxResults=20');
    const messages: any[] = listResult.messages || [];

    if (messages.length === 0) {
      await prisma.agentEmailConfig.update({
        where: { id: config.id },
        data: { lastSyncAt: new Date() },
      });
      return 0;
    }

    let synced = 0;

    for (const msg of messages) {
      try {
        // Skip if already stored
        const existing = await prisma.agentEmail.findUnique({
          where: { gmailMessageId: msg.id },
        });
        if (existing) continue;

        // Fetch full message
        const fullMsg: any = await this.gmailFetch(accessToken, `/messages/${msg.id}?format=full`);
        const headers = fullMsg.payload?.headers || [];

        const from = this.getHeader(headers, 'From');
        const to = this.getHeader(headers, 'To');
        const subject = this.getHeader(headers, 'Subject');
        const dateStr = this.getHeader(headers, 'Date');
        const receivedAt = dateStr ? new Date(dateStr) : new Date();

        // Check blocked senders
        if (config.blockedSenders.some((blocked: string) => from.toLowerCase().includes(blocked.toLowerCase()))) {
          logger.debug(`Skipping blocked sender: ${from}`);
          continue;
        }

        const bodyFull = this.parseGmailBody(fullMsg.payload);
        const bodyPreview = bodyFull.substring(0, 2000); // Store up to 2000 chars

        const email = await prisma.agentEmail.create({
          data: {
            clientId,
            gmailMessageId: msg.id,
            threadId: fullMsg.threadId || null,
            fromAddress: from,
            toAddress: to,
            subject: subject || '(no subject)',
            bodyPreview,
            receivedAt,
            isRead: false,
          },
        });

        // Classify asynchronously (don't block sync)
        this.classifyEmail(email.id).catch((err) => {
          logger.error(`Classification failed for email ${email.id}:`, err);
        });

        synced++;
      } catch (err) {
        logger.error(`Failed to sync Gmail message ${msg.id}:`, err);
      }
    }

    await prisma.agentEmailConfig.update({
      where: { id: config.id },
      data: { lastSyncAt: new Date() },
    });

    logger.info(`Synced ${synced} emails for client ${clientId}`);
    return synced;
  }

  // ═══════════════════════════════════════════
  // 5. CLASSIFY EMAIL
  // ═══════════════════════════════════════════

  async classifyEmail(emailId: string): Promise<void> {
    const email = await prisma.agentEmail.findUnique({
      where: { id: emailId },
      include: { client: true },
    });
    if (!email) {
      logger.warn(`classifyEmail: email ${emailId} not found`);
      return;
    }

    const config = await prisma.agentEmailConfig.findUnique({
      where: { clientId: email.clientId },
    });

    const businessContextLine = config?.businessContext
      ? `\nAdditional business context: ${config.businessContext}`
      : '';

    const systemPrompt = `You are an email classifier for ${email.client.businessName}, a ${email.client.businessType} business.${businessContextLine}

Classify this email into exactly one category:
urgent, inquiry, booking, spam, newsletter, complaint, thank_you, other

Also determine:
- Does this need a follow-up? (true/false)
- If autoReply is appropriate, suggest a brief professional reply.

Return JSON: {"classification": "...", "confidence": 0.0-1.0, "needsFollowUp": true/false, "suggestedReply": "..." or null}`;

    const userPrompt = `Email from: ${email.fromAddress}
Subject: ${email.subject}
Body: ${email.bodyPreview.substring(0, 500)}`;

    try {
      const raw = await this.callOpenAI(systemPrompt, userPrompt);
      const result: ClassificationResult = JSON.parse(raw);

      const updateData: any = {
        classification: result.classification,
        classificationConfidence: result.confidence,
        needsFollowUp: result.needsFollowUp,
      };

      if (result.needsFollowUp && config?.followUpEnabled) {
        updateData.followUpAt = new Date(Date.now() + (config.followUpDelayHours || 24) * 60 * 60 * 1000);
      }

      await prisma.agentEmail.update({
        where: { id: emailId },
        data: updateData,
      });

      logger.debug(`Classified email ${emailId} as ${result.classification} (${result.confidence})`);
    } catch (err) {
      logger.error(`classifyEmail failed for ${emailId}:`, err);
    }
  }

  // ═══════════════════════════════════════════
  // 6. PROCESS AUTO-REPLIES
  // ═══════════════════════════════════════════

  async processAutoReplies(clientId: string): Promise<number> {
    const config = await prisma.agentEmailConfig.findUnique({ where: { clientId } });
    if (!config || !config.autoReply || !config.gmailToken || !config.active) {
      return 0;
    }

    const accessToken = await this.refreshAccessToken(config);

    const emails = await prisma.agentEmail.findMany({
      where: {
        clientId,
        classification: { in: ['inquiry', 'booking'] },
        autoReplied: false,
      },
      include: { client: true },
    });

    let replied = 0;

    for (const email of emails) {
      try {
        const businessContextLine = config.businessContext
          ? `\nBusiness context: ${config.businessContext}`
          : '';

        const systemPrompt = `You are a professional email assistant for ${email.client.businessName}, a ${email.client.businessType} business.${businessContextLine}

Write a ${config.replyTone} reply to this email. Be helpful and concise. Do not make up information you don't have.

Return JSON: {"reply": "..."}`;

        const userPrompt = `Original email from: ${email.fromAddress}
Subject: ${email.subject}
Body: ${email.bodyPreview.substring(0, 500)}`;

        const raw = await this.callOpenAI(systemPrompt, userPrompt);
        const { reply } = JSON.parse(raw);

        if (!reply) continue;

        // Send via Gmail API
        const replySubject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;
        const encodedEmail = this.encodeEmail(
          email.fromAddress,
          email.toAddress,
          replySubject,
          reply,
          email.gmailMessageId
        );

        await this.gmailFetch(accessToken, '/messages/send', {
          method: 'POST',
          body: JSON.stringify({
            raw: encodedEmail,
            threadId: email.threadId || undefined,
          }),
        });

        await prisma.agentEmail.update({
          where: { id: email.id },
          data: {
            autoReplied: true,
            autoReplyText: reply,
          },
        });

        replied++;
        logger.info(`Auto-replied to email ${email.id} (${email.subject})`);
      } catch (err) {
        logger.error(`Auto-reply failed for email ${email.id}:`, err);
      }
    }

    return replied;
  }

  // ═══════════════════════════════════════════
  // 7. PROCESS FOLLOW-UPS (CRON)
  // ═══════════════════════════════════════════

  async processFollowUps(): Promise<number> {
    const emails = await prisma.agentEmail.findMany({
      where: {
        needsFollowUp: true,
        followUpAt: { lte: new Date() },
        followUpSent: false,
      },
      include: { client: true },
    });

    let sent = 0;

    for (const email of emails) {
      try {
        const config = await prisma.agentEmailConfig.findUnique({
          where: { clientId: email.clientId },
        });
        if (!config || !config.gmailToken || !config.active) continue;

        const accessToken = await this.refreshAccessToken(config);

        const businessContextLine = config.businessContext
          ? `\nBusiness context: ${config.businessContext}`
          : '';

        const systemPrompt = `You are a professional follow-up email assistant for ${email.client.businessName}, a ${email.client.businessType} business.${businessContextLine}

Write a ${config.replyTone} follow-up email. Be polite and remind them about their previous inquiry without being pushy.

Return JSON: {"reply": "..."}`;

        const userPrompt = `Original email from: ${email.fromAddress}
Subject: ${email.subject}
Body: ${email.bodyPreview.substring(0, 500)}`;

        const raw = await this.callOpenAI(systemPrompt, userPrompt);
        const { reply } = JSON.parse(raw);

        if (!reply) continue;

        const followUpSubject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;
        const encodedEmail = this.encodeEmail(
          email.fromAddress,
          email.toAddress,
          followUpSubject,
          reply,
          email.gmailMessageId
        );

        await this.gmailFetch(accessToken, '/messages/send', {
          method: 'POST',
          body: JSON.stringify({
            raw: encodedEmail,
            threadId: email.threadId || undefined,
          }),
        });

        await prisma.agentEmail.update({
          where: { id: email.id },
          data: { followUpSent: true },
        });

        sent++;
        logger.info(`Follow-up sent for email ${email.id} (${email.subject})`);
      } catch (err) {
        logger.error(`Follow-up failed for email ${email.id}:`, err);
      }
    }

    return sent;
  }

  // ═══════════════════════════════════════════
  // 8. SYNC ALL CLIENTS (CRON)
  // ═══════════════════════════════════════════

  async syncAllClients(): Promise<void> {
    const subscriptions = await prisma.agentSubscription.findMany({
      where: { emailAi: true, status: 'active' },
      select: { clientId: true },
    });

    const configuredClients = await prisma.agentEmailConfig.findMany({
      where: {
        clientId: { in: subscriptions.map((s) => s.clientId) },
        gmailToken: { not: undefined },
        active: true,
      },
      select: { clientId: true },
    });

    logger.info(`syncAllClients: processing ${configuredClients.length} clients`);

    for (const { clientId } of configuredClients) {
      try {
        await this.syncEmails(clientId);
        await this.processAutoReplies(clientId);
      } catch (err) {
        logger.error(`syncAllClients failed for client ${clientId}:`, err);
      }
    }
  }

  // ═══════════════════════════════════════════
  // 9. EMAIL DASHBOARD
  // ═══════════════════════════════════════════

  async getEmailDashboard(clientId: string) {
    const [totalEmails, unreadCount, autoRepliedCount, byClassification, last7DaysTrend] = await Promise.all([
      prisma.agentEmail.count({ where: { clientId } }),
      prisma.agentEmail.count({ where: { clientId, isRead: false } }),
      prisma.agentEmail.count({ where: { clientId, autoReplied: true } }),
      prisma.agentEmail.groupBy({
        by: ['classification'],
        where: { clientId, classification: { not: null } },
        _count: { id: true },
      }),
      prisma.agentEmail.groupBy({
        by: ['receivedAt'],
        where: {
          clientId,
          receivedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _count: { id: true },
      }),
    ]);

    // Aggregate trend by date
    const trendMap: Record<string, number> = {};
    for (const entry of last7DaysTrend) {
      const dateKey = entry.receivedAt.toISOString().split('T')[0];
      trendMap[dateKey] = (trendMap[dateKey] || 0) + entry._count.id;
    }

    return {
      totalEmails,
      unreadCount,
      autoRepliedCount,
      byClassification: byClassification.map((g) => ({
        classification: g.classification,
        count: g._count.id,
      })),
      last7DaysTrend: Object.entries(trendMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  // ═══════════════════════════════════════════
  // 10. LIST EMAILS (PAGINATED)
  // ═══════════════════════════════════════════

  async listEmails(clientId: string, opts: EmailListOpts = {}) {
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { clientId };
    if (opts.classification) {
      where.classification = opts.classification;
    }

    const [emails, total] = await Promise.all([
      prisma.agentEmail.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.agentEmail.count({ where }),
    ]);

    return {
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const agentEmailService = new AgentEmailService();
