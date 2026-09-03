-- Fase 6: integração Outlook/Hotmail por empresa.
-- Migration aditiva: preserva todas as integrações e mensagens do Gmail.
CREATE TYPE "EmailProvider" AS ENUM ('GMAIL', 'OUTLOOK');

ALTER TABLE "email_messages"
  ADD COLUMN "provider" "EmailProvider" NOT NULL DEFAULT 'GMAIL';

CREATE TABLE "outlook_integrations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "microsoft_email" VARCHAR(180) NOT NULL,
    "refresh_token_encrypted" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),
    "last_successful_sync_at" TIMESTAMP(3),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outlook_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outlook_integrations_company_id_key"
  ON "outlook_integrations"("company_id");

CREATE INDEX "outlook_integrations_last_synced_at_idx"
  ON "outlook_integrations"("last_synced_at");

CREATE INDEX "email_messages_company_id_provider_received_at_idx"
  ON "email_messages"("company_id", "provider", "received_at");

ALTER TABLE "outlook_integrations"
  ADD CONSTRAINT "outlook_integrations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
