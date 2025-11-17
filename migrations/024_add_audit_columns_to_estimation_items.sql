-- Migration 024: Add missing audit columns to estimation_items
-- created_at and updated_at already exist, adding created_by and updated_by

ALTER TABLE estimation_items
  ADD COLUMN IF NOT EXISTS created_by INTEGER,
  ADD COLUMN IF NOT EXISTS updated_by INTEGER;

-- Add indexes for performance
CREATE INDEX idx_estimation_items_created_at ON estimation_items(created_at);
CREATE INDEX idx_estimation_items_created_by ON estimation_items(created_by);

-- Add foreign key constraints
ALTER TABLE estimation_items
  ADD CONSTRAINT fk_estimation_items_created_by 
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE estimation_items
  ADD CONSTRAINT fk_estimation_items_updated_by 
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON COLUMN estimation_items.created_at IS 'Timestamp when the item was created';
COMMENT ON COLUMN estimation_items.created_by IS 'User ID who created the item';
COMMENT ON COLUMN estimation_items.updated_at IS 'Timestamp when the item was last updated';
COMMENT ON COLUMN estimation_items.updated_by IS 'User ID who last updated the item';
