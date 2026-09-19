BEGIN;

CREATE TABLE "agenda_items" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "tender_id" UUID,
  "title" VARCHAR(180) NOT NULL,
  "notes" TEXT,
  "event_date" TIMESTAMP(3) NOT NULL,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agenda_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agenda_items_organization_id_company_id_event_date_idx"
ON "agenda_items"("organization_id", "company_id", "event_date");

CREATE INDEX "agenda_items_tender_id_idx" ON "agenda_items"("tender_id");

ALTER TABLE "agenda_items"
ADD CONSTRAINT "agenda_items_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agenda_items"
ADD CONSTRAINT "agenda_items_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agenda_items"
ADD CONSTRAINT "agenda_items_tender_id_fkey"
FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agenda_items"
ADD CONSTRAINT "agenda_items_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "tender_priorities" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "tender_id" UUID NOT NULL,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tender_priorities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tender_priorities_company_id_tender_id_key"
ON "tender_priorities"("company_id", "tender_id");

CREATE INDEX "tender_priorities_organization_id_company_id_created_at_idx"
ON "tender_priorities"("organization_id", "company_id", "created_at");

CREATE INDEX "tender_priorities_tender_id_idx" ON "tender_priorities"("tender_id");

ALTER TABLE "tender_priorities"
ADD CONSTRAINT "tender_priorities_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tender_priorities"
ADD CONSTRAINT "tender_priorities_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tender_priorities"
ADD CONSTRAINT "tender_priorities_tender_id_fkey"
FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tender_priorities"
ADD CONSTRAINT "tender_priorities_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "company_chat_messages" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "content" VARCHAR(3000) NOT NULL,
  "mention_user_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_chat_messages_organization_id_company_id_created_at_idx"
ON "company_chat_messages"("organization_id", "company_id", "created_at");

CREATE INDEX "company_chat_messages_author_id_idx" ON "company_chat_messages"("author_id");

ALTER TABLE "company_chat_messages"
ADD CONSTRAINT "company_chat_messages_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_chat_messages"
ADD CONSTRAINT "company_chat_messages_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_chat_messages"
ADD CONSTRAINT "company_chat_messages_author_id_fkey"
FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
