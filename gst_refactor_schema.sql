-- GST Refactor: Move GST from Payment to Estimation Level
-- This script:
-- 1. Adds GST fields to project_estimations table
-- 2. Removes GST fields from customer_payments_in table
-- 3. Truncates project data for fresh start

-- Step 1: Add GST fields to project_estimations table
ALTER TABLE project_estimations 
ADD COLUMN IF NOT EXISTS gst_percentage DECIMAL(5,2) DEFAULT 18.00,
ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(12,2) DEFAULT 0.00;

COMMENT ON COLUMN project_estimations.gst_percentage IS 'GST percentage applicable to this estimation (default 18%)';
COMMENT ON COLUMN project_estimations.gst_amount IS 'Calculated GST amount based on final_value';

-- Step 2: Remove GST fields from customer_payments_in table
ALTER TABLE customer_payments_in 
DROP COLUMN IF EXISTS gst_amount,
DROP COLUMN IF EXISTS is_gst_applicable,
DROP COLUMN IF EXISTS gst_percentage;

-- Step 3: Truncate project-related data (CASCADE will handle dependent records)
TRUNCATE TABLE project_activities CASCADE;
TRUNCATE TABLE project_ledger CASCADE;
TRUNCATE TABLE customer_payments_in CASCADE;
TRUNCATE TABLE vendor_payments CASCADE;
TRUNCATE TABLE vendor_boqs CASCADE;
TRUNCATE TABLE project_estimation_items CASCADE;
TRUNCATE TABLE project_estimations CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE projects CASCADE;

-- Reset sequences for clean start
ALTER SEQUENCE IF EXISTS projects_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS project_estimations_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS project_estimation_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS customer_payments_in_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS vendor_payments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS vendor_boqs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS project_ledger_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS project_activities_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS documents_id_seq RESTART WITH 1;

-- Verification queries (run these to confirm changes)
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'project_estimations' AND column_name IN ('gst_percentage', 'gst_amount');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'customer_payments_in' AND column_name IN ('gst_amount', 'is_gst_applicable', 'gst_percentage');
