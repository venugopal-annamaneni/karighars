-- Migration 014: Add width and height columns to purchase_request_items
-- This allows capturing dimensional data for area-based units (sqft)

ALTER TABLE purchase_request_items 
ADD COLUMN IF NOT EXISTS width DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS height DECIMAL(10,2);

-- Add comment for documentation
COMMENT ON COLUMN purchase_request_items.width IS 'Width dimension for area-based units (sqft). NULL for count-based units.';
COMMENT ON COLUMN purchase_request_items.height IS 'Height dimension for area-based units (sqft). NULL for count-based units.';
