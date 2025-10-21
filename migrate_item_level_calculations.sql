-- Migration: Item-level calculation fields
-- Date: 2025-10-21
-- Purpose: Add columns for item-level karighar charges, discounts, and GST calculations

-- Add new columns to estimation_items
ALTER TABLE estimation_items ADD COLUMN IF NOT EXISTS karighar_charges_percentage NUMERIC(5,2) DEFAULT 10;
ALTER TABLE estimation_items ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 0;
ALTER TABLE estimation_items ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2) DEFAULT 18;
ALTER TABLE estimation_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC(20,2) DEFAULT 0;
ALTER TABLE estimation_items ADD COLUMN IF NOT EXISTS karighar_charges_amount NUMERIC(20,2) DEFAULT 0;
ALTER TABLE estimation_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(20,2) DEFAULT 0;
ALTER TABLE estimation_items ADD COLUMN IF NOT EXISTS amount_before_gst NUMERIC(20,2) DEFAULT 0;
ALTER TABLE estimation_items ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(20,2) DEFAULT 0;
ALTER TABLE estimation_items ADD COLUMN IF NOT EXISTS item_total NUMERIC(20,2) DEFAULT 0;

-- Update category constraint to include shopping_service
ALTER TABLE estimation_items DROP CONSTRAINT IF EXISTS estimation_items_category_check;
ALTER TABLE estimation_items ADD CONSTRAINT estimation_items_category_check 
  CHECK ((category = ANY (ARRAY['woodwork'::text, 'misc_internal'::text, 'misc_external'::text, 'shopping_service'::text])));

-- Add comments
COMMENT ON COLUMN estimation_items.karighar_charges_percentage IS 'KG charges percentage - D&C for woodwork, Service charge for misc/shopping';
COMMENT ON COLUMN estimation_items.discount_percentage IS 'Discount percentage on (subtotal + karighar_charges) for woodwork/misc, only on karighar_charges for shopping';
COMMENT ON COLUMN estimation_items.gst_percentage IS 'GST percentage applicable on this item';
COMMENT ON COLUMN estimation_items.subtotal IS 'Quantity × Unit Price';
COMMENT ON COLUMN estimation_items.karighar_charges_amount IS 'Subtotal × karighar_charges_percentage';
COMMENT ON COLUMN estimation_items.discount_amount IS 'Discount amount calculated';
COMMENT ON COLUMN estimation_items.amount_before_gst IS 'Amount after karighar charges and discount, before GST';
COMMENT ON COLUMN estimation_items.gst_amount IS 'GST amount';
COMMENT ON COLUMN estimation_items.item_total IS 'Final item total including all charges and GST';

-- Add shopping_percentage to biz_model_milestones for SHOPPING_100 milestone
ALTER TABLE biz_model_milestones ADD COLUMN IF NOT EXISTS shopping_percentage NUMERIC(5,2) DEFAULT 0;
COMMENT ON COLUMN biz_model_milestones.shopping_percentage IS 'Cumulative percentage for shopping service items (used in SHOPPING_100 milestone)';
