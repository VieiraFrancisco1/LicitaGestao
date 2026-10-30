ALTER TABLE "discount_calculations"
  ADD COLUMN "budget_value" DECIMAL(15,2),
  ADD COLUMN "services_value" DECIMAL(15,2),
  ADD COLUMN "materials_value" DECIMAL(15,2),
  ADD COLUMN "equipment_value" DECIMAL(15,2);

ALTER TABLE "company_chat_messages"
  ADD COLUMN "reply_to_id" UUID;

CREATE INDEX "company_chat_messages_reply_to_id_idx" ON "company_chat_messages"("reply_to_id");

ALTER TABLE "company_chat_messages"
  ADD CONSTRAINT "company_chat_messages_reply_to_id_fkey"
  FOREIGN KEY ("reply_to_id") REFERENCES "company_chat_messages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
