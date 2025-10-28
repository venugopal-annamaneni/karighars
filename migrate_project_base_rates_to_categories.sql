-- Migration Script: Convert project_base_rates flat columns to JSONB category_rates
-- This script migrates existing project_base_rates to the new flexible category structure

-- Step 1: Add the new category_rates JSONB column
ALTER TABLE project_base_rates ADD COLUMN IF NOT EXISTS category_rates JSONB DEFAULT '{"categories": []}'::jsonb;

-- Step 2: Migrate existing data to JSONB structure
UPDATE project_base_rates
SET category_rates = jsonb_build_object(
  'categories', jsonb_build_array(
    -- Woodwork Category
    jsonb_build_object(
      'id', 'woodwork',
      'category_name', 'Woodwork',
      'kg_label', 'Design and Consultation',
      'max_item_discount_percentage', 20,
      'kg_percentage', COALESCE(design_charge_percentage, 10),
      'max_kg_discount_percentage', COALESCE(max_design_charge_discount_percentage, 50)
    ),
    -- Misc Category
    jsonb_build_object(
      'id', 'misc',
      'category_name', 'Misc',
      'kg_label', 'Service Charges',
      'max_item_discount_percentage', 20,
      'kg_percentage', COALESCE(service_charge_percentage, 8),
      'max_kg_discount_percentage', COALESCE(max_service_charge_discount_percentage, 40)
    ),
    -- Shopping Category
    jsonb_build_object(
      'id', 'shopping',
      'category_name', 'Shopping',
      'kg_label', 'Shopping Service Charges',
      'max_item_discount_percentage', 20,
      'kg_percentage', COALESCE(shopping_charge_percentage, 5),
      'max_kg_discount_percentage', COALESCE(max_shopping_charge_discount_percentage, 30)
    )
  )
)
WHERE category_rates = '{"categories": []}'::jsonb OR category_rates IS NULL;

-- Step 3: Drop old flat columns (after verifying migration)
-- IMPORTANT: Uncomment these lines ONLY after verifying the migration was successful
-- and backing up your database

-- ALTER TABLE project_base_rates DROP COLUMN IF EXISTS service_charge_percentage;
-- ALTER TABLE project_base_rates DROP COLUMN IF EXISTS max_service_charge_discount_percentage;
-- ALTER TABLE project_base_rates DROP COLUMN IF EXISTS design_charge_percentage;
-- ALTER TABLE project_base_rates DROP COLUMN IF EXISTS max_design_charge_discount_percentage;
-- ALTER TABLE project_base_rates DROP COLUMN IF EXISTS shopping_charge_percentage;
-- ALTER TABLE project_base_rates DROP COLUMN IF EXISTS max_shopping_charge_discount_percentage;

-- Step 4: Verify migration
SELECT 
  id,
  project_id,
  status,
  active,
  category_rates
FROM project_base_rates
LIMIT 5;
