import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { PACKAGES } from '../types';
import { emailService } from './email.service';
import { discordService } from './discord.service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import docusign from 'docusign-esign';

interface ContractData {
  businessName: string;
  contactName: string;
  contactEmail: string;
  packageType: string;
  setupFee: number;
  monthlyFee: number;
  features: string[];
  callsQuota: number;
  validUntil: Date;
}

export class DocuSignService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  /**
   * Check if DocuSign is configured
   */
  private isConfigured(): boolean {
    return !!(
      env.DOCUSIGN_INTEGRATION_KEY &&
      env.DOCUSIGN_USER_ID &&
      env.DOCUSIGN_ACCOUNT_ID &&
      env.DOCUSIGN_PRIVATE_KEY
    );
  }

  /**
   * Get or refresh access token via JWT Grant
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const apiClient = new docusign.ApiClient();
    apiClient.setOAuthBasePath(env.DOCUSIGN_AUTH_SERVER);

    // Decode base64 private key
    const privateKey = Buffer.from(env.DOCUSIGN_PRIVATE_KEY, 'base64');

    const results = await apiClient.requestJWTUserToken(
      env.DOCUSIGN_INTEGRATION_KEY,
      env.DOCUSIGN_USER_ID,
      ['signature', 'impersonation'],
      privateKey,
      3600, // 1 hour
    );

    this.accessToken = results.body.access_token;
    this.tokenExpiresAt = Date.now() + (results.body.expires_in - 300) * 1000; // refresh 5min early

    logger.debug('DocuSign access token obtained');
    return this.accessToken!;
  }

  /**
   * Get configured API client
   */
  private async getApiClient(): Promise<docusign.ApiClient> {
    const token = await this.getAccessToken();
    const apiClient = new docusign.ApiClient();
    apiClient.setBasePath(`https://${env.DOCUSIGN_AUTH_SERVER.replace('account', 'na4')}.docusign.net/restapi`);
    apiClient.addDefaultHeader('Authorization', `Bearer ${token}`);
    return apiClient;
  }

  /**
   * Generate contract PDF from quote data using pdf-lib
   */
  private async generateContractPDF(data: ContractData): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 10;
    const titleSize = 16;
    const sectionSize = 12;
    const margin = 50;
    const lineHeight = 16;
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);

    let page = doc.addPage([612, 792]); // US Letter
    let y = 742;

    const drawText = (text: string, x: number, yPos: number, options: { font?: any; size?: number; color?: any } = {}) => {
      page.drawText(text, {
        x,
        y: yPos,
        size: options.size || fontSize,
        font: options.font || font,
        color: options.color || black,
      });
    };

    const drawLine = (yPos: number) => {
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: 562, y: yPos },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
    };

    // --- HEADER ---
    drawText('QWILLIO', margin, y, { font: fontBold, size: 20, color: rgb(0.2, 0.4, 0.8) });
    y -= 20;
    drawText('AI Receptionist Service Agreement', margin, y, { font: fontBold, size: titleSize });
    y -= 10;
    drawLine(y);
    y -= 25;

    // --- CONTRACT INFO ---
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    drawText(`Date: ${today}`, margin, y, { size: fontSize, color: gray });
    y -= lineHeight;
    drawText(`Contract Valid Until: ${data.validUntil.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y, { size: fontSize, color: gray });
    y -= lineHeight * 2;

    // --- SECTION 1: PARTIES ---
    drawText('1. PARTIES', margin, y, { font: fontBold, size: sectionSize });
    y -= lineHeight * 1.5;
    drawText('This Service Agreement ("Agreement") is entered into between:', margin, y);
    y -= lineHeight * 1.5;
    drawText('Provider:', margin, y, { font: fontBold });
    drawText('Qwillio LLC', margin + 60, y);
    y -= lineHeight;
    drawText('Address:', margin, y, { font: fontBold });
    drawText('Wilmington, Delaware, United States', margin + 60, y);
    y -= lineHeight * 1.5;
    drawText('Client:', margin, y, { font: fontBold });
    drawText(data.businessName, margin + 60, y);
    y -= lineHeight;
    drawText('Contact:', margin, y, { font: fontBold });
    drawText(data.contactName, margin + 60, y);
    y -= lineHeight;
    drawText('Email:', margin, y, { font: fontBold });
    drawText(data.contactEmail, margin + 60, y);
    y -= lineHeight * 2;

    // --- SECTION 2: SERVICES ---
    drawText('2. SERVICES PROVIDED', margin, y, { font: fontBold, size: sectionSize });
    y -= lineHeight * 1.5;

    const pkg = PACKAGES[data.packageType] || PACKAGES.basic;
    drawText(`Qwillio agrees to provide the Client with an AI-powered virtual receptionist`, margin, y);
    y -= lineHeight;
    drawText(`service under the ${pkg.name} plan, which includes:`, margin, y);
    y -= lineHeight * 1.5;

    for (const feature of data.features) {
      drawText(`•  ${feature}`, margin + 15, y);
      y -= lineHeight;
    }
    y -= lineHeight;

    // --- SECTION 3: PRICING ---
    drawText('3. PRICING & PAYMENT TERMS', margin, y, { font: fontBold, size: sectionSize });
    y -= lineHeight * 1.5;
    drawText(`Plan: ${pkg.name}`, margin, y, { font: fontBold });
    y -= lineHeight;
    drawText(`One-time Setup Fee: $${data.setupFee.toLocaleString()}`, margin, y);
    y -= lineHeight;
    drawText(`Monthly Subscription: $${data.monthlyFee}/month`, margin, y);
    y -= lineHeight;
    drawText(`Monthly Call Quota: ${data.callsQuota} calls included`, margin, y);
    y -= lineHeight * 1.5;
    drawText('Payment is due upon signing this agreement. The monthly subscription', margin, y);
    y -= lineHeight;
    drawText('will be billed automatically via Stripe on the same day each month.', margin, y);
    y -= lineHeight * 2;

    // --- SECTION 4: TERM & TERMINATION ---
    drawText('4. TERM & TERMINATION', margin, y, { font: fontBold, size: sectionSize });
    y -= lineHeight * 1.5;
    drawText('This Agreement begins on the date of signature and continues on a', margin, y);
    y -= lineHeight;
    drawText('month-to-month basis. Either party may terminate this Agreement at any', margin, y);
    y -= lineHeight;
    drawText('time with written notice. Upon termination, the AI receptionist service', margin, y);
    y -= lineHeight;
    drawText('will be deactivated and no further charges will apply.', margin, y);
    y -= lineHeight * 2;

    // --- SECTION 5: USAGE & LIMITS ---
    drawText('5. USAGE & LIMITATIONS', margin, y, { font: fontBold, size: sectionSize });
    y -= lineHeight * 1.5;
    drawText('The AI receptionist operates 24/7 and handles calls within the agreed', margin, y);
    y -= lineHeight;
    drawText(`monthly quota of ${data.callsQuota} calls. Additional calls beyond the quota may be`, margin, y);
    y -= lineHeight;
    drawText('subject to overage charges as outlined in the selected plan. Qwillio', margin, y);
    y -= lineHeight;
    drawText('reserves the right to update the AI model and features to improve service.', margin, y);
    y -= lineHeight * 2;

    // --- SECTION 6: CONFIDENTIALITY ---
    drawText('6. CONFIDENTIALITY & DATA', margin, y, { font: fontBold, size: sectionSize });
    y -= lineHeight * 1.5;
    drawText('Qwillio will handle all client and caller data in accordance with', margin, y);
    y -= lineHeight;
    drawText('applicable privacy laws. Call recordings and transcripts are stored', margin, y);
    y -= lineHeight;
    drawText('securely and accessible only to the Client via their dashboard.', margin, y);
    y -= lineHeight * 2;

    // --- PAGE 2: SIGNATURES ---
    page = doc.addPage([612, 792]);
    y = 742;

    drawText('7. AGREEMENT & SIGNATURES', margin, y, { font: fontBold, size: sectionSize });
    y -= lineHeight * 1.5;
    drawText('By signing below, both parties agree to the terms outlined in this', margin, y);
    y -= lineHeight;
    drawText('Service Agreement.', margin, y);
    y -= lineHeight * 3;

    // Client signature block
    drawText('CLIENT', margin, y, { font: fontBold, size: sectionSize });
    y -= lineHeight * 2;

    drawText('Name:', margin, y, { font: fontBold });
    drawText(data.contactName, margin + 50, y);
    y -= lineHeight;
    drawText('Business:', margin, y, { font: fontBold });
    drawText(data.businessName, margin + 65, y);
    y -= lineHeight * 2;

    drawText('Signature:', margin, y, { font: fontBold });
    y -= 5;
    // Anchor for DocuSign signature tab
    drawText('[[SIGNATURE]]', margin + 70, y, { size: 1, color: rgb(1, 1, 1) }); // invisible anchor
    y -= lineHeight * 3;
    drawLine(y + lineHeight);

    y -= lineHeight;
    drawText('Date:', margin, y, { font: fontBold });
    drawText('[[DATE]]', margin + 50, y, { size: 1, color: rgb(1, 1, 1) }); // invisible anchor
    y -= lineHeight * 4;

    // Provider signature block
    drawText('QWILLIO LLC', margin, y, { font: fontBold, size: sectionSize });
    y -= lineHeight * 2;
    drawText('Authorized representative', margin, y, { color: gray });
    y -= lineHeight * 2;
    drawText('This contract is auto-generated and electronically signed via DocuSign.', margin, y, { size: 8, color: gray });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Send a contract for electronic signature via DocuSign
   */
  async sendContractForSignature(quoteId: string): Promise<{ envelopeId: string } | null> {
    if (!this.isConfigured()) {
      logger.warn('DocuSign not configured, skipping contract send');
      return null;
    }

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { prospect: true },
    });

    if (!quote || !quote.prospect) {
      logger.error(`Quote or prospect not found for contract: ${quoteId}`);
      return null;
    }

    const prospect = quote.prospect;
    const pkg = PACKAGES[quote.packageType] || PACKAGES.basic;

    const contractData: ContractData = {
      businessName: prospect.businessName,
      contactName: prospect.contactName || prospect.businessName,
      contactEmail: prospect.email || '',
      packageType: quote.packageType,
      setupFee: Number(quote.setupFee),
      monthlyFee: Number(quote.monthlyFee),
      features: pkg.features,
      callsQuota: pkg.callsQuota,
      validUntil: quote.validUntil,
    };

    if (!contractData.contactEmail) {
      logger.warn(`No email for prospect ${prospect.id}, cannot send contract`);
      return null;
    }

    try {
      // Generate the contract PDF
      const pdfBuffer = await this.generateContractPDF(contractData);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Build DocuSign envelope
      const apiClient = await this.getApiClient();
      const envelopesApi = new docusign.EnvelopesApi(apiClient);

      const envelopeDefinition = new docusign.EnvelopeDefinition();
      envelopeDefinition.emailSubject = `Service Agreement — Qwillio ${pkg.name} Plan for ${contractData.businessName}`;
      envelopeDefinition.emailBlurb = `Hi ${contractData.contactName}, please review and sign the attached service agreement for your Qwillio AI Receptionist (${pkg.name} plan).`;

      // Document
      const document = new docusign.Document();
      document.documentBase64 = pdfBase64;
      document.name = `Qwillio_Service_Agreement_${contractData.businessName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.fileExtension = 'pdf';
      document.documentId = '1';
      envelopeDefinition.documents = [document];

      // Signer
      const signer = new docusign.Signer();
      signer.email = contractData.contactEmail;
      signer.name = contractData.contactName;
      signer.recipientId = '1';
      signer.routingOrder = '1';
      signer.clientUserId = undefined; // remote signing (email-based)

      // Signature tabs using anchor strings
      const signHere = new docusign.SignHere();
      signHere.anchorString = '[[SIGNATURE]]';
      signHere.anchorUnits = 'pixels';
      signHere.anchorXOffset = '0';
      signHere.anchorYOffset = '-10';

      const dateSigned = new docusign.DateSigned();
      dateSigned.anchorString = '[[DATE]]';
      dateSigned.anchorUnits = 'pixels';
      dateSigned.anchorXOffset = '0';
      dateSigned.anchorYOffset = '-5';

      const tabs = new docusign.Tabs();
      tabs.signHereTabs = [signHere];
      tabs.dateSignedTabs = [dateSigned];
      signer.tabs = tabs;

      const recipients = new docusign.Recipients();
      recipients.signers = [signer];
      envelopeDefinition.recipients = recipients;

      envelopeDefinition.status = 'sent'; // Send immediately

      // Custom fields to track the quote ID
      const textCustomField = new docusign.TextCustomField();
      textCustomField.name = 'quoteId';
      textCustomField.value = quoteId;
      textCustomField.show = 'false';
      const customFields = new docusign.CustomFields();
      customFields.textCustomFields = [textCustomField];
      envelopeDefinition.customFields = customFields;

      // Create and send envelope
      const result = await envelopesApi.createEnvelope(env.DOCUSIGN_ACCOUNT_ID, {
        envelopeDefinition,
      });

      const envelopeId = result.envelopeId!;

      // Update quote with envelope ID
      await prisma.quote.update({
        where: { id: quoteId },
        data: { docusignEnvelopeId: envelopeId },
      });

      logger.info(`DocuSign envelope sent for quote ${quoteId}: ${envelopeId}`);

      await discordService.notify(
        `📝 CONTRACT SENT\n\nBusiness: ${contractData.businessName}\nContact: ${contractData.contactName}\nEmail: ${contractData.contactEmail}\nPlan: ${pkg.name}\nEnvelope: ${envelopeId}`
      );

      return { envelopeId };
    } catch (error: any) {
      logger.error(`DocuSign contract send failed for quote ${quoteId}:`, error.message);
      await discordService.notify(
        `⚠️ DOCUSIGN FAILED\n\nQuote: ${quoteId}\nBusiness: ${contractData.businessName}\nError: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Handle envelope completed webhook — contract signed
   */
  async handleEnvelopeCompleted(envelopeId: string): Promise<void> {
    const quote = await prisma.quote.findFirst({
      where: { docusignEnvelopeId: envelopeId },
      include: { prospect: true },
    });

    if (!quote) {
      logger.warn(`No quote found for DocuSign envelope: ${envelopeId}`);
      return;
    }

    try {
      // Download signed document from DocuSign
      let contractPdfUrl: string | null = null;
      try {
        const apiClient = await this.getApiClient();
        const envelopesApi = new docusign.EnvelopesApi(apiClient);

        const docBytes = await envelopesApi.getDocument(
          env.DOCUSIGN_ACCOUNT_ID,
          envelopeId,
          '1', // document ID
        );

        // Store as base64 data URL (in production, upload to S3/GCS)
        const base64 = Buffer.from(docBytes).toString('base64');
        contractPdfUrl = `data:application/pdf;base64,${base64.substring(0, 100)}...`; // truncated reference
        // For now, store DocuSign download URL
        contractPdfUrl = `https://${env.DOCUSIGN_AUTH_SERVER.replace('account', 'na4')}.docusign.net/restapi/v2.1/accounts/${env.DOCUSIGN_ACCOUNT_ID}/envelopes/${envelopeId}/documents/1`;
      } catch (downloadErr: any) {
        logger.warn(`Could not download signed PDF for envelope ${envelopeId}:`, downloadErr.message);
      }

      // Update quote
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          contractSignedAt: new Date(),
          contractPdfUrl,
        },
      });

      // Update prospect next action
      if (quote.prospectId) {
        await prisma.prospect.update({
          where: { id: quote.prospectId },
          data: { nextAction: 'await_payment' },
        });
      }

      // Send payment link email
      if (quote.prospect?.email && quote.stripePaymentLink) {
        const pkg = PACKAGES[quote.packageType] || PACKAGES.basic;
        await emailService.sendPaymentLinkAfterSignature({
          to: quote.prospect.email,
          contactName: quote.prospect.contactName || quote.prospect.businessName,
          businessName: quote.prospect.businessName,
          packageType: quote.packageType,
          setupFee: Number(quote.setupFee),
          monthlyFee: Number(quote.monthlyFee),
          paymentLink: `${quote.stripePaymentLink}?client_reference_id=${quote.id}`,
        });
      }

      logger.info(`Contract signed for quote ${quote.id} (envelope ${envelopeId})`);

      await discordService.notify(
        `✅ CONTRACT SIGNED!\n\nBusiness: ${quote.prospect?.businessName || 'Unknown'}\nPlan: ${PACKAGES[quote.packageType]?.name || quote.packageType}\nQuote: ${quote.id}\nPayment link email sent`
      );
    } catch (error: any) {
      logger.error(`Error handling envelope completed for ${envelopeId}:`, error.message);
    }
  }

  /**
   * Handle envelope declined webhook
   */
  async handleEnvelopeDeclined(envelopeId: string): Promise<void> {
    const quote = await prisma.quote.findFirst({
      where: { docusignEnvelopeId: envelopeId },
      include: { prospect: true },
    });

    if (!quote) {
      logger.warn(`No quote found for declined DocuSign envelope: ${envelopeId}`);
      return;
    }

    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'declined' },
    });

    logger.info(`Contract declined for quote ${quote.id} (envelope ${envelopeId})`);

    await discordService.notify(
      `❌ CONTRACT DECLINED\n\nBusiness: ${quote.prospect?.businessName || 'Unknown'}\nPlan: ${PACKAGES[quote.packageType]?.name || quote.packageType}\nQuote: ${quote.id}`
    );
  }

  /**
   * Resend contract envelope (admin action)
   */
  async resendContract(quoteId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.warn('DocuSign not configured');
      return false;
    }

    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote?.docusignEnvelopeId) {
      logger.warn(`No envelope found for quote ${quoteId}, sending new contract`);
      const result = await this.sendContractForSignature(quoteId);
      return !!result;
    }

    // If already signed, no need to resend
    if (quote.contractSignedAt) {
      logger.info(`Contract already signed for quote ${quoteId}`);
      return false;
    }

    // Send a new envelope (can't resend an existing one easily via API)
    const result = await this.sendContractForSignature(quoteId);
    return !!result;
  }

  /**
   * Get contract status for a quote
   */
  async getContractStatus(quoteId: string): Promise<{ status: string; envelopeId?: string; signedAt?: Date | null; pdfUrl?: string | null }> {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        docusignEnvelopeId: true,
        contractSignedAt: true,
        contractPdfUrl: true,
        status: true,
      },
    });

    if (!quote) {
      return { status: 'not_found' };
    }

    if (quote.contractSignedAt) {
      return {
        status: 'signed',
        envelopeId: quote.docusignEnvelopeId || undefined,
        signedAt: quote.contractSignedAt,
        pdfUrl: quote.contractPdfUrl,
      };
    }

    if (quote.status === 'declined') {
      return {
        status: 'declined',
        envelopeId: quote.docusignEnvelopeId || undefined,
      };
    }

    if (quote.docusignEnvelopeId) {
      return {
        status: 'pending_signature',
        envelopeId: quote.docusignEnvelopeId,
      };
    }

    return { status: 'no_contract' };
  }
}

export const docuSignService = new DocuSignService();
