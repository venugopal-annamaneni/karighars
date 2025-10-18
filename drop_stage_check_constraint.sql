-- Drop the old CHECK constraint on projects.stage
-- This constraint was created when the column was named 'phase' and has hardcoded stage values
-- Now that we copy stage values dynamically from biz_model_stages, we don't need this constraint

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_phase_check;
