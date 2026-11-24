-- Account setup tokens and email messages (ERD; ADR 0005). Must sort after
-- 20261124031100_align_s2_foreign_keys.

-- CreateEnum
CREATE TYPE "email_kind" AS ENUM ('account_setup', 'award_winner', 'award_other', 'cancellation', 'contact_supplier');

-- CreateEnum
CREATE TYPE "email_status" AS ENUM ('draft', 'sending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "account_setup_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,

    CONSTRAINT "account_setup_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "kind" "email_kind" NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "language" "language" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tender_id" UUID,
    "status" "email_status" NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "failure_code" TEXT,
    "failed_at" TIMESTAMPTZ,
    "sent_by_user_id" UUID,
    "prepared_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_setup_tokens_token_hash_key" ON "account_setup_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "account_setup_tokens_user_id_idx" ON "account_setup_tokens"("user_id");

-- CreateIndex
CREATE INDEX "email_messages_tender_id_idx" ON "email_messages"("tender_id");

-- CreateIndex
CREATE INDEX "email_messages_status_kind_idx" ON "email_messages"("status", "kind");

-- AddForeignKey
ALTER TABLE "account_setup_tokens" ADD CONSTRAINT "account_setup_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Rules from docs/05_ARCHITECTURE/ERD.md, Emails, that Prisma cannot express.
-- Added by hand; keep them when editing this file.
-- ---------------------------------------------------------------------------

-- Every edit increases the revision, which starts at 1.
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_revision_check" CHECK ("revision" >= 1);

-- `sent_at` is set exactly when sent; failure details exactly when failed.
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_sent_check" CHECK (("status" = 'sent') = ("sent_at" IS NOT NULL));
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_failed_check" CHECK (
  ("status" = 'failed') = ("failure_code" IS NOT NULL) AND ("status" = 'failed') = ("failed_at" IS NOT NULL)
);

-- Account setup emails belong to no tender; award and cancellation emails always do.
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_tender_check" CHECK (
  ("kind" = 'account_setup' AND "tender_id" IS NULL)
  OR ("kind" IN ('award_winner', 'award_other', 'cancellation') AND "tender_id" IS NOT NULL)
  OR "kind" = 'contact_supplier'
);

-- Retries never prepare a duplicate award or cancellation email.
CREATE UNIQUE INDEX "email_messages_tender_recipient_kind_key" ON "email_messages" ("tender_id", "recipient_user_id", "kind")
  WHERE "kind" IN ('award_winner', 'award_other', 'cancellation');
