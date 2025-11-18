-- Migration 028: Add stable_estimation_item_id to purchase_request_estimation_links_history
-- Date: 2025-01-31
-- Purpose: Align history table with current table structure after removing version-dependent columns

BEGIN;

-- 1. Add stable_estimation_item_id column to history table
ALTER TABLE purchase_request_estimation_links_history
  ADD COLUMN IF NOT EXISTS stable_estimation_item_id UUID;

-- 2. Backfill existing history records (if any exist) by looking up from estimation_items
-- This ensures historical data remains accessible
UPDATE purchase_request_estimation_links_history plh
SET stable_estimation_item_id = ei.stable_item_id
FROM estimation_items ei
WHERE plh.estimation_item_id = ei.id
  AND plh.stable_estimation_item_id IS NULL;

-- 3. Add index for performance
CREATE INDEX IF NOT EXISTS idx_pr_links_hist_stable_est 
  ON purchase_request_estimation_links_history(stable_estimation_item_id);

-- 4. Update comment
COMMENT ON COLUMN purchase_request_estimation_links_history.stable_estimation_item_id IS 
  'Version-independent reference to estimation item. Primary column for querying historical links.';

COMMENT ON COLUMN purchase_request_estimation_links_history.estimation_item_id IS 
  'DEPRECATED: Legacy column kept for backward compatibility. Use stable_estimation_item_id instead.';

COMMENT ON COLUMN purchase_request_estimation_links_history.purchase_request_item_id IS 
  'DEPRECATED: Legacy column kept for backward compatibility. No longer populated in new records.';

COMMIT;
