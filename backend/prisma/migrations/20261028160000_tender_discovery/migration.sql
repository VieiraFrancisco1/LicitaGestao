-- AlterTable
ALTER TABLE "tenders" ADD COLUMN     "discovery_opportunity_id" UUID;

-- CreateTable
CREATE TABLE "discovery_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "settings" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_run_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_opportunities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "source_keys" TEXT[],
    "data" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "progress" VARCHAR(200) NOT NULL DEFAULT 'Consultando fontes públicas',
    "reports" JSONB,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "added_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discovery_profiles_user_id_key" ON "discovery_profiles"("user_id");

-- CreateIndex
CREATE INDEX "discovery_profiles_organization_id_idx" ON "discovery_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "discovery_opportunities_organization_id_last_seen_at_idx" ON "discovery_opportunities"("organization_id", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_opportunities_organization_id_fingerprint_key" ON "discovery_opportunities"("organization_id", "fingerprint");

-- CreateIndex
CREATE INDEX "discovery_runs_organization_id_started_at_idx" ON "discovery_runs"("organization_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenders_discovery_opportunity_id_key" ON "tenders"("discovery_opportunity_id");

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_discovery_opportunity_id_fkey" FOREIGN KEY ("discovery_opportunity_id") REFERENCES "discovery_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_profiles" ADD CONSTRAINT "discovery_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_profiles" ADD CONSTRAINT "discovery_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_opportunities" ADD CONSTRAINT "discovery_opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Trava persistente: uma execução por conta, mesmo com múltiplos processos.
CREATE UNIQUE INDEX "discovery_runs_one_running_per_org" ON "discovery_runs" ("organization_id") WHERE "status" = 'RUNNING';
