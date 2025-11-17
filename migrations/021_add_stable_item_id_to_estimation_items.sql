-- Migration 021: Add stable_item_id to estimation_items
-- This enables tracking logical items across estimation versions

-- Add stable_item_id column with UUID type
ALTER TABLE estimation_items
  ADD COLUMN stable_item_id UUID DEFAULT gen_random_uuid() NOT NULL;

-- Add unique constraint on stable_item_id (required for foreign keys)
ALTER TABLE estimation_items
  ADD CONSTRAINT uq_estimation_items_stable_id UNIQUE (stable_item_id);

-- Add index for performance (joins and lookups)
-- Note: Unique constraint already creates an index, but explicit index can help with query planning
CREATE INDEX idx_estimation_items_stable_id ON estimation_items(stable_item_id);

-- Add unique constraint within an estimation version
-- (same stable_item_id shouldn't appear twice in same version)
CREATE UNIQUE INDEX idx_estimation_items_stable_version ON estimation_items(estimation_id, stable_item_id);

-- Add comment
COMMENT ON COLUMN estimation_items.stable_item_id IS 
  'Stable identifier that persists across estimation versions. Used to track the same logical item (e.g., "TV Unit") across version 1, 2, 3, etc. This enables version-independent links from purchase requests.';

COMMENT ON TABLE estimation_items IS 
  'Estimation items with stable_item_id for tracking across versions. When creating a new estimation version, preserve stable_item_id for existing items to maintain link integrity.';
