-- Migration: Dynamic Milestone Categories
-- Description: Replace hardcoded category percentage columns with dynamic JSONB structure
-- Date: 2025-06-15

-- Add new column for dynamic category percentages
ALTER TABLE biz_model_milestones 
ADD COLUMN IF NOT EXISTS category_percentages JSONB DEFAULT '{}'::jsonb;

-- Migrate existing data from old columns to new JSONB structure
UPDATE biz_model_milestones 
SET category_percentages = jsonb_build_object(
    'woodwork', COALESCE(woodwork_percentage, 0),
    'misc', COALESCE(misc_percentage, 0),
    'shopping', COALESCE(shopping_percentage, 0)
)
WHERE category_percentages = '{}'::jsonb;

-- Drop old columns
ALTER TABLE biz_model_milestones 
DROP COLUMN IF EXISTS woodwork_percentage,
DROP COLUMN IF EXISTS misc_percentage,
DROP COLUMN IF EXISTS shopping_percentage;

-- Add comment
COMMENT ON COLUMN biz_model_milestones.category_percentages IS 'JSONB structure mapping category IDs to cumulative percentages. Example: {"woodwork": 30, "misc": 50, "shopping": 100}. Categories are dynamically defined in biz_models.category_rates.';
