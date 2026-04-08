/**
 * One-time cleanup: remove fake Belgian prospects + "vivi pizza" client
 * Run with: cd backend && npx tsx src/scripts/cleanup-fake-data.ts
 */
import { prisma } from '../config/database';

async function main() {
  // ── 1. Delete fake Belgian prospects ─────────────────────
  const belgianCities = ['Liège', 'Bruxelles', 'Anvers', 'Gand', 'Brussels', 'Antwerp', 'Ghent'];
  const belgianProspects = await prisma.prospect.findMany({
    where: {
      OR: [
        { country: 'BE' },
        { country: 'Belgium' },
        { city: { in: belgianCities } },
      ],
    },
    select: { id: true, businessName: true, city: true, country: true },
  });

  console.log(`Found ${belgianProspects.length} Belgian prospect(s):`);
  belgianProspects.forEach(p => console.log(`  - [${p.id}] ${p.businessName} / ${p.city} / ${p.country}`));

  if (belgianProspects.length > 0) {
    const ids = belgianProspects.map(p => p.id);
    const deleted = await prisma.prospect.deleteMany({ where: { id: { in: ids } } });
    console.log(`Deleted ${deleted.count} Belgian prospect(s).`);
  }

  // ── 2. Delete fake "vivi pizza" client ───────────────────
  const viviClients = await prisma.client.findMany({
    where: {
      OR: [
        { businessName: { contains: 'vivi', mode: 'insensitive' } },
        { businessName: { contains: 'pizza', mode: 'insensitive' } },
      ],
    },
    select: { id: true, businessName: true, contactEmail: true },
  });

  console.log(`\nFound ${viviClients.length} "vivi pizza" client(s):`);
  viviClients.forEach(c => console.log(`  - [${c.id}] ${c.businessName} / ${c.contactEmail}`));

  for (const client of viviClients) {
    const fullClient = await prisma.client.findUnique({
      where: { id: client.id },
      select: { userId: true },
    });
    // Cascade delete handles related records
    await prisma.client.delete({ where: { id: client.id } });
    console.log(`Deleted client: ${client.businessName}`);

    if (fullClient?.userId) {
      await prisma.user.delete({ where: { id: fullClient.userId } }).catch(() => {});
      console.log(`Deleted linked user for: ${client.businessName}`);
    }
  }

  console.log('\nCleanup complete.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
