-- Migration: Fix purchase_request_items unique constraint
-- Date: 2025-01-30
-- Change from: UNIQUE(estimation_item_id) 
-- Change to: UNIQUE(purchase_request_id, estimation_item_id)

BEGIN;

-- Drop the old unique constraint on estimation_item_id alone
ALTER TABLE purchase_request_items 
DROP CONSTRAINT IF EXISTS purchase_request_items_estimation_item_id_key;

-- Add composite unique constraint to prevent duplicate items in the same PR
-- This allows the same estimation item to be in multiple PRs if needed
ALTER TABLE purchase_request_items 
ADD CONSTRAINT unique_pr_estimation_item 
UNIQUE (purchase_request_id, estimation_item_id);

-- Add comment
COMMENT ON CONSTRAINT unique_pr_estimation_item ON purchase_request_items 
IS 'Prevents duplicate items in the same PR. Allows same item in different PRs.';

COMMIT;
