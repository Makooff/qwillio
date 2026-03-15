declare module 'docusign-esign' {
  export class ApiClient {
    setOAuthBasePath(basePath: string): void;
    setBasePath(basePath: string): void;
    addDefaultHeader(key: string, value: string): void;
    requestJWTUserToken(
      clientId: string,
      userId: string,
      scopes: string[],
      privateKey: Buffer,
      expiresIn: number,
    ): Promise<{ body: { access_token: string; expires_in: number } }>;
  }

  export class EnvelopesApi {
    constructor(apiClient: ApiClient);
    createEnvelope(
      accountId: string,
      options: { envelopeDefinition: EnvelopeDefinition },
    ): Promise<{ envelopeId?: string; status?: string }>;
    getDocument(
      accountId: string,
      envelopeId: string,
      documentId: string,
    ): Promise<Buffer>;
  }

  export class EnvelopeDefinition {
    emailSubject?: string;
    emailBlurb?: string;
    documents?: Document[];
    recipients?: Recipients;
    status?: string;
    customFields?: CustomFields;
  }

  export class Document {
    documentBase64?: string;
    name?: string;
    fileExtension?: string;
    documentId?: string;
  }

  export class Signer {
    email?: string;
    name?: string;
    recipientId?: string;
    routingOrder?: string;
    clientUserId?: string;
    tabs?: Tabs;
  }

  export class Recipients {
    signers?: Signer[];
  }

  export class Tabs {
    signHereTabs?: SignHere[];
    dateSignedTabs?: DateSigned[];
  }

  export class SignHere {
    anchorString?: string;
    anchorUnits?: string;
    anchorXOffset?: string;
    anchorYOffset?: string;
    pageNumber?: string;
    xPosition?: string;
    yPosition?: string;
    documentId?: string;
  }

  export class DateSigned {
    anchorString?: string;
    anchorUnits?: string;
    anchorXOffset?: string;
    anchorYOffset?: string;
    pageNumber?: string;
    xPosition?: string;
    yPosition?: string;
    documentId?: string;
  }

  export class CustomFields {
    textCustomFields?: TextCustomField[];
  }

  export class TextCustomField {
    name?: string;
    value?: string;
    show?: string;
  }
}
