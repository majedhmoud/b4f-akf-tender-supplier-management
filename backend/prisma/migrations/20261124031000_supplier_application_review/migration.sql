-- ERD: Sign-up, Document ownership, Supporting tables, Indexes.
CREATE TYPE signup_decision AS ENUM ('accepted', 'rejected');
CREATE TYPE application_document_kind AS ENUM ('registration_certificate', 'tax_certificate');
CREATE TYPE supplier_status AS ENUM ('active', 'suspended');

CREATE TABLE supplier_applications (
 id UUID PRIMARY KEY, legal_name TEXT NOT NULL, registration_number TEXT NOT NULL,
 contact_email TEXT NOT NULL, preferred_language language NOT NULL,
 submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT supplier_applications_legal_name_check CHECK (length(btrim(legal_name)) > 0),
 CONSTRAINT supplier_applications_registration_number_check CHECK (length(btrim(registration_number)) > 0),
 CONSTRAINT supplier_applications_contact_email_check CHECK (length(btrim(contact_email)) > 0)
);
CREATE INDEX supplier_applications_submitted_at_idx ON supplier_applications(submitted_at);
CREATE TABLE signup_reviews (
 id UUID PRIMARY KEY, application_id UUID NOT NULL UNIQUE REFERENCES supplier_applications(id) ON DELETE RESTRICT,
 reviewer_user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
 decision signup_decision NOT NULL, reason TEXT, decided_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 raised_to_admin_at TIMESTAMPTZ, admin_user_id UUID REFERENCES user_accounts(id) ON DELETE RESTRICT,
 admin_accepted_at TIMESTAMPTZ,
 CONSTRAINT signup_reviews_raised_check CHECK ((decision = 'accepted' AND raised_to_admin_at IS NOT NULL) OR (decision = 'rejected' AND raised_to_admin_at IS NULL)),
 CONSTRAINT signup_reviews_admin_check CHECK ((admin_accepted_at IS NULL AND admin_user_id IS NULL) OR (admin_accepted_at IS NOT NULL AND admin_user_id IS NOT NULL AND raised_to_admin_at IS NOT NULL AND admin_accepted_at >= raised_to_admin_at))
);
CREATE INDEX signup_reviews_reviewer_user_id_idx ON signup_reviews(reviewer_user_id);
CREATE INDEX signup_reviews_admin_user_id_idx ON signup_reviews(admin_user_id);
CREATE INDEX signup_reviews_decision_raised_to_admin_at_idx ON signup_reviews(decision, raised_to_admin_at);
CREATE TABLE application_documents (
 document_id UUID PRIMARY KEY, owner_type document_owner_type NOT NULL DEFAULT 'application',
 application_id UUID NOT NULL REFERENCES supplier_applications(id) ON DELETE RESTRICT,
 kind application_document_kind NOT NULL,
 CONSTRAINT application_documents_owner_type_check CHECK (owner_type = 'application'),
 CONSTRAINT application_documents_document_id_owner_type_key UNIQUE(document_id, owner_type),
 CONSTRAINT application_documents_document_id_owner_type_fkey FOREIGN KEY(document_id, owner_type) REFERENCES documents(id, owner_type) ON DELETE CASCADE
);
CREATE INDEX application_documents_application_id_idx ON application_documents(application_id);
CREATE TABLE suppliers (
 id UUID PRIMARY KEY, application_id UUID NOT NULL UNIQUE REFERENCES supplier_applications(id) ON DELETE RESTRICT,
 user_id UUID NOT NULL UNIQUE REFERENCES user_accounts(id) ON DELETE RESTRICT,
 legal_name TEXT NOT NULL, registration_number TEXT NOT NULL UNIQUE,
 technical_information TEXT NOT NULL DEFAULT '', status supplier_status NOT NULL DEFAULT 'active'
);
CREATE TABLE idempotency_keys (
 user_id UUID REFERENCES user_accounts(id) ON DELETE RESTRICT, guest_scope_id UUID,
 route TEXT NOT NULL, key UUID NOT NULL, payload_hash TEXT NOT NULL,
 response_status INTEGER, response_body JSONB, expires_at TIMESTAMPTZ NOT NULL,
 CONSTRAINT idempotency_keys_owner_check CHECK ((user_id IS NULL) <> (guest_scope_id IS NULL)),
 CONSTRAINT idempotency_keys_response_check CHECK ((response_status IS NULL) = (response_body IS NULL))
);
CREATE UNIQUE INDEX idempotency_keys_user_route_key ON idempotency_keys(user_id,route,key) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idempotency_keys_guest_route_key ON idempotency_keys(guest_scope_id,route,key) WHERE guest_scope_id IS NOT NULL;
CREATE INDEX idempotency_keys_expires_at_idx ON idempotency_keys(expires_at);
