-- Optional Cleanup Script: Drop Legacy Columns
-- Run this ONLY after verifying all features work with new JSONB structure
-- IMPORTANT: Backup your database before running this!

-- Step 1: Drop legacy columns from biz_models (if they still exist)
-- These have been migrated to category_rates JSONB
ALTER TABLE biz_models 
    DROP COLUMN IF EXISTS service_charge_percentage,
    DROP COLUMN IF EXISTS max_service_charge_discount_percentage,
    DROP COLUMN IF EXISTS design_charge_percentage,
    DROP COLUMN IF EXISTS max_design_charge_discount_percentage,
    DROP COLUMN IF EXISTS shopping_charge_percentage,
    DROP COLUMN IF EXISTS max_shopping_charge_discount_percentage;

-- Step 2: Drop legacy columns from project_base_rates (if they still exist)
-- These have been migrated to category_rates JSONB
ALTER TABLE project_base_rates 
    DROP COLUMN IF EXISTS service_charge_percentage,
    DROP COLUMN IF EXISTS max_service_charge_discount_percentage,
    DROP COLUMN IF EXISTS design_charge_percentage,
    DROP COLUMN IF EXISTS max_design_charge_discount_percentage,
    DROP COLUMN IF EXISTS shopping_charge_percentage,
    DROP COLUMN IF EXISTS max_shopping_charge_discount_percentage;

-- Step 3: Drop legacy columns from estimation_items (if they still exist)
-- These have been replaced with item_discount and kg_discount columns
ALTER TABLE estimation_items 
    DROP COLUMN IF EXISTS discount_percentage,
    DROP COLUMN IF EXISTS discount_amount;

-- Step 4: Drop legacy columns from project_estimations (if they still exist)
-- These have been migrated to category_breakdown JSONB
ALTER TABLE project_estimations 
    DROP COLUMN IF EXISTS woodwork_value,
    DROP COLUMN IF EXISTS misc_internal_value,
    DROP COLUMN IF EXISTS misc_external_value,
    DROP COLUMN IF EXISTS shopping_service_value;

-- Verify cleanup
SELECT 'Cleanup complete!' as status;
