import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AccessService } from '../auth/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AwardsService } from '../awards/awards.service.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import type {
  CommitteeType,
  FormInputType,
  Language,
  PartType,
  Prisma,
  TenderStatus,
} from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SetupTokens } from '../account-setup/setup-tokens.js';
import { accountSetupEmail } from '../notifications/email-templates.js';
import type { FileStorage } from '../storage/file-storage.js';
import { PART_TYPES, STANDARD_BID_FORM } from '../tenders/standard-bid-form.js';
import { demoPdf } from './demo-pdf.js';

// Fictional fixtures for local development. Mail must go to a local catcher.
export const DEMO_DOMAIN = '@akf.org';
export const DEMO_STAFF_PASSWORD = 'AKF_staff_2026';
export const DEMO_SUPPLIER_PASSWORD = 'supplier_2026';
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

export const DEMO_SUPPLIER_DOMAIN = '@example.com';

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
    contactEmail: `alnoor-engineering${DEMO_SUPPLIER_DOMAIN}`,
    preferredLanguage: 'ar',
    submittedDaysAgo: 1,
  },
  {
    legalName: 'Sahel Builders',
    registrationNumber: 'CR-DEMO-1002',
    contactEmail: `sahel-builders${DEMO_SUPPLIER_DOMAIN}`,
    preferredLanguage: 'en',
    submittedDaysAgo: 3,
    review: { decision: 'accepted', reason: null },
  },
  {
    legalName: 'Rawda Contracting',
    registrationNumber: 'CR-DEMO-1003',
    contactEmail: `rawda-contracting${DEMO_SUPPLIER_DOMAIN}`,
    preferredLanguage: 'en',
    submittedDaysAgo: 5,
    review: { decision: 'rejected', reason: 'The registration certificate has expired.' },
  },
  {
    legalName: 'Wadi Supplies',
    registrationNumber: 'CR-DEMO-1004',
    contactEmail: `wadi-supplies${DEMO_SUPPLIER_DOMAIN}`,
    preferredLanguage: 'en',
    submittedDaysAgo: 4,
    review: { decision: 'accepted', reason: null },
    adminAccepted: true,
  },
  {
    legalName: 'Cedar Supplies',
    registrationNumber: 'CR-DEMO-1005',
    contactEmail: `cedar-supplies${DEMO_SUPPLIER_DOMAIN}`,
    preferredLanguage: 'en',
    submittedDaysAgo: 6,
    review: { decision: 'accepted', reason: null },
    adminAccepted: true,
    active: true,
  },
  {
    legalName: 'Rafid Works',
    registrationNumber: 'CR-DEMO-1006',
    contactEmail: `rafid-works${DEMO_SUPPLIER_DOMAIN}`,
    preferredLanguage: 'ar',
    submittedDaysAgo: 7,
    review: { decision: 'accepted', reason: null },
    adminAccepted: true,
    active: true,
  },
];

const DEMO_STAFF_EMAILS = [
  ...DEMO_ACCOUNTS.map(({ email }) => email),
  ...DEMO_EVALUATORS.map(({ email }) => email),
  DEMO_MEMBER.email,
  DEMO_NOMINEE.email,
];
const DEMO_SUPPLIER_EMAILS = APPLICATIONS.map(({ contactEmail }) => contactEmail);

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

type BidScenario =
  | 'open'
  | 'closed'
  | 'pending_evaluation'
  | 'technical_pending'
  | 'financial_pending'
  | 'disqualified'
  | 'tie'
  | 'tie_resolved'
  | 'award';

type SeedDb = Prisma.TransactionClient;
type SeedStorage = Pick<FileStorage, 'save'>;

const SUPPLIER_PROFILES: Record<string, string> = {
  'CR-DEMO-1004': 'Regional storage and scheduled last-mile dispatch with inventory traceability.',
  'CR-DEMO-1005':
    'Medical refrigeration and electrical equipment distributor with calibration technicians and a regional warranty workshop.',
  'CR-DEMO-1006':
    'Solar installation and rural logistics contractor with certified electricians and a field maintenance team.',
};
const SIGNATORIES: Record<string, string> = {
  'CR-DEMO-1005': 'Dima Farah',
  'CR-DEMO-1006': 'Samir Darwish',
};

interface DemoTender {
  status: TenderStatus;
  categoryCode: string;
  amount: string;
  createdDaysAgo: number;
  translations: Translation[];
  scoring?: { technicalWeight: number; financialWeight: number; minimumTechnicalScore: number };
  deadlines?: [number, number, number];
  bidScenario?: BidScenario;
  termsOfReference?: DemoFile;
  customField?: {
    partType: PartType;
    unit?: string;
    minimum?: number;
    label: string;
    labelAr: string;
  };
}

const additionalEvaluationTenders: DemoTender[] = (
  [
    {
      kind: 'technical_pending',
      category: 'maintenance_services',
      title: 'Backup generator servicing at community centres',
      description:
        'Service nine diesel generators and submit load-test reports, a spare-parts schedule, and an emergency response plan.',
      arTitle: 'صيانة المولدات الاحتياطية في المراكز المجتمعية',
      arDescription:
        'صيانة تسعة مولدات ديزل وتقديم تقارير اختبار الحمل وجداول قطع الغيار وخطة الاستجابة للأعطال.',
      amount: '21000.00',
    },
    {
      kind: 'financial_pending',
      category: 'information_technology',
      title: 'Network renewal for district offices',
      description:
        'Install managed switches and secure wireless access at five offices. Include acceptance test records and a three-year support plan.',
      arTitle: 'تحديث الشبكات في مكاتب المناطق',
      arDescription:
        'تركيب محولات شبكية واتصال لاسلكي آمن في خمسة مكاتب مع اختبارات الاستلام ودعم لمدة ثلاث سنوات.',
      amount: '47000.00',
    },
    {
      kind: 'disqualified',
      category: 'construction',
      title: 'Accessible washrooms for learning centres',
      description:
        'Renovate washrooms at six learning centres. Include accessibility drawings, qualified supervision, and a site safety plan.',
      arTitle: 'مرافق صحية ميسّرة في مراكز التعلّم',
      arDescription:
        'تأهيل المرافق الصحية في ستة مراكز تعلّم، مع مخططات تيسير الوصول وإشراف مؤهل وخطة سلامة.',
      amount: '43000.00',
    },
    {
      kind: 'tie_resolved',
      category: 'goods_and_supplies',
      title: 'Water testing kits for community laboratories',
      description:
        'Supply 24 portable water testing kits, calibration standards, operator training, and replenishment consumables for one year.',
      arTitle: 'أطقم فحص المياه للمختبرات المجتمعية',
      arDescription:
        'توريد 24 طقمًا لفحص المياه مع مواد المعايرة وتدريب المشغّلين والمواد الاستهلاكية لمدة عام.',
      amount: '42000.00',
    },
  ] as const
).map((entry) => ({
  status: 'under_evaluation',
  categoryCode: entry.category,
  amount: entry.amount,
  createdDaysAgo: 36,
  deadlines: [-20, -15, -10],
  scoring: { technicalWeight: 60, financialWeight: 40, minimumTechnicalScore: 70 },
  bidScenario: entry.kind,
  translations: [
    { language: 'en', title: entry.title, description: entry.description },
    { language: 'ar', title: entry.arTitle, description: entry.arDescription },
  ],
}));

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
    bidScenario: 'pending_evaluation',
    termsOfReference: { language: 'en', name: 'Clinic solar installation ToR.pdf' },
  },
  // S6: evaluated to a tie at the top, waiting for the officer's choice.
  {
    status: 'under_evaluation',
    categoryCode: 'goods_and_supplies',
    amount: '40000.00',
    createdDaysAgo: 25,
    translations: [
      {
        language: 'en',
        title: 'Water pumps for farming cooperatives',
        description: 'Supply of twelve solar water pumps for three farming cooperatives.',
      },
      {
        language: 'ar',
        title: 'مضخات مياه للتعاونيات الزراعية',
        description: 'توريد اثنتي عشرة مضخة مياه تعمل بالطاقة الشمسية لثلاث تعاونيات زراعية.',
      },
    ],
    scoring: { technicalWeight: 50, financialWeight: 50, minimumTechnicalScore: 60 },
    deadlines: [-12, -8, -4],
    bidScenario: 'tie',
    termsOfReference: { language: 'en', name: 'Solar water pump specifications.pdf' },
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
          'Replace damaged flashing and waterproof 840 square metres at Rawda primary school. Include a weekend work plan, a drainage inspection, and a two-year defects warranty.',
      },
      {
        language: 'ar',
        title: 'إصلاح سقف مدرسة الروضة',
        description:
          'عزل 840 مترًا مربعًا في مدرسة الروضة وفحص التصريف، مع خطة عمل خلال العطلات وضمان لعامين.',
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
    bidScenario: 'open',
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
    status: 'closed',
    categoryCode: 'transport_and_logistics',
    amount: '28000.00',
    createdDaysAgo: 18,
    translations: [
      {
        language: 'en',
        title: 'Winter relief transport for rural communities',
        description:
          'Deliver 1,200 winter relief kits from the Hama warehouse to eight rural distribution sites. Provide covered trucks, proof of delivery, and a contingency plan for road closures.',
      },
      {
        language: 'ar',
        title: 'نقل مساعدات الشتاء إلى المجتمعات الريفية',
        description:
          'نقل 1200 طرد شتوي من مستودع حماة إلى ثمانية مواقع توزيع ريفية باستخدام شاحنات مغطاة، مع إثبات التسليم وخطة بديلة لإغلاق الطرق.',
      },
    ],
    scoring: { technicalWeight: 65, financialWeight: 35, minimumTechnicalScore: 65 },
    deadlines: [-4, -1, 4],
    bidScenario: 'closed',
    termsOfReference: { language: 'en', name: 'Winter relief delivery requirements.pdf' },
  },
  {
    // Starts under evaluation; the normal ranking service awards it during seeding.
    status: 'under_evaluation',
    categoryCode: 'goods_and_supplies',
    amount: '54000.00',
    createdDaysAgo: 32,
    translations: [
      {
        language: 'en',
        title: 'Vaccine cold-chain equipment for primary care centres',
        description:
          'Supply and commission eight medical refrigerators with temperature data loggers. Include calibration, operator training, and on-site support for two years.',
      },
      {
        language: 'ar',
        title: 'تجهيزات سلسلة تبريد اللقاحات لمراكز الرعاية الأولية',
        description:
          'توريد وتشغيل ثماني ثلاجات طبية مع مسجلات لدرجات الحرارة، تشمل المعايرة وتدريب المشغّلين ودعمًا ميدانيًا لمدة عامين.',
      },
    ],
    scoring: { technicalWeight: 65, financialWeight: 35, minimumTechnicalScore: 70 },
    deadlines: [-14, -10, -7],
    bidScenario: 'award',
    termsOfReference: { language: 'en', name: 'Cold-chain equipment specifications.pdf' },
  },
  ...additionalEvaluationTenders,
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
        description:
          'Inspect six community wells and replace worn seals and control panels. Submit pump measurements and a safe water restoration schedule.',
      },
      {
        language: 'ar',
        title: 'صيانة آبار المياه في المنطقة الشمالية',
        description:
          'فحص ستة آبار مجتمعية واستبدال الحشيات ولوحات التحكم المتضررة وتقديم قياسات المضخات وجدول إعادة الخدمة.',
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
    where: { email: { in: DEMO_STAFF_EMAILS } },
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
    where: { contactEmail: { in: DEMO_SUPPLIER_EMAILS } },
    select: {
      id: true,
      documents: { select: { document: { select: { id: true, storageKey: true } } } },
    },
  });
  const applicationIds = applications.map((a) => a.id);
  const applicationDocuments = applications.flatMap((a) => a.documents.map((d) => d.document));
  // Supplier accounts created from demo applications, with their emails.
  const suppliers = await prisma.userAccount.findMany({
    where: { email: { in: DEMO_SUPPLIER_EMAILS } },
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
    // An award restricts deleting its winning bid; award and cancellation
    // emails restrict deleting their tender.
    prisma.tenderAward.deleteMany({
      where: { OR: [{ tender: tenders }, { winningBidId: { in: bidIds } }] },
    }),
    prisma.emailMessage.deleteMany({ where: { tender: tenders } }),
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
        technicalInformation: SUPPLIER_PROFILES[demo.registrationNumber],
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
  prisma: SeedDb,
  storage: SeedStorage,
  tenderId: string,
  uploadedByUserId: string,
  title: string,
  scope: string,
  file: DemoFile,
) {
  const content = demoPdf(title, [
    scope,
    'Submit a signed registration certificate, technical proposal and priced financial offer.',
    'Use the separate deadlines in the tender portal.',
    'Evaluation: legal eligibility, compliance with technical requirements, and cost.',
  ]);
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

interface SeededBidScenario {
  id: string;
  kind: BidScenario;
  deadlines: [number, number, number];
  createdDaysAgo: number;
  minimumTechnicalScore: number;
}

// The demo covers partial bids, sealed evaluation, a tie, and a completed award.
async function addBidScenarios(
  prisma: SeedDb,
  storage: SeedStorage,
  tenders: SeededBidScenario[],
  members: Record<CommitteeType, string>,
  adminId: string,
  officerId: string,
  awards: AwardsService,
) {
  const members_ = await prisma.userAccount.findMany({
    where: { id: { in: Object.values(members) } },
    select: { id: true, email: true, displayName: true },
  });
  for (const {
    id: tenderId,
    kind,
    deadlines: [application, technical, financial],
    createdDaysAgo,
    minimumTechnicalScore,
  } of tenders) {
    const inEvaluation = kind !== 'open' && kind !== 'closed';
    const assignments: Partial<Record<CommitteeType, string>> = {};
    for (const type of inEvaluation ? (Object.keys(members) as CommitteeType[]) : []) {
      const committee = await prisma.tenderCommittee.create({
        data: { tenderId, type },
        select: { id: true },
      });
      const person = members_.find((m) => m.id === members[type])!;
      const assignment = await prisma.committeeAssignment.create({
        data: {
          committeeId: committee.id,
          tenderId,
          nomineeName: person.displayName,
          nomineeEmail: person.email,
          userId: person.id,
          status: 'approved',
          approvedByUserId: adminId,
          nominatedAt: at(-createdDaysAgo + 2),
          decidedAt: at(-createdDaysAgo + 3),
        },
        select: { id: true },
      });
      assignments[type] = assignment.id;
    }

    const suppliers = await prisma.supplier.findMany({
      where: {
        user: { email: { in: APPLICATIONS.filter((a) => a.active).map((a) => a.contactEmail) } },
      },
      select: { id: true, userId: true, legalName: true, registrationNumber: true },
      orderBy: { legalName: 'asc' },
    });
    const { formFields, translations, currencyCode } = await prisma.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: { formFields: true, translations: true, currencyCode: true },
    });
    const tenderTitle =
      translations.find(({ language }) => language === 'en')?.title ?? 'Local tender';
    const bidIds: string[] = [];
    for (const [i, supplier] of suppliers.entries()) {
      const submittedAt = at(Math.min(-1, application - 1));
      const bid = await prisma.bid.create({
        data: {
          tenderId,
          supplierId: supplier.id,
          bidderCode: `B-DEMO${i + 1}`,
          submittedAt,
        },
        select: { id: true },
      });
      bidIds.push(bid.id);
      const parts = PART_TYPES.slice(
        0,
        kind === 'open' && i === 0 ? 1 : kind === 'closed' && i === 0 ? 2 : 3,
      );
      for (const partType of parts) {
        const part = await prisma.bidPart.create({
          data: {
            bidId: bid.id,
            partType,
            standardAnswers:
              partType === 'legal_information'
                ? { authorizedSignatoryName: SIGNATORIES[supplier.registrationNumber] }
                : {},
            lastSubmittedAt:
              partType === 'legal_information'
                ? submittedAt
                : at(Math.min(-1, (partType === 'technical_offer' ? technical : financial) - 1)),
          },
          select: { id: true },
        });
        const price = demoQuote(kind, i);
        async function saveBidFile(label: string, kind: string | null, lines: string[]) {
          const content = demoPdf(label, [supplier.legalName, ...lines]);
          return prisma.document.create({
            data: {
              ownerType: 'bid_part',
              storageKey: await storage.save(content),
              originalName: label.toLowerCase().replaceAll(' ', '-') + '.pdf',
              mimeType: 'application/pdf',
              sizeBytes: content.length,
              language: 'en',
              uploadedByUserId: supplier.userId,
              bidPartLink: { create: { bidPartId: part.id, kind } },
            },
            select: { id: true },
          });
        }
        const standard = STANDARD_BID_FORM[partType].documents[0].kind;
        const details =
          partType === 'legal_information'
            ? [
                'Registration: ' + supplier.registrationNumber,
                'Authorized signatory: ' + SIGNATORIES[supplier.registrationNumber],
              ]
            : partType === 'technical_offer'
              ? [
                  'Proposal: ' + tenderTitle,
                  'Method: site inspection, delivery, commissioning and acceptance checks.',
                  'Support: trained local team and a documented service schedule.',
                ]
              : [
                  'Offer: ' + tenderTitle,
                  'Total including transport and commissioning: ' + currencyCode + ' ' + price,
                  'Price validity: 60 days. Payment follows verified delivery.',
                ];
        await saveBidFile(standard.replaceAll('_', ' '), standard, details);

        for (const field of formFields.filter((field) => field.partType === partType)) {
          const answer =
            field.inputType === 'file'
              ? {
                  documentId: (
                    await saveBidFile('Implementation schedule', null, [
                      tenderTitle,
                      'Week 1: verify sites and mobilize staff.',
                      'Weeks 2-3: deliver and test. Week 4: train operators and hand over.',
                    ])
                  ).id,
                }
              : {
                  scalarValue:
                    field.inputType === 'number'
                      ? field.unit === 'days'
                        ? 60
                        : Number(field.minimum ?? 0) + (i === 0 ? 8 : 4)
                      : field.inputType === 'boolean'
                        ? !(i === 1 && (kind === 'technical_pending' || kind === 'disqualified'))
                        : 'Local service desk with one business day response and a named site coordinator.',
                };
          await prisma.bidFieldAnswer.create({
            data: { bidPartId: part.id, fieldId: field.id, ...answer },
          });
        }
      }
      if (inEvaluation && kind !== 'pending_evaluation') {
        await addCompletedEvaluations(
          prisma,
          bid.id,
          assignments,
          minimumTechnicalScore,
          financial,
          kind,
          i,
        );
      }
    }
    if (kind === 'tie' || kind === 'award' || kind === 'tie_resolved') {
      await awards.rankAndAward(prisma, tenderId);
    }
    if (kind === 'tie_resolved') {
      const winningBidId = bidIds[1];
      await prisma.tenderAward.create({
        data: {
          tenderId,
          winningBidId,
          selection: 'tie_break',
          tieBrokenByUserId: officerId,
          awardedAt: at(financial + 4),
        },
      });
      await prisma.tender.update({ where: { id: tenderId }, data: { status: 'awarded' } });
      await awards.prepareDrafts(prisma, tenderId, winningBidId);
      // Delivery-history examples only. The seed never sends these messages.
      await prisma.emailMessage.updateMany({
        where: { tenderId, kind: 'award_winner' },
        data: {
          status: 'sent',
          sentByUserId: officerId,
          sentAt: at(financial + 5),
          preparedAt: at(financial + 4),
        },
      });
      await prisma.emailMessage.updateMany({
        where: { tenderId, kind: 'award_other' },
        data: {
          status: 'failed',
          sentByUserId: officerId,
          failureCode: 'DELIVERY_FAILED',
          failedAt: at(financial + 5),
          preparedAt: at(financial + 4),
        },
      });
    }
    if (kind === 'disqualified') {
      await prisma.tender.update({
        where: { id: tenderId },
        data: {
          status: 'cancelled',
          cancellationReason: 'no_qualified_bid',
          cancelledAt: at(financial + 2),
        },
      });
      await awards.prepareDrafts(prisma, tenderId, null);
    }
  }
}

function demoQuote(scenario: BidScenario, index: number) {
  if (scenario === 'award') return index === 0 ? '50900.00' : '58000.00';
  if (scenario === 'open') return index === 0 ? '82900.00' : '88600.00';
  if (scenario === 'closed') return index === 0 ? '24800.00' : '27400.00';
  if (scenario === 'technical_pending') return index === 0 ? '19600.00' : '20750.00';
  if (scenario === 'financial_pending') return index === 0 ? '43900.00' : '45800.00';
  return index === 0 ? '38000.00' : '39600.00';
}

async function addCompletedEvaluations(
  prisma: SeedDb,
  bidId: string,
  assignments: Partial<Record<CommitteeType, string>>,
  minimumTechnicalScore: number,
  financialDeadline: number,
  scenario: BidScenario,
  index: number,
) {
  const legalFailed =
    (scenario === 'technical_pending' || scenario === 'disqualified') && index === 1;
  await prisma.legalEvaluation.create({
    data: {
      bidId,
      assignmentId: assignments.legal_committee!,
      outcome: legalFailed ? 'fail' : 'pass',
      reason: legalFailed
        ? 'The bidder did not provide evidence of current registration for the required activity.'
        : null,
      submittedAt: at(financialDeadline + 1),
    },
  });
  if (legalFailed || scenario === 'technical_pending') return;
  const technicalScore =
    scenario === 'disqualified' || (scenario === 'financial_pending' && index === 1)
      ? 54
      : scenario === 'tie' || scenario === 'tie_resolved'
        ? 80
        : index === 0
          ? 92
          : 79;
  const meetsMinimum = technicalScore >= minimumTechnicalScore;
  await prisma.technicalEvaluation.create({
    data: {
      bidId,
      assignmentId: assignments.technical_committee!,
      technicalScore,
      meetsMinimum,
      comments: meetsMinimum
        ? 'The delivery plan, specifications and local warranty support meet the requirements.'
        : 'The method statement does not cover site testing or ongoing maintenance support.',
      submittedAt: at(financialDeadline + 2),
    },
  });
  if (!meetsMinimum || scenario === 'financial_pending') return;
  await prisma.financialEvaluation.create({
    data: {
      bidId,
      assignmentId: assignments.financial_committee!,
      financialScore:
        scenario === 'tie' || scenario === 'tie_resolved' ? 70 : index === 0 ? 88 : 82,
      confirmedTotalPrice: demoQuote(scenario, index),
      comments:
        'Confirmed against the signed commercial offer. The total includes delivery and commissioning.',
      submittedAt: at(financialDeadline + 3),
    },
  });
}

// S3 fixtures stay attached to demo-owned tenders so the existing reset removes them.
async function addDemoCommittees(
  prisma: SeedDb,
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
  await prisma.committeeAssignment.createMany({
    data: [
      {
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
      {
        committeeId: waitingCommittee.id,
        tenderId: accepted.id,
        nomineeName: DEMO_NOMINEE.displayName,
        nomineeEmail: DEMO_NOMINEE.email,
        status: 'nominated',
        nominatedAt,
      },
    ],
  });
}

function demoFields(demo: DemoTender): Prisma.TenderFormFieldCreateWithoutTenderInput[] {
  const field = (
    partType: PartType,
    position: number,
    inputType: FormInputType,
    labels: [string, string],
    instructions: [string, string],
  ): Prisma.TenderFormFieldCreateWithoutTenderInput => ({
    partType,
    position,
    inputType,
    required: true,
    translations: {
      create: [
        { language: 'en', label: labels[0], instructions: instructions[0] },
        { language: 'ar', label: labels[1], instructions: instructions[1] },
      ],
    },
  });
  const numeric = demo.customField;
  return [
    field(
      'legal_information',
      0,
      'boolean',
      ['Registration is current', 'التسجيل ساري المفعول'],
      [
        'Confirm the attached certificate is valid at submission.',
        'أكّد صلاحية الشهادة المرفقة عند تقديم العرض.',
      ],
    ),
    field(
      'technical_offer',
      0,
      'text',
      ['Local support plan', 'خطة الدعم المحلي'],
      ['Describe your support team and response time.', 'صف فريق الدعم ووقت الاستجابة.'],
    ),
    field(
      'technical_offer',
      1,
      'file',
      ['Implementation schedule', 'الجدول الزمني للتنفيذ'],
      [
        'Attach a PDF with milestones, testing and handover dates.',
        'أرفق ملفًا يتضمن مراحل التنفيذ والاختبار ومواعيد التسليم.',
      ],
    ),
    {
      ...field(
        'technical_offer',
        2,
        'number',
        numeric
          ? [numeric.label, numeric.labelAr]
          : ['On-site support period', 'مدة الدعم الميداني'],
        ['Enter the proposed quantity in the unit shown.', 'أدخل الكمية المقترحة بالوحدة الموضّحة.'],
      ),
      unit: numeric?.unit ?? 'months',
      minimum: numeric?.minimum ?? 12,
    },
    {
      ...field(
        'financial_offer',
        0,
        'number',
        ['Price validity period', 'مدة صلاحية السعر'],
        [
          'Enter the number of days the quoted price remains valid.',
          'أدخل عدد الأيام التي يبقى فيها السعر صالحًا.',
        ],
      ),
      unit: 'days',
      minimum: 30,
    },
  ];
}

interface DemoTenderAccounts {
  employee: string;
  officer: string;
  admin: string;
  members: Record<CommitteeType, string>;
}

function fixtureAwards(prisma: PrismaService) {
  return new AwardsService(
    prisma,
    new AccessService(prisma, new JwtService()),
    new AuditService(prisma),
    new IdempotencyService(prisma),
  );
}

async function populateTenders(
  prisma: SeedDb,
  storage: SeedStorage,
  accounts: DemoTenderAccounts,
  awards: AwardsService,
) {
  const staffingTenders: { id: string; status: TenderStatus }[] = [];
  const bidScenarios: SeededBidScenario[] = [];
  for (const demo of TENDERS) {
    // Only used when the tender has deadlines.
    const [application, technical, financial] = demo.deadlines ?? [0, 0, 0];
    const data: Prisma.TenderUncheckedCreateInput = {
      status: demo.status,
      categoryCode: demo.categoryCode,
      requestedByUserId: accounts.employee,
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
      ...(demo.scoring ? { formFields: { create: demoFields(demo) } } : {}),
    };
    const tender = await prisma.tender.create({ data, select: { id: true } });
    if (demo.status === 'accepted' || demo.status === 'published' || demo.status === 'closed')
      staffingTenders.push({ id: tender.id, status: demo.status });
    if (demo.bidScenario && demo.deadlines && demo.scoring) {
      bidScenarios.push({
        id: tender.id,
        kind: demo.bidScenario,
        deadlines: demo.deadlines,
        createdDaysAgo: demo.createdDaysAgo,
        minimumTechnicalScore: demo.scoring.minimumTechnicalScore,
      });
    }

    if (demo.scoring) {
      const primary = demo.translations.find(({ language }) => language === 'en');
      await addTermsOfReference(
        prisma,
        storage,
        tender.id,
        accounts.officer,
        primary?.title ?? 'School materials - Terms of Reference',
        primary?.description ??
          'Deliver durable school materials to 500 pupils and provide delivery notes by school.',
        demo.termsOfReference ?? { language: 'en', name: 'Terms of Reference.pdf' },
      );
    }
  }

  await addDemoCommittees(
    prisma,
    staffingTenders,
    accounts.members.technical_committee,
    accounts.admin,
  );

  await addBidScenarios(
    prisma,
    storage,
    bidScenarios,
    accounts.members,
    accounts.admin,
    accounts.officer,
    awards,
  );
}

function tenderSummary() {
  return TENDERS.map((t) => ({
    title: t.translations[0].title,
    status:
      t.bidScenario === 'award' || t.bidScenario === 'tie_resolved'
        ? 'awarded'
        : t.bidScenario === 'disqualified'
          ? 'cancelled'
          : t.status,
  }));
}

export async function refreshDemoTenders(prisma: PrismaService, storage: FileStorage) {
  const created: string[] = [];
  const trackedStorage: SeedStorage = {
    async save(content) {
      const key = await storage.save(content);
      created.push(key);
      return key;
    },
  };
  let replaced: string[];
  try {
    replaced = await prisma.$transaction(
      async (tx) => {
        const find = (email: string) =>
          tx.userAccount.findUniqueOrThrow({
            where: { email },
            select: { id: true },
          });
        const [employee, officer, admin, technical, legal, financial] = await Promise.all([
          find('employee' + DEMO_DOMAIN),
          find('officer' + DEMO_DOMAIN),
          find('admin' + DEMO_DOMAIN),
          find(DEMO_MEMBER.email),
          find(DEMO_EVALUATORS[0].email),
          find(DEMO_EVALUATORS[1].email),
        ]);
        const accounts: DemoTenderAccounts = {
          employee: employee.id,
          officer: officer.id,
          admin: admin.id,
          members: {
            legal_committee: legal.id,
            technical_committee: technical.id,
            financial_committee: financial.id,
          },
        };
        const tenders = await tx.tender.findMany({
          where: { requestedByUserId: accounts.employee },
          select: { id: true },
        });
        const tenderIds = tenders.map(({ id }) => id);
        const scope = { tenderId: { in: tenderIds } };
        const bids = await tx.bid.findMany({ where: scope, select: { id: true } });
        const assignments = await tx.committeeAssignment.findMany({
          where: scope,
          select: { id: true },
        });
        const documents: Prisma.DocumentWhereInput = {
          OR: [{ tenderLink: { is: scope } }, { bidPartLink: { is: { bidPart: { bid: scope } } } }],
        };
        const previous = await tx.document.findMany({
          where: documents,
          select: { storageKey: true },
        });
        await tx.auditEvent.deleteMany({
          where: {
            OR: [
              { resourceType: 'tender', resourceId: { in: tenderIds } },
              { resourceType: 'bid', resourceId: { in: bids.map(({ id }) => id) } },
              {
                resourceType: 'committee_assignment',
                resourceId: { in: assignments.map(({ id }) => id) },
              },
            ],
          },
        });
        await tx.emailMessage.deleteMany({ where: scope });
        await tx.tenderAward.deleteMany({ where: scope });
        await tx.document.deleteMany({ where: documents });
        await tx.bid.deleteMany({ where: scope });
        await tx.committeeAssignment.deleteMany({ where: scope });
        await tx.tenderCommittee.deleteMany({ where: scope });
        await tx.tender.updateMany({
          where: { id: { in: tenderIds } },
          data: { copiedFromTenderId: null },
        });
        await tx.tender.deleteMany({ where: { id: { in: tenderIds } } });

        for (const [registrationNumber, technicalInformation] of Object.entries(
          SUPPLIER_PROFILES,
        )) {
          await tx.supplier.updateMany({
            where: { registrationNumber, technicalInformation: '' },
            data: { technicalInformation },
          });
        }
        await populateTenders(tx, trackedStorage, accounts, fixtureAwards(prisma));
        return previous.map(({ storageKey }) => storageKey);
      },
      { timeout: 45_000 },
    );
  } catch (error) {
    await Promise.allSettled(created.map((key) => storage.delete(key)));
    throw error;
  }
  await Promise.all(replaced.map((key) => storage.delete(key)));
  return tenderSummary();
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

  const [passwordHash, supplierPasswordHash] = await Promise.all([
    bcrypt.hash(DEMO_STAFF_PASSWORD, 12),
    bcrypt.hash(DEMO_SUPPLIER_PASSWORD, 12),
  ]);
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
    if (demo.adminAccepted)
      await addSupplier(prisma, tokens, application.id, demo, supplierPasswordHash);
  }

  const members: Record<CommitteeType, string> = {
    legal_committee: '',
    technical_committee: member.id,
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
  await prisma.$transaction(
    (tx) =>
      populateTenders(
        tx,
        storage,
        {
          employee: ids.employee,
          officer: ids.procurement_officer,
          admin: ids.admin,
          members,
        },
        fixtureAwards(prisma),
      ),
    { timeout: 45_000 },
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
    tenders: tenderSummary(),
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
