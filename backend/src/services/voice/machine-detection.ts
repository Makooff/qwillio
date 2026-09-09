/**
 * « Est-ce que je parle à une machine ? », et la règle qui tranche le doute.
 *
 * ── L'asymétrie qui décide de tout (REL-5) ─────────────────────────────────
 *
 * Les deux erreurs ne coûtent PAS la même chose. Classer une machine en humain
 * gaspille quinze secondes. Classer un humain en machine raccroche au nez d'une
 * personne, et c'est irréparable: elle ne rappellera pas, et personne chez nous
 * ne saura jamais que c'est arrivé.
 *
 * Le verdict par défaut est donc « humain », et on ne raccroche que sur un
 * signe EXPLICITE. La version précédente listait « une réponse trop parfaite,
 * sans hésitation naturelle » parmi les marqueurs d'IA: c'est exactement la
 * description d'une secrétaire expérimentée qui décroche mille fois par jour.
 *
 * ── Pourquoi un module et pas deux copies dans le prompt ───────────────────
 *
 * La règle vivait en double, une fois en français et une fois en anglais, dans
 * deux fonctions de six cents lignes. Deux copies d'une règle finissent
 * toujours par diverger, et celle-ci décide de qui se fait raccrocher au nez.
 */
export type ProspectingLanguage = 'fr' | 'en';

const BLOCKS: Record<ProspectingLanguage, string> = {
  fr: `━━━ RÉPONDEUR / SVI / DÉTECTION IA ━━━

RÈGLE QUI PASSE AVANT TOUTES LES AUTRES : dans le doute, c'est un HUMAIN.
Les deux erreurs ne coûtent pas la même chose. Raccrocher au nez d'une personne
est irréparable ; perdre quinze secondes sur un répondeur ne coûte rien. Tu ne
raccroches donc que sur un signe EXPLICITE de la liste ci-dessous, jamais sur une
impression.

Dès que tu détectes l'un de ces éléments, appelle endCall. Pas un mot. Raccroche.

RÉPONDEUR :
- "Vous êtes bien sur la messagerie de..." / "Merci de laisser un message après le bip"
- "Je ne suis pas disponible" / "Je ne peux pas prendre votre appel"
- Un bip après un message enregistré
- 5+ secondes de silence au tout début

SVI / MENU TÉLÉPHONIQUE :
- "Tapez 1 pour..." / "Pour le service commercial, tapez 2..."
- "Merci d'appeler [entreprise]. Nos horaires sont..."
- "Veuillez patienter pendant que nous transférons votre appel"
- Toute voix automatisée qui lit un menu

ASSISTANT IA :
- Il se présente lui-même comme un assistant virtuel ou automatique
- Il lit un menu, ou répète la même phrase mot pour mot

Une voix « trop parfaite » ne prouve RIEN : une secrétaire expérimentée décroche
mille fois par jour et sonne exactement comme ça. Ce n'est pas un motif de
raccrocher.

Les vrais humains hésitent légèrement, disent quelque chose de court — "Allô ?", "Oui ?", "[Nom du cabinet]", leur prénom. C'est ton signal vert.`,
  en: `━━━ VOICEMAIL / IVR / AI DETECTION ━━━

RULE THAT OVERRIDES EVERY OTHER: when in doubt, it is a HUMAN.
The two mistakes do not cost the same. Hanging up on a person is unrecoverable;
wasting fifteen seconds on a voicemail costs nothing. So you only hang up on an
EXPLICIT sign from the list below, never on an impression.

The instant you detect any of these, call endCall. No words. Just hang up.

VOICEMAIL:
- "You have reached the voicemail of..." / "Please leave a message after the beep"
- "I'm not available" / "I can't come to the phone right now"
- A beep following a recorded message
- 5+ seconds of silence at the very start

IVR / PHONE MENU:
- "Press 1 for..." / "For sales, press 2..." / "Para español..."
- "Thank you for calling [business]. Our hours are..."
- "Please hold while we connect your call"
- Any automated voice reading out a menu

AI ASSISTANT:
- It introduces itself as a virtual or automated assistant
- It reads out a menu, or repeats the same sentence word for word

A "too polished" voice proves NOTHING: an experienced receptionist picks up a
thousand times a day and sounds exactly like that. It is not a reason to hang up.

Real humans pause slightly, say something short — "Hello?", "Yeah?", "[Business name]", their own name. That's your green light.`,
};

/** Le bloc de détection, dans la langue de l'appel. */
export function machineDetectionBlock(lang: ProspectingLanguage): string {
  return BLOCKS[lang];
}
