-- Aligns the S2 foreign keys with schema.prisma (ON UPDATE CASCADE), so later
-- generated migrations carry no unrelated key changes. Must sort after
-- 20261124031000_supplier_application_review.

-- DropForeignKey
ALTER TABLE "application_documents" DROP CONSTRAINT "application_documents_application_id_fkey";

-- DropForeignKey
ALTER TABLE "application_documents" DROP CONSTRAINT "application_documents_document_id_owner_type_fkey";

-- DropForeignKey
ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_user_id_fkey";

-- DropForeignKey
ALTER TABLE "signup_reviews" DROP CONSTRAINT "signup_reviews_admin_user_id_fkey";

-- DropForeignKey
ALTER TABLE "signup_reviews" DROP CONSTRAINT "signup_reviews_application_id_fkey";

-- DropForeignKey
ALTER TABLE "signup_reviews" DROP CONSTRAINT "signup_reviews_reviewer_user_id_fkey";

-- DropForeignKey
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_application_id_fkey";

-- DropForeignKey
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_user_id_fkey";

-- AddForeignKey
ALTER TABLE "signup_reviews" ADD CONSTRAINT "signup_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "supplier_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signup_reviews" ADD CONSTRAINT "signup_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signup_reviews" ADD CONSTRAINT "signup_reviews_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_document_id_owner_type_fkey" FOREIGN KEY ("document_id", "owner_type") REFERENCES "documents"("id", "owner_type") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "supplier_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "supplier_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
