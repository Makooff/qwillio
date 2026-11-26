/**
 * Le gabarit commun des mails transactionnels, dans la direction V2
 * « Papier & Signal » (`DA/v2-direction.md`) : papier coquille d'œuf, encre
 * jamais noire, titres en Outfit léger (300), pilule d'encre pour l'action.
 *
 * Trois règles de la DA qui comptent plus dans un mail que sur le site :
 * - Le mauve n'habille JAMAIS un bouton ni un lien sur fond clair. Il vit
 *   dans le logo, l'eyebrow et le puce de liste. Le CTA est une pilule d'encre.
 * - Pas de fond blanc pur ni de texte noir pur : canvas #FDFCFC, encre #1D1D1F.
 * - Aligné à gauche, comme une lettre. Un mail centré se lit comme une pub.
 *
 * Les valeurs sont recopiées des tokens q2 (une feuille de style ne voyage pas
 * dans un mail). Outfit est chargé quand le client le permet (Apple Mail, iOS),
 * sinon la pile système prend le relais, au même poids.
 */

const BRAND = {
  logoUrl:    'https://qwillio.com/logo-qw.png',
  homeUrl:    'https://qwillio.com',
  supportUrl: 'mailto:support@qwillio.com',
  // q2, registre clair
  canvas:     '#FDFCFC',
  band:       '#F5F3F1',
  plate:      '#EBE8E4',
  ink:        '#1D1D1F',
  graphite:   '#44403B',
  body:       '#777169',
  // Marque : seulement en accent (eyebrow, puce), jamais en bouton
  indigo:     '#7A5FFF',
  indigoInk:  '#7349FE',
  // Alias conservés pour les appelants historiques
  violet:     '#7A5FFF',
  wordmark:   '#1D1D1F',
  pageBg:     '#FDFCFC',
  textMain:   '#1D1D1F',
  textMuted:  '#777169',
};

const FONT = "'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";

/** Action principale : pilule d'encre, texte crème, alignée à gauche. */
export function brandButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 32px 0;">
      <tr>
        <td bgcolor="${BRAND.ink}" style="border-radius:9999px;background:${BRAND.ink};">
          <a href="${url}" style="display:inline-block;padding:13px 24px;font-family:${FONT};color:${BRAND.canvas} !important;font-size:15px;font-weight:500;line-height:1;text-decoration:none;border-radius:9999px;">
            <span style="color:${BRAND.canvas} !important;">${label}</span>
          </a>
        </td>
      </tr>
    </table>`;
}

/** Lien dans le texte : encre soulignée, jamais mauve sur fond clair. */
export function brandLink(label: string, url: string): string {
  return `<a href="${url}" style="color:${BRAND.ink};font-weight:500;text-decoration:underline;text-underline-offset:2px;">${label}</a>`;
}

/** Liste : petite puce indigo, texte graphite. */
export function brandList(items: string[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px 0;">${
    items.map(it => `
      <tr>
        <td valign="top" style="padding:9px 12px 0 0;width:6px;">
          <div style="width:6px;height:6px;border-radius:9999px;background:${BRAND.indigo};font-size:0;line-height:0;">&nbsp;</div>
        </td>
        <td style="padding:0 0 10px 0;font-family:${FONT};font-size:16px;line-height:1.55;color:${BRAND.graphite};">${it}</td>
      </tr>`).join('')
  }</table>`;
}

/** Note secondaire : petit corps, ton « body ». */
export function brandSmall(html: string): string {
  return `<p style="margin:16px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.55;color:${BRAND.body};">${html}</p>`;
}

/** Titre : Outfit léger (300), la signature V2. */
export function brandTitle(text: string): string {
  return `<h1 style="margin:0 0 20px 0;font-family:${FONT};font-size:30px;font-weight:300;letter-spacing:-0.02em;line-height:1.15;color:${BRAND.ink};">${text}</h1>`;
}

/** Paragraphe : 16 px, graphite (plus lisible que le gris « body » sur un écran de téléphone). */
export function brandText(html: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${BRAND.graphite};">${html}</p>`;
}

/** Eyebrow : 13 px, casse de phrase, encre indigo. Une seule par mail. */
export function brandEyebrow(text: string): string {
  return `<p style="margin:0 0 10px 0;font-family:${FONT};font-size:13px;font-weight:500;line-height:1.4;color:${BRAND.indigoInk};">${text}</p>`;
}

/** Bloc mis en avant (numéro, prix, date) : plaque taupe sans bordure ni ombre. */
export function brandCard(html: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px 0;">
      <tr>
        <td bgcolor="${BRAND.band}" style="background:${BRAND.band};border-radius:20px;padding:24px 24px;">${html}</td>
      </tr>
    </table>`;
}

/** Ligne d'aperçu dans la boîte de réception (invisible dans le mail). */
function preheader(text: string): string {
  return `<div style="display:none !important;visibility:hidden;mso-hide:all;max-height:0;max-width:0;opacity:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">${text}</div>
  <div style="display:none !important;font-size:1px;line-height:1px;">&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>`;
}

/**
 * Enveloppe le contenu dans la coque de marque. Mode clair imposé par les
 * méta `color-scheme`, pour que le mode sombre de Gmail iOS ne repeigne ni le
 * papier ni la pilule d'encre.
 */
export function brandWrap(opts: {
  title: string;
  preheader?: string;
  body: string;
  unsubscribeHtml?: string;
  /* La langue du mail, pour le pied de page et l'attribut `lang`. Par défaut
     l'anglais, pour ne rien changer aux appels qui ne la passent pas encore. */
  lang?: 'fr' | 'en';
}): string {
  const { title, preheader: ph, body, unsubscribeHtml = '', lang = 'en' } = opts;
  const tagline = lang === 'fr'
    ? 'Qwillio, la réceptionniste IA des métiers de service. Bruxelles.'
    : 'Qwillio, the AI receptionist for service businesses. Brussels.';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    :root{color-scheme:light only;supported-color-schemes:light only;}
    html,body{margin:0!important;padding:0!important;background:${BRAND.canvas}!important;width:100%!important;}
    .qw-bg{background:${BRAND.canvas}!important;}
    @media (max-width:480px){ .qw-pad{padding:28px 20px!important;} }
  </style>
</head>
<body bgcolor="${BRAND.canvas}" style="margin:0;padding:0;background:${BRAND.canvas};font-family:${FONT};color:${BRAND.ink};-webkit-font-smoothing:antialiased;color-scheme:light only;width:100%;">
  ${ph ? preheader(ph) : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.canvas}" class="qw-bg" style="background:${BRAND.canvas};margin:0;border-collapse:collapse;">
    <tr>
      <td align="center" class="qw-pad" style="padding:44px 32px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <!-- En-tête : le logo aux deux cercles et le nom, à gauche -->
          <tr>
            <td style="padding:0 0 40px 0;text-align:left;">
              <a href="${BRAND.homeUrl}" style="text-decoration:none;">
                <img src="${BRAND.logoUrl}" alt="" width="28" height="28" style="display:inline-block;vertical-align:middle;border:0;">
                <span style="font-family:${FONT};font-size:18px;font-weight:500;letter-spacing:-0.02em;margin-left:8px;vertical-align:middle;color:${BRAND.ink};">Qwillio</span>
              </a>
            </td>
          </tr>
          <!-- Corps -->
          <tr>
            <td style="text-align:left;">
              ${body}
            </td>
          </tr>
          <!-- Pied : un trait fin, puis le ton « body » -->
          <tr>
            <td style="padding:36px 0 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid ${BRAND.plate};padding-top:20px;text-align:left;">
                  <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.body};">
                    ${tagline}<br>
                    <a href="${BRAND.homeUrl}" style="color:${BRAND.body};text-decoration:underline;">qwillio.com</a>
                    &nbsp;·&nbsp; <a href="${BRAND.supportUrl}" style="color:${BRAND.body};text-decoration:underline;">support@qwillio.com</a>
                  </p>
                  ${unsubscribeHtml}
                </td></tr>
              </table>
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
