BEGIN;

CREATE TYPE "GmailAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "gmail_access_requests" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "requested_by_id" UUID NOT NULL,
  "email" VARCHAR(180) NOT NULL,
  "status" "GmailAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "review_note" VARCHAR(500),
  "reviewed_by_id" UUID,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gmail_access_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gmail_access_requests_organization_id_status_requested_at_idx"
ON "gmail_access_requests"("organization_id", "status", "requested_at");

CREATE INDEX "gmail_access_requests_company_id_requested_at_idx"
ON "gmail_access_requests"("company_id", "requested_at");

CREATE INDEX "gmail_access_requests_requested_by_id_idx"
ON "gmail_access_requests"("requested_by_id");

CREATE INDEX "gmail_access_requests_reviewed_by_id_idx"
ON "gmail_access_requests"("reviewed_by_id");

ALTER TABLE "gmail_access_requests"
ADD CONSTRAINT "gmail_access_requests_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gmail_access_requests"
ADD CONSTRAINT "gmail_access_requests_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gmail_access_requests"
ADD CONSTRAINT "gmail_access_requests_requested_by_id_fkey"
FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gmail_access_requests"
ADD CONSTRAINT "gmail_access_requests_reviewed_by_id_fkey"
FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "user_notifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "message" VARCHAR(1000) NOT NULL,
  "link" VARCHAR(500),
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_notifications_user_id_read_at_created_at_idx"
ON "user_notifications"("user_id", "read_at", "created_at");

ALTER TABLE "user_notifications"
ADD CONSTRAINT "user_notifications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform_settings" (
  "id" VARCHAR(40) NOT NULL DEFAULT 'default',
  "support_name" VARCHAR(120) NOT NULL DEFAULT 'Francisco',
  "support_whatsapp" VARCHAR(30),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_settings" ("id", "support_name")
VALUES ('default', 'Francisco')
ON CONFLICT ("id") DO NOTHING;

UPDATE "users"
SET "role" = 'SUPER_ADMIN'
WHERE "id" = (
  SELECT "id"
  FROM "users"
  WHERE "organization_id" = '00000000-0000-4000-8000-000000000001'::uuid
    AND "role" = 'ADMIN'
  ORDER BY "created_at" ASC
  LIMIT 1
);

COMMIT;
