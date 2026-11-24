-- AlterTable
ALTER TABLE "tenders" ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "tenders_requested_by_user_id_created_at_idx" ON "tenders"("requested_by_user_id", "created_at");
