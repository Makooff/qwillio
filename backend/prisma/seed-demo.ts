import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Compte de démonstration: « Clinique Lumen », un mois d'activité.
 *
 * Pourquoi ce fichier existe: `seed.ts` ne créait que des comptes admin. Aucun
 * client, aucun appel, aucun lead, aucun rendez-vous. Une démonstration en
 * direct du tableau de bord montrait donc six écrans vides, à l'endroit précis
 * où l'on veut prouver que le produit tourne.
 *
 * Il n'est PAS appelé par `db:seed`. Il se lance à la main, `npm run db:seed:demo`,
 * et il refuse de tourner en production: ces enregistrements ne doivent jamais
 * se mélanger à ceux d'un vrai client.
 *
 * Les données sont plausibles, pas flatteuses: des appels raccrochés, du spam,
 * des leads perdus. Un tableau de bord où tout réussit ne se croit pas.
 */

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@qwillio.com';
const DEMO_PASSWORD = 'DemoQwillio2026!';

/* Générateur déterministe: deux exécutions donnent le même jeu, donc une
   capture d'écran reste comparable d'une fois sur l'autre. */
let seedState = 42;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function between(min: number, max: number): number {
  return Math.floor(min + rand() * (max - min + 1));
}

const FIRST = ['Camille', 'Julien', 'Sofia', 'Marc', 'Léa', 'Thomas', 'Inès', 'Nicolas', 'Chloé', 'Adrien', 'Manon', 'Youssef'];
const LAST = ['Dubois', 'Lemaire', 'Moreau', 'Peeters', 'Fontaine', 'Janssens', 'Bernard', 'Willems', 'Girard', 'Mertens'];

const SUMMARIES = [
  'Demande de rendez-vous pour un détartrage. Créneau proposé et confirmé.',
  "Question sur les horaires d'ouverture le samedi. Renseignement donné.",
  'Douleur dentaire, demande un rendez-vous en urgence. Transféré au cabinet.',
  'Souhaite un devis pour un blanchiment. Coordonnées prises, rappel prévu.',
  'Annulation d\'un rendez-vous existant. Créneau libéré.',
  "Demande si le cabinet est conventionné. Réponse donnée, pas de suite.",
];

const TRANSCRIPT = [
  'Assistant: Clinique Lumen, bonjour, que puis-je faire pour vous ?',
  'Appelant: Bonjour, je voudrais prendre rendez-vous.',
  'Assistant: Bien sûr. Pour quel motif, et plutôt en matinée ou en après-midi ?',
  'Appelant: Un détartrage, en matinée si possible.',
  'Assistant: J\'ai jeudi 9h30 ou vendredi 10h. Lequel vous convient ?',
  'Appelant: Jeudi 9h30, très bien.',
  'Assistant: C\'est noté. Vous recevrez une confirmation par SMS. Bonne journée.',
].join('\n');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'seed-demo refuse de tourner en production: ces données ne doivent jamais côtoyer celles d\'un vrai client.',
    );
  }

  console.log('Compte de démonstration: création…');

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { emailConfirmed: true, onboardingCompleted: true },
    create: {
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      name: 'Camille Dubois',
      role: 'client',
      emailConfirmed: true,
      onboardingCompleted: true,
      businessName: 'Clinique Lumen',
      industry: 'healthcare',
    },
  });

  const now = new Date();
  const activation = new Date(now);
  activation.setMonth(activation.getMonth() - 4);

  const client = await prisma.client.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      businessName: 'Clinique Lumen',
      businessType: 'healthcare',
      contactName: 'Camille Dubois',
      contactEmail: DEMO_EMAIL,
      contactPhone: '+32 2 555 01 20',
      city: 'Bruxelles',
      country: 'BE',
      planType: 'starter',
      setupFee: new Prisma.Decimal(0),
      monthlyFee: new Prisma.Decimal(249),
      monthlyMinutesQuota: 750,
      currency: 'EUR',
      subscriptionStatus: 'active',
      onboardingStatus: 'completed',
      onboardingCompletedAt: activation,
      activationDate: activation,
      agentLanguage: 'fr',
      agentName: 'Léa',
      isTrial: false,
      transferNumber: '+32 2 555 01 21',
      forwardingStatus: 'verified',
      forwardingVerifiedAt: activation,
      // Volontairement SANS numéro entrant: la ligne appartient au vrai client.
      // Voir services/voice/phone-allocation.service.ts.
      vapiPhoneNumber: null,
      dashboardToken: 'demo-dashboard-token',
    },
  });

  // Idempotence: on repart d'une ardoise propre pour ce client uniquement.
  await prisma.deal.deleteMany({ where: { clientId: client.id } });
  await prisma.activity.deleteMany({ where: { clientId: client.id } });
  await prisma.contact.deleteMany({ where: { clientId: client.id } });
  await prisma.clientBooking.deleteMany({ where: { clientId: client.id } });
  await prisma.clientCall.deleteMany({ where: { clientId: client.id } });

  /* Trente jours d'appels. Le volume monte doucement en semaine et tombe le
     week-end: c'est ce qui rend une courbe crédible, pas une pente régulière. */
  const callIds: string[] = [];
  let leadCount = 0;
  for (let day = 29; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const calls = weekend ? between(0, 2) : between(3, 9);

    for (let i = 0; i < calls; i++) {
      const startedAt = new Date(date);
      startedAt.setHours(between(8, 18), between(0, 59), 0, 0);
      const spam = rand() < 0.08;
      const duration = spam ? between(4, 14) : between(45, 320);
      const endedAt = new Date(startedAt.getTime() + duration * 1000);
      const isLead = !spam && rand() < 0.34;
      const name = `${pick(FIRST)} ${pick(LAST)}`;

      const call = await prisma.clientCall.create({
        data: {
          clientId: client.id,
          callerNumber: `+324${between(10, 99)}${between(100000, 999999)}`,
          callerName: spam ? null : name,
          direction: 'inbound',
          startedAt,
          endedAt,
          durationSeconds: duration,
          status: 'ended',
          createdAt: startedAt,
          transcript: spam ? null : TRANSCRIPT,
          summary: spam ? 'Appel commercial non sollicité, écarté.' : pick(SUMMARIES),
          sentiment: spam ? null : (rand() < 0.72 ? 'positive' : rand() < 0.85 ? 'neutral' : 'negative'),
          outcome: isLead ? 'lead_captured' : rand() < 0.15 ? 'transferred' : 'answered',
          isLead,
          leadScore: isLead ? between(5, 10) : null,
          isSpam: spam,
          spamScore: spam ? between(80, 98) : null,
          spamReasons: spam ? ['numero_signale', 'discours_commercial'] : [],
          nameCollected: isLead ? name : null,
          emailCollected: isLead ? `${name.split(' ')[0].toLowerCase()}@example.com` : null,
          phoneCollected: isLead ? `+324${between(10, 99)}${between(100000, 999999)}` : null,
        },
      });
      callIds.push(call.id);
      if (isLead) leadCount++;
    }
  }

  /* Rendez-vous: quelques-uns passés, quelques-uns à venir. Un tableau qui
     n'aurait que du passé donnerait un cabinet à l'arrêt. */
  for (let i = 0; i < 8; i++) {
    const bookingDate = new Date(now);
    bookingDate.setDate(bookingDate.getDate() + (i < 3 ? -between(1, 12) : between(1, 16)));
    bookingDate.setHours(between(9, 17), rand() < 0.5 ? 0 : 30, 0, 0);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    await prisma.clientBooking.create({
      data: {
        clientId: client.id,
        clientCallId: callIds.length ? callIds[between(0, callIds.length - 1)] : null,
        customerName: name,
        customerPhone: `+324${between(10, 99)}${between(100000, 999999)}`,
        customerEmail: `${name.split(' ')[0].toLowerCase()}@example.com`,
        bookingDate,
        bookingTime: `${bookingDate.getHours()}h${bookingDate.getMinutes() === 30 ? '30' : '00'}`,
        serviceType: pick(['Détartrage', 'Contrôle annuel', 'Urgence', 'Blanchiment', 'Pose de couronne']),
        status: i < 3 ? 'completed' : 'confirmed',
      },
    });
  }

  /* CRM: douze contacts aux quatre statuts, et quelques affaires pour que le
     pipeline ne soit pas une page vide pendant une démonstration. */
  const STATUSES = ['new', 'contacted', 'converted', 'lost'];
  const STAGES = ['new', 'qualified', 'proposal', 'won', 'lost'];
  for (let i = 0; i < 12; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const created = new Date(now);
    created.setDate(created.getDate() - between(0, 29));
    const contact = await prisma.contact.create({
      data: {
        clientId: client.id,
        name,
        email: `${name.split(' ')[0].toLowerCase()}.${i}@example.com`,
        phone: `+324${between(10, 99)}${between(100000, 999999)}`,
        niche: 'healthcare',
        leadScore: between(3, 10),
        status: STATUSES[i % STATUSES.length],
        tags: rand() < 0.4 ? ['appel entrant'] : [],
        createdAt: created,
      },
    });

    if (i % 3 === 0) {
      const closeDate = new Date(now);
      closeDate.setDate(closeDate.getDate() + between(3, 40));
      await prisma.deal.create({
        data: {
          clientId: client.id,
          contactId: contact.id,
          title: pick(['Pose de couronne', 'Traitement orthodontique', 'Blanchiment complet', 'Implant']),
          stage: STAGES[i % STAGES.length],
          value: new Prisma.Decimal(between(3, 24) * 100),
          probability: between(20, 90),
          closeDate,
        },
      });
    }

    await prisma.activity.create({
      data: {
        clientId: client.id,
        contactId: contact.id,
        type: pick(['call', 'email', 'note']),
        description: pick([
          'Appel entrant traité par la réceptionniste.',
          'Email de confirmation envoyé.',
          'Rappel prévu la semaine prochaine.',
        ]),
        createdAt: created,
      },
    });
  }

  console.log(`Client de démonstration: ${client.businessName} (${client.id})`);
  console.log(`  ${callIds.length} appels, ${leadCount} leads, 8 rendez-vous, 12 contacts`);
  console.log(`  Connexion: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('seed-demo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
