import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { CONSENT_STATEMENTS, type ConsentLocale } from '../config/consent-statements';
import { toE164 } from '../utils/phone';

/**
 * Demande publique de rappel — la porte d'entrée du registre de consentement.
 *
 * Depuis le 11/08/2026, appeler un numéro français exige un consentement
 * préalable dont la preuve nous incombe. `CallConsent` savait le stocker, mais
 * rien ne le remplissait hors administration: le registre restait vide, donc
 * la France restait muette. Ce formulaire est le chemin normal.
 *
 * Trois choix qui portent la valeur probante:
 *
 *  1. **Le libellé accepté est figé côté serveur**, jamais repris du corps de
 *     la requête. Un texte envoyé par le navigateur pourrait être n'importe
 *     quoi, et on prouverait alors un consentement à un texte qu'on aurait
 *     soi-même fabriqué après coup. Le client envoie une CLÉ, on enregistre le
 *     texte que cette clé désigne.
 *  2. **La case doit être cochée explicitement.** Pas de case pré-cochée, pas
 *     de consentement déduit de l'envoi du formulaire: le RGPD exige un acte
 *     positif clair, et une case pré-cochée n'en est pas un.
 *  3. **L'IP et l'horodatage sont capturés**, parce que « libre, spécifique,
 *     éclairé » se prouve par un faisceau, pas par une ligne booléenne.
 */

const callbackLimiter = rateLimit({
  windowMs: 60 * 60_000,
  // Huit demandes par heure et par IP: une personne réelle en fait une. Le
  // plafond existe contre le remplissage automatisé du registre, qui
  // fabriquerait des consentements pour des numéros tiers.
  max: 8,
  keyGenerator: (req: Request) => req.ip || 'unknown',
  message: { error: 'rate_limited' },
  standardHeaders: true,
  legacyHeaders: false,
  /* Neutralisé sous test: les cas partagent une même IP, et le neuvième
     tombait en 429 au lieu d'exercer la règle qu'il visait. Le comportement du
     limiteur relève de la bibliothèque, pas de ce que ces tests protègent. */
  skip: () => process.env.NODE_ENV === 'test',
});

const router = Router();

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

router.post('/callback-request', callbackLimiter, async (req: Request, res: Response) => {
  try {
    const name = clean(req.body?.name, 120);
    const businessName = clean(req.body?.businessName, 200);
    const locale = (clean(req.body?.locale, 5) || 'fr') as ConsentLocale;
    const country = clean(req.body?.country, 2).toUpperCase();
    const consentGiven = req.body?.consent === true;

    /* Normalisation par `toE164`, l'utilitaire du dépôt, plutôt qu'une regex
       maison. Il connaît les formats nationaux belge et français, donc un
       visiteur peut taper « 0470 12 34 56 » comme « +32470123456 », et il
       refuse un numéro trop court — ma première version acceptait
       « +32 470 12 », que la suppression des espaces transformait en un
       « +3247012 » d'apparence valide. */
    const phone = toE164(clean(req.body?.phone, 32), country || null);

    if (!phone) {
      return res.status(400).json({
        error: 'invalid_phone',
        message: 'Numéro incomplet. Exemple : +32 470 12 34 56.',
      });
    }
    if (!consentGiven) {
      // Sans acte positif, il n'y a rien à enregistrer. On ne crée surtout pas
      // un consentement « implicite » parce que le formulaire a été envoyé.
      return res.status(400).json({ error: 'consent_required' });
    }

    const statement = CONSENT_STATEMENTS[locale] ?? CONSENT_STATEMENTS.fr;
    const countryCode = phone.startsWith('+33') ? 'FR' : phone.startsWith('+32') ? 'BE' : 'XX';

    const { callConsentService } = await import('../services/call-consent.service');
    const recorded = await callConsentService.record({
      phone,
      countryCode,
      source: 'web_form',
      statement,
      ipAddress: (req.ip || '').slice(0, 64) || null,
      evidenceUrl: null,
      // Un consentement sans terme se périme mal. Deux ans est la borne
      // retenue: assez long pour être utile, assez court pour qu'on ne
      // rappelle pas quelqu'un sur la foi d'un clic oublié depuis longtemps.
      expiresAt: new Date(Date.now() + 2 * 365 * 24 * 60 * 60_000),
    });

    if ('error' in recorded) {
      return res.status(400).json(recorded);
    }

    /* Le prospect n'est créé que s'il n'existe pas: un formulaire public ne
       doit pas pouvoir écraser une fiche déjà travaillée par un commercial,
       ni remettre à zéro un statut. */
    const existing = await prisma.prospect.findFirst({ where: { phone }, select: { id: true } });
    if (!existing) {
      await prisma.prospect.create({
        data: {
          businessName: businessName || name || 'Demande de rappel',
          businessType: 'inbound_request',
          country: countryCode === 'XX' ? 'BE' : countryCode,
          phone,
          contactName: name || null,
          status: 'new',
          notes: 'Rappel demandé via le formulaire public (consentement enregistré).',
        },
      });
    }

    logger.info(`[Callback] demande de rappel enregistrée pour ${phone} (${countryCode})`);
    // On ne renvoie ni l'id du consentement ni celui du prospect: cette route
    // est publique, elle n'a pas à devenir un moyen de sonder la base.
    return res.status(201).json({ ok: true, recordedAt: recorded.collectedAt });
  } catch (error) {
    logger.error(`[Callback] échec: ${(error as Error).message}`);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
