-- Preserva todas as plataformas e licitações existentes.
INSERT INTO "platforms" ("id", "organization_id", "name", "site", "active", "created_at", "updated_at")
SELECT md5(o."id"::text || ':mais-brasil')::uuid, o."id", 'Mais Brasil',
       'https://licitamaisbrasil.com.br/', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organizations" o
ON CONFLICT ("organization_id", "name") DO NOTHING;
