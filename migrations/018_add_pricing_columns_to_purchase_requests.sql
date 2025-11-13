-- Migration 018: Add aggregate pricing columns to purchase_requests
-- Date: 2025-01-30
-- Purpose: Track total pricing for entire PR (sum of all items)

BEGIN;

-- Add aggregate pricing columns
ALTER TABLE purchase_requests
ADD COLUMN IF NOT EXISTS items_value NUMERIC(20,2),
ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS final_value NUMERIC(20,2);

-- Add comments explaining the aggregations
COMMENT ON COLUMN purchase_requests.items_value 
IS 'Total items value = SUM(subtotal) of all purchase_request_items in this PR';

COMMENT ON COLUMN purchase_requests.gst_amount 
IS 'Total GST amount = SUM(gst_amount) of all purchase_request_items in this PR';

COMMENT ON COLUMN purchase_requests.final_value 
IS 'Final PR value = SUM(item_total) of all purchase_request_items in this PR (items_value + gst_amount)';

COMMIT;
