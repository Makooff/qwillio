/**
 * La période de facturation choisie sur la page tarifs.
 *
 * Elle est choisie à un bout du tunnel (Tarifs) et consommée à l'autre
 * (Souscription), avec une inscription et une confirmation d'adresse entre les
 * deux. La porter dans l'URL de bout en bout obligerait chaque écran
 * intermédiaire à la relayer, et il suffirait d'un lien oublié pour que le
 * client reparte en mensuel sans le savoir. Elle est donc capturée une fois,
 * depuis l'URL, et rangée dans le `sessionStorage`: elle survit aux étapes,
 * pas à la fermeture de l'onglet.
 *
 * Le défaut est TOUJOURS mensuel: sur une valeur inattendue, on prélève moins
 * souvent, jamais douze mois d'un coup par accident.
 */

export type BillingPeriod = 'monthly' | 'annual';

const KEY = 'qwillio.billingPeriod';

/** À appeler sur les écrans d'entrée du tunnel, avec `location.search`. */
export function captureBillingPeriod(search: string): void {
  try {
    const value = new URLSearchParams(search).get('billing');
    if (value === 'annual' || value === 'monthly') sessionStorage.setItem(KEY, value);
  } catch {
    /* sessionStorage indisponible (navigation privée stricte): on retombe sur
       le mensuel, ce qui est le comportement voulu. */
  }
}

export function readBillingPeriod(): BillingPeriod {
  try {
    return sessionStorage.getItem(KEY) === 'annual' ? 'annual' : 'monthly';
  } catch {
    return 'monthly';
  }
}

export function clearBillingPeriod(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* rien à nettoyer si le stockage est refusé */
  }
}
