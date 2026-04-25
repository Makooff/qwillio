/**
 * Shared branded email template — Qwillio logo + colors, Stripe/Apple
 * minimalist style. Every transactional email funnels through `brandWrap`.
 *
 * Style choices:
 *   - Off-white page background (#F5F5F7) — Apple Mail / Gmail dark mode safe
 *   - Single white card with soft shadow + 16 px radius
 *   - SF system font stack with -webkit-font-smoothing
 *   - Single brand accent: blue → violet linear gradient (#7D7CFB → #A855F7)
 *   - Logo: hosted PNG at the qwillio.com root (192 px, served by Vercel)
 */

const BRAND = {
  logoUrl:    'https://qwillio.com/icon-192.png',
  homeUrl:    'https://qwillio.com',
  supportUrl: 'mailto:contact@qwillio.com',
  // Gradient stops (used inline via linear-gradient)
  blue:       '#7D7CFB',
  violet:     '#A855F7',
  // Text
  text:       '#0B0B0D',
  textSec:    '#2C2C30',
  textMuted:  '#86868B',
  // Surfaces
  bg:         '#F5F5F7',
  card:       '#FFFFFF',
};

/** A primary CTA button. Email-client safe (table-based, inline styles). */
export function brandButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
      <tr>
        <td style="border-radius:12px;background:linear-gradient(135deg,${BRAND.blue} 0%,${BRAND.violet} 100%);">
          <a href="${url}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:12px;letter-spacing:0.01em;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

/** A subtle secondary action — text-only link in brand color. */
export function brandLink(label: string, url: string): string {
  return `<a href="${url}" style="color:${BRAND.violet};font-weight:500;text-decoration:none;">${label}</a>`;
}

/** Ordered list / unordered list helpers — Apple-style bullet rows. */
export function brandList(items: string[]): string {
  return `<ul style="margin:16px 0;padding:0;list-style:none;">${
    items.map(it => `
      <li style="margin:0 0 12px 0;padding:0 0 0 24px;position:relative;font-size:15px;line-height:1.55;color:${BRAND.textSec};">
        <span style="position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:linear-gradient(135deg,${BRAND.blue} 0%,${BRAND.violet} 100%);display:inline-block;"></span>
        ${it}
      </li>`).join('')
  }</ul>`;
}

/** A small dim helper paragraph (e.g. legal / fine print). */
export function brandSmall(html: string): string {
  return `<p style="margin:18px 0 0 0;font-size:12.5px;line-height:1.55;color:${BRAND.textMuted};">${html}</p>`;
}

/** A heading — H1 inside the card. */
export function brandTitle(text: string): string {
  return `<h1 style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.text};line-height:1.25;">${text}</h1>`;
}

/** A paragraph — body copy. */
export function brandText(html: string): string {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.textSec};">${html}</p>`;
}

/** A muted "preheader" that shows in inbox previews. */
function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BRAND.bg};">${text}</div>`;
}

/**
 * Wrap arbitrary content HTML inside the branded shell (header logo,
 * white card, footer).  `body` is whatever you want inside the card —
 * use the brand* helpers above for consistency.
 */
export function brandWrap(opts: {
  title: string;
  preheader?: string;
  body: string;
  unsubscribeHtml?: string;
}): string {
  const { title, preheader: ph, body, unsubscribeHtml = '' } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;color:${BRAND.text};-webkit-font-smoothing:antialiased;">
  ${ph ? preheader(ph) : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <!-- Brand header -->
          <tr>
            <td style="padding:0 0 24px 0;text-align:center;">
              <img src="${BRAND.logoUrl}" alt="Qwillio" width="44" height="44" style="border-radius:10px;display:inline-block;vertical-align:middle;border:0;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.01em;margin-left:10px;vertical-align:middle;color:${BRAND.text};">Qwillio</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:${BRAND.card};border-radius:16px;padding:40px 36px;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 6px 18px rgba(0,0,0,0.05);">
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
