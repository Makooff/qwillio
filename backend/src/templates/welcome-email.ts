import { brandWrap, brandTitle, brandText, brandButton, brandSmall } from '../services/email-template';

// Mail de bienvenue, envoyé quand un client termine le formulaire
// d'onboarding guidé. Il passe par le gabarit commun V2 (`email-template`),
// comme les autres transactionnels : il était resté seul en thème sombre V1,
// avec un lien « Se désabonner » vers `{{unsubscribe_url}}` que rien ne
// remplaçait jamais.

const FONT = "'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";

const STEPS: Array<[string, string]> = [
  ['Configurez votre numéro de téléphone', 'Redirigez vos appels vers votre réceptionniste IA depuis votre tableau de bord.'],
  ['Testez un appel', 'Appelez votre numéro pour entendre votre réceptionniste en action.'],
  ['Personnalisez votre réceptionniste', 'Ajustez le ton, les réponses et les protocoles de transfert selon vos besoins.'],
  ['Passez en production', 'Activez votre réceptionniste et ne manquez plus jamais un appel.'],
];

/** Les étapes numérotées : un chiffre léger, un trait fin entre chaque. */
function steps(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px 0;">${
    STEPS.map(([title, text], i) => `
      <tr>
        <td valign="top" style="width:36px;padding:16px 0;${i ? 'border-top:1px solid #EBE8E4;' : ''}font-family:${FONT};font-size:22px;font-weight:300;line-height:1.2;color:#7349FE;font-variant-numeric:tabular-nums;">${i + 1}</td>
        <td style="padding:16px 0;${i ? 'border-top:1px solid #EBE8E4;' : ''}">
          <p style="margin:0 0 4px 0;font-family:${FONT};font-size:16px;font-weight:500;line-height:1.4;color:#1D1D1F;">${title}</p>
          <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.55;color:#44403B;">${text}</p>
        </td>
      </tr>`).join('')
  }</table>`;
}

export function getWelcomeEmailHtml(clientName: string, businessName: string): string {
  return brandWrap({
    title: 'Bienvenue chez Qwillio',
    preheader: `Votre réceptionniste pour ${businessName} est prête. Quatre étapes pour démarrer.`,
    lang: 'fr',
    body: [
      brandTitle(`Bienvenue chez Qwillio, ${clientName}.`),
      brandText(`Votre réceptionniste IA pour <strong style="font-weight:500;color:#1D1D1F;">${businessName}</strong> est configurée et prête à répondre à vos appels. Voici comment démarrer en quelques minutes.`),
      steps(),
      brandButton('Accéder à mon tableau de bord', 'https://qwillio.com/dashboard'),
      brandSmall('Une question ? Répondez directement à ce mail ou écrivez-nous à <a href="mailto:hello@qwillio.com" style="color:#44403B;text-decoration:underline;">hello@qwillio.com</a>.'),
    ].join('\n'),
  });
}
