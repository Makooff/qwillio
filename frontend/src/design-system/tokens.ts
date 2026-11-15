/** Foundations partagées. Ajouter une valeur sémantique ici plutôt qu'une nouvelle palette locale. */
import data from './tokens.json';
type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export const tokens: DeepReadonly<typeof data> = data;
export const radiusPx = (value: keyof typeof data.radius): string => `${data.radius[value]}px`;
