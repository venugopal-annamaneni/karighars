-- Migration: Add status column to estimation_items
-- Date: 2025-01-30

BEGIN;

-- Add status column to estimation_items
ALTER TABLE estimation_items 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Queued';

-- Update existing records to have Queued status
UPDATE estimation_items 
SET status = 'Queued'
WHERE status IS NULL;

-- Add comment
COMMENT ON COLUMN estimation_items.status IS 'Item status: Queued, PR Raised, etc. Used for workflow tracking';

COMMIT;
