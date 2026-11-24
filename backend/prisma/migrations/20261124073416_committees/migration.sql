-- CreateEnum
CREATE TYPE "committee_type" AS ENUM ('legal_committee', 'technical_committee', 'financial_committee');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('nominated', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "tender_committees" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "type" "committee_type" NOT NULL,
    "raised_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_assignments" (
    "id" UUID NOT NULL,
    "committee_id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "nominee_name" TEXT NOT NULL,
    "nominee_email" TEXT NOT NULL,
    "user_id" UUID,
    "status" "assignment_status" NOT NULL DEFAULT 'nominated',
    "approved_by_user_id" UUID,
    "nominated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ,

    CONSTRAINT "committee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tender_committees_tender_id_type_key" ON "tender_committees"("tender_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "tender_committees_id_tender_id_key" ON "tender_committees"("id", "tender_id");

-- CreateIndex
CREATE INDEX "committee_assignments_committee_id_tender_id_idx" ON "committee_assignments"("committee_id", "tender_id");

-- CreateIndex
CREATE INDEX "committee_assignments_status_nominated_at_idx" ON "committee_assignments"("status", "nominated_at");

-- CreateIndex
CREATE INDEX "committee_assignments_user_id_idx" ON "committee_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "committee_assignments_tender_id_user_id_key" ON "committee_assignments"("tender_id", "user_id");

-- AddForeignKey
ALTER TABLE "tender_committees" ADD CONSTRAINT "tender_committees_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_committee_id_tender_id_fkey" FOREIGN KEY ("committee_id", "tender_id") REFERENCES "tender_committees"("id", "tender_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written (ERD, Committees); Prisma does not manage CHECKs.
ALTER TABLE "committee_assignments" ADD CONSTRAINT "committee_assignments_decision_check" CHECK (
  ("status" = 'nominated' AND "decided_at" IS NULL AND "approved_by_user_id" IS NULL)
  OR ("status" = 'approved' AND "decided_at" IS NOT NULL AND "user_id" IS NOT NULL AND "approved_by_user_id" IS NOT NULL)
  OR ("status" = 'rejected' AND "decided_at" IS NOT NULL AND "approved_by_user_id" IS NOT NULL)
);
