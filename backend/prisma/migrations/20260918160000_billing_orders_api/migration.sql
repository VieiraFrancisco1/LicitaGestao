BEGIN;

CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED');
CREATE TYPE "SubscriptionPlan" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL');
CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'FAILED');

ALTER TABLE "organizations"
ADD COLUMN "billing_exempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "subscription_plan" "SubscriptionPlan",
ADD COLUMN "subscription_expires_at" TIMESTAMP(3);

-- Tudo que já existia antes desta atualização continua liberado.
UPDATE "organizations"
SET "billing_exempt" = true;

CREATE TABLE "billing_payments" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "plan" "SubscriptionPlan" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "BillingPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" VARCHAR(40) NOT NULL DEFAULT 'MERCADO_PAGO',
  "provider_order_id" VARCHAR(180),
  "provider_payment_id" VARCHAR(180),
  "payment_method" VARCHAR(100),
  "provider_status" VARCHAR(80),
  "provider_status_detail" VARCHAR(120),
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_payments_provider_order_id_key"
ON "billing_payments"("provider_order_id");
CREATE INDEX "billing_payments_organization_id_created_at_idx"
ON "billing_payments"("organization_id", "created_at");
CREATE INDEX "billing_payments_status_idx"
ON "billing_payments"("status");
CREATE INDEX "billing_payments_provider_payment_id_idx"
ON "billing_payments"("provider_payment_id");

ALTER TABLE "billing_payments"
ADD CONSTRAINT "billing_payments_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
