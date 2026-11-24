import { Injectable } from '@nestjs/common';
import { AccessService } from '../auth/access.service.js';
import type { FieldError } from '../common/errors/api-exception.js';
import { validateBody } from '../common/errors/validate-body.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BidFormEditorView, CustomFieldView, SaveBidFormDto } from './dto/bid-form.dto.js';
import { PART_TYPES, STANDARD_BID_FORM } from './standard-bid-form.js';
import { assertEditable, bumpRevision, fieldErrors, statusChanged } from './tender-rules.js';

// Moves stored positions out of the way while a template is rewritten, so the
// unique (tender, part, position) key never clashes mid-save.
const POSITION_OFFSET = 100_000;

const fieldSelect = {
  id: true,
  partType: true,
  inputType: true,
  position: true,
  required: true,
  unit: true,
  minimum: true,
  translations: {
    select: { language: true, label: true, instructions: true },
    orderBy: { language: 'asc' },
  },
} satisfies Prisma.TenderFormFieldSelect;

type FieldRow = Prisma.TenderFormFieldGetPayload<{ select: typeof fieldSelect }>;

function toView(field: FieldRow): CustomFieldView {
  return {
    fieldId: field.id,
    type: field.inputType,
    required: field.required,
    unit: field.unit,
    minimum: field.minimum === null ? null : Number(field.minimum),
    translations: field.translations.map((t) => ({
      language: t.language,
      label: t.label,
      ...(t.instructions ? { instructions: t.instructions } : {}),
    })),
  };
}

// A comparable form of one field definition, to tell whether a save changes
// the template at all.
function signature(f: {
  fieldId: string | null;
  partType: string;
  position: number;
  type: string;
  required: boolean;
  unit: string | null;
  minimum: number | null;
  translations: { language: string; label: string; instructions?: string | null }[];
}): string {
  const translations = [...f.translations]
    .sort((a, b) => a.language.localeCompare(b.language))
    .map((t) => [t.language, t.label, t.instructions ?? null]);
  return JSON.stringify([
    f.fieldId,
    f.partType,
    f.position,
    f.type,
    f.required,
    f.unit,
    f.minimum,
    translations,
  ]);
}

// M10 and M11 in API_CONTRACT.md, "Supplier form editor"; rules in the ERD,
// "Supplier bid form".
@Injectable()
export class BidFormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  // M10. Readable from acceptance on; savable only while `accepted`.
  async view(tenderId: string): Promise<BidFormEditorView> {
    const tender = await this.access.managedTender(tenderId);
    if (tender.status === 'draft') throw statusChanged(tender.status);
    return this.buildView(tenderId, tender.revision, tender.status === 'accepted');
  }

  // M11. Replaces the whole template atomically. A real change increases the
  // tender revision once; saving the same template changes nothing.
  async save(tenderId: string, body: unknown): Promise<BidFormEditorView> {
    const tender = await this.access.managedTender(tenderId);
    assertEditable(tender, 'accepted', (body as { revision?: unknown } | null)?.revision);
    const dto = await validateBody(SaveBidFormDto, body);

    const current = await this.prisma.tenderFormField.findMany({
      where: { tenderId },
      select: fieldSelect,
    });
    const currentIds = new Set(current.map((f) => f.id));
    const errors: FieldError[] = [];

    const partTypes = new Set(dto.parts.map((p) => p.partType));
    if (partTypes.size !== PART_TYPES.length) errors.push({ field: 'parts', code: 'INVALID' });

    const seenIds = new Set<string>();
    dto.parts.forEach((part, i) =>
      part.customFields.forEach((field, j) => {
        const path = `parts[${i}].customFields[${j}]`;
        if (field.fieldId) {
          // Unknown, foreign, or repeated IDs are refused.
          if (!currentIds.has(field.fieldId) || seenIds.has(field.fieldId)) {
            errors.push({ field: `${path}.fieldId`, code: 'INVALID' });
          }
          seenIds.add(field.fieldId);
        }
        if (field.type !== 'number' && (field.unit !== undefined || field.minimum !== undefined)) {
          errors.push({ field: `${path}.type`, code: 'INVALID' });
        }
        const languages = new Set(field.translations.map((t) => t.language));
        if (languages.size !== field.translations.length) {
          errors.push({ field: `${path}.translations`, code: 'INVALID' });
        }
      }),
    );
    if (errors.length > 0) throw fieldErrors(errors);

    const desired = dto.parts.flatMap((part) =>
      part.customFields.map((field, position) => ({
        fieldId: field.fieldId ?? null,
        partType: part.partType,
        position,
        type: field.type,
        required: field.required,
        unit: field.unit ?? null,
        minimum: field.minimum ?? null,
        translations: field.translations,
      })),
    );
    const before = current
      .map((f) => signature({ ...toView(f), partType: f.partType, position: f.position }))
      .sort();
    const after = desired.map(signature).sort();
    if (JSON.stringify(before) === JSON.stringify(after)) {
      return this.buildView(tenderId, tender.revision, true);
    }

    const revision = await this.prisma.$transaction(async (tx) => {
      const next = await bumpRevision(tx, tenderId, {
        status: 'accepted',
        revision: dto.revision,
      });
      const kept = desired.flatMap((f) => (f.fieldId ? [f.fieldId] : []));
      await tx.tenderFormField.deleteMany({ where: { tenderId, id: { notIn: kept } } });
      await tx.tenderFormField.updateMany({
        where: { tenderId },
        data: { position: { increment: POSITION_OFFSET } },
      });

      for (const field of desired) {
        const data = {
          partType: field.partType,
          inputType: field.type,
          position: field.position,
          required: field.required,
          unit: field.unit,
          minimum: field.minimum,
        };
        const translations = field.translations.map((t) => ({
          language: t.language,
          label: t.label,
          instructions: t.instructions ?? null,
        }));
        if (field.fieldId) {
          await tx.tenderFormFieldTranslation.deleteMany({ where: { fieldId: field.fieldId } });
          await tx.tenderFormField.update({
            where: { id: field.fieldId },
            data: { ...data, translations: { create: translations } },
          });
        } else {
          await tx.tenderFormField.create({
            data: { ...data, tenderId, translations: { create: translations } },
          });
        }
      }
      return next;
    });

    return this.buildView(tenderId, revision, true);
  }

  private async buildView(
    tenderId: string,
    revision: number,
    canSave: boolean,
  ): Promise<BidFormEditorView> {
    const fields = await this.prisma.tenderFormField.findMany({
      where: { tenderId },
      orderBy: { position: 'asc' },
      select: fieldSelect,
    });
    return {
      revision,
      allowedActions: canSave ? ['save'] : [],
      parts: PART_TYPES.map((partType) => ({
        partType,
        fields: STANDARD_BID_FORM[partType].fields,
        documents: STANDARD_BID_FORM[partType].documents,
        customFields: fields.filter((f) => f.partType === partType).map(toView),
      })),
    };
  }
}
