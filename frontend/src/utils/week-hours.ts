/**
 * Les horaires hebdomadaires tels que le portail les édite et que le serveur
 * les lit (`vapiConfig.hours`, un objet jour par jour).
 *
 * Extrait de `ClientReceptionist` pour que le parcours guidé (13/09/2026)
 * édite exactement la même forme : deux éditeurs qui auraient chacun leur
 * copie du modèle finiraient par écrire deux formes, et l'agent n'en lit
 * qu'une (`utils/opening-hours.ts` côté serveur).
 */

export interface DayHours { open: boolean; from: string; to: string; }
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type WeekHours = Record<WeekDay, DayHours>;

export const DAYS: { k: WeekDay; l: string }[] = [
  { k: 'monday',    l: 'Lundi' },
  { k: 'tuesday',   l: 'Mardi' },
  { k: 'wednesday', l: 'Mercredi' },
  { k: 'thursday',  l: 'Jeudi' },
  { k: 'friday',    l: 'Vendredi' },
  { k: 'saturday',  l: 'Samedi' },
  { k: 'sunday',    l: 'Dimanche' },
];

/** Ce que le portail AFFICHE par défaut, et ce que l'agent suppose sans réglage: les deux disent la même chose. */
export const DEFAULT_HOURS: WeekHours = {
  monday:    { open: true,  from: '09:00', to: '18:00' },
  tuesday:   { open: true,  from: '09:00', to: '18:00' },
  wednesday: { open: true,  from: '09:00', to: '18:00' },
  thursday:  { open: true,  from: '09:00', to: '18:00' },
  friday:    { open: true,  from: '09:00', to: '18:00' },
  saturday:  { open: false, from: '10:00', to: '16:00' },
  sunday:    { open: false, from: '10:00', to: '16:00' },
};
