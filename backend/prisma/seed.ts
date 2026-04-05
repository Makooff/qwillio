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
