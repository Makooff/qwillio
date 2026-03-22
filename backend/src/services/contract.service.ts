import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

const CONTRACT_VERSION = '2.0';

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

const PLANS: Record<string, { name: string; calls: number; overage: number; features: string[] }> = {
  starter: {
    name: 'Starter',
    calls: 800,
    overage: 0.22,
    features: ['Ashley (EN) or Marie (FR) dedicated AI voice', '800 calls/month', 'Appointment booking + calendar sync', 'Analytics dashboard', 'Email support'],
  },
  pro: {
    name: 'Pro',
    calls: 2000,
    overage: 0.18,
    features: ['Everything in Starter', '2,000 calls/month', 'Advanced analytics + sentiment analysis', 'Smart call transfer', 'Priority support', 'Native CRM integrations'],
  },
  enterprise: {
    name: 'Enterprise',
    calls: 4000,
    overage: 0.15,
    features: ['Everything in Pro', '4,000 calls/month', 'Bilingual agent EN/FR', 'Dedicated account manager', '99.5% SLA guaranteed', 'Self-learning AI optimization'],
  },
};

export class ContractService {
  async generateContract(data: ContractData): Promise<Buffer> {
    const plan = PLANS[data.planType] || PLANS.starter;
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontSize = 8.5;
    const margin = 50;
    const pageWidth = 612;
    const pageHeight = 792;
    const contentWidth = pageWidth - margin * 2;
    let pageNumber = 0;

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let page: PDFPage;
    let y: number;

    const addPage = () => {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      pageNumber++;
      y = 742;

      // Header line
      page.drawLine({ start: { x: margin, y: 755 }, end: { x: pageWidth - margin, y: 755 }, thickness: 0.5, color: rgb(0.2, 0.2, 0.2) });
      page.drawText('QWILLIO LLC', { x: margin, y: 760, size: 7, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
      page.drawText('CONFIDENTIAL', { x: pageWidth - margin - font.widthOfTextAtSize('CONFIDENTIAL', 7), y: 760, size: 7, font: fontBold, color: rgb(0.6, 0.2, 0.2) });

      // Footer
      page.drawLine({ start: { x: margin, y: 35 }, end: { x: pageWidth - margin, y: 35 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      const footerText = `Qwillio Service Agreement v${CONTRACT_VERSION} | ${data.clientBusinessName} | Page ${pageNumber}`;
      page.drawText(footerText, { x: margin, y: 22, size: 6.5, font: fontItalic, color: rgb(0.5, 0.5, 0.5) });

      return page;
    };

    page = addPage();

    const writeLine = (text: string, options: { bold?: boolean; italic?: boolean; size?: number; indent?: number; color?: [number, number, number] } = {}) => {
      const f = options.bold ? fontBold : options.italic ? fontItalic : font;
      const s = options.size || fontSize;
      const x = margin + (options.indent || 0);
      const c = options.color || [0, 0, 0];

      if (y < 55) {
        page = addPage();
      }

      page.drawText(text, { x, y, size: s, font: f, color: rgb(c[0], c[1], c[2]) });
      y -= s + 3.5;
    };

    const writeBlock = (text: string, options: { bold?: boolean; italic?: boolean; indent?: number; size?: number } = {}) => {
      const maxWidth = contentWidth - (options.indent || 0);
      const f = options.bold ? fontBold : options.italic ? fontItalic : font;
      const s = options.size || fontSize;
      const words = text.split(' ');
      let line = '';

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const width = f.widthOfTextAtSize(testLine, s);
        if (width > maxWidth && line) {
          writeLine(line, { ...options, size: s });
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) writeLine(line, { ...options, size: s });
    };

    const drawHorizontalRule = () => {
      if (y < 55) page = addPage();
      page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
      y -= 8;
    };

    const writeSection = (num: string, title: string, content: string[]) => {
      y -= 8;
      if (y < 100) page = addPage();
      writeLine(`${num}. ${title}`, { bold: true, size: 10.5 });
      y -= 3;
      for (const para of content) {
        if (para === '---') {
          y -= 3;
        } else if (para.startsWith('* ')) {
          writeBlock(para, { indent: 15 });
        } else if (para.startsWith('  - ')) {
          writeBlock(para, { indent: 30 });
        } else if (para.startsWith('BOLD:')) {
          writeBlock(para.replace('BOLD:', ''), { bold: true });
        } else if (para.startsWith('ITALIC:')) {
          writeBlock(para.replace('ITALIC:', ''), { italic: true });
        } else {
          writeBlock(para);
        }
      }
    };

    const writeSubSection = (label: string, content: string[]) => {
      y -= 4;
      writeLine(label, { bold: true, size: 9 });
      y -= 1;
      for (const para of content) {
        if (para.startsWith('* ')) {
          writeBlock(para, { indent: 15 });
        } else {
          writeBlock(para);
        }
      }
    };

    // ═══════════════════════════════════════════════════════════════
    // COVER / TITLE BLOCK
    // ═══════════════════════════════════════════════════════════════
    y = 720;
    page.drawRectangle({ x: margin - 5, y: y - 85, width: contentWidth + 10, height: 100, color: rgb(0.96, 0.96, 0.98), borderColor: rgb(0.3, 0.35, 0.65), borderWidth: 1 });

    writeLine('MASTER SERVICE AGREEMENT', { bold: true, size: 18, color: [0.15, 0.15, 0.35] });
    y -= 2;
    writeLine('& SUBSCRIPTION TERMS OF SERVICE', { bold: true, size: 12, color: [0.3, 0.3, 0.5] });
    y -= 6;
    writeLine(`Contract Reference: QW-${Date.now().toString(36).toUpperCase()}-${data.planType.toUpperCase()}`, { size: 8, color: [0.4, 0.4, 0.4] });
    writeLine(`Version ${CONTRACT_VERSION} | Effective Date: ${dateStr}`, { size: 8, color: [0.4, 0.4, 0.4] });

    y -= 15;
    drawHorizontalRule();

    // ═══════════════════════════════════════════
    // RECITALS
    // ═══════════════════════════════════════════
    writeLine('RECITALS', { bold: true, size: 10.5 });
    y -= 3;
    writeBlock(`WHEREAS, Qwillio LLC, a limited liability company organized under the laws of the State of Delaware, United States ("Provider", "Qwillio", "we", "us", "our"), develops and operates an artificial intelligence (AI)-powered voice receptionist platform for businesses; and`);
    y -= 3;
    writeBlock(`WHEREAS, ${data.clientName}, acting on behalf of ${data.clientBusinessName}${data.clientAddress ? `, located at ${data.clientAddress}` : ''} ("Client", "Subscriber", "you", "your"), desires to subscribe to and use the Provider's Service as described herein; and`);
    y -= 3;
    writeBlock('WHEREAS, both parties wish to set forth the terms and conditions governing the provision and use of such Service, including pricing, data protection, intellectual property, liability, and dispute resolution;');
    y -= 3;
    writeBlock('NOW, THEREFORE, in consideration of the mutual covenants and agreements set forth herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:');

    y -= 5;
    drawHorizontalRule();

    // ═══════════════════════════════════════════
    // SECTION 1 — DEFINITIONS
    // ═══════════════════════════════════════════
    writeSection('1', 'DEFINITIONS & INTERPRETATION', [
      'For the purposes of this Agreement, the following terms shall have the meanings ascribed to them below:',
      '* "Service" means the Qwillio AI-powered voice receptionist platform, including all associated software, APIs, dashboards, integrations, call handling, and communication features.',
      '* "Subscription" means the ongoing, automatically-renewing right to access and use the Service under the selected Plan.',
      `* "Plan" means the ${plan.name} subscription tier selected by Client, as described in the Service Description (Section 3).`,
      '* "Confidential Information" means any non-public information disclosed by either party, including business plans, technical data, customer lists, pricing, source code, and trade secrets.',
      '* "Personal Data" has the meaning given under the EU General Data Protection Regulation (GDPR) 2016/679 and/or the California Consumer Privacy Act (CCPA), as applicable.',
      '* "Data Controller" means the entity that determines the purposes and means of processing Personal Data (the Client, with respect to caller data).',
      '* "Data Processor" means the entity that processes Personal Data on behalf of the Data Controller (Qwillio, with respect to caller data).',
      '* "Effective Date" means the date on which Client electronically accepts this Agreement or begins using the Service, whichever occurs first.',
      '* "Trial Period" means the initial 30-day period during which Client may use the Service without charge, subject to the terms herein.',
      '* "Overage" means usage exceeding the call volume included in the selected Plan.',
      '* "Force Majeure" means any event beyond a party\'s reasonable control, including natural disasters, war, terrorism, pandemics, governmental actions, power failures, internet outages, and failures of third-party service providers.',
      '* "Intellectual Property" means all patents, copyrights, trademarks, trade secrets, know-how, algorithms, models, and any other proprietary rights.',
      '* "Affiliate" means any entity that directly or indirectly controls, is controlled by, or is under common control with a party.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 2 — PARTIES
    // ═══════════════════════════════════════════
    writeSection('2', 'IDENTIFICATION OF THE PARTIES', [
      'BOLD:2.1 Provider',
      'Qwillio LLC, a Delaware limited liability company.',
      'Registered Agent: as on file with the Delaware Division of Corporations.',
      'Email: legal@qwillio.com | Support: support@qwillio.com',
      '---',
      'BOLD:2.2 Client',
      `Full Name: ${data.clientName}`,
      `Business Name: ${data.clientBusinessName}`,
      `Email: ${data.clientEmail}`,
      data.clientAddress ? `Address: ${data.clientAddress}` : 'Address: As provided in the Client account registration.',
      '---',
      'BOLD:2.3 Representations',
      'Each party represents and warrants that: (a) it has the legal power and authority to enter into this Agreement; (b) this Agreement constitutes a valid and binding obligation; (c) the execution of this Agreement does not conflict with any other agreement to which it is a party.',
      'Client further represents that: (a) the information provided during registration is true, accurate, and complete; (b) Client is authorized to bind the business entity named above; (c) Client is at least 18 years of age.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 3 — SERVICE DESCRIPTION
    // ═══════════════════════════════════════════
    writeSection('3', 'SERVICE DESCRIPTION & PLAN DETAILS', [
      'BOLD:3.1 Service Overview',
      'Qwillio provides an AI-powered voice receptionist that answers incoming phone calls on behalf of Client\'s business. The Service includes: automated call answering with natural language processing, intelligent call routing and transfer to designated numbers, real-time lead capture and qualification, email and SMS notification of call activity, a web-based dashboard for call analytics and management, and integration capabilities with third-party CRM and business tools.',
      '---',
      `BOLD:3.2 Selected Plan: ${plan.name}`,
      `Monthly Subscription Fee: $${data.monthlyFee} USD per month`,
      'Setup Fee: None — $0 setup fee on all plans.',
      `Included Call Volume: ${plan.calls} calls per calendar month`,
      `Features included in the ${plan.name} plan:`,
      ...plan.features.map(f => `* ${f}`),
      '---',
      'BOLD:3.3 Overage Charges',
      `If Client exceeds ${plan.calls} calls in any calendar month, additional calls will be billed at $${plan.overage.toFixed(2)} per additional call for the ${plan.name} plan. Overage charges are invoiced at the end of the billing cycle in which they occurred.`,
      '---',
      'BOLD:3.4 Service Modifications',
      'Qwillio reserves the right to modify, enhance, or discontinue features of the Service with 30 days prior written notice to Client. Material changes that adversely affect Client\'s use of the Service will entitle Client to terminate without penalty within 30 days of such notice.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 4 — FREE TRIAL
    // ═══════════════════════════════════════════
    writeSection('4', 'FREE TRIAL TERMS (FTC, EU CONSUMER RIGHTS & RESTORE ONLINE SHOPPERS\' CONFIDENCE ACT COMPLIANT)', [
      'BOLD:4.1 Trial Duration',
      `Client is granted a free trial period of exactly thirty (30) calendar days commencing on the Effective Date and expiring on ${data.trialEndDate} at 11:59 PM (UTC) (the "Trial Expiration Date").`,
      '---',
      'BOLD:4.2 Trial Scope',
      `During the Trial Period, Client shall have full access to all features of the ${plan.name} Plan at no charge, subject to the call volume limitations of the selected Plan.`,
      '---',
      'BOLD:4.3 Payment Method Requirement',
      'A valid payment method (credit card, debit card, or other accepted payment instrument) must be provided prior to activation of the Trial Period. The payment method will NOT be charged during the Trial Period unless Client exceeds usage limits.',
      '---',
      'BOLD:IMPORTANT NOTICE REGARDING AUTOMATIC RENEWAL:',
      `BOLD:YOUR SUBSCRIPTION WILL AUTOMATICALLY CONVERT TO A PAID SUBSCRIPTION AND YOUR PAYMENT METHOD WILL BE CHARGED $${data.monthlyFee} USD PER MONTH ON ${data.trialEndDate} UNLESS YOU CANCEL AT LEAST 24 HOURS BEFORE THAT DATE. THERE IS NO SETUP FEE.`,
      '---',
      'BOLD:4.4 Cancellation During Trial',
      `Client may cancel at any time during the Trial Period without charge by: (a) using the cancellation feature in the Client dashboard at app.qwillio.com; or (b) sending written notice to support@qwillio.com. Cancellation must be received at least 24 hours before ${data.trialEndDate}.`,
      '---',
      'BOLD:4.5 Post-Trial Conversion',
      `If Client does not cancel before the Trial Expiration Date, the subscription will automatically convert to a paid monthly subscription at $${data.monthlyFee}/month. The first monthly fee will be charged to the payment method on file. There is no setup fee. Client will receive an email confirmation of the charge.`,
      '---',
      'BOLD:4.6 One Trial Per Person / Entity',
      'Only one (1) free trial is permitted per natural person, per business entity, and per payment method. Qwillio employs the following verification methods to enforce this limitation:',
      '* Phone number verification (OTP)',
      '* Email address verification (OTP)',
      '* Device and browser fingerprinting',
      '* IP address and geolocation analysis',
      '* Payment method deduplication via Stripe Radar',
      '* Cross-reference of business registration data',
      'Any attempt to obtain multiple free trials by any means, including but not limited to creating multiple accounts, using different email addresses, using virtual phone numbers, employing VPN or proxy services, or providing false identity information, constitutes a material breach of this Agreement and may constitute fraud under applicable law. Qwillio reserves the right to immediately terminate such accounts, recover all costs and damages, and refer the matter to law enforcement authorities.',
      '---',
      'BOLD:4.7 No Trial Extensions',
      'The Trial Period cannot be extended, paused, or restarted under any circumstances.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 5 — BILLING & PAYMENT
    // ═══════════════════════════════════════════
    writeSection('5', 'BILLING, PAYMENT & TAXES', [
      'BOLD:5.1 Billing Cycle',
      'Subscription fees are billed monthly in advance on the same calendar date as the initial charge. If the billing date does not exist in a given month (e.g., the 31st), billing occurs on the last day of that month.',
      '---',
      'BOLD:5.2 Payment Processing',
      'All payments are processed through Stripe, Inc. Client\'s payment information is stored securely by Stripe in compliance with PCI-DSS Level 1 standards. Qwillio does not store credit card numbers or CVV codes on its servers.',
      '---',
      'BOLD:5.3 Failed Payments',
      'In the event of a failed payment: (a) Qwillio will retry the charge up to 3 times over 7 days; (b) Client will be notified by email of each failed attempt; (c) if payment is not received within 14 days, the Service will be suspended; (d) if payment is not received within 30 days, the account will be terminated and all data will be scheduled for deletion.',
      '---',
      'BOLD:5.4 Price Changes',
      'Qwillio will provide at least thirty (30) days written notice before any price increase takes effect. Continued use of the Service after the effective date of a price increase constitutes acceptance. Client may cancel without penalty within 30 days of receiving notice of a price increase.',
      '---',
      'BOLD:5.5 Refund Policy',
      'Monthly subscription fees are non-refundable for partial billing periods. In the event of Service unavailability exceeding the SLA thresholds defined in Section 8, service credits (not cash refunds) will be issued.',
      '---',
      'BOLD:5.6 Taxes',
      'All fees are exclusive of applicable taxes, levies, and duties. Client is responsible for all sales tax, VAT, GST, withholding tax, and other taxes applicable to the transaction, except for taxes based on Qwillio\'s net income. Where Qwillio is required to collect taxes, such taxes will be added to invoices.',
      '---',
      'BOLD:5.7 No Setup Fee',
      'All Qwillio plans have zero setup fees. There are no hidden charges or activation costs.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 6 — TERM & TERMINATION
    // ═══════════════════════════════════════════
    writeSection('6', 'TERM, RENEWAL & TERMINATION', [
      'BOLD:6.1 Term',
      'This Agreement commences on the Effective Date and continues on a month-to-month basis until terminated by either party in accordance with this Section.',
      '---',
      'BOLD:6.2 Auto-Renewal',
      'The Subscription automatically renews at the end of each monthly billing cycle unless terminated by Client. Qwillio will send a renewal reminder 7 days before each billing date.',
      '---',
      'BOLD:6.3 Termination by Client',
      'Client may terminate at any time by: (a) clicking "Cancel Subscription" in the Client dashboard; or (b) sending written notice to support@qwillio.com. Termination takes effect at the end of the current billing period. No prorated refunds are issued for unused portions of the current billing cycle.',
      '---',
      'BOLD:6.4 Termination by Qwillio',
      'Qwillio may terminate this Agreement: (a) immediately, upon Client\'s material breach of this Agreement (including non-payment, violation of the Acceptable Use Policy, or fraud); (b) with 30 days written notice, for any reason or no reason; (c) immediately, if required by law or regulation.',
      '---',
      'BOLD:6.5 Effect of Termination',
      'Upon termination: (a) Client\'s access to the Service will be revoked; (b) Client\'s data (call recordings, transcripts, analytics) will be retained for 30 days, during which Client may request an export; (c) after 30 days, all Client data will be permanently deleted, except as required by law or for fraud prevention purposes; (d) any outstanding payment obligations survive termination.',
      '---',
      'BOLD:6.6 Suspension',
      'Qwillio may suspend Client\'s access to the Service without termination if: (a) Client\'s account has an outstanding balance; (b) Qwillio reasonably suspects fraudulent or abusive use; (c) suspension is required to comply with applicable law; (d) continued provision poses a security risk to the platform.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 7 — ACCEPTABLE USE
    // ═══════════════════════════════════════════
    writeSection('7', 'ACCEPTABLE USE POLICY', [
      'BOLD:7.1 Permitted Use',
      'The Service is provided exclusively for legitimate business use. Client shall use the Service only for the purpose of managing incoming business phone calls in accordance with applicable law.',
      '---',
      'BOLD:7.2 Prohibited Conduct',
      'The following activities are strictly prohibited and constitute a material breach of this Agreement:',
      '* Attempting to obtain multiple free trials through any means whatsoever',
      '* Creating multiple accounts for the same person, business entity, or beneficial owner',
      '* Providing false, misleading, or fraudulent identity, business, or payment information',
      '* Using VPN, proxy, Tor, virtual machines, or other tools to circumvent geographic, identity, or fraud prevention controls',
      '* Reselling, sublicensing, white-labeling, or redistributing the Service without prior written consent from Qwillio',
      '* Using the Service for any illegal purpose, including but not limited to robocalling, telemarketing fraud, phishing, or social engineering',
      '* Interfering with or disrupting the integrity, security, or performance of the Service',
      '* Reverse engineering, decompiling, or disassembling any part of the Service',
      '* Scraping, data mining, or automated extraction of data from the Service',
      '* Transmitting viruses, malware, or other harmful code through the Service',
      '* Using the Service to harass, threaten, defame, or discriminate against any person',
      '* Circumventing or attempting to circumvent any usage limitations, security measures, or access controls',
      '---',
      'BOLD:7.3 Consequences of Violation',
      'Violation of the Acceptable Use Policy may result in: (a) immediate suspension or termination of the account without refund; (b) recovery by Qwillio of all costs, damages, and legal fees incurred as a result of the violation; (c) referral to appropriate law enforcement authorities; (d) reporting to relevant fraud prevention databases and industry organizations.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 8 — SLA
    // ═══════════════════════════════════════════
    writeSection('8', 'SERVICE LEVEL AGREEMENT (SLA)', [
      'BOLD:8.1 Uptime Commitment',
      'Qwillio commits to 99.5% monthly uptime for the core AI voice receptionist service, measured as the percentage of minutes in a calendar month during which the Service is available and operational ("Uptime Percentage").',
      '---',
      'BOLD:8.2 Exclusions',
      'The following are excluded from uptime calculations: (a) scheduled maintenance windows (communicated with at least 48 hours advance notice); (b) Force Majeure events; (c) failures caused by Client\'s equipment, network, or systems; (d) outages of third-party service providers (including but not limited to Vapi, Twilio, Stripe, AWS, and telecommunications carriers) beyond Qwillio\'s reasonable control.',
      '---',
      'BOLD:8.3 Service Credits',
      'If the Uptime Percentage falls below 99.5% in any calendar month (excluding excluded events):',
      '* 99.0% - 99.4%: Credit equal to 10% of that month\'s subscription fee',
      '* 95.0% - 98.9%: Credit equal to 25% of that month\'s subscription fee',
      '* Below 95.0%: Credit equal to 50% of that month\'s subscription fee',
      'Service credits are applied to the next billing cycle. Credits are non-transferable and have no cash value. Total credits in any month shall not exceed 50% of that month\'s subscription fee.',
      '---',
      'BOLD:8.4 Incident Response',
      'Qwillio will use commercially reasonable efforts to respond to service incidents within the following timeframes:',
      '* Critical (Service completely unavailable): Response within 1 hour, resolution target 4 hours',
      '* Major (Significant degradation): Response within 4 hours, resolution target 12 hours',
      '* Minor (Partial impact): Response within 24 hours, resolution target 72 hours',
      '---',
      'BOLD:8.5 Support',
      'Support is provided via email (support@qwillio.com) during business hours (9 AM - 6 PM EST, Monday through Friday). Enterprise plan clients receive priority support with extended hours and a dedicated account manager.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 9 — AI DISCLOSURE
    // ═══════════════════════════════════════════
    writeSection('9', 'ARTIFICIAL INTELLIGENCE DISCLOSURE & COMPLIANCE', [
      'BOLD:9.1 AI Technology Disclosure',
      'Client acknowledges and agrees that the Service utilizes artificial intelligence (AI) and natural language processing (NLP) technology, including large language models (LLMs), text-to-speech (TTS) synthesis, and speech-to-text (STT) recognition, to conduct automated voice conversations on behalf of Client\'s business.',
      '---',
      'BOLD:9.2 AI Limitations',
      'Client understands that: (a) AI-generated responses may occasionally be inaccurate, incomplete, or contextually inappropriate; (b) the AI cannot guarantee perfect comprehension of all accents, dialects, or languages; (c) the AI operates based on training data and may not be aware of real-time events or recent changes to Client\'s business; (d) Qwillio continuously improves AI performance but cannot guarantee any specific level of accuracy.',
      '---',
      'BOLD:9.3 Client Compliance Obligations',
      'Client is solely responsible for ensuring compliance with all applicable laws governing AI use in their jurisdiction, including but not limited to:',
      '* EU AI Act (Regulation 2024/1689): Disclosure requirements for AI systems interacting with natural persons',
      '* US FTC Act Section 5: Prohibition on deceptive or unfair practices related to AI',
      '* State-specific AI disclosure laws (e.g., California Bot Disclosure Law, SB 1001)',
      '* Call recording consent laws (one-party and two-party consent jurisdictions)',
      '* Telemarketing regulations (TCPA in the US, ePrivacy Directive in the EU)',
      '* Anti-discrimination laws applicable to automated decision-making',
      '---',
      'BOLD:9.4 Caller Notification',
      'Qwillio\'s AI receptionist includes a disclosure at the beginning of each call informing callers that they are speaking with an AI assistant. Client shall not disable, modify, or circumvent this disclosure.',
      '---',
      'BOLD:9.5 Human Oversight',
      'Client maintains the ability to review all call transcripts, override AI decisions, and escalate calls to human operators at any time through the dashboard. Qwillio recommends regular review of AI-handled calls to ensure quality and compliance.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 10 — DATA PROTECTION
    // ═══════════════════════════════════════════
    writeSection('10', 'DATA PROTECTION, PRIVACY & SECURITY', [
      'BOLD:10.1 Roles and Responsibilities',
      'For the purposes of data protection law: (a) Client is the Data Controller with respect to caller Personal Data; (b) Qwillio is the Data Processor, processing caller Personal Data solely on Client\'s behalf and in accordance with Client\'s documented instructions.',
      '---',
      'BOLD:10.2 GDPR Compliance (EU General Data Protection Regulation 2016/679)',
      'Where GDPR applies, Qwillio shall:',
      '* Process Personal Data only on Client\'s documented instructions',
      '* Ensure that persons authorized to process Personal Data have committed to confidentiality',
      '* Implement appropriate technical and organizational security measures (Article 32)',
      '* Not engage another processor without Client\'s prior written authorization',
      '* Assist Client with data subject access requests (Article 15-22)',
      '* Delete or return all Personal Data upon termination (Article 28(3)(g))',
      '* Make available all information necessary to demonstrate compliance',
      '* Submit to and contribute to audits and inspections conducted by Client or an auditor mandated by Client',
      'A separate Data Processing Agreement (DPA) is available upon request and is hereby incorporated by reference when applicable.',
      '---',
      'BOLD:10.3 CCPA Compliance (California Consumer Privacy Act)',
      'Where CCPA applies, Qwillio represents that:',
      '* Qwillio does not sell Personal Information (as defined by CCPA)',
      '* Qwillio does not share Personal Information for cross-context behavioral advertising',
      '* Qwillio processes Personal Information only as necessary to perform the Service',
      '* Qwillio will comply with all applicable CCPA obligations as a Service Provider',
      '* Qwillio will assist Client in responding to consumer rights requests',
      '---',
      'BOLD:10.4 Data Retention',
      'Call recordings and transcripts: Retained for 90 calendar days, then automatically and irreversibly deleted. Client may configure a shorter retention period via the dashboard. Client may request data export at any time during the retention period.',
      'Account data: Retained for 30 days after account termination, then permanently deleted.',
      'Billing records: Retained for 7 years as required by applicable tax and accounting laws.',
      'Fraud prevention hashes: Retained indefinitely (see Section 12).',
      '---',
      'BOLD:10.5 International Data Transfers',
      'Data is primarily processed in the United States (AWS us-east-1). For EU clients, data transfers to the US are governed by: (a) Standard Contractual Clauses (SCCs) as adopted by the European Commission; (b) such additional safeguards as may be required under applicable law. Client may request information about specific sub-processors and data transfer mechanisms.',
      '---',
      'BOLD:10.6 Security Measures',
      'Qwillio implements the following security measures:',
      '* Encryption in transit: TLS 1.3 for all data in transit',
      '* Encryption at rest: AES-256 for all stored data',
      '* Access control: Role-based access, multi-factor authentication for internal systems',
      '* Infrastructure: SOC 2-compliant hosting on AWS with regular penetration testing',
      '* Incident response: Documented incident response plan with 72-hour breach notification',
      '* Employee security: Background checks, security training, NDA requirements for all staff',
      '---',
      'BOLD:10.7 Data Breach Notification',
      'In the event of a Personal Data breach, Qwillio will: (a) notify Client without undue delay, and in any event within 72 hours of becoming aware of the breach; (b) provide Client with sufficient information to enable Client to meet its breach notification obligations under applicable law; (c) cooperate with Client in investigating and remediating the breach.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 11 — INTELLECTUAL PROPERTY
    // ═══════════════════════════════════════════
    writeSection('11', 'INTELLECTUAL PROPERTY', [
      'BOLD:11.1 Qwillio IP',
      'All right, title, and interest in and to the Service, including all software, algorithms, AI models, interfaces, documentation, trademarks, and trade secrets, are and shall remain the exclusive property of Qwillio. Nothing in this Agreement grants Client any rights in or to the Service except the limited right of use as specified herein.',
      '---',
      'BOLD:11.2 Client Data',
      'Client retains all right, title, and interest in Client Data (call recordings, business information, caller data). Client grants Qwillio a limited, non-exclusive license to process Client Data solely for the purpose of providing the Service.',
      '---',
      'BOLD:11.3 Aggregated Data',
      'Qwillio may use anonymized, aggregated data derived from Client\'s use of the Service for the purposes of improving the Service, developing new features, benchmarking, and generating industry reports. Such aggregated data will not identify Client or any individual caller.',
      '---',
      'BOLD:11.4 Feedback',
      'If Client provides suggestions, enhancement requests, recommendations, or other feedback regarding the Service ("Feedback"), Qwillio shall own all rights in such Feedback and may use it without restriction or compensation.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 12 — FRAUD PREVENTION
    // ═══════════════════════════════════════════
    writeSection('12', 'IDENTITY VERIFICATION & FRAUD PREVENTION', [
      'BOLD:12.1 Consent to Verification',
      'By accepting this Agreement, Client explicitly and freely consents to the following fraud prevention and identity verification measures:',
      '* Phone number verification via one-time password (OTP) sent by SMS',
      '* Email address verification via one-time password (OTP)',
      '* Browser and device fingerprinting using canvas, WebGL, and navigator metadata',
      '* IP address analysis for geographic verification and proxy/VPN detection',
      '* Payment method fingerprinting and deduplication via Stripe Radar',
      '* Business verification through public registry cross-referencing',
      '---',
      'BOLD:12.2 Data Minimization',
      'All verification data is immediately hashed using irreversible cryptographic hash functions (SHA-256 with salt). Qwillio does not store raw fingerprints, IP addresses, or device identifiers. Only the resulting hash values are retained.',
      '---',
      'BOLD:12.3 Retention of Fraud Prevention Hashes',
      'Hashed identifiers are retained indefinitely after account deletion solely for the purpose of preventing trial abuse and fraud. This retention is: (a) disclosed transparently in this Agreement; (b) limited to irreversible hashes that cannot be used to identify individuals; (c) conducted under the legitimate interest legal basis (GDPR Article 6(1)(f)); (d) subject to a documented legitimate interest assessment.',
      '---',
      'BOLD:12.4 Right to Object',
      'Under GDPR Article 21, Client has the right to object to processing based on legitimate interest. Objections may be submitted to privacy@qwillio.com. Qwillio will assess each objection on its merits. Note that upholding an objection to fraud prevention processing may result in inability to maintain the account.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 13 — CONFIDENTIALITY
    // ═══════════════════════════════════════════
    writeSection('13', 'CONFIDENTIALITY', [
      'BOLD:13.1 Obligations',
      'Each party agrees to: (a) hold the other party\'s Confidential Information in strict confidence; (b) not disclose Confidential Information to third parties except as necessary to perform obligations under this Agreement; (c) use at least the same degree of care to protect Confidential Information as it uses for its own confidential information, but in no event less than reasonable care.',
      '---',
      'BOLD:13.2 Exceptions',
      'Confidential Information does not include information that: (a) is or becomes publicly available through no fault of the receiving party; (b) was known to the receiving party prior to disclosure; (c) is independently developed by the receiving party; (d) is rightfully received from a third party without restriction.',
      '---',
      'BOLD:13.3 Required Disclosure',
      'Either party may disclose Confidential Information if required by law, regulation, or court order, provided that the disclosing party gives reasonable prior notice to the other party (unless prohibited by law) and cooperates to limit the scope of disclosure.',
      '---',
      'BOLD:13.4 Duration',
      'Confidentiality obligations survive termination of this Agreement for a period of three (3) years, except for trade secrets which are protected for as long as they remain trade secrets under applicable law.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 14 — LIABILITY
    // ═══════════════════════════════════════════
    writeSection('14', 'WARRANTIES, LIMITATION OF LIABILITY & INDEMNIFICATION', [
      'BOLD:14.1 Provider Warranty',
      'Qwillio warrants that: (a) the Service will perform materially in accordance with the applicable documentation; (b) the Service will be provided with reasonable skill and care; (c) the Service will materially comply with all applicable laws. THE SERVICE IS OTHERWISE PROVIDED "AS IS" AND "AS AVAILABLE". QWILLIO MAKES NO OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.',
      '---',
      'BOLD:14.2 Limitation of Liability',
      `QWILLIO'S TOTAL AGGREGATE LIABILITY UNDER THIS AGREEMENT, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), BREACH OF STATUTORY DUTY, OR OTHERWISE, SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL AMOUNT OF SUBSCRIPTION FEES PAID BY CLIENT IN THE SIX (6) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM; OR (B) $${data.monthlyFee * 6} USD.`,
      '---',
      'BOLD:14.3 Exclusion of Consequential Damages',
      'IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF DATA, LOSS OF BUSINESS OPPORTUNITIES, LOSS OF GOODWILL, COST OF PROCUREMENT OF SUBSTITUTE SERVICES, OR ANY SIMILAR DAMAGES, HOWEVER CAUSED AND WHETHER BASED ON CONTRACT, TORT, STRICT LIABILITY, OR ANY OTHER THEORY.',
      '---',
      'BOLD:14.4 Exceptions to Limitations',
      'The limitations in Sections 14.2 and 14.3 shall not apply to: (a) Client\'s payment obligations; (b) either party\'s breach of confidentiality obligations; (c) either party\'s indemnification obligations; (d) claims arising from willful misconduct or gross negligence; (e) Client\'s violation of the Acceptable Use Policy.',
      '---',
      'BOLD:14.5 Client Indemnification',
      'Client agrees to defend, indemnify, and hold harmless Qwillio, its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, losses, costs, and expenses (including reasonable attorneys\' fees) arising from: (a) Client\'s use of the Service; (b) Client\'s violation of this Agreement; (c) Client\'s violation of applicable law; (d) any third-party claim related to Client\'s business or use of the Service.',
      '---',
      'BOLD:14.6 Provider Indemnification',
      'Qwillio agrees to defend, indemnify, and hold harmless Client from and against any third-party claim that the Service infringes any valid patent, copyright, or trademark, provided that Client promptly notifies Qwillio of the claim and cooperates in the defense.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 15 — GOVERNING LAW
    // ═══════════════════════════════════════════
    writeSection('15', 'GOVERNING LAW, DISPUTE RESOLUTION & JURISDICTION', [
      'BOLD:15.1 Governing Law',
      'This Agreement shall be governed by and construed in accordance with:',
      '* For US Clients: The laws of the State of Delaware, United States, without regard to its conflict of law provisions.',
      '* For EU Clients: The laws of Belgium, without prejudice to mandatory consumer protection provisions of the Member State of the Client\'s habitual residence.',
      '* For all other Clients: The laws of the State of Delaware, United States.',
      '---',
      'BOLD:15.2 Dispute Resolution',
      'For US Clients: Any dispute arising out of or relating to this Agreement shall first be submitted to good-faith negotiation for a period of thirty (30) days. If negotiation fails, the dispute shall be resolved by binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. The arbitration shall take place in Wilmington, Delaware. Judgment on the arbitration award may be entered in any court of competent jurisdiction.',
      'For EU Clients: Disputes shall be submitted to the competent courts of Brussels, Belgium. EU consumers retain the right to bring proceedings in the courts of their Member State of habitual residence in accordance with the EU Consumer Rights Directive (2011/83/EU) and the Brussels I Regulation (Recast) (EU Regulation 1215/2012).',
      '---',
      'BOLD:15.3 Class Action Waiver (US Clients)',
      'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CLIENT AGREES THAT ANY DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION.',
      '---',
      'BOLD:15.4 EU Consumer Rights',
      'Nothing in this Agreement shall limit the statutory rights of EU consumers under: (a) the EU Consumer Rights Directive; (b) the Unfair Commercial Practices Directive (2005/29/EC); (c) the Unfair Contract Terms Directive (93/13/EEC); (d) applicable national consumer protection legislation. EU consumers have a 14-day statutory right of withdrawal from the date of entering into the agreement.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 16 — FORCE MAJEURE
    // ═══════════════════════════════════════════
    writeSection('16', 'FORCE MAJEURE', [
      'Neither party shall be liable for any failure or delay in performance of its obligations under this Agreement to the extent such failure or delay is caused by a Force Majeure event. The affected party shall: (a) give prompt notice to the other party of the Force Majeure event; (b) use reasonable efforts to mitigate the effects; (c) resume performance as soon as reasonably practicable. If a Force Majeure event continues for more than ninety (90) days, either party may terminate this Agreement without liability.',
    ]);

    // ═══════════════════════════════════════════
    // SECTION 17 — MISCELLANEOUS
    // ═══════════════════════════════════════════
    writeSection('17', 'GENERAL PROVISIONS', [
      'BOLD:17.1 Entire Agreement',
      'This Agreement, together with any order forms, addenda, or data processing agreements incorporated by reference, constitutes the entire agreement between the parties regarding the subject matter hereof and supersedes all prior or contemporaneous agreements, proposals, negotiations, representations, and communications, whether written or oral.',
      '---',
      'BOLD:17.2 Amendments',
      'Qwillio may amend this Agreement by providing 30 days written notice to Client. Material changes will be highlighted and communicated via email. Continued use of the Service after the effective date of an amendment constitutes acceptance. Client may terminate without penalty within 30 days of notice of a material amendment.',
      '---',
      'BOLD:17.3 Severability',
      'If any provision of this Agreement is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable while preserving the parties\' original intent.',
      '---',
      'BOLD:17.4 Waiver',
      'No waiver of any right or remedy under this Agreement shall be effective unless made in writing and signed by the waiving party. No failure or delay in exercising any right shall operate as a waiver thereof.',
      '---',
      'BOLD:17.5 Assignment',
      'Client may not assign or transfer this Agreement without Qwillio\'s prior written consent. Qwillio may assign this Agreement to an Affiliate or in connection with a merger, acquisition, or sale of all or substantially all of its assets, provided the assignee assumes all obligations under this Agreement.',
      '---',
      'BOLD:17.6 Notices',
      `All notices under this Agreement shall be in writing and delivered by email. Notices to Qwillio: legal@qwillio.com. Notices to Client: ${data.clientEmail}. Notices are deemed received 24 hours after sending.`,
      '---',
      'BOLD:17.7 Survival',
      'The following provisions survive termination of this Agreement: Sections 1 (Definitions), 10 (Data Protection), 11 (Intellectual Property), 12 (Fraud Prevention), 13 (Confidentiality), 14 (Liability & Indemnification), 15 (Governing Law), and 17 (General Provisions).',
      '---',
      'BOLD:17.8 Independent Contractors',
      'The parties are independent contractors. Nothing in this Agreement creates a partnership, joint venture, employment, or agency relationship between the parties.',
      '---',
      'BOLD:17.9 Third-Party Beneficiaries',
      'This Agreement does not create any third-party beneficiary rights, except as expressly provided herein.',
    ]);

    // ═══════════════════════════════════════════
    // SIGNATURE / ACCEPTANCE BLOCK
    // ═══════════════════════════════════════════
    y -= 15;
    if (y < 200) page = addPage();

    page.drawRectangle({ x: margin - 5, y: y - 165, width: contentWidth + 10, height: 180, color: rgb(0.97, 0.97, 0.99), borderColor: rgb(0.3, 0.35, 0.65), borderWidth: 1 });

    writeLine('ELECTRONIC ACCEPTANCE & SIGNATURES', { bold: true, size: 12, color: [0.15, 0.15, 0.35] });
    y -= 5;
    writeBlock('By electronically accepting this Agreement (via checkbox, electronic signature, or use of the Service), the undersigned represents and warrants that they have read, understood, and agree to be bound by all terms and conditions set forth herein.');
    y -= 8;

    writeLine('PROVIDER:', { bold: true, size: 9 });
    writeLine('Qwillio LLC', { size: 9 });
    writeLine('Authorized Signatory', { italic: true, size: 8, color: [0.4, 0.4, 0.4] });

    // DocuSign anchor tags (invisible but functional)
    y -= 12;
    writeLine('CLIENT:', { bold: true, size: 9 });
    writeLine(`Name: ${data.clientName}`, { size: 9 });
    writeLine(`Business: ${data.clientBusinessName}`, { size: 9 });
    writeLine(`Email: ${data.clientEmail}`, { size: 9 });
    y -= 8;

    // Signature anchors for DocuSign
    writeLine('Signature: [[SIGNATURE]]', { size: 9 });
    writeLine('Date: [[DATE]]', { size: 9 });
    y -= 8;

    writeLine(`IP Address at acceptance: ${data.ipAddress}`, { size: 7, color: [0.5, 0.5, 0.5] });
    writeLine(`User Agent: ${data.userAgent.substring(0, 80)}`, { size: 6, color: [0.6, 0.6, 0.6] });
    writeLine(`Timestamp: ${new Date().toISOString()}`, { size: 6, color: [0.6, 0.6, 0.6] });

    // ═══════════════════════════════════════════
    // SET PDF METADATA
    // ═══════════════════════════════════════════
    pdfDoc.setTitle(`Qwillio Service Agreement - ${data.clientBusinessName}`);
    pdfDoc.setAuthor('Qwillio LLC');
    pdfDoc.setSubject('Master Service Agreement & Subscription Terms');
    pdfDoc.setCreator('Qwillio Contract Generator v2.0');
    pdfDoc.setProducer('pdf-lib');
    pdfDoc.setCreationDate(new Date());

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
  <h1 style="text-align: center; font-size: 20px;">QWILLIO MASTER SERVICE AGREEMENT</h1>
  <p style="text-align: center; color: #888; font-size: 12px;">Contract Version ${CONTRACT_VERSION} | ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

  <h2>1. Definitions</h2>
  <p>This Agreement defines the terms between Qwillio LLC ("Provider") and ${data.clientName}, ${data.clientBusinessName} ("Client") for use of the AI voice receptionist platform.</p>

  <h2>2. Parties</h2>
  <p><strong>Provider:</strong> Qwillio LLC, Delaware, USA</p>
  <p><strong>Client:</strong> ${data.clientName}, ${data.clientBusinessName}</p>

  <h2>3. Service Description</h2>
  <p><strong>${plan.name} Plan:</strong> $${data.monthlyFee}/month. No setup fee. ${plan.calls} calls/month. Overage: $${plan.overage.toFixed(2)}/call.</p>
  <p>Features: ${plan.features.join(', ')}.</p>

  <h2>4. Free Trial Terms</h2>
  <p>Your free trial is <strong>30 days</strong> from activation, ending on <strong>${data.trialEndDate}</strong>.</p>
  <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 12px; border-radius: 8px; margin: 16px 0;">
    <p style="font-weight: bold; font-size: 15px; margin: 0;">
      YOUR SUBSCRIPTION WILL AUTOMATICALLY RENEW AND YOUR PAYMENT METHOD WILL BE CHARGED $${data.monthlyFee}/MONTH ON ${data.trialEndDate} UNLESS YOU CANCEL AT LEAST 24 HOURS BEFORE THAT DATE.
    </p>
  </div>
  <p><strong>One trial per person.</strong> Circumvention = immediate termination + potential legal action.</p>

  <h2>5. Billing & Payment</h2>
  <p>Monthly billing via Stripe. No setup fee. Failed payments retried 3x over 7 days. 14-day suspension, 30-day termination. All fees exclude taxes.</p>

  <h2>6. Term & Termination</h2>
  <p>Month-to-month. Cancel anytime via dashboard or email. 30-day data retention after termination.</p>

  <h2>7. Acceptable Use</h2>
  <p>Prohibited: multiple trials, false identity, VPN circumvention, reselling, illegal use, reverse engineering. Violation = termination + cost recovery.</p>

  <h2>8. Service Level (SLA)</h2>
  <p>99.5% uptime target. Credits: 10% (99-99.4%), 25% (95-98.9%), 50% (below 95%). Critical incident response: 1 hour.</p>

  <h2>9. AI Disclosure</h2>
  <p>Service uses AI voice technology. EU AI Act, FTC, and state-level compliance is Client's responsibility. Calls include AI disclosure.</p>

  <h2>10. Data Protection (GDPR & CCPA)</h2>
  <p>Client = Data Controller. Qwillio = Data Processor. TLS 1.3 + AES-256 encryption. 90-day recording retention. 72-hour breach notification. DPA available upon request.</p>

  <h2>11. Intellectual Property</h2>
  <p>Qwillio owns all Service IP. Client owns all Client Data. Qwillio may use anonymized aggregated data.</p>

  <h2>12. Fraud Prevention</h2>
  <p>You consent to: phone OTP, email OTP, device fingerprinting, IP analysis, payment fingerprinting. Hashed identifiers retained after deletion.</p>

  <h2>13. Confidentiality</h2>
  <p>3-year confidentiality obligations. Trade secrets protected indefinitely.</p>

  <h2>14. Liability</h2>
  <p>Liability capped at 6 months of fees. No indirect/consequential damages. Mutual indemnification for IP claims.</p>

  <h2>15. Governing Law</h2>
  <p>US: Delaware law, AAA arbitration. EU: Belgium law, Brussels courts + consumer rights preserved. Class action waiver for US clients.</p>

  <h2>16. Force Majeure</h2>
  <p>Neither party liable for Force Majeure events. Termination right after 90 days of continuous Force Majeure.</p>

  <h2>17. General Provisions</h2>
  <p>Entire agreement. 30-day amendment notice. Severability. No assignment without consent. Independent contractors.</p>
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
