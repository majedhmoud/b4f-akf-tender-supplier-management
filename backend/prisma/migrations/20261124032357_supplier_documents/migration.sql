-- CreateEnum
CREATE TYPE "supplier_document_kind" AS ENUM ('registration_certificate', 'tax_certificate');

-- CreateTable
CREATE TABLE "supplier_documents" (
    "document_id" UUID NOT NULL,
    "owner_type" "document_owner_type" NOT NULL DEFAULT 'supplier',
    "supplier_id" UUID NOT NULL,
    "kind" "supplier_document_kind" NOT NULL,

    CONSTRAINT "supplier_documents_pkey" PRIMARY KEY ("document_id")
);

-- CreateIndex
CREATE INDEX "supplier_documents_supplier_id_idx" ON "supplier_documents"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_documents_document_id_owner_type_key" ON "supplier_documents"("document_id", "owner_type");

-- AddForeignKey
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_document_id_owner_type_fkey" FOREIGN KEY ("document_id", "owner_type") REFERENCES "documents"("id", "owner_type") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written (ERD, Document ownership and Sign-up); Prisma does not manage these.
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_owner_type_check" CHECK ("owner_type" = 'supplier');

-- One current file per certificate kind; technical kinds may have many later.
CREATE UNIQUE INDEX "supplier_documents_certificate_key" ON "supplier_documents" ("supplier_id", "kind")
  WHERE "kind" IN ('registration_certificate', 'tax_certificate');
