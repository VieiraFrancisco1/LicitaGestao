ALTER TABLE "notification_reads"
ADD COLUMN "dismissed_at" TIMESTAMP(3);

CREATE INDEX "notification_reads_dismissed_at_idx"
ON "notification_reads"("dismissed_at");
