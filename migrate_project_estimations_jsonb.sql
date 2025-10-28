-- Migration: Update project_estimations to use JSONB for dynamic category breakdown
-- Replaces hardcoded category columns with flexible JSONB structure

-- Step 1: Add new JSONB and aggregate columns
ALTER TABLE project_estimations 
    ADD COLUMN IF NOT EXISTS category_breakdown JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS total_items_value NUMERIC(20,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_kg_charges NUMERIC(20,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_discount_amount NUMERIC(20,2) DEFAULT 0;

-- Step 2: Migrate existing data from flat columns to JSONB
UPDATE project_estimations 
SET category_breakdown = jsonb_build_object(
    'woodwork', jsonb_build_object(
        'subtotal', COALESCE(woodwork_value, 0),
        'item_discount_amount', 0,
        'discounted_subtotal', COALESCE(woodwork_value, 0),
        'kg_charges_gross', 0,
        'kg_charges_discount', 0,
        'kg_charges_net', 0,
        'amount_before_gst', COALESCE(woodwork_value, 0),
        'gst_amount', 0,
        'total', COALESCE(woodwork_value, 0)
    ),
    'misc_internal', jsonb_build_object(
        'subtotal', COALESCE(misc_internal_value, 0),
        'item_discount_amount', 0,
        'discounted_subtotal', COALESCE(misc_internal_value, 0),
        'kg_charges_gross', 0,
        'kg_charges_discount', 0,
        'kg_charges_net', 0,
        'amount_before_gst', COALESCE(misc_internal_value, 0),
        'gst_amount', 0,
        'total', COALESCE(misc_internal_value, 0)
    ),
    'misc_external', jsonb_build_object(
        'subtotal', COALESCE(misc_external_value, 0),
        'item_discount_amount', 0,
        'discounted_subtotal', COALESCE(misc_external_value, 0),
        'kg_charges_gross', 0,
        'kg_charges_discount', 0,
        'kg_charges_net', 0,
        'amount_before_gst', COALESCE(misc_external_value, 0),
        'gst_amount', 0,
        'total', COALESCE(misc_external_value, 0)
    ),
    'shopping_service', jsonb_build_object(
        'subtotal', COALESCE(shopping_service_value, 0),
        'item_discount_amount', 0,
        'discounted_subtotal', COALESCE(shopping_service_value, 0),
        'kg_charges_gross', 0,
        'kg_charges_discount', 0,
        'kg_charges_net', 0,
        'amount_before_gst', COALESCE(shopping_service_value, 0),
        'gst_amount', 0,
        'total', COALESCE(shopping_service_value, 0)
    )
),
total_items_value = COALESCE(woodwork_value, 0) + COALESCE(misc_internal_value, 0) + 
                    COALESCE(misc_external_value, 0) + COALESCE(shopping_service_value, 0)
WHERE category_breakdown = '{}'::jsonb OR category_breakdown IS NULL;

-- Step 3: Add column comments
COMMENT ON COLUMN project_estimations.category_breakdown IS 'JSONB structure: {"category_id": {"subtotal": 0, "item_discount_amount": 0, "discounted_subtotal": 0, "kg_charges_gross": 0, "kg_charges_discount": 0, "kg_charges_net": 0, "amount_before_gst": 0, "gst_amount": 0, "total": 0}}';
COMMENT ON COLUMN project_estimations.total_items_value IS 'Sum of all discounted item subtotals across categories';
COMMENT ON COLUMN project_estimations.total_kg_charges IS 'Sum of all final KG charges (after discounts) across categories';
COMMENT ON COLUMN project_estimations.total_discount_amount IS 'Sum of all discounts (item + KG) across categories';

-- Step 4: Create index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_project_estimations_category_breakdown 
ON project_estimations USING gin(category_breakdown);

-- Step 5: Drop old flat columns (uncomment after verification)
-- IMPORTANT: Verify data migration before dropping columns
-- ALTER TABLE project_estimations 
--     DROP COLUMN IF EXISTS woodwork_value,
--     DROP COLUMN IF EXISTS misc_internal_value,
--     DROP COLUMN IF EXISTS misc_external_value,
--     DROP COLUMN IF EXISTS shopping_service_value;

-- Step 6: Verify migration
SELECT 
    id,
    project_id,
    version,
    category_breakdown,
    total_items_value,
    total_kg_charges,
    total_discount_amount,
    gst_amount,
    final_value
FROM project_estimations
LIMIT 2;
