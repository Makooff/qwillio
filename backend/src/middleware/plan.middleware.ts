import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { planAllows, lowestPlanFor, type PlanCapability } from '../config/plan-features';

/**
 * Le forfait comme condition d'accès, appliquée par le serveur.
 *
 * Pourquoi ce fichier existe: la page tarifs vendait « Analytiques avancées » et
 * « Intégrations CRM natives » à partir de Pro, alors que rien dans le code ne
 * les réservait. Un client Solo à 99 € recevait donc exactement ce qu'un client
 * Pro paie 599 €, et l'échelle de prix n'avait qu'un seul barreau réel, le
 * volume de minutes.
 *
 * Le contrôle vit ici et pas dans l'écran: masquer un menu n'est pas une
 * restriction, c'est une décoration. L'API est la seule frontière qui compte.
 */
export function requireCapability(capability: PlanCapability) {
  return async (req: any, res: Response, next: NextFunction) => {
    // `clientMiddleware` a déjà posé `clientId`; sans lui cette porte n'a pas
    // de sens et se referme plutôt que de laisser passer.
    const clientId = req.clientId as string | undefined;
    if (!clientId) return res.status(403).json({ error: 'no_client' });

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { planType: true },
    });

    if (!client || !planAllows(client.planType, capability)) {
      /* Le palier requis voyage dans la réponse: l'écran peut alors proposer
         la montée de forfait au lieu d'afficher « accès refusé », qui est un
         cul-de-sac commercial. */
      return res.status(403).json({
        error: 'plan_required',
        capability,
        requiredPlan: lowestPlanFor(capability),
      });
    }

    next();
  };
}
