import { createHash } from 'node:crypto';

/**
 * ── LE SECOND AGENDA : OUTLOOK / MICROSOFT 365 ──────────────────────────────
 *
 * Google Agenda était la seule option, et ce n'était pas un choix : c'était un
 * angle mort. La majorité des PME belges vivent dans Microsoft 365, pas dans
 * Google. Un client sous Outlook appelait, l'agent confirmait « c'est noté pour
 * jeudi 14 h », et rien n'apparaissait nulle part chez lui. Le rendez-vous
 * existait en base, existait dans la tête de l'appelant, et n'existait dans
 * aucun des deux agendas qui comptent.
 *
 * Ce service répond aux mêmes gestes que son homologue Google, avec la même
 * signature, pour que `calendar-provider.service.ts` puisse passer de l'un à
 * l'autre sans que l'appelant ait à savoir lequel il tient.
 *
 * ── CE QUI DIFFÈRE DE GOOGLE, ET QU'IL FAUT SAVOIR ──────────────────────────
 *
 * 1. Le jeton se renouvelle par POST sur `/token`, pas par une bibliothèque.
 *    Microsoft renvoie `expires_in` en SECONDES, pas une date absolue.
 *
 * 2. Un refresh token Microsoft TOURNE : chaque renouvellement en rend un
 *    nouveau. Ignorer le nouveau, c'est garder un jeton que Microsoft a déjà
 *    révoqué — l'intégration meurt au bout d'une heure environ, et l'erreur
 *    parle de jeton invalide sans jamais dire pourquoi. On rend donc le nouveau
 *    refresh token à l'appelant, qui le réécrit en base.
 *
 * 3. Graph ne prend pas un identifiant de calendrier comme Google : le
 *    calendrier par défaut s'appelle littéralement `me/calendar`.
 *
 * 4. Les heures s'écrivent `{ dateTime, timeZone }` et l'instant DOIT porter son
 *    décalage. Le bug du 12/09/2026 sur Google — « neuf heures » demandé, 15 h
 *    dans l'agenda — se rejouerait à l'identique ici si l'instant partait nu.
 */

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const LOGIN_BASE = 'https://login.microsoftonline.com';

/* ── Les permissions demandées ──────────────────────────────────────────────
   `offline_access` n'est pas décoratif : sans elle, Microsoft ne rend AUCUN
   refresh token, et l'intégration expire au bout d'une heure. Le message
   d'erreur ne le dit pas — il parle de jeton invalide. C'est la permission
   qu'on oublie, et celle qui coûte le plus cher.
   `User.Read` sert à savoir QUEL compte a été branché, pour l'afficher. */
export const OUTLOOK_SCOPES = [
  'offline_access',
  'User.Read',
  'Calendars.ReadWrite',
];

export class OutlookCalendarError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'OutlookCalendarError';
  }
}

export interface OutlookTokens {
  accessToken: string;
  /** Le NOUVEAU refresh token. Microsoft le fait tourner : il faut le réécrire. */
  refreshToken: string | null;
  expiresIn: number;
}

export interface OutlookEvent {
  id: string;
  summary: string;
  start: string | null;
}

export class OutlookCalendarService {
  private clientId(): string {
    return process.env.MICROSOFT_CLIENT_ID || '';
  }

  private clientSecret(): string {
    return process.env.MICROSOFT_CLIENT_SECRET || '';
  }

  /**
   * `common` couvre comptes professionnels ET personnels. Un client belge peut
   * avoir un Microsoft 365 d'entreprise ou un simple compte hotmail, et exiger
   * l'un ferait échouer la moitié des branchements sur un écran d'erreur que
   * personne ne comprend.
   */
  private tenant(): string {
    return process.env.MICROSOFT_TENANT_ID || 'common';
  }

  /** Vrai quand l'application Microsoft est configurée côté serveur. */
  isConfigured(): boolean {
    return Boolean(this.clientId() && this.clientSecret());
  }

  /**
   * Où Microsoft renvoie le client après consentement.
   *
   * Même adresse que Google, volontairement : c'est la page du portail qui
   * traite le code, et elle traite déjà celui de Google. Une seconde URL à
   * déclarer dans Azure serait une occasion de plus de ne pas la déclarer du
   * tout — et Microsoft refuse alors la redirection sans dire laquelle il
   * attendait.
   */
  getRedirectUri(): string {
    return process.env.MICROSOFT_OAUTH_REDIRECT_URI
      || 'https://qwillio.com/dashboard/receptionist';
  }

  /** L'URL de consentement vers laquelle envoyer le client. */
  getConnectUrl(state: string): string {
    if (!this.isConfigured()) {
      throw new OutlookCalendarError('Microsoft OAuth is not configured (missing MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET)');
    }
    const params = new URLSearchParams({
      client_id: this.clientId(),
      response_type: 'code',
      redirect_uri: this.getRedirectUri(),
      response_mode: 'query',
      scope: OUTLOOK_SCOPES.join(' '),
      state,
      /* `offline_access` dans les scopes ne suffit pas toujours à faire
         réapparaître un refresh token si le client a déjà consenti : sans ce
         `prompt`, Microsoft rend un jeton d'accès sans refresh, et on croit à
         un bug alors que c'est un consentement mis en cache. */
      prompt: 'consent',
    });
    return `${LOGIN_BASE}/${this.tenant()}/oauth2/v2.0/authorize?${params}`;
  }

  /**
   * Échange le code de redirection contre des jetons.
   *
   * Rend le refresh token SÉPARÉMENT : l'appelant doit le ranger en base, sans
   * quoi rien ne survit à la première heure.
   */
  async exchangeCode(code: string): Promise<OutlookTokens> {
    const body = new URLSearchParams({
      client_id: this.clientId(),
      client_secret: this.clientSecret(),
      code,
      redirect_uri: this.getRedirectUri(),
      grant_type: 'authorization_code',
      scope: OUTLOOK_SCOPES.join(' '),
    });
    return this.postToken(body, 'exchange authorization code');
  }

  // ── Le cache de jetons ───────────────────────────────────────────────────
  // Deux idées reprises du service Google, parce qu'elles ont déjà servi :
  // la clé est un condensé (jamais le secret, une Map se retrouve dans un
  // vidage mémoire), et deux renouvellements concurrents ne partent pas en
  // même temps.

  private tokenCache = new Map<string, { token: string; expiresAt: number }>();
  private tokenPending = new Map<string, Promise<string>>();

  /**
   * Frappe un jeton d'accès depuis le refresh token.
   *
   * Rend AUSSI le nouveau refresh token quand Microsoft en donne un : un appel
   * qui jette le sien perd l'intégration à l'heure suivante. `onRefreshToken`
   * est le moyen de le réécrire en base sans que ce service connaisse Prisma.
   */
  async getAccessTokenFromRefresh(
    refreshToken: string,
    onRefreshToken?: (next: string) => void | Promise<void>,
  ): Promise<string> {
    const key = createHash('sha256').update(refreshToken).digest('hex');
    const hit = this.tokenCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.token;

    const inFlight = this.tokenPending.get(key);
    if (inFlight) return inFlight;

    const mint = (async () => {
      const body = new URLSearchParams({
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: OUTLOOK_SCOPES.join(' '),
      });
      const tokens = await this.postToken(body, 'refresh access token');

      /* Microsoft fait TOURNER le refresh token. Ne pas l'écrire, c'est garder
         un jeton déjà révoqué de l'autre côté: ça marche encore un moment, puis
         l'intégration meurt sans explication. On le remonte dès qu'il arrive. */
      if (tokens.refreshToken && tokens.refreshToken !== refreshToken && onRefreshToken) {
        try {
          await onRefreshToken(tokens.refreshToken);
        } catch {
          /* L'échec d'écriture ne doit pas faire échouer l'appel en cours : le
             jeton d'accès est valide, le rendez-vous doit pouvoir se poser. Le
             prochain renouvellement retombera sur l'ancien refresh token, qui
             vit encore quelques minutes. */
        }
      }

      /* `expires_in` est en SECONDES. Une heure par défaut, moins soixante
         secondes de marge: mieux vaut refrapper pour rien qu'obtenir un 401 au
         milieu d'un appel. */
      const seconds = Number(tokens.expiresIn) > 0 ? Number(tokens.expiresIn) : 3600;
      this.tokenCache.set(key, { token: tokens.accessToken, expiresAt: Date.now() + seconds * 1000 - 60_000 });
      return tokens.accessToken;
    })();

    this.tokenPending.set(key, mint);
    void mint.catch(() => {}).finally(() => this.tokenPending.delete(key));
    return mint;
  }

  /** Oublie le jeton d'un client. Sert au test, et à une déconnexion. */
  forgetAccessToken(refreshToken: string): void {
    const key = createHash('sha256').update(refreshToken).digest('hex');
    this.tokenCache.delete(key);
    this.tokenPending.delete(key);
  }

  private async postToken(body: URLSearchParams, what: string): Promise<OutlookTokens> {
    if (!this.isConfigured()) {
      throw new OutlookCalendarError(`Cannot ${what}: Microsoft OAuth is not configured`);
    }
    const res = await fetch(`${LOGIN_BASE}/${this.tenant()}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new OutlookCalendarError(`Microsoft token request failed (${res.status}) while trying to ${what}`, res.status, text);
    }
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new OutlookCalendarError(`Microsoft token response was not JSON while trying to ${what}`, res.status, text);
    }
    if (!parsed.access_token) {
      // Un `error_description` de Microsoft vaut mieux que notre propre phrase.
      throw new OutlookCalendarError(`Microsoft returned no access token while trying to ${what}`, res.status, text);
    }
    return {
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token ?? null,
      expiresIn: Number(parsed.expires_in) || 3600,
    };
  }

  // ── Les lectures et écritures d'agenda ───────────────────────────────────

  /** L'agenda où l'on écrit. Graph nomme le calendrier par défaut `me/calendar`. */
  private calendarPath(calendarId?: string | null): string {
    const id = (calendarId || '').trim();
    if (!id || id === 'primary') return '/me/calendar';
    return `/me/calendars/${encodeURIComponent(id)}`;
  }

  /** Le compte branché — pour l'afficher et prouver que la lecture marche. */
  async getConnectedAccount(accessToken: string): Promise<{ email: string | null; name: string | null }> {
    const res = await fetch(`${GRAPH_BASE}/me?$select=displayName,mail,userPrincipalName`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new OutlookCalendarError(`Graph /me failed (${res.status})`, res.status, await res.text());
    const me = await res.json() as any;
    return { email: me.mail || me.userPrincipalName || null, name: me.displayName || null };
  }

  /** Next upcoming events — proves read access and feeds the UI preview. */
  async listUpcomingEvents(refreshToken: string, calendarId = 'primary', maxResults = 3): Promise<OutlookEvent[]> {
    const accessToken = await this.getAccessTokenFromRefresh(refreshToken);
    const params = new URLSearchParams({
      $top: String(maxResults),
      $orderby: 'start/dateTime',
      $select: 'id,subject,start',
      startDateTime: new Date().toISOString(),
      endDateTime: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
    });
    const res = await fetch(`${GRAPH_BASE}${this.calendarPath(calendarId)}/calendarView?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new OutlookCalendarError(`Graph calendarView failed (${res.status})`, res.status, await res.text());
    const data = await res.json() as any;
    return (data.value || []).map((ev: any) => ({
      id: ev.id,
      summary: ev.subject || '(sans titre)',
      start: ev.start?.dateTime || null,
    }));
  }

  /**
   * Crée l'évènement d'un rendez-vous et rend son identifiant Graph.
   *
   * L'instant part avec son décalage explicite (`+02:00`), pas en UTC nu : Graph
   * accepte les deux mais interprète un instant sans décalage selon le fuseau
   * du calendrier, ce qui rejoue exactement le bug du 12/09/2026 — « neuf
   * heures » demandé, 15 h posé.
   */
  async createEvent(
    accessToken: string,
    event: {
      subject: string;
      bodyText?: string;
      startIso: string;
      endIso: string;
      timeZone: string;
      attendees?: string[];
    },
    calendarId?: string | null,
  ): Promise<string> {
    const tz = event.timeZone || 'Europe/Brussels';
    const payload: any = {
      subject: event.subject,
      body: { contentType: 'text', content: event.bodyText || '' },
      start: { dateTime: event.startIso, timeZone: tz },
      end: { dateTime: event.endIso, timeZone: tz },
      attendees: (event.attendees || []).filter(Boolean).map((address) => ({
        emailAddress: { address },
        type: 'required',
      })),
    };
    const res = await fetch(`${GRAPH_BASE}${this.calendarPath(calendarId)}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new OutlookCalendarError(`Graph create event failed (${res.status})`, res.status, await res.text());
    const created = await res.json() as any;
    if (!created?.id) throw new OutlookCalendarError('Graph created no event id');
    return created.id as string;
  }

  /** Retire un évènement. Un 404 est un succès: il n'est déjà plus là. */
  async deleteEvent(accessToken: string, eventId: string, calendarId?: string | null): Promise<void> {
    const res = await fetch(`${GRAPH_BASE}${this.calendarPath(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 404) return;
    if (!res.ok) throw new OutlookCalendarError(`Graph delete event failed (${res.status})`, res.status, await res.text());
  }

  /** Best-effort revocation on disconnect. */
  async revokeToken(refreshToken: string): Promise<void> {
    try {
      await fetch(`${LOGIN_BASE}/${this.tenant()}/oauth2/v2.0/logout`, { method: 'POST' });
    } catch {
      /* Une révocation qui échoue ne doit pas empêcher la déconnexion côté
         Qwillio: on oublie le jeton localement, ce qui suffit déjà à ne plus
         lire l'agenda du client. */
    }
    this.forgetAccessToken(refreshToken);
  }
}

export const outlookCalendarService = new OutlookCalendarService();
