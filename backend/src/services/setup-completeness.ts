import { knowledgePreset } from '../config/knowledge-presets';
import { resolveNiche, type NicheId } from '../config/niches';

/**
 * Ce que la réceptionniste SAIT, mesuré par métier.
 *
 * Retour du 13/09/2026 : « le compte est activable avec peu d'informations,
 * j'ai peur que l'IA invente ». L'inscription en libre-service ne demande
 * que le nom, le secteur, un site et un téléphone ; les champs nommés du
 * métier (mutuelles, urgences, annulation…) ne sont remplis que si le client
 * va les chercher dans Réceptionniste, et le bandeau « Démarrer » cochait
 * « Personnaliser » dès qu'un seul service ou horaire existait.
 *
 * Ce module dit combien il manque, et QUOI en premier. La liste vient du
 * preset du métier (`knowledge-presets`), la même table que le formulaire et
 * que le prompt : ce qu'on demande ici est exactement ce que l'agent lira.
 *
 * Les poids ne sont pas décoratifs. Le numéro de transfert pèse trois fois
 * un champ de préset : sans lui, un appelant qui veut un humain n'a personne.
 * Les horaires pèsent deux : sans eux l'agent propose un rendez-vous un jour
 * fermé (appel réel, 12/09). Les trois champs qui protègent l'appelant
 * (urgence, annulation, mutuelles) pèsent deux, le reste un.
 */

export interface SetupItem {
  /** `transferNumber`, `hours`, `services`, `faq`, ou `field:<id du preset>`. */
  id: string;
  label: string;
  /** Un exemple rempli ou la raison, à afficher sous le libellé. */
  hint: string;
  done: boolean;
  weight: number;
  /** Où compléter. Le parcours guidé pour ce qu'il sait poser, la fiche sinon. */
  to: string;
}

export interface SetupCompleteness {
  /** 0 à 100, pondéré. */
  score: number;
  done: number;
  total: number;
  /** Ce qui manque, le plus lourd d'abord, puis dans l'ordre du preset. */
  missing: SetupItem[];
  /** Questions d'appelants restées sans réponse (`knowledge_gaps` ouverts). */
  openGaps: number;
  niche: NicheId;
}

export interface SetupSource {
  businessType: string | null | undefined;
  transferNumber: string | null | undefined;
  vapiConfig: unknown;
}

const HEAVY_FIELDS = new Set(['emergencyProtocol', 'cancellationPolicy', 'insuranceAccepted']);
const GUIDE = '/dashboard/setup/guide';

function nonEmpty(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

export function setupItems(source: SetupSource): SetupItem[] {
  const cfg = (source.vapiConfig && typeof source.vapiConfig === 'object' && !Array.isArray(source.vapiConfig)
    ? source.vapiConfig
    : {}) as Record<string, unknown>;
  const preset = knowledgePreset(source.businessType);
  const knowledge = (cfg.knowledge && typeof cfg.knowledge === 'object' ? cfg.knowledge : {}) as Record<string, unknown>;
  const items = Array.isArray(cfg.items) ? cfg.items : [];
  const faqEntries = Array.isArray(cfg.faqEntries) ? cfg.faqEntries : [];

  const list: SetupItem[] = [
    {
      id: 'transferNumber',
      label: 'Vers qui transférer un appel',
      hint: 'Sans ce numéro, un appelant qui demande un humain n\'a personne.',
      done: nonEmpty(source.transferNumber),
      weight: 3,
      to: `${GUIDE}?step=transferNumber`,
    },
    {
      id: 'hours',
      label: 'Vos horaires d\'ouverture',
      hint: 'Sans eux, l\'agent propose un rendez-vous un jour fermé.',
      done: !!cfg.hours && typeof cfg.hours === 'object' && !Array.isArray(cfg.hours),
      weight: 2,
      to: `${GUIDE}?step=hours`,
    },
    {
      id: 'services',
      label: 'Vos services et tarifs',
      hint: 'Ce que l\'agent peut proposer et à quel prix.',
      done: items.some(i => i && typeof i === 'object' && nonEmpty((i as Record<string, unknown>).name)),
      weight: 2,
      to: '/dashboard/receptionist#connaissances',
    },
    ...preset.fields.map(f => ({
      id: `field:${f.id}`,
      label: f.label,
      hint: f.placeholder,
      done: nonEmpty(knowledge[f.id]),
      weight: HEAVY_FIELDS.has(f.id) ? 2 : 1,
      to: `${GUIDE}?step=field:${f.id}`,
    })),
    {
      id: 'faq',
      label: 'Les questions qu\'on vous pose le plus',
      hint: 'Au moins une question avec sa réponse.',
      done: faqEntries.some(e => e && typeof e === 'object' && nonEmpty((e as Record<string, unknown>).q)) || nonEmpty(cfg.faq),
      weight: 1,
      to: `${GUIDE}?step=faq`,
    },
  ];
  return list;
}

export function setupCompleteness(source: SetupSource, openGaps = 0): SetupCompleteness {
  const items = setupItems(source);
  const total = items.reduce((s, i) => s + i.weight, 0);
  const done = items.filter(i => i.done).reduce((s, i) => s + i.weight, 0);
  const missing = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.done)
    /* Le plus lourd d'abord ; à poids égal, l'ordre du preset, qui est celui
       des questions les plus fréquentes du métier. Un tri stable ne suffit
       pas à le garantir sur tous les moteurs, d'où l'index. */
    .sort((a, b) => b.item.weight - a.item.weight || a.index - b.index)
    .map(({ item }) => item);
  return {
    score: total ? Math.round((100 * done) / total) : 100,
    done: items.filter(i => i.done).length,
    total: items.length,
    missing,
    openGaps: Math.max(0, openGaps | 0),
    niche: resolveNiche(source.businessType),
  };
}
