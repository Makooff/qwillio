import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

const CONTRACT_VERSION = '1.0';

interface ContractData {
  clientName: string;
  clientEmail: string;
  clientBusinessName: string;
  clientAddress?: string;
  planType: 'starter' | 'pro' | 'enterprise';
  monthlyFee: number;
  setupFee: number;
  trialEndDate: string; // ISO date
  ipAddress: string;
  userAgent: string;
}

const PLANS: Record<string, { name: string; calls: number; features: string[] }> = {
  starter: {
    name: 'Starter',
    calls: 200,
    features: ['AI Receptionist', '200 calls/month', 'Email notifications', 'Basic analytics'],
  },
  pro: {
    name: 'Pro',
    calls: 500,
    features: ['AI Receptionist', '500 calls/month', 'Email + SMS notifications', 'Advanced analytics', 'Call transfers', 'Priority support'],
  },
  enterprise: {
    name: 'Enterprise',
    calls: 1000,
    features: ['AI Receptionist', '1000 calls/month', 'Full notification suite', 'Enterprise analytics', 'Call transfers', 'Dedicated support', 'Custom integrations'],
  },
};

export class ContractService {
  async generateContract(data: ContractData): Promise<Buffer> {
    const plan = PLANS[data.planType] || PLANS.starter;
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 9;
    const lineHeight = 14;
    const margin = 50;

    const addPage = () => {
      const page = pdfDoc.addPage([612, 792]); // US Letter
      return page;
    };

    let page = addPage();
    let y = 742;

    const writeLine = (text: string, options: { bold?: boolean; size?: number; indent?: number; color?: [number, number, number] } = {}) => {
      const f = options.bold ? fontBold : font;
      const s = options.size || fontSize;
      const x = margin + (options.indent || 0);
      const c = options.color || [0, 0, 0];

      if (y < 60) {
        page = addPage();
        y = 742;
      }

      page.drawText(text, { x, y, size: s, font: f, color: rgb(c[0], c[1], c[2]) });
      y -= (options.size || fontSize) + 4;
    };

    const writeBlock = (text: string, options: { bold?: boolean; indent?: number } = {}) => {
      const maxWidth = 512 - (options.indent || 0);
      const f = options.bold ? fontBold : font;
      const words = text.split(' ');
      let line = '';

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const width = f.widthOfTextAtSize(testLine, fontSize);
        if (width > maxWidth && line) {
          writeLine(line, options);
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) writeLine(line, options);
    };

    const writeSection = (title: string, content: string[]) => {
      y -= 6;
      writeLine(title, { bold: true, size: 11 });
      y -= 2;
      for (const para of content) {
        if (para.startsWith('• ')) {
          writeBlock(para, { indent: 15 });
        } else if (para.startsWith('**') && para.endsWith('**')) {
          writeBlock(para.replace(/\*\*/g, ''), { bold: true });
        } else {
          writeBlock(para);
        }
      }
    };

    // ═══════════════════════════════════════════
    // HEADER
    // ═══════════════════════════════════════════
    writeLine('QWILLIO SERVICE AGREEMENT', { bold: true, size: 16 });
    y -= 4;
    writeLine(`Contract Version: ${CONTRACT_VERSION}`, { size: 8, color: [0.5, 0.5, 0.5] });
    writeLine(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { size: 8, color: [0.5, 0.5, 0.5] });
    y -= 10;

    // ═══════════════════════════════════════════
    // SECTION 1 — PARTIES
    // ═══════════════════════════════════════════
    writeSection('Section 1 — Parties', [
      'This Service Agreement ("Agreement") is entered into by and between:',
      '**Provider:** Qwillio LLC, [QWILLIO_LEGAL_ENTITY], registered in the State of Delaware, USA ("Qwillio", "we", "us").',
      `**Client:** ${data.clientName}, operating as ${data.clientBusinessName}${data.clientAddress ? `, located at ${data.clientAddress}` : ''} ("Client", "you").`,
      `Contact email: ${data.clientEmail}`,
    ]);

    // ═══════════════════════════════════════════
    // SECTION 2 — FREE TRIAL TERMS
    // ═══════════════════════════════════════════
    writeSection('Section 2 — Free Trial Terms (FTC & EU Compliant)', [
      `Duration: Your free trial period is exactly 30 days from account activation, ending on ${data.trialEndDate}.`,
      `Plan: ${plan.name} Plan — full access to all features included in this tier during the trial period.`,
      'Credit Card Required: A valid payment method must be provided before the trial begins. No charge will be applied during the trial period unless you exceed usage limits.',
      '**IMPORTANT AUTO-RENEWAL NOTICE:**',
      `**YOUR SUBSCRIPTION WILL AUTOMATICALLY RENEW AND YOUR PAYMENT METHOD WILL BE CHARGED $${data.monthlyFee}/MONTH ON ${data.trialEndDate} UNLESS YOU CANCEL AT LEAST 24 HOURS BEFORE THAT DATE.**`,
      `Cancellation Deadline: You must cancel at least 24 hours before ${data.trialEndDate} to avoid being charged.`,
      'No Extensions: The trial period cannot be extended under any circumstances.',
      'One Trial Per Person: Only one free trial is permitted per individual, as determined by phone number, device, payment method, and identity verification. Any attempt to circumvent this limitation, including but not limited to creating multiple accounts, using different email addresses, or using proxy services, will result in immediate account termination and may result in legal action for fraud.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 3 — SUBSCRIPTION TERMS
    // ═══════════════════════════════════════════
    writeSection('Section 3 — Subscription Terms', [
      `Plan: ${plan.name}`,
      `Monthly Fee: $${data.monthlyFee}/month`,
      `Setup Fee: $${data.setupFee} (one-time, charged at first billing)`,
      `Included: ${plan.calls} calls per month`,
      'Billing Cycle: Monthly, on the same calendar date each month.',
      'Price Changes: Qwillio will provide at least 30 days written notice before any price increase takes effect.',
      'Auto-Renewal: Your subscription automatically renews each month until cancelled.',
      'Cancellation: Cancellation may be done via the client dashboard or by written notice to support@qwillio.com. Cancellation takes effect at the end of the current billing period. No prorated refunds are issued for partial billing periods.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 4 — ACCEPTABLE USE
    // ═══════════════════════════════════════════
    writeSection('Section 4 — Acceptable Use', [
      'The Service is provided for legitimate business use only. The following are strictly prohibited:',
      '• Attempting to obtain multiple free trials through any means',
      '• Creating multiple accounts for the same person or business',
      '• Providing false identity or business information',
      '• Using VPN, proxy, or other tools to circumvent geographic or identity restrictions',
      '• Reselling, sublicensing, or redistributing the Service',
      '• Using the Service for illegal purposes or to facilitate fraud',
      'Violation of this Acceptable Use Policy results in immediate termination without refund and potential recovery of costs incurred by Qwillio, including legal fees.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 5 — SERVICE LEVEL
    // ═══════════════════════════════════════════
    writeSection('Section 5 — Service Level', [
      'Qwillio targets 99% monthly uptime for the core AI receptionist service.',
      'Planned maintenance will be communicated with at least 24 hours advance notice.',
      'If uptime falls below 95% in any calendar month (excluding planned maintenance), Client will receive a prorated service credit for the downtime period. No cash refunds are issued.',
      'Qwillio is not liable for outages caused by third-party service providers (including but not limited to Vapi, Twilio, Stripe, and cloud infrastructure providers) beyond its reasonable control.',
    ]);

    // New page for remaining sections
    page = addPage();
    y = 742;

    // ═══════════════════════════════════════════
    // SECTION 6 — AI DISCLOSURE
    // ═══════════════════════════════════════════
    writeSection('Section 6 — AI Disclosure (US & EU Requirement)', [
      'Client acknowledges and agrees that the Service uses artificial intelligence (AI) voice technology to conduct phone conversations on behalf of Client.',
      'Client is solely responsible for ensuring that their use of the AI receptionist complies with all applicable laws in their jurisdiction, including but not limited to: call recording disclosure requirements, telemarketing regulations, consumer protection laws, and data protection requirements.',
      'Qwillio provides the technology platform. Legal compliance in the Client\'s jurisdiction is the Client\'s sole responsibility.',
      'Client must not use the Service to deceive callers in a manner that causes harm or violates applicable law.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 7 — DATA PROTECTION (GDPR + CCPA)
    // ═══════════════════════════════════════════
    writeSection('Section 7 — Data Protection (GDPR & CCPA)', [
      'Data Controller: Client is the data controller for their callers\' personal data.',
      'Data Processor: Qwillio acts as the data processor, processing data solely on Client\'s instructions and for the purpose of providing the Service. A Data Processing Agreement (DPA) is available upon request.',
      'Call recordings and transcripts are stored for 90 days, then automatically deleted unless Client requests a different retention period.',
      'Right to Erasure: Personal data will be deleted within 30 days of a valid written request. Hashed security fingerprints (which cannot be reversed to identify individuals) are retained for fraud prevention under legitimate interest grounds.',
      'Data Transfers: Data is processed in the United States and European Union. Standard Contractual Clauses apply for EU-US data transfers.',
      'CCPA: Qwillio does not sell personal data. Qwillio does not share personal data for cross-context behavioral advertising.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 8 — LIABILITY
    // ═══════════════════════════════════════════
    writeSection('Section 8 — Limitation of Liability', [
      `Qwillio's total aggregate liability under this Agreement shall not exceed the amount of subscription fees paid by Client in the three (3) months immediately preceding the event giving rise to the claim.`,
      'In no event shall Qwillio be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, business opportunities, or goodwill.',
      'Client agrees to indemnify and hold harmless Qwillio against any and all claims, damages, losses, and expenses arising from Client\'s use of the Service or violation of this Agreement.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 9 — GOVERNING LAW
    // ═══════════════════════════════════════════
    writeSection('Section 9 — Governing Law & Dispute Resolution', [
      'For US Clients: This Agreement is governed by the laws of the State of Delaware, without regard to conflict of law provisions. Disputes shall be resolved by binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules.',
      'For EU Clients: This Agreement is governed by the laws of Belgium. Disputes shall be submitted to the competent courts of Brussels, Belgium. EU consumers retain the right to bring proceedings in their Member State of residence under the EU Consumer Rights Directive.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 10 — IDENTITY VERIFICATION CONSENT
    // ═══════════════════════════════════════════
    writeSection('Section 10 — Identity Verification & Fraud Prevention Consent', [
      'By accepting this Agreement, Client explicitly consents to the following fraud prevention measures:',
      '• Phone number verification via one-time password (OTP)',
      '• Email address verification via one-time password (OTP)',
      '• Browser/device fingerprinting for account security',
      '• IP address analysis for geographic verification',
      '• Payment method fingerprinting via Stripe',
      'Client acknowledges that hashed (irreversible) identifiers derived from the above signals are retained after account deletion solely for the purpose of preventing trial abuse. This retention is disclosed transparently and is conducted under the legitimate interest legal basis (GDPR Art. 6(1)(f)).',
    ]);

    // ═══════════════════════════════════════════
    // ACCEPTANCE
    // ═══════════════════════════════════════════
    y -= 20;
    writeLine('ACCEPTANCE', { bold: true, size: 12 });
    y -= 4;
    writeBlock(`By checking the acceptance box, Client acknowledges having read, understood, and agreed to all terms of this Service Agreement on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`);
    y -= 10;
    writeLine(`Client: ${data.clientName}`, { bold: true });
    writeLine(`Business: ${data.clientBusinessName}`);
    writeLine(`Email: ${data.clientEmail}`);
    writeLine(`IP Address: ${data.ipAddress}`, { size: 7, color: [0.5, 0.5, 0.5] });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generate contract HTML for display in signup modal.
   */
  generateContractHTML(data: ContractData): string {
    const plan = PLANS[data.planType] || PLANS.starter;

    return `
<div style="font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
  <h1 style="text-align: center; font-size: 20px;">QWILLIO SERVICE AGREEMENT</h1>
  <p style="text-align: center; color: #888; font-size: 12px;">Contract Version ${CONTRACT_VERSION} | ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

  <h2>Section 1 — Parties</h2>
  <p><strong>Provider:</strong> Qwillio LLC, Delaware, USA</p>
  <p><strong>Client:</strong> ${data.clientName}, ${data.clientBusinessName}</p>

  <h2>Section 2 — Free Trial Terms</h2>
  <p>Your free trial is <strong>30 days</strong> from activation, ending on <strong>${data.trialEndDate}</strong>.</p>
  <p>Plan: <strong>${plan.name}</strong> — full access to all features.</p>
  <p>A valid payment method is required before the trial begins.</p>
  <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 12px; border-radius: 8px; margin: 16px 0;">
    <p style="font-weight: bold; font-size: 15px; margin: 0;">
      YOUR SUBSCRIPTION WILL AUTOMATICALLY RENEW AND YOUR PAYMENT METHOD WILL BE CHARGED $${data.monthlyFee}/MONTH ON ${data.trialEndDate} UNLESS YOU CANCEL AT LEAST 24 HOURS BEFORE THAT DATE.
    </p>
  </div>
  <p><strong>One trial per person.</strong> Circumvention attempts will result in account termination.</p>

  <h2>Section 3 — Subscription Terms</h2>
  <p>${plan.name} Plan: <strong>$${data.monthlyFee}/month</strong> + <strong>$${data.setupFee} setup fee</strong></p>
  <p>Includes: ${plan.calls} calls/month. Billed monthly. 30-day price change notice required.</p>

  <h2>Section 4 — Acceptable Use</h2>
  <p>Prohibited: multiple trials, false identity, VPN circumvention, reselling. Violation = termination.</p>

  <h2>Section 5 — Service Level</h2>
  <p>99% uptime target. Credit issued if below 95%. Not liable for third-party outages.</p>

  <h2>Section 6 — AI Disclosure</h2>
  <p>Service uses AI voice technology. Client responsible for local law compliance.</p>

  <h2>Section 7 — Data Protection (GDPR & CCPA)</h2>
  <p>Client is data controller. Qwillio is data processor. 90-day recording retention. Right to erasure within 30 days. Qwillio does not sell personal data.</p>

  <h2>Section 8 — Liability</h2>
  <p>Liability capped at 3 months of fees. No indirect/consequential damages.</p>

  <h2>Section 9 — Governing Law</h2>
  <p>US clients: Delaware law, AAA arbitration. EU clients: Belgium law, Brussels courts.</p>

  <h2>Section 10 — Fraud Prevention Consent</h2>
  <p>You consent to: phone OTP, email OTP, device fingerprinting, IP analysis, payment fingerprinting. Hashed identifiers retained after deletion for abuse prevention.</p>
</div>`;
  }

  /**
   * Record contract acceptance.
   */
  async recordAcceptance(data: {
    clientId?: string;
    userId?: string;
    planType: string;
    ipAddress: string;
    userAgent: string;
    contractPdfUrl?: string;
  }): Promise<void> {
    try {
      await prisma.contractAcceptance.create({
        data: {
          clientId: data.clientId || null,
          userId: data.userId || null,
          contractVersion: CONTRACT_VERSION,
          planType: data.planType,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          contractPdfUrl: data.contractPdfUrl || null,
        },
      });
      logger.info(`Contract acceptance recorded for ${data.clientId || data.userId}`);
    } catch (error) {
      logger.error('Failed to record contract acceptance:', error);
    }
  }
}

export const contractService = new ContractService();
