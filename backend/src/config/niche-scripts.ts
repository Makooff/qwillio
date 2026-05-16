// ═══════════════════════════════════════════════════════════
// NICHE-SPECIFIC SALES SCRIPTS FOR ASHLEY
// Rewritten 2026-04 for natural, fast, concise delivery.
// No filler words ("um", "eeh", "sorry to catch you", "real quick").
// Direct, confident, benefit-first. Target: 6–8s opening.
// ═══════════════════════════════════════════════════════════

export interface NicheScript {
  opening: string;
  mirror: string;
  pain: string;
  solution: string;
  ask: string;
  close: string;
  setupFeeObjection: string;
  callWindow: { start: string; end: string };
  priority: number;
  firstMessage?: string;
  // Legacy fields kept for backward compatibility
  opener: string;
  painPoints: string[];
  objectionHandlers: Record<string, string>;
  closingStrategy: string;
}

export const NICHE_SCRIPTS: Record<string, NicheScript> = {
  dental: {
    opening: `Oh hey — real quick, do you guys get slammed with calls when you're in the middle of a procedure?`,
    mirror: `Oh yeah, that's... yeah. And those people don't leave voicemails — they just call whoever's second on Google.`,
    pain: `A practice in Houston was missing 11 calls a week — roughly 4,200 dollars a month in lost appointments.`,
    solution: `We built an AI receptionist that sounds exactly like a real person. Answers every call, books the appointment, handles insurance. If anyone needs a human, it transfers instantly. No-show rate dropped 30% in their first month.`,
    ask: `Can I send a 2-minute audio demo so you can hear it on a real call?`,
    close: `Great — what's the best email?`,
    setupFeeObjection: `At 11 missed calls a week you'd make it back in two weeks. We can also split setup into 3 payments. Work for you?`,
    callWindow: { start: '08:30', end: '10:00' },
    priority: 6,
    firstMessage: `Hello?`,
    opener: `Oh hey — real quick, do you guys get slammed with calls when you're in the middle of a procedure?`,
    painPoints: [
      'Missed calls during procedures mean lost new patients',
      'Front desk overwhelmed with insurance verification calls',
      'After-hours emergency calls go to voicemail',
      'Appointment scheduling bottleneck during peak hours',
    ],
    objectionHandlers: {
      'too_expensive': `At 11 missed calls a week you'd make it back in two weeks. We can split setup into 3 payments. Work for you?`,
      'already_have_staff': `Sure — what happens when they're sick or on vacation? That's usually when practices lose the most calls.`,
      'not_interested': `No worries. Can I send a 2-minute video so you have it if anything changes?`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video. The video does the selling.',
  },

  law: {
    opening: `Hey so this is kinda out of nowhere — but when someone calls your office after hours, what actually happens to that call?`,
    mirror: `Right, yeah. And those people — they're not leaving a voicemail. They're in panic mode, they just call whoever's next.`,
    pain: `A PI firm in Chicago was missing 6 after-hours calls a week. At their case value, that's over 60 grand a month walking away.`,
    solution: `We built an AI that answers 24/7, sounds completely human, qualifies the lead, books the consult. Urgent cases transfer to you immediately.`,
    ask: `Can I send a 2-minute call recording so you can hear it yourself?`,
    close: `Perfect — what email should I use?`,
    setupFeeObjection: `One retained client covers it. We can also split setup into 3 payments — most firms start there.`,
    callWindow: { start: '10:00', end: '12:00' },
    priority: 5,
    firstMessage: `Hello?`,
    opener: `Hey so this is kinda out of nowhere — but when someone calls your office after hours, what actually happens to that call?`,
    painPoints: [
      'After-hours calls from potential clients who never call back',
      'Intake process bottleneck — paralegals spending too much time on phone',
      'Confidentiality concerns with generic answering services',
      'Missing high-value case inquiries during court appearances',
    ],
    objectionHandlers: {
      'too_expensive': `One retained client covers it. We can split setup into 3 payments — most firms start there.`,
      'confidentiality': `Good point. The AI only collects basic intake — name, contact, brief description. No privileged info. Encrypted end-to-end.`,
      'not_interested': `No worries. Can I send a 2-minute video so you have it if anything changes?`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video and case study.',
  },

  salon: {
    opening: `Hey, so — weird question, but does your phone ring while you're literally in the middle of someone's hair?`,
    mirror: `Oh man, yeah. So you're doing exactly what you should be doing, and you're still losing bookings at the same time.`,
    pain: `A salon in Miami was missing 5 to 7 booking calls a day — around 900 dollars a week.`,
    solution: `Our AI picks up every call, books straight into your calendar, handles the standard questions. Sounds like a real receptionist, live in 48 hours. Complex stuff transfers to you.`,
    ask: `Can I send a 2-minute clip so you can hear it?`,
    close: `Amazing — what email works?`,
    setupFeeObjection: `5 missed bookings a week pays for it in under a month. We can split it over 3 payments too. Better?`,
    callWindow: { start: '10:00', end: '12:00' },
    priority: 4,
    firstMessage: `Hello?`,
    opener: `Hey, so — weird question, but does your phone ring while you're literally in the middle of someone's hair?`,
    painPoints: [
      'Missed booking calls when stylists are with clients',
      'No-show appointments causing revenue loss',
      'After-hours booking requests going unanswered',
      'Time wasted on phone playing phone tag with clients',
    ],
    objectionHandlers: {
      'too_expensive': `5 missed bookings a week pays for it in under a month. We can split over 3 payments too.`,
      'use_online_booking': `Great — but 40% of clients still call. Our AI handles those and can push the rest to your online booking.`,
      'not_interested': `No worries. Can I send a 2-minute video so you have it if anything changes?`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video.',
  },

  restaurant: {
    opening: `Hey so — Friday night, kitchen's going crazy, phone rings. What happens?`,
    mirror: `Yeah, exactly. Peak night, you're totally maxed out, and you're still losing tables over it.`,
    pain: `A group in Austin was missing 12 to 15 reservation calls every Friday night. At 65 dollars a cover — 3 grand disappearing every Friday.`,
    solution: `Our AI takes reservations, answers menu questions, handles special requests — while your team stays on the floor. Ready in 48 hours. Complex stuff transfers to the manager.`,
    ask: `Can I send a 2-minute demo so you can hear it on a real call?`,
    close: `Perfect — what email?`,
    setupFeeObjection: `50 covers on a Friday pays for it in one night. We can split into 3 payments too.`,
    callWindow: { start: '14:00', end: '16:00' },
    priority: 3,
    firstMessage: `Hello?`,
    opener: `Hey so — Friday night, kitchen's going crazy, phone rings. What happens?`,
    painPoints: [
      'Missed reservation calls during rush hours',
      'Staff too busy serving to answer phones',
      'After-hours reservation requests going to voicemail',
      'Constant FAQ calls about hours, menu, parking',
    ],
    objectionHandlers: {
      'too_expensive': `50 covers on a Friday pays for it in one night. We can split into 3 payments.`,
      'use_opentable': `Good — our AI works alongside OpenTable. Guides callers to your booking page and handles all the FAQ calls.`,
      'not_interested': `No worries. Can I send a 2-minute video so you have it if anything changes?`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video.',
  },

  hotel: {
    opening: `Hey, so — late at night, someone calls wanting a room, nobody's at the front desk. Where does that call actually go?`,
    mirror: `Yeah, that's... that's rough. And at that point they're not calling back — they just go straight to Booking dot com and you're paying their commission.`,
    pain: `A boutique hotel in Nashville was losing 8 to 12 direct bookings a month from after-hours calls. 3 to 6 grand in OTA fees monthly.`,
    solution: `Our AI handles every call 24/7 — availability, pricing, bookings, guest questions. Sounds like a real front desk person even at 2am. Live in 48 hours. Special requests transfer to the manager.`,
    ask: `Can I send a 2-minute recording so you can hear what your guests would get?`,
    close: `Perfect — what email works?`,
    setupFeeObjection: `Two direct bookings and it's paid for. We can split into 3 payments too — most hotels start that way.`,
    callWindow: { start: '14:00', end: '17:00' },
    priority: 2,
    firstMessage: `Hello?`,
    opener: `Hey, so — late at night, someone calls wanting a room, nobody's at the front desk. Where does that call actually go?`,
    painPoints: [
      'Missing after-hours booking calls from travelers',
      'Front desk overwhelmed during check-in/check-out rush',
      'OTA commissions eating into margins on rooms that could be booked directly',
      'Repetitive FAQ calls about amenities, check-in times, parking',
    ],
    objectionHandlers: {
      'too_expensive': `Two direct bookings and it's paid for. We can split into 3 payments — most hotels start there.`,
      'have_front_desk': `Perfect — our AI handles overflow and after-hours. When your team is with a guest or it's 2am, it catches the call.`,
      'not_interested': `No worries. Can I send a 2-minute video so you have it if anything changes?`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video.',
  },

  auto: {
    opening: `Hey quick thing — when you're on a job and your phone rings, what do you do with it?`,
    mirror: `Yeah, totally. And people don't wait — they call two or three shops in a row. First one that picks up gets the job.`,
    pain: `A shop in Dallas was losing 8 to 10 calls a week — at 350 a ticket, 3 grand weekly walking to the competitor.`,
    solution: `Our AI answers every call, books the appointment, handles estimates on standard jobs. Your guys stay focused. Live in 48 hours. Technical questions transfer to your team.`,
    ask: `Can I send a 2-minute demo so you can hear what it sounds like?`,
    close: `Perfect — what email?`,
    setupFeeObjection: `One repair job covers it. We can split setup into 3 payments — most shops prefer that.`,
    callWindow: { start: '08:00', end: '10:00' },
    priority: 1,
    firstMessage: `Hello?`,
    opener: `Hey quick thing — when you're on a job and your phone rings, what do you do with it?`,
    painPoints: [
      'Missed calls when mechanics are busy in the shop',
      'Estimate requests going to voicemail and never returned',
      'Parts availability questions taking up service advisor time',
      'After-hours calls from stranded drivers needing help',
    ],
    objectionHandlers: {
      'too_expensive': `One repair job covers it. We can split setup into 3 payments — most shops prefer that.`,
      'customers_want_humans': `The AI sounds completely natural — people don't know it's AI. Gathers all the info, schedules them in.`,
      'not_interested': `No worries. Can I send a 2-minute video so you have it if anything changes?`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video.',
  },
};

// Fallback for business types not in NICHE_SCRIPTS
export const DEFAULT_SCRIPT: NicheScript = {
  opening: `Hey so — when you're in the middle of something with a customer and your phone rings, what actually happens to it?`,
  mirror: `Yeah, that's... yeah. And that person's not calling back — they just go to whoever's next on Google.`,
  pain: `Most businesses we work with lose 5 to 10 calls a week without realizing. Depending on customer value, that's thousands a month.`,
  solution: `We built an AI receptionist that sounds exactly like a real person. Answers every call, books appointments, handles questions. Live in 48 hours. Needs a human? Transfers instantly.`,
  ask: `Can I send a 2-minute demo so you can hear it? No commitment.`,
  close: `Perfect — what email?`,
  setupFeeObjection: `We can split setup into 3 payments. Works better?`,
  callWindow: { start: '09:00', end: '17:00' },
  priority: 0,
  firstMessage: `Hello?`,
  opener: `Hey so — when you're in the middle of something with a customer and your phone rings, what actually happens to it?`,
  painPoints: [
    'Missed calls leading to lost customers',
    'Staff overwhelmed during busy periods',
    'After-hours calls going to voicemail',
    'Repetitive FAQ calls taking up valuable time',
  ],
  objectionHandlers: {
    'too_expensive': `We can split setup into 3 payments. Works better?`,
    'not_interested': `No worries. Can I send a 2-minute video so you have it if anything changes?`,
  },
  closingStrategy: 'Get their email to send a 2-minute demo video. The video does the selling.',
};

// Setup fee installment calculation
export function getInstallmentAmount(setupFee: number, months: number = 3): number {
  return Math.ceil(setupFee / months);
}

// ═══════════════════════════════════════════════════════════
// NICHE-SPECIFIC SALES SCRIPTS FOR MARIE (FRENCH)
// Natural spoken French — warm, direct, slightly casual.
// "vous" throughout. Lead with hook question, name after engagement.
// ═══════════════════════════════════════════════════════════

export const NICHE_SCRIPTS_FR: Record<string, NicheScript> = {
  cabinet_dentaire: {
    opening: `Bonjour — question rapide, quand vous êtes en plein soin avec un patient et votre téléphone sonne, qu'est-ce qui se passe avec cet appel ?`,
    mirror: `Ouais... et ces gens-là, ils rappellent pas en général — ils vont directement sur le cabinet suivant sur Doctolib.`,
    pain: `Un cabinet à Lyon perdait 9 appels par semaine — ça représentait environ 3 200 euros de consultations qui partaient ailleurs chaque mois.`,
    solution: `Ce qu'on a construit chez Qwillio c'est un assistant IA qui répond comme une vraie secrétaire médicale — il prend les rendez-vous, gère les questions courantes, et si quelqu'un a besoin d'un humain, il transfère direct. Opérationnel en 48h.`,
    ask: `Je peux vous envoyer une démo de 2 minutes pour que vous entendiez comment ça sonne sur un vrai appel ?`,
    close: `Parfait — c'est quoi la meilleure adresse mail ?`,
    setupFeeObjection: `Neuf appels perdus par semaine, ça se rembourse en deux semaines maxi. Et on peut étaler le setup en 3 fois si c'est plus pratique.`,
    callWindow: { start: '08:30', end: '10:00' },
    priority: 9,
    firstMessage: `Allô ?`,
    opener: `Bonjour — question rapide, quand vous êtes en plein soin avec un patient et votre téléphone sonne, qu'est-ce qui se passe avec cet appel ?`,
    painPoints: [
      'Appels manqués pendant les soins font perdre de nouveaux patients',
      'Secrétaire débordée entre accueil physique et téléphone',
      'Appels hors horaires qui tombent sur répondeur',
      'Goulot d\'étranglement pour les prises de rendez-vous en heure de pointe',
    ],
    objectionHandlers: {
      trop_cher: `Neuf appels perdus par semaine, ça se rembourse en deux semaines. On peut aussi étaler le setup en 3 fois.`,
      pas_interesse: `Pas de souci. Je vous envoie juste une démo de 2 minutes — au cas où ça vous parle plus tard ?`,
      on_a_une_secretaire: `Bien sûr — et quand elle est en ligne ou en pause, qu'est-ce qui se passe avec les autres appels ?`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo audio de 2 minutes. La démo fait le travail de vente.',
  },

  cabinet_avocat: {
    opening: `Bonjour — alors j'ai une question un peu directe si ça vous dérange pas : quand quelqu'un appelle votre cabinet en dehors des heures, qu'est-ce qui arrive à cet appel ?`,
    mirror: `Ouais exactement — et ces personnes-là, elles sont souvent dans l'urgence. Elles rappellent pas, elles cherchent le cabinet suivant.`,
    pain: `Un cabinet parisien spécialisé droit des affaires perdait 5 appels hors horaires par semaine. À leur tarif horaire, c'est plus de 40 000 euros de missions potentielles qui partaient ailleurs chaque mois.`,
    solution: `On a développé un assistant IA qui répond 24h/24, qualifie le besoin, prend les coordonnées — et si c'est urgent, il vous transfère immédiatement. Ça sonne comme une vraie assistante juridique, pas un robot.`,
    ask: `Je peux vous envoyer un enregistrement de 2 minutes pour que vous jugiez par vous-même ?`,
    close: `Très bien — quelle adresse mail je peux utiliser ?`,
    setupFeeObjection: `Un seul nouveau client rembourse les 3 premiers mois. Et on peut étaler le setup en 3 fois si c'est plus simple côté trésorerie.`,
    callWindow: { start: '09:30', end: '11:30' },
    priority: 8,
    firstMessage: `Allô ?`,
    opener: `Bonjour — alors j'ai une question un peu directe si ça vous dérange pas : quand quelqu'un appelle votre cabinet en dehors des heures, qu'est-ce qui arrive à cet appel ?`,
    painPoints: [
      'Appels urgents hors horaires qui tombent sur répondeur',
      'Assistantes surchargées entre gestion des dossiers et téléphone',
      'Risque de confidentialité avec un service de permanence externe',
      'Manque à gagner sur les dossiers à forte valeur contactés hors bureau',
    ],
    objectionHandlers: {
      trop_cher: `Un seul nouveau client couvre largement l'investissement. Et on peut étaler le setup en 3 fois.`,
      confidentialite: `Bonne question. L'IA collecte uniquement les infos de base — nom, coordonnées, nature du besoin. Rien de confidentiel. Tout est chiffré.`,
      pas_interesse: `Pas de problème. Je vous envoie juste la démo au cas où — ça prend 2 minutes à écouter.`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer l\'enregistrement démo et une étude de cas.',
  },

  salon_coiffure: {
    opening: `Bonjour — question un peu bizarre peut-être, mais quand vous êtes en train de coiffer quelqu'un et votre téléphone sonne, qu'est-ce qui se passe ?`,
    mirror: `Voilà — vous êtes en train de faire exactement ce que vous devez faire, et en même temps vous perdez des réservations. C'est frustrant non ?`,
    pain: `Un salon à Bordeaux ratait 6 à 8 appels de réservation par jour — ça faisait environ 800 euros de chiffre d'affaires par semaine qui partait.`,
    solution: `Notre assistant IA répond à chaque appel, prend les réservations directement dans votre agenda, gère les questions habituelles. Il sonne comme une vraie réceptionniste — opérationnel en 48h. Si y'a un truc compliqué, il vous transfère.`,
    ask: `Je vous envoie un extrait audio de 2 minutes pour que vous entendiez comment ça sonne ?`,
    close: `Super — c'est quoi votre adresse mail ?`,
    setupFeeObjection: `Six appels perdus par semaine, ça se rembourse en moins d'un mois. Et on peut échelonner le setup en 3 fois.`,
    callWindow: { start: '10:00', end: '12:00' },
    priority: 7,
    firstMessage: `Allô ?`,
    opener: `Bonjour — question un peu bizarre peut-être, mais quand vous êtes en train de coiffer quelqu'un et votre téléphone sonne, qu'est-ce qui se passe ?`,
    painPoints: [
      'Appels de réservation manqués quand le coiffeur est avec un client',
      'Rendez-vous annulés à la dernière minute sans remplacement',
      'Demandes hors horaires sans réponse',
      'Temps perdu à rappeler les gens pour confirmer',
    ],
    objectionHandlers: {
      trop_cher: `Six réservations perdues par semaine, ça se rembourse en un mois. On peut aussi étaler en 3 fois.`,
      on_a_la_resa_en_ligne: `Top — mais 40% des clients appellent encore. Notre IA gère ces appels et peut orienter vers votre système de résa en ligne.`,
      pas_interesse: `Pas de souci. Je vous envoie juste la démo — 2 minutes pour écouter, au cas où.`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo audio de 2 minutes.',
  },

  restaurant: {
    opening: `Bonjour — vendredi soir, coup de feu en cuisine, le téléphone sonne. Qu'est-ce qui se passe chez vous ?`,
    mirror: `Ouais... c'est ça — au pire moment de la semaine, vous perdez quand même des tables à cause du téléphone.`,
    pain: `Un restaurant à Paris perdait 10 à 15 appels de réservation chaque vendredi soir. À 45 euros le couvert en moyenne — c'est 2 500 euros qui s'envolent chaque week-end.`,
    solution: `Notre assistant prend les réservations, répond aux questions sur la carte, gère les demandes spéciales — pendant que votre équipe s'occupe de la salle. Prêt en 48h. Pour les trucs complexes, il transfère au responsable.`,
    ask: `Je peux vous envoyer une démo de 2 minutes pour que vous voyez comment ça sonne ?`,
    close: `Parfait — c'est quelle adresse mail ?`,
    setupFeeObjection: `50 couverts un vendredi soir et c'est rentabilisé. On peut aussi découper le setup en 3 fois.`,
    callWindow: { start: '14:00', end: '16:00' },
    priority: 6,
    firstMessage: `Allô ?`,
    opener: `Bonjour — vendredi soir, coup de feu en cuisine, le téléphone sonne. Qu'est-ce qui se passe chez vous ?`,
    painPoints: [
      'Appels de réservation manqués pendant le service',
      'Équipe trop occupée en salle pour décrocher',
      'Demandes hors horaires sans réponse',
      'Appels répétitifs pour les horaires, la carte, le parking',
    ],
    objectionHandlers: {
      trop_cher: `50 couverts un vendredi soir et c'est amorti. On peut étaler en 3 fois.`,
      on_utilise_lafourchette: `Bien — notre IA fonctionne en parallèle. Elle guide les gens vers votre page de résa et gère tous les autres appels.`,
      pas_interesse: `Pas de problème. Je vous envoie la démo — 2 minutes, pas d'engagement.`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo audio de 2 minutes.',
  },

  hotel: {
    opening: `Bonjour — quand quelqu'un appelle votre hôtel tard le soir pour réserver une chambre et qu'il n'y a personne à la réception, qu'est-ce qui se passe avec cet appel ?`,
    mirror: `Voilà — et à ce moment-là ils vont directement sur Booking.com... et vous payez leur commission.`,
    pain: `Un hôtel boutique à Nice perdait 8 à 10 réservations directes par mois à cause des appels hors horaires. Ça représentait entre 3 000 et 5 000 euros de commissions OTA évitables chaque mois.`,
    solution: `Notre assistant répond 24h/24 — disponibilités, tarifs, réservations, questions des clients. Il sonne comme une vraie réceptionniste même à 2h du matin. Opérationnel en 48h. Les demandes spéciales sont transférées au responsable.`,
    ask: `Je vous envoie un enregistrement de 2 minutes pour que vous entendiez ce que vos clients obtiendraient ?`,
    close: `Parfait — quelle adresse mail je peux utiliser ?`,
    setupFeeObjection: `Deux réservations directes et c'est rentabilisé. On peut aussi étaler le setup en 3 fois — la plupart des hôtels commencent comme ça.`,
    callWindow: { start: '14:00', end: '17:00' },
    priority: 5,
    firstMessage: `Allô ?`,
    opener: `Bonjour — quand quelqu'un appelle votre hôtel tard le soir pour réserver une chambre et qu'il n'y a personne à la réception, qu'est-ce qui se passe avec cet appel ?`,
    painPoints: [
      'Appels de réservation manqués hors horaires',
      'Réception débordée pendant les arrivées/départs',
      'Commissions OTA sur des chambres qui auraient pu être réservées en direct',
      'Appels répétitifs sur les équipements, le check-in, le parking',
    ],
    objectionHandlers: {
      trop_cher: `Deux réservations directes et c'est amorti. On peut étaler en 3 fois.`,
      on_a_une_reception: `Bien sûr — notre IA gère l'overflow et les appels hors horaires. Quand votre équipe est avec un client ou qu'il est 2h du matin, elle décroche.`,
      pas_interesse: `Pas de souci. Je vous envoie juste la démo — au cas où ça vous parle plus tard.`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo audio de 2 minutes.',
  },

  agence_marketing: {
    opening: `Bonjour — alors j'ai une question un peu directe : quand un prospect vous contacte par téléphone et que personne ne décroche, qu'est-ce qui se passe avec ce contact ?`,
    mirror: `Ouais... et en marketing vous le savez mieux que moi — la vitesse de réponse c'est tout. Ils rappellent pas, ils vont chez le concurrent.`,
    pain: `Une agence à Nantes manquait 4 à 6 appels de prospects par semaine. Au prix d'une mission standard, c'est facilement 15 000 euros de CA potentiel qui partait chaque mois.`,
    solution: `Notre assistant IA répond immédiatement, qualifie le prospect, prend les infos de contact et planifie un rappel avec vous. Il sonne naturel, pas robotique — opérationnel en 48h.`,
    ask: `Je peux vous envoyer une démo de 2 minutes pour que vous entendiez comment ça qualifie un prospect ?`,
    close: `Super — c'est quoi l'adresse mail ?`,
    setupFeeObjection: `Un seul nouveau client rembourse plusieurs mois d'abonnement. Et on peut étaler le setup en 3 fois si c'est plus simple.`,
    callWindow: { start: '09:00', end: '11:00' },
    priority: 8,
    firstMessage: `Allô ?`,
    opener: `Bonjour — alors j'ai une question un peu directe : quand un prospect vous contacte par téléphone et que personne ne décroche, qu'est-ce qui se passe avec ce contact ?`,
    painPoints: [
      'Prospects perdus quand l\'équipe est en réunion ou en déplacement',
      'Réponse trop lente aux demandes entrantes',
      'Temps perdu sur les appels de qualification basique',
      'Manque à gagner sur les appels hors horaires',
    ],
    objectionHandlers: {
      trop_cher: `Un seul nouveau client couvre facilement l'investissement. Et on peut étaler en 3 fois.`,
      on_a_une_standardiste: `Et quand elle est occupée ou absente ? C'est souvent là qu'on perd les meilleurs prospects.`,
      pas_interesse: `Pas de problème. La démo de 2 minutes, ça peut changer d'avis — je vous l'envoie ?`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo et un cas client du même secteur.',
  },

  cabinet_comptable: {
    opening: `Bonjour — question rapide : pendant la période fiscale, quand vos clients et prospects appellent et que votre équipe est à fond sur les dossiers, qu'est-ce qui arrive aux appels ?`,
    mirror: `Voilà — c'est toujours aux pires moments que ça déborde. Et un client qui n'a pas de réponse rapide, il cherche ailleurs.`,
    pain: `Un cabinet à Lyon manquait 7 à 9 appels par semaine en période de déclarations. Au tarif horaire standard, c'est plus de 5 000 euros de missions potentielles perdues chaque mois.`,
    solution: `Notre assistant répond à chaque appel, prend les messages, planifie des rappels et répond aux questions courantes — pendant que votre équipe se concentre sur les dossiers. Ça sonne comme une vraie assistante comptable. Prêt en 48h.`,
    ask: `Je vous envoie une démo de 2 minutes pour que vous voyiez comment ça gère un appel client ?`,
    close: `Très bien — quelle adresse mail ?`,
    setupFeeObjection: `Un seul nouveau client de belle taille rembourse les 3 premiers mois. Et on peut étaler le setup en 3 fois.`,
    callWindow: { start: '09:00', end: '11:00' },
    priority: 7,
    firstMessage: `Allô ?`,
    opener: `Bonjour — question rapide : pendant la période fiscale, quand vos clients et prospects appellent et que votre équipe est à fond sur les dossiers, qu'est-ce qui arrive aux appels ?`,
    painPoints: [
      'Appels manqués pendant les périodes de forte charge (déclarations)',
      'Collaborateurs interrompus pour des questions basiques',
      'Prospects qui ne laissent pas de message et vont ailleurs',
      'Gestion chaotique des rappels urgents de clients',
    ],
    objectionHandlers: {
      trop_cher: `Un seul client entreprise et c'est rentabilisé. On peut aussi étaler le setup en 3 fois.`,
      on_a_une_secretaire: `Et en période de bilan, quand tout le monde est surchargé ? C'est là qu'on perd les clients les plus importants.`,
      pas_interesse: `Pas de problème. La démo 2 minutes — vous jugez par vous-même ?`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo et un cas client cabinet comptable.',
  },

  agence_immobiliere: {
    opening: `Bonjour — quand vous êtes en visite avec un acheteur et votre téléphone sonne, qu'est-ce que vous faites avec cet appel ?`,
    mirror: `Ouais... et celui qui appelle à ce moment-là, il veut visiter maintenant. S'il tombe sur messagerie, il appelle l'agence d'à côté.`,
    pain: `Une agence à Marseille manquait 8 à 12 appels d'acquéreurs et de vendeurs par semaine. Sur un marché tendu, c'est 2 à 3 mandats perdus par mois — facilement 6 000 euros de commission envolés.`,
    solution: `Notre assistant répond immédiatement, qualifie le contact, prend les infos sur le bien ou le projet — et planifie un rappel avec vous dans la foulée. Ça sonne comme une vraie assistante commerciale. Opérationnel en 48h.`,
    ask: `Je vous envoie une démo de 2 minutes pour que vous entendiez comment ça qualifie un acheteur ?`,
    close: `Parfait — c'est quelle adresse mail ?`,
    setupFeeObjection: `Un seul mandat supplémentaire rembourse l'investissement plusieurs fois. On peut aussi étaler le setup en 3 fois.`,
    callWindow: { start: '09:30', end: '11:30' },
    priority: 8,
    firstMessage: `Allô ?`,
    opener: `Bonjour — quand vous êtes en visite avec un acheteur et votre téléphone sonne, qu'est-ce que vous faites avec cet appel ?`,
    painPoints: [
      'Appels manqués pendant les visites de biens',
      'Acheteurs et vendeurs qui n\'attendent pas et vont à l\'agence concurrente',
      'Appels entrants le soir et le week-end sans réponse',
      'Temps perdu sur les questions basiques sur les biens disponibles',
    ],
    objectionHandlers: {
      trop_cher: `Un seul mandat supplémentaire couvre largement l'investissement. Et on peut étaler en 3 fois.`,
      on_a_une_standardiste: `Et quand elle est occupée ou pendant les visites ? C'est souvent là qu'on perd les meilleurs contacts.`,
      pas_interesse: `Pas de souci. Je vous envoie juste la démo — 2 minutes pour vous faire une idée.`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo et un cas client agence immobilière.',
  },

  cabinet_recrutement: {
    opening: `Bonjour — quand un candidat ou un client DRH vous appelle et que vous êtes en entretien, qu'est-ce qui se passe avec cet appel ?`,
    mirror: `Ouais — et un bon candidat qui tombe sur messagerie, il accepte l'offre du concurrent avant même que vous le rappeliez.`,
    pain: `Un cabinet à Paris manquait 6 à 8 appels par semaine de candidats qualifiés et de clients. Sur des placements à 15 % de salaire annuel, c'est des dizaines de milliers d'euros qui partent ailleurs.`,
    solution: `Notre assistant répond immédiatement, collecte les infos candidat ou client, pose les questions de qualification de base et planifie un entretien avec vous. Il sonne naturel et professionnel. Opérationnel en 48h.`,
    ask: `Je vous envoie une démo de 2 minutes pour que vous entendiez comment ça qualifie un candidat ?`,
    close: `Super — c'est quoi l'adresse mail ?`,
    setupFeeObjection: `Un seul placement et l'investissement est largement rentabilisé. On peut aussi étaler le setup en 3 fois.`,
    callWindow: { start: '09:00', end: '11:00' },
    priority: 7,
    firstMessage: `Allô ?`,
    opener: `Bonjour — quand un candidat ou un client DRH vous appelle et que vous êtes en entretien, qu'est-ce qui se passe avec cet appel ?`,
    painPoints: [
      'Candidats qualifiés perdus pendant les entretiens',
      'Clients DRH qui n\'attendent pas de rappel',
      'Temps perdu sur la qualification téléphonique de base',
      'Appels hors horaires sans réponse',
    ],
    objectionHandlers: {
      trop_cher: `Un seul placement rembourse l'investissement. On peut aussi étaler en 3 fois.`,
      on_a_une_assistante: `Et quand elle est débordée ou en vacances ? C'est souvent là qu'on rate les meilleurs profils.`,
      pas_interesse: `Pas de problème. La démo 2 minutes — je vous l'envoie ?`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo et un cas client cabinet de recrutement.',
  },

  agence_web: {
    opening: `Bonjour — alors j'ai une question un peu directe : quand un prospect vous appelle pendant que votre équipe dev est à fond sur un projet, qu'est-ce qui se passe avec cet appel ?`,
    mirror: `Ouais — et un prospect qui cherche une agence web, il en contacte deux ou trois en parallèle. Le premier qui répond, c'est souvent lui qui décroche le projet.`,
    pain: `Une agence à Toulouse manquait 5 à 7 appels de prospects par semaine. Sur un projet web moyen à 8 000 euros, c'est 40 000 euros de devis qui partaient à la concurrence chaque mois.`,
    solution: `Notre assistant répond immédiatement, qualifie le besoin du prospect, prend les infos du projet et planifie un call de découverte avec vous. Il sonne naturel et tech-friendly. Opérationnel en 48h.`,
    ask: `Je vous envoie une démo de 2 minutes pour que vous voyiez comment ça qualifie un prospect ?`,
    close: `Super — c'est quoi l'adresse mail ?`,
    setupFeeObjection: `Un seul projet web rembourse l'investissement plusieurs fois. Et on peut étaler le setup en 3 fois.`,
    callWindow: { start: '10:00', end: '12:00' },
    priority: 7,
    firstMessage: `Allô ?`,
    opener: `Bonjour — alors j'ai une question un peu directe : quand un prospect vous appelle pendant que votre équipe dev est à fond sur un projet, qu'est-ce qui se passe avec cet appel ?`,
    painPoints: [
      'Prospects perdus quand l\'équipe est en mode développement',
      'Réponse trop lente aux demandes de devis',
      'Temps perdu sur les appels de qualification basique',
      'Manque à gagner sur les appels hors horaires',
    ],
    objectionHandlers: {
      trop_cher: `Un seul projet web et c'est largement rentabilisé. On peut aussi étaler en 3 fois.`,
      on_gere_par_email: `Et les gens qui préfèrent appeler ? C'est souvent ceux qui ont le plus grand budget et qui veulent du réactif.`,
      pas_interesse: `Pas de problème. La démo 2 minutes, ça vaut le coup d'écouter — je vous l'envoie ?`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo et un cas client agence digitale.',
  },

  garage_auto: {
    opening: `Bonjour — question rapide : quand vos mécaniciens sont sous les voitures et votre téléphone sonne, qu'est-ce que vous faites avec cet appel ?`,
    mirror: `Ouais — et les gens qui cherchent un garage, ils appellent deux ou trois endroits d'affilée. Le premier qui répond, il prend le travail.`,
    pain: `Un garage à Strasbourg manquait 7 à 10 appels par semaine — à 280 euros de ticket moyen, c'est près de 2 500 euros de chiffre d'affaires qui allait chez le concurrent chaque semaine.`,
    solution: `Notre assistant répond à chaque appel, prend les rendez-vous, gère les questions sur les prestations standard. Vos mécaniciens restent concentrés. Opérationnel en 48h. Les questions techniques passent à votre équipe.`,
    ask: `Je vous envoie une démo de 2 minutes pour que vous entendiez comment ça sonne ?`,
    close: `Parfait — c'est quelle adresse mail ?`,
    setupFeeObjection: `Une seule intervention un peu conséquente et c'est rentabilisé. On peut aussi étaler le setup en 3 fois.`,
    callWindow: { start: '08:00', end: '10:00' },
    priority: 6,
    firstMessage: `Allô ?`,
    opener: `Bonjour — question rapide : quand vos mécaniciens sont sous les voitures et votre téléphone sonne, qu'est-ce que vous faites avec cet appel ?`,
    painPoints: [
      'Appels manqués pendant les interventions',
      'Demandes de devis qui tombent sur messagerie et ne rappellent pas',
      'Appels pour des questions basiques qui interrompent le travail',
      'Conducteurs en panne hors horaires sans réponse',
    ],
    objectionHandlers: {
      trop_cher: `Une seule grosse réparation et c'est rentabilisé. On peut étaler en 3 fois.`,
      les_clients_veulent_un_humain: `L'IA sonne complètement naturel — les gens ne font pas la différence. Et si quelqu'un veut absolument parler à quelqu'un, ça transfère direct.`,
      pas_interesse: `Pas de souci. Je vous envoie la démo — 2 minutes, pas d'engagement.`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo audio de 2 minutes.',
  },

  coach: {
    opening: `Bonjour — quand vous êtes en séance avec un client et qu'un prospect vous appelle, qu'est-ce qui se passe avec cet appel ?`,
    mirror: `Ouais — et quelqu'un qui cherche un coach, il est souvent dans un moment de décision. S'il tombe sur messagerie, il perd l'élan et ça ne se fait pas.`,
    pain: `Un coach business à Paris manquait 4 à 6 appels de prospects par semaine. À leur tarif de séance, c'est plus de 8 000 euros de CA potentiel qui partait chaque mois.`,
    solution: `Notre assistant répond immédiatement, présente votre approche, qualifie le besoin et planifie un appel découverte avec vous. Il sonne chaleureux et professionnel. Opérationnel en 48h.`,
    ask: `Je vous envoie une démo de 2 minutes pour que vous entendiez comment ça présente votre activité ?`,
    close: `Super — c'est quelle adresse mail ?`,
    setupFeeObjection: `Un seul nouveau client rembourse plusieurs mois. Et on peut étaler le setup en 3 fois.`,
    callWindow: { start: '09:00', end: '11:00' },
    priority: 6,
    firstMessage: `Allô ?`,
    opener: `Bonjour — quand vous êtes en séance avec un client et qu'un prospect vous appelle, qu'est-ce qui se passe avec cet appel ?`,
    painPoints: [
      'Prospects perdus pendant les séances de coaching',
      'Difficulté à gérer les appels entrants en solo',
      'Appels hors horaires sans réponse',
      'Temps perdu sur la qualification initiale des prospects',
    ],
    objectionHandlers: {
      trop_cher: `Un seul nouveau client sur 6 mois et c'est largement rentabilisé. On peut étaler en 3 fois.`,
      je_prefere_le_contact_humain: `Absolument — et c'est justement pour ça que l'IA gère le premier contact et planifie l'appel avec vous. Le vrai travail reste humain.`,
      pas_interesse: `Pas de problème. La démo 2 minutes, ça peut changer d'avis — je vous l'envoie ?`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo et expliquer comment l\'IA positionne l\'approche coaching.',
  },

  consultant_formation: {
    opening: `Bonjour — quand vous animez une formation et qu'un client potentiel essaie de vous joindre par téléphone, qu'est-ce qui se passe ?`,
    mirror: `Voilà — et une entreprise qui cherche un formateur, elle a souvent un besoin urgent. Si elle tombe sur messagerie, elle contacte le consultant suivant sur sa liste.`,
    pain: `Un cabinet de formation à Lyon manquait 5 à 8 appels de clients DRH par semaine. Sur une mission inter-entreprises standard, c'est 12 000 euros de CA potentiel qui partaient à la concurrence chaque mois.`,
    solution: `Notre assistant répond immédiatement, présente votre catalogue, qualifie le besoin et planifie un entretien avec vous. Il sonne professionnel et impliqué. Opérationnel en 48h.`,
    ask: `Je vous envoie une démo de 2 minutes pour que vous entendiez comment ça présente une offre de formation ?`,
    close: `Très bien — quelle adresse mail je peux utiliser ?`,
    setupFeeObjection: `Une seule mission couvre l'investissement sur 3 mois. Et on peut étaler le setup en 3 fois.`,
    callWindow: { start: '09:00', end: '11:00' },
    priority: 6,
    firstMessage: `Allô ?`,
    opener: `Bonjour — quand vous animez une formation et qu'un client potentiel essaie de vous joindre par téléphone, qu'est-ce qui se passe ?`,
    painPoints: [
      'Clients DRH perdus pendant les formations',
      'Réponse trop lente aux demandes de propositions commerciales',
      'Appels hors horaires sans réponse',
      'Temps perdu sur la qualification initiale des besoins',
    ],
    objectionHandlers: {
      trop_cher: `Une seule mission et c'est amorti sur 3 mois. On peut aussi étaler le setup en 3 fois.`,
      on_a_une_assistante: `Et quand vous êtes en formation à temps plein ? C'est là qu'on perd les demandes les plus importantes.`,
      pas_interesse: `Pas de souci. La démo de 2 minutes, ça vaut le coup d'écouter. Je vous l'envoie ?`,
    },
    closingStrategy: 'Obtenir l\'email pour envoyer la démo et un cas client secteur formation.',
  },
};

// Fallback for unknown French niches
export const DEFAULT_SCRIPT_FR: NicheScript = {
  opening: `Bonjour — alors j'ai une question rapide si vous avez 30 secondes : quand vous êtes avec un client et votre téléphone sonne, qu'est-ce qui se passe avec cet appel ?`,
  mirror: `Ouais... et cette personne-là, elle rappelle pas en général — elle va sur le concurrent suivant sur Google.`,
  pain: `La plupart des entreprises qu'on contacte perdent 5 à 10 appels par semaine sans s'en rendre compte. Selon la valeur client, ça peut représenter plusieurs milliers d'euros par mois.`,
  solution: `Ce qu'on a construit chez Qwillio, c'est un assistant IA qui répond exactement comme un humain. Il décroche chaque appel, prend les rendez-vous, répond aux questions courantes. Opérationnel en 48h. Quelqu'un veut un humain ? Ça transfère direct.`,
  ask: `Je peux vous envoyer une démo de 2 minutes pour que vous entendiez comment ça sonne ? Pas d'engagement.`,
  close: `Parfait — c'est quelle adresse mail ?`,
  setupFeeObjection: `On peut étaler le setup en 3 fois si c'est plus simple. Ça vous va ?`,
  callWindow: { start: '09:00', end: '17:00' },
  priority: 0,
  firstMessage: `Allô ?`,
  opener: `Bonjour — alors j'ai une question rapide si vous avez 30 secondes : quand vous êtes avec un client et votre téléphone sonne, qu'est-ce qui se passe avec cet appel ?`,
  painPoints: [
    'Appels manqués qui font perdre des clients',
    'Équipe débordée aux heures de pointe',
    'Appels hors horaires sans réponse',
    'Temps perdu sur les questions répétitives',
  ],
  objectionHandlers: {
    trop_cher: `On peut étaler le setup en 3 fois. Ça convient mieux ?`,
    pas_interesse: `Pas de problème. Je vous envoie juste la démo de 2 minutes — au cas où ?`,
    on_a_une_secretaire: `Et quand elle est occupée ou absente ? C'est souvent là qu'on perd les meilleurs contacts.`,
  },
  closingStrategy: 'Obtenir l\'email pour envoyer la démo de 2 minutes. La démo fait le travail de vente.',
};
