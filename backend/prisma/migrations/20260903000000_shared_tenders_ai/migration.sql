-- A licitação passa a ser um registro geral. A tabela bids conserva a participação privada de cada empresa.
CREATE TABLE "tenders" (
    "id" UUID NOT NULL,
    "notice_number" VARCHAR(120) NOT NULL,
    "process_number" VARCHAR(120) NOT NULL,
    "municipality" VARCHAR(120) NOT NULL,
    "state" CHAR(2) NOT NULL,
    "agency" VARCHAR(180) NOT NULL,
    "session_date" DATE NOT NULL,
    "session_time" VARCHAR(5) NOT NULL,
    "object" TEXT NOT NULL,
    "proposal_validity_days" INTEGER,
    "proposal_expiration_date" DATE,
    "estimated_value" DECIMAL(15,2),
    "guarantee_type" "GuaranteeType" NOT NULL DEFAULT 'NAO_EXIGIDA',
    "guarantee_percentage" DECIMAL(5,2),
    "guarantee_value" DECIMAL(15,2),
    "platform_id" UUID,
    "platform_link" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- Preserva todos os registros existentes: cada licitação antiga vira uma licitação geral
-- e o registro original continua como a participação da empresa já associada.
INSERT INTO "tenders" (
    "id", "notice_number", "process_number", "municipality", "state", "agency",
    "session_date", "session_time", "object", "proposal_validity_days",
    "proposal_expiration_date", "estimated_value", "guarantee_type",
    "guarantee_percentage", "guarantee_value", "platform_id", "platform_link",
    "created_by_id", "updated_by_id", "created_at", "updated_at"
)
SELECT
    "id", "notice_number", "process_number", "municipality", "state", "agency",
    "session_date", "session_time", "object", "proposal_validity_days",
    "proposal_expiration_date", "estimated_value", "guarantee_type",
    "guarantee_percentage", "guarantee_value", "platform_id", "platform_link",
    "created_by_id", "updated_by_id", "created_at", "updated_at"
FROM "bids";

ALTER TABLE "bids" ADD COLUMN "tender_id" UUID;
UPDATE "bids" SET "tender_id" = "id";
ALTER TABLE "bids" ALTER COLUMN "tender_id" SET NOT NULL;

ALTER TABLE "bids" DROP CONSTRAINT "bids_platform_id_fkey";
DROP INDEX "bids_platform_id_idx";
DROP INDEX "bids_session_date_idx";
DROP INDEX "bids_process_number_idx";
DROP INDEX "bids_notice_number_idx";
DROP INDEX "bids_municipality_state_idx";

ALTER TABLE "bids"
    DROP COLUMN "notice_number",
    DROP COLUMN "process_number",
    DROP COLUMN "municipality",
    DROP COLUMN "state",
    DROP COLUMN "agency",
    DROP COLUMN "session_date",
    DROP COLUMN "session_time",
    DROP COLUMN "object",
    DROP COLUMN "proposal_validity_days",
    DROP COLUMN "proposal_expiration_date",
    DROP COLUMN "estimated_value",
    DROP COLUMN "guarantee_type",
    DROP COLUMN "guarantee_percentage",
    DROP COLUMN "guarantee_value",
    DROP COLUMN "platform_id",
    DROP COLUMN "platform_link";

CREATE INDEX "tenders_platform_id_idx" ON "tenders"("platform_id");
CREATE INDEX "tenders_session_date_idx" ON "tenders"("session_date");
CREATE INDEX "tenders_process_number_idx" ON "tenders"("process_number");
CREATE INDEX "tenders_notice_number_idx" ON "tenders"("notice_number");
CREATE INDEX "tenders_municipality_state_idx" ON "tenders"("municipality", "state");
CREATE INDEX "bids_tender_id_idx" ON "bids"("tender_id");
CREATE UNIQUE INDEX "bids_tender_id_company_id_key" ON "bids"("tender_id", "company_id");

ALTER TABLE "tenders" ADD CONSTRAINT "tenders_platform_id_fkey"
    FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bids" ADD CONSTRAINT "bids_tender_id_fkey"
    FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
