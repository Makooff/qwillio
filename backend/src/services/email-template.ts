/**
 * Shared branded email template — clean white bg with violet text and
 * a violet primary CTA. Matches the Qwillio site palette.
 */

const BRAND = {
  logoUrl:    'https://qwillio.com/logo-qw.png',
  homeUrl:    'https://qwillio.com',
  supportUrl: 'mailto:contact@qwillio.com',
  // Brand violets
  violet:     '#7B5CF0',
  violetDeep: '#5C3CE0',
  violetLite: '#9F86FF',
  // Wordmark on the white bg — deep violet
  wordmark:   '#5C3CE0',
  // Page bg + main text
  pageBg:     '#FFFFFF',
  textMain:   '#1d1d1f',
  textMuted:  'rgba(29,29,31,0.55)',
};

/** Primary CTA — large, centered, VIOLET pill with WHITE text. */
export function brandButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 24px auto;width:auto;">
      <tr>
        <td align="center" bgcolor="${BRAND.violet}" style="border-radius:14px;background:${BRAND.violet};box-shadow:0 12px 28px rgba(123,92,240,0.32);">
          <a href="${url}" style="display:inline-block;padding:16px 38px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;color:#FFFFFF !important;font-size:15px;font-weight:700;text-decoration:none;border-radius:14px;letter-spacing:0.01em;mso-text-raise:0;">
            <span style="color:#FFFFFF !important;font-weight:700;">${label} &rarr;</span>
          </a>
        </td>
      </tr>
    </table>`;
}

/** Subtle secondary action — text-only inline link in violet. */
export function brandLink(label: string, url: string): string {
  return `<a href="${url}" style="color:${BRAND.violetDeep};font-weight:600;text-decoration:underline;">${label}</a>`;
}

/** Branded bullet list — violet dots + dark text on white, block-centered. */
export function brandList(items: string[]): string {
  return `<ul style="margin:16px auto;padding:0;list-style:none;display:inline-block;text-align:left;max-width:100%;">${
    items.map(it => `
      <li style="margin:0 0 12px 0;padding:0 0 0 24px;position:relative;font-size:15px;line-height:1.55;color:${BRAND.textMain};">
        <span style="position:absolute;left:0;top:8px;width:7px;height:7px;border-radius:50%;background:${BRAND.violet};display:inline-block;"></span>
        ${it}
      </li>`).join('')
  }</ul>`;
}

/** Muted helper paragraph — centered. */
export function brandSmall(html: string): string {
  return `<p style="margin:18px 0 0 0;font-size:12.5px;line-height:1.55;color:${BRAND.textMuted};text-align:center;">${html}</p>`;
}

/** H1 — deep violet, centered. */
export function brandTitle(text: string): string {
  return `<h1 style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.violetDeep};line-height:1.25;text-align:center;">${text}</h1>`;
}

/** Body paragraph — dark gray, centered, for readability on white. */
export function brandText(html: string): string {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.textMain};text-align:center;">${html}</p>`;
}

/** Inbox preview line — invisible but extracted by Gmail / Apple Mail. */
function preheader(text: string): string {
  return `<div style="display:none !important;visibility:hidden;mso-hide:all;max-height:0;max-width:0;opacity:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">${text}</div>
  <div style="display:none !important;font-size:1px;line-height:1px;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>`;
}

/**
 * Wrap arbitrary content HTML inside the branded shell.
 * Light-mode forced via meta + color-scheme so Gmail iOS dark mode
 * doesn't repaint the bg or button colors dark.
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
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${title}</title>
  <style>
    :root{color-scheme:light only;supported-color-schemes:light only;}
    html,body{margin:0!important;padding:0!important;background:${BRAND.pageBg}!important;width:100%!important;}
    .qw-bg{background:${BRAND.pageBg}!important;}
  </style>
</head>
<body bgcolor="${BRAND.pageBg}" style="margin:0;padding:0;background:${BRAND.pageBg};font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;color:${BRAND.textMain};-webkit-font-smoothing:antialiased;color-scheme:light only;width:100%;">
  ${ph ? preheader(ph) : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.pageBg}" class="qw-bg" style="background:${BRAND.pageBg};padding:40px 32px;margin:0;border-collapse:collapse;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">
          <!-- Brand header — centered logo + violet wordmark -->
          <tr>
            <td style="padding:0 4px 28px 4px;text-align:center;">
              <img src="${BRAND.logoUrl}" alt="" width="28" height="28" style="display:inline-block;vertical-align:middle;border:0;background:transparent;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:600;letter-spacing:-0.02em;margin-left:8px;vertical-align:middle;color:${BRAND.wordmark};">Qwillio</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:8px 4px;text-align:center;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:28px 4px 8px 4px;text-align:center;">
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
