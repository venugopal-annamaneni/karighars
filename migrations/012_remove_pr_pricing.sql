-- Migration: Remove pricing columns from purchase_request_items
-- Date: 2025-01-30
-- Reason: PR items don't carry customer pricing. Vendor pricing comes from BOQ.
-- Allow partial quantities per item across multiple PRs.

BEGIN;

-- Remove pricing columns (customer-facing, not relevant for vendor PRs)
ALTER TABLE purchase_request_items 
DROP COLUMN IF EXISTS unit_price,
DROP COLUMN IF EXISTS quoted_price,
DROP COLUMN IF EXISTS final_price,
DROP COLUMN IF EXISTS subtotal,
DROP COLUMN IF EXISTS gst_amount,
DROP COLUMN IF EXISTS item_total;

-- Make quantity NOT NULL (must specify quantity for PR)
ALTER TABLE purchase_request_items 
ALTER COLUMN quantity SET NOT NULL;

-- Update purchase_requests table comments
COMMENT ON COLUMN purchase_request_items.quantity IS 'Quantity for this PR (can be partial from estimation item). Allows splitting items across multiple PRs.';
COMMENT ON COLUMN purchase_request_items.pending_quantity IS 'Quantity pending delivery from vendor';
COMMENT ON COLUMN purchase_request_items.received_quantity IS 'Quantity received from vendor';

-- Remove financial columns from purchase_requests (will be calculated from BOQ later)
ALTER TABLE purchase_requests 
DROP COLUMN IF EXISTS total_amount,
DROP COLUMN IF EXISTS gst_amount,
DROP COLUMN IF EXISTS final_amount;

-- Add notes field for general remarks
ALTER TABLE purchase_requests
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON TABLE purchase_request_items IS 'PR items with quantity tracking. One estimation item can have multiple PR items across different PRs.';

COMMIT;
