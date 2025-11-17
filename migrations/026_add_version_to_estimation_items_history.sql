-- Migration 026: Add version column to estimation_items_history
-- Track item edit history with version numbers

-- Add version column
ALTER TABLE estimation_items_history
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Create index for version queries
CREATE INDEX IF NOT EXISTS idx_estimation_items_history_version 
  ON estimation_items_history(estimation_id, stable_item_id, version);

-- Create composite index for efficient history lookups
CREATE INDEX IF NOT EXISTS idx_estimation_items_history_composite
  ON estimation_items_history(stable_item_id, version DESC);

-- Add comment
COMMENT ON COLUMN estimation_items_history.version IS 
  'Version number for this item within the estimation. Increments with each edit. Tracks item lifecycle: v1, v2, v3...';
