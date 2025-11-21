-- Migration 029: Add active flag to purchase_requests for versioning
-- This supports creating new PR records on edit, marking old ones inactive
-- Old items will be moved to history tables

BEGIN;

-- 1. Add active flag to purchase_requests
ALTER TABLE purchase_requests 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true NOT NULL;

-- 2. Add active flag to purchase_request_items (for consistency)
ALTER TABLE purchase_request_items 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true NOT NULL;

-- 3. Ensure history tables have archived_at timestamp
ALTER TABLE purchase_request_items_history 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP DEFAULT NOW();

ALTER TABLE purchase_request_estimation_links_history 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP DEFAULT NOW();

-- 4. Create index on active flag for faster queries
CREATE INDEX IF NOT EXISTS idx_purchase_requests_active 
ON purchase_requests(active) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_purchase_request_items_active 
ON purchase_request_items(active) WHERE active = true;

-- 5. Create index on purchase_request_id for history tables (for audit queries)
CREATE INDEX IF NOT EXISTS idx_pr_items_history_pr_id 
ON purchase_request_items_history(purchase_request_id);

CREATE INDEX IF NOT EXISTS idx_pr_links_history_pr_item_id 
ON purchase_request_estimation_links_history(stable_item_id);

-- 6. Drop purchase_request_versions table if it exists
DROP TABLE IF EXISTS purchase_request_versions CASCADE;

-- 7. Add comment explaining the versioning strategy
COMMENT ON COLUMN purchase_requests.active IS 
'Flag to track current version of PR. On edit, old PR is marked inactive, new PR record created.';

COMMENT ON TABLE purchase_request_items_history IS 
'Historical items - old items moved here on PR edit. Current items stay in purchase_request_items.';

COMMENT ON TABLE purchase_request_estimation_links_history IS 
'Historical links - old links moved here on PR edit. Current links stay in purchase_request_estimation_links.';

COMMIT;
