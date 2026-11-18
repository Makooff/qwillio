/**
 * Les messages de prospection que le fondateur envoie A LA MAIN depuis le
 * tableau de bord : mails et SMS, un clic par prospect.
 *
 * Ce fichier est PUR : il ne lit ni la base ni l'environnement, il rend du
 * texte a partir de variables. C'est ce qui permet de le tester sans rien
 * brancher, et d'afficher dans l'ecran exactement ce qui partira.
 *
 * TROIS REGLES, et elles viennent des playbooks de vente, pas d'une preference :
 *
 *   1. Aucun chiffre de marche, aucun client cite. Un patron verifie.
 *   2. Jamais « heberge en Europe », jamais « bilingue sur le meme appel ».
 *   3. Un mail de prospection est une LETTRE, pas une publicite : aligne a
 *      gauche, une seule action demandee, une sortie explicite (« stop »).
 *
 * Les SMS, eux, ne sont jamais du demarchage a froid : chaque modele suppose un
 * premier echange ou le destinataire a dit oui. C'est le droit belge (un
 * message electronique publicitaire demande un accord prealable), et la route
 * d'envoi exige que l'expediteur l'atteste.
 */

export type OutreachChannel = 'email' | 'sms';

export interface OutreachSender {
  prenom: string;
  nom?: string;
  telephone?: string;
  /** Le lien de la video de demonstration du metier vise. */
  lienVideo?: string;
}

export interface OutreachField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** `long` rend une zone de texte dans l'ecran. */
  long?: boolean;
}

export interface OutreachTemplate {
  id: string;
  channel: OutreachChannel;
  label: string;
  /** Quand l'envoyer, en une ligne, lue dans l'ecran. */
  when: string;
  fields: OutreachField[];
  /** Vrai quand le modele cite la video : le lien de l'expediteur devient requis. */
  needsVideo?: boolean;
}

export interface RenderedEmail {
  channel: 'email';
  subject: string;
  html: string;
  text: string;
}

export interface RenderedSms {
  channel: 'sms';
  body: string;
  /** Nombre de SMS factures pour ce texte. */
  segments: number;
}

export type Rendered = RenderedEmail | RenderedSms;

// ── Le catalogue ─────────────────────────────────────────────────────────────

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: 'appel_manque', channel: 'email', label: 'Appel manqué',
    when: "Dans l'heure qui suit un appel resté sans réponse.",
    needsVideo: true,
    fields: [
      { key: 'heure', label: "Heure de l'appel", placeholder: '14 h 10', required: true },
    ],
  },
  {
    id: 'relance', channel: 'email', label: 'Relance',
    when: 'Trois jours après le premier mail, une seule fois.',
    fields: [
      { key: 'commune', label: 'Sa commune', placeholder: 'Wavre', required: true },
      { key: 'jour1', label: 'Premier créneau', placeholder: 'jeudi 14 h', required: true },
      { key: 'jour2', label: 'Second créneau', placeholder: 'vendredi 8 h', required: true },
    ],
  },
  {
    id: 'dernier', channel: 'email', label: 'Dernier message',
    when: 'Huit jours après le premier mail. Ensuite, on arrête.',
    fields: [],
  },
  {
    id: 'apres_echange', channel: 'email', label: 'Suite à notre échange',
    when: 'Il a dit « envoyez-moi un mail » au téléphone.',
    needsVideo: true,
    fields: [
      { key: 'jour1', label: 'Premier créneau', placeholder: 'jeudi 14 h', required: true },
      { key: 'jour2', label: 'Second créneau', placeholder: 'vendredi 8 h', required: true },
    ],
  },
  {
    id: 'confirmation_rdv', channel: 'email', label: 'Confirmation de rendez-vous',
    when: 'Juste après avoir fixé une visite.',
    fields: [
      { key: 'jour', label: 'Jour et heure', placeholder: 'jeudi 19 novembre à 14 h', required: true },
      { key: 'adresse', label: 'Adresse de la visite', placeholder: 'Rue du Commerce 12, Wavre' },
    ],
  },
  {
    id: 'apporteur', channel: 'email', label: 'Apporteur',
    when: "À un cabinet comptable, une agence web ou un installateur, sur son adresse générale.",
    fields: [
      { key: 'jour1', label: 'Premier créneau', placeholder: 'jeudi', required: true },
      { key: 'jour2', label: 'Second créneau', placeholder: 'vendredi', required: true },
    ],
  },
  {
    id: 'libre', channel: 'email', label: 'Message libre',
    when: 'Votre texte, dans la même mise en page.',
    fields: [
      { key: 'objet', label: 'Objet', required: true },
      { key: 'message', label: 'Message', required: true, long: true },
    ],
  },

  {
    id: 'sms_rdv', channel: 'sms', label: 'Rendez-vous confirmé',
    when: "Pendant l'appel, avant qu'il raccroche.",
    fields: [
      { key: 'jour', label: 'Jour et heure', placeholder: 'jeudi 14 h', required: true },
    ],
  },
  {
    id: 'sms_veille', channel: 'sms', label: 'Rappel la veille',
    when: 'La veille de la visite, vers 17 h.',
    fields: [
      { key: 'heure', label: 'Heure de la visite', placeholder: '14 h', required: true },
    ],
  },
  {
    id: 'sms_video', channel: 'sms', label: 'Lien de la démo',
    when: 'Il a accepté de recevoir la vidéo par SMS.',
    needsVideo: true,
    fields: [],
  },
  {
    id: 'sms_coordonnees', channel: 'sms', label: 'Mes coordonnées',
    when: 'Après un échange, pour qu’il garde votre numéro.',
    fields: [],
  },
  {
    id: 'sms_libre', channel: 'sms', label: 'Message libre',
    when: 'Votre texte. Restez sous 160 caractères.',
    fields: [
      { key: 'message', label: 'Message', required: true, long: true },
    ],
  },
];

// ── Les adresses d'envoi ─────────────────────────────────────────────────────

/**
 * Les adresses du domaine depuis lesquelles un mail de prospection peut partir.
 *
 * Ce sont des alias de la boîte principale (support@) : une réponse à l'une
 * d'elles arrive dans la même boîte. La liste est FERMÉE, et c'est le serveur
 * qui la tient : une adresse d'expéditeur venue du navigateur permettrait
 * d'écrire au nom de n'importe qui sur le domaine. `noreply@` n'y figure pas,
 * un prospect doit pouvoir répondre ; `social@` non plus, ce n'est pas son rôle.
 */
export const OUTREACH_SENDERS = [
  { key: 'hello', address: 'hello@qwillio.com', label: 'hello@qwillio.com', hint: 'Prospection' },
  { key: 'contact', address: 'contact@qwillio.com', label: 'contact@qwillio.com', hint: 'Contact général' },
  { key: 'partenaires', address: 'partenaires@qwillio.com', label: 'partenaires@qwillio.com', hint: 'Apporteurs et partenaires' },
  { key: 'support', address: 'support@qwillio.com', label: 'support@qwillio.com', hint: 'Boîte principale' },
] as const;
export type OutreachSenderKey = typeof OUTREACH_SENDERS[number]['key'];

/** L'adresse qui convient au modèle quand l'expéditeur n'en a pas choisi une. */
export function defaultSenderKey(templateId: string): OutreachSenderKey {
  return templateId === 'apporteur' ? 'partenaires' : 'hello';
}

/** Rend l'adresse choisie si elle est dans la liste, sinon celle du modèle. */
export function resolveSenderAddress(templateId: string, key: unknown): { key: OutreachSenderKey; address: string } {
  const found = OUTREACH_SENDERS.find(o => o.key === key) ?? OUTREACH_SENDERS.find(o => o.key === defaultSenderKey(templateId))!;
  return { key: found.key, address: found.address };
}

/**
 * L'en-tête « De ». Le nom affiché vient d'un champ de saisie : on en retire
 * tout ce qui pourrait fermer le nom et ouvrir une seconde adresse, ou couper
 * la ligne d'en-tête.
 */
export function fromHeader(prenom: string, address: string): string {
  const name = prenom.replace(/[<>"\\,;:\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  return name ? `${name} de Qwillio <${address}>` : `Qwillio <${address}>`;
}

export function findTemplate(id: string): OutreachTemplate | undefined {
  return OUTREACH_TEMPLATES.find(t => t.id === id);
}

// ── Outils de texte ──────────────────────────────────────────────────────────

/** Tout ce qui vient d'un champ de saisie passe par ici avant d'entrer dans du HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clean(value: unknown, max = 400): string {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

/**
 * Un lien n'entre dans un message que s'il est en https. Une valeur de champ
 * comme `javascript:` ou un lien nu vers un domaine tape de travers ne doit
 * pas devenir un bouton cliquable dans le mail d'un prospect.
 */
export function safeLink(value: unknown): string | null {
  const raw = clean(value, 500);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Une adresse GENERALE (info@, contact@) designe une societe ; une adresse
 * nominative designe une personne. Le droit belge ne traite pas les deux de la
 * meme facon : la premiere peut recevoir un mail de prospection, la seconde
 * demande un accord. La liste est volontairement courte : dans le doute,
 * l'adresse est tenue pour personnelle et l'ecran demande l'accord.
 */
const GENERIC_LOCAL_PARTS = new Set([
  'info', 'infos', 'contact', 'contacts', 'hello', 'bonjour', 'office', 'bureau',
  'accueil', 'reception', 'secretariat', 'admin', 'administration', 'direction',
  'service', 'services', 'support', 'sales', 'commercial', 'vente', 'ventes',
  'devis', 'rdv', 'mail', 'email', 'team', 'equipe', 'welcome', 'compta',
  'comptabilite', 'facturation', 'kantoor', 'onthaal', 'verkoop',
]);

export function addressKind(email: string): 'generic' | 'personal' {
  const local = email.split('@')[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  return GENERIC_LOCAL_PARTS.has(local) ? 'generic' : 'personal';
}

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i;
export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

// ── SMS ──────────────────────────────────────────────────────────────────────

/**
 * Un SMS reste en alphabet GSM tant qu'il ne porte aucun caractere hors de
 * cette table. Un seul « ê » le fait basculer en UCS-2, et le plafond tombe de
 * 160 a 70 caracteres : le meme texte coute alors deux ou trois SMS. Les
 * modeles sont donc ecrits sans accent, et le texte libre est converti.
 */
export function toGsm(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/«[\s\u00a0\u202f]*/g, '"').replace(/[\s\u00a0\u202f]*»/g, '"').replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/€/g, 'EUR')
    .replace(/ | /g, ' ')
    .replace(/[ \t]+/g, ' ').trim();
}

export function smsSegments(text: string): number {
  if (text.length <= 160) return 1;
  return Math.ceil(text.length / 153);
}

// ── La mise en page du mail ──────────────────────────────────────────────────

/* La marque, telle que le site la porte : le logo aux deux cercles, Outfit,
   l'encre et l'indigo. Le logo est servi par le site (`frontend/public`), donc
   il existe en production avant que le premier mail ne parte. */
const INK = '#1d1d1f';
const MUTED = '#6b6660';
const RULE = '#ebe8e4';
const VIOLET = '#7A5FFF';
const LILAC = '#f4eefe';
const LOGO_URL = 'https://qwillio.com/logo-qw.png';
const SITE_URL = 'https://qwillio.com';
const FONT = "'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";

function para(html: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${INK};">${html}</p>`;
}

/**
 * La video : le seul bloc illustre du mail, dans le registre du site (fond
 * lilas, titre en Outfit, bouton en pilule). Le degrade est un confort : un
 * client de messagerie qui l'ignore affiche le lilas uni.
 */
function videoBlock(link: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 24px 0;">
    <tr>
      <td bgcolor="${LILAC}" style="border-radius:18px;padding:24px 24px 22px 24px;background:${LILAC};background-image:linear-gradient(135deg,#ffffff 0%,${LILAC} 55%,#ecdcfd 100%);">
        <p style="margin:0 0 8px 0;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${VIOLET};">Démonstration, 45 secondes</p>
        <p style="margin:0 0 18px 0;font-family:${FONT};font-size:20px;font-weight:600;line-height:1.25;letter-spacing:-0.01em;color:${INK};">Ce que votre client entend quand vous ne pouvez pas décrocher.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${VIOLET}" style="border-radius:999px;background:${VIOLET};">
              <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">&#9654;&nbsp; Voir la vidéo</a>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;">${escapeHtml(link)}</p>
      </td>
    </tr>
  </table>`;
}

function signature(sender: OutreachSender): string {
  const nom = [sender.prenom, sender.nom].filter(Boolean).map(v => escapeHtml(clean(v, 80))).join(' ');
  const tel = sender.telephone ? escapeHtml(clean(sender.telephone, 40)) : '';
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0 0;">
    <tr><td style="border-top:1px solid ${RULE};padding-top:18px;">
      <p style="margin:0;font-family:${FONT};font-size:15px;font-weight:600;color:${INK};">${nom}</p>
      <p style="margin:2px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">Fondateur de Qwillio, Bruxelles${tel ? `<br>${tel}` : ''}</p>
    </td></tr>
  </table>`;
}

function shell(opts: { subject: string; preheader: string; body: string; sender: OutreachSender }): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>${escapeHtml(opts.subject)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&display=swap" rel="stylesheet">
</head>
<body bgcolor="#ffffff" style="margin:0;padding:0;background:#ffffff;color:${INK};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:transparent;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:36px 24px 28px 24px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 0 28px 0;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <img src="${LOGO_URL}" width="34" height="34" alt="" style="display:inline-block;vertical-align:middle;border:0;">
                <span style="font-family:${FONT};font-size:19px;font-weight:600;letter-spacing:-0.02em;color:${INK};vertical-align:middle;margin-left:8px;">Qwillio</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="text-align:left;">
              ${opts.body}
              ${signature(opts.sender)}
            </td>
          </tr>
          <tr>
            <td style="padding:26px 0 0 0;">
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">Si ce n'est pas pour vous, répondez « stop » et je ne vous écris plus.<br><a href="${SITE_URL}" style="color:${MUTED};text-decoration:underline;">qwillio.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Le rendu ─────────────────────────────────────────────────────────────────

export class OutreachError extends Error {
  constructor(public readonly code: string, public readonly field?: string) {
    super(code);
  }
}

interface RenderInput {
  templateId: string;
  vars: Record<string, unknown>;
  sender: OutreachSender;
}

/** Les lignes d'un mail : du texte, ou la video. Le HTML et le texte brut en sortent tous les deux. */
type Block = string | { video: string };

function buildEmail(subject: string, preheader: string, blocks: Block[], sender: OutreachSender): RenderedEmail {
  const body = blocks.map(b => (typeof b === 'string'
    ? para(escapeHtml(b).replace(/\n/g, '<br>'))
    : videoBlock(b.video))).join('\n');
  const nom = [sender.prenom, sender.nom].filter(Boolean).join(' ');
  const text = [
    ...blocks.map(b => (typeof b === 'string' ? b : `La vidéo de 45 secondes : ${b.video}`)),
    `${nom}\nFondateur de Qwillio, Bruxelles${sender.telephone ? `\n${sender.telephone}` : ''}`,
    "Si ce n'est pas pour vous, répondez « stop » et je ne vous écris plus.",
  ].join('\n\n');
  return { channel: 'email', subject, html: shell({ subject, preheader, body, sender }), text };
}

export function renderOutreach(input: RenderInput): Rendered {
  const template = findTemplate(input.templateId);
  if (!template) throw new OutreachError('unknown_template');

  const prenom = clean(input.sender?.prenom, 80);
  if (!prenom) throw new OutreachError('missing_sender', 'prenom');
  const sender: OutreachSender = {
    prenom,
    nom: clean(input.sender?.nom, 80) || undefined,
    telephone: clean(input.sender?.telephone, 40) || undefined,
  };

  const v: Record<string, string> = {};
  for (const field of template.fields) {
    const value = clean(input.vars?.[field.key], field.long ? 2000 : 200);
    if (field.required && !value) throw new OutreachError('missing_field', field.key);
    v[field.key] = value;
  }

  let video = '';
  if (template.needsVideo) {
    const link = safeLink(input.sender?.lienVideo);
    if (!link) throw new OutreachError('missing_video', 'lienVideo');
    video = link;
  }

  const tel = sender.telephone ?? '';

  switch (template.id) {
    case 'appel_manque':
      return buildEmail(`Appel manqué à ${v.heure}`, 'Un client aurait appelé le suivant sur la liste.', [
        'Bonjour,',
        `Je vous ai appelé aujourd'hui à ${v.heure} et personne n'a décroché. C'est normal, vous étiez sans doute avec un client ou sur un chantier.`,
        'Un client pressé aurait fait comme moi, puis il aurait appelé le suivant sur la liste.',
        `Je m'appelle ${prenom}, je suis le fondateur de Qwillio, à Bruxelles. On fait une seule chose : une assistante qui décroche à votre place quand vous ne pouvez pas répondre, prend le message ou le rendez-vous, et vous envoie un SMS. Votre téléphone sonne comme avant, elle ne prend que ce que vous ratez.`,
        { video },
        'Si ça vous parle, répondez simplement « oui » et je vous rappelle à l\'heure qui vous arrange.',
      ], sender);

    case 'relance':
      return buildEmail('Une seule question', 'Combien d\'appels sonnent dans le vide chez vous ?', [
        'Bonjour,',
        'Je reviens vers vous une seule fois, avec une question.',
        'Dans une semaine normale, combien d\'appels sonnent dans le vide pendant que vous avez les mains prises ?',
        `Si c'est moins de deux, oubliez-moi, ce n'est pas urgent chez vous. Si c'est plus, je passe vingt minutes à ${v.commune}, ${v.jour1} ou ${v.jour2}. Je vous fais entendre la voix sur votre propre téléphone, et si vous ne voyez pas l'intérêt je repars.`,
      ], sender);

    case 'dernier':
      return buildEmail('Je vous laisse tranquille', 'Dernier message, promis.', [
        'Bonjour,',
        'Dernier message, pour ne pas encombrer votre boîte.',
        `Si un jour les appels manqués deviennent un sujet, l'essai dure 7 jours et je fais la mise en route moi-même${tel ? ` : ${tel}` : ''}.`,
        'Bonne continuation.',
      ], sender);

    case 'apres_echange':
      return buildEmail('Comme convenu', 'La démonstration de 45 secondes dont on a parlé.', [
        'Bonjour,',
        'Merci pour votre temps au téléphone. Comme convenu, voici la démonstration.',
        { video },
        'En deux mots : votre téléphone sonne comme avant. Quand vous ne pouvez pas décrocher, l\'assistante prend l\'appel, note le nom et la demande, et vous envoie un SMS. Si vous décrochez, elle n\'existe pas.',
        `Je peux passer vingt minutes chez vous pour le brancher sur votre ligne et vous laisser l'essayer 7 jours. ${cap(v.jour1)} ou ${v.jour2}, qu'est-ce qui vous arrange ?`,
      ], sender);

    case 'confirmation_rdv':
      return buildEmail(`Rendez-vous ${v.jour}`, 'Vingt minutes, et je repars si ça ne vous parle pas.', [
        'Bonjour,',
        `Je vous confirme notre rendez-vous ${v.jour}${v.adresse ? `, ${v.adresse}` : ''}.`,
        'Comptez vingt minutes. J\'apporte de quoi vous faire entendre la voix sur votre propre téléphone, et on regarde ensemble vos appels de la semaine.',
        `Un empêchement ? Un mot par retour de mail${tel ? ` ou au ${tel}` : ''}, et on déplace.`,
      ], sender);

    case 'apporteur':
      return buildEmail('Vos clients indépendants et leurs appels manqués', 'Une commission récurrente, et je fais la mise en route.', [
        'Bonjour,',
        `Je suis ${[prenom, sender.nom].filter(Boolean).join(' ')}, fondateur de Qwillio, à Bruxelles. Je ne vous écris pas pour vous vendre quelque chose.`,
        'Vos clients indépendants ratent des appels toute la journée, parce qu\'ils sont sur un chantier ou avec un client. Qwillio décroche à leur place, prend le message ou le rendez-vous, et leur envoie un SMS.',
        'Je vous propose d\'en parler à ceux que ça concerne. Vous touchez une commission récurrente de 20 % sur chaque abonnement, et je fais toute la mise en route moi-même.',
        `Je peux passer vingt minutes à votre bureau pour vous faire entendre la voix. ${cap(v.jour1)} ou ${v.jour2} vous conviendrait ?`,
      ], sender);

    case 'libre':
      return buildEmail(v.objet, v.message.slice(0, 90), v.message.split(/\n{2,}/).filter(Boolean), sender);

    case 'sms_rdv':
      return sms(`Bonjour, ${prenom} de Qwillio. Je confirme notre rendez-vous ${v.jour}. A bientot.${tel ? ` ${tel}` : ''}`);
    case 'sms_veille':
      return sms(`A demain ${v.heure}. J'apporte de quoi vous faire entendre la voix. ${prenom}, Qwillio`);
    case 'sms_video':
      return sms(`Comme convenu, la demo de 45 secondes : ${video} ${prenom}, Qwillio`);
    case 'sms_coordonnees':
      if (!tel) throw new OutreachError('missing_sender', 'telephone');
      return sms(`Merci pour l'echange. Mon numero direct : ${tel}. ${prenom}, fondateur de Qwillio`);
    case 'sms_libre':
      return sms(v.message);
    default:
      throw new OutreachError('unknown_template');
  }
}

function cap(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function sms(text: string): RenderedSms {
  const body = toGsm(text);
  return { channel: 'sms', body, segments: smsSegments(body) };
}
