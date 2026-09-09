import { env } from './env';
import { fitAssistantLabel } from '../services/voice/vapi-limits';

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

  /**
   * Les derniers appels du compte, du plus récent au plus ancien.
   *
   * Sert au diagnostic de l'appel de test: le SDK web ne rend son identifiant
   * qu'une fois `start()` tenue, or l'échec le devance. Sans identifiant, le
   * seul chemin qui reste est de relire la liste et d'y retrouver l'appel par
   * son assistant et son horodatage. L'appelant DOIT filtrer: cette liste
   * couvre tout le compte, donc tous les clients.
   */
  async listCalls(limit = 20) {
    return this.request(`/call?limit=${Math.min(Math.max(limit, 1), 100)}`);
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
    /* Le nom repasse par la borne ici, et pas seulement chez l'appelant.
       Vapi refuse au-delà de 40 caractères, et ce refus ne dégrade rien: il
       annule la création. Un appelant futur qui composerait un nom à partir
       d'un champ client retomberait sur ce mur sans le savoir, comme
       « Receptionist - <nom commercial> » l'a fait. */
    return this.request('/assistant', {
      method: 'POST',
      body: JSON.stringify({ ...data, name: fitAssistantLabel(data.name) }),
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

  async listPhoneNumbers() {
    return this.request('/phone-number');
  }

  /**
   * Déclare chez Vapi un numéro que NOUS possédons déjà chez Twilio.
   *
   * À ne pas confondre avec `buyPhoneNumber`, qui achète sur la place de marché
   * de Vapi (et donc sur le compte Twilio de Vapi, sans notre dossier
   * réglementaire belge). Ici la ligne reste la nôtre: Vapi ne reçoit que de
   * quoi la piloter.
   *
   * Vapi accepte les deux formes d'authentification Twilio. On préfère la paire
   * clé d'API / secret, qui est révocable seule; le jeton de compte ouvre TOUT
   * le compte Twilio et ne sert que si la paire n'est pas configurée.
   */
  async importTwilioNumber(data: {
    number: string;
    twilioAccountSid: string;
    twilioApiKey?: string;
    twilioApiSecret?: string;
    twilioAuthToken?: string;
    assistantId?: string;
    name?: string;
  }) {
    return this.request('/phone-number', {
      method: 'POST',
      body: JSON.stringify({ provider: 'twilio', ...data }),
    });
  }

  /** Rattache (ou détache) l'assistant qui décroche sur ce numéro. */
  async updatePhoneNumber(phoneNumberId: string, data: Record<string, any>) {
    return this.request(`/phone-number/${phoneNumberId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
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
    // Même borne qu'à la création: une synchronisation refusée laisse
    // l'assistant DISTANT sur son ancienne configuration, en silence.
    const body = typeof data.name === 'string' ? { ...data, name: fitAssistantLabel(data.name) } : data;
    return this.request(`/assistant/${assistantId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async releasePhoneNumber(phoneNumberId: string) {
    return this.request(`/phone-number/${phoneNumberId}`, {
      method: 'DELETE',
    });
  }
}

export const vapiClient = new VapiClient();
