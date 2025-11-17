-- Migration 022: Add stable_estimation_item_id to purchase_request_estimation_links
-- This makes PR-to-estimation links version-independent

-- Add stable_estimation_item_id column
ALTER TABLE purchase_request_estimation_links
  ADD COLUMN stable_estimation_item_id UUID NOT NULL;

-- Add foreign key constraint to estimation_items.stable_item_id
ALTER TABLE purchase_request_estimation_links
  ADD CONSTRAINT fk_stable_estimation_item_id 
  FOREIGN KEY (stable_estimation_item_id) 
  REFERENCES estimation_items(stable_item_id)
  ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX idx_pr_links_stable_estimation_item ON 
  purchase_request_estimation_links(stable_estimation_item_id);

-- Add index for composite lookups (PR item + estimation item)
CREATE INDEX idx_pr_links_stable_both ON 
  purchase_request_estimation_links(stable_item_id, stable_estimation_item_id);

-- Add comment
COMMENT ON COLUMN purchase_request_estimation_links.stable_estimation_item_id IS 
  'References the logical estimation item across versions using stable_item_id. This makes links version-independent - when estimation is re-versioned, links automatically resolve to the latest version of the same logical item.';

-- Note: We keep estimation_item_id for now but it will be deprecated
-- It references the physical record (version-specific), while stable_estimation_item_id references the logical item
COMMENT ON COLUMN purchase_request_estimation_links.estimation_item_id IS 
  'DEPRECATED: Version-specific item ID. Use stable_estimation_item_id instead for version-independent references.';
