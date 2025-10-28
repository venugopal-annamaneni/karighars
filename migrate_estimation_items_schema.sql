-- Migration: Update estimation_items schema with item-level and KG discount columns
-- Adds separate discount tracking for items and KG charges

-- Step 1: Add new discount columns to estimation_items
ALTER TABLE estimation_items 
    ADD COLUMN IF NOT EXISTS item_discount_percentage NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS item_discount_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_kg_charges_percentage NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_kg_charges_amount NUMERIC DEFAULT 0;

-- Step 2: Update existing data (if any discount_percentage exists, migrate it)
-- Note: This assumes old discount_percentage was applied to subtotal
UPDATE estimation_items 
SET 
    item_discount_percentage = COALESCE(discount_percentage, 0),
    item_discount_amount = COALESCE(discount_amount, 0)
WHERE item_discount_percentage = 0 AND discount_percentage IS NOT NULL;

-- Step 3: Update comments
COMMENT ON COLUMN estimation_items.item_discount_percentage IS 'Discount percentage on subtotal (applied before KG charges)';
COMMENT ON COLUMN estimation_items.item_discount_amount IS 'Discount amount calculated on item subtotal';
COMMENT ON COLUMN estimation_items.discount_kg_charges_percentage IS 'Discount percentage applied on Karighar charges portion';
COMMENT ON COLUMN estimation_items.discount_kg_charges_amount IS 'Discount amount calculated on Karighar charges portion';

-- Step 4: Verify migration
SELECT 
    id,
    item_name,
    category,
    subtotal,
    item_discount_percentage,
    item_discount_amount,
    karighar_charges_amount,
    discount_kg_charges_percentage,
    discount_kg_charges_amount,
    item_total
FROM estimation_items
LIMIT 5;
