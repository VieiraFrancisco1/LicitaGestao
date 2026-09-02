ALTER TABLE "tenders"
ADD COLUMN "execution_term" VARCHAR(120);

CREATE TABLE "proposal_letter_templates" (
    "id" UUID NOT NULL,
    "scope_key" VARCHAR(180) NOT NULL,
    "municipality" VARCHAR(120) NOT NULL,
    "state" CHAR(2),
    "body_template" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "proposal_letter_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proposal_letter_templates_scope_key_key"
ON "proposal_letter_templates"("scope_key");

CREATE INDEX "proposal_letter_templates_municipality_state_idx"
ON "proposal_letter_templates"("municipality", "state");
