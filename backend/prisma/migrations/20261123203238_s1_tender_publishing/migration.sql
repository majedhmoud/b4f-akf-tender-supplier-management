-- CreateEnum
CREATE TYPE "language" AS ENUM ('en', 'ar');

-- CreateEnum
CREATE TYPE "role" AS ENUM ('supplier', 'employee', 'procurement_officer', 'admin', 'legal_committee');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('pending_setup', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "tender_status" AS ENUM ('draft', 'accepted', 'published', 'closed', 'under_evaluation', 'awarded', 'cancelled');

-- CreateEnum
CREATE TYPE "cancellation_reason" AS ENUM ('no_bids', 'no_qualified_bid');

-- CreateEnum
CREATE TYPE "document_owner_type" AS ENUM ('application', 'supplier', 'tender', 'bid_part');

-- CreateEnum
CREATE TYPE "tender_document_kind" AS ENUM ('terms_of_reference', 'other');

-- CreateEnum
CREATE TYPE "part_type" AS ENUM ('legal_information', 'technical_offer', 'financial_offer');

-- CreateEnum
CREATE TYPE "form_input_type" AS ENUM ('text', 'number', 'boolean', 'file');

-- CreateTable
CREATE TABLE "user_accounts" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "preferred_language" "language" NOT NULL,
    "status" "account_status" NOT NULL,
    "email_verified_at" TIMESTAMPTZ,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role" "role" NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_refresh_tokens" (
    "token_hash" TEXT NOT NULL,
    "session_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replaced_at" TIMESTAMPTZ,

    CONSTRAINT "session_refresh_tokens_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "tender_categories" (
    "code" TEXT NOT NULL,

    CONSTRAINT "tender_categories_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "tenders" (
    "id" UUID NOT NULL,
    "status" "tender_status" NOT NULL DEFAULT 'draft',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "category_code" TEXT NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "estimated_balance" DECIMAL(14,2) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "application_deadline" TIMESTAMPTZ,
    "technical_deadline" TIMESTAMPTZ,
    "financial_deadline" TIMESTAMPTZ,
    "accepted_at" TIMESTAMPTZ,
    "published_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancellation_reason" "cancellation_reason",
    "copied_from_tender_id" UUID,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_translations" (
    "tender_id" UUID NOT NULL,
    "language" "language" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "tender_translations_pkey" PRIMARY KEY ("tender_id","language")
);

-- CreateTable
CREATE TABLE "tender_scorings" (
    "tender_id" UUID NOT NULL,
    "technical_weight" INTEGER NOT NULL,
    "financial_weight" INTEGER NOT NULL,
    "minimum_technical_score" INTEGER NOT NULL,

    CONSTRAINT "tender_scorings_pkey" PRIMARY KEY ("tender_id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "owner_type" "document_owner_type" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "translation_of_id" UUID,
    "uploaded_by_user_id" UUID,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_documents" (
    "document_id" UUID NOT NULL,
    "owner_type" "document_owner_type" NOT NULL DEFAULT 'tender',
    "tender_id" UUID NOT NULL,
    "kind" "tender_document_kind" NOT NULL,

    CONSTRAINT "tender_documents_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "tender_form_fields" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "part_type" "part_type" NOT NULL,
    "input_type" "form_input_type" NOT NULL,
    "position" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL,
    "unit" TEXT,
    "minimum" DECIMAL(18,4),

    CONSTRAINT "tender_form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_form_field_translations" (
    "field_id" UUID NOT NULL,
    "language" "language" NOT NULL,
    "label" TEXT NOT NULL,
    "instructions" TEXT,

    CONSTRAINT "tender_form_field_translations_pkey" PRIMARY KEY ("field_id","language")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" JSONB,
    "request_id" TEXT,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_email_key" ON "user_accounts"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "session_refresh_tokens_session_id_idx" ON "session_refresh_tokens"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenders_copied_from_tender_id_key" ON "tenders"("copied_from_tender_id");

-- CreateIndex
CREATE INDEX "tenders_status_idx" ON "tenders"("status");

-- CreateIndex
CREATE INDEX "tenders_published_at_idx" ON "tenders"("published_at");

-- CreateIndex
CREATE INDEX "tenders_status_application_deadline_idx" ON "tenders"("status", "application_deadline");

-- CreateIndex
CREATE INDEX "tenders_status_financial_deadline_idx" ON "tenders"("status", "financial_deadline");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "documents_id_owner_type_key" ON "documents"("id", "owner_type");

-- CreateIndex
CREATE UNIQUE INDEX "documents_translation_of_id_language_key" ON "documents"("translation_of_id", "language");

-- CreateIndex
CREATE INDEX "tender_documents_tender_id_idx" ON "tender_documents"("tender_id");

-- CreateIndex
CREATE UNIQUE INDEX "tender_documents_document_id_owner_type_key" ON "tender_documents"("document_id", "owner_type");

-- CreateIndex
CREATE UNIQUE INDEX "tender_form_fields_tender_id_part_type_position_key" ON "tender_form_fields"("tender_id", "part_type", "position");

-- CreateIndex
CREATE INDEX "audit_events_resource_type_resource_id_occurred_at_idx" ON "audit_events"("resource_type", "resource_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events"("occurred_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_refresh_tokens" ADD CONSTRAINT "session_refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_category_code_fkey" FOREIGN KEY ("category_code") REFERENCES "tender_categories"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_copied_from_tender_id_fkey" FOREIGN KEY ("copied_from_tender_id") REFERENCES "tenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_translations" ADD CONSTRAINT "tender_translations_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_scorings" ADD CONSTRAINT "tender_scorings_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_translation_of_id_fkey" FOREIGN KEY ("translation_of_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_documents" ADD CONSTRAINT "tender_documents_document_id_owner_type_fkey" FOREIGN KEY ("document_id", "owner_type") REFERENCES "documents"("id", "owner_type") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_documents" ADD CONSTRAINT "tender_documents_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_form_fields" ADD CONSTRAINT "tender_form_fields_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_form_field_translations" ADD CONSTRAINT "tender_form_field_translations_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "tender_form_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- CHECK constraints from docs/05_ARCHITECTURE/ERD.md that Prisma cannot
-- express in schema.prisma. Added by hand; keep them when editing this file.
-- ---------------------------------------------------------------------------

-- An account always has a name to show (ERD A15).
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_display_name_check" CHECK (char_length(btrim("display_name")) > 0);

-- Tender revision starts at 1 (ERD, Tender revision).
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_revision_check" CHECK ("revision" >= 1);

-- Estimated balance is never negative; one ISO 4217 currency per tender (ERD A3).
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_estimated_balance_check" CHECK ("estimated_balance" >= 0);
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_currency_code_check" CHECK ("currency_code" ~ '^[A-Z]{3}$');

-- Deadlines run application -> technical -> financial (ERD, Scoring and award).
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_deadline_order_check" CHECK (
  ("application_deadline" IS NULL OR "technical_deadline" IS NULL OR "application_deadline" < "technical_deadline")
  AND ("technical_deadline" IS NULL OR "financial_deadline" IS NULL OR "technical_deadline" < "financial_deadline")
);

-- A draft or accepted tender has no deadlines yet; from publication on it has
-- all three (ERD A1; Copying a cancelled tender: the copy has no deadlines).
-- A tender cancelled for no bids was published, so it keeps its deadlines.
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_deadlines_by_status_check" CHECK (
  ("status" IN ('draft', 'accepted')
     AND "application_deadline" IS NULL AND "technical_deadline" IS NULL AND "financial_deadline" IS NULL)
  OR ("status" IN ('published', 'closed', 'under_evaluation', 'awarded', 'cancelled')
     AND "application_deadline" IS NOT NULL AND "technical_deadline" IS NOT NULL AND "financial_deadline" IS NOT NULL)
);

-- A cancellation reason and time are set exactly when the tender is cancelled.
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_cancellation_check" CHECK (
  ("status" = 'cancelled') = ("cancellation_reason" IS NOT NULL)
  AND ("status" = 'cancelled') = ("cancelled_at" IS NOT NULL)
);

-- A tender is never copied from itself.
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_copy_not_self_check" CHECK ("copied_from_tender_id" IS NULL OR "copied_from_tender_id" <> "id");

-- A translation row exists only when complete (ERD, Language).
ALTER TABLE "tender_translations" ADD CONSTRAINT "tender_translations_complete_check" CHECK (
  char_length(btrim("title")) > 0 AND char_length(btrim("description")) > 0
);

-- Every score and weight is 0-100, and the weights add up to 100 (ERD, Scoring and award).
ALTER TABLE "tender_scorings" ADD CONSTRAINT "tender_scorings_range_check" CHECK (
  "technical_weight" BETWEEN 0 AND 100
  AND "financial_weight" BETWEEN 0 AND 100
  AND "minimum_technical_score" BETWEEN 0 AND 100
);
ALTER TABLE "tender_scorings" ADD CONSTRAINT "tender_scorings_total_check" CHECK ("technical_weight" + "financial_weight" = 100);

-- Documents: a real size, an ISO 639-1 language (ERD A10), never a translation of itself.
-- The service also checks that a translation points to an original and uses another language.
ALTER TABLE "documents" ADD CONSTRAINT "documents_size_check" CHECK ("size_bytes" > 0);
ALTER TABLE "documents" ADD CONSTRAINT "documents_language_check" CHECK ("language" ~ '^[a-z]{2}$');
ALTER TABLE "documents" ADD CONSTRAINT "documents_translation_not_self_check" CHECK ("translation_of_id" IS NULL OR "translation_of_id" <> "id");

-- The tender link table only ever holds tender documents (ERD, Document ownership).
ALTER TABLE "tender_documents" ADD CONSTRAINT "tender_documents_owner_type_check" CHECK ("owner_type" = 'tender');

-- Form fields: a valid position; unit and minimum only on number fields (ERD, Supplier bid form).
ALTER TABLE "tender_form_fields" ADD CONSTRAINT "tender_form_fields_position_check" CHECK ("position" >= 0);
ALTER TABLE "tender_form_fields" ADD CONSTRAINT "tender_form_fields_number_options_check" CHECK (
  "input_type" = 'number' OR ("unit" IS NULL AND "minimum" IS NULL)
);

-- Each field label is non-empty (ERD, Supplier bid form).
ALTER TABLE "tender_form_field_translations" ADD CONSTRAINT "tender_form_field_translations_label_check" CHECK (char_length(btrim("label")) > 0);
