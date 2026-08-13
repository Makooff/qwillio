import { env } from './env';

class VapiClient {
  private baseUrl: string;
  private privateKey: string;

  constructor() {
    this.baseUrl = env.VAPI_BASE_URL;
    this.privateKey = env.VAPI_PRIVATE_KEY;
  }

  private async request(path: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.privateKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`VAPI API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  async createCall(data: {
    assistantId: string;
    phoneNumberId?: string;
    customer: { number: string; name?: string };
    assistantOverrides?: Record<string, any>;
  }) {
    return this.request('/call/phone', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCall(callId: string) {
    return this.request(`/call/${callId}`);
  }

  async createAssistant(data: {
    name: string;
    model: Record<string, any>;
    voice: Record<string, any>;
    firstMessage: string;
    serverUrl?: string;
    endCallFunctionEnabled?: boolean;
    recordingEnabled?: boolean;
  }) {
    return this.request('/assistant', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async buyPhoneNumber(data: { areaCode?: string; assistantId: string }) {
    return this.request('/phone-number', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'twilio',
        ...data,
      }),
    });
  }

  /**
   * Rattache un numéro que NOUS possédons déjà chez Twilio.
   *
   * `buyPhoneNumber` ci-dessus achète via le compte Twilio de Vapi, ce qui ne
   * donne que des numéros du pays supporté par ce compte. Un numéro BELGE ne
   * peut pas venir de là: les opérateurs belges exigent qu'il soit rattaché à
   * une adresse belge dans un dossier réglementaire, et ce dossier se dépose
   * dans NOTRE compte Twilio, pas dans celui de Vapi.
   *
   * D'où ce second chemin: on achète le numéro chez nous, dossier à l'appui,
   * et on le confie ensuite à Vapi avec nos identifiants. C'est la seule voie
   * possible pour la Belgique, et elle vaut pour tout pays à contrainte
   * réglementaire (France, Pays-Bas, Allemagne…).
   */
  async importTwilioNumber(data: {
    number: string;
    twilioAccountSid: string;
    twilioAuthToken: string;
    assistantId: string;
    name?: string;
  }) {
    return this.request('/phone-number', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'twilio',
        ...data,
      }),
    });
  }

  async listPhoneNumbers() {
    return this.request('/phone-number');
  }

  async getAssistant(assistantId: string) {
    return this.request(`/assistant/${assistantId}`);
  }

  async deleteAssistant(assistantId: string) {
    return this.request(`/assistant/${assistantId}`, {
      method: 'DELETE',
    });
  }

  async updateAssistant(assistantId: string, data: Record<string, any>) {
    return this.request(`/assistant/${assistantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async releasePhoneNumber(phoneNumberId: string) {
    return this.request(`/phone-number/${phoneNumberId}`, {
      method: 'DELETE',
    });
  }
}

export const vapiClient = new VapiClient();
