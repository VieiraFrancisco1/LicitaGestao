BEGIN;

ALTER TABLE "company_chat_messages"
DROP CONSTRAINT IF EXISTS "company_chat_messages_company_id_fkey";

ALTER TABLE "company_chat_messages"
ALTER COLUMN "company_id" DROP NOT NULL;

ALTER TABLE "company_chat_messages"
ADD CONSTRAINT "company_chat_messages_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "company_chat_messages_organization_id_created_at_idx"
ON "company_chat_messages"("organization_id", "created_at");

COMMIT;
