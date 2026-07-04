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
    opening: `Hi, Ashley from Qwillio. Quick question — how many calls go to voicemail on a busy day?`,
    mirror: `Right. And every one of those is a patient who just called the next dentist on Google.`,
    pain: `A practice in Houston was missing 11 calls a week — roughly 4,200 dollars a month in lost appointments.`,
    solution: `We built an AI receptionist that sounds exactly like a real person. Answers every call, books the appointment, handles insurance. If anyone needs a human, it transfers instantly. No-show rate dropped 30% in their first month.`,
    ask: `Can I send a 2-minute audio demo so you can hear it on a real call?`,
    close: `Great — what's the best email?`,
    setupFeeObjection: `At 11 missed calls a week you'd make it back in two weeks. We can also split setup into 3 payments. Work for you?`,
    callWindow: { start: '08:30', end: '10:00' },
    priority: 6,
    firstMessage: `Hi, Ashley from Qwillio — is this the front desk?`,
    opener: `Hi, Ashley from Qwillio. Quick question — how many calls go to voicemail on a busy day?`,
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
    opening: `Hi, Ashley from Qwillio. When someone calls after an accident and your firm is closed — where does that call go?`,
    mirror: `Exactly. They don't leave a voicemail. They call the next firm and sign there.`,
    pain: `A PI firm in Chicago was missing 6 after-hours calls a week. At their case value, that's over 60 grand a month walking away.`,
    solution: `We built an AI that answers 24/7, sounds completely human, qualifies the lead, books the consult. Urgent cases transfer to you immediately.`,
    ask: `Can I send a 2-minute call recording so you can hear it yourself?`,
    close: `Perfect — what email should I use?`,
    setupFeeObjection: `One retained client covers it. We can also split setup into 3 payments — most firms start there.`,
    callWindow: { start: '10:00', end: '12:00' },
    priority: 5,
    firstMessage: `Hi, Ashley from Qwillio — got 30 seconds?`,
    opener: `Hi, Ashley from Qwillio. When someone calls after an accident and your firm is closed — where does that call go?`,
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
    opening: `Hi, Ashley from Qwillio. How many times a day does your phone ring while you're in a client's hair?`,
    mirror: `Yeah — you're doing your job perfectly and still losing bookings at the same time.`,
    pain: `A salon in Miami was missing 5 to 7 booking calls a day — around 900 dollars a week.`,
    solution: `Our AI picks up every call, books straight into your calendar, handles the standard questions. Sounds like a real receptionist, live in 48 hours. Complex stuff transfers to you.`,
    ask: `Can I send a 2-minute clip so you can hear it?`,
    close: `Amazing — what email works?`,
    setupFeeObjection: `5 missed bookings a week pays for it in under a month. We can split it over 3 payments too. Better?`,
    callWindow: { start: '10:00', end: '12:00' },
    priority: 4,
    firstMessage: `Hi, Ashley from Qwillio — one quick question?`,
    opener: `Hi, Ashley from Qwillio. How many times a day does your phone ring while you're in a client's hair?`,
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
    opening: `Hi, Ashley from Qwillio. Friday dinner rush — kitchen slammed, every table full, phone rings. What happens?`,
    mirror: `Right — peak revenue, max capacity, and you're still losing covers.`,
    pain: `A group in Austin was missing 12 to 15 reservation calls every Friday night. At 65 dollars a cover — 3 grand disappearing every Friday.`,
    solution: `Our AI takes reservations, answers menu questions, handles special requests — while your team stays on the floor. Ready in 48 hours. Complex stuff transfers to the manager.`,
    ask: `Can I send a 2-minute demo so you can hear it on a real call?`,
    close: `Perfect — what email?`,
    setupFeeObjection: `50 covers on a Friday pays for it in one night. We can split into 3 payments too.`,
    callWindow: { start: '14:00', end: '16:00' },
    priority: 3,
    firstMessage: `Hi, Ashley from Qwillio — one quick one?`,
    opener: `Hi, Ashley from Qwillio. Friday dinner rush — kitchen slammed, every table full, phone rings. What happens?`,
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
    opening: `Hi, Ashley from Qwillio. Guest calls at 11pm asking about availability — front desk closed. Where does that call go?`,
    mirror: `Right — straight back to Booking dot com, and you just paid a 15% OTA commission.`,
    pain: `A boutique hotel in Nashville was losing 8 to 12 direct bookings a month from after-hours calls. 3 to 6 grand in OTA fees monthly.`,
    solution: `Our AI handles every call 24/7 — availability, pricing, bookings, guest questions. Sounds like a real front desk person even at 2am. Live in 48 hours. Special requests transfer to the manager.`,
    ask: `Can I send a 2-minute recording so you can hear what your guests would get?`,
    close: `Perfect — what email works?`,
    setupFeeObjection: `Two direct bookings and it's paid for. We can split into 3 payments too — most hotels start that way.`,
    callWindow: { start: '14:00', end: '17:00' },
    priority: 2,
    firstMessage: `Hi, Ashley from Qwillio — quick question about your bookings?`,
    opener: `Hi, Ashley from Qwillio. Guest calls at 11pm asking about availability — front desk closed. Where does that call go?`,
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
    opening: `Hi, Ashley from Qwillio. Your team's under the hood, phone rings — what's your process to not lose that customer?`,
    mirror: `Exactly. People call 2 or 3 shops in a row. First to answer gets the job.`,
    pain: `A shop in Dallas was losing 8 to 10 calls a week — at 350 a ticket, 3 grand weekly walking to the competitor.`,
    solution: `Our AI answers every call, books the appointment, handles estimates on standard jobs. Your guys stay focused. Live in 48 hours. Technical questions transfer to your team.`,
    ask: `Can I send a 2-minute demo so you can hear what it sounds like?`,
    close: `Perfect — what email?`,
    setupFeeObjection: `One repair job covers it. We can split setup into 3 payments — most shops prefer that.`,
    callWindow: { start: '08:00', end: '10:00' },
    priority: 1,
    firstMessage: `Hi, Ashley from Qwillio — is this the shop owner?`,
    opener: `Hi, Ashley from Qwillio. Your team's under the hood, phone rings — what's your process to not lose that customer?`,
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
  opening: `Hi, Ashley from Qwillio. When you're busy with a customer and the phone rings — what happens to that call?`,
  mirror: `Yeah — and that caller probably just goes to the next business on Google.`,
  pain: `Most businesses we work with lose 5 to 10 calls a week without realizing. Depending on customer value, that's thousands a month.`,
  solution: `We built an AI receptionist that sounds exactly like a real person. Answers every call, books appointments, handles questions. Live in 48 hours. Needs a human? Transfers instantly.`,
  ask: `Can I send a 2-minute demo so you can hear it? No commitment.`,
  close: `Perfect — what email?`,
  setupFeeObjection: `We can split setup into 3 payments. Works better?`,
  callWindow: { start: '09:00', end: '17:00' },
  priority: 0,
  firstMessage: `Hi, Ashley from Qwillio — got 30 seconds?`,
  opener: `Hi, Ashley from Qwillio. When you're busy with a customer and the phone rings — what happens to that call?`,
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
