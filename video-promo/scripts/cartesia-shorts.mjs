// La série de vidéos courtes pour Instagram, TikTok et LinkedIn (src/shorts).
// Une vidéo = une idée, 15 à 25 secondes, dans le langage des deux pubs :
// Sarah raconte, la réceptionniste répond, l'appelant passe par un filtre
// téléphone. C'est le SEUL endroit qui dit ce que chaque vidéo raconte ; il
// écrit src/shorts/data.ts (textes + minutage réel de chaque mot).
//
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/cartesia-shorts.mjs
//   ONLY=s03,s07 ne refait que ces vidéos ; ONLY=none n'appelle pas l'API.
//
// Chaque phrase de réceptionniste décrit ce que le produit fait vraiment
// (voir CLAUDE.md) : reconnaître au numéro, prendre / déplacer / annuler,
// fr / en / nl, transférer une urgence, noter un message (pour qui, quand
// rappeler), ne pas inventer et apprendre la réponse, SMS de confirmation.
import fs from 'fs';
import { execFileSync } from 'child_process';
import { speak } from './cartesia-lib.mjs';

const SARAH = '90358bc7-3328-4b93-a942-d0447d7d4b5c'; // fr : narration ET réceptionniste
const GEMMA = '62ae83ad-4f6a-430b-af41-a9bede9286ca'; // en : britannique
const ISA = '60e94cf5-8069-459f-a91e-3ff852a51107'; // nl
// Par langue : qui raconte (et répond), et les deux appelants, filtrés téléphone.
const VOICES = {
  fr: { agent: SARAH, M: 'ce74c4da-4aee-435d-bc6d-81d1a9367e12' /* Marc */, F: '63fdecc2-4e1d-4aa3-a442-27204e3cd3b5' /* Léonie */ },
  en: { agent: GEMMA, M: 'ef191366-f52f-447a-a398-ed8c0f2943a1' /* Archie */, F: 'e8e5fffb-252c-436d-b842-8879b84445b6' /* Cathy */ },
  nl: { agent: ISA, M: 'da743a82-ddf2-4d9b-8eb8-ff67ca0b138e' /* Stijn */, F: '0eb213fe-4658-45bc-9442-33a48b24b133' /* Sanne */ },
};

const NB = '\u00a0'; // espace insécable : « ? » et « : » restent collés à leur mot
const agent = (say, emotion = 'content', extra = {}) => ({ who: 'agent', say, emotion, ...extra });
const caller = (voice, say, emotion = 'content') => ({ who: 'caller', voice, say, emotion });
const MARC = 'M', LEONIE = 'F';
// La scène des trois langues est la même partout : chaque langue garde SA voix.
const THREE = (fr, en, nl) => [agent(fr, 'content', { tag: 'FR', voice: SARAH, lang: 'fr' }), agent(en, 'content', { voice: GEMMA, lang: 'en', tag: 'EN' }), agent(nl, 'content', { voice: ISA, lang: 'nl', tag: 'NL' })];

const FR = [
  {
    id: 's01', slug: 'appel-manque', music: 20,
    scenes: [
      { visual: { kind: 'ring', name: 'Julie Martin', initials: 'JM', time: '20:12', footage: 'dough', missed: true },
        say: { text: 'Un appel manqué, c’est un client qui réserve ailleurs.', emotion: 'serious', serif: [8] } },
      { visual: { kind: 'orb' }, say: { text: 'Avec Qwillio, quelqu’un décroche. Toujours.', emotion: 'confident', serif: [4] },
        lines: [caller(LEONIE, `Bonsoir, vous auriez une table pour quatre ce soir${NB}?`), agent(`Bonsoir${NB}! Oui, à vingt heures trente. C’est à quel nom${NB}?`, 'happy')] },
      { visual: { kind: 'notif', title: 'Nouvelle réservation', desc: 'Julie Martin · 4 personnes · ce soir 20:30' },
        say: { text: 'Et la réservation arrive toute seule.', emotion: 'happy', serif: [5] } },
    ],
  },
  {
    id: 's02', slug: 'trois-heures', music: 45,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Il est trois heures du matin.', emotion: 'calm', serif: [5] } },
      { visual: { kind: 'ring', name: 'Numéro inconnu', initials: '?', time: '03:12' },
        say: { text: 'Votre cabinet est fermé. Le téléphone sonne.', emotion: 'calm', serif: [6] } },
      { visual: { kind: 'orb' },
        lines: [caller(MARC, 'Bonjour, je voudrais un rendez-vous pour un détartrage.'), agent(`Bien sûr. Je vous propose mardi à neuf heures, ça vous va${NB}?`, 'happy'), caller(MARC, 'Parfait, merci.')] },
      { visual: { kind: 'notif', title: 'Nouveau rendez-vous', desc: 'Détartrage · mardi 09:00' },
        say: { text: 'Vous dormez. Elle, non.', emotion: 'affectionate', serif: [3] } },
    ],
  },
  {
    id: 's03', slug: 'trois-langues', music: 70,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'À Bruxelles, vos clients ne parlent pas tous la même langue.', emotion: 'curious', serif: [10] } },
      { visual: { kind: 'langs' },
        lines: THREE('Bonjour, cabinet Delvaux, je vous écoute.', 'Hello, Delvaux practice, how can I help?', 'Goedendag, praktijk Delvaux, waarmee kan ik helpen?') },
      { visual: { kind: 'langs' }, say: { text: 'Elle répond dans la leur. Avec le bon accent.', emotion: 'happy', serif: [8] } },
    ],
  },
  {
    id: 's04', slug: 'reconnait', music: 95,
    scenes: [
      { visual: { kind: 'ring', name: 'Thomas Leroy', initials: 'TL', time: '10:24', footage: 'knead' },
        say: { text: `Et si votre téléphone savait qui appelle${NB}?`, emotion: 'curious', serif: [4] } },
      { visual: { kind: 'orb', chip: { name: 'Thomas Leroy', initials: 'TL', sub: 'Client connu · rendez-vous jeudi 10:00', badge: 'reconnu' } },
        lines: [agent(`Bonjour Monsieur Leroy${NB}! C’est pour votre rendez-vous de jeudi${NB}?`, 'happy'),
          caller(MARC, `Oui, je peux le décaler à vendredi${NB}?`),
          agent('C’est fait, vendredi même heure. Je vous envoie un SMS de confirmation.', 'content')] },
      { visual: { kind: 'notif', title: 'Rendez-vous déplacé', desc: 'Thomas Leroy · vendredi 10:00' },
        say: { text: 'Elle se souvient de vos clients. Comme vous.', emotion: 'affectionate', serif: [7] } },
    ],
  },
  {
    id: 's05', slug: 'urgence', music: 120,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Certains appels ne peuvent pas attendre.', emotion: 'serious', serif: [5] } },
      { visual: { kind: 'orb' },
        lines: [caller(LEONIE, `Bonjour, j’ai une fuite d’eau, c’est vraiment urgent${NB}!`, 'anxious'),
          agent('Je vous passe le responsable tout de suite, ne quittez pas.', 'serious')] },
      { visual: { kind: 'ring', name: 'Qwillio · urgence', initials: 'Q', sub: 'Mme Dubois · fuite d’eau', time: '21:05' },
        say: { text: 'Les urgences, elle vous les passe. Le reste, elle le gère.', emotion: 'confident', serif: [10] } },
    ],
  },
  {
    id: 's06', slug: 'invente-rien', music: 150,
    scenes: [
      { visual: { kind: 'type' }, say: { text: `La pire réceptionniste${NB}? Celle qui invente.`, emotion: 'serious', serif: [5] } },
      { visual: { kind: 'orb' },
        lines: [caller(MARC, `Vous acceptez les chèques-repas${NB}?`),
          agent('Je préfère ne pas vous dire de bêtise. Je pose la question, et on vous rappelle.', 'calm')] },
      { visual: { kind: 'learn', question: `Vous acceptez les chèques-repas${NB}?`, answer: 'Oui, tous les chèques-repas.' },
        say: { text: 'Vous répondez une fois. Elle le saura toujours.', emotion: 'confident', serif: [7] } },
    ],
  },
  {
    id: 's07', slug: 'message', music: 175,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Vous êtes avec un client. Le téléphone sonne.', emotion: 'calm', serif: [7] } },
      { visual: { kind: 'orb' },
        lines: [caller(LEONIE, `C’est pour Marc. Il peut me rappeler après dix-sept heures${NB}?`),
          agent('C’est noté pour Marc, après dix-sept heures. Je lui transmets.', 'content')] },
      { visual: { kind: 'message' }, say: { text: 'Le message arrive. Pour qui, et quand rappeler.', emotion: 'content', serif: [7] } },
    ],
  },
  {
    id: 's08', slug: 'annuler', music: 200,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Un rendez-vous annulé ne devrait pas vous coûter un appel.', emotion: 'confident', serif: [9] } },
      { visual: { kind: 'orb' },
        lines: [caller(MARC, 'Bonjour, je dois annuler mon rendez-vous de jeudi.'),
          agent(`C’est fait, votre rendez-vous de jeudi est annulé. Bonne journée${NB}!`, 'content')] },
      { visual: { kind: 'mac' }, say: { text: 'Elle prend, déplace et annule. Votre agenda suit.', emotion: 'happy', serif: [7] } },
    ],
  },
  {
    id: 's09', slug: 'coiffeur', music: 225,
    scenes: [
      { visual: { kind: 'ring', name: 'Sophie Lambert', initials: 'SL', time: '11:05' },
        say: { text: 'Les mains dans les cheveux, impossible de décrocher.', emotion: 'curious', serif: [7] } },
      { visual: { kind: 'orb' },
        lines: [caller(LEONIE, `Bonjour, une coupe samedi matin, c’est possible${NB}?`),
          agent(`Samedi à dix heures, c’est libre. C’est à quel nom${NB}?`, 'happy'),
          caller(LEONIE, 'Sophie Lambert.'),
          agent(`C’est réservé, Sophie. À samedi${NB}!`, 'happy')] },
      { visual: { kind: 'notif', title: 'Nouveau rendez-vous', desc: 'Sophie Lambert · coupe · samedi 10:00' },
        say: { text: 'Elle réserve pendant que vous coupez.', emotion: 'happy', serif: [5] } },
    ],
  },
  {
    id: 's10', slug: 'avant-apres', music: 250,
    scenes: [
      { visual: { kind: 'type', tag: 'AVANT' }, say: { text: 'Une messagerie pleine.', emotion: 'serious', serif: [2] } },
      { visual: { kind: 'ring', name: 'Numéro inconnu', initials: '?', time: '12:40', missed: true },
        say: { text: 'Des clients qui ne rappellent jamais.', emotion: 'serious', serif: [5] } },
      { visual: { kind: 'type', tag: 'APRÈS' }, say: { text: 'Chaque appel décroché.', emotion: 'confident', serif: [2] } },
      { visual: { kind: 'mac' }, say: { text: 'Et chaque rendez-vous dans l’agenda.', emotion: 'happy', serif: [4] } },
    ],
  },
  {
    id: 's11', slug: 'essayez', music: 275,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Ne nous croyez pas sur parole.', emotion: 'confident', serif: [5] } },
      { visual: { kind: 'orb' },
        lines: [agent(`Bonjour${NB}! Je suis la réceptionniste de Qwillio. Posez-moi une question, je vous écoute.`, 'happy')] },
      { visual: { kind: 'orb' }, say: { text: 'Appelez-la vous-même. Elle vous attend.', emotion: 'affectionate', serif: [4] } },
    ],
  },
];

// Les versions anglaise et néerlandaise : mêmes histoires, mêmes scènes. Le
// portail du MacBook est en français, donc les deux scènes qui le montrent
// (s08, s10) passent par une notification dans la langue de la vidéo.
// `serif` absent = le dernier mot en italique.
const EN = [
  { id: 's01', slug: 'missed-call', music: 20, scenes: [
    { visual: { kind: 'ring', name: 'Julie Martin', initials: 'JM', time: '20:12', footage: 'dough', missed: true }, say: { text: 'A missed call is a customer booking somewhere else.', emotion: 'serious' } },
    { visual: { kind: 'orb' }, say: { text: 'With Qwillio, someone always picks up.', emotion: 'confident', serif: [3] },
      lines: [caller('F', 'Hi, do you have a table for four tonight?'), agent('Good evening! Yes, at eight thirty. What name is it under?', 'happy')] },
    { visual: { kind: 'notif', title: 'New booking', desc: 'Julie Martin · 4 people · tonight 20:30' }, say: { text: 'And the booking just shows up.', emotion: 'happy' } },
  ] },
  { id: 's02', slug: '3am', music: 45, scenes: [
    { visual: { kind: 'type' }, say: { text: 'It’s three in the morning.', emotion: 'calm' } },
    { visual: { kind: 'ring', name: 'Unknown number', initials: '?', time: '03:12' }, say: { text: 'Your practice is closed. The phone rings.', emotion: 'calm' } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Hi, I’d like to book a dental cleaning.'), agent('Of course. How about Tuesday at nine?', 'happy'), caller('M', 'Perfect, thanks.')] },
    { visual: { kind: 'notif', title: 'New appointment', desc: 'Dental cleaning · Tuesday 09:00' }, say: { text: 'You’re asleep. She isn’t.', emotion: 'affectionate' } },
  ] },
  { id: 's03', slug: 'three-languages', music: 70, scenes: [
    { visual: { kind: 'type' }, say: { text: 'In Brussels, your customers don’t all speak the same language.', emotion: 'curious' } },
    { visual: { kind: 'langs' }, lines: THREE('Bonjour, cabinet Delvaux, je vous écoute.', 'Hello, Delvaux practice, how can I help?', 'Goedendag, praktijk Delvaux, waarmee kan ik helpen?') },
    { visual: { kind: 'langs' }, say: { text: 'She answers in theirs. With the right accent.', emotion: 'happy' } },
  ] },
  { id: 's04', slug: 'recognises', music: 95, scenes: [
    { visual: { kind: 'ring', name: 'Thomas Leroy', initials: 'TL', time: '10:24', footage: 'knead' }, say: { text: 'What if your phone knew who was calling?', emotion: 'curious', serif: [4] } },
    { visual: { kind: 'orb', chip: { name: 'Thomas Leroy', initials: 'TL', sub: 'Returning client · Thursday 10:00', badge: 'recognised' } },
      lines: [agent('Hello Mr Leroy! Is this about your appointment on Thursday?', 'happy'), caller('M', 'Yes, can I move it to Friday?'), agent('Done, Friday at the same time. I’ll text you a confirmation.')] },
    { visual: { kind: 'notif', title: 'Appointment moved', desc: 'Thomas Leroy · Friday 10:00' }, say: { text: 'She remembers your customers. Just like you do.', emotion: 'affectionate', serif: [3] } },
  ] },
  { id: 's05', slug: 'emergency', music: 120, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Some calls can’t wait.', emotion: 'serious' } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'Hello, I’ve got a water leak, it’s really urgent!', 'anxious'), agent('I’m putting you through to the manager right now, please hold.', 'serious')] },
    { visual: { kind: 'ring', name: 'Qwillio · urgent', initials: 'Q', sub: 'Mrs Dubois · water leak', time: '21:05' }, say: { text: 'Emergencies go straight to you. She handles the rest.', emotion: 'confident' } },
  ] },
  { id: 's06', slug: 'no-guessing', music: 150, scenes: [
    { visual: { kind: 'type' }, say: { text: `The worst receptionist? The one who makes things up.`, emotion: 'serious', serif: [6, 7, 8] } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Do you take meal vouchers?'), agent('I’d rather not guess. I’ll check, and we’ll call you back.', 'calm')] },
    { visual: { kind: 'learn', question: 'Do you take meal vouchers?', answer: 'Yes, all meal vouchers.' }, say: { text: 'Answer once. She’ll always know.', emotion: 'confident' } },
  ] },
  { id: 's07', slug: 'message', music: 175, scenes: [
    { visual: { kind: 'type' }, say: { text: 'You’re with a client. The phone rings.', emotion: 'calm' } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'It’s for Marc. Can he call me back after five?'), agent('Noted for Marc, after five. I’ll pass it on.')] },
    { visual: { kind: 'message' }, say: { text: 'The message arrives. Who it’s for, and when to call back.', emotion: 'content', serif: [9, 10] } },
  ] },
  { id: 's08', slug: 'cancel', music: 200, scenes: [
    { visual: { kind: 'type' }, say: { text: 'A cancellation shouldn’t cost you a phone call.', emotion: 'confident', serif: [6, 7] } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Hi, I need to cancel my appointment on Thursday.'), agent('Done, your Thursday appointment is cancelled. Have a nice day!')] },
    { visual: { kind: 'notif', title: 'Appointment cancelled', desc: 'Thursday 10:00 · slot freed up' }, say: { text: 'She books, moves and cancels. Your calendar keeps up.', emotion: 'happy', serif: [7, 8] } },
  ] },
  { id: 's09', slug: 'hairdresser', music: 225, scenes: [
    { visual: { kind: 'ring', name: 'Sophie Lambert', initials: 'SL', time: '11:05' }, say: { text: 'Hands in someone’s hair, no way to pick up.', emotion: 'curious', serif: [7, 8] } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'Hi, could I get a haircut on Saturday morning?'), agent('Saturday at ten is free. What name is it under?', 'happy'), caller('F', 'Sophie Lambert.'), agent('You’re booked, Sophie. See you Saturday!', 'happy')] },
    { visual: { kind: 'notif', title: 'New appointment', desc: 'Sophie Lambert · haircut · Saturday 10:00' }, say: { text: 'She books while you cut.', emotion: 'happy' } },
  ] },
  { id: 's10', slug: 'before-after', music: 250, scenes: [
    { visual: { kind: 'type', tag: 'BEFORE' }, say: { text: 'A full voicemail.', emotion: 'serious' } },
    { visual: { kind: 'ring', name: 'Unknown number', initials: '?', time: '12:40', missed: true }, say: { text: 'Customers who never call back.', emotion: 'serious', serif: [3, 4] } },
    { visual: { kind: 'type', tag: 'AFTER' }, say: { text: 'Every call answered.', emotion: 'confident' } },
    { visual: { kind: 'notif', title: 'New appointment', desc: 'Emma Janssens · Thursday 14:00' }, say: { text: 'And every appointment in the calendar.', emotion: 'happy' } },
  ] },
  { id: 's11', slug: 'try-her', music: 275, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Don’t take our word for it.', emotion: 'confident' } },
    { visual: { kind: 'orb' }, lines: [agent('Hello! I’m Qwillio’s receptionist. Ask me anything, I’m listening.', 'happy')] },
    { visual: { kind: 'orb' }, say: { text: 'Call her yourself. She’s waiting.', emotion: 'affectionate' } },
  ] },
];

const NL = [
  { id: 's01', slug: 'gemiste-oproep', music: 20, scenes: [
    { visual: { kind: 'ring', name: 'Julie Martin', initials: 'JM', time: '20:12', footage: 'dough', missed: true }, say: { text: 'Een gemiste oproep is een klant die ergens anders reserveert.', emotion: 'serious', serif: [7, 8] } },
    { visual: { kind: 'orb' }, say: { text: 'Met Qwillio neemt er altijd iemand op.', emotion: 'confident', serif: [4] },
      lines: [caller('F', 'Goedenavond, hebt u nog een tafel voor vier vanavond?'), agent('Goedenavond! Ja, om half negen. Op welke naam mag ik dat zetten?', 'happy')] },
    { visual: { kind: 'notif', title: 'Nieuwe reservering', desc: 'Julie Martin · 4 personen · vanavond 20:30' }, say: { text: 'En de reservering komt vanzelf binnen.', emotion: 'happy', serif: [4] } },
  ] },
  { id: 's02', slug: 'drie-uur', music: 45, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Het is drie uur ’s nachts.', emotion: 'calm' } },
    { visual: { kind: 'ring', name: 'Onbekend nummer', initials: '?', time: '03:12' }, say: { text: 'Je praktijk is gesloten. De telefoon gaat.', emotion: 'calm' } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Goedendag, ik wil graag een afspraak om tandsteen te laten verwijderen.'), agent('Natuurlijk. Past dinsdag om negen uur?', 'happy'), caller('M', 'Perfect, dank u.')] },
    { visual: { kind: 'notif', title: 'Nieuwe afspraak', desc: 'Tandsteen · dinsdag 09:00' }, say: { text: 'Jij slaapt. Zij niet.', emotion: 'affectionate' } },
  ] },
  { id: 's03', slug: 'drie-talen', music: 70, scenes: [
    { visual: { kind: 'type' }, say: { text: 'In Brussel spreken je klanten niet allemaal dezelfde taal.', emotion: 'curious' } },
    { visual: { kind: 'langs' }, lines: THREE('Bonjour, cabinet Delvaux, je vous écoute.', 'Hello, Delvaux practice, how can I help?', 'Goedendag, praktijk Delvaux, waarmee kan ik helpen?') },
    { visual: { kind: 'langs' }, say: { text: 'Zij antwoordt in de hunne. Met het juiste accent.', emotion: 'happy' } },
  ] },
  { id: 's04', slug: 'herkent', music: 95, scenes: [
    { visual: { kind: 'ring', name: 'Thomas Leroy', initials: 'TL', time: '10:24', footage: 'knead' }, say: { text: 'Wat als je telefoon wist wie er belt?', emotion: 'curious', serif: [4] } },
    { visual: { kind: 'orb', chip: { name: 'Thomas Leroy', initials: 'TL', sub: 'Vaste klant · donderdag 10:00', badge: 'herkend' } },
      lines: [agent('Dag meneer Leroy! Is het voor uw afspraak van donderdag?', 'happy'), caller('M', 'Ja, kan ik die naar vrijdag verzetten?'), agent('Geregeld, vrijdag op hetzelfde uur. U krijgt een bevestiging per sms.')] },
    { visual: { kind: 'notif', title: 'Afspraak verzet', desc: 'Thomas Leroy · vrijdag 10:00' }, say: { text: 'Ze onthoudt je klanten. Net als jij.', emotion: 'affectionate' } },
  ] },
  { id: 's05', slug: 'dringend', music: 120, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Sommige oproepen kunnen niet wachten.', emotion: 'serious' } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'Goedendag, ik heb een waterlek, het is echt dringend!', 'anxious'), agent('Ik verbind u meteen door met de verantwoordelijke, blijft u even aan de lijn.', 'serious')] },
    { visual: { kind: 'ring', name: 'Qwillio · dringend', initials: 'Q', sub: 'Mevr. Dubois · waterlek', time: '21:05' }, say: { text: 'Noodgevallen geeft ze aan jou door. De rest regelt ze zelf.', emotion: 'confident' } },
  ] },
  { id: 's06', slug: 'verzint-niets', music: 150, scenes: [
    { visual: { kind: 'type' }, say: { text: `De slechtste receptioniste${NB}? Die dingen verzint.`, emotion: 'serious' } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Aanvaardt u maaltijdcheques?'), agent('Ik wil u niets verkeerds zeggen. Ik vraag het na, en we bellen u terug.', 'calm')] },
    { visual: { kind: 'learn', question: 'Aanvaardt u maaltijdcheques?', answer: 'Ja, alle maaltijdcheques.' }, say: { text: 'Je antwoordt één keer. Zij weet het voorgoed.', emotion: 'confident' } },
  ] },
  { id: 's07', slug: 'bericht', music: 175, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Je bent bij een klant. De telefoon gaat.', emotion: 'calm' } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'Het is voor Marc. Kan hij me na vijf uur terugbellen?'), agent('Genoteerd voor Marc, na vijf uur. Ik geef het door.')] },
    { visual: { kind: 'message' }, say: { text: 'Het bericht komt binnen. Voor wie, en wanneer terugbellen.', emotion: 'content' } },
  ] },
  { id: 's08', slug: 'annuleren', music: 200, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Een annulering zou je geen telefoontje mogen kosten.', emotion: 'confident', serif: [5] } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Goedendag, ik moet mijn afspraak van donderdag annuleren.'), agent('Geregeld, uw afspraak van donderdag is geannuleerd. Nog een fijne dag!')] },
    { visual: { kind: 'notif', title: 'Afspraak geannuleerd', desc: 'Donderdag 10:00 · tijdslot vrijgekomen' }, say: { text: 'Ze boekt, verzet en annuleert. Je agenda volgt.', emotion: 'happy' } },
  ] },
  { id: 's09', slug: 'kapper', music: 225, scenes: [
    { visual: { kind: 'ring', name: 'Sophie Lambert', initials: 'SL', time: '11:05' }, say: { text: 'Handen in het haar, onmogelijk om op te nemen.', emotion: 'curious', serif: [4] } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'Goedendag, kan ik zaterdagochtend komen knippen?'), agent('Zaterdag om tien uur is vrij. Op welke naam?', 'happy'), caller('F', 'Sophie Lambert.'), agent('U staat genoteerd, Sophie. Tot zaterdag!', 'happy')] },
    { visual: { kind: 'notif', title: 'Nieuwe afspraak', desc: 'Sophie Lambert · knippen · zaterdag 10:00' }, say: { text: 'Ze boekt terwijl jij knipt.', emotion: 'happy' } },
  ] },
  { id: 's10', slug: 'voor-na', music: 250, scenes: [
    { visual: { kind: 'type', tag: 'VOOR' }, say: { text: 'Een volle voicemail.', emotion: 'serious' } },
    { visual: { kind: 'ring', name: 'Onbekend nummer', initials: '?', time: '12:40', missed: true }, say: { text: 'Klanten die nooit terugbellen.', emotion: 'serious', serif: [2, 3] } },
    { visual: { kind: 'type', tag: 'NA' }, say: { text: 'Elke oproep beantwoord.', emotion: 'confident' } },
    { visual: { kind: 'notif', title: 'Nieuwe afspraak', desc: 'Emma Janssens · donderdag 14:00' }, say: { text: 'En elke afspraak in je agenda.', emotion: 'happy' } },
  ] },
  { id: 's11', slug: 'probeer-haar', music: 275, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Geloof ons niet op ons woord.', emotion: 'confident' } },
    { visual: { kind: 'orb' }, lines: [agent('Goedendag! Ik ben de receptioniste van Qwillio. Stel me gerust een vraag, ik luister.', 'happy')] },
    { visual: { kind: 'orb' }, say: { text: 'Bel haar zelf. Ze wacht op je.', emotion: 'affectionate' } },
  ] },
];

const SCRIPTS = { fr: FR, en: EN, nl: NL };
const END = {
  fr: { text: 'Qwillio. Elle décroche quand vous ne pouvez pas.', show: 'Elle décroche quand vous ne pouvez pas.', emotion: 'affectionate', serif: [4, 5, 6] },
  en: { text: 'Qwillio. She picks up when you can’t.', show: 'She picks up when you can’t.', emotion: 'affectionate', serif: [5] },
  nl: { text: 'Qwillio. Zij neemt op als jij het niet kan.', show: 'Zij neemt op als jij het niet kan.', emotion: 'affectionate', serif: [6, 7] },
};

/* ------------------------------------------------------------------ la fabrication */

const DIR = 'public/voices/shorts';
fs.mkdirSync(DIR, { recursive: true });
// ONLY=en,nl ne fait que ces langues ; ONLY=en-s03 qu'une vidéo ; ONLY=end les fins.
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (lang, id) => !ONLY || ONLY.includes(lang) || ONLY.includes(`${lang}-${id}`);
const PREV = 'src/shorts/data.ts';
const prev = fs.existsSync(PREV) ? JSON.parse(fs.readFileSync(PREV, 'utf8').replace(/^[\s\S]*?const data = /, '').replace(/;\nexport default[\s\S]*$/, '')) : { end: {}, shorts: {} };
// L'ancien format ne connaissait que le français, sans préfixe de langue.
if (prev.end && prev.end.file) prev.end = { fr: prev.end };
for (const k of Object.keys(prev.shorts)) if (/^s\d+$/.test(k)) { prev.shorts[`fr-${k}`] = prev.shorts[k]; delete prev.shorts[k]; }

/** La ligne téléphonique : bande étroite, compressée, rééchantillonnée à 8 kHz. */
function phoneLine(file) {
  const tel = file.replace(/\.mp3$/, '-tel.mp3');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-af', 'highpass=f=320,lowpass=f=3300,acompressor=threshold=-18dB:ratio=4:attack=5:release=60,aresample=8000,aresample=44100,volume=1.5', tel]);
  return tel;
}

/** Les mots affichés, calés sur les mots dits (`show` peut en omettre au début). */
function shown(text, words) {
  const ws = text.split(' ');
  const lead = words.slice(Math.max(0, words.length - ws.length));
  return ws.map((w, i) => ({ w, start: +(lead.length === ws.length ? lead[i] : lead[Math.min(lead.length - 1, Math.floor((i / ws.length) * lead.length))]).start.toFixed(3) }));
}

async function narr(lang, name, l) {
  const s = await speak(VOICES[lang].agent, l.text, l.emotion, `${DIR}/${name}`, lang);
  const words = shown(l.show ?? l.text, s.words);
  return { file: `voices/shorts/${name}.mp3`, duration: +s.duration.toFixed(3), serif: l.serif ?? [words.length - 1], words };
}

const out = { end: {}, shorts: {} };
for (const lang of Object.keys(SCRIPTS)) {
  const endName = lang === 'fr' ? 'end' : `${lang}-end`;
  out.end[lang] = prev.end?.[lang] && !(ONLY && ONLY.includes(`${lang}-end`)) ? prev.end[lang] : await narr(lang, endName, END[lang]);
  for (const sh of SCRIPTS[lang]) {
    const key = `${lang}-${sh.id}`;
    if (prev.shorts[key] && !want(lang, sh.id)) { out.shorts[key] = prev.shorts[key]; continue; }
    if (!want(lang, sh.id)) continue;
    const pre = lang === 'fr' ? sh.id : `${lang}-${sh.id}`; // les fichiers français gardent leurs noms
    const scenes = [];
    for (const [i, sc] of sh.scenes.entries()) {
      const s = { visual: sc.visual };
      if (sc.say) s.say = await narr(lang, `${pre}-n${i}`, sc.say);
      if (sc.lines) {
        s.lines = [];
        for (const [j, l] of sc.lines.entries()) {
          const base = `${DIR}/${pre}-${i}-${j}`;
          const voice = l.who === 'caller' ? VOICES[lang][l.voice] : (l.voice ?? VOICES[lang].agent);
          const r = await speak(voice, l.say, l.emotion, base, l.lang ?? lang);
          const file = l.who === 'caller' ? phoneLine(`${base}.mp3`) : `${base}.mp3`;
          s.lines.push({ who: l.who, tag: l.tag, file: file.replace(/^public\//, ''), duration: +r.duration.toFixed(3), words: r.words.map((w) => ({ w: w.w, start: +w.start.toFixed(3) })) });
        }
      }
      scenes.push(s);
    }
    out.shorts[key] = { lang, slug: sh.slug, music: sh.music, scenes };
    console.log(key, sh.slug, 'ok');
  }
}
for (const k of Object.keys(out.shorts)) out.shorts[k].lang ??= k.slice(0, 2);
fs.mkdirSync('src/shorts', { recursive: true });
fs.writeFileSync(PREV, `// Généré par scripts/cartesia-shorts.mjs, ne pas éditer.\nconst data = ${JSON.stringify(out, null, 1)};\nexport default data as unknown as import('./types').ShortsData;\n`);
