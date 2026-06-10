/**
 * Reset the admin (makho.off@gmail.com) password.
 *
 * The new password is read from the ADMIN_RESET_PASSWORD env var (or argv[2]) —
 * never hardcoded, so nothing sensitive is committed to this public repo.
 *
 * Usage (PowerShell, from backend/):
 *   $env:ADMIN_RESET_PASSWORD = 'your-strong-password'
 *   npx tsx scripts/reset-admin.ts
 *   Remove-Item Env:ADMIN_RESET_PASSWORD
 *
 * Connects to whatever DATABASE_URL your backend/.env points to (prod Neon).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'makho.off@gmail.com';
const newPassword = process.env.ADMIN_RESET_PASSWORD || process.argv[2];

async function main() {
  if (!newPassword || newPassword.length < 10) {
    console.error('✗ No password provided (or shorter than 10 chars).');
    console.error('  Usage: ADMIN_RESET_PASSWORD="your-strong-password" npx tsx scripts/reset-admin.ts');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      role: 'admin',
      emailConfirmed: true,
      onboardingCompleted: true,
    },
    create: {
      email: ADMIN_EMAIL,
      name: 'Mathieu',
      passwordHash,
      role: 'admin',
      emailConfirmed: true,
      onboardingCompleted: true,
    },
  });

  console.log(`✅ Password reset for ${ADMIN_EMAIL} (id: ${user.id})`);
  console.log('   You can now log in with the password you just set.');
}

main()
  .catch((e) => {
    console.error('✗ Reset failed:', e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
