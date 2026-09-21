import type { LeadForAlert } from './lead-alert.service';
import { isPlaceholderName } from '../../utils/spelled-name';

/**
 * RATTRAPER UNE PROMESSE QUE LE MODÈLE N'A PAS TENUE (20/09/2026).
 *
 * ── Le défaut, relevé TROIS fois sur des appels réels ──────────────────────
 *
 * « Je note votre demande et je transmets à l'équipe pour qu'ils vous
 * recontactent », sans un seul appel à `captureLead` (16/09, deux fois, puis
 * 18/09 où l'appelant accepte explicitement de laisser ses coordonnées).
 * Rien n'est noté, personne ne rappelle, et l'appelant raccroche RASSURÉ.
 * C'est le défaut le plus coûteux du produit: il ne se voit pas, il ne
 * produit aucune erreur, et il perd un client à chaque occurrence.
 *
 * ── Pourquoi la règle de prompt n'a pas suffi ──────────────────────────────
 *
 * « Promettre un rappel EXIGE captureLead » est dans le prompt depuis le
 * 16/09, dans les trois langues. Le modèle l'a enfreinte deux fois depuis.
 * Une consigne est une probabilité, pas une garantie, et ce dépôt a déjà payé
 * ce constat sur le nom, sur l'heure et sur le jour de la semaine: **ce qui
 * doit arriver à coup sûr ne se demande pas au modèle, il se pose dans le
 * code.**
 *
 * Le prompt reste: il fait faire le geste au bon moment, PENDANT l'appel, avec
 * le numéro relu à voix haute. Ceci est le filet, pas son remplacement.
 *
 * ── Ce que le filet exige, et pourquoi il refuse parfois ───────────────────
 *
 * Un lead de rattrapage n'a de valeur que si quelqu'un peut RAPPELER. Sans
 * numéro ni courriel, en fabriquer un donnerait au gérant une fiche vide et
 * une tâche impossible, ce qui est pire que rien: il croirait pouvoir agir.
 * On refuse alors, et l'appelant en numéro masqué est nommé dans le journal
 * plutôt qu'écarté en silence (6nonies).
 *
 * Un rendez-vous PRIS vaut absence de promesse: l'appelant repart avec ce
 * qu'il venait chercher, il n'attend aucun rappel.
 */

/** Ce que l'analyse post-appel doit fournir pour qu'un rattrapage soit possible. */
export interface PromiseFacts {
  /** Le modèle d'analyse a lu une promesse de rappel dans le transcript. */
  callbackPromised?: boolean;
  callerName?: string | null;
  emailCollected?: string | null;
  summary?: string | null;
  tags?: string[] | null;
}

export interface RescueInput {
  analysis: PromiseFacts;
  /** Le numéro de la ligne appelante, absent quand il est masqué. */
  callerNumber: string | null;
  /** `captureLead` a-t-il déjà écrit un lead pendant l'appel. */
  hasLiveLead: boolean;
  /** Un rendez-vous a-t-il été pris pendant l'appel. */
  hasBooking: boolean;
}

export type RescueOutcome =
  | { rescued: true; lead: LeadForAlert }
  /** `why` nomme la raison, parce qu'un refus silencieux est un défaut en soi. */
  | { rescued: false; why: 'no_promise' | 'already_captured' | 'booked' | 'unreachable' };

/**
 * L'urgence, depuis les étiquettes de l'analyse.
 *
 * Le modèle ne rend pas de champ d'urgence: `tags` est ce qu'il produit
 * vraiment, et « urgent » y figure dans la liste que sa consigne lui donne.
 * Lire le champ qui EXISTE plutôt qu'en réclamer un nouveau évite d'ajouter
 * une sortie que rien ne vérifie.
 */
export function urgencyFromTags(tags: string[] | null | undefined): string {
  const flat = (tags ?? []).map(t => String(t).toLowerCase());
  if (flat.some(t => t.includes('urgent') || t.includes('complaint'))) return 'high';
  return 'normal';
}

export function rescuePromise(input: RescueInput): RescueOutcome {
  if (!input.analysis.callbackPromised) return { rescued: false, why: 'no_promise' };
  /* L'ordre compte: un lead déjà capté n'est pas un échec du modèle, c'est le
     chemin normal, et le redire ferait deux alertes pour un appel. */
  if (input.hasLiveLead) return { rescued: false, why: 'already_captured' };
  if (input.hasBooking) return { rescued: false, why: 'booked' };

  const email = typeof input.analysis.emailCollected === 'string'
    ? input.analysis.emailCollected.trim() || null
    : null;
  const phone = input.callerNumber?.trim() || null;
  /* SANS MOYEN DE RAPPELER, on ne fabrique rien. Une fiche que le gérant ne
     peut pas honorer lui fait croire qu'il le peut. */
  if (!phone && !email) return { rescued: false, why: 'unreachable' };

  /* Un nom de remplissage n'entre pas dans le CRM: c'est la règle déjà posée
     sur `captureLead` (6quadragesies), et un « client » ou un « Monsieur »
     resterait affiché comme le nom de quelqu'un. */
  const raw = typeof input.analysis.callerName === 'string' ? input.analysis.callerName.trim() : '';
  const name = raw && !isPlaceholderName(raw) ? raw : null;

  return {
    rescued: true,
    lead: {
      name,
      email,
      phone,
      /* Le résumé est déjà écrit dans la LANGUE DU CLIENT par l'analyse
         (6trigesies): le gérant lit sa langue, pas celle de l'appelant. */
      reason: (input.analysis.summary ?? '').trim() || 'Rappel promis pendant l\'appel.',
      urgency: urgencyFromTags(input.analysis.tags),
    },
  };
}
