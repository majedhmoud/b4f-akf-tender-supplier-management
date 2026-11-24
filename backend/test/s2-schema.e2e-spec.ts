import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Pins the hand-written database rules of IDEMPOTENCY_KEY (ERD, Supporting
// tables) and EMAIL_MESSAGE (ERD, Emails).
// schema.prisma marks the model @@ignore, so Prisma does not manage it and a
// generated migration could drop these rules without anyone noticing. Keep
// this test green when adding migrations.
describe('S2 schema rules (e2e)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('keeps the idempotency foreign key, checks, and one unique key per owner type', async () => {
    const constraints = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint WHERE conrelid = 'idempotency_keys'::regclass`;
    const indexes = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'idempotency_keys'`;

    expect(constraints.map((c) => c.conname)).toEqual(
      expect.arrayContaining([
        'idempotency_keys_user_id_fkey',
        'idempotency_keys_owner_check',
        'idempotency_keys_response_check',
      ]),
    );
    const partial = (name: string) => indexes.find((i) => i.indexname === name)?.indexdef ?? '';
    expect(partial('idempotency_keys_user_route_key')).toMatch(
      /UNIQUE.*WHERE \(user_id IS NOT NULL\)/,
    );
    expect(partial('idempotency_keys_guest_route_key')).toMatch(
      /UNIQUE.*WHERE \(guest_scope_id IS NOT NULL\)/,
    );
  });

  // Prisma does not manage CHECKs or partial indexes either (ERD, Emails).
  it('keeps the email status checks and one award or cancellation email per recipient', async () => {
    const constraints = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint WHERE conrelid = 'email_messages'::regclass`;
    const [index] = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'email_messages_tender_recipient_kind_key'`;

    expect(constraints.map((c) => c.conname)).toEqual(
      expect.arrayContaining([
        'email_messages_revision_check',
        'email_messages_sent_check',
        'email_messages_failed_check',
        'email_messages_tender_check',
      ]),
    );
    expect(index?.indexdef).toMatch(/UNIQUE.*WHERE/);
  });

  it('runs every database session in UTC, so raw timestamps are never shifted', async () => {
    const [row] = await prisma.$queryRaw<
      { tz: string }[]
    >`SELECT current_setting('TimeZone') AS tz`;
    expect(row.tz).toBe('UTC');
  });
});
