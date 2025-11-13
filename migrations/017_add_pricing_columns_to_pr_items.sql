-- Migration 017: Add pricing columns to purchase_request_items
-- Date: 2025-01-30
-- Purpose: Track pricing details for PR items across all fulfillment modes

BEGIN;

-- Add pricing columns
ALTER TABLE purchase_request_items
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(20,2),
ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS amount_before_gst NUMERIC(20,2),
ADD COLUMN IF NOT EXISTS item_total NUMERIC(20,2);

-- Add comments explaining the calculations
COMMENT ON COLUMN purchase_request_items.subtotal 
IS 'Subtotal = quantity × unit_price (base calculation before any adjustments)';

COMMENT ON COLUMN purchase_request_items.gst_percentage 
IS 'GST percentage applicable to this item (e.g., 18.00 for 18%)';

COMMENT ON COLUMN purchase_request_items.gst_amount 
IS 'GST Amount = subtotal × (gst_percentage / 100)';

COMMENT ON COLUMN purchase_request_items.amount_before_gst 
IS 'Amount before GST = subtotal (currently same as subtotal, will differ when discounts are added)';

COMMENT ON COLUMN purchase_request_items.item_total 
IS 'Item Total = amount_before_gst + gst_amount (final amount including GST)';

COMMIT;
