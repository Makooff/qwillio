/**
 * Closer Agent — AI-powered multi-channel sales closer
 *
 * Replaces the generic follow-up with a 7-touch sequence driven by GPT-4o.
 * Every message is personalized from the call context: niche, objections
 * raised, interest signals, agent name, language.
 *
 * Sequence (hot leads score ≥ 8):
 *   Step 1 — SMS immediate        (T+0)
 *   Step 2 — SMS social proof     (T+12min, if no reply)
 *   Step 3 — Email HTML           (T+1h)
 *   Step 4 — SMS check-in         (T+24h)
 *   Step 5 — Email case study     (T+3d)
 *   Step 6 — SMS closing urgency  (T+5d)
 *   Step 7 — Email final offer    (T+7d)
 *
 * Warm leads (score 5-7): steps 1, 3, 5, 7 only
 * Cold   (score < 5):     no sequence
 */

import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { smsService } from './sms.service';
import { resend } from '../config/resend';
import { discordService } from './discord.service';
import {
  brandWrap, brandTitle, brandText, brandButton, brandList, brandSmall,
} from './email-template';

// ─── Types ────────────────────────────────────────────────

export interface CallContext {
  prospectId: string;
  interestScore: number;
  attemptNumber: number;
  detectionResult: 'answered' | 'voicemail' | 'no_answer' | 'rejected';
  transcript?: string;
  pricingDiscussed?: boolean;
  prospectAskedQuestion?: boolean;
  agreedToDemo?: boolean;
  mainObjection?: string; // extracted from transcript
}

interface ProspectData {
  id: string;
  businessName: string;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  niche: string | null;
  businessType: string | null;
  city: string | null;
  country: string;
  timezone: string;
  smsOptedOut: boolean;
  emailUnsubscribed: boolean;
  googleRating: number | null;
  googleReviewsCount: number | null;
  website: string | null;
}

interface GeneratedContent {
  sms1: string;    // immediate SMS
  sms2: string;    // social proof SMS (12min)
  sms4: string;    // check-in SMS (24h)
  sms6: string;    // urgency SMS (5d)
  emailSubject3: string;
  emailHtml3: string;
  emailSubject5: string;
  emailHtml5: string;
  emailSubject7: string;
  emailHtml7: string;
}

// ─── Niche → social proof snippet ─────────────────────────
const NICHE_PROOF: Record<string, Record<'en' | 'fr', string>> = {
  home_services: {
    en: 'A plumber in Houston went from 12 missed calls/week to zero — and added $4,200 in monthly revenue in 30 days.',
    fr: 'Un plombier à Lyon passait de 14 appels manqués/semaine à zéro — et a ajouté 3 800 €/mois en 30 jours.',
  },
  dental: {
    en: 'A dental practice in Atlanta captured 28 new patient inquiries in their first month — all from calls they used to miss.',
    fr: 'Un cabinet dentaire à Lyon a capturé 28 nouvelles demandes de patients en un mois — des appels qu\'ils manquaient avant.',
  },
  auto: {
    en: 'An auto shop in Dallas stopped losing Friday afternoon calls — that alone was worth $1,800/month.',
    fr: 'Un garage à Marseille a arrêté de perdre les appels du vendredi après-midi — ça lui rapporte 1 600 € de plus chaque mois.',
  },
  medical: {
    en: 'A clinic in Phoenix answered 100% of calls for the first time ever. Patient satisfaction scores jumped in week one.',
    fr: 'Une clinique à Lyon a répondu à 100 % des appels pour la première fois. Les scores de satisfaction ont bondi dès la première semaine.',
  },
  salon: {
    en: 'A hair salon in Miami filled 19 last-minute appointment slots in one month — all from calls the owner used to miss.',
    fr: 'Un salon à Paris a rempli 19 créneaux de dernière minute en un mois — des appels que la propriétaire manquait avant.',
  },
  veterinary: {
    en: 'A vet clinic in Seattle answered every emergency call after hours. Two of those became lifelong clients.',
    fr: 'Une clinique vétérinaire à Lyon répond maintenant à tous les appels d\'urgence hors horaires.',
  },
  law: {
    en: 'A personal injury firm in New York captured 11 new client inquiries in their first week — all from after-hours calls.',
    fr: 'Un cabinet d\'avocat à Paris a capturé 11 nouvelles demandes en une semaine — des appels qu\'il manquait avant.',
  },
  default: {
    en: 'Businesses using Qwillio answer 100% of calls and report an average of $3,200 added in monthly revenue within 30 days.',
    fr: 'Les entreprises qui utilisent Qwillio répondent à 100 % des appels et rapportent en moyenne 2 800 € de revenus supplémentaires dans les 30 jours.',
  },
};

function getNicheProof(niche: string, lang: 'en' | 'fr'): string {
  return (NICHE_PROOF[niche] ?? NICHE_PROOF.default)[lang];
}

// ─── GPT prompt helpers ───────────────────────────────────

function buildCloserSystemPrompt(lang: 'en' | 'fr'): string {
  if (lang === 'fr') {
    return `Tu es Ashley/Marie, un(e) agent(e) commercial(e) d'élite pour Qwillio (réceptionniste IA pour PME).
Tu es humain(e), directe, ultra-convaincante. Tu n'es PAS un bot.
Tes messages SMS sont courts (max 160 caractères), naturels, avec un seul CTA.
Tes emails sont en HTML, écrits à la première personne, comme si tu envoyais un mail personnel.
Qwillio : premier mois gratuit, puis 497 $/mois. Setup en 48h.
Règle : JAMAIS de jargon marketing. JAMAIS de "Notre solution innovante". Parle comme un humain.
Réponds uniquement en JSON valide.`;
  }
  return `You are Ashley/Marie, an elite B2B sales agent for Qwillio (AI receptionist for small businesses).
You are human, direct, ultra-persuasive. You are NOT a bot.
Your SMS messages are short (max 160 chars), natural, one clear CTA.
Your emails are HTML, written in first person, like a personal email.
Qwillio: first month free, then $497/month. 48h setup.
Rule: NEVER use marketing jargon. NEVER say "Our innovative solution". Talk like a human.
Reply in valid JSON only.`;
}

function buildCloserUserPrompt(p: ProspectData, ctx: CallContext, lang: 'en' | 'fr'): string {
  const agent = lang === 'fr' ? 'Marie' : 'Ashley';
  const niche = p.niche ?? p.businessType ?? 'business';
  const firstName = p.contactName?.split(' ')[0] ?? (lang === 'fr' ? 'vous' : 'there');
  const baseUrl = env.FRONTEND_URL?.split(',')[0] ?? 'https://qwillio.com';
  const trialUrl = `${baseUrl}/register`;
  const proof = getNicheProof(niche, lang);

  const callSummary = ctx.transcript
    ? `Call transcript (excerpt): "${ctx.transcript.slice(0, 400)}"`
    : [
        ctx.pricingDiscussed ? 'Pricing was discussed.' : '',
        ctx.agreedToDemo     ? 'They agreed to a demo.' : '',
        ctx.mainObjection    ? `Main objection: "${ctx.mainObjection}"` : '',
      ].filter(Boolean).join(' ') || 'Call was short.';

  if (lang === 'fr') {
    return `Génère les 7 messages de suivi pour ce prospect :

Entreprise : ${p.businessName}
Niche : ${niche}
Ville : ${p.city ?? ''}
Prénom du contact : ${firstName}
Agent : ${agent}
Score d'intérêt : ${ctx.interestScore}/10
Contexte de l'appel : ${callSummary}
Preuve sociale : ${proof}
Lien essai : ${trialUrl}

Retourne ce JSON exact (no markdown) :
{
  "sms1": "SMS immédiat (max 160 chars, mentionne un détail de l'appel, lien vers ${trialUrl})",
  "sms2": "SMS preuve sociale 12 min plus tard (max 160 chars, cite le cas client, lien vers ${trialUrl})",
  "sms4": "SMS check-in 24h plus tard (max 140 chars, naturel, question ouverte ou relance)",
  "sms6": "SMS urgence 5 jours plus tard (max 150 chars, urgence + offre limitée)",
  "emailSubject3": "Objet email J+0 1h après l'appel (personnel, max 60 chars, sans spam words)",
  "emailBody3": "Corps du mail EN TEXTE BRUT (sans HTML), 150-250 mots, voix d'${agent}, mentionne l'appel, 1 CTA vers ${trialUrl}",
  "emailSubject5": "Objet email J+3 (preuve + niche, max 60 chars)",
  "emailBody5": "Corps du mail EN TEXTE BRUT (sans HTML), 200-300 mots, cas client + objection handler + CTA",
  "emailSubject7": "Objet email J+7 final (urgence + nom de l'entreprise, max 60 chars)",
  "emailBody7": "Corps du mail EN TEXTE BRUT (sans HTML), 150-200 mots, dernière chance + offre + CTA"
}`;
  }

  return `Generate the 7-touch follow-up messages for this prospect:

Business: ${p.businessName}
Niche: ${niche}
City: ${p.city ?? ''}
Contact first name: ${firstName}
Agent: ${agent}
Interest score: ${ctx.interestScore}/10
Call context: ${callSummary}
Social proof: ${proof}
Trial link: ${trialUrl}

Return this exact JSON (no markdown):
{
  "sms1": "Immediate SMS (max 160 chars, references something from the call, link to ${trialUrl})",
  "sms2": "Social proof SMS 12 min later (max 160 chars, cites client case, link to ${trialUrl})",
  "sms4": "Check-in SMS 24h later (max 140 chars, casual, open question or nudge)",
  "sms6": "Urgency SMS 5 days later (max 150 chars, urgency + limited offer)",
  "emailSubject3": "Email subject day-0 1h after call (personal, max 60 chars, no spam words)",
  "emailBody3": "Email body in PLAIN TEXT (no HTML), 150-250 words, ${agent}'s voice, references the call, 1 CTA to ${trialUrl}",
  "emailSubject5": "Email subject day-3 (proof + niche, max 60 chars)",
  "emailBody5": "Email body in PLAIN TEXT (no HTML), 200-300 words, client case + objection handler + CTA",
  "emailSubject7": "Email subject day-7 final (urgency + business name, max 60 chars)",
  "emailBody7": "Email body in PLAIN TEXT (no HTML), 150-200 words, last chance + offer + CTA"
}`;
}

// ─── HTML email renderer ──────────────────────────────────

function renderCloserEmail(opts: {
  subject: string;
  agentName: string;
  bodyText: string;
  ctaLabel: string;
  ctaUrl: string;
  proofSnippet: string;
  niche: string;
  lang: 'en' | 'fr';
  unsubscribeUrl: string;
}): string {
  const { agentName, bodyText, ctaLabel, ctaUrl, proofSnippet, unsubscribeUrl, subject } = opts;

  // Convert plain text paragraphs → HTML paragraphs
  const bodyHtml = bodyText
    .split('\n\n')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => brandText(p.replace(/\n/g, '<br>')))
    .join('');

  const unsubHtml = `<p style="margin:24px 0 0 0;font-size:11px;color:#999;text-align:center;">
    <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline;">
      ${opts.lang === 'fr' ? 'Se désabonner' : 'Unsubscribe'}
    </a>
  </p>`;

  const body = `
    ${brandTitle(subject)}
    ${bodyHtml}
    ${brandList([proofSnippet])}
    ${brandButton(ctaLabel, ctaUrl)}
    ${brandSmall(`${agentName}, Qwillio`)}
  `;

  return brandWrap({
    title: subject,
    preheader: subject,
    body,
    unsubscribeHtml: unsubHtml,
  });
}

// ─── Closer Agent Service ─────────────────────────────────

export class CloserAgentService {
  private readonly OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

  /** Generate all 7-touch content in one GPT call */
  private async generateContent(
    p: ProspectData,
    ctx: CallContext,
    lang: 'en' | 'fr',
  ): Promise<GeneratedContent | null> {
    if (!env.OPENAI_API_KEY) return null;

    try {
      const res = await fetch(this.OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.75,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: buildCloserSystemPrompt(lang) },
            { role: 'user', content: buildCloserUserPrompt(p, ctx, lang) },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) return null;

      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      const raw = data.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(raw) as any;

      return {
        sms1: parsed.sms1 ?? '',
        sms2: parsed.sms2 ?? '',
        sms4: parsed.sms4 ?? '',
        sms6: parsed.sms6 ?? '',
        emailSubject3: parsed.emailSubject3 ?? '',
        emailHtml3: parsed.emailBody3 ?? '',
        emailSubject5: parsed.emailSubject5 ?? '',
        emailHtml5: parsed.emailBody5 ?? '',
        emailSubject7: parsed.emailSubject7 ?? '',
        emailHtml7: parsed.emailBody7 ?? '',
      };
    } catch (err: unknown) {
      logger.error(`[CloserAgent] GPT generation failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Fallback static content when GPT unavailable */
  private buildFallback(p: ProspectData, lang: 'en' | 'fr'): GeneratedContent {
    const agent = lang === 'fr' ? 'Marie' : 'Ashley';
    const firstName = p.contactName?.split(' ')[0] ?? (lang === 'fr' ? 'vous' : 'there');
    const niche = p.niche ?? p.businessType ?? 'business';
    const base = env.FRONTEND_URL?.split(',')[0] ?? 'https://qwillio.com';
    const url = `${base}/register`;
    const proof = getNicheProof(niche, lang);

    if (lang === 'fr') {
      return {
        sms1: `Bonjour ${firstName}, c'est ${agent} de Qwillio. Comme promis — essai 30 jours offert : ${url} Répondre STOP pour se désinscrire.`,
        sms2: `${proof.slice(0, 100)}… Vous pouvez avoir le même résultat : ${url}`,
        sms4: `Bonjour ${firstName}, avez-vous eu le temps de jeter un œil à Qwillio ? Je peux vous faire une démo en 5 min.`,
        sms6: `Dernière chance ${firstName} — on garde votre mois offert jusqu'à vendredi. Inscription : ${url}`,
        emailSubject3: `Comme promis, ${p.businessName} — votre démo Qwillio`,
        emailHtml3: `Bonjour ${firstName},\n\nComme je vous le disais tout à l'heure, chaque appel non répondu part chez un concurrent.\n\nQwillio répond à 100% des appels, prend les rendez-vous et capture les leads — 24h/24. Premier mois entièrement gratuit.\n\n${proof}\n\nDémarrez votre essai : ${url}\n\nCordialement,\n${agent}, Qwillio`,
        emailSubject5: `Comment les ${niche} utilisent Qwillio pour ne plus perdre un seul client`,
        emailHtml5: `Bonjour ${firstName},\n\n${proof}\n\nLa clé ? Un assistant IA qui répond exactement comme un humain — avec votre nom, votre ton, votre agenda.\n\nSetup en 48h. Aucun engagement. Premier mois gratuit.\n\nInscription : ${url}\n\n${agent}, Qwillio`,
        emailSubject7: `Dernière chance — mois offert pour ${p.businessName}`,
        emailHtml7: `Bonjour ${firstName},\n\nJe ne veux pas être insistante, mais je sais qu'un appel manqué vous coûte en moyenne 3x le prix de Qwillio.\n\nCe lien expire bientôt : ${url}\n\nUne question ? Répondez à cet email — je vous réponds en moins d'une heure.\n\n${agent}, Qwillio`,
      };
    }

    return {
      sms1: `Hi ${firstName}, it's ${agent} from Qwillio. As promised — free 30-day trial, no commitment: ${url} Reply STOP to opt out.`,
      sms2: `${proof.slice(0, 100)}… Your business can do the same: ${url}`,
      sms4: `Hey ${firstName}, just checking in — did you get a chance to look at Qwillio? Happy to do a 5-min demo anytime.`,
      sms6: `Last chance ${firstName} — keeping your free month open until Friday. Sign up: ${url}`,
      emailSubject3: `As promised, ${p.businessName} — your Qwillio demo`,
      emailHtml3: `Hi ${firstName},\n\nAs I mentioned on our call, every missed call goes straight to your competitor.\n\nQwillio answers 100% of your calls, books jobs, and captures leads — 24/7. First month completely free.\n\n${proof}\n\nStart your trial: ${url}\n\nBest,\n${agent}, Qwillio`,
      emailSubject5: `How ${niche} businesses use Qwillio to stop losing clients`,
      emailHtml5: `Hi ${firstName},\n\n${proof}\n\nThe key? An AI assistant that answers exactly like a human — with your name, your tone, your schedule.\n\n48h setup. No commitment. First month free.\n\nSign up: ${url}\n\n${agent}, Qwillio`,
      emailSubject7: `Last chance — free month for ${p.businessName}`,
      emailHtml7: `Hi ${firstName},\n\nI don't want to be pushy, but I know one missed call costs you more than a month of Qwillio.\n\nThis link expires soon: ${url}\n\nAny questions? Reply to this email — I respond within the hour.\n\n${agent}, Qwillio`,
    };
  }

  /** Build HTML email from plain text body */
  private buildEmailHtml(
    subject: string,
    bodyText: string,
    ctaUrl: string,
    agent: string,
    proofSnippet: string,
    lang: 'en' | 'fr',
    emailAddr: string,
  ): string {
    const token = Buffer.from(emailAddr).toString('base64url');
    const apiBase = env.API_BASE_URL ?? 'https://api.qwillio.com';
    const unsubUrl = `${apiBase}/api/unsubscribe/${token}`;
    const ctaLabel = lang === 'fr' ? 'Démarrer l\'essai gratuit' : 'Start your free trial';

    return renderCloserEmail({
      subject,
      agentName: agent,
      bodyText,
      ctaLabel,
      ctaUrl: ctaUrl,
      proofSnippet,
      niche: 'default',
      lang,
      unsubscribeUrl: unsubUrl,
    });
  }

  /**
   * Main entry point — called after a completed call.
   * Schedules the full multi-touch sequence.
   */
  async scheduleSequence(ctx: CallContext): Promise<void> {
    if (ctx.interestScore < 5) return; // below threshold — skip

    const prospect = await prisma.prospect.findUnique({
      where: { id: ctx.prospectId },
      select: {
        id: true, businessName: true, phone: true, email: true,
        contactName: true, niche: true, businessType: true,
        city: true, country: true, timezone: true,
        smsOptedOut: true, emailUnsubscribed: true,
        googleRating: true, googleReviewsCount: true, website: true,
      },
    });
    if (!prospect) return;

    const lang: 'en' | 'fr' = (
      prospect.country === 'FR' || prospect.country === 'BE'
    ) ? 'fr' : 'en';

    const agentName = lang === 'fr' ? 'Marie' : 'Ashley';
    const niche = prospect.niche ?? prospect.businessType ?? 'business';
    const proof = getNicheProof(niche, lang);
    const baseUrl = env.FRONTEND_URL?.split(',')[0] ?? 'https://qwillio.com';
    const trialUrl = `${baseUrl}/register`;
    const isHot = ctx.interestScore >= 8;

    // Generate all content in one GPT call
    const content = (await this.generateContent(prospect, ctx, lang)) ?? this.buildFallback(prospect, lang);

    const now = Date.now();
    const min = 60 * 1000;
    const h   = 60 * min;
    const d   = 24 * h;

    const schedules: Array<{
      type: string;
      step: number;
      sendAt: Date;
      content: string;
      target: string | null;
    }> = [];

    // ── SMS channel ───────────────────────────────────────
    const canSms = !!prospect.phone && !prospect.smsOptedOut;

    if (canSms) {
      schedules.push({ type: 'sms_closer_1', step: 1, sendAt: new Date(now),              content: content.sms1, target: prospect.phone });
      if (isHot) {
        schedules.push({ type: 'sms_closer_2', step: 2, sendAt: new Date(now + 12 * min), content: content.sms2, target: prospect.phone });
        schedules.push({ type: 'sms_closer_4', step: 4, sendAt: new Date(now + 1 * d),    content: content.sms4, target: prospect.phone });
        schedules.push({ type: 'sms_closer_6', step: 6, sendAt: new Date(now + 5 * d),    content: content.sms6, target: prospect.phone });
      }
    }

    // ── Email channel ─────────────────────────────────────
    const canEmail = !!prospect.email && !prospect.emailUnsubscribed;

    if (canEmail) {
      const html3 = this.buildEmailHtml(content.emailSubject3, content.emailHtml3, trialUrl, agentName, proof, lang, prospect.email!);
      const html5 = this.buildEmailHtml(content.emailSubject5, content.emailHtml5, trialUrl, agentName, proof, lang, prospect.email!);
      const html7 = this.buildEmailHtml(content.emailSubject7, content.emailHtml7, trialUrl, agentName, proof, lang, prospect.email!);

      schedules.push({ type: 'email_closer_3', step: 3, sendAt: new Date(now + 1 * h),   content: JSON.stringify({ subject: content.emailSubject3, html: html3 }), target: prospect.email });
      schedules.push({ type: 'email_closer_5', step: 5, sendAt: new Date(now + 3 * d),   content: JSON.stringify({ subject: content.emailSubject5, html: html5 }), target: prospect.email });
      schedules.push({ type: 'email_closer_7', step: 7, sendAt: new Date(now + 7 * d),   content: JSON.stringify({ subject: content.emailSubject7, html: html7 }), target: prospect.email });
    }

    // Save all to DB (skip duplicates)
    for (const s of schedules) {
      if (!s.target) continue;
      const existing = await prisma.followUpSequence.findFirst({
        where: { prospectId: prospect.id, type: s.type, step: s.step },
      });
      if (existing) continue;
      await prisma.followUpSequence.create({
        data: {
          prospectId: prospect.id,
          type: s.type,
          step: s.step,
          scheduledAt: s.sendAt,
          content: s.content,
        },
      });
    }

    logger.info(`[CloserAgent] Scheduled ${schedules.length} touches for ${prospect.businessName} (score ${ctx.interestScore}, lang ${lang})`);
  }

  /**
   * Process all due closer sequences.
   * Called by the existing cron via followUpSequencesService.processDue()
   */
  async processDueCloserSteps(): Promise<number> {
    const now = new Date();
    const due = await prisma.followUpSequence.findMany({
      where: {
        sentAt: null,
        scheduledAt: { lte: now },
        OR: [
          { type: { startsWith: 'sms_closer_' } },
          { type: { startsWith: 'email_closer_' } },
          { type: 'callback_call' },
        ],
      },
      include: {
        prospect: {
          select: {
            id: true, businessName: true, phone: true, email: true,
            contactName: true, niche: true, businessType: true,
            smsOptedOut: true, emailUnsubscribed: true,
          },
        },
      },
      take: 100,
    });

    let sent = 0;

    for (const item of due) {
      const p = item.prospect;
      let success = false;

      try {
        if (item.type.startsWith('sms_closer_') && p.phone && !p.smsOptedOut) {
          const body = item.content ?? '';
          if (body) {
            const result = await smsService.sendSMS(p.phone, body, {
              messageType: item.type,
              prospectId: p.id,
            });
            success = result.success;
          }
        } else if (item.type.startsWith('email_closer_') && p.email && !p.emailUnsubscribed) {
          const payload = JSON.parse(item.content ?? '{}') as { subject: string; html: string };
          if (payload.subject && payload.html) {
            try {
              await resend.emails.send({
                from: env.RESEND_FROM_EMAIL || 'Qwillio <hello@qwillio.com>',
                to: p.email,
                replyTo: env.RESEND_REPLY_TO || 'contact@qwillio.com',
                subject: payload.subject,
                html: payload.html,
              });
              success = true;
            } catch (emailErr) {
              logger.error(`[CloserAgent] Email send failed for ${p.businessName}:`, emailErr);
            }
          }
        } else if (item.type === 'callback_call' && p.phone) {
          // OPT #8 — Dispatch outbound VAPI call for callback request
          if (env.VAPI_ASSISTANT_ID && env.VAPI_PHONE_NUMBER_ID) {
            try {
              const vapiRes = await fetch('https://api.vapi.ai/call/phone', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${env.VAPI_PRIVATE_KEY}`,
                },
                body: JSON.stringify({
                  assistantId: env.VAPI_ASSISTANT_ID,
                  phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
                  customer: { number: p.phone },
                }),
                signal: AbortSignal.timeout(10000),
              });
              if (vapiRes.ok) {
                success = true;
                logger.info(`[CloserAgent] Callback call dispatched for ${p.businessName}`);
              } else {
                const errText = await vapiRes.text();
                logger.error(`[CloserAgent] VAPI callback call failed for ${p.businessName}: ${vapiRes.status} ${errText}`);
              }
            } catch (vapiErr) {
              logger.error(`[CloserAgent] VAPI callback call error for ${p.businessName}:`, vapiErr);
            }
          } else {
            logger.warn('[CloserAgent] callback_call skipped — VAPI_ASSISTANT_ID or VAPI_PHONE_NUMBER_ID not configured');
          }
        }

        if (success) {
          await prisma.followUpSequence.update({
            where: { id: item.id },
            data: { sentAt: new Date() },
          });
          sent++;
        }
      } catch (err) {
        logger.error(`[CloserAgent] Failed step ${item.type} for prospect ${p.id}:`, err);
      }
    }

    if (sent > 0) {
      logger.info(`[CloserAgent] Sent ${sent} closer message(s)`);
    }
    return sent;
  }

  // ─── Intent detection ────────────────────────────────────

  private async detectIntent(body: string, lang: 'en' | 'fr'): Promise<{
    intent: 'hot_buy' | 'wants_demo' | 'wants_callback' | 'objection' | 'opt_out' | 'neutral';
    confidence: number;
  }> {
    if (!env.OPENAI_API_KEY) return { intent: 'neutral', confidence: 0.5 };

    try {
      const res = await fetch(this.OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          max_tokens: 60,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `Classify the intent of this sales prospect SMS reply. Return JSON only: { "intent": string, "confidence": number }. Intent values: hot_buy (ready to buy/sign up), wants_demo (wants a demo/call), wants_callback (wants you to call them), objection (price/time/not interested), opt_out (stop/remove/unsubscribe), neutral (just asking questions or vague). Language hint: ${lang}.`,
            },
            { role: 'user', content: body },
          ],
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) return { intent: 'neutral', confidence: 0.5 };

      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      const raw = data.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as { intent?: string; confidence?: number };

      const validIntents = ['hot_buy', 'wants_demo', 'wants_callback', 'objection', 'opt_out', 'neutral'] as const;
      type IntentValue = typeof validIntents[number];
      const intent = validIntents.includes(parsed.intent as IntentValue)
        ? (parsed.intent as IntentValue)
        : 'neutral';
      const confidence = typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5;

      return { intent, confidence };
    } catch {
      return { intent: 'neutral', confidence: 0.5 };
    }
  }

  /**
   * Handle inbound SMS reply from a prospect — AI responds contextually.
   * Called from webhooks.controller.ts when we receive a Twilio inbound SMS
   * that is NOT a STOP/START keyword.
   */
  async handleInboundReply(params: {
    prospectId: string;
    fromPhone: string;
    message: string;
  }): Promise<void> {
    const { prospectId, fromPhone, message } = params;

    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: {
        id: true, businessName: true, contactName: true,
        niche: true, businessType: true, city: true,
        country: true, interestLevel: true,
      },
    });
    if (!prospect) return;

    const lang: 'en' | 'fr' = (
      prospect.country === 'FR' || prospect.country === 'BE'
    ) ? 'fr' : 'en';
    const agentName = lang === 'fr' ? 'Marie' : 'Ashley';
    const niche = prospect.niche ?? prospect.businessType ?? 'business';
    const baseUrl = env.FRONTEND_URL?.split(',')[0] ?? 'https://qwillio.com';
    const trialUrl = `${baseUrl}/register`;
    const firstName = prospect.contactName?.split(' ')[0] ?? '';

    // ── Intent detection (OPT #2) ─────────────────────────
    const { intent, confidence } = await this.detectIntent(message, lang);
    logger.info(`[CloserAgent] Intent detected for ${prospect.businessName}: ${intent} (confidence: ${confidence})`);

    // Handle opt-out intent
    if (intent === 'opt_out') {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: { smsOptedOut: true, smsOptedOutAt: new Date() },
      });
      logger.info(`[CloserAgent] Opt-out detected via AI intent for ${prospect.businessName} — SMS suppressed`);
      return;
    }

    // Handle hot buy / wants demo
    if (intent === 'hot_buy' || intent === 'wants_demo') {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: { status: 'hot_lead' },
      });
      await discordService.notifyLeads(
        `🔥 HOT LEAD — ${prospect.businessName} (${niche}) responded: "${message.slice(0, 100)}"`
      );
    }

    // Handle callback request (OPT #8)
    let wantsCallback = false;
    if (intent === 'wants_callback') {
      wantsCallback = true;
      const callbackAt = new Date(Date.now() + 10 * 60 * 1000); // T+10min
      const existing = await prisma.followUpSequence.findFirst({
        where: { prospectId, type: 'callback_call', sentAt: null },
      });
      if (!existing) {
        await prisma.followUpSequence.create({
          data: {
            prospectId,
            type: 'callback_call',
            step: 0,
            scheduledAt: callbackAt,
            content: JSON.stringify({ phone: params.fromPhone }),
          },
        });
        logger.info(`[CloserAgent] Callback scheduled for ${prospect.businessName} in 10 min`);
      }
    }

    const reply = await this.generateSmsReply({
      message,
      prospect,
      agentName,
      niche,
      lang,
      trialUrl,
      firstName,
      wantsCallback,
    });

    if (reply) {
      await smsService.sendSMS(fromPhone, reply, {
        messageType: 'sms_closer_reply',
        prospectId,
      });
      logger.info(`[CloserAgent] Replied to inbound SMS from ${prospect.businessName}`);

      // Notify Discord with conversation snippet
      await discordService.notifyLeads(
        `💬 SMS REPLY CONVERSATION\n\nProspect: ${prospect.businessName}\nThey said: "${message.slice(0, 100)}"\nIntent: ${intent}\nWe replied: "${reply.slice(0, 100)}"`
      );
    }
  }

  private async generateSmsReply(params: {
    message: string;
    prospect: { businessName: string; interestLevel: number | null };
    agentName: string;
    niche: string;
    lang: 'en' | 'fr';
    trialUrl: string;
    firstName: string;
    wantsCallback?: boolean;
  }): Promise<string | null> {
    if (!env.OPENAI_API_KEY) return null;

    const { message, prospect, agentName, niche, lang, trialUrl, firstName, wantsCallback } = params;

    const callbackHint = wantsCallback
      ? (lang === 'fr'
        ? ' Le prospect veut être rappelé — propose-lui un rappel téléphonique dans les 10 prochaines minutes.'
        : ' The prospect wants a callback — offer them a phone callback in the next 10 minutes.')
      : '';

    const systemPrompt = lang === 'fr'
      ? `Tu es ${agentName}, agent commercial pour Qwillio (réceptionniste IA). Réponds au SMS du prospect (max 160 chars), de façon naturelle et humaine, avec un CTA si pertinent. Jamais de jargon. Répondre STOP pour se désinscrire si approprié.${callbackHint}`
      : `You are ${agentName}, a sales agent for Qwillio (AI receptionist). Reply to the prospect's SMS (max 160 chars), natural and human, with a CTA if relevant. No jargon. Add "Reply STOP to opt out" if relevant.${callbackHint}`;

    const userPrompt = lang === 'fr'
      ? `Prospect: ${prospect.businessName} (${niche})\nPrénom: ${firstName}\nLeur message: "${message}"\nLien essai: ${trialUrl}\n\nRéponds en 1 SMS max 160 chars.`
      : `Prospect: ${prospect.businessName} (${niche})\nFirst name: ${firstName}\nTheir message: "${message}"\nTrial link: ${trialUrl}\n\nReply in 1 SMS max 160 chars.`;

    try {
      const res = await fetch(this.OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 80,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return null;
      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      return data.choices?.[0]?.message?.content?.trim() ?? null;
    } catch {
      return null;
    }
  }
}

export const closerAgentService = new CloserAgentService();
