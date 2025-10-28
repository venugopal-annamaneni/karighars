-- Migration: Add pay_to_vendor_directly and sort_order to category_rates
-- Adds two new fields to existing category_rates JSONB structure

-- Step 1: Update biz_models
UPDATE biz_models
SET category_rates = (
  SELECT jsonb_build_object(
    'categories',
    jsonb_agg(
      category || 
      jsonb_build_object(
        'pay_to_vendor_directly', 
        CASE WHEN category->>'id' = 'shopping' THEN true ELSE false END
      ) ||
      jsonb_build_object(
        'sort_order',
        CASE 
          WHEN category->>'id' = 'woodwork' THEN 1
          WHEN category->>'id' = 'misc' THEN 2
          WHEN category->>'id' = 'shopping' THEN 3
          ELSE 999
        END
      )
    )
  )
  FROM jsonb_array_elements(category_rates->'categories') AS category
)
WHERE category_rates IS NOT NULL AND category_rates->'categories' IS NOT NULL;

-- Step 2: Update project_base_rates
UPDATE project_base_rates
SET category_rates = (
  SELECT jsonb_build_object(
    'categories',
    jsonb_agg(
      category || 
      jsonb_build_object(
        'pay_to_vendor_directly', 
        CASE WHEN category->>'id' = 'shopping' THEN true ELSE false END
      ) ||
      jsonb_build_object(
        'sort_order',
        CASE 
          WHEN category->>'id' = 'woodwork' THEN 1
          WHEN category->>'id' = 'misc' THEN 2
          WHEN category->>'id' = 'shopping' THEN 3
          ELSE 999
        END
      )
    )
  )
  FROM jsonb_array_elements(category_rates->'categories') AS category
)
WHERE category_rates IS NOT NULL AND category_rates->'categories' IS NOT NULL;

-- Step 3: Verify migration
SELECT 
  'biz_models' as table_name,
  id,
  code,
  category_rates->'categories'->0->>'pay_to_vendor_directly' as has_vendor_flag,
  category_rates->'categories'->0->>'sort_order' as has_sort_order
FROM biz_models
LIMIT 1;

SELECT 
  'project_base_rates' as table_name,
  id,
  project_id,
  category_rates->'categories'->0->>'pay_to_vendor_directly' as has_vendor_flag,
  category_rates->'categories'->0->>'sort_order' as has_sort_order
FROM project_base_rates
LIMIT 1;
