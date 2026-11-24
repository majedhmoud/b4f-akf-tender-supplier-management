import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { isISO6391 } from 'class-validator';
import { createHash, randomBytes } from 'node:crypto';
import { notFound } from '../auth/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ApiException, type FieldError } from '../common/errors/api-exception.js';
import { pickTranslation } from '../common/language/language.js';
import { pageArgs, pageMeta, type PageQueryDto } from '../common/pagination/pagination.js';
import type { Language, PartType, Prisma, TenderStatus } from '../generated/prisma/client.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { SignedUrlService } from '../storage/signed-url.service.js';
import { discardUnreferenced } from '../storage/discard-unreferenced.js';
import { checkUpload, safeFileName, type UploadedFileInput } from '../storage/upload-rules.js';
import { PART_TYPES, STANDARD_BID_FORM } from '../tenders/standard-bid-form.js';
import type {
  BidForm,
  BidPage,
  BidPartView,
  CustomFieldSpec,
  MobileSupplierBid,
  SupplierBid,
} from './dto/bid.dto.js';

const MAX_TEXT_ANSWER = 2000;
// Uploads keep their multipart name, such as files[technical_offer][technical_proposal].
export type BidUpload = UploadedFileInput & { fieldname: string };
type Scalar = string | number | boolean;

// Which deadline closes each part (API_CONTRACT.md, Bids, Deadlines).
const DEADLINE: Record<
  PartType,
  'applicationDeadline' | 'technicalDeadline' | 'financialDeadline'
> = {
  legal_information: 'applicationDeadline',
  technical_offer: 'technicalDeadline',
  financial_offer: 'financialDeadline',
};
// Parts can still change only while bidding is open or just closed.
const OPEN_STATUSES: TenderStatus[] = ['published', 'closed'];

const tenderSelect = {
  id: true,
  status: true,
  applicationDeadline: true,
  technicalDeadline: true,
  financialDeadline: true,
  translations: { select: { language: true, title: true } },
  formFields: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      partType: true,
      inputType: true,
      required: true,
      unit: true,
      minimum: true,
      translations: { select: { language: true, label: true, instructions: true } },
    },
  },
} satisfies Prisma.TenderSelect;
type TenderRow = Prisma.TenderGetPayload<{ select: typeof tenderSelect }>;
type FieldRow = TenderRow['formFields'][number];

const bidSelect = {
  id: true,
  tenderId: true,
  supplierId: true,
  parts: {
    select: {
      id: true,
      partType: true,
      standardAnswers: true,
      lastSubmittedAt: true,
      documents: {
        select: {
          kind: true,
          document: { select: { id: true, originalName: true, language: true } },
        },
      },
      answers: { select: { fieldId: true, scalarValue: true, documentId: true } },
    },
  },
} satisfies Prisma.BidSelect;
type BidRow = Prisma.BidGetPayload<{ select: typeof bidSelect }>;

// One validated file for a part: a standard kind, or a custom file field.
interface PartFile {
  kind: string | null;
  fieldId: string | null;
  file: UploadedFileInput;
  language: string;
  mime: string;
}
// A part ready to write.
interface PartInput {
  partType: PartType;
  standardAnswers: Record<string, string>;
  scalars: { fieldId: string; value: Scalar }[];
  files: PartFile[];
}

function validation(fields: FieldError[]): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid bid', fields);
}
function unprocessable(code: 'SUPPLIER_SUSPENDED' | 'APPLICATION_CLOSED' | 'BID_PART_LOCKED') {
  return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, code);
}
function parseJson(value: unknown, field: string, errors: FieldError[]): unknown {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    errors.push({ field, code: 'INVALID' });
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    errors.push({ field, code: 'INVALID' });
    return undefined;
  }
}
function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function hashFile(file: UploadedFileInput): string {
  return createHash('sha256').update(file.buffer).digest('hex');
}
function deadlineOf(tender: TenderRow, partType: PartType): Date | null {
  return tender[DEADLINE[partType]];
}
function isLocked(tender: TenderRow, partType: PartType, now: Date): boolean {
  const deadline = deadlineOf(tender, partType);
  return !OPEN_STATUSES.includes(tender.status) || !deadline || now >= deadline;
}

// S4 Bid submission (API_CONTRACT.md, Bids). Only the supplier's own bids are
// visible; nothing here returns bidder codes, evaluations or other bids.
@Injectable()
export class BidsService {
  private readonly logger = new Logger(BidsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    private readonly storage: FileStorage,
    private readonly signedUrls: SignedUrlService,
  ) {}

  private async supplierOf(userId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });
    if (!supplier) throw notFound();
    return supplier;
  }

  // A supplier sees a published tender, or any tender it already bid on.
  private async visibleTender(tenderId: string, supplierId: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: tenderSelect,
    });
    if (!tender) throw notFound();
    const bid = await this.prisma.bid.findUnique({
      where: { tenderId_supplierId: { tenderId, supplierId } },
      select: { id: true },
    });
    if (tender.status !== 'published' && !bid) throw notFound();
    return { tender, bidId: bid?.id ?? null };
  }

  private customField(field: FieldRow, language: Language): CustomFieldSpec {
    const { content } = pickTranslation(field.translations, language);
    return {
      fieldId: field.id,
      type: field.inputType,
      required: field.required,
      unit: field.unit,
      minimum: field.minimum === null ? null : Number(field.minimum),
      label: content.label,
      instructions: content.instructions,
      language: content.language,
    };
  }

  // B1.
  async form(userId: string, tenderId: string, language: Language): Promise<BidForm> {
    const supplier = await this.supplierOf(userId);
    const { tender, bidId } = await this.visibleTender(tenderId, supplier.id);
    const now = new Date();
    const reasonCode = bidId
      ? 'BID_EXISTS'
      : supplier.status === 'suspended'
        ? 'SUPPLIER_SUSPENDED'
        : isLocked(tender, 'legal_information', now)
          ? 'APPLICATION_CLOSED'
          : null;
    return {
      canSubmit: reasonCode === null,
      reasonCode,
      existingBid: bidId
        ? {
            bidId,
            allowedActions: PART_TYPES.filter((p) => !isLocked(tender, p, now)).map(
              (p) => `replace_${p}`,
            ),
          }
        : null,
      deadlines: {
        application: tender.applicationDeadline?.toISOString() ?? '',
        technical: tender.technicalDeadline?.toISOString() ?? '',
        financial: tender.financialDeadline?.toISOString() ?? '',
      },
      parts: PART_TYPES.map((partType) => ({
        partType,
        fields: STANDARD_BID_FORM[partType].fields,
        documents: STANDARD_BID_FORM[partType].documents,
        customFields: tender.formFields
          .filter((f) => f.partType === partType)
          .map((f) => this.customField(f, language)),
      })),
      serverTime: now.toISOString(),
    };
  }

  // Validates one part. `values` holds the standard fields, `answers` the
  // custom scalar answers, `languages` and `files` are keyed by kind or field ID.
  private readPart(
    tender: TenderRow,
    partType: PartType,
    values: unknown,
    answers: unknown,
    languages: unknown,
    files: Map<string, UploadedFileInput>,
    prefix: string,
    errors: FieldError[],
  ): PartInput {
    const spec = STANDARD_BID_FORM[partType];
    const valueMap = isObject(values) ? values : {};
    const answerMap = isObject(answers) ? answers : {};
    const languageMap = isObject(languages) ? languages : {};
    const standardAnswers: Record<string, string> = {};
    for (const field of spec.fields) {
      const value = valueMap[field.name];
      const text = typeof value === 'string' ? value.trim() : '';
      if (!text && field.required)
        errors.push({ field: `${prefix}.${field.name}`, code: 'REQUIRED' });
      else if (text.length > field.maxLength)
        errors.push({ field: `${prefix}.${field.name}`, code: 'TOO_LONG' });
      else if (text) standardAnswers[field.name] = text;
    }
    const known = new Set(spec.fields.map((f) => f.name));
    for (const name of Object.keys(valueMap))
      if (!known.has(name)) errors.push({ field: `${prefix}.${name}`, code: 'FIELD_NOT_EDITABLE' });

    const fileFor = (
      key: string,
      kind: string | null,
      fieldId: string | null,
      required: boolean,
    ) => {
      const file = files.get(key);
      const language = languageMap[key];
      if (!file) {
        if (required) errors.push({ field: `files[${partType}][${key}]`, code: 'REQUIRED' });
        return null;
      }
      files.delete(key);
      if (typeof language !== 'string' || !isISO6391(language)) {
        errors.push({
          field: `languages[${partType}][${key}]`,
          code: language ? 'INVALID' : 'REQUIRED',
        });
        return null;
      }
      return { kind, fieldId, file, language, mime: checkUpload(file) };
    };

    const partFiles: PartFile[] = [];
    for (const doc of spec.documents) {
      const file = fileFor(doc.kind, doc.kind, null, doc.required);
      if (file) partFiles.push(file);
    }

    const scalars: { fieldId: string; value: Scalar }[] = [];
    const fields = tender.formFields.filter((f) => f.partType === partType);
    const fieldIds = new Set(fields.map((f) => f.id));
    for (const id of Object.keys(answerMap))
      if (!fieldIds.has(id)) errors.push({ field: `answers.${partType}.${id}`, code: 'INVALID' });
    for (const field of fields) {
      const path = `answers.${partType}.${field.id}`;
      if (field.inputType === 'file') {
        const file = fileFor(field.id, null, field.id, field.required);
        if (file) partFiles.push(file);
        continue;
      }
      const raw = answerMap[field.id];
      // Whitespace only counts as missing.
      const value = typeof raw === 'string' ? raw.trim() : raw;
      if (value === undefined || value === null || value === '') {
        if (field.required) errors.push({ field: path, code: 'REQUIRED' });
        continue;
      }
      if (field.inputType === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value))
          errors.push({ field: path, code: 'INVALID' });
        else if (field.minimum !== null && value < Number(field.minimum))
          errors.push({ field: path, code: 'BELOW_MINIMUM' });
        else scalars.push({ fieldId: field.id, value });
      } else if (field.inputType === 'boolean') {
        if (typeof value !== 'boolean') errors.push({ field: path, code: 'INVALID' });
        else scalars.push({ fieldId: field.id, value });
      } else if (typeof value !== 'string' || value.length > MAX_TEXT_ANSWER) {
        errors.push({ field: path, code: 'INVALID' });
      } else {
        scalars.push({ fieldId: field.id, value });
      }
    }
    return { partType, standardAnswers, scalars, files: partFiles };
  }

  private fingerprint(route: string, parts: PartInput[]): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          route,
          parts: parts.map((p) => ({
            partType: p.partType,
            standardAnswers: p.standardAnswers,
            scalars: p.scalars,
            files: p.files.map((f) => ({
              kind: f.kind,
              fieldId: f.fieldId,
              language: f.language,
              name: safeFileName(f.file.originalname),
              hash: hashFile(f.file),
            })),
          })),
        }),
      )
      .digest('hex');
  }

  // Writes the documents and answers of one part; returns the stored keys.
  private async writePart(
    tx: Prisma.TransactionClient,
    partId: string,
    input: PartInput,
    userId: string,
    stored: Map<PartFile, string>,
  ) {
    const fileDocs = new Map<string, string>();
    for (const file of input.files) {
      const document = await tx.document.create({
        data: {
          ownerType: 'bid_part',
          storageKey: stored.get(file)!,
          originalName: safeFileName(file.file.originalname),
          mimeType: file.mime,
          sizeBytes: file.file.size,
          language: file.language,
          uploadedByUserId: userId,
          bidPartLink: { create: { bidPartId: partId, kind: file.kind } },
        },
        select: { id: true },
      });
      if (file.fieldId) fileDocs.set(file.fieldId, document.id);
    }
    const answers = [
      ...input.scalars.map((s) => ({
        bidPartId: partId,
        fieldId: s.fieldId,
        scalarValue: s.value,
      })),
      ...[...fileDocs].map(([fieldId, documentId]) => ({ bidPartId: partId, fieldId, documentId })),
    ];
    if (answers.length) await tx.bidFieldAnswer.createMany({ data: answers });
  }

  private async saveFiles(parts: PartInput[]): Promise<Map<PartFile, string>> {
    const stored = new Map<PartFile, string>();
    try {
      for (const part of parts)
        for (const file of part.files) stored.set(file, await this.storage.save(file.file.buffer));
    } catch (error) {
      await this.discardUnused([...stored.values()]);
      throw error;
    }
    return stored;
  }

  // Files from a confirmed commit (the replaced ones) are deleted outright.
  private async discard(keys: string[]) {
    await Promise.all(keys.map((key) => this.storage.delete(key).catch(() => undefined)));
  }

  // New files after an error or a replay: only those no saved row references.
  private discardUnused(keys: string[]) {
    return discardUnreferenced(this.prisma, this.storage, keys, this.logger);
  }

  // Collects uploaded files by their multipart name, files[part][key].
  private filesByPart(files: BidUpload[], errors: FieldError[], only?: PartType) {
    const byPart = new Map<string, Map<string, UploadedFileInput>>();
    for (const file of files) {
      const match = only
        ? /^files\[([^\]]+)\]$/.exec(file.fieldname)
        : /^files\[([a-z_]+)\]\[([^\]]+)\]$/.exec(file.fieldname);
      const part = only ?? match?.[1];
      const key = only ? match?.[1] : match?.[2];
      if (!match || !part || !key || !PART_TYPES.includes(part as PartType)) {
        errors.push({ field: file.fieldname, code: 'FIELD_NOT_EDITABLE' });
        continue;
      }
      const map = byPart.get(part) ?? new Map<string, UploadedFileInput>();
      map.set(key, file);
      byPart.set(part, map);
    }
    return byPart;
  }

  // B2: all three parts in one transaction, idempotent per supplier.
  async submit(
    userId: string,
    tenderId: string,
    body: Record<string, unknown>,
    files: BidUpload[],
    key: string | undefined,
    language: Language,
    requestId?: string,
  ): Promise<{ body: SupplierBid; replayed: boolean }> {
    const supplier = await this.supplierOf(userId);
    const { tender } = await this.visibleTender(tenderId, supplier.id);

    const errors: FieldError[] = [];
    for (const name of Object.keys(body))
      if (!['bid', 'languages'].includes(name))
        errors.push({ field: name, code: 'FIELD_NOT_EDITABLE' });
    const bid = parseJson(body.bid, 'bid', errors);
    const bidMap = isObject(bid) ? bid : {};
    const answerMap = isObject(bidMap.answers) ? bidMap.answers : {};
    const languageMap = isObject(body.languages) ? body.languages : {};
    const byPart = this.filesByPart(files, errors);
    const parts = PART_TYPES.map((partType) =>
      this.readPart(
        tender,
        partType,
        partType === 'legal_information' ? bidMap.legalInformation : {},
        answerMap[partType],
        languageMap[partType],
        byPart.get(partType) ?? new Map<string, UploadedFileInput>(),
        partType === 'legal_information' ? 'bid.legalInformation' : `bid.${partType}`,
        errors,
      ),
    );
    for (const [part, rest] of byPart)
      for (const name of rest.keys())
        errors.push({ field: `files[${part}][${name}]`, code: 'FIELD_NOT_EDITABLE' });
    if (errors.length) throw validation(errors);

    const route = `POST /api/v1/tenders/${tenderId}/bids`;
    const stored = await this.saveFiles(parts);
    try {
      const result = await this.idempotency.user(
        userId,
        key,
        route,
        this.fingerprint(route, parts),
        async (tx) => {
          // Lock order: tender first, then the supplier (ERD, Lifecycle jobs).
          // The share lock holds the tender's status and deadlines until
          // commit, so the deadline job waits for this bid instead of racing it.
          await tx.$queryRaw`SELECT id FROM tenders WHERE id = ${tenderId}::uuid FOR SHARE`;
          await tx.$queryRaw`SELECT id FROM suppliers WHERE id = ${supplier.id}::uuid FOR UPDATE`;
          const existing = await tx.bid.findUnique({
            where: { tenderId_supplierId: { tenderId, supplierId: supplier.id } },
            select: { id: true },
          });
          const now = new Date();
          if (existing) {
            throw new ApiException(HttpStatus.CONFLICT, 'BID_EXISTS', 'Bid exists', undefined, {
              bidId: existing.id,
              allowedActions: PART_TYPES.filter((p) => !isLocked(tender, p, now)).map(
                (p) => `replace_${p}`,
              ),
            });
          }
          const current = await tx.supplier.findUniqueOrThrow({
            where: { id: supplier.id },
            select: { status: true },
          });
          if (current.status === 'suspended') throw unprocessable('SUPPLIER_SUSPENDED');
          const fresh = await tx.tender.findUniqueOrThrow({
            where: { id: tenderId },
            select: tenderSelect,
          });
          if (isLocked(fresh, 'legal_information', now)) throw unprocessable('APPLICATION_CLOSED');

          const created = await this.createBid(tx, tenderId, supplier.id);
          for (const input of parts) {
            const part = await tx.bidPart.create({
              data: {
                bidId: created,
                partType: input.partType,
                standardAnswers: input.standardAnswers,
                lastSubmittedAt: now,
              },
              select: { id: true },
            });
            await this.writePart(tx, part.id, input, userId, stored);
            await this.audit.record(
              {
                actorUserId: userId,
                action: 'bid_part.submitted',
                resourceType: 'bid',
                resourceId: created,
                context: { partType: input.partType },
                requestId,
              },
              tx,
            );
          }
          return (await this.view(
            tx,
            created,
            fresh,
            language,
          )) as unknown as Prisma.InputJsonObject;
        },
      );
      // A replay saved nothing new.
      if (result.replayed) await this.discardUnused([...stored.values()]);
      return { body: result.body as unknown as SupplierBid, replayed: result.replayed };
    } catch (error) {
      await this.discardUnused([...stored.values()]);
      throw error;
    }
  }

  // A bidder code unique within the tender, random so it reveals nothing.
  private async createBid(tx: Prisma.TransactionClient, tenderId: string, supplierId: string) {
    for (;;) {
      const bidderCode = `B-${randomBytes(4).toString('hex').toUpperCase()}`;
      const taken = await tx.bid.findUnique({
        where: { tenderId_bidderCode: { tenderId, bidderCode } },
        select: { id: true },
      });
      if (taken) continue;
      const bid = await tx.bid.create({
        data: { tenderId, supplierId, bidderCode },
        select: { id: true },
      });
      return bid.id;
    }
  }

  private partView(tender: TenderRow, part: BidRow['parts'][number], now: Date): BidPartView {
    const locked = isLocked(tender, part.partType, now);
    const fieldOf = new Map(
      part.answers.filter((a) => a.documentId).map((a) => [a.documentId!, a.fieldId]),
    );
    return {
      partType: part.partType,
      deadline: deadlineOf(tender, part.partType)?.toISOString() ?? '',
      locked,
      lastSubmittedAt: part.lastSubmittedAt.toISOString(),
      documents: part.documents.map((d) => ({
        id: d.document.id,
        kind: d.kind,
        ...(fieldOf.has(d.document.id) ? { fieldId: fieldOf.get(d.document.id) } : {}),
        name: d.document.originalName,
        language: d.document.language,
        translations: [],
      })),
      answers: Object.fromEntries(
        part.answers
          .filter((a) => !a.documentId)
          .map((a) => [a.fieldId, a.scalarValue as Scalar | null]),
      ),
      allowedActions: locked ? [] : ['replace'],
    };
  }

  private async view(
    tx: Prisma.TransactionClient | PrismaService,
    bidId: string,
    tender: TenderRow,
    language: Language,
  ): Promise<SupplierBid> {
    const bid = await tx.bid.findUniqueOrThrow({ where: { id: bidId }, select: bidSelect });
    const now = new Date();
    const { content } = pickTranslation(tender.translations, language);
    const legal = bid.parts.find((p) => p.partType === 'legal_information');
    const answers = (isObject(legal?.standardAnswers) ? legal.standardAnswers : {}) as Record<
      string,
      string
    >;
    return {
      id: bid.id,
      tender: {
        id: tender.id,
        status: tender.status,
        content: { language: content.language, title: content.title },
      },
      legalInformation: { authorizedSignatoryName: answers.authorizedSignatoryName ?? '' },
      parts: PART_TYPES.flatMap((p) => {
        const part = bid.parts.find((x) => x.partType === p);
        return part ? [this.partView(tender, part, now)] : [];
      }),
      serverTime: now.toISOString(),
    };
  }

  private async ownBid(userId: string, bidId: string) {
    const supplier = await this.supplierOf(userId);
    const bid = await this.prisma.bid.findFirst({
      where: { id: bidId, supplierId: supplier.id },
      select: { id: true, tenderId: true },
    });
    if (!bid) throw notFound();
    const tender = await this.prisma.tender.findUniqueOrThrow({
      where: { id: bid.tenderId },
      select: tenderSelect,
    });
    return { bid, tender };
  }

  // Used by BidAccessGuard before an upload is read.
  async assertCanSeeTender(userId: string, tenderId: string): Promise<void> {
    const supplier = await this.supplierOf(userId);
    await this.visibleTender(tenderId, supplier.id);
  }

  async assertOwnBid(userId: string, bidId: string): Promise<void> {
    await this.ownBid(userId, bidId);
  }

  // B3d.
  async detail(userId: string, bidId: string, language: Language): Promise<SupplierBid> {
    const { bid, tender } = await this.ownBid(userId, bidId);
    return this.view(this.prisma, bid.id, tender, language);
  }

  async mobileDetail(
    userId: string,
    bidId: string,
    language: Language,
  ): Promise<MobileSupplierBid> {
    const { bid, tender } = await this.ownBid(userId, bidId);
    const now = new Date();
    const { content } = pickTranslation(tender.translations, language);
    return {
      id: bid.id,
      tender: {
        id: tender.id,
        status: tender.status,
        content: { language: content.language, title: content.title },
      },
      parts: PART_TYPES.map((partType) => ({
        partType,
        deadline: deadlineOf(tender, partType)?.toISOString() ?? null,
        locked: isLocked(tender, partType, now),
      })),
      serverTime: now.toISOString(),
    };
  }

  // B3: tender status only, never "won" or "not won".
  async mine(userId: string, query: PageQueryDto, language: Language): Promise<BidPage> {
    const supplier = await this.supplierOf(userId);
    const where = { supplierId: supplier.id } satisfies Prisma.BidWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bid.findMany({
        where,
        ...pageArgs(query),
        orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
        select: { id: true, tender: { select: tenderSelect } },
      }),
      this.prisma.bid.count({ where }),
    ]);
    const now = new Date();
    return {
      data: rows.map(({ id, tender }) => {
        const { content } = pickTranslation(tender.translations, language);
        const open = PART_TYPES.filter((p) => !isLocked(tender, p, now));
        const next = open
          .map((p) => deadlineOf(tender, p))
          .filter((d): d is Date => !!d)
          .sort((a, b) => a.getTime() - b.getTime())[0];
        return {
          bidId: id,
          tender: {
            id: tender.id,
            status: tender.status,
            content: { language: content.language, title: content.title },
          },
          nextDeadline: next?.toISOString() ?? null,
          lockedParts: PART_TYPES.filter((p) => isLocked(tender, p, now)),
        };
      }),
      meta: pageMeta(query, total),
    };
  }

  // B4: replaces one part in full; a failure leaves the previous part as it was.
  async replace(
    userId: string,
    bidId: string,
    partType: PartType,
    body: Record<string, unknown>,
    files: BidUpload[],
    key: string | undefined,
    language: Language,
    requestId?: string,
  ): Promise<{ body: BidPartView; replayed: boolean }> {
    const { bid, tender } = await this.ownBid(userId, bidId);
    const errors: FieldError[] = [];
    const allowed = [
      'languages',
      'answers',
      ...(partType === 'legal_information' ? ['legalInformation'] : []),
    ];
    for (const name of Object.keys(body))
      if (!allowed.includes(name)) errors.push({ field: name, code: 'FIELD_NOT_EDITABLE' });
    const legal =
      partType === 'legal_information'
        ? parseJson(body.legalInformation, 'legalInformation', errors)
        : {};
    const answers = parseJson(body.answers, 'answers', errors);
    const byPart = this.filesByPart(files, errors, partType);
    const input = this.readPart(
      tender,
      partType,
      legal,
      answers,
      body.languages,
      byPart.get(partType) ?? new Map<string, UploadedFileInput>(),
      'legalInformation',
      errors,
    );
    for (const name of byPart.get(partType)?.keys() ?? [])
      errors.push({ field: `files[${name}]`, code: 'FIELD_NOT_EDITABLE' });
    if (errors.length) throw validation(errors);

    const route = `PUT /api/v1/me/bids/${bidId}/parts/${partType}`;
    const stored = await this.saveFiles([input]);
    const replaced: string[] = [];
    try {
      const result = await this.idempotency.user(
        userId,
        key,
        route,
        this.fingerprint(route, [input]),
        async (tx) => {
          const part = await tx.bidPart.findUniqueOrThrow({
            where: { bidId_partType: { bidId: bid.id, partType } },
            select: { id: true },
          });
          // Lock order: tender first, then the bid part.
          await tx.$queryRaw`SELECT id FROM tenders WHERE id = ${bid.tenderId}::uuid FOR SHARE`;
          await tx.$queryRaw`SELECT id FROM bid_parts WHERE id = ${part.id}::uuid FOR UPDATE`;
          const fresh = await tx.tender.findUniqueOrThrow({
            where: { id: bid.tenderId },
            select: tenderSelect,
          });
          if (isLocked(fresh, partType, new Date())) throw unprocessable('BID_PART_LOCKED');
          const old = await tx.bidPartDocument.findMany({
            where: { bidPartId: part.id },
            select: { document: { select: { id: true, storageKey: true } } },
          });
          await tx.bidFieldAnswer.deleteMany({ where: { bidPartId: part.id } });
          await tx.document.deleteMany({ where: { id: { in: old.map((d) => d.document.id) } } });
          replaced.push(...old.map((d) => d.document.storageKey));
          await tx.bidPart.update({
            where: { id: part.id },
            data: { standardAnswers: input.standardAnswers, lastSubmittedAt: new Date() },
          });
          await this.writePart(tx, part.id, input, userId, stored);
          await this.audit.record(
            {
              actorUserId: userId,
              action: 'bid_part.replaced',
              resourceType: 'bid',
              resourceId: bid.id,
              context: { partType },
              requestId,
            },
            tx,
          );
          const view = await this.view(tx, bid.id, fresh, language);
          return view.parts.find(
            (p) => p.partType === partType,
          ) as unknown as Prisma.InputJsonObject;
        },
        200,
      );
      if (result.replayed) await this.discardUnused([...stored.values()]);
      else
        await this.discard(replaced).catch(() =>
          this.logger.warn('Replaced bid files were not removed'),
        );
      return { body: result.body as unknown as BidPartView, replayed: result.replayed };
    } catch (error) {
      await this.discardUnused([...stored.values()]);
      throw error;
    }
  }

  // B6: a signed link to one of the supplier's own bid files.
  async download(userId: string, bidId: string, docId: string) {
    const { bid } = await this.ownBid(userId, bidId);
    const link = await this.prisma.bidPartDocument.findFirst({
      where: { documentId: docId, bidPart: { bidId: bid.id } },
      select: { document: { select: { storageKey: true, originalName: true } } },
    });
    if (!link) throw notFound();
    return this.signedUrls.sign(link.document.storageKey, link.document.originalName);
  }
}
