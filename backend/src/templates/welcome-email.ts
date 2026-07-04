// ═══════════════════════════════════════════════════════════
// WELCOME EMAIL TEMPLATE
// Sent after a client completes the onboarding form
// ═══════════════════════════════════════════════════════════

export function getWelcomeEmailHtml(clientName: string, businessName: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue chez Qwillio</title>
</head>
<body style="margin:0;padding:0;background-color:#09090B;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090B;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#131316;border-radius:16px;border:1px solid #1E1E24;">

          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 24px 40px;text-align:center;border-bottom:1px solid #1E1E24;">
              <div style="font-size:28px;font-weight:700;color:#7B5CF0;letter-spacing:-0.5px;">Qwillio</div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:40px;">
              <!-- Welcome heading -->
              <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#F4F4F5;line-height:1.3;">
                Bienvenue chez Qwillio, ${clientName} !
              </h1>

              <p style="margin:0 0 24px 0;font-size:16px;color:#A1A1AA;line-height:1.6;">
                Votre réceptionniste IA pour <strong style="color:#F4F4F5;">${businessName}</strong> est configurée et prête à répondre à vos appels. Voici comment démarrer en quelques minutes.
              </p>

              <!-- Steps -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px 0;">
                <!-- Step 1 -->
                <tr>
                  <td style="padding:16px;background-color:#18181B;border-radius:12px;margin-bottom:8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:32px;height:32px;border-radius:8px;background-color:#7B5CF0;color:#FFFFFF;font-size:14px;font-weight:700;line-height:32px;text-align:center;">1</div>
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:15px;font-weight:600;color:#F4F4F5;margin-bottom:4px;">Configurez votre numéro de téléphone</div>
                          <div style="font-size:13px;color:#71717A;line-height:1.5;">Redirigez vos appels vers votre réceptionniste IA depuis votre tableau de bord.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>

                <!-- Step 2 -->
                <tr>
                  <td style="padding:16px;background-color:#18181B;border-radius:12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:32px;height:32px;border-radius:8px;background-color:#7B5CF0;color:#FFFFFF;font-size:14px;font-weight:700;line-height:32px;text-align:center;">2</div>
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:15px;font-weight:600;color:#F4F4F5;margin-bottom:4px;">Testez un appel</div>
                          <div style="font-size:13px;color:#71717A;line-height:1.5;">Appelez votre numéro pour entendre votre réceptionniste en action.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>

                <!-- Step 3 -->
                <tr>
                  <td style="padding:16px;background-color:#18181B;border-radius:12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:32px;height:32px;border-radius:8px;background-color:#7B5CF0;color:#FFFFFF;font-size:14px;font-weight:700;line-height:32px;text-align:center;">3</div>
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:15px;font-weight:600;color:#F4F4F5;margin-bottom:4px;">Personnalisez votre réceptionniste</div>
                          <div style="font-size:13px;color:#71717A;line-height:1.5;">Ajustez le ton, les réponses et les protocoles de transfert selon vos besoins.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>

                <!-- Step 4 -->
                <tr>
                  <td style="padding:16px;background-color:#18181B;border-radius:12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:32px;height:32px;border-radius:8px;background-color:#7B5CF0;color:#FFFFFF;font-size:14px;font-weight:700;line-height:32px;text-align:center;">4</div>
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:15px;font-weight:600;color:#F4F4F5;margin-bottom:4px;">Passez en production</div>
                          <div style="font-size:13px;color:#71717A;line-height:1.5;">Activez votre réceptionniste et ne manquez plus jamais un appel.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 16px 0;">
                    <a href="https://qwillio.com/dashboard" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#7B5CF0;color:#FFFFFF;font-size:16px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                      Accéder à mon tableau de bord
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0 0;font-size:14px;color:#52525B;line-height:1.6;text-align:center;">
                Une question ? Répondez directement à cet email ou écrivez-nous à
                <a href="mailto:hello@qwillio.com" style="color:#7B5CF0;text-decoration:none;">hello@qwillio.com</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #1E1E24;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:12px;color:#3F3F46;">
                Qwillio &mdash; Votre réceptionniste IA, disponible 24/7
              </p>
              <p style="margin:0;font-size:11px;color:#27272A;">
                <a href="https://qwillio.com" style="color:#52525B;text-decoration:none;">qwillio.com</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:hello@qwillio.com" style="color:#52525B;text-decoration:none;">hello@qwillio.com</a>
                &nbsp;&middot;&nbsp;
                <a href="{{unsubscribe_url}}" style="color:#52525B;text-decoration:underline;">Se désabonner</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
