CREATE TYPE "BidProgress" AS ENUM ('NAO_INICIADA', 'EM_ANALISE', 'EM_ANDAMENTO', 'FEITA', 'AGUARDANDO_SESSAO', 'EM_DISPUTA', 'HABILITACAO', 'RECURSO', 'FINALIZADA');
CREATE TYPE "BidSituation" AS ENUM ('PENDENTE', 'ANEXADA', 'CLASSIFICADA', 'DESCLASSIFICADA', 'HABILITADA', 'INABILITADA', 'VENCEDORA', 'PERDIDA', 'FINALIZADA');
CREATE TYPE "GuaranteeType" AS ENUM ('NAO_EXIGIDA', 'APOLICE', 'PROPOSTA_INICIAL', 'FIANCA', 'CAUCAO', 'OUTRO');
CREATE TYPE "DocumentCategory" AS ENUM ('EDITAL', 'ANEXO', 'PLANILHA_ORCAMENTARIA', 'CRONOGRAMA', 'COMPOSICAO', 'PROPOSTA', 'PROPOSTA_REAJUSTADA', 'SEGURO_GARANTIA', 'CARTA_FIANCA', 'HABILITACAO', 'RECURSO', 'CONTRARRAZOES', 'OUTRO');

CREATE TABLE "platforms" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "site" VARCHAR(500),
    "observations" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_users" (
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_users_pkey" PRIMARY KEY ("company_id", "user_id")
);

CREATE TABLE "bids" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
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
    "proposal_value" DECIMAL(15,2),
    "guarantee_type" "GuaranteeType" NOT NULL DEFAULT 'NAO_EXIGIDA',
    "guarantee_percentage" DECIMAL(5,2),
    "guarantee_value" DECIMAL(15,2),
    "platform_id" UUID,
    "platform_link" VARCHAR(500),
    "progress" "BidProgress" NOT NULL DEFAULT 'NAO_INICIADA',
    "situation" "BidSituation" NOT NULL DEFAULT 'PENDENTE',
    "observations" TEXT,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platforms_name_key" ON "platforms"("name");
CREATE INDEX "platforms_active_idx" ON "platforms"("active");
CREATE INDEX "company_users_user_id_idx" ON "company_users"("user_id");
CREATE INDEX "bids_company_id_idx" ON "bids"("company_id");
CREATE INDEX "bids_platform_id_idx" ON "bids"("platform_id");
CREATE INDEX "bids_session_date_idx" ON "bids"("session_date");
CREATE INDEX "bids_progress_idx" ON "bids"("progress");
CREATE INDEX "bids_situation_idx" ON "bids"("situation");
CREATE INDEX "bids_process_number_idx" ON "bids"("process_number");
CREATE INDEX "bids_notice_number_idx" ON "bids"("notice_number");
CREATE INDEX "bids_municipality_state_idx" ON "bids"("municipality", "state");

ALTER TABLE "bids" ADD CONSTRAINT "bids_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bids" ADD CONSTRAINT "bids_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bids" ADD CONSTRAINT "bids_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bids" ADD CONSTRAINT "bids_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "bid_id" UUID NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "size" INTEGER NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OUTRO',
    "path" VARCHAR(1000) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "documents_bid_id_idx" ON "documents"("bid_id");
CREATE INDEX "documents_uploaded_by_id_idx" ON "documents"("uploaded_by_id");
CREATE INDEX "documents_category_idx" ON "documents"("category");

ALTER TABLE "documents" ADD CONSTRAINT "documents_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
