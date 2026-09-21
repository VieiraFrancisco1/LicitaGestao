ALTER TABLE "tenders"
ADD COLUMN "seobra_links" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "tenders"
SET "seobra_links" = ARRAY["seobra_link"]
WHERE "seobra_link" IS NOT NULL
  AND BTRIM("seobra_link") <> '';
