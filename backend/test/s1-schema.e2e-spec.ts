import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { uniqueRunId } from './support/run-id.js';

// Pins the S1 database rules from ERD.md that live in the migration as CHECK
// constraints or keys, so a later migration cannot drop them unnoticed.
// Runs against the local database; every row uses a run-unique suffix and is
// deleted in afterAll (CODING_STANDARDS.md §2.7).
describe('S1 schema constraints (e2e)', () => {
  let prisma: PrismaService;
  const runId = uniqueRunId();
  const categoryCode = `test-${runId}`;
  const tenderIds: string[] = [];
  const documentIds: string[] = [];
  let employeeId: string;

  const deadlines = {
    applicationDeadline: new Date('2030-01-10T12:00:00Z'),
    technicalDeadline: new Date('2030-01-17T12:00:00Z'),
    financialDeadline: new Date('2030-01-24T12:00:00Z'),
  };

  async function createTender(data: Record<string, unknown> = {}) {
    const tender = await prisma.tender.create({
      data: {
        categoryCode,
        requestedByUserId: employeeId,
        estimatedBalance: '125000.00',
        currencyCode: 'USD',
        ...data,
      },
    });
    tenderIds.push(tender.id);
    return tender;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);

    await prisma.tenderCategory.create({ data: { code: categoryCode } });
    const employee = await prisma.userAccount.create({
      data: {
        email: `employee-${runId}@test.local`,
        displayName: 'Test Employee',
        preferredLanguage: 'en',
        status: 'active',
        roles: { create: { role: 'employee' } },
      },
    });
    employeeId = employee.id;
  });

  afterAll(async () => {
    // Copies first: the source of a copy is protected by a Restrict key.
    await prisma.tender.deleteMany({
      where: { id: { in: tenderIds }, copiedFromTenderId: { not: null } },
    });
    await prisma.tender.deleteMany({ where: { id: { in: tenderIds } } });
    await prisma.document.deleteMany({ where: { id: { in: documentIds } } });
    await prisma.userAccount.deleteMany({ where: { id: employeeId } });
    await prisma.tenderCategory.deleteMany({ where: { code: categoryCode } });
    await prisma.$disconnect();
  });

  it('rejects an account with an empty display name', async () => {
    await expect(
      prisma.userAccount.create({
        data: {
          email: `blank-${runId}@test.local`,
          displayName: ' ',
          preferredLanguage: 'en',
          status: 'active',
        },
      }),
    ).rejects.toThrow(/user_accounts_display_name_check/);
  });

  it('stores a draft tender with a complete translation and starts it at revision 1', async () => {
    const tender = await createTender({
      translations: {
        create: { language: 'en', title: 'School maintenance', description: 'Repairs.' },
      },
    });

    expect(tender.status).toBe('draft');
    expect(tender.revision).toBe(1);
  });

  it('rejects a translation with an empty title', async () => {
    const tender = await createTender();

    await expect(
      prisma.tenderTranslation.create({
        data: { tenderId: tender.id, language: 'ar', title: '  ', description: 'وصف' },
      }),
    ).rejects.toThrow(/tender_translations_complete_check/);
  });

  it('rejects score weights that do not add up to 100', async () => {
    const tender = await createTender();

    await expect(
      prisma.tenderScoring.create({
        data: {
          tenderId: tender.id,
          technicalWeight: 70,
          financialWeight: 20,
          minimumTechnicalScore: 60,
        },
      }),
    ).rejects.toThrow(/tender_scorings_total_check/);
  });

  it('rejects a draft tender that already has deadlines', async () => {
    await expect(createTender(deadlines)).rejects.toThrow(/tenders_deadlines_by_status_check/);
  });

  it('rejects a published tender without deadlines', async () => {
    await expect(createTender({ status: 'published' })).rejects.toThrow(
      /tenders_deadlines_by_status_check/,
    );
  });

  it('rejects deadlines out of order', async () => {
    await expect(
      createTender({
        status: 'published',
        ...deadlines,
        technicalDeadline: new Date('2030-01-30T12:00:00Z'),
      }),
    ).rejects.toThrow(/tenders_deadline_order_check/);
  });

  it('rejects a cancelled tender without a cancellation reason', async () => {
    await expect(
      createTender({ status: 'cancelled', cancelledAt: new Date(), ...deadlines }),
    ).rejects.toThrow(/tenders_cancellation_check/);
  });

  it('allows a cancelled tender to be copied only once', async () => {
    const source = await createTender({
      status: 'cancelled',
      cancellationReason: 'no_bids',
      cancelledAt: new Date(),
      ...deadlines,
    });
    await createTender({ status: 'accepted', copiedFromTenderId: source.id });

    await expect(
      createTender({ status: 'accepted', copiedFromTenderId: source.id }),
    ).rejects.toThrow(/copied_from_tender_id/);
  });

  it('refuses to link a supplier document as a tender document', async () => {
    const tender = await createTender();
    const document = await prisma.document.create({
      data: {
        ownerType: 'supplier',
        storageKey: `key-${runId}`,
        originalName: 'profile.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        language: 'en',
      },
    });
    documentIds.push(document.id);

    await expect(
      prisma.tenderDocument.create({
        data: { documentId: document.id, tenderId: tender.id, kind: 'terms_of_reference' },
      }),
    ).rejects.toThrow(
      /tender_documents_document_id_owner_type_fkey|tender_documents_owner_type_check/,
    );
  });

  it('rejects a unit on a field that is not a number', async () => {
    const tender = await createTender();

    await expect(
      prisma.tenderFormField.create({
        data: {
          tenderId: tender.id,
          partType: 'technical_offer',
          inputType: 'text',
          position: 0,
          required: true,
          unit: 'GB',
        },
      }),
    ).rejects.toThrow(/tender_form_fields_number_options_check/);
  });
});
