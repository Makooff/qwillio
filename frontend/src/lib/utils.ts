import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Le `cn` de shadcn: fusionne des classes conditionnelles, et fait gagner la
 * DERNIÈRE quand deux se contredisent (`px-4` puis `px-6` donne `px-6`).
 *
 * Il n'existait pas: trois fichiers portaient chacun leur propre version, dont
 * deux qui se contentaient de concaténer. La différence se paie sur les
 * composants qui acceptent un `className` de l'extérieur, comme celui du
 * carrousel: sans `twMerge`, la classe passée par l'appelant ne remplace pas
 * celle du composant, elles cohabitent et c'est l'ordre de la feuille qui
 * tranche, donc au hasard.
 *
 * `clsx` et `tailwind-merge` étaient déjà installés tous les deux.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
