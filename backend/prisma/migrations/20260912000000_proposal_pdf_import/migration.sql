ALTER TABLE "proposal_letter_templates"
  ADD COLUMN "source_type" VARCHAR(20) NOT NULL DEFAULT 'TEXT',
  ADD COLUMN "source_file_name" VARCHAR(255),
  ADD COLUMN "source_pdf_imported_at" TIMESTAMPTZ;
