import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Qwillio2026!', 12);

  // Reset makho.off@gmail.com password
  const updated = await prisma.user.upsert({
    where: { email: 'makho.off@gmail.com' },
    update: {
      passwordHash,
      role: 'admin',
      emailConfirmed: true,
      onboardingCompleted: true,
    },
    create: {
      email: 'makho.off@gmail.com',
      name: 'Mathieu',
      passwordHash,
      role: 'admin',
      emailConfirmed: true,
      onboardingCompleted: true,
    },
  });
  console.log('✅ makho.off@gmail.com reset:', updated.id);

  // Create dedicated admin@qwillio.com account
  const admin = await prisma.user.upsert({
    where: { email: 'admin@qwillio.com' },
    update: {
      passwordHash,
      role: 'admin',
      emailConfirmed: true,
      onboardingCompleted: true,
    },
    create: {
      email: 'admin@qwillio.com',
      name: 'Admin Qwillio',
      passwordHash,
      role: 'admin',
      emailConfirmed: true,
      onboardingCompleted: true,
    },
  });
  console.log('✅ admin@qwillio.com created/updated:', admin.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
