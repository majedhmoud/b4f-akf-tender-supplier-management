import * as bcrypt from 'bcrypt';
import type {
  CommitteeType,
  Language,
  PartType,
  Prisma,
  TenderStatus,
} from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SetupTokens } from '../account-setup/setup-tokens.js';
import { accountSetupEmail } from '../notifications/email-templates.js';
import type { FileStorage } from '../storage/file-storage.js';
import { demoPdf } from './demo-pdf.js';

// Demo data for S1 (docs/06_SLICES/S1_TENDER_PUBLISHING.md, "Seed data").
// Every name is fictional. Demo accounts use the reserved `.test` domain, so
// they can never be real addresses, and the seed only touches those accounts
// and their tenders.

export const DEMO_DOMAIN = '@akf-demo.test';
// A clearly labelled demo password, listed in the README as the submission
// requirements ask. Never reuse it anywhere real.
export const DEMO_PASSWORD = 'AKF-demo-2026';
export const DEMO_MEMBER = { email: `member${DEMO_DOMAIN}`, displayName: 'Nadia Salim' };
export const DEMO_NOMINEE = { email: `nominee${DEMO_DOMAIN}`, displayName: 'Rami Hassan' };
// S5: the legal and financial members of the tender under evaluation. The
// technical member there is DEMO_MEMBER. Like DEMO_MEMBER, they hold no role.
export const DEMO_EVALUATORS = [
  { email: `legal-member${DEMO_DOMAIN}`, displayName: 'Huda Karam', type: 'legal_committee' },
  {
    email: `finance-member${DEMO_DOMAIN}`,
    displayName: 'Tariq Nasser',
    type: 'financial_committee',
  },
] as const;

// The fixed category list (ERD A7). Labels live in the front end translations.
export const CATEGORIES = [
  'construction',
  'goods_and_supplies',
  'information_technology',
  'consulting_services',
  'maintenance_services',
  'transport_and_logistics',
];

export const DEMO_ACCOUNTS = [
  { email: `employee${DEMO_DOMAIN}`, displayName: 'Lina Haddad', role: 'employee' as const },
  {
    email: `officer${DEMO_DOMAIN}`,
    displayName: 'Omar Khalil',
    role: 'procurement_officer' as const,
  },
  // The standing legal role reviews sign-ups only, never tenders (ERD, Sign-up).
  { email: `legal${DEMO_DOMAIN}`, displayName: 'Sara Mansour', role: 'legal_committee' as const },
  { email: `admin${DEMO_DOMAIN}`, displayName: 'Karim Aziz', role: 'admin' as const },
];

// Demo applicants' contact emails end with this reserved `.test` domain, so the
// seed can find and reset their applications.
export const DEMO_APPLICANT_DOMAIN = '.demo.test';

interface DemoApplication {
  legalName: string;
  registrationNumber: string;
  contactEmail: string;
  preferredLanguage: Language;
  submittedDaysAgo: number;
  review?: { decision: 'accepted' | 'rejected'; reason: string | null };
  // Accepted by the admin too: the supplier waits for account setup.
  adminAccepted?: boolean;
  // With adminAccepted: the supplier already set its password and can bid (S4 demo).
  active?: boolean;
}

// One of each state the S2 screens show: waiting for legal review, raised to
// the admin, rejected, and accepted by the admin with account setup pending.
const APPLICATIONS: DemoApplication[] = [
  {
    legalName: 'Al-Noor Engineering',
    registrationNumber: 'CR-DEMO-1001',
    contactEmail: `tenders@alnoor${DEMO_APPLICANT_DOMAIN}`,
    preferredLanguage: 'ar',
    submittedDaysAgo: 1,
  },
  {
    legalName: 'Sahel Builders',
    registrationNumber: 'CR-DEMO-1002',
    contactEmail: `bids@sahel${DEMO_APPLICANT_DOMAIN}`,
    preferredLanguage: 'en',
    submittedDaysAgo: 3,
    review: { decision: 'accepted', reason: null },
  },
  {
    legalName: 'Rawda Contracting',
    registrationNumber: 'CR-DEMO-1003',
    contactEmail: `office@rawda${DEMO_APPLICANT_DOMAIN}`,
    preferredLanguage: 'en',
    submittedDaysAgo: 5,
    review: { decision: 'rejected', reason: 'The registration certificate has expired.' },
  },
  {
    legalName: 'Wadi Supplies',
    registrationNumber: 'CR-DEMO-1004',
    contactEmail: `sales@wadi${DEMO_APPLICANT_DOMAIN}`,
    preferredLanguage: 'en',
    submittedDaysAgo: 4,
    review: { decision: 'accepted', reason: null },
    adminAccepted: true,
  },
  {
    legalName: 'Cedar Supplies',
    registrationNumber: 'CR-DEMO-1005',
    contactEmail: `supplier@cedar${DEMO_APPLICANT_DOMAIN}`,
    preferredLanguage: 'en',
    submittedDaysAgo: 6,
    review: { decision: 'accepted', reason: null },
    adminAccepted: true,
    active: true,
  },
  {
    legalName: 'Rafid Works',
    registrationNumber: 'CR-DEMO-1006',
    contactEmail: `bids@rafid${DEMO_APPLICANT_DOMAIN}`,
    preferredLanguage: 'ar',
    submittedDaysAgo: 7,
    review: { decision: 'accepted', reason: null },
    adminAccepted: true,
    active: true,
  },
];

const DAY = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY);

interface Translation {
  language: Language;
  title: string;
  description: string;
}

interface DemoFile {
  language: string;
  name: string;
  translations?: { language: string; name: string }[];
}

interface DemoTender {
  status: TenderStatus;
  categoryCode: string;
  amount: string;
  createdDaysAgo: number;
  translations: Translation[];
  scoring?: { technicalWeight: number; financialWeight: number; minimumTechnicalScore: number };
  deadlines?: [number, number, number];
  termsOfReference?: DemoFile;
  customField?: {
    partType: PartType;
    unit?: string;
    minimum?: number;
    label: string;
    labelAr: string;
  };
}

const TENDERS: DemoTender[] = [
  // S5: every deadline has passed and the bids wait for evaluation.
  {
    status: 'under_evaluation',
    categoryCode: 'construction',
    amount: '60000.00',
    createdDaysAgo: 20,
    translations: [
      {
        language: 'en',
        title: 'Solar panels for health clinics',
        description: 'Supply and installation of solar panels for four rural health clinics.',
      },
      {
        language: 'ar',
        title: 'ألواح شمسية للعيادات الصحية',
        description: 'توريد وتركيب ألواح شمسية لأربع عيادات صحية ريفية.',
      },
    ],
    scoring: { technicalWeight: 60, financialWeight: 40, minimumTechnicalScore: 65 },
    deadlines: [-6, -3, -1],
  },
  {
    status: 'draft',
    categoryCode: 'construction',
    amount: '125000.00',
    createdDaysAgo: 1,
    translations: [
      {
        language: 'en',
        title: 'Roof repair at the Rawda school',
        description:
          'Repair and waterproof the roof of the Rawda primary school before the rainy season.',
      },
    ],
  },
  {
    status: 'accepted',
    categoryCode: 'consulting_services',
    amount: '40000.00',
    createdDaysAgo: 3,
    translations: [
      {
        language: 'en',
        title: 'Evaluation of the teacher training programme',
        description: 'An independent evaluation of the 2025–2026 teacher training programme.',
      },
      {
        language: 'ar',
        title: 'تقييم برنامج تدريب المعلمين',
        description: 'تقييم مستقل لبرنامج تدريب المعلمين للعام 2025–2026.',
      },
    ],
    scoring: { technicalWeight: 70, financialWeight: 30, minimumTechnicalScore: 60 },
    termsOfReference: { language: 'en', name: 'Evaluation ToR.pdf' },
    customField: {
      partType: 'technical_offer',
      unit: 'years',
      minimum: 3,
      label: 'Years of evaluation experience',
      labelAr: 'سنوات الخبرة في التقييم',
    },
  },
  {
    status: 'published',
    categoryCode: 'information_technology',
    amount: '90000.00',
    createdDaysAgo: 6,
    translations: [
      {
        language: 'en',
        title: 'Laptops for teachers',
        description:
          'Supply of 120 laptops for teachers in partner schools, with a 3-year warranty.',
      },
      {
        language: 'ar',
        title: 'حواسيب محمولة للمعلمين',
        description: 'توريد 120 حاسوبًا محمولًا لمعلمي المدارس الشريكة مع ضمان لمدة 3 سنوات.',
      },
    ],
    scoring: { technicalWeight: 60, financialWeight: 40, minimumTechnicalScore: 70 },
    deadlines: [10, 17, 24],
    termsOfReference: {
      language: 'ar',
      name: 'الشروط المرجعية.pdf',
      translations: [{ language: 'en', name: 'Terms of Reference (en).pdf' }],
    },
    customField: {
      partType: 'technical_offer',
      unit: 'GB',
      minimum: 16,
      label: 'Memory per laptop',
      labelAr: 'الذاكرة لكل حاسوب',
    },
  },
  {
    status: 'published',
    categoryCode: 'goods_and_supplies',
    amount: '15000.00',
    createdDaysAgo: 8,
    // Arabic only, to show the language fallback.
    translations: [
      {
        language: 'ar',
        title: 'توريد لوازم مدرسية',
        description: 'توريد دفاتر وأقلام وحقائب مدرسية لـ 500 طالب.',
      },
    ],
    scoring: { technicalWeight: 50, financialWeight: 50, minimumTechnicalScore: 50 },
    deadlines: [14, 21, 28],
    termsOfReference: { language: 'ar', name: 'لوازم مدرسية.pdf' },
  },
  {
    status: 'cancelled',
    categoryCode: 'maintenance_services',
    amount: '30000.00',
    createdDaysAgo: 40,
    // Published, then cancelled at its application deadline with no bids,
    // so it can be copied.
    translations: [
      {
        language: 'en',
        title: 'Water well maintenance in the north district',
        description: 'Maintenance of six community water wells in the north district.',
      },
    ],
    scoring: { technicalWeight: 70, financialWeight: 30, minimumTechnicalScore: 60 },
    deadlines: [-20, -13, -6],
    termsOfReference: { language: 'en', name: 'Well maintenance ToR.pdf' },
  },
];

// Deletes the previous demo accounts and their tenders and files, so the seed
// can run again at any time.
async function removeDemoData(prisma: PrismaService, storage: FileStorage) {
  const users = await prisma.userAccount.findMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const documents = await prisma.document.findMany({
    where: { uploadedByUserId: { in: userIds } },
    select: { storageKey: true },
  });
  const tenders = { requestedByUserId: { in: userIds } };

  // Demo applications, their files, reviews, and audit events.
  const applications = await prisma.supplierApplication.findMany({
    where: { contactEmail: { endsWith: DEMO_APPLICANT_DOMAIN } },
    select: {
      id: true,
      documents: { select: { document: { select: { id: true, storageKey: true } } } },
    },
  });
  const applicationIds = applications.map((a) => a.id);
  const applicationDocuments = applications.flatMap((a) => a.documents.map((d) => d.document));
  // Supplier accounts created from demo applications, with their emails.
  const suppliers = await prisma.userAccount.findMany({
    where: { email: { endsWith: DEMO_APPLICANT_DOMAIN } },
    select: { id: true },
  });
  const supplierIds = suppliers.map((u) => u.id);
  // Certificates those suppliers replaced on their profile.
  const supplierDocuments = await prisma.document.findMany({
    where: { supplierLink: { supplier: { userId: { in: supplierIds } } } },
    select: { id: true, storageKey: true },
  });

  // Bids on demo tenders or by demo suppliers, with their stored files. They
  // go first: a bid restricts deleting its tender and its supplier.
  const bidWhere: Prisma.BidWhereInput = {
    OR: [{ tender: tenders }, { supplier: { userId: { in: supplierIds } } }],
  };
  const bids = await prisma.bid.findMany({ where: bidWhere, select: { id: true } });
  const bidIds = bids.map((b) => b.id);
  const bidDocuments = await prisma.document.findMany({
    where: { bidPartLink: { bidPart: { bidId: { in: bidIds } } } },
    select: { id: true, storageKey: true },
  });

  const nominations = await prisma.committeeAssignment.findMany({
    where: { committee: { tender: tenders } },
    select: { id: true },
  });
  const nominationIds = nominations.map((row) => row.id);
  await prisma.$transaction([
    prisma.auditEvent.deleteMany({
      where: {
        OR: [
          {
            resourceId: {
              in: [...applicationIds, ...supplierIds, ...nominationIds, ...userIds, ...bidIds],
            },
          },
          { actorUserId: { in: supplierIds } },
        ],
      },
    }),
    prisma.emailMessage.deleteMany({
      where: { recipientUserId: { in: [...userIds, ...supplierIds] } },
    }),
    // Parts and answers cascade from the bid; files go with their documents.
    prisma.document.deleteMany({ where: { id: { in: bidDocuments.map((d) => d.id) } } }),
    prisma.bid.deleteMany({ where: { id: { in: bidIds } } }),
    prisma.document.deleteMany({ where: { id: { in: supplierDocuments.map((d) => d.id) } } }),
    prisma.supplier.deleteMany({ where: { userId: { in: supplierIds } } }),
    prisma.signupReview.deleteMany({
      where: {
        OR: [{ applicationId: { in: applicationIds } }, { reviewerUserId: { in: userIds } }],
      },
    }),
    prisma.document.deleteMany({ where: { id: { in: applicationDocuments.map((d) => d.id) } } }),
    prisma.supplierApplication.deleteMany({ where: { id: { in: applicationIds } } }),
    prisma.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } }),
    // Committees raised on demo tenders, with their nominations.
    prisma.committeeAssignment.deleteMany({ where: { committee: { tender: tenders } } }),
    prisma.tenderCommittee.deleteMany({ where: { tender: tenders } }),
    prisma.tender.deleteMany({ where: { ...tenders, copiedFromTenderId: { not: null } } }),
    prisma.document.deleteMany({ where: { uploadedByUserId: { in: userIds } } }),
    prisma.tender.deleteMany({ where: tenders }),
    // Saved retry keys of demo accounts (bids since S4) restrict deleting them.
    prisma.$executeRaw`DELETE FROM idempotency_keys WHERE user_id = ANY(${[...userIds, ...supplierIds]}::uuid[])`,
    prisma.userAccount.deleteMany({ where: { id: { in: [...userIds, ...supplierIds] } } }),
  ]);
  await Promise.all(
    [...documents, ...applicationDocuments, ...supplierDocuments, ...bidDocuments].map((d) =>
      // A file already gone must not fail the reset after the rows are deleted.
      storage.delete(d.storageKey).catch(() => undefined),
    ),
  );
}

// What U7 commits: the supplier, its pending account, the first setup link
// and its email at `sending`. The running API's email recovery delivers it to
// Mailpit, so the link is read there and never printed or stored.
// An active supplier signs in with the demo password; a pending one gets
// its setup link and email, which the running API delivers to Mailpit.
async function addSupplier(
  prisma: PrismaService,
  tokens: SetupTokens,
  applicationId: string,
  demo: DemoApplication,
  passwordHash: string,
) {
  await prisma.$transaction(async (tx) => {
    const user = await tx.userAccount.create({
      data: {
        email: demo.contactEmail,
        displayName: demo.legalName,
        preferredLanguage: demo.preferredLanguage,
        ...(demo.active
          ? { status: 'active', passwordHash, emailVerifiedAt: new Date() }
          : { status: 'pending_setup' }),
        roles: { create: { role: 'supplier' } },
      },
      select: { id: true },
    });
    await tx.supplier.create({
      data: {
        applicationId,
        userId: user.id,
        legalName: demo.legalName,
        registrationNumber: demo.registrationNumber,
      },
    });
    if (demo.active) return;
    await tokens.issue(tx, user.id);
    await tx.emailMessage.create({
      data: {
        kind: 'account_setup',
        recipientUserId: user.id,
        recipientEmail: demo.contactEmail,
        language: demo.preferredLanguage,
        ...accountSetupEmail(demo.preferredLanguage, demo.legalName),
        status: 'sending',
      },
    });
  });
}

async function addTermsOfReference(
  prisma: PrismaService,
  storage: FileStorage,
  tenderId: string,
  uploadedByUserId: string,
  title: string,
  file: DemoFile,
) {
  const content = demoPdf(title);
  const create = async (language: string, name: string, translationOfId: string | null) =>
    prisma.document.create({
      data: {
        ownerType: 'tender',
        storageKey: await storage.save(content),
        originalName: name,
        mimeType: 'application/pdf',
        sizeBytes: content.length,
        language,
        translationOfId,
        uploadedByUserId,
        tenderLink: { create: { tenderId, kind: 'terms_of_reference' } },
      },
      select: { id: true },
    });

  const original = await create(file.language, file.name, null);
  for (const translation of file.translations ?? []) {
    await create(translation.language, translation.name, original.id);
  }
}

// S5: a tender under evaluation with all three committees staffed and two
// bids from the active demo suppliers. The reset removes it with the other
// demo tenders: bids first, then assignments, committees and accounts.
async function addEvaluationDemo(
  prisma: PrismaService,
  storage: FileStorage,
  tenderId: string,
  technicalMemberId: string,
  adminId: string,
  passwordHash: string,
) {
  const members: Record<CommitteeType, string> = {
    legal_committee: '',
    technical_committee: technicalMemberId,
    financial_committee: '',
  };
  for (const evaluator of DEMO_EVALUATORS) {
    const user = await prisma.userAccount.create({
      data: {
        email: evaluator.email,
        displayName: evaluator.displayName,
        preferredLanguage: 'en',
        status: 'active',
        passwordHash,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    members[evaluator.type] = user.id;
  }
  const members_ = await prisma.userAccount.findMany({
    where: { id: { in: Object.values(members) } },
    select: { id: true, email: true, displayName: true },
  });
  for (const type of Object.keys(members) as CommitteeType[]) {
    const committee = await prisma.tenderCommittee.create({
      data: { tenderId, type },
      select: { id: true },
    });
    const person = members_.find((m) => m.id === members[type])!;
    await prisma.committeeAssignment.create({
      data: {
        committeeId: committee.id,
        tenderId,
        nomineeName: person.displayName,
        nomineeEmail: person.email,
        userId: person.id,
        status: 'approved',
        approvedByUserId: adminId,
        nominatedAt: at(-12),
        decidedAt: at(-11),
      },
    });
  }

  const suppliers = await prisma.supplier.findMany({
    where: {
      user: { email: { in: APPLICATIONS.filter((a) => a.active).map((a) => a.contactEmail) } },
    },
    select: { id: true, userId: true, legalName: true },
    orderBy: { legalName: 'asc' },
  });
  const files: Record<PartType, string> = {
    legal_information: 'registration_certificate',
    technical_offer: 'technical_proposal',
    financial_offer: 'financial_proposal',
  };
  for (const [i, supplier] of suppliers.entries()) {
    const bid = await prisma.bid.create({
      data: {
        tenderId,
        supplierId: supplier.id,
        bidderCode: `B-DEMO${i + 1}`,
        submittedAt: at(-8),
      },
      select: { id: true },
    });
    for (const partType of Object.keys(files) as PartType[]) {
      const part = await prisma.bidPart.create({
        data: {
          bidId: bid.id,
          partType,
          standardAnswers:
            partType === 'legal_information'
              ? { authorizedSignatoryName: `${supplier.legalName} director` }
              : {},
          lastSubmittedAt: at(-8),
        },
        select: { id: true },
      });
      const content = demoPdf(`${supplier.legalName} - ${files[partType]}`);
      await prisma.document.create({
        data: {
          ownerType: 'bid_part',
          storageKey: await storage.save(content),
          originalName: `${files[partType]}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: content.length,
          language: 'en',
          uploadedByUserId: supplier.userId,
          bidPartLink: { create: { bidPartId: part.id, kind: files[partType] } },
        },
      });
    }
  }
}

// S3 fixtures stay attached to demo-owned tenders so the existing reset removes them.
async function addDemoCommittees(
  prisma: PrismaService,
  tenders: { id: string; status: TenderStatus }[],
  memberId: string,
  adminId: string,
) {
  const types: CommitteeType[] = ['legal_committee', 'technical_committee', 'financial_committee'];
  await prisma.tenderCommittee.createMany({
    data: tenders.flatMap((tender) => types.map((type) => ({ tenderId: tender.id, type }))),
  });
  const published = tenders.find((tender) => tender.status === 'published');
  const accepted = tenders.find((tender) => tender.status === 'accepted');
  if (!published || !accepted)
    throw new Error('Committee demo needs accepted and published tenders');
  const approvedCommittee = await prisma.tenderCommittee.findUniqueOrThrow({
    where: { tenderId_type: { tenderId: published.id, type: 'technical_committee' } },
    select: { id: true },
  });
  const waitingCommittee = await prisma.tenderCommittee.findUniqueOrThrow({
    where: { tenderId_type: { tenderId: accepted.id, type: 'legal_committee' } },
    select: { id: true },
  });
  const nominatedAt = new Date(Date.now() - 60_000);
  await prisma.$transaction([
    prisma.committeeAssignment.create({
      data: {
        committeeId: approvedCommittee.id,
        tenderId: published.id,
        nomineeName: DEMO_MEMBER.displayName,
        nomineeEmail: DEMO_MEMBER.email,
        userId: memberId,
        status: 'approved',
        approvedByUserId: adminId,
        nominatedAt,
        decidedAt: new Date(),
      },
    }),
    prisma.committeeAssignment.create({
      data: {
        committeeId: waitingCommittee.id,
        tenderId: accepted.id,
        nomineeName: DEMO_NOMINEE.displayName,
        nomineeEmail: DEMO_NOMINEE.email,
        status: 'nominated',
        nominatedAt,
      },
    }),
  ]);
}

export interface SeedSummary {
  categories: number;
  accounts: { email: string; role: string }[];
  tenders: { title: string; status: TenderStatus }[];
  applications: { legalName: string; state: string }[];
}

export async function seed(
  prisma: PrismaService,
  storage: FileStorage,
  tokens: SetupTokens,
): Promise<SeedSummary> {
  await prisma.tenderCategory.createMany({
    data: CATEGORIES.map((code) => ({ code })),
    skipDuplicates: true,
  });
  await removeDemoData(prisma, storage);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const ids: Record<string, string> = {};
  for (const account of DEMO_ACCOUNTS) {
    const user = await prisma.userAccount.create({
      data: {
        email: account.email,
        displayName: account.displayName,
        preferredLanguage: 'en',
        status: 'active',
        emailVerifiedAt: new Date(),
        passwordHash,
        roles: { create: { role: account.role } },
      },
      select: { id: true },
    });
    ids[account.role] = user.id;
  }

  // An activated member has no account role; only its approved assignment grants access.
  const member = await prisma.userAccount.create({
    data: {
      ...DEMO_MEMBER,
      preferredLanguage: 'en',
      status: 'active',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  const staffingTenders: { id: string; status: TenderStatus }[] = [];
  let evaluationTenderId: string | null = null;
  for (const demo of TENDERS) {
    // Only used when the tender has deadlines.
    const [application, technical, financial] = demo.deadlines ?? [0, 0, 0];
    const data: Prisma.TenderUncheckedCreateInput = {
      status: demo.status,
      categoryCode: demo.categoryCode,
      requestedByUserId: ids.employee,
      estimatedBalance: demo.amount,
      currencyCode: 'USD',
      createdAt: at(-demo.createdDaysAgo),
      translations: { create: demo.translations },
      ...(demo.scoring
        ? { scoring: { create: demo.scoring }, acceptedAt: at(-demo.createdDaysAgo + 1) }
        : {}),
      ...(demo.deadlines
        ? {
            applicationDeadline: at(application),
            technicalDeadline: at(technical),
            financialDeadline: at(financial),
            publishedAt: at(-demo.createdDaysAgo + 2),
          }
        : {}),
      ...(demo.status === 'cancelled'
        ? { cancellationReason: 'no_bids', cancelledAt: at(application) }
        : {}),
      ...(demo.customField
        ? {
            formFields: {
              create: {
                partType: demo.customField.partType,
                inputType: 'number',
                position: 0,
                required: true,
                unit: demo.customField.unit,
                minimum: demo.customField.minimum,
                translations: {
                  create: [
                    { language: 'en', label: demo.customField.label },
                    { language: 'ar', label: demo.customField.labelAr },
                  ],
                },
              },
            },
          }
        : {}),
    };
    const tender = await prisma.tender.create({ data, select: { id: true } });
    if (demo.status === 'accepted' || demo.status === 'published')
      staffingTenders.push({ id: tender.id, status: demo.status });
    if (demo.status === 'under_evaluation') evaluationTenderId = tender.id;

    if (demo.termsOfReference) {
      await addTermsOfReference(
        prisma,
        storage,
        tender.id,
        ids.procurement_officer,
        demo.translations[0].title,
        demo.termsOfReference,
      );
    }
  }

  await addDemoCommittees(prisma, staffingTenders, member.id, ids.admin);

  for (const demo of APPLICATIONS) {
    const submittedAt = at(-demo.submittedDaysAgo);
    const application = await prisma.supplierApplication.create({
      data: {
        legalName: demo.legalName,
        registrationNumber: demo.registrationNumber,
        contactEmail: demo.contactEmail,
        preferredLanguage: demo.preferredLanguage,
        submittedAt,
      },
      select: { id: true },
    });
    for (const [kind, language] of [
      ['registration_certificate', demo.preferredLanguage],
      ['tax_certificate', 'en'],
    ] as const) {
      const content = demoPdf(`${demo.legalName} - ${kind}`);
      await prisma.document.create({
        data: {
          ownerType: 'application',
          storageKey: await storage.save(content),
          originalName: `${kind}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: content.length,
          language,
          applicationLink: { create: { applicationId: application.id, kind } },
        },
      });
    }
    if (demo.review) {
      const decidedAt = new Date(submittedAt.getTime() + DAY);
      await prisma.signupReview.create({
        data: {
          applicationId: application.id,
          reviewerUserId: ids.legal_committee,
          decision: demo.review.decision,
          reason: demo.review.reason,
          decidedAt,
          raisedToAdminAt: demo.review.decision === 'accepted' ? decidedAt : null,
          ...(demo.adminAccepted
            ? { adminUserId: ids.admin, adminAcceptedAt: new Date(decidedAt.getTime() + DAY) }
            : {}),
        },
      });
    }
    if (demo.adminAccepted) await addSupplier(prisma, tokens, application.id, demo, passwordHash);
  }

  if (evaluationTenderId)
    await addEvaluationDemo(
      prisma,
      storage,
      evaluationTenderId,
      member.id,
      ids.admin,
      passwordHash,
    );

  return {
    categories: CATEGORIES.length,
    accounts: [
      ...DEMO_ACCOUNTS.map((a) => ({ email: a.email, role: a.role })),
      { email: DEMO_MEMBER.email, role: 'committee member (no role)' },
      ...DEMO_EVALUATORS.map((e) => ({ email: e.email, role: 'committee member (no role)' })),
      ...APPLICATIONS.filter((a) => a.active).map((a) => ({
        email: a.contactEmail,
        role: 'supplier (active)',
      })),
    ],
    tenders: TENDERS.map((t) => ({ title: t.translations[0].title, status: t.status })),
    applications: APPLICATIONS.map((a) => ({
      legalName: a.legalName,
      state: a.active
        ? 'active supplier'
        : a.adminAccepted
          ? 'setup pending'
          : a.review
            ? a.review.decision === 'accepted'
              ? 'raised to admin'
              : 'rejected'
            : 'pending',
    })),
  };
}
