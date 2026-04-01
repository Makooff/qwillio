import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user (default)
  const passwordHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@qwillio.com' },
    update: {},
    create: {
      email: 'admin@qwillio.com',
      passwordHash,
      name: 'Admin Qwillio',
      role: 'admin',
      emailConfirmed: true,
      onboardingCompleted: true,
    },
  });
  console.log(`Admin user created: ${admin.email}`);

  // Create secondary admin user
  const makhoPasswordHash = await bcrypt.hash('Admin1234!', 12);
  const makhoAdmin = await prisma.user.upsert({
    where: { email: 'makho.off@gmail.com' },
    update: {
      role: 'admin',
      emailConfirmed: true,
      onboardingCompleted: true,
      passwordHash: makhoPasswordHash,
    },
    create: {
      email: 'makho.off@gmail.com',
      passwordHash: makhoPasswordHash,
      name: 'Makho Admin',
      role: 'admin',
      emailConfirmed: true,
      onboardingCompleted: true,
    },
  });
  console.log(`Admin user created/updated: ${makhoAdmin.email}`);

  // Create bot status
  const botStatus = await prisma.botStatus.findFirst();
  if (!botStatus) {
    await prisma.botStatus.create({
      data: {
        isActive: false,
        callsToday: 0,
        callsQuotaDaily: 50,
      },
    });
    console.log('Bot status record created');
  }

  // Create sample prospects
  const sampleProspects = [
    {
      businessName: 'La Bonne Table',
      businessType: 'restaurant',
      city: 'Bruxelles',
      phone: '+32 2 123 45 67',
      email: 'contact@labonnetable.be',
      googleRating: 4.6,
      googleReviewsCount: 234,
      score: 92,
      status: 'new',
      country: 'BE',
    },
    {
      businessName: 'Hotel Royal Brussels',
      businessType: 'hotel',
      city: 'Bruxelles',
      phone: '+32 2 234 56 78',
      email: 'info@hotelroyal.be',
      googleRating: 4.3,
      googleReviewsCount: 189,
      score: 88,
      status: 'new',
      country: 'BE',
    },
    {
      businessName: 'Salon Belle Coiffure',
      businessType: 'salon',
      city: 'Anvers',
      phone: '+32 3 345 67 89',
      email: 'rdv@bellecoiffure.be',
      googleRating: 4.8,
      googleReviewsCount: 156,
      score: 85,
      status: 'new',
      country: 'BE',
    },
    {
      businessName: 'Spa Zen Garden',
      businessType: 'salon',
      city: 'Gand',
      phone: '+32 9 456 78 90',
      email: 'hello@spazengarden.be',
      googleRating: 4.7,
      googleReviewsCount: 98,
      score: 78,
      status: 'new',
      country: 'BE',
    },
    {
      businessName: 'Ristorante Bella Vista',
      businessType: 'restaurant',
      city: 'Liège',
      phone: '+32 4 567 89 01',
      email: 'reservation@bellavista.be',
      googleRating: 4.5,
      googleReviewsCount: 312,
      score: 95,
      status: 'new',
      country: 'BE',
    },
  ];

  for (const prospect of sampleProspects) {
    await prisma.prospect.upsert({
      where: { googlePlaceId: `seed_${prospect.businessName.toLowerCase().replace(/\s+/g, '_')}` },
      update: {},
      create: {
        ...prospect,
        googlePlaceId: `seed_${prospect.businessName.toLowerCase().replace(/\s+/g, '_')}`,
        googleTypes: [prospect.businessType],
        nextAction: 'call',
        nextActionDate: new Date(),
      },
    });
  }
  console.log(`${sampleProspects.length} sample prospects created`);

  // Create today's analytics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.analyticsDaily.upsert({
    where: { date: today },
    update: {},
    create: { date: today },
  });
  console.log('Daily analytics record created');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
