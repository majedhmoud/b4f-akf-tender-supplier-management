-- CreateTable
CREATE TABLE "bids" (
    "id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "bidder_code" TEXT NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_parts" (
    "id" UUID NOT NULL,
    "bid_id" UUID NOT NULL,
    "part_type" "part_type" NOT NULL,
    "standard_answers" JSONB NOT NULL DEFAULT '{}',
    "last_submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_part_documents" (
    "document_id" UUID NOT NULL,
    "owner_type" "document_owner_type" NOT NULL DEFAULT 'bid_part',
    "bid_part_id" UUID NOT NULL,
    "kind" TEXT,

    CONSTRAINT "bid_part_documents_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "bid_field_answers" (
    "bid_part_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "scalar_value" JSONB,
    "document_id" UUID,

    CONSTRAINT "bid_field_answers_pkey" PRIMARY KEY ("bid_part_id","field_id")
);

-- CreateIndex
CREATE INDEX "bids_supplier_id_idx" ON "bids"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "bids_tender_id_supplier_id_key" ON "bids"("tender_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "bids_tender_id_bidder_code_key" ON "bids"("tender_id", "bidder_code");

-- CreateIndex
CREATE UNIQUE INDEX "bids_id_tender_id_key" ON "bids"("id", "tender_id");

-- CreateIndex
CREATE UNIQUE INDEX "bid_parts_bid_id_part_type_key" ON "bid_parts"("bid_id", "part_type");

-- CreateIndex
CREATE INDEX "bid_part_documents_bid_part_id_idx" ON "bid_part_documents"("bid_part_id");

-- CreateIndex
CREATE UNIQUE INDEX "bid_part_documents_document_id_owner_type_key" ON "bid_part_documents"("document_id", "owner_type");

-- CreateIndex
CREATE INDEX "bid_field_answers_field_id_idx" ON "bid_field_answers"("field_id");

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_parts" ADD CONSTRAINT "bid_parts_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_part_documents" ADD CONSTRAINT "bid_part_documents_document_id_owner_type_fkey" FOREIGN KEY ("document_id", "owner_type") REFERENCES "documents"("id", "owner_type") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_part_documents" ADD CONSTRAINT "bid_part_documents_bid_part_id_fkey" FOREIGN KEY ("bid_part_id") REFERENCES "bid_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_field_answers" ADD CONSTRAINT "bid_field_answers_bid_part_id_fkey" FOREIGN KEY ("bid_part_id") REFERENCES "bid_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_field_answers" ADD CONSTRAINT "bid_field_answers_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "tender_form_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_field_answers" ADD CONSTRAINT "bid_field_answers_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written (ERD, Document ownership and Bids); Prisma does not manage these.
ALTER TABLE "bid_part_documents" ADD CONSTRAINT "bid_part_documents_owner_type_check" CHECK ("owner_type" = 'bid_part');

-- One file per standard document kind in a part.
CREATE UNIQUE INDEX "bid_part_documents_kind_key" ON "bid_part_documents" ("bid_part_id", "kind")
  WHERE "kind" IS NOT NULL;
