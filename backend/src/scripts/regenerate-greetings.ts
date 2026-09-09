/**
 * Refabrique les accueils pré-enregistrés de toute la flotte.
 *
 *   npm run voice:greetings            # diagnostic, ne synthétise RIEN
 *   npm run voice:greetings -- --confirm
 *
 * ── Pourquoi ce script existe ───────────────────────────────────────────────
 *
 * Un accueil n'est régénéré qu'au moment où l'assistant du client est
 * resynchronisé, c'est-à-dire quand quelqu'un change un réglage. Tant que
 * personne ne touche à rien, une ligne périmée reste périmée.
 *
 * Ça n'a l'air de rien jusqu'au jour où c'est la VOIX qui change pour toute la
 * flotte, ce qui est arrivé le 27/08 en basculant vers Cartesia: aucune fiche
 * client n'avait bougé, donc aucun accueil n'a été refait, et depuis le 09/09
 * la lecture les écarte tous (ils sont dits par l'ancien fournisseur). La
 * conséquence n'est pas grave — l'appel retombe sur la synthèse en direct —
 * mais l'optimisation reste éteinte pour tout le monde jusqu'à ce geste.
 *
 * ── Ce qu'il ne fait pas ────────────────────────────────────────────────────
 *
 * Il ne touche pas aux assistants Vapi et ne change aucun réglage. Il ne fait
 * que rendre l'audio conforme à la voix déjà configurée.
 */
import { prisma } from '../config/database';
import { greetingAudioService } from '../services/voice/greeting-audio.service';
import { realtimeContextService } from '../services/voice/realtime-context.service';

async function main() {
  const confirm = process.argv.includes('--confirm');

  /* Les clients qui ont une réceptionniste en ligne, et eux seuls: synthétiser
     pour un compte sans assistant dépenserait pour un accueil que personne
     n'entendra jamais. */
  const clients = await prisma.client.findMany({
    where: { vapiAssistantId: { not: null } },
    select: { id: true, businessName: true },
    orderBy: { createdAt: 'asc' },
  });

  if (clients.length === 0) {
    console.log('\nAucun client avec un assistant Vapi: rien à refabriquer.\n');
    return;
  }

  const rows = await prisma.greetingAudio.groupBy({
    by: ['clientId', 'provider'],
    _count: { _all: true },
  });
  const byClient = new Map<string, string[]>();
  for (const r of rows) {
    const seen = byClient.get(r.clientId) ?? [];
    seen.push(`${r._count._all}×${r.provider ?? 'provenance inconnue'}`);
    byClient.set(r.clientId, seen);
  }

  console.log(`\n${clients.length} client(s) avec un assistant en ligne:\n`);
  for (const c of clients) {
    const state = byClient.get(c.id)?.join(', ') ?? 'aucun accueil enregistré';
    console.log(`  ${c.businessName.padEnd(28)} ${state}`);
  }

  if (!confirm) {
    console.log(
      "\nSIMULATION — rien n'a été synthétisé.\n" +
        'Relancer avec --confirm pour refabriquer les accueils manquants ou périmés.\n' +
        "Seules les variantes dont le texte OU la voix ont changé sont resynthétisées:\n" +
        "une ligne déjà conforme ne repasse pas à la caisse.\n",
    );
    return;
  }

  let written = 0;
  let failed = 0;

  for (const c of clients) {
    try {
      const profile = await realtimeContextService.getClientProfile(c.id);
      if (!profile) {
        console.log(`  IGNORÉ ${c.businessName} — profil illisible`);
        continue;
      }
      const n = await greetingAudioService.generate(profile);
      written += n;
      console.log(`  ${String(n).padStart(2)} variante(s) ${c.businessName}`);
    } catch (e) {
      failed++;
      console.error(`  ÉCHEC  ${c.businessName} — ${(e as Error).message}`);
    }
  }

  console.log(
    `\n${written} variante(s) synthétisée(s)` + (failed ? `, ${failed} client(s) en échec` : '') + '.\n',
  );
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
