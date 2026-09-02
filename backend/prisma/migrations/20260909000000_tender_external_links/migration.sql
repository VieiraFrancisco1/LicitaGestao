-- Adiciona link manual do SEOBRA sem alterar registros existentes.
ALTER TABLE "tenders" ADD COLUMN "seobra_link" VARCHAR(500);
