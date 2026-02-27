// ═══════════════════════════════════════════════════════════
// NICHE-SPECIFIC SALES SCRIPTS FOR MARIE
// Each niche has tailored pain-point openers, objection handlers,
// and closing strategies
// ═══════════════════════════════════════════════════════════

export interface NicheScript {
  opener: string;
  painPoints: string[];
  objectionHandlers: Record<string, string>;
  closingStrategy: string;
  callWindow: { start: string; end: string };
  priority: number; // Higher = called first
}

export const NICHE_SCRIPTS: Record<string, NicheScript> = {
  dental: {
    opener: `I noticed {businessName} has amazing reviews — {rating} stars! I was curious, do you ever miss calls when you're with patients? Because a lot of dental offices we work with were losing 3-4 new patient calls a day before they started using our AI receptionist.`,
    painPoints: [
      'Missed calls during procedures mean lost new patients',
      'Front desk overwhelmed with insurance verification calls',
      'After-hours emergency calls go to voicemail',
      'Appointment scheduling bottleneck during peak hours',
    ],
    objectionHandlers: {
      'too_expensive': `I totally get that. Here's the thing — one new patient is worth $1,200 to $3,000 a year, right? If our AI catches even 2 extra patients a month, it pays for itself 10 times over. And we can split the setup fee over 3 months if that helps — that's only {installmentAmount} per month.`,
      'already_have_staff': `That's great! Our AI doesn't replace your team — it backs them up. When Sarah's on the phone scheduling Mrs. Johnson, our AI catches the next 3 calls that would've gone to voicemail. Your staff actually love it because it takes the pressure off.`,
      'not_interested': `No worries at all. Quick question though — do you know how many calls go to voicemail each week? Most dental offices are shocked when they find out. Our trial is completely free for 30 days, no credit card needed.`,
    },
    closingStrategy: 'Emphasize ROI per patient captured. Free 30-day trial, no credit card. Offer to set it up in 24 hours so they can see results immediately.',
    callWindow: { start: '08:30', end: '10:00' },
    priority: 6,
  },

  law: {
    opener: `Hi! I was looking at {businessName} and I saw you handle {sector} cases. I work with a few law firms in {city} and they all told me the same thing — potential clients call after hours and never call back. Does that happen to you too?`,
    painPoints: [
      'After-hours calls from potential clients who never call back',
      'Intake process bottleneck — paralegals spending too much time on phone',
      'Confidentiality concerns with generic answering services',
      'Missing high-value case inquiries during court appearances',
    ],
    objectionHandlers: {
      'too_expensive': `I hear you. But think about it — one good case could be worth $5,000 to $50,000, right? If our AI captures just one extra case a month that would've gone to your competitor, the math works out pretty fast. We can also split the setup fee over 3 months — that's only {installmentAmount} per month.`,
      'confidentiality': `Great question. Our AI is programmed to collect only basic intake info — name, contact, brief description of their legal need. No privileged information is discussed. It's like a smart intake form that talks. Everything is encrypted and HIPAA-grade secure.`,
      'not_interested': `No problem. Just so you know, we did a study and the average law firm misses 35% of incoming calls. Even if half of those are spam, that's a lot of potential clients going to the next firm on Google. Our trial is free for 30 days if you ever want to test it.`,
    },
    closingStrategy: 'Focus on client capture rate and competitor advantage. Emphasize confidentiality and professional tone. Free 30-day trial.',
    callWindow: { start: '09:00', end: '11:00' },
    priority: 5,
  },

  salon: {
    opener: `Hey! I saw {businessName} on Google — {rating} stars, that's incredible! I bet you're super busy. Quick question — how do you handle appointment bookings when everyone's with clients? Because a lot of salons we work with were losing bookings to no-shows and missed calls.`,
    painPoints: [
      'Missed booking calls when stylists are with clients',
      'No-show appointments causing revenue loss',
      'After-hours booking requests going unanswered',
      'Time wasted on phone playing phone tag with clients',
    ],
    objectionHandlers: {
      'too_expensive': `I get it. But think about this — each missed booking is probably $50-150 in lost revenue. If our AI books just 3-4 extra appointments a week, it more than pays for itself. Plus we can split the setup over 3 months — just {installmentAmount} per month.`,
      'use_online_booking': `That's awesome! But here's what we see — about 40% of clients still prefer to call, especially older clients or walk-in inquiries. Our AI handles those calls AND can push people to your online booking if you prefer. It's the best of both worlds.`,
      'not_interested': `No worries! Just curious — do you know how many calls you miss during a busy Saturday? Most salon owners are surprised when they see the number. Happy to set up a free 30-day trial so you can see the data yourself.`,
    },
    closingStrategy: 'Emphasize booking capture and no-show reduction. Mention integration with existing booking systems. Free trial, instant setup.',
    callWindow: { start: '10:00', end: '12:00' },
    priority: 4,
  },

  restaurant: {
    opener: `Hi! I was checking out {businessName} — {rating} stars on Google, that's fantastic! I wanted to ask, during the dinner rush, do you guys miss a lot of reservation calls? Because most restaurants we talk to say they lose 10-15 reservations a week to missed calls.`,
    painPoints: [
      'Missed reservation calls during rush hours',
      'Staff too busy serving to answer phones',
      'After-hours reservation requests going to voicemail',
      'Constant FAQ calls about hours, menu, parking',
    ],
    objectionHandlers: {
      'too_expensive': `I understand. But each missed reservation for 4 people is probably $100-200 in lost revenue, right? If our AI catches even 5 extra reservations a week, that's $500-1000 in extra revenue. We can split the setup fee over 3 months too — just {installmentAmount}/month.`,
      'use_opentable': `Great! Our AI actually works alongside OpenTable. When someone calls, it can check availability and either book directly or guide them to your OpenTable page. Plus it handles all the FAQ calls — hours, menu questions, directions — so your staff can focus on guests.`,
      'not_interested': `No problem at all! Quick thought though — what happens when someone calls during your Saturday dinner rush and nobody picks up? They just call the next restaurant. Our free trial lets you see exactly how many calls you're missing.`,
    },
    closingStrategy: 'Focus on revenue per missed reservation. Emphasize FAQ handling to free up staff. Free trial with real data on missed calls.',
    callWindow: { start: '14:00', end: '16:00' },
    priority: 3,
  },

  hotel: {
    opener: `Hello! I came across {businessName} — beautiful property! I'm curious, do you have someone answering the phone 24/7? Because most hotels we work with were missing after-hours booking calls from travelers in different time zones.`,
    painPoints: [
      'Missing after-hours booking calls from international travelers',
      'Front desk overwhelmed during check-in/check-out rush',
      'Multilingual guest requests going unanswered',
      'Repetitive FAQ calls about amenities, check-in times, parking',
    ],
    objectionHandlers: {
      'too_expensive': `I hear you. But consider this — one missed room booking could be $150-500+ per night. If our AI captures just 2-3 extra bookings per month, the ROI is massive. And we offer a 3-month installment on the setup — just {installmentAmount}/month.`,
      'have_front_desk': `Absolutely! Our AI doesn't replace your front desk — it handles the overflow. When your team is busy with check-ins at 3 PM or it's 2 AM and nobody's at the desk, our AI catches those calls. It can also handle multilingual requests.`,
      'not_interested': `No worries. Just FYI — we tracked one hotel and they were missing 12 calls per night after midnight. Many of those were international travelers trying to book. Our free 30-day trial would show you exactly what you're missing.`,
    },
    closingStrategy: 'Emphasize 24/7 coverage and international guest capture. Highlight multilingual capabilities. Free trial with real data.',
    callWindow: { start: '10:00', end: '12:00' },
    priority: 2,
  },

  auto: {
    opener: `Hey there! I noticed {businessName} has great reviews — {rating} stars! Quick question — when your mechanics are under the hood, who's answering the phone? Because most auto shops we work with were missing 5-10 estimate calls a day.`,
    painPoints: [
      'Missed calls when mechanics are busy in the shop',
      'Estimate requests going to voicemail and never returned',
      'Parts availability questions taking up service advisor time',
      'After-hours calls from stranded drivers needing help',
    ],
    objectionHandlers: {
      'too_expensive': `I totally get it. But think about it — each estimate call that goes to voicemail could be a $500-2000 repair job, right? If our AI catches just one extra job a week, it pays for itself immediately. We can spread the setup over 3 months too — {installmentAmount}/month.`,
      'customers_want_humans': `You'd be surprised! Our AI sounds completely natural — people don't even realize it's AI. It gathers all the info (car make, model, issue), gives basic estimates for common services, and schedules them in. Your service advisors get all the details before the customer even shows up.`,
      'not_interested': `No worries at all. Just curious — what happens when 3 calls come in at the same time and your service advisor is already on the phone? Those other 2 callers probably call the shop down the street. Free trial for 30 days if you ever want to test it.`,
    },
    closingStrategy: 'Focus on estimate capture rate and job value. Emphasize info gathering before customer arrives. Free trial with zero commitment.',
    callWindow: { start: '08:00', end: '10:00' },
    priority: 1,
  },
};

// Fallback for business types not in NICHE_SCRIPTS
export const DEFAULT_SCRIPT: NicheScript = {
  opener: `Hi! I noticed {businessName} has great reviews on Google — {rating} stars! I had a quick question. Do you ever miss phone calls when you're busy? Because most businesses we work with were losing customers to missed calls before they started using our AI receptionist.`,
  painPoints: [
    'Missed calls leading to lost customers',
    'Staff overwhelmed during busy periods',
    'After-hours calls going to voicemail',
    'Repetitive FAQ calls taking up valuable time',
  ],
  objectionHandlers: {
    'too_expensive': `I understand budget is important. But think about it — how much is each new customer worth to your business? If our AI catches just a few extra calls a week, it pays for itself. We can also split the setup fee over 3 months — just {installmentAmount}/month.`,
    'not_interested': `No problem at all! Just so you know, the average business misses about 30% of incoming calls. That's a lot of potential revenue walking out the door. Our trial is free for 30 days, no credit card needed.`,
  },
  closingStrategy: 'Focus on missed call statistics and lost revenue. Offer free 30-day trial. Keep it simple and low-commitment.',
  callWindow: { start: '09:00', end: '17:00' },
  priority: 0,
};

// Setup fee installment calculation
export function getInstallmentAmount(setupFee: number, months: number = 3): number {
  return Math.ceil(setupFee / months);
}
