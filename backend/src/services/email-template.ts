/**
 * Shared branded email template — diagonal gradient (white top-left →
 * Qwillio violet bottom-right) with a frosted translucent card.
 *
 * Background: linear-gradient(135deg) from white through pale lavender
 * to deep Qwillio violet so the top of the message reads as bright /
 * inviting and the bottom carries the brand color.  A subtle orb in
 * the violet half adds depth (radial-gradient, multi-background).
 *
 * Card: rgba(255,255,255,0.62) with violet-tinted border — sits on top
 * of the gradient and reads as frosted glass everywhere.  Apple Mail
 * iOS 16+ also gets a real backdrop-filter:blur(24px).
 *
 * Typography is back to dark (#0B0B0D / #2C2C30 / #86868B) since the
 * card is light.
 */

const BRAND = {
  logoUrl:    'https://qwillio.com/icon-192.png',
  homeUrl:    'https://qwillio.com',
  supportUrl: 'mailto:contact@qwillio.com',
  // Brand violets
  violet:     '#7B5CF0',
  violetDeep: '#5C3CE0',
  violetLite: '#9F86FF',
  // Text on the (translucent white) card
  text:       '#0B0B0D',
  textSec:    '#2C2C30',
  textMuted:  '#86868B',
  // Wordmark on the white area of the gradient
  wordmark:   '#1A0A2E',
  // Translucent surfaces
  cardBg:     'rgba(255,255,255,0.62)',
  cardBorder: 'rgba(123,92,240,0.18)',
  highlightBg:     '#FAFAFC',
  highlightBorder: '#EAEAEC',
};

/** Primary CTA — gradient violet pill with white text. */
export function brandButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
      <tr>
        <td style="border-radius:12px;background:linear-gradient(135deg,${BRAND.violetLite} 0%,${BRAND.violet} 50%,${BRAND.violetDeep} 100%);box-shadow:0 8px 24px rgba(123,92,240,0.40);">
          <a href="${url}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:12px;letter-spacing:0.01em;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Subtle secondary action — text-only link in brand violet. */
export function brandLink(label: string, url: string): string {
  return `<a href="${url}" style="color:${BRAND.violet};font-weight:600;text-decoration:underline;">${label}</a>`;
}

/** Branded bullet list (gradient dot markers). */
export function brandList(items: string[]): string {
  return `<ul style="margin:16px 0;padding:0;list-style:none;">${
    items.map(it => `
      <li style="margin:0 0 12px 0;padding:0 0 0 24px;position:relative;font-size:15px;line-height:1.55;color:${BRAND.textSec};">
        <span style="position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:linear-gradient(135deg,${BRAND.violetLite} 0%,${BRAND.violetDeep} 100%);display:inline-block;box-shadow:0 0 8px rgba(123,92,240,0.45);"></span>
        ${it}
      </li>`).join('')
  }</ul>`;
}

/** Muted helper paragraph. */
export function brandSmall(html: string): string {
  return `<p style="margin:18px 0 0 0;font-size:12.5px;line-height:1.55;color:${BRAND.textMuted};">${html}</p>`;
}

/** H1 inside the card. */
export function brandTitle(text: string): string {
  return `<h1 style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.text};line-height:1.25;">${text}</h1>`;
}

/** Body paragraph. */
export function brandText(html: string): string {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.textSec};">${html}</p>`;
}

/** Inbox preview line — invisible but extracted by Gmail / Apple Mail. */
function preheader(text: string): string {
  return `<div style="display:none !important;visibility:hidden;mso-hide:all;max-height:0;max-width:0;opacity:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">${text}</div>
  <div style="display:none !important;font-size:1px;line-height:1px;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>`;
}

/**
 * Wrap arbitrary content HTML inside the branded shell (header logo,
 * frosted card, footer).
 */
export function brandWrap(opts: {
  title: string;
  preheader?: string;
  body: string;
  unsubscribeHtml?: string;
}): string {
  const { title, preheader: ph, body, unsubscribeHtml = '' } = opts;
  // Diagonal gradient white → violet, with two clearly visible orbs
  // matching the Sales Rep Guide style: a large pale-lavender circle
  // sitting in the white half (top-left) and a bigger lighter-violet
  // circle in the violet half (bottom-right). Sharp transitions so
  // they read as filled circles, not soft gradients.
  const pageBg =
    `radial-gradient(circle at 88% 92%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.55) 14%, rgba(255,255,255,0) 32%),` +
    `radial-gradient(circle at 12% 10%, rgba(196,181,253,0.55) 0%, rgba(196,181,253,0.55) 14%, rgba(196,181,253,0) 32%),` +
    `linear-gradient(135deg, #FFFFFF 0%, #F5F0FF 22%, #C4B5FD 58%, ${BRAND.violet} 100%)`;
  const fallbackBg = '#F5F0FF';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${fallbackBg};font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;color:${BRAND.text};-webkit-font-smoothing:antialiased;">
  ${ph ? preheader(ph) : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${fallbackBg}" style="background:${pageBg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <!-- Brand header — top-left, dark on the white area of the gradient -->
          <tr>
            <td style="padding:0 4px 24px 4px;text-align:left;">
              <img src="${BRAND.logoUrl}" alt="Qwillio" width="36" height="36" style="border-radius:9px;display:inline-block;vertical-align:middle;border:0;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.01em;margin-left:10px;vertical-align:middle;color:${BRAND.wordmark};">Qwillio</span>
            </td>
          </tr>
          <!-- Frosted glass card -->
          <tr>
            <td style="background:${BRAND.cardBg};border:1px solid ${BRAND.cardBorder};border-radius:16px;padding:40px 36px;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 8px 32px rgba(123,92,240,0.18);">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 4px 8px 4px;text-align:left;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.78);line-height:1.6;">
                Qwillio — AI receptionist for service businesses<br>
                <a href="${BRAND.homeUrl}" style="color:rgba(255,255,255,0.78);text-decoration:underline;">qwillio.com</a>
                · <a href="${BRAND.supportUrl}" style="color:rgba(255,255,255,0.78);text-decoration:underline;">contact@qwillio.com</a>
              </p>
              ${unsubscribeHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const BRAND_COLORS = BRAND;
