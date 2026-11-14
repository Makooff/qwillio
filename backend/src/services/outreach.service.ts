import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { smsService } from './sms.service';
import { smsReadiness } from './sms-ready';
import { toE164 } from '../utils/sms-e164';
import { phoneForms } from '../utils/phone-forms';
import {
  OUTREACH_SENDERS, OUTREACH_TEMPLATES, OutreachError, addressKind, defaultSenderKey, findTemplate, fromHeader,
  isEmail, renderOutreach, resolveSenderAddress,
  type OutreachSender, type Rendered,
} from '../config/outreach-templates';

/**
 * L'envoi A LA MAIN d'un mail ou d'un SMS de prospection, depuis le tableau de
 * bord.
 *
 * Ce service ne fait que trois choses, et dans cet ordre :
 *
 *   1. il REFUSE ce qui ne doit pas partir (opposition, adresse en echec,
 *      accord non atteste) ;
 *   2. il rend le message par le fichier pur `outreach-templates` ;
 *   3. il passe par les DEUX points d'envoi existants (`emailService.send`,
 *      `smsService.sendSMS`). Un troisieme chemin d'envoi divergerait des deux
 *      premiers : le lien de desinscription, la conversion E.164 et le journal
 *      `sms_logs` sont deja la-bas.
 *
 * L'ACCORD. Un SMS, ou un mail vers une adresse nominative, ne part que si
 * l'expediteur atteste que le destinataire a dit oui (`accord: true`). Le code
 * ne peut pas verifier une parole donnee au telephone ; il peut empecher qu'un
 * clic envoie sans que la question ait ete posee.
 */

export interface OutreachRequest {
  channel: 'email' | 'sms';
  templateId: string;
  /** Le prospect vise. Absent pour un envoi libre vers une adresse ou un numero saisi. */
  prospectId?: string | null;
  /** Le destinataire saisi a la main. Il prime sur celui de la fiche. */
  to?: string | null;
  vars?: Record<string, unknown>;
  sender: OutreachSender;
  /** La clé d'une adresse de `OUTREACH_SENDERS`. Absente : celle du modèle. */
  fromKey?: string | null;
  accord?: boolean;
}

export type OutreachFailure =
  | 'unknown_prospect' | 'unknown_template' | 'wrong_channel' | 'missing_recipient'
  | 'invalid_email' | 'invalid_phone' | 'opted_out' | 'bounced' | 'consent_required'
  | 'missing_field' | 'missing_sender' | 'missing_video' | 'sms_unavailable' | 'send_failed';

export type OutreachResult =
  | { ok: true; channel: 'email' | 'sms'; to: string; segments?: number; from?: string }
  | { ok: false; error: OutreachFailure; field?: string; detail?: string };

interface Target {
  to: string;
  prospectId: string | null;
  /** Vrai quand la route doit exiger l'accord atteste. */
  consentRequired: boolean;
  kind?: 'generic' | 'personal';
}

const PROSPECT_FIELDS = {
  id: true, email: true, phone: true, country: true, status: true,
  emailUnsubscribed: true, emailBounced: true, smsOptedOut: true, callOptedOut: true,
} as const;

class OutreachService {
  templates() {
    return {
      templates: OUTREACH_TEMPLATES.map(t => ({ ...t, defaultFrom: t.channel === 'email' ? defaultSenderKey(t.id) : null })),
      senders: OUTREACH_SENDERS,
      sms: smsReadiness(),
    };
  }

  /**
   * Qui recoit, et a-t-on le droit. Rend un echec nomme plutot que de lever :
   * chacun de ces refus est un cas NORMAL de l'ecran, pas une panne.
   */
  private async resolveTarget(req: OutreachRequest): Promise<Target | { error: OutreachFailure }> {
    const prospect = req.prospectId
      ? await prisma.prospect.findUnique({ where: { id: String(req.prospectId) }, select: PROSPECT_FIELDS })
      : null;
    if (req.prospectId && !prospect) return { error: 'unknown_prospect' };

    const typed = typeof req.to === 'string' ? req.to.trim() : '';

    if (req.channel === 'email') {
      const to = (typed || prospect?.email || '').trim().toLowerCase();
      if (!to) return { error: 'missing_recipient' };
      if (!isEmail(to)) return { error: 'invalid_email' };

      /* L'opposition suit l'ADRESSE, pas la fiche ouverte : un envoi libre vers
         une adresse qui s'est desinscrite sur une autre fiche reste interdit. */
      const known = await prisma.prospect.findMany({
        where: { email: { equals: to, mode: 'insensitive' } },
        select: { emailUnsubscribed: true, emailBounced: true },
        take: 20,
      });
      if (known.some(p => p.emailUnsubscribed)) return { error: 'opted_out' };
      if (known.some(p => p.emailBounced)) return { error: 'bounced' };

      const kind = addressKind(to);
      return { to, prospectId: prospect?.id ?? null, consentRequired: kind === 'personal', kind };
    }

    const raw = typed || prospect?.phone || '';
    if (!raw) return { error: 'missing_recipient' };
    const to = toE164(raw, typed ? 'BE' : prospect?.country ?? 'BE');
    if (!to) return { error: 'invalid_phone' };

    const known = await prisma.prospect.findMany({
      where: { phone: { in: phoneForms(to) } },
      select: { smsOptedOut: true, callOptedOut: true },
      take: 20,
    });
    /* « Ne me rappelez plus » vaut aussi pour un SMS : quelqu'un qui a refuse
       d'etre appele n'a pas demande a etre ecrit a la place. */
    if (known.some(p => p.smsOptedOut || p.callOptedOut)) return { error: 'opted_out' };

    return { to, prospectId: prospect?.id ?? null, consentRequired: true };
  }

  private render(req: OutreachRequest): Rendered | { error: OutreachFailure; field?: string } {
    const template = findTemplate(req.templateId);
    if (!template) return { error: 'unknown_template' };
    if (template.channel !== req.channel) return { error: 'wrong_channel' };
    try {
      return renderOutreach({ templateId: req.templateId, vars: req.vars ?? {}, sender: req.sender });
    } catch (error) {
      if (error instanceof OutreachError) {
        return { error: error.code as OutreachFailure, field: error.field };
      }
      throw error;
    }
  }

  /** Ce qui partirait, sans rien envoyer. L'ecran l'affiche a chaque frappe. */
  async preview(req: OutreachRequest) {
    const rendered = this.render(req);
    if ('error' in rendered) return { ok: false as const, error: rendered.error, field: rendered.field };
    const target = await this.resolveTarget(req);
    return {
      ok: true as const,
      rendered,
      from: rendered.channel === 'email'
        ? fromHeader(String(req.sender?.prenom ?? ''), resolveSenderAddress(req.templateId, req.fromKey).address)
        : null,
      /* Le destinataire peut manquer pendant qu'on redige : l'apercu ne s'en
         offusque pas, c'est l'envoi qui refusera. */
      recipient: 'error' in target
        ? { to: null, problem: target.error, consentRequired: req.channel === 'sms' }
        : { to: target.to, problem: null, consentRequired: target.consentRequired, kind: target.kind },
    };
  }

  async send(req: OutreachRequest): Promise<OutreachResult> {
    const target = await this.resolveTarget(req);
    if ('error' in target) return { ok: false, error: target.error };
    if (target.consentRequired && req.accord !== true) return { ok: false, error: 'consent_required' };

    const rendered = this.render(req);
    if ('error' in rendered) return { ok: false, error: rendered.error, field: rendered.field };

    if (rendered.channel === 'email') {
      const expediteur = resolveSenderAddress(req.templateId, req.fromKey);
      try {
        await emailService.send({
          to: target.to,
          subject: rendered.subject,
          html: rendered.html,
          /* Le mail part d'un alias de la boîte principale, et la réponse y
             revient : même adresse en « De » et en « Répondre à ». */
          from: fromHeader(String(req.sender?.prenom ?? ''), expediteur.address),
          replyTo: expediteur.address,
          tags: [{ name: 'type', value: 'outreach' }, { name: 'template', value: req.templateId }, { name: 'from', value: expediteur.key }],
        });
      } catch (error) {
        logger.warn(`[Outreach] mail « ${req.templateId} » non parti: ${(error as Error).message}`);
        return { ok: false, error: 'send_failed' };
      }
      await this.markTouched(target.prospectId);
      return { ok: true, channel: 'email', to: target.to, from: expediteur.address };
    }

    const ready = smsReadiness();
    if (!ready.ok) return { ok: false, error: 'sms_unavailable', detail: ready.missing.join(', ') };

    const result = await smsService.sendSMS(target.to, rendered.body, {
      messageType: `outreach_${req.templateId}`,
      prospectId: target.prospectId ?? undefined,
    });
    if (!result.success) {
      return { ok: false, error: 'send_failed', detail: result.error };
    }
    await this.markTouched(target.prospectId);
    return { ok: true, channel: 'sms', to: target.to, segments: rendered.segments };
  }

  /**
   * Un message envoye est un contact, pas un appel : la date bouge, le statut
   * avance de « nouveau » a « contacte », et le compteur d'appels ne bouge pas.
   * L'incrementer ferait mentir « 3 tentatives d'appel » sur une fiche que
   * personne n'a composee.
   */
  private async markTouched(prospectId: string | null): Promise<void> {
    if (!prospectId) return;
    try {
      const prospect = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { status: true } });
      if (!prospect) return;
      await prisma.prospect.update({
        where: { id: prospectId },
        data: {
          status: prospect.status === 'new' ? 'contacted' : prospect.status,
          lastContactDate: new Date(),
        },
      });
    } catch (error) {
      logger.warn(`[Outreach] contact non consigne (${prospectId}): ${(error as Error).message}`);
    }
  }
}

export const outreachService = new OutreachService();
