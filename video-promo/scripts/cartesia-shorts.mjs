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
  // Accent de Paris exigé : Cartesia nomme l'accent de chaque voix (`accents`,
  // `country`). Marc et Léonie, pris d'abord, étaient fr-CA : québécois.
  fr: { agent: SARAH, M: 'bfd5390b-e4f9-4e44-95ab-9ebd223acd62' /* Pierre, fr-FR */, F: '735287ee-ce91-4b08-8de4-63315c5ba1fb' /* Emmanuelle, fr-FR */ },
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
        say: { text: 'Vous avez les mains dans la pâte, le téléphone sonne, et personne ne peut répondre. Ce client-là, il réservera ailleurs.', emotion: 'serious', title: 'Un appel manqué, c’est un client qui réserve ailleurs.', titleSerif: [8] } },
      { visual: { kind: 'orb' }, say: { text: 'Avec Qwillio, quelqu’un répond toujours. Écoutez plutôt.', emotion: 'confident', title: 'Avec Qwillio, quelqu’un décroche. Toujours.', titleSerif: [4] },
        lines: [caller(LEONIE, `Bonsoir, vous auriez une table pour quatre ce soir${NB}?`), agent(`Bonsoir${NB}! Oui, à vingt heures trente. C’est à quel nom${NB}?`, 'happy')] },
      { visual: { kind: 'notif', title: 'Nouvelle réservation', desc: 'Julie Martin · 4 personnes · ce soir 20:30' },
        say: { text: 'Et pendant que vous continuez à travailler, la réservation arrive directement sur votre téléphone.', emotion: 'happy', title: 'Et la réservation arrive toute seule.', titleSerif: [5] } },
    ],
  },
  {
    id: 's02', slug: 'trois-heures', music: 45,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Il est trois heures du matin, et votre cabinet est fermé depuis longtemps.', emotion: 'calm', title: 'Il est trois heures du matin.', titleSerif: [5] } },
      { visual: { kind: 'ring', name: 'Numéro inconnu', initials: '?', time: '03:12' },
        say: { text: 'Pourtant, quelqu’un appelle pour prendre rendez-vous.', emotion: 'calm', title: 'Votre cabinet est fermé. Le téléphone sonne.', titleSerif: [6] } },
      { visual: { kind: 'orb' },
        lines: [caller(MARC, 'Bonjour, je voudrais un rendez-vous pour un détartrage.'), agent(`Bien sûr. Je vous propose mardi à neuf heures, ça vous va${NB}?`, 'happy'), caller(MARC, 'Parfait, merci.')] },
      { visual: { kind: 'notif', title: 'Nouveau rendez-vous', desc: 'Détartrage · mardi 09:00' },
        say: { text: 'Vous, vous dormez. Elle a déjà tout noté dans votre agenda.', emotion: 'affectionate', title: 'Vous dormez. Elle, non.', titleSerif: [3] } },
    ],
  },
  {
    id: 's03', slug: 'trois-langues', music: 70,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'À Bruxelles, vos clients vous appellent en français, en néerlandais, et parfois en anglais.', emotion: 'curious', title: 'À Bruxelles, vos clients ne parlent pas tous la même langue.', titleSerif: [10] } },
      { visual: { kind: 'langs' },
        lines: THREE('Bonjour, cabinet Delvaux, je vous écoute.', 'Hello, Delvaux practice, how can I help?', 'Goedendag, praktijk Delvaux, waarmee kan ik helpen?') },
      { visual: { kind: 'langs' }, say: { text: 'Elle répond à chacun dans sa langue, avec le bon accent, sans jamais hésiter.', emotion: 'happy', title: 'Elle répond dans la leur. Avec le bon accent.', titleSerif: [8] } },
    ],
  },
  {
    id: 's04', slug: 'reconnait', music: 95,
    scenes: [
      { visual: { kind: 'ring', name: 'Thomas Leroy', initials: 'TL', time: '10:24', footage: 'knead' },
        say: { text: 'Et si votre téléphone savait déjà qui vous appelle ?', emotion: 'curious', title: 'Et si votre téléphone savait qui appelle\u00a0?', titleSerif: [4] } },
      { visual: { kind: 'orb', chip: { name: 'Thomas Leroy', initials: 'TL', sub: 'Client connu · rendez-vous jeudi 10:00', badge: 'reconnu' } },
        lines: [agent(`Bonjour Monsieur Leroy${NB}! C’est pour votre rendez-vous de jeudi${NB}?`, 'happy'),
          caller(MARC, `Oui, je peux le décaler à vendredi${NB}?`),
          agent('C’est fait, vendredi même heure. Je vous envoie un SMS de confirmation.', 'content')] },
      { visual: { kind: 'notif', title: 'Rendez-vous déplacé', desc: 'Thomas Leroy · vendredi 10:00' },
        say: { text: 'Elle reconnaît vos clients, se souvient de leurs rendez-vous, et s’occupe du reste.', emotion: 'affectionate', title: 'Elle se souvient de vos clients. Comme vous.', titleSerif: [7] } },
    ],
  },
  {
    id: 's05', slug: 'urgence', music: 120,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Il y a des appels qui ne peuvent vraiment pas attendre.', emotion: 'serious', title: 'Certains appels ne peuvent pas attendre.', titleSerif: [5] } },
      { visual: { kind: 'orb' },
        lines: [caller(LEONIE, `Bonjour, j’ai une fuite d’eau, c’est vraiment urgent${NB}!`, 'anxious'),
          agent('Je vous passe le responsable tout de suite, ne quittez pas.', 'serious')] },
      { visual: { kind: 'ring', name: 'Qwillio · urgence', initials: 'Q', sub: 'Mme Dubois · fuite d’eau', time: '21:05' },
        say: { text: 'Quand c’est urgent, elle vous passe l’appel tout de suite. Pour tout le reste, elle s’en charge.', emotion: 'confident', title: 'Les urgences, elle vous les passe. Le reste, elle le gère.', titleSerif: [10] } },
    ],
  },
  {
    id: 's06', slug: 'invente-rien', music: 150,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Le pire, pour une réceptionniste, c’est d’inventer une réponse.', emotion: 'serious', title: 'La pire réceptionniste\u00a0? Celle qui invente.', titleSerif: [5] } },
      { visual: { kind: 'orb' },
        lines: [caller(MARC, `Vous acceptez les chèques-repas${NB}?`),
          agent('Je préfère ne pas vous dire de bêtise. Je pose la question, et on vous rappelle.', 'calm')] },
      { visual: { kind: 'learn', question: `Vous acceptez les chèques-repas${NB}?`, answer: 'Oui, tous les chèques-repas.' },
        say: { text: 'Elle, quand elle ne sait pas, elle vous pose la question. Et la fois suivante, elle saura.', emotion: 'confident', title: 'Vous répondez une fois. Elle le saura toujours.', titleSerif: [7] } },
    ],
  },
  {
    id: 's07', slug: 'message', music: 175,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Vous êtes avec un client, et votre téléphone se met à sonner.', emotion: 'calm', title: 'Vous êtes avec un client. Le téléphone sonne.', titleSerif: [7] } },
      { visual: { kind: 'orb' },
        lines: [caller(LEONIE, `C’est pour Marc. Il peut me rappeler après dix-sept heures${NB}?`),
          agent('C’est noté pour Marc, après dix-sept heures. Je lui transmets.', 'content')] },
      { visual: { kind: 'message' }, say: { text: 'Pas de panique : le message vous attend, avec le nom, le numéro, et le bon moment pour rappeler.', emotion: 'content', title: 'Le message arrive. Pour qui, et quand rappeler.', titleSerif: [7] } },
    ],
  },
  {
    id: 's08', slug: 'annuler', music: 200,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Un client qui annule, ça ne devrait pas vous coûter un coup de fil.', emotion: 'confident', title: 'Un rendez-vous annulé ne devrait pas vous coûter un appel.', titleSerif: [9] } },
      { visual: { kind: 'orb' },
        lines: [caller(MARC, 'Bonjour, je dois annuler mon rendez-vous de jeudi.'),
          agent(`C’est fait, votre rendez-vous de jeudi est annulé. Bonne journée${NB}!`, 'content')] },
      { visual: { kind: 'mac' }, say: { text: 'Elle prend vos rendez-vous, les déplace, les annule, et votre agenda se met à jour tout seul.', emotion: 'happy', title: 'Elle prend, déplace et annule. Votre agenda suit.', titleSerif: [7] } },
    ],
  },
  {
    id: 's09', slug: 'coiffeur', music: 225,
    scenes: [
      { visual: { kind: 'ring', name: 'Sophie Lambert', initials: 'SL', time: '11:05' },
        say: { text: 'Quand on a les mains dans les cheveux d’une cliente, impossible de décrocher.', emotion: 'curious', title: 'Les mains dans les cheveux, impossible de décrocher.', titleSerif: [7] } },
      { visual: { kind: 'orb' },
        lines: [caller(LEONIE, `Bonjour, une coupe samedi matin, c’est possible${NB}?`),
          agent(`Samedi à dix heures, c’est libre. C’est à quel nom${NB}?`, 'happy'),
          caller(LEONIE, 'Sophie Lambert.'),
          agent(`C’est réservé, Sophie. À samedi${NB}!`, 'happy')] },
      { visual: { kind: 'notif', title: 'Nouveau rendez-vous', desc: 'Sophie Lambert · coupe · samedi 10:00' },
        say: { text: 'Elle, elle réserve pendant que vous coupez.', emotion: 'happy', title: 'Elle réserve pendant que vous coupez.', titleSerif: [5] } },
    ],
  },
  {
    id: 's10', slug: 'avant-apres', music: 250,
    scenes: [
      { visual: { kind: 'type', tag: 'AVANT' }, say: { text: 'Avant, c’était une messagerie pleine…', emotion: 'serious', title: 'Une messagerie pleine.', titleSerif: [2] } },
      { visual: { kind: 'ring', name: 'Numéro inconnu', initials: '?', time: '12:40', missed: true },
        say: { text: '… et des clients qui ne rappelaient jamais.', emotion: 'serious', title: 'Des clients qui ne rappellent jamais.', titleSerif: [5] } },
      { visual: { kind: 'type', tag: 'APRÈS' }, say: { text: 'Aujourd’hui, chaque appel trouve une réponse.', emotion: 'confident', title: 'Chaque appel décroché.', titleSerif: [2] } },
      { visual: { kind: 'mac' }, say: { text: 'Et chaque rendez-vous arrive directement dans votre agenda.', emotion: 'happy', title: 'Et chaque rendez-vous dans l’agenda.', titleSerif: [4] } },
    ],
  },
  {
    id: 's11', slug: 'essayez', music: 275,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Vous n’êtes pas obligé de nous croire sur parole.', emotion: 'confident', title: 'Ne nous croyez pas sur parole.', titleSerif: [5] } },
      { visual: { kind: 'orb' },
        lines: [agent(`Bonjour${NB}! Je suis la réceptionniste de Qwillio. Posez-moi une question, je vous écoute.`, 'happy')] },
      { visual: { kind: 'orb' }, say: { text: 'Appelez-la vous-même. Elle vous attend.', emotion: 'affectionate', title: 'Appelez-la vous-même. Elle vous attend.', titleSerif: [4] } },
    ],
  },
];

// Les versions anglaise et néerlandaise : mêmes histoires, mêmes scènes. Le
// portail du MacBook est en français, donc les deux scènes qui le montrent
// (s08, s10) passent par une notification dans la langue de la vidéo.
// `serif` absent = le dernier mot en italique.
const EN = [
  { id: 's01', slug: 'missed-call', music: 20, scenes: [
    { visual: { kind: 'ring', name: 'Julie Martin', initials: 'JM', time: '20:12', footage: 'dough', missed: true }, say: { text: 'Your hands are in the dough, the phone rings, and nobody can pick up. That customer will book somewhere else.', emotion: 'serious', title: 'A missed call is a customer booking somewhere else.', titleSerif: [8] } },
    { visual: { kind: 'orb' }, say: { text: 'With Qwillio, someone always answers. Have a listen.', emotion: 'confident', title: 'With Qwillio, someone always picks up.', titleSerif: [3] },
      lines: [caller('F', 'Hi, do you have a table for four tonight?'), agent('Good evening! Yes, at eight thirty. What name is it under?', 'happy')] },
    { visual: { kind: 'notif', title: 'New booking', desc: 'Julie Martin · 4 people · tonight 20:30' }, say: { text: 'And while you keep working, the booking lands straight on your phone.', emotion: 'happy', title: 'And the booking just shows up.', titleSerif: [5] } },
  ] },
  { id: 's02', slug: '3am', music: 45, scenes: [
    { visual: { kind: 'type' }, say: { text: 'It’s three in the morning, and your practice closed hours ago.', emotion: 'calm', title: 'It’s three in the morning.', titleSerif: [4] } },
    { visual: { kind: 'ring', name: 'Unknown number', initials: '?', time: '03:12' }, say: { text: 'And yet, someone is calling to book an appointment.', emotion: 'calm', title: 'Your practice is closed. The phone rings.', titleSerif: [6] } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Hi, I’d like to book a dental cleaning.'), agent('Of course. How about Tuesday at nine?', 'happy'), caller('M', 'Perfect, thanks.')] },
    { visual: { kind: 'notif', title: 'New appointment', desc: 'Dental cleaning · Tuesday 09:00' }, say: { text: 'You’re fast asleep. She’s already put it in your calendar.', emotion: 'affectionate', title: 'You’re asleep. She isn’t.', titleSerif: [3] } },
  ] },
  { id: 's03', slug: 'three-languages', music: 70, scenes: [
    { visual: { kind: 'type' }, say: { text: 'In Brussels, your customers call in French, in Dutch, and sometimes in English.', emotion: 'curious', title: 'In Brussels, your customers don’t all speak the same language.', titleSerif: [9] } },
    { visual: { kind: 'langs' }, lines: THREE('Bonjour, cabinet Delvaux, je vous écoute.', 'Hello, Delvaux practice, how can I help?', 'Goedendag, praktijk Delvaux, waarmee kan ik helpen?') },
    { visual: { kind: 'langs' }, say: { text: 'She answers each of them in their own language, with the right accent.', emotion: 'happy', title: 'She answers in theirs. With the right accent.', titleSerif: [7] } },
  ] },
  { id: 's04', slug: 'recognises', music: 95, scenes: [
    { visual: { kind: 'ring', name: 'Thomas Leroy', initials: 'TL', time: '10:24', footage: 'knead' }, say: { text: 'What if your phone already knew who was calling?', emotion: 'curious', title: 'What if your phone knew who was calling?', titleSerif: [4] } },
    { visual: { kind: 'orb', chip: { name: 'Thomas Leroy', initials: 'TL', sub: 'Returning client · Thursday 10:00', badge: 'recognised' } },
      lines: [agent('Hello Mr Leroy! Is this about your appointment on Thursday?', 'happy'), caller('M', 'Yes, can I move it to Friday?'), agent('Done, Friday at the same time. I’ll text you a confirmation.')] },
    { visual: { kind: 'notif', title: 'Appointment moved', desc: 'Thomas Leroy · Friday 10:00' }, say: { text: 'She recognises your customers, remembers their appointments, and takes care of the rest.', emotion: 'affectionate', title: 'She remembers your customers. Just like you do.', titleSerif: [3] } },
  ] },
  { id: 's05', slug: 'emergency', music: 120, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Some calls really can’t wait.', emotion: 'serious', title: 'Some calls can’t wait.', titleSerif: [3] } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'Hello, I’ve got a water leak, it’s really urgent!', 'anxious'), agent('I’m putting you through to the manager right now, please hold.', 'serious')] },
    { visual: { kind: 'ring', name: 'Qwillio · urgent', initials: 'Q', sub: 'Mrs Dubois · water leak', time: '21:05' }, say: { text: 'When it’s urgent, she puts the call straight through to you. Everything else, she handles.', emotion: 'confident', title: 'Emergencies go straight to you. She handles the rest.', titleSerif: [8] } },
  ] },
  { id: 's06', slug: 'no-guessing', music: 150, scenes: [
    { visual: { kind: 'type' }, say: { text: 'The worst thing a receptionist can do is make up an answer.', emotion: 'serious', title: 'The worst receptionist? The one who makes things up.', titleSerif: [6, 7, 8] } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Do you take meal vouchers?'), agent('I’d rather not guess. I’ll check, and we’ll call you back.', 'calm')] },
    { visual: { kind: 'learn', question: 'Do you take meal vouchers?', answer: 'Yes, all meal vouchers.' }, say: { text: 'When she doesn’t know, she asks you. And next time, she’ll know.', emotion: 'confident', title: 'Answer once. She’ll always know.', titleSerif: [4] } },
  ] },
  { id: 's07', slug: 'message', music: 175, scenes: [
    { visual: { kind: 'type' }, say: { text: 'You’re with a client, and your phone starts ringing.', emotion: 'calm', title: 'You’re with a client. The phone rings.', titleSerif: [6] } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'It’s for Marc. Can he call me back after five?'), agent('Noted for Marc, after five. I’ll pass it on.')] },
    { visual: { kind: 'message' }, say: { text: 'No stress: the message is waiting for you, with the name, the number, and the right time to call back.', emotion: 'content', title: 'The message arrives. Who it’s for, and when to call back.', titleSerif: [9, 10] } },
  ] },
  { id: 's08', slug: 'cancel', music: 200, scenes: [
    { visual: { kind: 'type' }, say: { text: 'A cancellation shouldn’t cost you a phone call.', emotion: 'confident', title: 'A cancellation shouldn’t cost you a phone call.', titleSerif: [6, 7] } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Hi, I need to cancel my appointment on Thursday.'), agent('Done, your Thursday appointment is cancelled. Have a nice day!')] },
    { visual: { kind: 'notif', title: 'Appointment cancelled', desc: 'Thursday 10:00 · slot freed up' }, say: { text: 'She books, moves and cancels your appointments, and your calendar updates itself.', emotion: 'happy', title: 'She books, moves and cancels. Your calendar keeps up.', titleSerif: [7, 8] } },
  ] },
  { id: 's09', slug: 'hairdresser', music: 225, scenes: [
    { visual: { kind: 'ring', name: 'Sophie Lambert', initials: 'SL', time: '11:05' }, say: { text: 'With your hands in a client’s hair, there’s no way to pick up.', emotion: 'curious', title: 'Hands in someone’s hair, no way to pick up.', titleSerif: [7, 8] } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'Hi, could I get a haircut on Saturday morning?'), agent('Saturday at ten is free. What name is it under?', 'happy'), caller('F', 'Sophie Lambert.'), agent('You’re booked, Sophie. See you Saturday!', 'happy')] },
    { visual: { kind: 'notif', title: 'New appointment', desc: 'Sophie Lambert · haircut · Saturday 10:00' }, say: { text: 'She takes the booking while you cut.', emotion: 'happy', title: 'She books while you cut.', titleSerif: [4] } },
  ] },
  { id: 's10', slug: 'before-after', music: 250, scenes: [
    { visual: { kind: 'type', tag: 'BEFORE' }, say: { text: 'Before, it was a full voicemail…', emotion: 'serious', title: 'A full voicemail.', titleSerif: [2] } },
    { visual: { kind: 'ring', name: 'Unknown number', initials: '?', time: '12:40', missed: true }, say: { text: '… and customers who never called back.', emotion: 'serious', title: 'Customers who never call back.', titleSerif: [3, 4] } },
    { visual: { kind: 'type', tag: 'AFTER' }, say: { text: 'Now, every call gets an answer.', emotion: 'confident', title: 'Every call answered.', titleSerif: [2] } },
    { visual: { kind: 'notif', title: 'New appointment', desc: 'Emma Janssens · Thursday 14:00' }, say: { text: 'And every appointment lands straight in your calendar.', emotion: 'happy', title: 'And every appointment in the calendar.', titleSerif: [5] } },
  ] },
  { id: 's11', slug: 'try-her', music: 275, scenes: [
    { visual: { kind: 'type' }, say: { text: 'You don’t have to take our word for it.', emotion: 'confident', title: 'Don’t take our word for it.', titleSerif: [5] } },
    { visual: { kind: 'orb' }, lines: [agent('Hello! I’m Qwillio’s receptionist. Ask me anything, I’m listening.', 'happy')] },
    { visual: { kind: 'orb' }, say: { text: 'Call her yourself. She’s waiting.', emotion: 'affectionate', title: 'Call her yourself. She’s waiting.', titleSerif: [4] } },
  ] },
];

const NL = [
  { id: 's01', slug: 'gemiste-oproep', music: 20, scenes: [
    { visual: { kind: 'ring', name: 'Julie Martin', initials: 'JM', time: '20:12', footage: 'dough', missed: true }, say: { text: 'Je handen zitten in het deeg, de telefoon gaat, en niemand kan opnemen. Die klant reserveert ergens anders.', emotion: 'serious', title: 'Een gemiste oproep is een klant die ergens anders reserveert.', titleSerif: [7, 8] } },
    { visual: { kind: 'orb' }, say: { text: 'Met Qwillio neemt er altijd iemand op. Luister maar.', emotion: 'confident', title: 'Met Qwillio neemt er altijd iemand op.', titleSerif: [4] },
      lines: [caller('F', 'Goedenavond, hebt u nog een tafel voor vier vanavond?'), agent('Goedenavond! Ja, om half negen. Op welke naam mag ik dat zetten?', 'happy')] },
    { visual: { kind: 'notif', title: 'Nieuwe reservering', desc: 'Julie Martin · 4 personen · vanavond 20:30' }, say: { text: 'En terwijl jij verder werkt, komt de reservering gewoon op je telefoon binnen.', emotion: 'happy', title: 'En de reservering komt vanzelf binnen.', titleSerif: [4] } },
  ] },
  { id: 's02', slug: 'drie-uur', music: 45, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Het is drie uur ’s nachts, en je praktijk is al lang dicht.', emotion: 'calm', title: 'Het is drie uur ’s nachts.', titleSerif: [4] } },
    { visual: { kind: 'ring', name: 'Onbekend nummer', initials: '?', time: '03:12' }, say: { text: 'Toch belt er iemand om een afspraak te maken.', emotion: 'calm', title: 'Je praktijk is gesloten. De telefoon gaat.', titleSerif: [6] } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Goedendag, ik wil graag een afspraak om tandsteen te laten verwijderen.'), agent('Natuurlijk. Past dinsdag om negen uur?', 'happy'), caller('M', 'Perfect, dank u.')] },
    { visual: { kind: 'notif', title: 'Nieuwe afspraak', desc: 'Tandsteen · dinsdag 09:00' }, say: { text: 'Jij slaapt. Zij heeft het al in je agenda gezet.', emotion: 'affectionate', title: 'Jij slaapt. Zij niet.', titleSerif: [3] } },
  ] },
  { id: 's03', slug: 'drie-talen', music: 70, scenes: [
    { visual: { kind: 'type' }, say: { text: 'In Brussel bellen je klanten in het Frans, in het Nederlands, en soms in het Engels.', emotion: 'curious', title: 'In Brussel spreken je klanten niet allemaal dezelfde taal.', titleSerif: [8] } },
    { visual: { kind: 'langs' }, lines: THREE('Bonjour, cabinet Delvaux, je vous écoute.', 'Hello, Delvaux practice, how can I help?', 'Goedendag, praktijk Delvaux, waarmee kan ik helpen?') },
    { visual: { kind: 'langs' }, say: { text: 'Zij antwoordt iedereen in zijn eigen taal, met het juiste accent.', emotion: 'happy', title: 'Zij antwoordt in de hunne. Met het juiste accent.', titleSerif: [7] } },
  ] },
  { id: 's04', slug: 'herkent', music: 95, scenes: [
    { visual: { kind: 'ring', name: 'Thomas Leroy', initials: 'TL', time: '10:24', footage: 'knead' }, say: { text: 'Wat als je telefoon al wist wie er belt?', emotion: 'curious', title: 'Wat als je telefoon wist wie er belt?', titleSerif: [4] } },
    { visual: { kind: 'orb', chip: { name: 'Thomas Leroy', initials: 'TL', sub: 'Vaste klant · donderdag 10:00', badge: 'herkend' } },
      lines: [agent('Dag meneer Leroy! Is het voor uw afspraak van donderdag?', 'happy'), caller('M', 'Ja, kan ik die naar vrijdag verzetten?'), agent('Geregeld, vrijdag op hetzelfde uur. U krijgt een bevestiging per sms.')] },
    { visual: { kind: 'notif', title: 'Afspraak verzet', desc: 'Thomas Leroy · vrijdag 10:00' }, say: { text: 'Ze herkent je klanten, onthoudt hun afspraken, en regelt de rest.', emotion: 'affectionate', title: 'Ze onthoudt je klanten. Net als jij.', titleSerif: [5] } },
  ] },
  { id: 's05', slug: 'dringend', music: 120, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Sommige oproepen kunnen echt niet wachten.', emotion: 'serious', title: 'Sommige oproepen kunnen niet wachten.', titleSerif: [4] } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'Goedendag, ik heb een waterlek, het is echt dringend!', 'anxious'), agent('Ik verbind u meteen door met de verantwoordelijke, blijft u even aan de lijn.', 'serious')] },
    { visual: { kind: 'ring', name: 'Qwillio · dringend', initials: 'Q', sub: 'Mevr. Dubois · waterlek', time: '21:05' }, say: { text: 'Is het dringend, dan verbindt ze je meteen door. Al de rest regelt ze zelf.', emotion: 'confident', title: 'Noodgevallen geeft ze aan jou door. De rest regelt ze zelf.', titleSerif: [10] } },
  ] },
  { id: 's06', slug: 'verzint-niets', music: 150, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Het ergste wat een receptioniste kan doen, is een antwoord verzinnen.', emotion: 'serious', title: 'De slechtste receptioniste\u00a0? Die dingen verzint.', titleSerif: [5] } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Aanvaardt u maaltijdcheques?'), agent('Ik wil u niets verkeerds zeggen. Ik vraag het na, en we bellen u terug.', 'calm')] },
    { visual: { kind: 'learn', question: 'Aanvaardt u maaltijdcheques?', answer: 'Ja, alle maaltijdcheques.' }, say: { text: 'Weet zij het niet, dan vraagt ze het aan jou. En de volgende keer weet ze het.', emotion: 'confident', title: 'Je antwoordt één keer. Zij weet het voorgoed.', titleSerif: [7] } },
  ] },
  { id: 's07', slug: 'bericht', music: 175, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Je zit bij een klant, en je telefoon begint te rinkelen.', emotion: 'calm', title: 'Je bent bij een klant. De telefoon gaat.', titleSerif: [7] } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'Het is voor Marc. Kan hij me na vijf uur terugbellen?'), agent('Genoteerd voor Marc, na vijf uur. Ik geef het door.')] },
    { visual: { kind: 'message' }, say: { text: 'Geen stress: het bericht staat klaar, met de naam, het nummer, en het juiste moment om terug te bellen.', emotion: 'content', title: 'Het bericht komt binnen. Voor wie, en wanneer terugbellen.', titleSerif: [8] } },
  ] },
  { id: 's08', slug: 'annuleren', music: 200, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Een annulering zou je geen telefoontje mogen kosten.', emotion: 'confident', title: 'Een annulering zou je geen telefoontje mogen kosten.', titleSerif: [5] } },
    { visual: { kind: 'orb' }, lines: [caller('M', 'Goedendag, ik moet mijn afspraak van donderdag annuleren.'), agent('Geregeld, uw afspraak van donderdag is geannuleerd. Nog een fijne dag!')] },
    { visual: { kind: 'notif', title: 'Afspraak geannuleerd', desc: 'Donderdag 10:00 · tijdslot vrijgekomen' }, say: { text: 'Ze boekt, verzet en annuleert je afspraken, en je agenda past zich vanzelf aan.', emotion: 'happy', title: 'Ze boekt, verzet en annuleert. Je agenda volgt.', titleSerif: [7] } },
  ] },
  { id: 's09', slug: 'kapper', music: 225, scenes: [
    { visual: { kind: 'ring', name: 'Sophie Lambert', initials: 'SL', time: '11:05' }, say: { text: 'Met je handen in het haar van een klant kun je onmogelijk opnemen.', emotion: 'curious', title: 'Handen in het haar, onmogelijk om op te nemen.', titleSerif: [4] } },
    { visual: { kind: 'orb' }, lines: [caller('F', 'Goedendag, kan ik zaterdagochtend komen knippen?'), agent('Zaterdag om tien uur is vrij. Op welke naam?', 'happy'), caller('F', 'Sophie Lambert.'), agent('U staat genoteerd, Sophie. Tot zaterdag!', 'happy')] },
    { visual: { kind: 'notif', title: 'Nieuwe afspraak', desc: 'Sophie Lambert · knippen · zaterdag 10:00' }, say: { text: 'Zij boekt terwijl jij knipt.', emotion: 'happy', title: 'Ze boekt terwijl jij knipt.', titleSerif: [4] } },
  ] },
  { id: 's10', slug: 'voor-na', music: 250, scenes: [
    { visual: { kind: 'type', tag: 'VOOR' }, say: { text: 'Vroeger was het een volle voicemail…', emotion: 'serious', title: 'Een volle voicemail.', titleSerif: [2] } },
    { visual: { kind: 'ring', name: 'Onbekend nummer', initials: '?', time: '12:40', missed: true }, say: { text: '… en klanten die nooit terugbelden.', emotion: 'serious', title: 'Klanten die nooit terugbellen.', titleSerif: [2, 3] } },
    { visual: { kind: 'type', tag: 'NA' }, say: { text: 'Nu krijgt elke oproep een antwoord.', emotion: 'confident', title: 'Elke oproep beantwoord.', titleSerif: [2] } },
    { visual: { kind: 'notif', title: 'Nieuwe afspraak', desc: 'Emma Janssens · donderdag 14:00' }, say: { text: 'En elke afspraak komt meteen in je agenda.', emotion: 'happy', title: 'En elke afspraak in je agenda.', titleSerif: [5] } },
  ] },
  { id: 's11', slug: 'probeer-haar', music: 275, scenes: [
    { visual: { kind: 'type' }, say: { text: 'Je hoeft ons niet op ons woord te geloven.', emotion: 'confident', title: 'Geloof ons niet op ons woord.', titleSerif: [5] } },
    { visual: { kind: 'orb' }, lines: [agent('Goedendag! Ik ben de receptioniste van Qwillio. Stel me gerust een vraag, ik luister.', 'happy')] },
    { visual: { kind: 'orb' }, say: { text: 'Bel haar zelf. Ze wacht op je.', emotion: 'affectionate', title: 'Bel haar zelf. Ze wacht op je.', titleSerif: [5] } },
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

/**
 * RECOVER=1 : ne rien demander à Cartesia, relire les MP3 déjà fabriqués.
 * Le 09/11, le crédit Cartesia s'est épuisé à la fin d'une génération : les MP3
 * étaient écrits, le minutage des mots (qui ne vit que dans data.ts) était perdu.
 * Le minutage est alors ESTIMÉ : les silences de l'audio (ffmpeg silencedetect)
 * donnent le temps parlé, et chaque mot y prend une place proportionnelle à sa
 * longueur. Assez juste pour des sous-titres, pas une vérité. Un fichier plus
 * ancien que data.ts n'a pas été refait : il garde l'entrée d'avant.
 */
const RECOVER = !!process.env.RECOVER;
const DATA_TIME = fs.existsSync('src/shorts/data.ts') ? fs.statSync('src/shorts/data.ts').mtimeMs : 0;
const fresh = (mp3) => fs.existsSync(mp3) && fs.statSync(mp3).mtimeMs > DATA_TIME;
function estimate(text, mp3) {
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString();
  const out = execFileSync('bash', ['-c', `ffmpeg -nostats -i "${mp3}" -af silencedetect=noise=-38dB:d=0.12 -f null - 2>&1`]).toString();
  const sil = [];
  let st = null;
  for (const line of out.split('\n')) {
    const a = line.match(/silence_start: ([\d.]+)/); if (a) st = +a[1];
    const b = line.match(/silence_end: ([\d.]+)/); if (b && st !== null) { sil.push([st, +b[1]]); st = null; }
  }
  if (st !== null) sil.push([st, dur]);
  // les passages parlés
  const speech = [];
  let cur = 0;
  for (const [a, b] of sil.sort((x, y) => x[0] - y[0])) { if (a > cur + 0.02) speech.push([cur, a]); cur = Math.max(cur, b); }
  if (cur < dur - 0.02) speech.push([cur, dur]);
  const total = speech.reduce((n, [a, b]) => n + b - a, 0) || dur;
  const at = (x) => { // x secondes de parole -> temps réel
    for (const [a, b] of speech) { if (x <= b - a) return a + x; x -= b - a; }
    return dur;
  };
  const ws = text.split(' ');
  const len = ws.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1);
  const all = len.reduce((a, b) => a + b, 0);
  let acc = 0;
  const words = ws.map((w, i) => { const t = at((acc / all) * total); acc += len[i]; return { w, start: +t.toFixed(3) }; });
  return { duration: dur, words };
}

/** Une prise existante se garde si son texte n'a pas bougé et que son
 * minutage est réel (pas estimé) : on ne repaie pas Cartesia pour rien. */
const same = (entry, text) => entry && !entry.estimated && entry.words.map((w) => w.w).join(' ').replace(/\s+/g, ' ') === text.replace(/\s+/g, ' ');

/** Le titre affiché : la voix dit une vraie phrase, l'écran garde le titre court
 * (retour du propriétaire : « des vraies phrases à l'audio, mais les mêmes
 * titres que avant en texte »). Il ne coûte rien, il n'est pas synthétisé. */
const titled = (r, l) => (r && l.title ? { ...r, title: l.title, titleSerif: l.titleSerif ?? [] } : r);

async function narr(lang, name, l, old) {
  if (!RECOVER && same(old, l.show ?? l.text) && fs.existsSync(`public/${old.file}`)) return titled(old, l);
  if (RECOVER) {
    const mp3 = `${DIR}/${name}.mp3`;
    if (!fresh(mp3)) return null; // pas refait : l'appelant garde l'entrée d'avant
    const e = estimate(l.show ?? l.text, mp3);
    return { file: `voices/shorts/${name}.mp3`, duration: +e.duration.toFixed(3), serif: l.serif ?? [e.words.length - 1], words: e.words, estimated: true };
  }
  const s = await speak(VOICES[lang].agent, l.text, l.emotion, `${DIR}/${name}`, lang);
  const words = shown(l.show ?? l.text, s.words);
  return titled({ file: `voices/shorts/${name}.mp3`, duration: +s.duration.toFixed(3), serif: l.serif ?? [words.length - 1], words }, l);
}

const out = { end: {}, shorts: {} };
function save() {
  const all = { end: { ...prev.end, ...out.end }, shorts: { ...prev.shorts, ...out.shorts } };
  for (const k of Object.keys(all.shorts)) all.shorts[k].lang ??= k.slice(0, 2);
  fs.mkdirSync('src/shorts', { recursive: true });
  fs.writeFileSync(PREV, `// Généré par scripts/cartesia-shorts.mjs, ne pas éditer.\nconst data = ${JSON.stringify(all, null, 1)};\nexport default data as unknown as import('./types').ShortsData;\n`);
}
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
      if (sc.say) s.say = (await narr(lang, `${pre}-n${i}`, sc.say, prev.shorts[key]?.scenes?.[i]?.say)) ?? prev.shorts[key]?.scenes?.[i]?.say;
      if (sc.lines) {
        s.lines = [];
        for (const [j, l] of sc.lines.entries()) {
          const base = `${DIR}/${pre}-${i}-${j}`;
          const voice = l.who === 'caller' ? VOICES[lang][l.voice] : (l.voice ?? VOICES[lang].agent);
          if (RECOVER) {
            const old = prev.shorts[key]?.scenes?.[i]?.lines?.[j];
            if (!fresh(`${base}.mp3`)) { if (old) s.lines.push(old); continue; }
            const e = estimate(l.say, `${base}.mp3`);
            const file = l.who === 'caller' ? `${base}-tel.mp3` : `${base}.mp3`;
            s.lines.push({ who: l.who, tag: l.tag, file: file.replace(/^public\//, ''), duration: +e.duration.toFixed(3), words: e.words, estimated: true });
            continue;
          }
          const was = prev.shorts[key]?.scenes?.[i]?.lines?.[j];
          if (same(was, l.say) && fs.existsSync(`public/${was.file}`)) { s.lines.push(was); continue; }
          const r = await speak(voice, l.say, l.emotion, base, l.lang ?? lang);
          const file = l.who === 'caller' ? phoneLine(`${base}.mp3`) : `${base}.mp3`;
          s.lines.push({ who: l.who, tag: l.tag, file: file.replace(/^public\//, ''), duration: +r.duration.toFixed(3), words: r.words.map((w) => ({ w: w.w, start: +w.start.toFixed(3) })) });
        }
      }
      scenes.push(s);
    }
    out.shorts[key] = { lang, slug: sh.slug, music: sh.music, scenes };
    console.log(key, sh.slug, 'ok');
    save(); // à chaque vidéo : si Cartesia refuse au milieu, le minutage déjà payé reste
  }
}
save();
