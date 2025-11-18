-- Migration 027: Migrate purchase_request_estimation_links to use only stable IDs
-- Date: 2025-01-31
-- Purpose: Remove version-dependent IDs (purchase_request_item_id, estimation_item_id)
--          and use only stable IDs for version-independent references

BEGIN;

-- 1. Drop FK constraints on version-dependent columns
ALTER TABLE purchase_request_estimation_links
  DROP CONSTRAINT IF EXISTS purchase_request_estimation_links_purchase_request_item_id_fkey;

ALTER TABLE purchase_request_estimation_links
  DROP CONSTRAINT IF EXISTS purchase_request_estimation_links_estimation_item_id_fkey;

-- 2. Make version-dependent columns nullable (keep for backward compatibility for now)
ALTER TABLE purchase_request_estimation_links
  ALTER COLUMN purchase_request_item_id DROP NOT NULL;

ALTER TABLE purchase_request_estimation_links
  ALTER COLUMN estimation_item_id DROP NOT NULL;

-- 3. Ensure stable ID indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_pr_links_stable_item 
  ON purchase_request_estimation_links(stable_item_id);

CREATE INDEX IF NOT EXISTS idx_pr_links_stable_estimation 
  ON purchase_request_estimation_links(stable_estimation_item_id);

-- 4. Create composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_pr_links_stable_both 
  ON purchase_request_estimation_links(stable_item_id, stable_estimation_item_id);

-- 5. Update comments to mark deprecated columns
COMMENT ON COLUMN purchase_request_estimation_links.purchase_request_item_id IS 
  'DEPRECATED: Use stable_item_id for all queries. Kept only for backward compatibility, will be removed in future version.';

COMMENT ON COLUMN purchase_request_estimation_links.estimation_item_id IS 
  'DEPRECATED: Use stable_estimation_item_id for all queries. Kept only for backward compatibility, will be removed in future version.';

-- 6. Update table comment
COMMENT ON TABLE purchase_request_estimation_links IS 
  'Junction table linking PR items to estimation items using stable IDs (version-independent). Use stable_item_id and stable_estimation_item_id for all operations.';

COMMIT;
