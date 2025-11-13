-- Migration 016: Add unit_price column to purchase_request_items
-- Date: 2025-01-30

BEGIN;

-- Add unit_price column
ALTER TABLE purchase_request_items
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2);

-- Add comment
COMMENT ON COLUMN purchase_request_items.unit_price 
IS 'Unit price for the PR item - can be entered for direct purchases or quoted prices';

COMMIT;
