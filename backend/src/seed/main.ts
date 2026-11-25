import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { SetupTokens } from '../account-setup/setup-tokens.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { assertLocalDatabase } from './seed-safety.js';
import {
  DEMO_NOMINEE,
  DEMO_STAFF_PASSWORD,
  DEMO_SUPPLIER_PASSWORD,
  refreshDemoTenders,
  seed,
} from './seed.js';

// `npm run seed`: recreates the procurement demo data in the local database.
if (existsSync('.env')) process.loadEnvFile('.env');
assertLocalDatabase(process.env.DATABASE_URL);

const config = new ConfigService();
const prisma = new PrismaService(config);

try {
  const storage = new FileStorage(config);
  if (process.argv.includes('--tenders-only')) {
    const tenders = await refreshDemoTenders(prisma, storage);
    console.log('Refreshed tender fixtures:');
    for (const tender of tenders) console.log('  ' + tender.status.padEnd(16) + tender.title);
  } else {
    const summary = await seed(prisma, storage, new SetupTokens(config, prisma));
    console.log(`Seeded ${summary.categories} categories and ${summary.tenders.length} tenders:`);
    for (const tender of summary.tenders)
      console.log(`  ${tender.status.padEnd(10)} ${tender.title}`);
    console.log(`\nSeeded ${summary.applications.length} sign-up applications:`);
    for (const application of summary.applications)
      console.log(`  ${application.state.padEnd(16)} ${application.legalName}`);
    console.log(
      `\nDemo accounts (staff: ${DEMO_STAFF_PASSWORD}, suppliers: ${DEMO_SUPPLIER_PASSWORD}):`,
    );
    for (const account of summary.accounts)
      console.log(`  ${account.role.padEnd(20)} ${account.email}`);
    console.log(
      `\nS3: three committees on each accepted/published demo tender; ${DEMO_NOMINEE.email} awaits approval.`,
    );
    console.log(
      '\nWadi Supplies waits for account setup: with the API running, its setup email' +
        '\narrives in Mailpit (http://localhost:8025) within a minute.',
    );
  }
} finally {
  await prisma.$disconnect();
}
