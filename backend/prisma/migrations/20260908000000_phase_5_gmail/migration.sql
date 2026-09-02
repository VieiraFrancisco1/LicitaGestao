-- Fase 5: integração Gmail por empresa. Migration aditiva; não remove nem altera dados existentes.
CREATE TYPE "EmailProcessingStatus" AS ENUM ('PENDENTE', 'PROCESSADO', 'ERRO');

CREATE TABLE "email_integrations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "google_email" VARCHAR(180) NOT NULL,
    "refresh_token_encrypted" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3),
    "last_successful_sync_at" TIMESTAMP(3),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "gmail_message_id" VARCHAR(180) NOT NULL,
    "thread_id" VARCHAR(180) NOT NULL,
    "sender" VARCHAR(500) NOT NULL,
    "subject" VARCHAR(500),
    "received_at" TIMESTAMP(3) NOT NULL,
    "snippet" TEXT,
    "text_content" TEXT,
    "processing_status" "EmailProcessingStatus" NOT NULL DEFAULT 'PENDENTE',
    "is_potential_convocation" BOOLEAN NOT NULL DEFAULT false,
    "convocation_reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_integrations_company_id_key" ON "email_integrations"("company_id");
CREATE INDEX "email_integrations_last_synced_at_idx" ON "email_integrations"("last_synced_at");
CREATE UNIQUE INDEX "email_messages_company_id_gmail_message_id_key" ON "email_messages"("company_id", "gmail_message_id");
CREATE INDEX "email_messages_company_id_received_at_idx" ON "email_messages"("company_id", "received_at");
CREATE INDEX "email_messages_company_id_is_potential_convocation_received_at_idx" ON "email_messages"("company_id", "is_potential_convocation", "received_at");
CREATE INDEX "email_messages_processing_status_idx" ON "email_messages"("processing_status");

ALTER TABLE "email_integrations" ADD CONSTRAINT "email_integrations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
