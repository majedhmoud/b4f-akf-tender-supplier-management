-- CreateEnum
CREATE TYPE "legal_outcome" AS ENUM ('pass', 'fail');

-- CreateTable
CREATE TABLE "legal_evaluations" (
    "bid_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "outcome" "legal_outcome" NOT NULL,
    "reason" TEXT,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_evaluations_pkey" PRIMARY KEY ("bid_id")
);

-- CreateTable
CREATE TABLE "technical_evaluations" (
    "bid_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "technical_score" INTEGER NOT NULL,
    "meets_minimum" BOOLEAN NOT NULL,
    "comments" TEXT,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_evaluations_pkey" PRIMARY KEY ("bid_id")
);

-- CreateTable
CREATE TABLE "financial_evaluations" (
    "bid_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "financial_score" INTEGER NOT NULL,
    "confirmed_total_price" DECIMAL(14,2) NOT NULL,
    "comments" TEXT,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_evaluations_pkey" PRIMARY KEY ("bid_id")
);

-- CreateIndex
CREATE INDEX "legal_evaluations_assignment_id_idx" ON "legal_evaluations"("assignment_id");

-- CreateIndex
CREATE INDEX "technical_evaluations_assignment_id_idx" ON "technical_evaluations"("assignment_id");

-- CreateIndex
CREATE INDEX "financial_evaluations_assignment_id_idx" ON "financial_evaluations"("assignment_id");

-- AddForeignKey
ALTER TABLE "legal_evaluations" ADD CONSTRAINT "legal_evaluations_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_evaluations" ADD CONSTRAINT "legal_evaluations_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "committee_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_evaluations" ADD CONSTRAINT "technical_evaluations_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_evaluations" ADD CONSTRAINT "technical_evaluations_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "committee_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_evaluations" ADD CONSTRAINT "financial_evaluations_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_evaluations" ADD CONSTRAINT "financial_evaluations_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "committee_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written (ERD, Scoring and award; Sealed, blind evaluation).
ALTER TABLE "legal_evaluations" ADD CONSTRAINT "legal_evaluations_reason_check"
  CHECK ("outcome" = 'pass' OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0));
ALTER TABLE "technical_evaluations" ADD CONSTRAINT "technical_evaluations_score_check"
  CHECK ("technical_score" BETWEEN 0 AND 100);
ALTER TABLE "financial_evaluations" ADD CONSTRAINT "financial_evaluations_score_check"
  CHECK ("financial_score" BETWEEN 0 AND 100 AND "confirmed_total_price" >= 0);
