/**
 * Le numéro qu'un appelant DICTE, validé avant d'être cru (BEL-2, BEL-3).
 *
 * ── L'ordre de grandeur du problème ────────────────────────────────────────
 *
 * Sur de la parole générale, les transcripteurs commerciaux sont à 95-99 % de
 * précision. Sur une séquence structurée — un numéro, une plaque, un code — ils
 * tombent entre 43 et 58 %. Un numéro capté sans contrôle est donc faux une
 * fois sur deux, et le seul moment où l'erreur coûte encore peu est AVANT de le
 * relire à l'appelant.
 *
 * ── Pourquoi libphonenumber, et pas des gabarits écrits ici ────────────────
 *
 * Le plan demandait des gabarits belges: fixes à neuf chiffres groupés
 * `02 512 34 56` à Bruxelles, `081 xx xx xx` à Namur, mobiles à dix en `04xx`.
 * Les écrire à la main, c'est reproduire une table que Google tient déjà à jour
 * pour tous les pays, y compris les préfixes ouverts l'an prochain. On importe
 * donc la métadonnée COMPLÈTE (`/max`) et non la version réduite: cette
 * dernière valide sur la seule longueur, et accepte `045123456` — nettement
 * plus court qu'un mobile belge — comme un numéro correct.
 *
 * ── Ce que ce module rend ──────────────────────────────────────────────────
 *
 * Soit un numéro en E.164, soit une raison de redemander. Jamais un numéro
 * « probable »: un chiffre faux dans un rappel vaut un lead perdu, et le lead
 * perdu ne se voit nulle part.
 *
 * ── L'ambiguïté qu'aucun code ne lèvera ────────────────────────────────────
 *
 * `0475 12 34 56` est un mobile belge ET un fixe français du Sud-Est, tous deux
 * parfaitement valides. Aucune analyse du numéro ne tranche, parce qu'il n'y a
 * rien à trancher: la séquence appartient aux deux plans de numérotation. Seul
 * le CONTEXTE décide, et on l'essaie dans l'ordre où il est le plus fiable:
 * le pays de l'appelant (lu sur sa propre ligne), puis celui du commerce, puis
 * la Belgique et la France. C'est aussi pour ça que le numéro est relu à
 * l'appelant: la relecture est la seule chose qui lève une ambiguïté que la
 * machine ne peut pas voir.
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { spokenDigits } from './spoken-numbers';

export type SpokenPhoneResult =
  | {
      ok: true;
      /** `+32475123456`, la forme qu'on stocke et qu'on compose. */
      e164: string;
      /** `0475 12 34 56`, la forme qu'on relit à l'appelant. */
      national: string;
      kind: 'mobile' | 'fixed' | 'other';
      country: string;
    }
  | {
      ok: false;
      /** `no_digits`: rien de dicté. `invalid`: des chiffres, pas un numéro. */
      reason: 'no_digits' | 'invalid';
      /** Ce qu'on a entendu, pour le journal — jamais pour la base. */
      digits: string;
    };

/** L'ordre d'essai. La Belgique d'abord: c'est le marché où l'on joue à domicile. */
const DEFAULT_REGIONS = ['BE', 'FR'] as const;

function kindOf(type: string | undefined): 'mobile' | 'fixed' | 'other' {
  if (type === 'MOBILE') return 'mobile';
  if (type === 'FIXED_LINE' || type === 'FIXED_LINE_OR_MOBILE') return 'fixed';
  return 'other';
}

/**
 * Lire un numéro dicté, en toutes lettres ou en chiffres.
 *
 * @param raw     Ce que l'appelant a dit, tel que le transcripteur l'a rendu.
 * @param opts.callerNumber La ligne DEPUIS laquelle il appelle, en E.164. Le
 *   meilleur indice disponible sur son plan de numérotation, et le seul qui ne
 *   vienne pas d'une supposition: quelqu'un qui appelle d'un +32 et dicte un
 *   numéro dicte presque toujours un numéro belge.
 * @param opts.country Le pays du CLIENT, essayé ensuite: un commerce français
 *   reçoit surtout des numéros français, et l'inverse pour un belge.
 */
export function parseSpokenPhone(
  raw: string,
  opts: { country?: string | null; callerNumber?: string | null } = {},
): SpokenPhoneResult {
  const digits = spokenDigits(raw ?? '');
  if (!digits) return { ok: false, reason: 'no_digits', digits: '' };

  /* Un indicatif international se dit « plus trente-deux » ou « zéro zéro
     trente-deux ». Sans cette reconnaissance, `32475123456` serait lu comme un
     numéro national belge, et rejeté alors qu'il est parfaitement valide. */
  const international = /(^|\s)(\+|plus)\s*\d|^00\d/.test(raw) || digits.startsWith('00');
  const candidates: string[] = [];
  if (international) candidates.push(`+${digits.replace(/^00/, '')}`);
  candidates.push(digits);

  /* Du plus fiable au moins fiable, sans doublon. La ligne de l'appelant passe
     avant le pays du commerce: c'est un fait observé contre une probabilité. */
  const fromCaller = opts.callerNumber
    ? parsePhoneNumberFromString(opts.callerNumber)?.country ?? null
    : null;
  const preferred = [fromCaller, (opts.country || '').toUpperCase()]
    .filter((c): c is string => !!c && DEFAULT_REGIONS.includes(c as 'BE' | 'FR'));
  const regions = [...new Set([...preferred, ...DEFAULT_REGIONS])];

  for (const candidate of candidates) {
    for (const region of regions) {
      const parsed = parsePhoneNumberFromString(candidate, region as 'BE' | 'FR');
      if (parsed?.isValid()) {
        return {
          ok: true,
          e164: parsed.number,
          national: parsed.formatNational(),
          kind: kindOf(parsed.getType()),
          country: parsed.country ?? region,
        };
      }
    }
  }

  return { ok: false, reason: 'invalid', digits };
}
