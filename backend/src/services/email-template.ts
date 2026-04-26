/**
 * Shared branded email template — solid Qwillio violet bg with two
 * visible soft orbs + frosted translucent card.  Matches the Sales
 * Rep Guide page exactly.
 */

const BRAND = {
  // Hosted transparent PNG (orbs + Q/W letters in white, no white square)
  logoUrl:    'https://qwillio.com/logo-qw.png',
  homeUrl:    'https://qwillio.com',
  supportUrl: 'mailto:contact@qwillio.com',
  // Brand violets
  violet:     '#7B5CF0',
  violetDeep: '#5C3CE0',
  violetLite: '#9F86FF',
  // Wordmark on the violet bg — white per design
  wordmark:   '#FFFFFF',
};

/** Primary CTA — large, centered, WHITE pill with VIOLET text. */
export function brandButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 24px auto;width:auto;">
      <tr>
        <td align="center" bgcolor="#FFFFFF" style="border-radius:14px;background:#FFFFFF;box-shadow:0 12px 32px rgba(0,0,0,0.18);">
          <a href="${url}" style="display:inline-block;padding:16px 38px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;color:${BRAND.violetDeep} !important;font-size:15px;font-weight:700;text-decoration:none;border-radius:14px;letter-spacing:0.01em;mso-text-raise:0;">
            <span style="color:${BRAND.violetDeep} !important;font-weight:700;">${label} &rarr;</span>
          </a>
        </td>
      </tr>
    </table>`;
}

/** Subtle secondary action — text-only inline link, white on violet. */
export function brandLink(label: string, url: string): string {
  return `<a href="${url}" style="color:#FFFFFF;font-weight:600;text-decoration:underline;">${label}</a>`;
}

/** Branded bullet list — WHITE solid dots glowing on the violet card. */
export function brandList(items: string[]): string {
  return `<ul style="margin:16px 0;padding:0;list-style:none;">${
    items.map(it => `
      <li style="margin:0 0 12px 0;padding:0 0 0 24px;position:relative;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.88);">
        <span style="position:absolute;left:0;top:8px;width:7px;height:7px;border-radius:50%;background:#FFFFFF;display:inline-block;box-shadow:0 0 12px rgba(255,255,255,0.85);"></span>
        ${it}
      </li>`).join('')
  }</ul>`;
}

/** Muted helper paragraph — light white on violet. */
export function brandSmall(html: string): string {
  return `<p style="margin:18px 0 0 0;font-size:12.5px;line-height:1.55;color:rgba(255,255,255,0.62);">${html}</p>`;
}

/** H1 inside the card — pure white. */
export function brandTitle(text: string): string {
  return `<h1 style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:#FFFFFF;line-height:1.25;">${text}</h1>`;
}

/** Body paragraph — high-opacity white on violet. */
export function brandText(html: string): string {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.88);">${html}</p>`;
}

/** Inbox preview line — invisible but extracted by Gmail / Apple Mail. */
function preheader(text: string): string {
  return `<div style="display:none !important;visibility:hidden;mso-hide:all;max-height:0;max-width:0;opacity:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">${text}</div>
  <div style="display:none !important;font-size:1px;line-height:1px;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>`;
}

/**
 * Wrap arbitrary content HTML inside the branded shell.
 * Light-mode forced via meta + color-scheme so Gmail iOS dark mode
 * doesn't repaint the card or button text dark.
 */
export function brandWrap(opts: {
  title: string;
  preheader?: string;
  body: string;
  unsubscribeHtml?: string;
}): string {
  const { title, preheader: ph, body, unsubscribeHtml = '' } = opts;
  // Solid violet bg + two visible orbs (matching the Sales Rep Guide).
  const pageBg =
    `radial-gradient(circle at 92% 8%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.22) 16%, rgba(255,255,255,0) 32%),` +
    `radial-gradient(circle at 8% 92%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.16) 16%, rgba(255,255,255,0) 32%),` +
    `${BRAND.violet}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${title}</title>
  <style>:root{color-scheme:light only;supported-color-schemes:light only;}</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.violet};font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;color:#FFFFFF;-webkit-font-smoothing:antialiased;color-scheme:light only;">
  ${ph ? preheader(ph) : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.violet}" style="background:${pageBg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <!-- Brand header — top-left, transparent orbs PNG + black wordmark -->
          <tr>
            <td style="padding:0 4px 24px 4px;text-align:left;">
              <img src="${BRAND.logoUrl}" alt="" width="36" height="36" style="display:inline-block;vertical-align:middle;border:0;background:transparent;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.01em;margin-left:10px;vertical-align:middle;color:${BRAND.wordmark};">Qwillio</span>
            </td>
          </tr>
          <!-- Frosted glass card -->
          <tr>
            <td style="background:rgba(255,255,255,0.10);border-radius:16px;padding:40px 36px;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 4px 8px 4px;text-align:left;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.62);line-height:1.6;">
                Qwillio — AI receptionist for service businesses<br>
                <a href="${BRAND.homeUrl}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">qwillio.com</a>
                · <a href="${BRAND.supportUrl}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">contact@qwillio.com</a>
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
