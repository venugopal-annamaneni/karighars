-- Migration: Add CSV Upload Support Columns
-- Date: 2025-06-15

BEGIN;

-- Add columns to project_estimations if they don't exist
ALTER TABLE project_estimations 
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual_edit',
ADD COLUMN IF NOT EXISTS csv_file_path TEXT,
ADD COLUMN IF NOT EXISTS uploaded_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Add unique constraint for project_id + version
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_project_version'
  ) THEN
    ALTER TABLE project_estimations 
    ADD CONSTRAINT unique_project_version UNIQUE (project_id, version);
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_estimations_project_version ON project_estimations(project_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_estimations_active ON project_estimations(project_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_estimations_locked ON project_estimations(project_id, is_locked) WHERE is_locked = true;

-- Migrate existing data
UPDATE project_estimations 
SET is_active = true, source = 'manual_edit'
WHERE is_active IS NULL;

COMMIT;
