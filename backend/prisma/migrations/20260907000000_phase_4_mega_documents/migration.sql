ALTER TABLE "companies"
ADD COLUMN "mega_folder_path" VARCHAR(1000);

ALTER TABLE "documents"
ADD COLUMN "storage_provider" VARCHAR(20) NOT NULL DEFAULT 'LOCAL',
ADD COLUMN "remote_node_id" VARCHAR(120),
ADD COLUMN "remote_path" VARCHAR(1000);

CREATE INDEX "documents_remote_node_id_idx" ON "documents"("remote_node_id");
