ALTER TABLE "tenders"
ADD COLUMN "modality" VARCHAR(80);

ALTER TABLE "email_messages"
ADD COLUMN "tender_id" UUID,
ADD COLUMN "bid_id" UUID,
ADD COLUMN "convocation_match_method" VARCHAR(40),
ADD COLUMN "convocation_match_confidence" INTEGER,
ADD COLUMN "convocation_matched_at" TIMESTAMP(3);

CREATE INDEX "email_messages_tender_id_received_at_idx"
ON "email_messages"("tender_id", "received_at");

CREATE INDEX "email_messages_bid_id_received_at_idx"
ON "email_messages"("bid_id", "received_at");

ALTER TABLE "email_messages"
ADD CONSTRAINT "email_messages_tender_id_fkey"
FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_messages"
ADD CONSTRAINT "email_messages_bid_id_fkey"
FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;
