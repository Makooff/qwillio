import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { getPrompt, type Lang } from './prompt-loader.service';

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  total?: number;
}

interface GenerateOpts {
  clientId: string;
  docType: 'quote' | 'contract' | 'estimate' | 'invoice';
  items: LineItem[];
  customerInfo: { name: string; email?: string; address?: string };
  language?: Lang;
  notes?: string;
}

interface DocOutput {
  title: string;
  introduction: string;
  sections: Array<{ heading: string; body: string }>;
  lineItems: Array<{ description: string; qty: number; unitPrice: number; total: number }>;
  subtotal: number;
  tax: number;
  total: number;
  disclaimer: string;
}

const sanitize = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 1000);

const LEGAL_DISCLAIMER_FR = 'Ce document a été généré par une assistance IA. Faites-le valider par un professionnel avant signature.';
const LEGAL_DISCLAIMER_EN = 'This document was generated with AI assistance. Have it reviewed by a professional before signing.';

export class AgentDocumentService {
  async getConfig(clientId: string) {
    return prisma.agentDocumentConfig.upsert({
      where: { clientId },
      update: {},
      create: { clientId },
    });
  }

  async updateConfig(clientId: string, patch: Record<string, unknown>) {
    return prisma.agentDocumentConfig.upsert({
      where: { clientId },
      update: patch,
      create: { clientId, ...patch },
    });
  }

  async generate(opts: GenerateOpts): Promise<{ activityId: string; output: DocOutput }> {
    const client = await prisma.client.findUnique({ where: { id: opts.clientId } });
    if (!client) throw new Error('Client not found');

    const config = await this.getConfig(opts.clientId);
    const lang: Lang = opts.language ?? (client.agentLanguage === 'fr' ? 'fr' : 'en');

    // Deterministic numeric computation first (LLM never invents numbers).
    const computedItems = opts.items.map(it => ({
      description: sanitize(it.description),
      qty: Number(it.qty) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      total: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
    }));
    const subtotal = computedItems.reduce((s, i) => s + i.total, 0);
    const tax = 0;
    const total = subtotal + tax;

    const prompt = await getPrompt('document', lang);
    const userPrompt = prompt.user
      .replace('{{docType}}', sanitize(opts.docType))
      .replace('{{businessName}}', sanitize(client.businessName ?? ''))
      .replace('{{niche}}', sanitize(client.businessType ?? ''))
      .replace('{{customerInfo}}', sanitize(JSON.stringify(opts.customerInfo)))
      .replace('{{items}}', sanitize(JSON.stringify(computedItems)))
      .replace('{{currency}}', sanitize(config.defaultCurrency));

    const disclaimer = config.legalDisclaimer || (lang === 'fr' ? LEGAL_DISCLAIMER_FR : LEGAL_DISCLAIMER_EN);

    let output: DocOutput;
    try {
      const llm = await callOpenAI(prompt.system, userPrompt);
      // Override LLM numbers with deterministic ones to prevent hallucination.
      output = {
        ...llm,
        lineItems: computedItems,
        subtotal,
        tax,
        total,
        disclaimer,
      };
    } catch (e) {
      logger.warn('[document] LLM failed, using fallback', e);
      output = {
        title: lang === 'fr' ? `${opts.docType === 'quote' ? 'Devis' : 'Document'} — ${client.businessName}` : `${opts.docType.charAt(0).toUpperCase() + opts.docType.slice(1)} — ${client.businessName}`,
        introduction: lang === 'fr'
          ? `Bonjour ${opts.customerInfo.name}, veuillez trouver ci-dessous le détail.`
          : `Hi ${opts.customerInfo.name}, please find the details below.`,
        sections: [],
        lineItems: computedItems,
        subtotal,
        tax,
        total,
        disclaimer,
      };
    }

    const activity = await prisma.agentDocumentActivity.create({
      data: {
        clientId: opts.clientId,
        type: `${opts.docType}_generated`,
        documentType: opts.docType,
        recipientEmail: opts.customerInfo.email ?? null,
        content: JSON.parse(JSON.stringify({ ...output, customerInfo: opts.customerInfo, language: lang })),
        status: 'draft',
      },
    });

    return { activityId: activity.id, output };
  }

  async sendForSignature(activityId: string) {
    const doc = await prisma.agentDocumentActivity.findUnique({ where: { id: activityId } });
    if (!doc) throw new Error('Document not found');
    if (!doc.recipientEmail) throw new Error('No recipient email on this document');

    // TODO v2: Wire to DocuSign / Yousign / HelloSign here.
    // For now: mark as 'sent_for_signature' and produce a previewable HTML link.
    return prisma.agentDocumentActivity.update({
      where: { id: activityId },
      data: {
        status: 'sent_for_signature',
        performedAt: new Date(),
      },
    });
  }

  async markSigned(activityId: string) {
    return prisma.agentDocumentActivity.update({
      where: { id: activityId },
      data: {
        status: 'signed',
        signedAt: new Date(),
      },
    });
  }

  async listDocuments(clientId: string, opts: { documentType?: string; status?: string; limit?: number } = {}) {
    const where: any = { clientId };
    if (opts.documentType) where.documentType = opts.documentType;
    if (opts.status) where.status = opts.status;
    return prisma.agentDocumentActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }

  async getDashboard(clientId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [config, last24h, last30d, byStatus, byType] = await Promise.all([
      this.getConfig(clientId),
      prisma.agentDocumentActivity.count({
        where: { clientId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.agentDocumentActivity.count({ where: { clientId, createdAt: { gte: since } } }),
      prisma.agentDocumentActivity.groupBy({
        by: ['status'],
        where: { clientId, createdAt: { gte: since } },
        _count: { _all: true },
      } as any),
      prisma.agentDocumentActivity.groupBy({
        by: ['documentType'],
        where: { clientId, createdAt: { gte: since } },
        _count: { _all: true },
      } as any),
    ]);
    return { config, last24h, last30d, byStatus, byType };
  }
}

async function callOpenAI(system: string, user: string): Promise<DocOutput> {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const data = await r.json() as any;
  return JSON.parse(data?.choices?.[0]?.message?.content);
}

export const agentDocumentService = new AgentDocumentService();
