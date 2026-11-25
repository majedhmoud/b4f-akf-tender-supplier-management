import { ConfigService } from '@nestjs/config';
import { SetupTokens } from '../account-setup/setup-tokens.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { DEMO_STAFF_PASSWORD, DEMO_SUPPLIER_PASSWORD, seed } from './seed.js';

if (process.env.RENDER !== 'true' || process.env.RENDER_DEMO_SEED !== 'true') {
  throw new Error('The Render demo initializer requires an opted-in Render service.');
}

const config = new ConfigService();
const password = config.getOrThrow<string>('DEMO_ACCESS_PASSWORD');
if (
  Buffer.byteLength(password) < 24 ||
  Buffer.byteLength(password) > 72 ||
  [DEMO_STAFF_PASSWORD, DEMO_SUPPLIER_PASSWORD].includes(password)
) {
  throw new Error('Configure a new random demo password of 24 to 72 bytes.');
}

const prisma = new PrismaService(config);
try {
  const [users, tenders, applications] = await Promise.all([
    prisma.userAccount.count(),
    prisma.tender.count(),
    prisma.supplierApplication.count(),
  ]);
  if (users === 0 && tenders === 0 && applications === 0) {
    const result = await seed(prisma, new FileStorage(config), new SetupTokens(config, prisma), {
      staff: password,
      supplier: password,
    });
    console.log(`Initialized ${result.tenders.length} fictional demo tenders.`);
  }
} finally {
  await prisma.$disconnect();
}
