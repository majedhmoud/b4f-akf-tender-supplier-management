-- CreateEnum
CREATE TYPE "award_selection" AS ENUM ('top_rank', 'tie_break');

-- CreateTable
CREATE TABLE "bid_rankings" (
    "bid_id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "combined_score" DECIMAL(5,2) NOT NULL,
    "above_estimated_balance" BOOLEAN NOT NULL,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_rankings_pkey" PRIMARY KEY ("bid_id")
);

-- CreateTable
CREATE TABLE "tender_awards" (
    "tender_id" UUID NOT NULL,
    "winning_bid_id" UUID NOT NULL,
    "selection" "award_selection" NOT NULL,
    "tie_broken_by_user_id" UUID,
    "awarded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_awards_pkey" PRIMARY KEY ("tender_id")
);

-- CreateIndex
CREATE INDEX "bid_rankings_tender_id_combined_score_idx" ON "bid_rankings"("tender_id", "combined_score");

-- CreateIndex
CREATE UNIQUE INDEX "bid_rankings_bid_id_tender_id_key" ON "bid_rankings"("bid_id", "tender_id");

-- CreateIndex
CREATE UNIQUE INDEX "tender_awards_winning_bid_id_key" ON "tender_awards"("winning_bid_id");

-- CreateIndex
CREATE UNIQUE INDEX "tender_awards_winning_bid_id_tender_id_key" ON "tender_awards"("winning_bid_id", "tender_id");

-- AddForeignKey
ALTER TABLE "bid_rankings" ADD CONSTRAINT "bid_rankings_bid_id_tender_id_fkey" FOREIGN KEY ("bid_id", "tender_id") REFERENCES "bids"("id", "tender_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_rankings" ADD CONSTRAINT "bid_rankings_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_awards" ADD CONSTRAINT "tender_awards_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_awards" ADD CONSTRAINT "tender_awards_winning_bid_id_tender_id_fkey" FOREIGN KEY ("winning_bid_id", "tender_id") REFERENCES "bids"("id", "tender_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_awards" ADD CONSTRAINT "tender_awards_tie_broken_by_user_id_fkey" FOREIGN KEY ("tie_broken_by_user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written (ERD, Scoring and award).
ALTER TABLE "bid_rankings" ADD CONSTRAINT "bid_rankings_score_check"
  CHECK ("combined_score" BETWEEN 0 AND 100);
ALTER TABLE "tender_awards" ADD CONSTRAINT "tender_awards_tie_break_check"
  CHECK (("selection" = 'tie_break') = ("tie_broken_by_user_id" IS NOT NULL));
