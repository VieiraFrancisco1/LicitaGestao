BEGIN;

-- LicitaGestão: isolamento por organização, recuperação da conta principal e MEGA por usuário.

CREATE TABLE "organizations" (
  "id" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "login_email" VARCHAR(180) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "session_version" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_login_email_key" ON "organizations"("login_email");
CREATE INDEX "organizations_active_idx" ON "organizations"("active");

-- O ambiente já existente vira a primeira organização sem perder logins ou dados.
-- A senha principal inicial é a mesma do primeiro administrador atual.
INSERT INTO "organizations" ("id", "name", "login_email", "password_hash")
SELECT
  '00000000-0000-4000-8000-000000000001'::uuid,
  'LicitaGestão - Ambiente atual',
  COALESCE(
    (SELECT "email" FROM "users" WHERE "role" = 'ADMIN' ORDER BY "created_at" ASC LIMIT 1),
    (SELECT "email" FROM "users" ORDER BY "created_at" ASC LIMIT 1),
    'admin@licitagestao.local'
  ),
  COALESCE(
    (SELECT "password_hash" FROM "users" WHERE "role" = 'ADMIN' ORDER BY "created_at" ASC LIMIT 1),
    (SELECT "password_hash" FROM "users" ORDER BY "created_at" ASC LIMIT 1),
    '$2b$12$invalid.invalid.invalid.invalid.invalid.invalidinvalidinvalid'
  );

ALTER TABLE "users" ADD COLUMN "organization_id" UUID;
ALTER TABLE "companies" ADD COLUMN "organization_id" UUID;
ALTER TABLE "platforms" ADD COLUMN "organization_id" UUID;
ALTER TABLE "tenders" ADD COLUMN "organization_id" UUID;
ALTER TABLE "proposal_letter_templates" ADD COLUMN "organization_id" UUID;
ALTER TABLE "audit_logs" ADD COLUMN "organization_id" UUID;

UPDATE "users" SET "organization_id" = '00000000-0000-4000-8000-000000000001'::uuid WHERE "organization_id" IS NULL;
UPDATE "companies" SET "organization_id" = '00000000-0000-4000-8000-000000000001'::uuid WHERE "organization_id" IS NULL;
UPDATE "platforms" SET "organization_id" = '00000000-0000-4000-8000-000000000001'::uuid WHERE "organization_id" IS NULL;
UPDATE "tenders" SET "organization_id" = '00000000-0000-4000-8000-000000000001'::uuid WHERE "organization_id" IS NULL;
UPDATE "proposal_letter_templates" SET "organization_id" = '00000000-0000-4000-8000-000000000001'::uuid WHERE "organization_id" IS NULL;
UPDATE "audit_logs" SET "organization_id" = '00000000-0000-4000-8000-000000000001'::uuid WHERE "organization_id" IS NULL;

ALTER TABLE "users" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "companies" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "platforms" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "tenders" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "proposal_letter_templates" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proposal_letter_templates" ADD CONSTRAINT "proposal_letter_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "companies_cnpj_key";
DROP INDEX IF EXISTS "platforms_name_key";
DROP INDEX IF EXISTS "proposal_letter_templates_scope_key_key";

CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");
CREATE UNIQUE INDEX "companies_organization_id_cnpj_key" ON "companies"("organization_id", "cnpj");
CREATE UNIQUE INDEX "platforms_organization_id_name_key" ON "platforms"("organization_id", "name");
CREATE UNIQUE INDEX "proposal_letter_templates_organization_id_scope_key_key" ON "proposal_letter_templates"("organization_id", "scope_key");

CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX "companies_organization_id_idx" ON "companies"("organization_id");
CREATE INDEX "platforms_organization_id_idx" ON "platforms"("organization_id");
CREATE INDEX "tenders_organization_id_idx" ON "tenders"("organization_id");
CREATE INDEX "proposal_letter_templates_organization_id_idx" ON "proposal_letter_templates"("organization_id");
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

CREATE TABLE "organization_password_reset_tokens" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_password_reset_tokens_token_hash_key" ON "organization_password_reset_tokens"("token_hash");
CREATE INDEX "organization_password_reset_tokens_organization_id_expires_at_idx" ON "organization_password_reset_tokens"("organization_id", "expires_at");
ALTER TABLE "organization_password_reset_tokens" ADD CONSTRAINT "organization_password_reset_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mega_integrations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "email" VARCHAR(180) NOT NULL,
  "password_encrypted" TEXT,
  "connected" BOOLEAN NOT NULL DEFAULT false,
  "connected_at" TIMESTAMP(3),
  "last_synced_at" TIMESTAMP(3),
  "last_error" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mega_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mega_integrations_user_id_key" ON "mega_integrations"("user_id");
CREATE INDEX "mega_integrations_connected_idx" ON "mega_integrations"("connected");
ALTER TABLE "mega_integrations" ADD CONSTRAINT "mega_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents" ADD COLUMN "mega_integration_id" UUID;
CREATE INDEX "documents_mega_integration_id_idx" ON "documents"("mega_integration_id");
ALTER TABLE "documents" ADD CONSTRAINT "documents_mega_integration_id_fkey" FOREIGN KEY ("mega_integration_id") REFERENCES "mega_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "mega_company_folders" (
  "mega_integration_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "path" VARCHAR(1000) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mega_company_folders_pkey" PRIMARY KEY ("mega_integration_id", "company_id")
);
CREATE INDEX "mega_company_folders_company_id_idx" ON "mega_company_folders"("company_id");
ALTER TABLE "mega_company_folders" ADD CONSTRAINT "mega_company_folders_mega_integration_id_fkey" FOREIGN KEY ("mega_integration_id") REFERENCES "mega_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mega_company_folders" ADD CONSTRAINT "mega_company_folders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
