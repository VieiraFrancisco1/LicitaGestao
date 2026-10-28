CREATE TABLE "platform_credentials" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "platform" VARCHAR(30) NOT NULL,
  "secret_encrypted" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_credentials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_credentials_user_id_platform_key" ON "platform_credentials"("user_id", "platform");
CREATE INDEX "platform_credentials_organization_id_platform_idx" ON "platform_credentials"("organization_id", "platform");
ALTER TABLE "platform_credentials" ADD CONSTRAINT "platform_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_credentials" ADD CONSTRAINT "platform_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
