-- Migration 025: Refactor project_estimations to match PR pattern
-- Remove version and is_active columns
-- Add unique constraint (one estimation per project)
-- Add updated_at and updated_by for tracking edits

-- 1. Remove is_active column (no longer needed)
ALTER TABLE project_estimations
  DROP COLUMN IF EXISTS is_active;

-- 2. Remove version column (tracked at item level instead)
ALTER TABLE project_estimations
  DROP COLUMN IF EXISTS version;

-- 3. Add updated_at and updated_by for tracking modifications
ALTER TABLE project_estimations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by INTEGER;

-- 4. Add foreign key constraint
ALTER TABLE project_estimations
  ADD CONSTRAINT fk_project_estimations_updated_by 
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- 5. Add unique constraint on project_id (one estimation per project)
-- Note: This will fail if multiple estimations exist for same project
-- Clean up data first if needed
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_project_estimations_project_id'
  ) THEN
    ALTER TABLE project_estimations
      ADD CONSTRAINT uq_project_estimations_project_id 
      UNIQUE (project_id);
  END IF;
END $$;

-- 6. Create index on updated_at
CREATE INDEX IF NOT EXISTS idx_project_estimations_updated_at 
  ON project_estimations(updated_at);

-- Add comments
COMMENT ON COLUMN project_estimations.updated_at IS 
  'Timestamp when the estimation was last updated';

COMMENT ON COLUMN project_estimations.updated_by IS 
  'User ID who last updated the estimation';

COMMENT ON TABLE project_estimations IS 
  'Project estimations table. One estimation per project. Edit the same estimation multiple times with item versioning in estimation_items_history.';
