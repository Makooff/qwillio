import { env } from '../config/env';
import { formatDate } from '../utils/helpers';
import { brandWrap, brandTitle, brandText, brandButton, brandList, brandSmall } from './email-template';

/** Highlight block — used for phone numbers, prices, dates (light violet card on white). */
export function brandHighlight(label: string, value: string, valueSize = 24): string {
  return `<div style="margin:16px 0 32px 0;padding:24px 24px;background:rgba(123,92,240,0.08);border:1px solid rgba(123,92,240,0.18);border-radius:12px;text-align:center;">
    <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;color:rgba(92,60,224,0.70);letter-spacing:0.06em;text-transform:uppercase;">${label}</p>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;font-size:${valueSize}px;font-weight:700;letter-spacing:-0.01em;color:#5C3CE0;font-feature-settings:'tnum';">${value}</p>
  </div>`;
}

export function renderQuoteTemplate(data: {
  contactName: string;
  businessName: string;
  packageType: string;
  setupPrice: number;
  monthlyPrice: number;
  features: string[];
  validUntil: Date;
  paymentLink: string;
}): string {
  return brandWrap({
    title: 'Your Qwillio quote',
    preheader: `Personalized quote for ${data.businessName}.`,
    body: [
      brandTitle('Your personalized quote'),
      brandText(`Hi ${data.contactName || 'there'}, following our conversation, here is your quote for <strong>${data.businessName}</strong>.`),
      brandHighlight(`${data.packageType.toUpperCase()} package`, `$${data.monthlyPrice}/mo`, 28),
      brandText(`One-time setup fee: <strong>$${data.setupPrice}</strong>`),
      brandText("What's included:"),
      brandList(data.features),
      brandHighlight('Offer valid until', formatDate(data.validUntil), 18),
      brandButton('Complete my signup', data.paymentLink),
      brandSmall('Setup completed within 48 hours of payment. Reply to this email if you have questions. — Ashley, Qwillio'),
    ].join(''),
  });
}

export function renderFollowUpTemplate(data: {
  contactName: string;
  businessName: string;
  packageName: string;
  monthlyPrice: number;
  setupPrice: number;
  paymentLink: string;
  type: 'day1' | 'day3' | 'day7';
}): string {
  if (data.type === 'day1') {
    return brandWrap({
      title: 'Your offer is still available',
      preheader: `Quick follow-up on your Qwillio proposal for ${data.businessName}.`,
      body: [
        brandTitle('Still here for you'),
        brandText(`Hi ${data.contactName}, just making sure you saw our proposal for <strong>${data.businessName}</strong>.`),
        brandHighlight(`${data.packageName} package`, `$${data.monthlyPrice}/mo`, 28),
        brandText(`One-time setup: $${data.setupPrice}. Our AI ensures you never miss a customer call again.`),
        brandButton('View my offer', data.paymentLink),
        brandSmall('— Ashley, Qwillio'),
      ].join(''),
    });
  }

  if (data.type === 'day3') {
    return brandWrap({
      title: '4 days left',
      preheader: `Your Qwillio offer for ${data.businessName} closes soon.`,
      body: [
        brandTitle('Only 4 days left'),
        brandText(`Hi ${data.contactName}, your personalized offer for <strong>${data.businessName}</strong> closes in 4 days.`),
        brandText('What our clients say:'),
        brandList([
          '95% customer satisfaction rate',
          '40 missed calls saved per month on average',
          'Positive ROI within the 2nd month',
        ]),
        brandButton('Complete my signup', data.paymentLink),
        brandSmall('— Ashley, Qwillio'),
      ].join(''),
    });
  }

  return brandWrap({
    title: 'Last chance',
    preheader: `Your Qwillio offer for ${data.businessName} expires today.`,
    body: [
      brandTitle('Last chance'),
      brandText(`Hi ${data.contactName}, today is the final day to claim your personalized offer for <strong>${data.businessName}</strong>.`),
      brandText('Our clients see an average <strong>25% increase in bookings</strong> with our AI receptionist.'),
      brandHighlight(`${data.packageName} package`, `$${data.monthlyPrice}/mo`, 28),
      brandText(`One-time setup: $${data.setupPrice}.`),
      brandButton('Claim my offer now', data.paymentLink),
      brandSmall('This offer will no longer be available after today. — Ashley, Qwillio'),
    ].join(''),
  });
}

export function renderWelcomeTemplate(data: {
  contactName: string;
  businessName: string;
  planType: string;
  vapiPhoneNumber: string;
  dashboardUrl: string;
}): string {
  return brandWrap({
    title: 'Welcome to Qwillio',
    preheader: `Your AI receptionist for ${data.businessName} is live.`,
    body: [
      brandTitle('Your AI is live'),
      brandText(`Hi ${data.contactName}, your AI receptionist for <strong>${data.businessName}</strong> is now answering calls 24/7.`),
      brandButton('Open my dashboard', data.dashboardUrl),
      brandHighlight('Your AI phone number', data.vapiPhoneNumber, 22),
      brandText('Next step on your dashboard:'),
      brandList([
        `<strong>Test it.</strong> Call ${data.vapiPhoneNumber} and hear your AI in action.`,
        `<strong>Customize it.</strong> Open the dashboard to set hours, FAQ and pricing.`,
        `<strong>Forward your calls.</strong> Redirect your main line to ${data.vapiPhoneNumber} when you're ready.`,
      ]),
      brandSmall('Tip — during the first 7 days, keep your current phone system running in parallel for a smooth transition.'),
    ].join(''),
  });
}

export function renderTrialWelcomeTemplate(data: {
  contactName: string;
  businessName: string;
  packageType: string;
  trialEndDate: Date;
  trialCallsQuota: number;
}): string {
  return brandWrap({
    title: 'Your free trial is active',
    preheader: `30 days to test Qwillio for ${data.businessName}.`,
    body: [
      brandTitle('Your free trial is active'),
      brandText(`Hi ${data.contactName}, your <strong>30-day free trial</strong> for <strong>${data.businessName}</strong> has just been activated. No commitment, no card required.`),
      brandText("What's included in your trial:"),
      brandList([
        'AI receptionist available 24/7',
        `${data.trialCallsQuota} calls during the trial period`,
        'Automatic booking & reservations',
        'Real-time tracking dashboard',
        'Email technical support',
      ]),
      brandHighlight('Trial ends on', formatDate(data.trialEndDate), 18),
      brandText('Next steps: our team will set up your AI assistant in the next 24–48 hours and email you the AI phone number. From there, just test and enjoy.'),
      brandSmall('Questions? Reply to this email and Ashley will jump in. — The Qwillio Team'),
    ].join(''),
  });
}

export function renderTrialEndingTemplate(data: {
  contactName: string;
  businessName: string;
  packageType: string;
  daysLeft: number;
  trialEndDate: Date;
  paymentLink: string;
  monthlyPrice: number;
}): string {
  const dayWord = data.daysLeft > 1 ? 'days' : 'day';
  return brandWrap({
    title: 'Your trial is ending',
    preheader: `Your free trial for ${data.businessName} ends ${formatDate(data.trialEndDate)}.`,
    body: [
      brandTitle(`Only ${data.daysLeft} ${dayWord} left`),
      brandText(`Hi ${data.contactName}, your free trial for <strong>${data.businessName}</strong> ends on <strong>${formatDate(data.trialEndDate)}</strong>.`),
      brandText('Your AI receptionist has already been working for you. Keep it on after the trial:'),
      brandHighlight(`${data.packageType.toUpperCase()} package`, `$${data.monthlyPrice}/mo`, 28),
      brandText('No commitment. Cancel anytime.'),
      brandButton('Continue with Qwillio', data.paymentLink),
      brandSmall("Without a subscription, your AI receptionist will be deactivated at the end of the trial. — Ashley, Qwillio"),
    ].join(''),
  });
}

export function renderTrialExpiredTemplate(data: {
  contactName: string;
  businessName: string;
  packageType: string;
  paymentLink: string;
  monthlyPrice: number;
}): string {
  return brandWrap({
    title: 'Your free trial has ended',
    preheader: `Reactivate your AI receptionist for ${data.businessName} in 2 minutes.`,
    body: [
      brandTitle('Your trial has ended'),
      brandText(`Hi ${data.contactName}, your free trial for <strong>${data.businessName}</strong> has just ended. Your AI receptionist is now paused — incoming calls are no longer handled.`),
      brandText('Subscribe to bring it back in two minutes:'),
      brandHighlight(`${data.packageType.toUpperCase()} package`, `$${data.monthlyPrice}/mo`, 28),
      brandButton('Reactivate my AI assistant', data.paymentLink),
      brandSmall('Your configuration is saved for 30 days, then permanently deleted. — Ashley, Qwillio'),
    ].join(''),
  });
}

export function renderCallback3MonthsTemplate(data: {
  contactName: string;
  businessName: string;
}): string {
  const replyMail = `mailto:${env.RESEND_REPLY_TO}?subject=Follow-up%20${encodeURIComponent(data.businessName)}`;
  return brandWrap({
    title: 'News from Qwillio',
    preheader: `Quick check-in for ${data.businessName} — a few new things since we last spoke.`,
    body: [
      brandTitle('News from Qwillio'),
      brandText(`Hi ${data.contactName}, we spoke 3 months ago about an AI receptionist for <strong>${data.businessName}</strong>. Has your situation changed?`),
      brandText('A few updates since we last spoke:'),
      brandList([
        'Automatic SMS reminder system',
        'Direct Google Calendar integration',
        'Mobile app to track your calls in real time',
      ]),
      brandButton("Yes, I'm interested", replyMail),
      brandSmall("If not, no worries — feel free to reach out anytime. — Ashley, Qwillio"),
    ].join(''),
  });
}

export function renderBookingReminderTemplate(data: {
  to: string;
  customerName: string;
  businessName: string;
  bookingDate: Date;
  bookingTime: string;
  serviceType: string;
  specialRequests: string | null;
  businessPhone: string;
}): string {
  const dateStr = data.bookingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const whenValue = data.bookingTime ? `${dateStr} · ${data.bookingTime}` : dateStr;
  const details: string[] = [
    `<strong>Where</strong> — ${data.businessName}`,
    `<strong>Service</strong> — ${data.serviceType}`,
  ];
  if (data.specialRequests) details.push(`<strong>Notes</strong> — ${data.specialRequests}`);
  return brandWrap({
    title: 'Appointment reminder',
    preheader: `Reminder of your appointment at ${data.businessName}.`,
    body: [
      brandTitle('Appointment reminder'),
      brandText(`Hi ${data.customerName}, this is a friendly reminder about your upcoming appointment at <strong>${data.businessName}</strong>.`),
      brandHighlight('Your appointment', whenValue, 18),
      brandList(details),
      data.businessPhone
        ? brandButton('Call to reschedule', `tel:${data.businessPhone}`)
        : '',
      data.businessPhone
        ? brandSmall(`Need to reschedule or cancel? Call <strong>${data.businessPhone}</strong>.`)
        : brandSmall('If you need to reschedule, please contact us directly.'),
    ].join(''),
  });
}

export function renderRescheduleTemplate(data: {
  to: string;
  customerName: string;
  businessName: string;
  originalDate: Date;
  businessPhone: string;
}): string {
  const dateStr = data.originalDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return brandWrap({
    title: "Let's reschedule",
    preheader: `We missed you at ${data.businessName} — let's find a new time.`,
    body: [
      brandTitle('We missed you'),
      brandText(`Hi ${data.customerName}, we noticed you weren't able to make your appointment on <strong>${dateStr}</strong>. No worries — things happen.`),
      brandText(`We'd love to reschedule at a time that works better for you.`),
      brandButton('Call to reschedule', `tel:${data.businessPhone}`),
      brandSmall(`Or call us at <strong>${data.businessPhone}</strong> anytime — our AI receptionist is available 24/7.`),
    ].join(''),
  });
}
