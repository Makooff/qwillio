// ═══════════════════════════════════════════════════════════
// NICHE-SPECIFIC SALES SCRIPTS FOR ASHLEY
// Each niche has a complete call script: Opening, Mirror,
// Pain Amplification, Solution (with human transfer),
// Micro-Ask, Close, and Setup Fee Objection handling.
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
    opening: `Hi, is this the front desk? Perfect — this is Ashley from Qwillio, sorry to catch you out of the blue. Real quick — on a busy day when every room is full, roughly how many calls do you think go to voicemail?`,
    mirror: `Yeah, exactly — and the thing is, those aren't just missed calls. Each one is a patient who just called the next dentist on Google.`,
    pain: `We worked with a practice in Houston — they were missing around 11 calls a week without even realizing it. When we did the math, that was roughly $4,200 in missed appointments every single month. Just from unanswered calls.`,
    solution: `So we built an AI receptionist that sounds exactly like a real person — answers every call, books the appointment, handles insurance questions, never puts anyone on hold. Their no-show rate dropped 30% in the first month. And if a patient ever gets confused or wants to speak to someone directly, it transfers the call to your front desk or whoever you designate instantly — no patient ever gets stuck.`,
    ask: `I'm not asking you to do anything right now. Could I send a 2-minute audio clip so you can hear exactly what it sounds like on a real call? If it's not a fit, honestly no problem at all.`,
    close: `Perfect. What's the best email to send that over to? I'll include a quick breakdown of what other dental practices in your area are using it for.`,
    setupFeeObjection: `I completely understand. At 11 missed calls a week you'd make that back in under two weeks from recovered appointments alone. But we can split the setup into 3 monthly payments — so you're essentially trying it before you've fully paid for it. Does that feel more comfortable?`,
    callWindow: { start: '08:30', end: '10:00' },
    priority: 6,
    // Legacy fields
    opener: `Hi, is this the front desk? Perfect — this is Ashley from Qwillio, sorry to catch you out of the blue. Real quick — on a busy day when every room is full, roughly how many calls do you think go to voicemail?`,
    painPoints: [
      'Missed calls during procedures mean lost new patients',
      'Front desk overwhelmed with insurance verification calls',
      'After-hours emergency calls go to voicemail',
      'Appointment scheduling bottleneck during peak hours',
    ],
    objectionHandlers: {
      'too_expensive': `I completely understand. At 11 missed calls a week you'd make that back in under two weeks from recovered appointments alone. But we can split the setup into 3 monthly payments — so you're essentially trying it before you've fully paid for it. Does that feel more comfortable?`,
      'already_have_staff': `That's great. Quick question — what happens when they're sick or on vacation? That's usually when businesses lose the most calls.`,
      'not_interested': `Totally fair. Could I send a short video anyway — just so you have it if anything changes? It's 2 minutes.`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video. The video does the selling.',
  },

  law: {
    opening: `Hi, this is Ashley from Qwillio — I'll get straight to the point because I know you're busy. When someone has just been in an accident or needs urgent legal help and they call your firm after hours, what happens to that call?`,
    mirror: `Right — and here's the thing, that person isn't going to leave a voicemail. They're going to call the next firm on Google and sign with them instead.`,
    pain: `We spoke with a personal injury firm in Chicago last month — they were missing an average of 6 after-hours calls a week. At their average case value, that's potentially over $60,000 in fees walking out the door every single month.`,
    solution: `We built an AI that answers every call — sounds completely human, qualifies the lead, captures their details, and books the consultation automatically. 24/7, including weekends and holidays. And if a caller ever needs to speak to an attorney directly or the situation is urgent, it transfers the call immediately to whoever you designate — no lead ever falls through the cracks.`,
    ask: `I just want to send you a 2-minute demo so you can listen to an actual call recording and decide for yourself. Can I send that over?`,
    close: `Perfect. What's the best email for you? I'll send the demo and a case study from a firm in your practice area.`,
    setupFeeObjection: `Given what a single retained client is worth to your firm, this pays for itself with one case. But we can split the setup into 3 monthly payments — a lot of our law firm clients prefer that to start.`,
    callWindow: { start: '10:00', end: '12:00' },
    priority: 5,
    // Legacy fields
    opener: `Hi, this is Ashley from Qwillio — I'll get straight to the point because I know you're busy. When someone has just been in an accident or needs urgent legal help and they call your firm after hours, what happens to that call?`,
    painPoints: [
      'After-hours calls from potential clients who never call back',
      'Intake process bottleneck — paralegals spending too much time on phone',
      'Confidentiality concerns with generic answering services',
      'Missing high-value case inquiries during court appearances',
    ],
    objectionHandlers: {
      'too_expensive': `Given what a single retained client is worth to your firm, this pays for itself with one case. But we can split the setup into 3 monthly payments — a lot of our law firm clients prefer that to start.`,
      'confidentiality': `Great question. Our AI is programmed to collect only basic intake info — name, contact, brief description of their legal need. No privileged information is discussed. It's like a smart intake form that talks. Everything is encrypted and secure.`,
      'not_interested': `Totally fair. Could I send a short video anyway — just so you have it if anything changes? It's 2 minutes.`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video and case study.',
  },

  salon: {
    opening: `Hi, this is Ashley from Qwillio — hope I'm not catching you mid-appointment. Super quick — how many times a day does your phone ring while your hands are literally in someone's hair?`,
    mirror: `Yeah — and the frustrating part is you're doing your job perfectly and still losing bookings at exactly the same time.`,
    pain: `We worked with a salon owner in Miami — she was missing 5 to 7 booking calls a day. That was about $900 in lost revenue every single week. Not because she wasn't good at her job — just because she physically couldn't pick up.`,
    solution: `So we built an AI that picks up every call, books straight into your calendar, and handles all the standard questions — while you stay completely focused on your client. Sounds like a real receptionist, live in 48 hours. And if a caller ever wants to speak to you directly or has a more complex request, the AI transfers them to you immediately — you're always in control.`,
    ask: `I'm not asking you to decide anything right now. Can I send a 2-minute audio clip so you can hear exactly what it sounds like?`,
    close: `Amazing. What's the best email for you? I'll also include what other salons in your area are using it for.`,
    setupFeeObjection: `At 5 missed bookings a week you'd make that back in less than a month. But we can split it over 3 payments to make it way more manageable. Does that work better?`,
    callWindow: { start: '10:00', end: '12:00' },
    priority: 4,
    // Legacy fields
    opener: `Hi, this is Ashley from Qwillio — hope I'm not catching you mid-appointment. Super quick — how many times a day does your phone ring while your hands are literally in someone's hair?`,
    painPoints: [
      'Missed booking calls when stylists are with clients',
      'No-show appointments causing revenue loss',
      'After-hours booking requests going unanswered',
      'Time wasted on phone playing phone tag with clients',
    ],
    objectionHandlers: {
      'too_expensive': `At 5 missed bookings a week you'd make that back in less than a month. But we can split it over 3 payments to make it way more manageable. Does that work better?`,
      'use_online_booking': `That's awesome! But about 40% of clients still prefer to call. Our AI handles those calls AND can push people to your online booking if you prefer.`,
      'not_interested': `Totally fair. Could I send a short video anyway — just so you have it if anything changes? It's 2 minutes.`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video.',
  },

  restaurant: {
    opening: `Hi, this is Ashley from Qwillio — quick one, I promise. During a Friday dinner rush when every table is full and the kitchen is slammed, what happens when the phone rings and nobody can get to it?`,
    mirror: `Exactly — and that's your peak revenue moment. You're at max capacity and still losing covers at the same time.`,
    pain: `A restaurant group in Austin told us they were missing 12 to 15 reservation calls every Friday night. At an average spend of $65 per cover with tables of 2 to 4 — that's potentially $3,000 in revenue disappearing every single Friday.`,
    solution: `We built an AI that picks up every call — takes the reservation, answers menu questions, handles special requests — while your team stays completely focused on the floor. Ready in 48 hours. And if a caller has a complex request or just wants to speak to the manager, the AI transfers them instantly — no customer ever feels ignored.`,
    ask: `I just want to send you a 2-minute demo so you can hear it on an actual call. No commitment — just see if it makes sense for your restaurant.`,
    close: `Perfect. What email should I send that to? I'll include a breakdown of what other restaurants in your city are doing with it.`,
    setupFeeObjection: `If you're doing 50 covers on a Friday night, this pays for itself in one service. But we can split it into 3 payments — a lot of restaurant owners prefer that. Does that work?`,
    callWindow: { start: '14:00', end: '16:00' },
    priority: 3,
    // Legacy fields
    opener: `Hi, this is Ashley from Qwillio — quick one, I promise. During a Friday dinner rush when every table is full and the kitchen is slammed, what happens when the phone rings and nobody can get to it?`,
    painPoints: [
      'Missed reservation calls during rush hours',
      'Staff too busy serving to answer phones',
      'After-hours reservation requests going to voicemail',
      'Constant FAQ calls about hours, menu, parking',
    ],
    objectionHandlers: {
      'too_expensive': `If you're doing 50 covers on a Friday night, this pays for itself in one service. But we can split it into 3 payments — a lot of restaurant owners prefer that. Does that work?`,
      'use_opentable': `Great! Our AI actually works alongside OpenTable. When someone calls, it can guide them to your booking page. Plus it handles all the FAQ calls.`,
      'not_interested': `Totally fair. Could I send a short video anyway — just so you have it if anything changes? It's 2 minutes.`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video.',
  },

  hotel: {
    opening: `Hi, this is Ashley from Qwillio — hope I'm not catching you at a bad moment. Quick question — when a potential guest calls at 11pm to ask about availability and your front desk is closed, where does that call go?`,
    mirror: `Right — and that guest isn't going to leave a voicemail. They go straight back to Booking.com, book there instead, and you just paid a 15% OTA commission on a room you could have filled directly.`,
    pain: `A boutique hotel in Nashville told us they were losing 8 to 12 direct bookings a month just from after-hours missed calls. That's $3,000 to $6,000 in OTA fees they didn't need to pay every single month.`,
    solution: `We built an AI that handles every call 24/7 — availability, pricing, booking confirmations, guest questions — sounds exactly like a real front desk person, even at 2 in the morning. Live in 48 hours. And if a guest ever has a special request or wants to speak to a manager directly, the AI transfers the call instantly — your guests always feel taken care of.`,
    ask: `I just want to send a 2-minute demo call recording so you can hear exactly what your guests would experience. Can I send that over?`,
    close: `Perfect. What's the best email for you? I'll include the direct booking recovery rate other boutique hotels are seeing in the first 30 days.`,
    setupFeeObjection: `Two recovered direct bookings and it's already paid for itself. But we can split it into 3 monthly payments — most hotel owners prefer that to get started. Does that work better?`,
    callWindow: { start: '14:00', end: '17:00' },
    priority: 2,
    // Legacy fields
    opener: `Hi, this is Ashley from Qwillio — hope I'm not catching you at a bad moment. Quick question — when a potential guest calls at 11pm to ask about availability and your front desk is closed, where does that call go?`,
    painPoints: [
      'Missing after-hours booking calls from travelers',
      'Front desk overwhelmed during check-in/check-out rush',
      'OTA commissions eating into margins on rooms that could be booked directly',
      'Repetitive FAQ calls about amenities, check-in times, parking',
    ],
    objectionHandlers: {
      'too_expensive': `Two recovered direct bookings and it's already paid for itself. But we can split it into 3 monthly payments — most hotel owners prefer that to get started. Does that work better?`,
      'have_front_desk': `Absolutely! Our AI handles the overflow and after-hours. When your team is busy with check-ins or it's 2 AM, the AI catches those calls.`,
      'not_interested': `Totally fair. Could I send a short video anyway — just so you have it if anything changes? It's 2 minutes.`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video.',
  },

  auto: {
    opening: `Hi, this is Ashley from Qwillio — straight to it, I know you're busy. When your whole team is under the hood and the phone rings, what's your current process for not losing that customer?`,
    mirror: `Right — and the problem is people searching Google will call 2 or 3 shops in a row. First one that answers gets the job. They don't wait.`,
    pain: `A shop owner in Dallas told us he was losing 8 to 10 calls a week to voicemail. At an average repair ticket of $350, that's about $3,000 in work going to his competitor every single week. And he had no idea until we showed him the data.`,
    solution: `We built an AI that answers every call — books the appointment, gives estimates on standard jobs, handles all the basic questions. Your guys stay focused on the work, zero interruptions. Live in 48 hours. And if a customer ever wants to speak to a mechanic or has a specific technical question, the AI transfers the call to your team straight away — no customer ever hangs up frustrated.`,
    ask: `I'm not asking you to commit to anything. Can I send a 2-minute audio demo so you can hear what it actually sounds like on a real call?`,
    close: `Perfect. What's the best email to send the demo to? I'll include what other shops in your area are saving per month.`,
    setupFeeObjection: `One repair job covers it honestly. But we can split the setup into 3 monthly payments — most shop owners prefer that. Does that work for you?`,
    callWindow: { start: '08:00', end: '10:00' },
    priority: 1,
    // Legacy fields
    opener: `Hi, this is Ashley from Qwillio — straight to it, I know you're busy. When your whole team is under the hood and the phone rings, what's your current process for not losing that customer?`,
    painPoints: [
      'Missed calls when mechanics are busy in the shop',
      'Estimate requests going to voicemail and never returned',
      'Parts availability questions taking up service advisor time',
      'After-hours calls from stranded drivers needing help',
    ],
    objectionHandlers: {
      'too_expensive': `One repair job covers it honestly. But we can split the setup into 3 monthly payments — most shop owners prefer that. Does that work for you?`,
      'customers_want_humans': `You'd be surprised! Our AI sounds completely natural — people don't even realize it's AI. It gathers all the info and schedules them in.`,
      'not_interested': `Totally fair. Could I send a short video anyway — just so you have it if anything changes? It's 2 minutes.`,
    },
    closingStrategy: 'Get their email to send a 2-minute demo video.',
  },
};

// Fallback for business types not in NICHE_SCRIPTS
export const DEFAULT_SCRIPT: NicheScript = {
  opening: `Hi, this is Ashley from Qwillio — sorry to catch you out of the blue. Super quick question — when you're busy with a customer and the phone rings, what happens to that call?`,
  mirror: `Yeah — and the frustrating part is, that caller probably just goes to the next business on Google.`,
  pain: `Most businesses we work with were losing 5 to 10 calls a week without realizing it. Depending on what each customer is worth, that could be thousands in lost revenue every month.`,
  solution: `We built an AI receptionist that sounds exactly like a real person — answers every call, books appointments, handles questions. Live in 48 hours. And if a caller ever wants to speak to someone directly, it transfers instantly to you or your team — no one ever gets stuck.`,
  ask: `Could I send a 2-minute audio demo so you can hear exactly what it sounds like? No commitment at all.`,
  close: `Perfect. What's the best email for you?`,
  setupFeeObjection: `We can split the setup into 3 monthly payments to make it more manageable. Does that work better?`,
  callWindow: { start: '09:00', end: '17:00' },
  priority: 0,
  // Legacy fields
  opener: `Hi, this is Ashley from Qwillio — sorry to catch you out of the blue. Super quick question — when you're busy with a customer and the phone rings, what happens to that call?`,
  painPoints: [
    'Missed calls leading to lost customers',
    'Staff overwhelmed during busy periods',
    'After-hours calls going to voicemail',
    'Repetitive FAQ calls taking up valuable time',
  ],
  objectionHandlers: {
    'too_expensive': `We can split the setup into 3 monthly payments to make it more manageable. Does that work better?`,
    'not_interested': `Totally fair. Could I send a short video anyway — just so you have it if anything changes? It's 2 minutes.`,
  },
  closingStrategy: 'Get their email to send a 2-minute demo video. The video does the selling.',
};

// Setup fee installment calculation
export function getInstallmentAmount(setupFee: number, months: number = 3): number {
  return Math.ceil(setupFee / months);
}
