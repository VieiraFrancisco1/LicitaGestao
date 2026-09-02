ALTER TABLE "tenders"
  ADD COLUMN "spreadsheet_responsible_user_id" UUID,
  ADD COLUMN "spreadsheet_notes" TEXT,
  ADD COLUMN "spreadsheet_notes_updated_at" TIMESTAMP(3);

CREATE INDEX "tenders_spreadsheet_responsible_user_id_idx"
  ON "tenders"("spreadsheet_responsible_user_id");

ALTER TABLE "tenders"
  ADD CONSTRAINT "tenders_spreadsheet_responsible_user_id_fkey"
  FOREIGN KEY ("spreadsheet_responsible_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
