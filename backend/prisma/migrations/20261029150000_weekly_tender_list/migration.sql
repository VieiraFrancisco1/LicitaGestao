-- Lista de oportunidades selecionadas manualmente para avaliação semanal.
-- A lista é compartilhada somente dentro da mesma organização.
CREATE TABLE "weekly_tender_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weekly_tender_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "weekly_tender_items_organization_id_opportunity_id_key"
    ON "weekly_tender_items"("organization_id", "opportunity_id");
CREATE INDEX "weekly_tender_items_organization_id_created_at_idx"
    ON "weekly_tender_items"("organization_id", "created_at");
ALTER TABLE "weekly_tender_items" ADD CONSTRAINT "weekly_tender_items_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_tender_items" ADD CONSTRAINT "weekly_tender_items_opportunity_id_fkey"
    FOREIGN KEY ("opportunity_id") REFERENCES "discovery_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
