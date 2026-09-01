CREATE TYPE "TenderListStatus" AS ENUM ('PENDENTE', 'ANEXADA');

ALTER TABLE "tenders"
    ADD COLUMN "spreadsheet_ready" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "list_status" "TenderListStatus" NOT NULL DEFAULT 'PENDENTE',
    ALTER COLUMN "notice_number" DROP NOT NULL,
    ALTER COLUMN "process_number" DROP NOT NULL,
    ALTER COLUMN "state" DROP NOT NULL,
    ALTER COLUMN "agency" DROP NOT NULL,
    ALTER COLUMN "session_time" DROP NOT NULL;

CREATE INDEX "tenders_list_status_idx" ON "tenders"("list_status");

CREATE TABLE "discount_calculations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "tender_id" UUID NOT NULL,
    "discounted_value" DECIMAL(15,2),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "discount_calculations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "discount_calculations_company_id_tender_id_key"
    ON "discount_calculations"("company_id", "tender_id");
CREATE INDEX "discount_calculations_company_id_idx" ON "discount_calculations"("company_id");
CREATE INDEX "discount_calculations_tender_id_idx" ON "discount_calculations"("tender_id");

ALTER TABLE "discount_calculations" ADD CONSTRAINT "discount_calculations_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "discount_calculations" ADD CONSTRAINT "discount_calculations_tender_id_fkey"
    FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "discount_calculations" ADD CONSTRAINT "discount_calculations_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "discount_calculations" ADD CONSTRAINT "discount_calculations_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
