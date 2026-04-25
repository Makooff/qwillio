/**
 * Shared branded email template — solid Qwillio violet with subtle
 * orbs + frosted translucent card.  Inspired by the Sales Rep Guide
 * page but adapted for transactional emails (sober, no marketing
 * decorations, white-on-violet typography).
 *
 * Background:
 *   - Solid Qwillio violet base (#7B5CF0)
 *   - Two soft orb overlays (lighter violet on top, deeper violet
 *     bottom-right) painted via stacked radial-gradients.  Apple Mail
 *     and Gmail web honor multi-background; older Outlook falls back
 *     to the solid violet bgcolor.
 *
 * Card:
 *   - rgba(255,255,255,0.10) over the violet → reads as a frosted
 *     translucent panel everywhere, even without backdrop-filter
 *   - 1 px rgba(255,255,255,0.18) border, 16 px radius
 *   - backdrop-filter: blur(20px) is added for clients that support
 *     it (Apple Mail iOS 16+) — pure bonus
 *
 * Typography on violet:
 *   - Headings  : pure white #FFFFFF
 *   - Body      : rgba(255,255,255,0.85)
 *   - Muted     : rgba(255,255,255,0.62)
 */

const BRAND = {
  logoUrl:    'https://qwillio.com/icon-192.png',
  homeUrl:    'https://qwillio.com',
  supportUrl: 'mailto:contact@qwillio.com',
  // Base violet — same as the Sales Rep Guide page
  violet:     '#7B5CF0',
  violetDeep: '#5C3CE0',
  violetLite: '#9F86FF',
  // Text on the violet bg (kept as constants for the helpers)
  text:       '#FFFFFF',
  textSec:    'rgba(255,255,255,0.85)',
  textMuted:  'rgba(255,255,255,0.62)',
  // Translucent surfaces
  cardBg:     'rgba(255,255,255,0.10)',
  cardBorder: 'rgba(255,255,255,0.18)',
  highlightBg:     'rgba(255,255,255,0.07)',
  highlightBorder: 'rgba(255,255,255,0.14)',
};

/** Primary CTA — white pill on violet bg (high contrast). */
export function brandButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
      <tr>
        <td style="border-radius:12px;background:#FFFFFF;box-shadow:0 6px 20px rgba(0,0,0,0.18);">
          <a href="${url}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;color:${BRAND.violetDeep};font-size:14px;font-weight:600;text-decoration:none;border-radius:12px;letter-spacing:0.01em;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Subtle secondary action — text-only inline link. */
export function brandLink(label: string, url: string): string {
  return `<a href="${url}" style="color:#FFFFFF;font-weight:600;text-decoration:underline;">${label}</a>`;
}

/** Branded bullet list (white dots glowing on violet). */
export function brandList(items: string[]): string {
  return `<ul style="margin:16px 0;padding:0;list-style:none;">${
    items.map(it => `
      <li style="margin:0 0 12px 0;padding:0 0 0 24px;position:relative;font-size:15px;line-height:1.55;color:${BRAND.textSec};">
        <span style="position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:#FFFFFF;display:inline-block;box-shadow:0 0 10px rgba(255,255,255,0.65);"></span>
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

/** Inbox preview line. */
function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BRAND.violet};">${text}</div>`;
}

/**
 * Wrap arbitrary content HTML inside the branded shell (header logo,
 * frosted card, footer).  `body` is composed via the brand* helpers.
 */
export function brandWrap(opts: {
  title: string;
  preheader?: string;
  body: string;
  unsubscribeHtml?: string;
}): string {
  const { title, preheader: ph, body, unsubscribeHtml = '' } = opts;
  // Two soft brand orbs over the violet base — Apple Mail / Gmail web
  // render the multi-background; legacy clients fall back to bgcolor.
  const pageBg =
    `radial-gradient(circle at 88% 14%, rgba(255,255,255,0.22), transparent 35%),` +
    `radial-gradient(circle at 8% 88%, rgba(255,255,255,0.16), transparent 38%),` +
    `${BRAND.violet}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.violet};font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;color:${BRAND.text};-webkit-font-smoothing:antialiased;">
  ${ph ? preheader(ph) : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.violet}" style="background:${pageBg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <!-- Brand header -->
          <tr>
            <td style="padding:0 0 24px 0;text-align:center;">
              <img src="${BRAND.logoUrl}" alt="Qwillio" width="40" height="40" style="border-radius:10px;display:inline-block;vertical-align:middle;border:0;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.01em;margin-left:10px;vertical-align:middle;color:${BRAND.text};">Qwillio</span>
            </td>
          </tr>
          <!-- Frosted glass card -->
          <tr>
            <td style="background:${BRAND.cardBg};border:1px solid ${BRAND.cardBorder};border-radius:16px;padding:40px 36px;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 8px 8px 8px;text-align:center;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};line-height:1.6;">
                Qwillio — AI receptionist for service businesses<br>
                <a href="${BRAND.homeUrl}" style="color:${BRAND.textMuted};text-decoration:underline;">qwillio.com</a>
                · <a href="${BRAND.supportUrl}" style="color:${BRAND.textMuted};text-decoration:underline;">contact@qwillio.com</a>
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
