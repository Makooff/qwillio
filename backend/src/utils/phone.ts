/**
 * E.164 normalisation, country-aware.
 *
 * Lived in `apify-scraping.service` and was only reachable by importing a
 * scraping module. The voice path needs it too — Vapi refuses an assistant
 * whose transfer destination is not E.164 ("must be a valid phone number"),
 * and a client's transfer number is typed by hand into a settings field, so it
 * arrives as "06 12 34 56 78" as often as "+33612345678".
 *
 * The country is what allows a Belgian or French national format to become
 * +32/+33 rather than being wrongly prefixed with the US +1.
 */

const COUNTRY_CALLING_CODE: Record<string, string> = { BE: '32', FR: '33', US: '1' };

export function toE164(raw: string | null | undefined, country?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const cc = country ? COUNTRY_CALLING_CODE[country.toUpperCase()] : undefined;

  // Already international: leading "+" or "00" — trust the country code in it.
  const allDigits = s.replace(/\D/g, '');
  if (s.startsWith('+')) {
    return allDigits.length >= 8 && allDigits.length <= 15 ? `+${allDigits}` : null;
  }
  if (allDigits.startsWith('00')) {
    const intl = allDigits.slice(2);
    return intl.length >= 8 && intl.length <= 15 ? `+${intl}` : null;
  }

  let digits = allDigits;
  if (!digits) return null;

  if (country?.toUpperCase() === 'US') {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return null;
  }

  if (cc) {
    // BE/FR national format: strip a single national leading 0, prepend the code.
    if (digits.startsWith('0')) digits = digits.slice(1);
    return digits.length >= 8 && digits.length <= 12 ? `+${cc}${digits}` : null;
  }

  // Unknown country and no international prefix: only trust a long number that
  // already carries a country code. Never guess +1 on an ambiguous national one.
  return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : null;
}
